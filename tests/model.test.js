import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIngredientLine, parseIngredients, ingredientsToText, formatAmount, formatQuantity,
  resolveIngredient, buildShoppingList, mergeGeneratedItems, combineShoppingItems, startOfWeek, toISODate, isoWeek,
  formatWeekRange, pantryStatus, startOfPeriod, periodDates, formatPeriod, filterRecipes, ingredientMatches, nextFreeDay, minutesInStep, parseSteps,
} from '../public/js/model.js';
import { encodeRecipe, decodeRecipe } from '../public/js/share.js';

test('Zutatenzeilen werden in Menge, Einheit, Name und Hinweis zerlegt', () => {
  assert.deepEqual(parseIngredientLine('200 g Mehl, gesiebt'), { amount: 200, amountMax: null, unit: 'g', name: 'Mehl', note: 'gesiebt' });
  assert.deepEqual(parseIngredientLine('2 EL Olivenöl'), { amount: 2, amountMax: null, unit: 'EL', name: 'Olivenöl', note: '' });
  assert.deepEqual(parseIngredientLine('3 Eier'), { amount: 3, amountMax: null, unit: '', name: 'Eier', note: '' });
  assert.deepEqual(parseIngredientLine('Salz'), { amount: null, amountMax: null, unit: '', name: 'Salz', note: '' });
  assert.deepEqual(parseIngredientLine('1 Prise Salz'), { amount: 1, amountMax: null, unit: 'Prise', name: 'Salz', note: '' });
  assert.equal(parseIngredientLine('½ Bund Petersilie').amount, 0.5);
  assert.equal(parseIngredientLine('1 1/2 TL Zucker').amount, 1.5);
  assert.equal(parseIngredientLine('1½ TL Zucker').amount, 1.5);
  assert.equal(parseIngredientLine('1,5 l Brühe').amount, 1.5);
  assert.equal(parseIngredientLine('200g Butter').unit, 'g');
  const range = parseIngredientLine('2-3 Zehen Knoblauch');
  assert.equal(range.amount, 2);
  assert.equal(range.amountMax, 3);
  assert.equal(range.unit, 'Zehe');
  assert.deepEqual(parseIngredientLine('1 kleine Zwiebel'), { amount: 1, amountMax: null, unit: '', name: 'Zwiebel', note: 'klein' });
  assert.deepEqual(parseIngredientLine('1 kleine Dose Mais'), { amount: 1, amountMax: null, unit: 'Dose', name: 'Mais', note: 'klein' });
  assert.equal(parseIngredientLine('1 große Tomate, reif').note, 'groß, reif');
  const dose = parseIngredientLine('1 Dose gehackte Tomaten (400 g)');
  assert.equal(dose.name, 'gehackte Tomaten');
  assert.equal(dose.note, '400 g');
});

test('Abschnitte und Rückumwandlung in Text', () => {
  const ings = parseIngredients('Für den Teig:\n250 g Mehl\n3 Eier\n\nZum Ausbacken:\n2 EL Butter');
  assert.equal(ings.length, 3);
  assert.equal(ings[0].section, 'Für den Teig');
  assert.equal(ings[2].section, 'Zum Ausbacken');
  assert.equal(ingredientsToText(ings), 'Für den Teig:\n250 g Mehl\n3 Eier\n\nZum Ausbacken:\n2 EL Butter');
  const mixed = parseIngredients('Dressing:\n3 EL Joghurt\n\n2 Gurken');
  assert.equal(mixed[1].section, undefined);
  assert.equal(ingredientsToText(mixed), 'Dressing:\n3 EL Joghurt\n\n2 Gurken');
});

test('Mengen werden lesbar formatiert', () => {
  assert.equal(formatAmount(0.5), '½');
  assert.equal(formatAmount(1.5), '1½');
  assert.equal(formatAmount(2), '2');
  assert.equal(formatAmount(333.33, 'g'), '335');
  assert.equal(formatAmount(1.25, 'kg'), '1,25');
  assert.equal(formatQuantity(2, 'Zehe'), '2 Zehen');
  assert.equal(formatQuantity(1, 'Zehe'), '1 Zehe');
  assert.equal(formatQuantity(200, 'g', null, 0.5), '100 g');
});

test('Katalog erkennt Plural und Synonyme', () => {
  const catalog = [{ id: 'zwiebel', name: 'Zwiebel', aisle: 'Obst & Gemüse' }, { id: 'eier', name: 'Eier', synonyms: ['Ei'] }];
  assert.equal(resolveIngredient('Zwiebeln', catalog).key, 'zwiebel');
  assert.equal(resolveIngredient('Ei', catalog).key, 'eier');
  assert.equal(resolveIngredient('Karotten', []).key, resolveIngredient('Karotte', []).key);
});

