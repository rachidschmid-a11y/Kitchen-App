// Fehler, die bei der Durchsicht im November 2026 gefunden wurden – jeder Test hält einen davon fest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredients, parseIngredientLine, ingredientsToText, ingredientMatches, quantitiesFromText } from '../public/js/model.js';
import { store } from '../public/js/store.js';

const rows = (text) => parseIngredients(text).map((i) => [i.amount, i.unit, i.name, i.note || '']);

test('„1.200 g“ sind 1200 g, „1.500 kg“ bleiben anderthalb Kilo', () => {
  assert.deepEqual(rows('1.200 g Frischkäse'), [[1200, 'g', 'Frischkäse', '']]);
  assert.deepEqual(rows('1.500 kg Kartoffeln'), [[1.5, 'kg', 'Kartoffeln', '']]);
  assert.deepEqual(rows('1,5 kg Kartoffeln'), [[1.5, 'kg', 'Kartoffeln', '']]);
  assert.deepEqual(rows('2.5 l Wasser'), [[2.5, 'l', 'Wasser', '']]);
});

test('„Salz, Pfeffer“ sind zwei Zutaten – echte Hinweise bleiben Hinweise', () => {
  assert.deepEqual(rows('Salz, Pfeffer').map((r) => r[2]), ['Salz', 'Pfeffer']);
  assert.deepEqual(rows('Salz und frisch gemahlener schwarzer Pfeffer').map((r) => r[2]), ['Salz', 'frisch gemahlener schwarzer Pfeffer']);
  assert.deepEqual(rows('Salz, Pfeffer, Zucker').length, 3);
  assert.deepEqual(rows('Pfeffer, frisch gemahlen'), [[null, '', 'Pfeffer', 'frisch gemahlen']]);
  assert.deepEqual(rows('1 Zwiebel, fein gewürfelt'), [[1, '', 'Zwiebel', 'fein gewürfelt']]);
  assert.deepEqual(rows('Zucker und Zimt zum Bestreuen').length, 1);
  assert.deepEqual(rows('Für die Soße:\nSalz, Pfeffer').map((r) => r[2]), ['Salz', 'Pfeffer']);
});

test('„ca.“, „Bd.“, Stiele und Tüten werden verstanden', () => {
  assert.deepEqual(rows('ca. 8 TL Sonnenblumenöl'), [[8, 'TL', 'Sonnenblumenöl', '']]);
  assert.deepEqual(rows('1 Bd. glatte Petersilie'), [[1, 'Bund', 'glatte Petersilie', '']]);
  assert.deepEqual(rows('4 Stiele Petersilie'), [[4, 'Stiel', 'Petersilie', '']]);
  assert.deepEqual(rows('1 Tüte Trockenhefe'), [[1, 'Tüte', 'Trockenhefe', '']]);
  assert.equal(parseIngredientLine('Tropfen')?.name, 'Tropfen');
  assert.deepEqual(quantitiesFromText('ca. 2 l'), { ml: 2000 });
});

test('Bearbeiten und Speichern verändert keine Mengen', () => {
  const ingredients = [
    { amount: 113, amountMax: null, unit: 'g', name: 'Butter', note: '' },
    { amount: 1200, amountMax: null, unit: 'g', name: 'Frischkäse', note: '' },
    { amount: 0.33, amountMax: null, unit: 'l', name: 'Milch', note: '' },
    { amount: 1 / 3, amountMax: null, unit: 'TL', name: 'Zimt', note: '' },
    { amount: 2, amountMax: 3, unit: 'Zehe', name: 'Knoblauch', note: 'gehackt' },
    { amount: 4, amountMax: null, unit: 'Stiel', name: 'Minze', note: '', section: 'Deko' },
    { amount: 1.375, amountMax: null, unit: 'kg', name: 'Mehl', note: '', section: 'Deko' },
  ];
  const back = parseIngredients(ingredientsToText(ingredients));
  assert.deepEqual(back.map((i) => [i.amount, i.amountMax, i.unit, i.name, i.note, i.section]),
    ingredients.map((i) => [i.amount, i.amountMax, i.unit, i.name, i.note, i.section]));
});

test('Zutatensuche: „Reis“ findet nicht „Freilandeier“', () => {
  const r = { ingredients: [{ name: 'Freilandeier' }, { name: 'Reibekäse' }] };
  assert.equal(ingredientMatches(r, 'Reis'), null);
  assert.deepEqual(ingredientMatches({ ingredients: [{ name: 'Basmatireis' }] }, 'reis'), ['Basmatireis']);
  assert.deepEqual(ingredientMatches({ ingredients: [{ name: 'Tomate' }] }, 'Tomaten'), ['Tomate']);
});

test('Echo der eigenen Änderung zeichnet nicht neu; Änderungen anderer melden sich als „remote“', async () => {
  const calls = [];
  const off = store.subscribe((info) => calls.push(info));
  store.receive('pantry', [{ id: 'a', name: 'Milch', useSoon: false, createdAt: 1 }]);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(calls, [{ remote: true }]);
  // gleicher Inhalt, andere Feldreihenfolge (so liefert Firestore) → kein Neuzeichnen
  store.receive('pantry', [{ createdAt: 1, useSoon: false, name: 'Milch', id: 'a' }]);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(calls.length, 1);
  store.update('pantry', 'a', { useSoon: true });
  assert.deepEqual(calls[1], {});
  off();
});
