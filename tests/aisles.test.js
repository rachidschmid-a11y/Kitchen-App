import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessAisle, coreName, isDrinkingMilk } from '../public/js/aisles.js';
import { buildShoppingList, resolveIngredient } from '../public/js/model.js';

// [Name, Einheit, erwartete Abteilung] – Zutaten aus den echten Rezepten und die Stolperfälle dabei.
const CASES = [
  // Obst & Gemüse
  ['Tomaten', 'g', 'Obst & Gemüse'], ['Cherrytomaten', 'g', 'Obst & Gemüse'], ['rote Paprika', '', 'Obst & Gemüse'], ['Zuckerschoten', 'g', 'Obst & Gemüse'],
  ['Zucchino', '', 'Obst & Gemüse'], ['Auberginen', '', 'Obst & Gemüse'], ['Schalotten', '', 'Obst & Gemüse'], ['Frühlingszwiebeln', '', 'Obst & Gemüse'],
  ['Lauch', 'Stange', 'Obst & Gemüse'], ['Champignons', 'g', 'Obst & Gemüse'], ['Spitzkohl', 'g', 'Obst & Gemüse'], ['grüne Bohnen', 'g', 'Obst & Gemüse'],
  ['Butternut-Kürbis', '', 'Obst & Gemüse'], ['Salatgurke', '', 'Obst & Gemüse'], ['Rucola', 'g', 'Obst & Gemüse'], ['Himbeeren', 'g', 'Obst & Gemüse'],
  ['Zitronensaft', 'EL', 'Obst & Gemüse'], ['Saft von 1 Zitrone', '', 'Obst & Gemüse'], ['glatte Petersilie', 'Bund', 'Obst & Gemüse'], ['Basilikum', 'Bund', 'Obst & Gemüse'],
  ['Schnittlauch', 'EL', 'Obst & Gemüse'], ['Minzblätter', '', 'Obst & Gemüse'], ['Chilischote', '', 'Obst & Gemüse'], ['Oregano', 'Bund', 'Obst & Gemüse'],
  // Gewürze & Öle
  ['Olivenöl', 'EL', 'Gewürze & Öle'], ['Sonnenblumenöl', 'EL', 'Gewürze & Öle'], ['Sesamöl', 'EL', 'Gewürze & Öle'], ['Salz', '', 'Gewürze & Öle'],
  ['schwarzer Pfeffer', '', 'Gewürze & Öle'], ['Salz und frisch gemahlener schwarzer Pfeffer', '', 'Gewürze & Öle'], ['Paprikapulver süß', 'TL', 'Gewürze & Öle'],
  ['gemahlener Kreuzkümmel', 'TL', 'Gewürze & Öle'], ['Oregano', 'TL', 'Gewürze & Öle'], ['getrockneter Thymian', 'Msp', 'Gewürze & Öle'], ['Zimt', 'TL', 'Gewürze & Öle'],
  ['Muskatnuss', 'Prise', 'Gewürze & Öle'], ['Garam Masala', 'TL', 'Gewürze & Öle'], ['Apfelessig', 'EL', 'Gewürze & Öle'], ['Weißweinessig', 'EL', 'Gewürze & Öle'],
  ['Vanilleschote', '', 'Gewürze & Öle'], ['Safran', 'Msp', 'Gewürze & Öle'], ['Ghee', 'EL', 'Gewürze & Öle'], ['Currypulver', 'EL', 'Gewürze & Öle'],
  // Konserven
  ['Gewürzgurken', '', 'Konserven'], ['Mais', 'Dose', 'Konserven'], ['Kidneybohnen', 'Dose', 'Konserven'], ['Pizzatomaten', 'g', 'Konserven'], ['Tomaten', 'Dose', 'Konserven'],
  ['Tomatenmark', 'EL', 'Konserven'], ['Kokosmilch', 'ml', 'Konserven'], ['Sojasauce', 'EL', 'Konserven'], ['Senf', 'TL', 'Konserven'], ['Kondensmilch', 'ml', 'Konserven'],
  ['getrocknete Tomaten', 'g', 'Konserven'], ['Preiselbeeren', 'g', 'Konserven'], ['Mango in Stücken', 'Dose', 'Konserven'],
  // Kühlregal
  ['Sahne', 'ml', 'Kühlregal'], ['Schmand', 'g', 'Kühlregal'], ['Crème fraîche', 'EL', 'Kühlregal'], ['Kräuter-Crème-fraîche', 'TL', 'Kühlregal'], ['Frischkäse', 'g', 'Kühlregal'],
  ['Mozzarella', 'g', 'Kühlregal'], ['weiche Butter', 'g', 'Kühlregal'], ['Eigelb', '', 'Kühlregal'], ['hart gekochte Eier', '', 'Kühlregal'], ['Blätterteig', 'Rolle', 'Kühlregal'],
  ['Hefe', 'Würfel', 'Kühlregal'], ['Buttermilch', 'ml', 'Kühlregal'], ['Butterschmalz', 'g', 'Kühlregal'], ['Hüttenkäse light', 'g', 'Kühlregal'], ['Tofu', 'g', 'Kühlregal'],
  // Fleisch & Fisch
  ['Rinderhackfleisch', 'g', 'Fleisch & Fisch'], ['Hähnchenbrustfilet', 'g', 'Fleisch & Fisch'], ['Putenschnitzel', 'g', 'Fleisch & Fisch'], ['Bacon', 'Scheibe', 'Fleisch & Fisch'],
  ['Lammschulter', 'kg', 'Fleisch & Fisch'], ['Räucherwürstchen', '', 'Fleisch & Fisch'], ['Bresaola', 'g', 'Fleisch & Fisch'],
  // Trockenwaren
  ['Weizenmehl Type 405', 'g', 'Trockenwaren'], ['Puderzucker', 'g', 'Trockenwaren'], ['Vanillezucker', 'Päckchen', 'Trockenwaren'], ['Trockenhefe', 'Packung', 'Trockenwaren'],
  ['Risottoreis', 'g', 'Trockenwaren'], ['Farfalle', 'g', 'Trockenwaren'], ['Couscous', 'g', 'Trockenwaren'], ['Pinienkerne', 'g', 'Trockenwaren'], ['Honig', 'EL', 'Trockenwaren'],
  ['Agavendicksaft', 'EL', 'Trockenwaren'], ['Blütenhonig', 'EL', 'Trockenwaren'], ['Semmelbrösel', 'g', 'Trockenwaren'], ['Kakaopulver', 'EL', 'Trockenwaren'],
  ['Hühnerbrühe', 'ml', 'Trockenwaren'], ['rote Currypaste', 'TL', 'Trockenwaren'], ['Trockenpflaumen', 'g', 'Trockenwaren'], ['Malzmilchpulver', 'EL', 'Trockenwaren'],
  ['Zucker', 'EL', 'Trockenwaren'], ['brauner Zucker', 'TL', 'Trockenwaren'],
  // Backwaren
  ['Naan-Brote', '', 'Backwaren'], ['Sandwich-Brötchen', '', 'Backwaren'], ['Tortillas', 'Packung', 'Backwaren'], ['Gewürzcroutons', 'g', 'Backwaren'], ['Löffelbiskuits', 'g', 'Backwaren'],
  // Tiefkühl
  ['TK-Blattspinat', 'g', 'Tiefkühl'], ['TK-Erbsen', 'g', 'Tiefkühl'], ['Edamame', 'g', 'Tiefkühl'], ['Kartoffeltaschen', '', 'Tiefkühl'], ['8-Kräuter-Mix', 'g', 'Tiefkühl'],
  // Getränke
  ['Rotwein', 'ml', 'Getränke'], ['Malzbier', 'ml', 'Getränke'], ['Mineralwasser', 'ml', 'Getränke'], ['Erdbeer- oder Himbeersaft', 'ml', 'Getränke'],
  // Sonstiges (nichts, was man kauft) und Haushalt
  ['Backpapier', '', 'Sonstiges'], ['lauwarmes Wasser', 'ml', 'Sonstiges'], ['Zahnstocher', '', 'Sonstiges'], ['Spülmittel', '', 'Drogerie'],
];

