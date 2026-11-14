import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFirestore, fromFirestore, EMPTY_KEY } from '../public/js/firestore-safe.js';
import { buildShoppingList } from '../public/js/model.js';

// Firestore lehnt leere Feldnamen ab – so gingen Artikel ohne Einheit („5 Paprika“) beim Speichern verloren.
const emptyKeys = (v) => (Array.isArray(v) ? v.some(emptyKeys)
  : v && typeof v === 'object' ? Object.entries(v).some(([k, x]) => k === '' || emptyKeys(x)) : false);

test('Artikel ohne Einheit werden speicherbar und kommen unverändert zurück', () => {
  const recipes = [{ id: 'r1', servings: 4, ingredients: [{ amount: 2, unit: '', name: 'rote Paprika' }, { amount: 500, unit: 'g', name: 'Reis' }] }];
  const list = buildShoppingList({ entries: [{ recipeId: 'r1', servings: 4 }], recipes, catalog: [] });
  assert.ok(emptyKeys(list), 'Ausgangslage: Stückzahlen stehen unter ""');
  const stored = toFirestore(list);
  assert.equal(emptyKeys(stored), false);
  assert.ok(JSON.stringify(stored).includes(EMPTY_KEY));
  assert.deepEqual(fromFirestore(stored), list);
});

test('Andere Werte bleiben unangetastet', () => {
  const doc = { a: 1, b: [1, { c: '' }], d: null, e: { f: { '': 3 } } };
  assert.deepEqual(toFirestore(doc), { a: 1, b: [1, { c: '' }], d: null, e: { f: { [EMPTY_KEY]: 3 } } });
  assert.deepEqual(fromFirestore(toFirestore(doc)), doc);
});
