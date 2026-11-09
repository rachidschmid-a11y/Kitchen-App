// Rezeptfotos mit Gemini auslesen (Firebase AI Logic, Gemini Developer API – kostenloser Spark-Tarif).
// Fotos rein → Gemini antwortet als JSON nach festem Schema → Entwurf fürs Formular oder Importliste.
// Die Fotos werden nur zum Auslesen geschickt und nirgends gespeichert.
// Reine Logik oben (getestet in tests/ai-import.test.js), der Aufruf von Gemini unten.

export const MAX_PHOTOS = 8;
// Neueste Flash-Version zuerst; ältere als Rückfall, falls ein Name (noch) nicht verfügbar ist.
export const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js';

export function buildVisionPrompt({ categories = [], tags = [] } = {}) {
  return [
    'Du bekommst ein oder mehrere Fotos von Rezepten (Kochbuchseiten, Rezeptkarten, Zeitschriften, Handschrift, Screenshots).',
    'Lies die Rezepte und gib sie als JSON nach dem vorgegebenen Schema zurück.',
    '',
    'Regeln:',
    '- Mengen, Einheiten und Arbeitsschritte genau wie im Original übernehmen. Nichts erfinden, nichts weglassen.',
    '- Geht ein Rezept über mehrere Fotos (Fortsetzung auf der nächsten Seite), daraus EIN Rezept machen. Verschiedene Rezepte getrennt zurückgeben.',
    '- Rezepte, die am Bildrand nur angeschnitten sind (Titel oder Großteil fehlt), weglassen und in "hinweis" kurz erwähnen.',
    '- Ist eine Stelle nicht sicher lesbar (verdeckt, abgeschnitten, unscharf, unklare Handschrift): in "uncertain" genau beschreiben, welche Stelle es ist. Keinen Wert raten – die Menge leer lassen oder "?" schreiben.',
    '- Fehlt ein Teil des Rezepts (z. B. letzter Schritt abgeschnitten, Zutatenliste unvollständig), "incomplete" auf true setzen.',
    '- Ist das Rezept nicht auf Deutsch, ins Deutsche übersetzen und amerikanische Maße (cups, oz, lb, °F) in metrische umrechnen. Die Originalsprache in "language" angeben.',
    '- ingredients: eine Zeile pro Zutat, Menge zuerst, z. B. "250 g Mehl", "2 EL Olivenöl", "1 Zwiebel, fein gewürfelt", "Salz". Gibt es Abschnitte (Teig, Füllung, Soße …), vor deren Zutaten eine eigene Zeile wie "Für den Teig:" und zwischen zwei Abschnitten eine leere Zeile "".',
    '- steps: ein Eintrag pro Arbeitsschritt, ohne Nummerierung. Verweise auf andere Buchseiten stehen lassen.',
    '- servings: Anzahl Portionen oder Stück, nur wenn angegeben. prepMin und cookMin in Minuten, nur wenn angegeben (Gesamtzeit als prepMin).',
    '- tips: Tipps, Varianten und Serviervorschläge aus dem Original, je ein Eintrag. Erzählende Einleitungen und Nährwerte weglassen.',
    '- description: höchstens ein kurzer Satz, was das Gericht ist (z. B. Stückzahl oder Besonderheit).',
    categories.length ? `- categories: nur aus dieser Liste wählen: ${categories.join(', ')}.` : '',
    tags.length ? `- tags: nur aus dieser Liste und nur, wenn eindeutig passend: ${tags.join(', ')}.` : '',
    '- Ist auf keinem Foto ein Rezept, "rezepte" leer lassen und in "hinweis" sagen, was zu sehen ist.',
  ].filter((l) => l !== '').join('\n');
}

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const list = (v) => (Array.isArray(v) ? v.map(str) : []);
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);