test('Zutaten landen in der richtigen Abteilung', () => {
  const wrong = CASES.map(([name, unit, want]) => [name, unit, want, guessAisle(name, unit).aisle]).filter(([, , want, got]) => want !== got);
  assert.deepEqual(wrong, [], `falsch zugeordnet: ${wrong.map(([n, u, w, g]) => `${n}${u ? ` [${u}]` : ''}: ${g} statt ${w}`).join('; ')}`);
});

test('Grundvorrat: Salz, Öl, Wasser und Gewürze – nicht aber Dinge, die man frisch kauft', () => {
  for (const n of ['Salz', 'Pfeffer', 'Olivenöl', 'Wasser', 'lauwarmes Wasser', 'Backpapier', 'Paprikapulver süß', 'Zimt', 'Zucker']) assert.equal(guessAisle(n).basic, true, n);
  for (const n of ['Sesamöl', 'Safran', 'Mehl', 'Sahne', 'Paprika', 'Petersilie', 'Honig']) assert.equal(guessAisle(n).basic, false, n);
});

test('Beiwörter: gleiche Zutat, gleiche Zeile', () => {
  assert.equal(coreName('frische Petersilie'), 'petersilie');
  assert.equal(coreName('glatte Petersilie'), 'petersilie');
  assert.equal(coreName('rote Paprika'), 'paprika');
  assert.equal(coreName('gelbe Paprika'), 'paprika');
  assert.equal(coreName('große Zwiebeln'), 'zwiebeln');
  assert.equal(coreName('weiche Butter'), 'butter');
  assert.equal(coreName('rote Bete'), 'rote bete');
  assert.equal(coreName('rote Linsen'), 'rote linsen');
  assert.equal(coreName('gehackte Tomaten'), 'gehackte tomaten');
  assert.equal(resolveIngredient('rote Paprika').key, resolveIngredient('Paprika').key);
  const catalog = [{ id: 'paprika', name: 'Paprika', aisle: 'Obst & Gemüse', synonyms: [] }];
  assert.equal(resolveIngredient('gelbe Paprika', catalog).key, 'paprika');
});

