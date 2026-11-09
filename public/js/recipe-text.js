// Rezepttext → Rezeptentwurf. Versteht frei kopierten Text (Webseite, Instagram, WhatsApp)
// und das feste Antwortformat der KI-Brücke. Reine Logik, getestet in tests/recipe-text.test.js.
import { parseIngredientLine } from './model.js';

const FIELDS = [
  ['title', /^(titel|title|rezept|rezeptname|name)$/],
  ['description', /^(beschreibung|kurzbeschreibung|description)$/],
  ['servings', /^(portionen|personen|servings|ergibt|menge)$/],
  ['prepMin', /^(vorbereitung|vorbereitung_?min|vorbereitungszeit|arbeitszeit|prep|prep time)$/],
  ['cookMin', /^(kochzeit|kochzeit_?min|backzeit|garzeit|koch-?\/?backzeit|cook time)$/],
  ['categories', /^(kategorie|kategorien|category|categories)$/],
  ['tags', /^(tags|eigenschaften)$/],
  ['source', /^(quelle|source)$/],
  ['ingredients', /^(zutaten|ingredients|das brauchst du)\b/],
  ['steps', /^(zubereitung|anleitung|anleitungen|schritte|so geht'?s|instructions|method|directions|preparation)\b/],
  ['tips', /^(tipps?|hinweise?|notizen|variationen?|notes|tips)$/],
  ['uncertain', /^(unsicher|unklar|nicht lesbar)$/],
];
const BLOCKS = new Set(['ingredients', 'steps', 'tips', 'uncertain']);
const EMPTY = /^(-|–|leer|keine?|nichts|n\/a|none)?\.?$/i;

const clean = (line) => line
  .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
  .replace(/^\s*[-–•*·▢☐□✓✔]+\s*/u, '')
  .replace(/\*\*|__|`/g, '')
  .replace(/^#{1,6}\s+/, '')
  .replace(/^[\s—–\-_.·•*~=]+$/, '') // Trennlinien
  .trim();

function fieldOf(key) {
  const k = key.toLowerCase().replace(/[^a-zäöüß_'\/ -]/g, '').trim();
  for (const [name, re] of FIELDS) if (re.test(k)) return name;
  return null;
}

// „Zutaten für 4 Portionen:“, „ZUBEREITUNG“, „TITEL: Pfannkuchen“ → { field, value }
function detectField(line) {
  const colon = line.match(/^([^:]{2,40}):\s*(.*)$/);
  if (colon) {
    const f = fieldOf(colon[1]);
    if (f) return { field: f, value: colon[2].trim(), head: colon[1] };
  }
  if (line.length <= 40) {
    const f = fieldOf(line);
    if (f && BLOCKS.has(f)) return { field: f, value: '', head: line };
  }
  return null;
}

export function parseMinutes(s) {
  if (!s) return null;
  const t = String(s).toLowerCase().replace(',', '.');
  const h = t.match(/(\d+(?:\.\d+)?)\s*(?:h\b|std|stunde)/);
  const m = t.match(/(\d+)\s*(?:min)/);
  if (h || m) return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
  const n = t.match(/\d+/);
  return n ? Number(n[0]) : null;
}

const servingsIn = (s) => {
  const m = String(s).match(/(?:für|ergibt|portionen|personen|servings)\D{0,12}(\d+)|(\d+)\s*(?:portionen|personen|stück|servings)/i);
  return m ? Number(m[1] || m[2]) : null;
};

const listOf = (s) => String(s).split(/[,;]/).map((x) => x.trim()).filter((x) => x && !EMPTY.test(x));

// Zutaten, die in einer Zeile stehen: „250 g Mehl, 100 g Zucker • 2 Eier“ – und „Salz, Pfeffer“ / „Salz und Pfeffer“.
const SEASONING = /^(salz|pfeffer|zucker|muskat(nuss)?|chili(flocken|pulver)?|paprika(pulver)?|zimt|kreuzkümmel|öl|olivenöl)\b/i;

function splitInline(line) {
  const raw = line.split(/\s*[•·|]\s*|,\s*(?=(?:\d|½|¼|¾|⅓|eine?\s))/).map((x) => x.trim()).filter(Boolean);
  // „1 Dose Kokosmilch, 400 ml“: ein Teil ohne eigene Zutat bleibt Hinweis der vorigen Zeile.
  const parts = raw.reduce((acc, p) => {
    if (acc.length && !parseIngredientLine(p)) acc[acc.length - 1] += `, ${p}`;
    else acc.push(p);
    return acc;
  }, []);
  return parts.flatMap((p) => {
    const words = p.split(/\s*,\s*|\s+und\s+/);
    return words.length > 1 && words.every((w) => SEASONING.test(w) && w.split(/\s+/).length <= 2) ? words : [p];
  });
}

function looksLikeIngredient(line) {
  if (line.length > 70 || /[.!?]$/.test(line)) return false;
  const p = parseIngredientLine(line);
  return !!p && (p.amount != null || line.split(/\s+/).length <= 3);
}

function buildSteps(lines) {
  const steps = [];
  const numbered = lines.some((l) => /^(?:schritt\s*)?\d+\s*[.):]?\s+\S/i.test(l) || /^schritt\s*\d+$/i.test(l));
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^schritt\s*\d+\s*:?$/i.test(line)) { steps.push(''); continue; }
    const num = line.match(/^(?:schritt\s*)?\d+\s*[.):]?\s+(.*)$/i);
    if (num) steps.push(num[1]);
    else if (numbered && steps.length) steps[steps.length - 1] = `${steps[steps.length - 1]} ${line}`.trim();
    else steps.push(line);
  }
  return steps.map((s) => s.trim()).filter(Boolean);
}

export function parseRecipeText(raw) {
  const text = String(raw || '').replace(/\r/g, '').replace(/```[a-z]*\n?/gi, '');
  const lines = text.split('\n').map(clean)
    .filter((l) => !/^(#\w+\s*)+$/.test(l)) // reine Hashtag-Zeilen (Instagram)
    .map((l) => l.replace(/(\s#[\wäöüß]+)+\s*$/i, ''));

  const out = { title: '', description: '', servings: null, prepMin: null, cookMin: null, categories: [], tags: [], source: '', tips: '', uncertain: '' };
  const blocks = { ingredients: [], steps: [], tips: [], uncertain: [] };
  const loose = [];
  let current = null;
  let structured = false;

  for (const line of lines) {
    const f = detectField(line);
    if (f) {
      if (BLOCKS.has(f.field)) {
        current = f.field;
        structured = true;
        if (f.field === 'ingredients') out.servings ??= servingsIn(f.head);
        if (f.value) blocks[current].push(...(current === 'ingredients' ? splitInline(f.value) : [f.value]));
      } else {
        current = null;
        const v = EMPTY.test(f.value) ? '' : f.value;
        if (f.field === 'title') structured = true;
        if (f.field === 'servings') out.servings = servingsIn(`für ${v}`) ?? out.servings;
        else if (f.field === 'prepMin' || f.field === 'cookMin') out[f.field] = parseMinutes(v);
        else if (f.field === 'categories' || f.field === 'tags') out[f.field] = listOf(v);
        else out[f.field] = v;
      }
      continue;
    }
    if (current) {
      if (current === 'ingredients' && line && !line.endsWith(':')) blocks.ingredients.push(...splitInline(line));
      else blocks[current].push(line);
    } else loose.push(line);
  }

  const looseFilled = loose.filter(Boolean);
  // Freier Text ohne Überschriften: Titel = erste kurze Zeile, Rest nach Form einsortieren.
  if (!out.title && looseFilled.length && looseFilled[0].length <= 80 && !/^[\d½¼¾⅓⅔]/.test(looseFilled[0])) out.title = looseFilled.shift();
  if (!blocks.ingredients.length && !blocks.steps.length) {
    for (const l of looseFilled) {
      if (looksLikeIngredient(l)) blocks.ingredients.push(l);
      else if (l.length > 25) blocks.steps.push(l);
    }
  } else if (!out.description) {
    out.description = looseFilled.find((l) => l.length > 30 && !looksLikeIngredient(l)) || '';
  }

  const whole = lines.join('\n');
  out.servings ??= servingsIn(whole);
  if (out.prepMin == null) { const m = whole.match(/(?:vorbereitung|arbeitszeit)[^\n\d]{0,25}([\d.,]+\s*(?:std\.?|h|stunden?)?\s*\d*\s*min\.?)/i); if (m) out.prepMin = parseMinutes(m[1]); }
  if (out.cookMin == null) { const m = whole.match(/(?:koch|back|gar)zeit[^\n\d]{0,25}([\d.,]+\s*(?:std\.?|h|stunden?)?\s*\d*\s*min\.?)/i); if (m) out.cookMin = parseMinutes(m[1]); }

  out.ingredientsText = blocks.ingredients
    .map((l) => l.trim())
    .reduce((acc, l) => {
      if (!l) { if (acc.length && acc[acc.length - 1] !== '') acc.push(''); return acc; }
      acc.push(l);
      return acc;
    }, [])
    .join('\n').trim();
  out.steps = buildSteps(blocks.steps);
  out.tips = [out.tips, ...blocks.tips].filter((x) => x && !EMPTY.test(x)).join('\n').trim();
  out.uncertain = blocks.uncertain.filter((x) => x && !EMPTY.test(x)).join('\n').trim();

  out.warnings = [];
  if (!out.title) out.warnings.push('Kein Titel erkannt – bitte eintragen.');
  if (!out.ingredientsText) out.warnings.push('Keine Zutaten erkannt.');
  if (!out.steps.length) out.warnings.push('Keine Zubereitungsschritte erkannt.');
  if (!out.servings) out.warnings.push('Keine Portionsangabe gefunden – bitte prüfen.');
  out.structured = structured;
  return out;
}

// Anweisung für Gemini, ChatGPT & Co. – die Antwort kann direkt wieder eingefügt werden.
export function buildAiPrompt({ categories = [], tags = [] } = {}) {
  return `Lies das Rezept aus dem angehängten Foto, Screenshot, Video-Standbild, Link oder Text.
Antworte NUR mit dem Rezept in genau diesem Format (auf Deutsch, ohne Einleitung, ohne Erklärungen):

TITEL: …
BESCHREIBUNG: (ein kurzer Satz)
PORTIONEN: (nur die Zahl)
VORBEREITUNG_MIN: (Zahl oder leer)
KOCHZEIT_MIN: (Zahl oder leer)
KATEGORIE: (passende aus: ${categories.join(', ')})
TAGS: (passende aus: ${tags.join(', ')})
QUELLE: (Buch mit Seite, Webseite oder Account)
ZUTATEN:
- 200 g Mehl
- 2 EL Olivenöl, extra vergine
(Abschnitte als eigene Zeile mit Doppelpunkt, z. B. „Für den Teig:“)
ZUBEREITUNG:
1. …
2. …
TIPPS: (Varianten oder Hinweise aus dem Original, sonst leer)
UNSICHER: (alles, was du nicht sicher lesen konntest oder was fehlt, sonst leer)

Regeln:
- Mengen und Einheiten genau übernehmen (g, kg, ml, l, EL, TL, Prise, Stück, Bund, Dose, Packung). Eine Zutat pro Zeile, Menge zuerst.
- Nichts erfinden. Fehlende oder unleserliche Angaben unter UNSICHER nennen.
- Englische Rezepte übersetzen, amerikanische Maße (cups, oz, °F) in g, ml und °C umrechnen.
- Werbung, Geschichten und Nährwerte weglassen.`;
}