test('Einkaufsliste fasst Zutaten zusammen und rechnet Portionen um', () => {
  const catalog = [{ id: 'mehl', name: 'Mehl', aisle: 'Trockenwaren' }, { id: 'salz', name: 'Salz', basic: true }];
  const recipes = [
    { id: 'a', servings: 4, ingredients: [{ amount: 200, unit: 'g', name: 'Mehl' }, { amount: null, unit: '', name: 'Salz' }] },
    { id: 'b', servings: 2, ingredients: [{ amount: 1, unit: 'kg', name: 'Mehl' }] },
  ];
  const entries = [
    { recipeId: 'a', servings: 8 },
    { recipeId: 'b', servings: 2 },
    { recipeId: 'b', servings: 2, cooked: true },
  ];
  const list = buildShoppingList({ entries, recipes, catalog });
  const mehl = list.find((i) => i.key === 'mehl');
  assert.equal(mehl.amountText, '1,4 kg');
  assert.deepEqual(mehl.fromRecipeIds, ['a', 'b']);
  assert.equal(mehl.aisle, 'Trockenwaren');
  const salz = list.find((i) => i.key === 'salz');
  assert.equal(salz.amountText, '');
  assert.equal(salz.basic, true);
});

test('Stückzahlen werden aufgerundet, gleiche Zutaten zu einer Zeile zusammengefasst', () => {
  const recipes = [{ id: 'p', servings: 4, ingredients: [{ amount: 3, unit: '', name: 'Eier' }, { amount: 2, unit: 'Zehe', name: 'Knoblauch' }] }];
  const [eier, knoblauch] = buildShoppingList({ entries: [{ recipeId: 'p', servings: 6 }], recipes });
  assert.equal(eier.amountText, '5');
  assert.equal(knoblauch.amountText, '3 Zehen');
  const rows = combineShoppingItems([
    { id: '1', key: 'k', source: 'plan', quantities: { Zehe: 2 }, amountText: '2 Zehen', fromRecipeIds: ['a'] },
    { id: '2', key: 'k', source: 'recipe', quantities: { Zehe: 2.5 }, amountText: '2½ Zehen', fromRecipeIds: ['b'] },
    { id: '3', key: 'brot', source: 'staple', amountText: '1' },
    { id: '4', key: 'brot', source: 'plan', quantities: {}, amountText: '', fromRecipeIds: ['c'] },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].ids, ['1', '2']);
  assert.equal(rows[0].amountText, '4½ Zehen');
  assert.deepEqual(rows[0].fromRecipeIds, ['a', 'b']);
  assert.equal(rows[1].amountText, '1');
  const milk = combineShoppingItems([
    { id: 'a', key: 'milch', source: 'manual', amountText: '3 l' },
    { id: 'b', key: 'milch', source: 'plan', quantities: { ml: 250 }, amountText: '250 ml' },
    { id: 'c', key: 'milch', source: 'staple', amountText: '2 l' },
  ]);
  assert.equal(milk[0].amountText, '5,25 l');
  const vague = combineShoppingItems([
    { id: 'a', key: 'k', source: 'manual', amountText: 'eine große' },
    { id: 'b', key: 'k', source: 'staple', amountText: '2' },
  ]);
  assert.equal(vague[0].amountText, 'eine große + 2');
});

test('Neu erzeugte Liste behält Hand-Artikel und Häkchen', () => {
  const existing = [
    { id: '1', key: 'brot', source: 'manual', checked: false },
    { id: '2', key: 'mehl', source: 'plan', checked: true },
    { id: '3', key: 'zucker', source: 'plan', checked: false },
  ];
  let n = 0;
  const merged = mergeGeneratedItems(existing, [{ key: 'mehl', amountText: '500 g' }, { key: 'milch', amountText: '1 l' }], () => 'neu' + n++);
  assert.deepEqual(merged.map((i) => i.id), ['1', '2', 'neu0']);
  assert.equal(merged.find((i) => i.key === 'mehl').checked, true);
  assert.ok(!merged.some((i) => i.key === 'zucker'));
});

test('Wochen beginnen am Montag', () => {
  const sunday = new Date(2026, 10, 8);
  assert.equal(toISODate(startOfWeek(sunday)), '2026-11-02');
  assert.equal(isoWeek(sunday), 45);
  assert.equal(formatWeekRange(startOfWeek(sunday)), '2.–8. November');
  assert.equal(nextFreeDay(['2026-11-09', '2026-11-10'], [{ date: '2026-11-09', slot: 'dinner' }], 'dinner'), '2026-11-10');
});

test('Planungszeitraum Freitag bis Freitag (8 Tage)', () => {
  const sunday = new Date(2026, 10, 8);
  const start = startOfPeriod(sunday, 4);
  assert.equal(toISODate(start), '2026-11-06');
  const dates = periodDates(start, 8);
  assert.equal(dates.length, 8);
  assert.equal(dates[7], '2026-11-13');
  assert.equal(formatPeriod(start, 8), 'Fr 6. – Fr 13. November');
  // Am Freitag selbst beginnt schon der neue Zeitraum.
  assert.equal(toISODate(startOfPeriod(new Date(2026, 10, 13), 4)), '2026-11-13');
  assert.equal(formatPeriod(startOfPeriod(new Date(2026, 10, 28), 4), 8), 'Fr 27. Nov. – Fr 4. Dez.');
});