test('Einkaufsliste: unbekannte Zutaten bekommen eine passende Abteilung, Katalog (eure Wahl) gilt zuerst', () => {
  const recipes = [{ id: 'r1', servings: 2, ingredients: [
    { amount: 200, unit: 'g', name: 'Frischkäse' }, { amount: 2, unit: '', name: 'Auberginen' }, { amount: 1, unit: 'TL', name: 'Zimt' }, { amount: 100, unit: 'ml', name: 'Wasser' },
    { amount: 300, unit: 'g', name: 'Farfalle' }] }];
  const catalog = [{ id: 'farfalle-x', name: 'Farfalle', aisle: 'Backwaren', synonyms: [], basic: false }];
  const list = buildShoppingList({ entries: [{ recipeId: 'r1', servings: 2 }], recipes, catalog });
  const by = Object.fromEntries(list.map((i) => [i.name, i]));
  assert.equal(by.Frischkäse.aisle, 'Kühlregal');
  assert.equal(by.Auberginen.aisle, 'Obst & Gemüse');
  assert.equal(by.Zimt.aisle, 'Gewürze & Öle');
  assert.equal(by.Zimt.basic, true);
  assert.equal(by.Wasser.basic, true);
  assert.equal(by.Farfalle.aisle, 'Backwaren'); // im Katalog hinterlegt → gewinnt
});

