import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVisionPrompt, recipesFromGemini, toDraft, toExchangeRecipe, ingredientLines, explainError } from '../public/js/ai-import.js';
import { normalizeRecipeInput } from '../public/js/exchange.js';
import { parseIngredients } from '../public/js/model.js';

const answer = {
  rezepte: [{
    title: 'Petes Piroggen',
    description: 'Ergibt 24 Piroggen.',
    servings: 24,
    ingredients: ['Für den Teig:', '300 g Mehl', '1 Ei', 'Für die Füllung:', '500 g Rinderhack', '', '', 'Salz'],
    steps: ['1. Teig kneten.', '2) Füllen und backen.'],
    tips: ['Warm servieren.'],
    uncertain: ['Menge Dill (Schritt 2) verdeckt'],
    incomplete: true,
    language: 'Englisch',
    categories: ['Hauptgericht'],
    tags: [],
  }, { title: '', ingredients: ['1 Ei'], steps: [] }, { title: 'Nur Titel', ingredients: [], steps: [] }],
  hinweis: 'Rechts angeschnitten: Couscous mit Gemüse',
};

test('Antwort wird gelesen – auch als Text mit Code-Zaun – und leere Rezepte fallen weg', () => {
  const fromText = recipesFromGemini('```json\n' + JSON.stringify(answer) + '\n```');
  assert.equal(fromText.recipes.length, 1);
  assert.equal(fromText.hint, 'Rechts angeschnitten: Couscous mit Gemüse');
  const r = fromText.recipes[0];
  assert.deepEqual(r.steps, ['Teig kneten.', 'Füllen und backen.']);
  assert.equal(r.servings, 24);
  assert.equal(r.incomplete, true);
});

test('Abschnitte bekommen Leerzeilen, doppelte Leerzeilen verschwinden', () => {
  assert.deepEqual(ingredientLines(['Für den Teig:', '300 g Mehl', 'Für die Füllung:', '1 Ei', '', '', 'Salz', '']),
    ['Für den Teig:', '300 g Mehl', '', 'Für die Füllung:', '1 Ei', '', 'Salz']);
  const draft = toDraft(recipesFromGemini(answer).recipes[0]);
  const parsed = parseIngredients(draft.ingredientsText);
  assert.equal(parsed.find((i) => i.name === 'Mehl').section, 'Für den Teig');
  assert.equal(parsed.find((i) => i.name === 'Rinderhack').section, 'Für die Füllung');
});

test('Entwurf fürs Formular: Unsicheres, Unvollständiges und Übersetzung werden gemeldet', () => {
  const d = toDraft(recipesFromGemini(answer).recipes[0]);
  assert.equal(d.title, 'Petes Piroggen');
  assert.equal(d.uncertain, 'Menge Dill (Schritt 2) verdeckt');
  assert.equal(d.tips, 'Warm servieren.');
  assert.ok(d.warnings.some((w) => /nicht vollständig/.test(w)));
  assert.ok(d.warnings.some((w) => /Englisch/.test(w)));
  assert.deepEqual(d.categories, ['Hauptgericht']);
});

test('Sammelimport: Austauschformat ist gültig und trägt Hinweise als Notizen', () => {
  const ex = toExchangeRecipe(recipesFromGemini(answer).recipes[0]);
  const n = normalizeRecipeInput(ex);
  assert.ok(!n.error, n.error);
  assert.ok(ex.notes.some((t) => /unsicher: Menge Dill/.test(t)));
  assert.ok(ex.notes.some((t) => /nicht vollständig/.test(t)));
});

test('Anweisung nennt Kategorien und Tags der App und verbietet Raten', () => {
  const p = buildVisionPrompt({ categories: ['Suppe', 'Backen'], tags: ['vegan'] });
  assert.match(p, /Suppe, Backen/);
  assert.match(p, /vegan/);
  assert.match(p, /Keinen Wert raten/);
});

test('Fehlermeldungen sind verständlich', () => {
  assert.match(explainError({ code: 'AI/api-not-enabled', message: 'x' }), /AI Logic/);
  assert.match(explainError({ message: '[429 ] RESOURCE_EXHAUSTED' }), /Kontingent/);
  assert.match(explainError(new Error('Failed to fetch')), /Verbindung/);
});
