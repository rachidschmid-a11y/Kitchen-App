// Rezepte aus einer Datei in die App übernehmen (und als Datei herausgeben).
// Das Format selbst steckt in exchange.js; hier geht es um Kategorien, Tags und Doppelte.
import { store, uid } from './store.js';
import { TAG_TONES } from './seed.js';
import { normalizeName } from './model.js';
import { analyzeImport, exchangeFile } from './exchange.js';

export { recipeListFrom } from './exchange.js';

export function previewImport(list) {
  return analyzeImport(list, store.all('recipes').map((r) => r.title));
}

function idByName(col, name, create) {
  const found = store.all(col).find((x) => normalizeName(x.name) === normalizeName(name));
  return (found || store.add(col, create(name))).id;
}

function freeTitle(title) {
  const taken = new Set(store.all('recipes').map((r) => normalizeName(r.title)));
  for (let n = 2; ; n++) if (!taken.has(normalizeName(`${title} (${n})`))) return `${title} (${n})`;
}

// duplicates: 'skip' (überspringen) | 'replace' (vorhandenes aktualisieren) | 'copy' (zusätzlich als Kopie)
export function importRecipes(list, { duplicates = 'skip' } = {}) {
  const { fresh, duplicates: dups, invalid } = previewImport(list);
  return store.transaction(() => {
    const now = Date.now();
    const toDoc = (r) => ({
      title: r.title,
      description: r.description,
      servings: r.servings,
      prepMin: r.prepMin,
      cookMin: r.cookMin,
      ingredients: r.ingredients,
      steps: r.steps,
      source: r.source,
      categoryIds: [...new Set(r.categories.map((name) => idByName('categories', name, (n) => ({ name: n, order: store.all('categories').length }))))],
      tagIds: [...new Set(r.tags.map((name) => idByName('tags', name, (n) => ({ name: n, tone: TAG_TONES[store.all('tags').length % TAG_TONES.length] }))))],
    });
    const notesOf = (r) => r.notes.map((n) => ({ id: uid(), text: n.text, original: !!n.original, createdAt: n.date ? Date.parse(n.date) || now : now }));
    let added = 0;
    let updated = 0;
    const addNew = (r, title = r.title) => {
      store.add('recipes', { ...toDoc(r), title, noteLog: notesOf(r), rating: r.rating, favorite: r.favorite, lastCookedAt: null, photo: null, createdAt: now + added });
      added++;
    };
    fresh.forEach((r) => addNew(r));
    for (const r of dups) {
      if (duplicates === 'copy') addNew(r, freeTitle(r.title));
      if (duplicates === 'replace') {
        const old = store.all('recipes').find((x) => normalizeName(x.title) === normalizeName(r.title));
        const known = new Set((old.noteLog || []).map((n) => n.text));
        store.update('recipes', old.id, {
          ...toDoc(r),
          noteLog: [...(old.noteLog || []), ...notesOf(r).filter((n) => !known.has(n.text))],
          rating: r.rating || old.rating,
          favorite: r.favorite || old.favorite,
        });
        updated++;
      }
    }
    return { added, updated, skipped: duplicates === 'skip' ? dups.length : 0, invalid };
  });
}

export function exportRecipes(recipes = store.all('recipes')) {
  return exchangeFile(recipes, {
    categoryName: (id) => store.get('categories', id)?.name,
    tagName: (id) => store.get('tags', id)?.name,
  });
}