test('Milch: Kühlregal oder H-Milch aus dem Regal – wählbar, Buttermilch & Co. bleiben unberührt', () => {
  const fresh = (n) => guessAisle(n).aisle;
  const uht = (n) => guessAisle(n, '', { uhtMilk: true }).aisle;
  for (const n of ['Milch', 'Vollmilch', 'frische Vollmilch', 'halb Milch', 'fettarme Milch', 'laktosefreie Milch', 'etwas Milch']) {
    assert.equal(fresh(n), 'Kühlregal', n);
    assert.equal(uht(n), 'Trockenwaren', n);
  }
  for (const n of ['Buttermilch', 'Kondensmilch', 'Kokosmilch', 'Malzmilchpulver', 'Milchreis', 'Sahne', 'Joghurt']) {
    assert.equal(uht(n), fresh(n), n);
  }
  assert.equal(uht('Hafermilch'), 'Trockenwaren');
  assert.equal(fresh('Pflanzendrink'), 'Kühlregal');
  assert.equal(uht('Pflanzendrink'), 'Trockenwaren');
  assert.equal(isDrinkingMilk('Buttermilch'), false);
  assert.equal(isDrinkingMilk('H-Milch'), true);
});

test('Einkaufsliste folgt der Milch-Einstellung', () => {
  const recipes = [{ id: 'r1', servings: 2, ingredients: [{ amount: 500, unit: 'ml', name: 'Vollmilch' }, { amount: 250, unit: 'ml', name: 'Buttermilch' }] }];
  const make = (uhtMilk) => Object.fromEntries(buildShoppingList({ entries: [{ recipeId: 'r1', servings: 2 }], recipes, options: { uhtMilk } }).map((i) => [i.name, i.aisle]));
  assert.deepEqual(make(false), { Vollmilch: 'Kühlregal', Buttermilch: 'Kühlregal' });
  assert.deepEqual(make(true), { Vollmilch: 'Trockenwaren', Buttermilch: 'Kühlregal' });
});

test('Sicherheit: bei eindeutigen Wörtern sicher, bei allgemeinen oder unbekannten nicht', async () => {
  const { classifyIngredient, collectUnsure } = await import('../public/js/model.js');
  for (const n of ['Hackfleisch', 'Olivenöl', 'Käse', 'Zimt zum Bestreuen', 'rustikales Brot', 'Massaman Curry Paste', 'Okraschoten']) assert.equal(guessAisle(n).sure, true, n);
  for (const n of ['Gemüse', 'Kräuter', 'grüne Bohnen', 'Mais', 'Belag nach Belieben', 'Wasser oder Joghurt', 'gemischte Nüsse', 'Zephyrmolch']) assert.equal(guessAisle(n).sure, false, n);
  // Im Katalog (von euch zugeordnet oder bestätigt) ist alles sicher
  const catalog = [{ id: 'k1', name: 'Mais', aisle: 'Konserven', synonyms: [] }];
  assert.equal(classifyIngredient('Mais', 'g', catalog).sure, true);
  assert.equal(classifyIngredient('Mais', 'g', []).sure, false);
  const recipes = [
    { id: 'a', title: 'A', ingredients: [{ name: 'Mais' }, { name: 'Zephyrmolch' }, { name: 'Salz' }] },
    { id: 'b', title: 'B', ingredients: [{ name: 'mais' }, { name: 'Hackfleisch' }] },
  ];
  const list = collectUnsure({ recipes, catalog: [], withList: false });
  assert.deepEqual(list.map((u) => [u.name, u.recipeIds.length]), [['Mais', 2], ['Zephyrmolch', 1]]);
  assert.deepEqual(collectUnsure({ recipes, catalog, withList: false }).map((u) => u.name), ['Zephyrmolch']);
  assert.deepEqual(collectUnsure({ recipes, catalog: [], recipeIds: ['b'], withList: false }).map((u) => u.name), ['mais']);
  const items = [{ id: 'i1', name: 'Zephyrmolch-Pulver', checked: false }, { id: 'i2', name: 'Spülmittel', checked: false }];
  assert.deepEqual(collectUnsure({ recipes: [], catalog: [], shoppingItems: items }).map((u) => [u.name, u.onList]), [['Zephyrmolch-Pulver', true]]);
});
