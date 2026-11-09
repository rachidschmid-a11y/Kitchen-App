import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { normalizeRecipeInput, analyzeImport, toExchange, recipeListFrom, TEMPLATE } from '../public/js/exchange.js';

test('Vorlage: beide Schreibweisen werden verstanden', () => {
  const [a, b] = TEMPLATE.rezepte.map((r) => normalizeRecipeInput(r).recipe);
  assert.equal(a.title, 'Pfannkuchen');
  assert.equal(a.ingredients.length, 5);
  assert.equal(a.ingredients[0].section, 'Für den Teig');
  assert.equal(a.ingredients[4].section, 'Zum Ausbacken');
  assert.deepEqual(a.notes, [{ text: 'Mit Apfelmus am besten.' }]);
  assert.equal(b.title, 'Tomatensoße (deutsche Feldnamen)');
  assert.equal(b.servings, 2);
  assert.equal(b.cookMin, 20);
  assert.deepEqual(b.categories, ['Hauptgericht']);
  assert.equal(b.ingredients.length, 4);
  assert.equal(b.steps.length, 2);
  assert.equal(b.notes[0].text, 'Tipp aus dem Original: Mit Basilikum servieren.');
});

test('Unbrauchbares, Doppeltes und Vorhandenes wird erkannt', () => {
  const res = analyzeImport([
    { title: 'Neu', ingredients: ['1 Ei'] },
    { title: 'Vorhanden', steps: ['Kochen.'] },
    { title: '' , ingredients: ['1 Ei'] },
    { title: 'Leer' },
    { title: 'neu', ingredients: ['2 Eier'] },
  ], ['Vorhanden']);
  assert.deepEqual(res.fresh.map((r) => r.title), ['Neu']);
  assert.deepEqual(res.duplicates.map((r) => r.title), ['Vorhanden']);
  assert.deepEqual(res.invalid.map((x) => x.error), ['Titel fehlt', 'weder Zutaten noch Zubereitung', 'kommt in der Datei doppelt vor']);
});

test('Export und Re-Import ergeben dasselbe Rezept', () => {
  const recipe = {
    title: 'Test', description: 'd', servings: 3, prepMin: 5, cookMin: 10, source: 'q',
    categoryIds: ['c1'], tagIds: ['t1'], rating: 4, favorite: true,
    ingredients: [{ amount: 250, amountMax: null, unit: 'g', name: 'Mehl', note: 'gesiebt', section: 'Teig' }, { amount: 0.5, amountMax: null, unit: 'TL', name: 'Salz', note: '' }],
    steps: ['Mischen.'], noteLog: [{ text: 'Lecker', createdAt: Date.UTC(2026, 10, 8) }],
  };
  const ex = toExchange(recipe, { categoryName: () => 'Backen', tagName: () => 'vegan' });
  assert.deepEqual(ex.ingredients, ['Teig:', '250 g Mehl, gesiebt', '', '½ TL Salz']);
  const back = normalizeRecipeInput(JSON.parse(JSON.stringify(ex))).recipe;
  assert.deepEqual(back.ingredients, recipe.ingredients);
  assert.deepEqual(back.categories, ['Backen']);
  assert.equal(back.rating, 4);
  assert.equal(back.favorite, true);
  assert.equal(back.notes[0].text, 'Lecker');
});

test('Dateiformen: Austauschformat, nackte Liste, Einzelrezept – nicht aber eine Komplettsicherung', () => {
  assert.equal(recipeListFrom({ rezepte: [1, 2] }).length, 2);
  assert.equal(recipeListFrom([{ title: 'x' }]).length, 1);
  assert.equal(recipeListFrom({ titel: 'Einzeln' }).length, 1);
  assert.equal(recipeListFrom({ recipes: [], settings: {} }), null);
});

// Die eigene Rezeptsammlung liegt nur lokal (Import/ ist nicht im Repo) – ohne sie wird der Test übersprungen.
const sammlung = new URL('../Import/rezepte-import.json', import.meta.url);
test('Die übernommene Sammlung liegt im gültigen Format vor', { skip: !existsSync(sammlung) && 'Import/ nicht vorhanden' }, () => {
  const data = JSON.parse(readFileSync(sammlung, 'utf8'));
  const res = analyzeImport(recipeListFrom(data), []);
  assert.equal(res.invalid.length, 0);
  assert.ok(res.fresh.length > 0);
});
