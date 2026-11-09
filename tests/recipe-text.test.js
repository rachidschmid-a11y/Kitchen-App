import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipeText, parseMinutes, buildAiPrompt } from '../public/js/recipe-text.js';
import { parseIngredients } from '../public/js/model.js';

test('Antwort im KI-Format wird vollständig übernommen', () => {
  const answer = `Hier ist das Rezept:
\`\`\`
TITEL: Lava Cake
BESCHREIBUNG: Schokotörtchen mit flüssigem Kern.
PORTIONEN: 4
VORBEREITUNG_MIN: 10
KOCHZEIT_MIN: 12
KATEGORIE: Dessert, Backen
TAGS: vegetarisch
QUELLE: backenmachtgluecklich.de
ZUTATEN:
- 150 g Zartbitterschokolade
- 140 g Butter
Für die Form:
- etwas Butter
ZUBEREITUNG:
1. Schokolade mit Butter schmelzen.
2. Eier mit Zucker
schaumig schlagen.
TIPPS: Für flüssigen Kern max. 10 Minuten.
UNSICHER: leer
\`\`\``;
  const r = parseRecipeText(answer);
  assert.equal(r.title, 'Lava Cake');
  assert.equal(r.description, 'Schokotörtchen mit flüssigem Kern.');
  assert.equal(r.servings, 4);
  assert.equal(r.prepMin, 10);
  assert.equal(r.cookMin, 12);
  assert.deepEqual(r.categories, ['Dessert', 'Backen']);
  assert.deepEqual(r.tags, ['vegetarisch']);
  assert.equal(r.source, 'backenmachtgluecklich.de');
  assert.deepEqual(r.steps, ['Schokolade mit Butter schmelzen.', 'Eier mit Zucker schaumig schlagen.']);
  assert.equal(r.tips, 'Für flüssigen Kern max. 10 Minuten.');
  assert.equal(r.uncertain, '');
  const ings = parseIngredients(r.ingredientsText);
  assert.equal(ings.length, 3);
  assert.equal(ings[2].section, 'Für die Form');
  assert.deepEqual(r.warnings, []);
});

test('Instagram-Beschreibung mit Emojis und Hashtags', () => {
  const caption = `Cremige Brokkoli Feta Pasta 🥦

Zutaten:

🥦 1 Brokkoli
200-300 g Nudeln
1 Tasse Nudelwasser
1 Packung Feta

Zubereitung

Die Röschen vom Brokkoli trennen und waschen.

Die Nudeln in einen Topf mit kochendem Salzwasser geben.

—
#brokkoli #feta #pasta`;
  const r = parseRecipeText(caption);
  assert.equal(r.title, 'Cremige Brokkoli Feta Pasta');
  assert.equal(parseIngredients(r.ingredientsText).length, 4);
  assert.equal(parseIngredients(r.ingredientsText)[0].name, 'Brokkoli');
  assert.equal(r.steps.length, 2);
  assert.ok(r.warnings.some((w) => w.includes('Portion')));
});

test('Von einer Webseite kopierter Text mit Zeiten und Portionen', () => {
  const page = `Quiche Lorraine
Der Klassiker unter den Quiches, warm oder kalt.
Vorbereitungszeit 15 Min. Zubereitungszeit 35 Min.
Zutaten für 4 Personen
4 Eier Größe M
200 g Sahne
½ TL Salz
ANLEITUNG
1. Backofen auf 180 Grad vorheizen.
2. Eier mit Sahne verquirlen
und würzen.
3. 35 Minuten backen.`;
  const r = parseRecipeText(page);
  assert.equal(r.title, 'Quiche Lorraine');
  assert.equal(r.description, 'Der Klassiker unter den Quiches, warm oder kalt.');
  assert.equal(r.servings, 4);
  assert.equal(r.prepMin, 15);
  assert.equal(parseIngredients(r.ingredientsText).length, 3);
  assert.deepEqual(r.steps, ['Backofen auf 180 Grad vorheizen.', 'Eier mit Sahne verquirlen und würzen.', '35 Minuten backen.']);
});

test('Zutaten in einer Zeile und Text ganz ohne Überschriften', () => {
  const inline = parseRecipeText('Mürbeteig\nZutaten: 250 g Mehl, 100 g Zucker, 2 Eigelb, 1 Prise Salz\nZubereitung: Alles zu einem Teig verkneten und kühlen.');
  assert.equal(parseIngredients(inline.ingredientsText).length, 4);
  assert.deepEqual(inline.steps, ['Alles zu einem Teig verkneten und kühlen.']);

  const bare = parseRecipeText('Schnelle Tomatensoße\n1 Dose Tomaten\n2 Zehen Knoblauch\nSalz\nKnoblauch in Öl anbraten, Tomaten dazu und 15 Minuten köcheln lassen.');
  assert.equal(bare.title, 'Schnelle Tomatensoße');
  assert.equal(parseIngredients(bare.ingredientsText).length, 3);
  assert.equal(bare.steps.length, 1);
});

test('Gewürze in einer Zeile werden getrennt, Beschreibungen nicht', () => {
  const r = parseRecipeText('Zutaten:\nSalz, Pfeffer\nSalz und Pfeffer\n1 Paprika, rot\n250 g Mehl, 100 g Zucker\nZubereitung:\nAlles mischen.');
  assert.deepEqual(parseIngredients(r.ingredientsText).map((i) => i.name), ['Salz', 'Pfeffer', 'Salz', 'Pfeffer', 'Paprika', 'Mehl', 'Zucker']);
  assert.equal(parseIngredients(r.ingredientsText)[4].note, 'rot');
  const dose = parseRecipeText('Zutaten:\n1 Dose Kokosmilch, 400 ml\nZubereitung:\nErhitzen.');
  assert.deepEqual(parseIngredients(dose.ingredientsText), [{ amount: 1, amountMax: null, unit: 'Dose', name: 'Kokosmilch', note: '400 ml' }]);
});

test('Zeiten und KI-Anweisung', () => {
  assert.equal(parseMinutes('1 Std. 20 Min.'), 80);
  assert.equal(parseMinutes('45'), 45);
  assert.equal(parseMinutes('1,5 h'), 90);
  const prompt = buildAiPrompt({ categories: ['Suppe'], tags: ['vegan'] });
  assert.match(prompt, /KATEGORIE: \(passende aus: Suppe\)/);
  assert.match(prompt, /UNSICHER:/);
});
