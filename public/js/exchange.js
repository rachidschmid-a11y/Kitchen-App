// Austauschformat für Rezepte (JSON) – für Export, Import und große Mengen, die zu Hause
// vorbereitet werden. Reine Logik ohne Speicher, getestet in tests/exchange.test.js.
// Beschreibung für Menschen: docs/FORMAT.md
import { parseIngredients, ingredientsToText, parseSteps, normalizeName } from './model.js';
import { parseMinutes } from './recipe-text.js';

export const FORMAT = 'rezepte-app/rezepte';
export const VERSION = 1;

// Erster gefundener Schlüssel gewinnt – deutsch oder englisch, Groß-/Kleinschreibung egal.
function pick(obj, ...keys) {
  const lower = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) if (lower[k.toLowerCase()] != null && lower[k.toLowerCase()] !== '') return lower[k.toLowerCase()];
  return undefined;
}

const asList = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;]/) : []).map((x) => String(x).trim()).filter(Boolean);

function asNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  return parseMinutes(v);
}

function asIngredients(v) {
  if (typeof v === 'string') return parseIngredients(v);
  if (!Array.isArray(v)) return [];
  // Objekte direkt übernehmen, Texte (auch gemischt mit „Abschnitt:“-Zeilen) zerlegen
  if (v.every((x) => x && typeof x === 'object')) {
    return v.filter((x) => x.name || x.zutat).map((x) => {
      const ing = {
        amount: x.amount ?? x.menge ?? null,
        amountMax: x.amountMax ?? x.mengeBis ?? null,
        unit: x.unit ?? x.einheit ?? '',
        name: String(x.name ?? x.zutat).trim(),
        note: x.note ?? x.hinweis ?? '',
      };
      if (typeof ing.amount === 'string') ing.amount = parseIngredients(`${ing.amount} x`)[0]?.amount ?? null;
      const section = x.section ?? x.abschnitt;
      return section ? { ...ing, section } : ing;
    });
  }
  return parseIngredients(v.map((x) => (typeof x === 'string' ? x : x?.name || '')).join('\n'));
}

function asSteps(v) {
  if (typeof v === 'string') return parseSteps(v);
  if (Array.isArray(v)) return parseSteps(v.map((x) => (typeof x === 'string' ? x : x?.text || '')).join('\n'));
  return [];
}

function asNotes(v) {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((n) => (typeof n === 'string' ? { text: n } : { text: n.text ?? n.notiz ?? '', original: !!n.original, date: n.date ?? n.datum ?? null }))
    .filter((n) => n.text && String(n.text).trim());
}

// Ein Rezept aus beliebigem, „ungefähr passendem“ JSON → { recipe } oder { error }
export function normalizeRecipeInput(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'kein Rezept-Objekt' };
  const title = String(pick(raw, 'title', 'titel', 'name') ?? '').trim();
  const ingredients = asIngredients(pick(raw, 'ingredients', 'zutaten'));
  const steps = asSteps(pick(raw, 'steps', 'zubereitung', 'schritte', 'anleitung', 'instructions'));
  if (!title) return { error: 'Titel fehlt' };
  if (!ingredients.length && !steps.length) return { error: 'weder Zutaten noch Zubereitung', title };
  const tips = pick(raw, 'tips', 'tipps');
  const servings = asNumber(pick(raw, 'servings', 'portionen', 'personen'));
  return {
    recipe: {
      title,
      description: String(pick(raw, 'description', 'beschreibung') ?? '').trim(),
      servings: servings && servings > 0 ? servings : 4,
      prepMin: asNumber(pick(raw, 'prepMin', 'vorbereitung', 'vorbereitungMin', 'vorbereitungszeit')),
      cookMin: asNumber(pick(raw, 'cookMin', 'kochzeit', 'kochzeitMin', 'backzeit', 'garzeit')),
      categories: asList(pick(raw, 'categories', 'kategorien', 'kategorie')),
      tags: asList(pick(raw, 'tags', 'eigenschaften')),
      source: String(pick(raw, 'source', 'quelle') ?? '').trim(),
      ingredients,
      steps,
      notes: [
        ...asNotes(pick(raw, 'notes', 'notizen', 'noteLog')),
        ...(tips ? asNotes(tips).map((n) => ({ ...n, text: `Tipp aus dem Original: ${n.text}`, original: true })) : []),
      ],
      rating: Math.max(0, Math.min(5, Number(pick(raw, 'rating', 'bewertung')) || 0)),
      favorite: !!pick(raw, 'favorite', 'favorit'),
    },
  };
}