// Zutatenzeilen aufräumen: Abschnittsüberschriften bekommen eine Leerzeile davor, doppelte Leerzeilen fallen weg.
export function ingredientLines(lines) {
  const out = [];
  for (const raw of lines) {
    const l = str(raw);
    if (!l) { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
    if (/:$/.test(l) && out.length && out[out.length - 1] !== '') out.push('');
    out.push(l);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

// Antwort von Gemini (Text oder Objekt) → { recipes, hint }
export function recipesFromGemini(answer) {
  let data = answer;
  if (typeof answer === 'string') {
    const cleaned = answer.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    data = JSON.parse(cleaned);
  }
  const arr = Array.isArray(data) ? data : Array.isArray(data?.rezepte) ? data.rezepte : [];
  const recipes = arr.map((r) => ({
    title: str(r?.title),
    description: str(r?.description),
    servings: num(r?.servings),
    prepMin: num(r?.prepMin),
    cookMin: num(r?.cookMin),
    categories: list(r?.categories).filter(Boolean),
    tags: list(r?.tags).filter(Boolean),
    ingredients: ingredientLines(list(r?.ingredients)),
    steps: list(r?.steps).map((s) => s.replace(/^\d+[.)]\s*/, '')).filter(Boolean),
    tips: list(r?.tips).filter(Boolean),
    uncertain: list(r?.uncertain).filter(Boolean),
    incomplete: r?.incomplete === true,
    language: str(r?.language),
  })).filter((r) => r.title && (r.ingredients.some(Boolean) || r.steps.length));
  return { recipes, hint: str(data?.hinweis) };
}

const translated = (r) => r.language && !/^(de|deutsch|german)/i.test(r.language);

// Für das Rezeptformular (startDraft) – gleiche Form wie beim Text-Import.
export function toDraft(r) {
  const warnings = [];
  if (r.incomplete) warnings.push('Gemini meint, das Rezept ist auf den Fotos nicht vollständig (z. B. abgeschnitten) – bitte ergänzen.');
  if (!r.servings) warnings.push('Keine Portionsangabe gefunden – bitte prüfen.');
  if (!r.steps.length) warnings.push('Keine Zubereitungsschritte erkannt.');
  if (translated(r)) warnings.push(`Aus dem Original (${r.language}) übersetzt – Mengen bitte kurz prüfen.`);
  return {
    title: r.title,
    description: r.description,
    servings: r.servings,
    prepMin: r.prepMin,
    cookMin: r.cookMin,
    categories: r.categories,
    tags: r.tags,
    source: '',
    tips: r.tips.join('\n'),
    uncertain: r.uncertain.join('\n'),
    ingredientsText: r.ingredients.join('\n'),
    steps: r.steps,
    warnings,
    origin: 'foto',
  };
}

// Für den Sammelimport (Austauschformat der App).
export function toExchangeRecipe(r) {
  return {
    title: r.title,
    description: r.description,
    servings: r.servings || undefined,
    prepMin: r.prepMin || undefined,
    cookMin: r.cookMin || undefined,
    categories: r.categories,
    tags: r.tags,
    ingredients: r.ingredients,
    steps: r.steps,
    notes: [
      ...r.tips.map((t) => `Tipp aus dem Original: ${t}`),
      ...(r.uncertain.length ? [`Beim Import unsicher: ${r.uncertain.join('; ')}`] : []),
      ...(r.incomplete ? ['Auf den Fotos nicht vollständig – bitte ergänzen.'] : []),
      ...(translated(r) ? [`Aus dem Original (${r.language}) übersetzt.`] : []),
    ],
  };
}

// Verständliche Meldung statt Fehlercode.
export function explainError(e) {
  const msg = `${e?.code || ''} ${e?.message || e || ''}`;
  if (/api-not-enabled|has not been used|is disabled|SERVICE_DISABLED|firebasevertexai|firebaseml/i.test(msg)) {
    return 'Gemini ist im Firebase-Projekt noch nicht eingeschaltet (Konsole → KI-Dienste → AI Logic → „Jetzt starten“).';
  }
  if (/429|quota|RESOURCE_EXHAUSTED|rate/i.test(msg)) return 'Das kostenlose Gemini-Kontingent ist für heute aufgebraucht – bitte später noch einmal versuchen oder den Weg über den KI-Chat nutzen.';
  if (/network|fetch|offline|Failed to fetch/i.test(msg)) return 'Keine Verbindung – zum Auslesen braucht die App Internet.';
  if (/SAFETY|blocked/i.test(msg)) return 'Gemini hat die Antwort blockiert – bitte ein anderes Foto versuchen.';
  if (/JSON|Unexpected token/i.test(msg)) return 'Gemini hat keine lesbare Antwort geliefert – bitte noch einmal versuchen.';
  return `Auslesen fehlgeschlagen (${str(e?.message || e).slice(0, 140)}).`;
}

// ---------- Aufruf von Gemini (nur im Browser) ----------

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

function schemaFor(Schema, { categories, tags }) {
  const strings = () => Schema.array({ items: Schema.string() });
  const pick = (values) => (values.length ? Schema.array({ items: Schema.enumString({ enum: values }) }) : strings());
  const recipe = Schema.object({
    properties: {
      title: Schema.string(),
      description: Schema.string(),
      servings: Schema.integer(),
      prepMin: Schema.integer(),
      cookMin: Schema.integer(),
      categories: pick(categories),
      tags: pick(tags),
      ingredients: strings(),
      steps: strings(),
      tips: strings(),
      uncertain: strings(),
      incomplete: Schema.boolean(),
      language: Schema.string(),
    },
    optionalProperties: ['description', 'servings', 'prepMin', 'cookMin', 'categories', 'tags', 'tips', 'uncertain', 'language'],
  });
  return Schema.object({
    properties: { rezepte: Schema.array({ items: recipe }), hinweis: Schema.string() },
    optionalProperties: ['hinweis'],
  });
}

// blobs: bereits verkleinerte JPEGs. Liefert { recipes, hint, model }.
export async function readRecipePhotos(app, blobs, { categories = [], tags = [] } = {}, onStatus = () => {}) {
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema } = await import(SDK);
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const parts = [{ text: buildVisionPrompt({ categories, tags }) }];
  for (const b of blobs) parts.push({ inlineData: { mimeType: b.type || 'image/jpeg', data: await toBase64(b) } });
  const responseSchema = schemaFor(Schema, { categories, tags });
  let lastError;
  for (const name of MODELS) {
    try {
      onStatus(`Gemini liest ${blobs.length === 1 ? 'das Foto' : `${blobs.length} Fotos`} …`);
      const model = getGenerativeModel(ai, { model: name, generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.1 } });
      const res = await model.generateContent(parts);
      return { ...recipesFromGemini(res.response.text()), model: name };
    } catch (e) {
      lastError = e;
      // Modellname unbekannt → nächsten probieren; alles andere sofort melden.
      if (!/404|not found|is not supported|NOT_FOUND/i.test(`${e?.code || ''} ${e?.message || ''}`)) throw e;
    }
  }
  throw lastError;
}
