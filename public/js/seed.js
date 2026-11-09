// Grundeinrichtung für einen leeren Haushalt: Kategorien, Tags, Abteilungen, Zutaten-Katalog, Standard-Einkäufe.
// Rezepte, Pläne, Listen und Vorrat starten leer.

export const AISLES = [
  'Obst & Gemüse', 'Backwaren', 'Kühlregal', 'Fleisch & Fisch', 'Trockenwaren',
  'Konserven', 'Gewürze & Öle', 'Tiefkühl', 'Getränke', 'Drogerie', 'Sonstiges',
];

export const LOCATIONS = ['Kühlschrank', 'Tiefkühler', 'Speisekammer'];

export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittag' },
  { id: 'dinner', label: 'Abendessen' },
];

export const TAG_TONES = ['green', 'teal', 'blue', 'gold', 'rose', 'violet'];

export const DEFAULT_SETTINGS = {
  householdName: 'Unsere Küche',
  members: [], // { id, name, tone } – Anzeigenamen der Personen im Haushalt
  mealSlots: ['dinner'],
  planStartDay: 0, // 0 = Montag … 6 = Sonntag
  planLength: 7, // Tage pro Planung, 3–10; der Rhythmus bleibt wöchentlich
  aisleOrder: AISLES,
};

const CATEGORIES = [
  ['hauptgericht', 'Hauptgericht'], ['suppe', 'Suppe'], ['salat', 'Salat'], ['fruehstueck', 'Frühstück'],
  ['dessert', 'Dessert'], ['backen', 'Backen'], ['beilage', 'Beilage'],
];

const TAGS = [
  ['vegetarisch', 'vegetarisch', 'green'], ['vegan', 'vegan', 'teal'], ['glutenfrei', 'glutenfrei', 'gold'],
  ['schnell', 'unter 30 min', 'blue'], ['kinder', 'kinderfreundlich', 'rose'], ['mealprep', 'Meal-Prep', 'violet'],
];

// [id, Name, Abteilung, Synonyme, Grundvorrat]
const CATALOG = [
  ['spaghetti', 'Spaghetti', 'Trockenwaren', ['Nudeln']], ['rinderhack', 'Rinderhack', 'Fleisch & Fisch', ['Hackfleisch']],
  ['zwiebel', 'Zwiebel', 'Obst & Gemüse'], ['rote-zwiebel', 'rote Zwiebel', 'Obst & Gemüse'],
  ['knoblauch', 'Knoblauch', 'Obst & Gemüse', ['Knoblauchzehe']], ['karotte', 'Karotte', 'Obst & Gemüse', ['Möhre']],
  ['staudensellerie', 'Staudensellerie', 'Obst & Gemüse'], ['tomatenmark', 'Tomatenmark', 'Konserven'],
  ['gehackte-tomaten', 'gehackte Tomaten', 'Konserven', ['Dosentomaten']], ['rotwein', 'Rotwein', 'Getränke'],
  ['olivenoel', 'Olivenöl', 'Gewürze & Öle', [], true], ['salz', 'Salz', 'Gewürze & Öle', [], true],
  ['pfeffer', 'Pfeffer', 'Gewürze & Öle', [], true], ['parmesan', 'Parmesan', 'Kühlregal'],
  ['ingwer', 'Ingwer', 'Obst & Gemüse'], ['currypaste', 'Currypaste', 'Trockenwaren'],
  ['kichererbsen', 'Kichererbsen', 'Konserven'], ['kokosmilch', 'Kokosmilch', 'Konserven'],
  ['spinat', 'Babyspinat', 'Obst & Gemüse', ['Spinat']], ['kokosoel', 'Kokosöl', 'Gewürze & Öle'],
  ['limette', 'Limette', 'Obst & Gemüse'], ['reis', 'Basmatireis', 'Trockenwaren', ['Reis']],
  ['zucchini', 'Zucchini', 'Obst & Gemüse'], ['paprika', 'Paprika', 'Obst & Gemüse', ['Paprikaschote']],
  ['kartoffel', 'Kartoffeln', 'Obst & Gemüse'], ['feta', 'Feta', 'Kühlregal', ['Schafskäse']],
  ['paprikapulver', 'Paprikapulver', 'Gewürze & Öle', [], true], ['rosmarin', 'Rosmarin', 'Obst & Gemüse'],
  ['linsen', 'rote Linsen', 'Trockenwaren'], ['bruehe', 'Gemüsebrühe', 'Trockenwaren', [], true],
  ['kreuzkuemmel', 'Kreuzkümmel', 'Gewürze & Öle', [], true], ['zitrone', 'Zitrone', 'Obst & Gemüse'],
  ['mehl', 'Mehl', 'Trockenwaren'], ['milch', 'Milch', 'Kühlregal'], ['eier', 'Eier', 'Kühlregal', ['Ei']],
  ['zucker', 'Zucker', 'Trockenwaren', [], true], ['butter', 'Butter', 'Kühlregal'],
  ['lachs', 'Lachsfilet', 'Fleisch & Fisch', ['Lachs']], ['joghurt', 'Joghurt', 'Kühlregal', ['Naturjoghurt']],
  ['dill', 'Dill', 'Obst & Gemüse'], ['petersilie', 'Petersilie', 'Obst & Gemüse'], ['brot', 'Brot', 'Backwaren'],
  ['banane', 'Bananen', 'Obst & Gemüse'], ['brauner-zucker', 'brauner Zucker', 'Trockenwaren'],
  ['backpulver', 'Backpulver', 'Trockenwaren', [], true], ['walnuss', 'Walnüsse', 'Trockenwaren'],
  ['kaffee', 'Kaffee', 'Getränke'], ['erbsen', 'Erbsen', 'Tiefkühl'], ['spuelmittel', 'Spülmittel', 'Drogerie'],
];

const STAPLES = [
  ['Brot', 'Backwaren', '1'], ['Brötchen', 'Backwaren', '6'], ['Milch', 'Kühlregal', '1 l'], ['Eier', 'Kühlregal', '10'],
  ['Butter', 'Kühlregal', '250 g'], ['Joghurt', 'Kühlregal', '500 g'], ['Kaffee', 'Getränke', '500 g'], ['Äpfel', 'Obst & Gemüse', '1 kg'],
];

export function seedData() {
  return {
    recipes: [],
    categories: CATEGORIES.map(([id, name], order) => ({ id, name, order })),
    tags: TAGS.map(([id, name, tone]) => ({ id, name, tone })),
    catalog: CATALOG.map(([id, name, aisle, synonyms = [], basic = false]) => ({ id, name, aisle, synonyms, basic })),
    mealPlan: [],
    planInbox: [],
    shoppingItems: [],
    staples: STAPLES.map(([name, aisle, defaultAmount], i) => ({ id: 'st' + i, name, aisle, defaultAmount })),
    pantry: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