export function recipeListFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rezepte)) return data.rezepte;
  if (Array.isArray(data?.recipes) && !data?.settings) return data.recipes; // Rezeptliste, keine Komplettsicherung
  if (data && typeof data === 'object' && (data.title || data.titel)) return [data]; // ein einzelnes Rezept
  return null;
}

// Prüft eine ganze Datei: was ist neu, was gibt es schon, was ist unbrauchbar?
export function analyzeImport(list, existingTitles = []) {
  const existing = new Set(existingTitles.map(normalizeName));
  const seen = new Set();
  const result = { fresh: [], duplicates: [], invalid: [] };
  list.forEach((raw, i) => {
    const { recipe, error, title } = normalizeRecipeInput(raw);
    if (error) { result.invalid.push({ index: i + 1, title: title || raw?.title || raw?.titel || `Eintrag ${i + 1}`, error }); return; }
    const key = normalizeName(recipe.title);
    if (seen.has(key)) { result.invalid.push({ index: i + 1, title: recipe.title, error: 'kommt in der Datei doppelt vor' }); return; }
    seen.add(key);
    (existing.has(key) ? result.duplicates : result.fresh).push(recipe);
  });
  return result;
}

// Rezept aus der App → Austauschformat (Zutaten als lesbare Textzeilen)
export function toExchange(r, { categoryName = () => null, tagName = () => null } = {}) {
  return {
    title: r.title,
    description: r.description || '',
    servings: r.servings,
    prepMin: r.prepMin || null,
    cookMin: r.cookMin || null,
    categories: (r.categoryIds || []).map(categoryName).filter(Boolean),
    tags: (r.tagIds || []).map(tagName).filter(Boolean),
    source: r.source || '',
    // Leerer Eintrag = Ende eines Abschnitts (wie eine Leerzeile im Zutatenfeld)
    ingredients: ingredientsToText(r.ingredients).split('\n'),
    steps: r.steps || [],
    notes: (r.noteLog || []).map((n) => ({ text: n.text, ...(n.original ? { original: true } : {}), date: n.createdAt ? new Date(n.createdAt).toISOString().slice(0, 10) : null })),
    rating: r.rating || 0,
    favorite: !!r.favorite,
  };
}

export function exchangeFile(recipes, opts) {
  return { format: FORMAT, version: VERSION, exportiert: new Date().toISOString().slice(0, 10), anzahl: recipes.length, rezepte: recipes.map((r) => toExchange(r, opts)) };
}

// Vorlage zum Herunterladen – zeigt beide erlaubten Schreibweisen.
export const TEMPLATE = {
  format: FORMAT,
  version: VERSION,
  hinweis: 'Pflicht: title (oder titel) und Zutaten oder Zubereitung. Alles andere ist optional. Zutaten als Textzeilen, eine pro Eintrag, Abschnitte mit Doppelpunkt am Ende.',
  rezepte: [
    {
      title: 'Pfannkuchen',
      description: 'Dünn und goldbraun – süß oder herzhaft.',
      servings: 4,
      prepMin: 5,
      cookMin: 20,
      categories: ['Frühstück', 'Dessert'],
      tags: ['vegetarisch', 'kinderfreundlich'],
      source: 'Omas Rezeptbuch',
      ingredients: ['Für den Teig:', '250 g Mehl', '500 ml Milch', '3 Eier', '1 Prise Salz', 'Zum Ausbacken:', '2 EL Butter'],
      steps: ['Mehl, Milch, Eier und Salz glatt rühren und 10 Minuten quellen lassen.', 'Butter erhitzen und den Teig portionsweise goldbraun ausbacken.'],
      notes: ['Mit Apfelmus am besten.'],
    },
    {
      titel: 'Tomatensoße (deutsche Feldnamen)',
      portionen: '2 Portionen',
      kochzeit: '20 Min.',
      kategorie: 'Hauptgericht',
      zutaten: '1 Dose gehackte Tomaten\n2 Zehen Knoblauch\n2 EL Olivenöl\nSalz',
      zubereitung: '1. Knoblauch im Öl andünsten.\n2. Tomaten dazugeben und 15 Minuten köcheln lassen.',
      tipps: 'Mit Basilikum servieren.',
    },
  ],
};