test('Vorrat: bald verbrauchen ab drei Tagen oder per Markierung', () => {
  assert.equal(pantryStatus({ expiresAt: '2026-11-09' }, '2026-11-08').label, 'morgen');
  assert.equal(pantryStatus({ expiresAt: '2026-11-11' }, '2026-11-08').soon, true);
  assert.equal(pantryStatus({ expiresAt: '2026-11-20' }, '2026-11-08').soon, false);
  assert.equal(pantryStatus({ useSoon: true }, '2026-11-08').soon, true);
  assert.equal(pantryStatus({ expiresAt: '2026-11-07' }, '2026-11-08').label, 'abgelaufen');
});

test('Rezepte filtern nach Kategorie, allen Tags und Suchtext', () => {
  const recipes = [
    { id: '1', title: 'Curry', categoryIds: ['main'], tagIds: ['vegan', 'gf'], ingredients: [{ name: 'Kichererbsen' }] },
    { id: '2', title: 'Bolognese', categoryIds: ['main'], tagIds: ['kids'], ingredients: [{ name: 'Hack' }] },
    { id: '3', title: 'Suppe', categoryIds: ['soup'], tagIds: ['vegan'], ingredients: [] },
  ];
  assert.deepEqual(filterRecipes(recipes, { categoryId: 'main' }).map((r) => r.id), ['2', '1']);
  assert.deepEqual(filterRecipes(recipes, { tagIds: ['vegan', 'gf'] }).map((r) => r.id), ['1']);
  assert.deepEqual(filterRecipes(recipes, { q: 'kicher' }).map((r) => r.id), ['1']);
});

test('Suche wahlweise nur im Namen oder nur in den Zutaten', () => {
  const recipes = [
    { id: '1', title: 'Tomatensuppe', ingredients: [{ name: 'Zwiebel' }, { name: 'Tomaten aus der Dose' }] },
    { id: '2', title: 'Ofengemüse mit Feta', ingredients: [{ name: 'Feta' }, { name: 'rote Paprika' }, { name: 'Tomate' }] },
    { id: '3', title: 'Linsensalat', description: 'mit Feta', ingredients: [{ name: 'Berglinsen' }, { name: 'Paprika' }] },
  ];
  const ids = (opts) => filterRecipes(recipes, opts).map((r) => r.id);
  assert.deepEqual(ids({ q: 'tomate', searchIn: 'name' }), ['1']);
  assert.deepEqual(ids({ q: 'Tomaten', searchIn: 'ingredients' }), ['2', '1']);
  assert.deepEqual(ids({ q: 'feta', searchIn: 'all' }), ['3', '2']);
  assert.deepEqual(ids({ q: 'feta', searchIn: 'name' }), ['2']);
  assert.deepEqual(ids({ q: 'Feta, Paprika', searchIn: 'ingredients' }), ['2']);
  assert.deepEqual(ingredientMatches(recipes[1], 'feta, paprika'), ['Feta', 'rote Paprika']);
  assert.equal(ingredientMatches(recipes[0], 'feta'), null);
});

test('Rezept-Link: hin und zurück ohne Verlust, Notiz nur auf Wunsch', async () => {
  const recipe = {
    id: 'x', title: 'Pfannkuchen', description: 'Dünn', servings: 4, prepMin: 5, cookMin: 20, rating: 5,
    ingredients: parseIngredients('Teig:\n250 g Mehl\n2-3 Eier\n\nSalz'), steps: ['Rühren', 'Backen'],
    notes: 'Privat', source: 'Oma', photo: 'data:image/jpeg;base64,AAAA',
  };
  const code = await encodeRecipe(recipe, { categories: ['Frühstück'], tags: ['vegetarisch'], from: 'Unsere Küche' });
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = await decodeRecipe(code);
  assert.equal(back.title, 'Pfannkuchen');
  assert.deepEqual(back.ingredients, recipe.ingredients);
  assert.deepEqual(back.steps, recipe.steps);
  assert.equal(back.notes, '');
  assert.deepEqual(back.tags, ['vegetarisch']);
  assert.equal(back.photo, undefined);
  const withNotes = await decodeRecipe(await encodeRecipe(recipe, { includeNotes: true }));
  assert.equal(withNotes.notes, 'Privat');
});

test('Schritte und Timer-Erkennung', () => {
  assert.deepEqual(parseSteps('1. Zwiebeln schneiden\n2) Anbraten\n\nSchritt 3: Fertig'), ['Zwiebeln schneiden', 'Anbraten', 'Fertig']);
  assert.equal(minutesInStep('Etwa 20 Minuten köcheln lassen'), 20);
  assert.equal(minutesInStep('10–12 min backen'), 12);
  assert.equal(minutesInStep('Abschmecken'), null);
});
