// Reine Logik ohne DOM und ohne Speicher – wird mit `node --test` geprüft.

// ---------- Einheiten ----------

const UNIT_ALIASES = {
  g: 'g', gr: 'g', gramm: 'g', mg: 'mg', kg: 'kg', kilo: 'kg',
  ml: 'ml', cl: 'cl', l: 'l', liter: 'l',
  el: 'EL', essl: 'EL', esslöffel: 'EL', tl: 'TL', teel: 'TL', teelöffel: 'TL',
  prise: 'Prise', prisen: 'Prise', msp: 'Msp', messerspitze: 'Msp',
  stück: 'Stück', stk: 'Stück', st: 'Stück',
  bund: 'Bund', dose: 'Dose', dosen: 'Dose', becher: 'Becher', glas: 'Glas', gläser: 'Glas',
  packung: 'Packung', packungen: 'Packung', pck: 'Packung', pkg: 'Packung', päckchen: 'Päckchen',
  zehe: 'Zehe', zehen: 'Zehe', scheibe: 'Scheibe', scheiben: 'Scheibe',
  tasse: 'Tasse', tassen: 'Tasse', handvoll: 'Handvoll', zweig: 'Zweig', zweige: 'Zweig',
  würfel: 'Würfel', blatt: 'Blatt', blätter: 'Blatt', kopf: 'Kopf', köpfe: 'Kopf',
  stange: 'Stange', stangen: 'Stange', knolle: 'Knolle', knollen: 'Knolle', schuss: 'Schuss',
};

const UNIT_PLURALS = {
  Prise: 'Prisen', Dose: 'Dosen', Packung: 'Packungen', Zehe: 'Zehen', Scheibe: 'Scheiben',
  Tasse: 'Tassen', Zweig: 'Zweige', Kopf: 'Köpfe', Stange: 'Stangen', Knolle: 'Knollen',
};

// Umrechnung auf eine gemeinsame Basis, damit 1 kg + 200 g zusammengezählt werden kann.
const BASE_UNITS = { mg: ['g', 0.001], g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], cl: ['ml', 10], l: ['ml', 1000] };

export function canonicalUnit(word) {
  if (!word) return '';
  return UNIT_ALIASES[word.toLowerCase().replace(/\.$/, '')] || null;
}

export function unitLabel(unit, amount) {
  if (!unit || unit === 'Stück') return '';
  return amount != null && amount > 1 && UNIT_PLURALS[unit] ? UNIT_PLURALS[unit] : unit;
}

export function toBase(amount, unit) {
  const b = BASE_UNITS[unit];
  if (b) return { base: b[0], value: amount * b[1] };
  return { base: unit && unit !== 'Stück' ? unit : '', value: amount };
}

// ---------- Mengen ----------

const FRACTION_CHARS = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };
const NUM = String.raw`(?:\d+\/\d+|\d*\s?[½⅓⅔¼¾⅛]|\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?)`;
const QTY_RE = new RegExp(String.raw`^(${NUM})(?:\s*[-–]\s*(${NUM}))?\s*`);

export function parseNumber(str) {
  const s = String(str).trim();
  const frac = s.match(/^(\d*)\s?([½⅓⅔¼¾⅛])$/);
  if (frac) return (frac[1] ? Number(frac[1]) : 0) + FRACTION_CHARS[frac[2]];
  const mixed = s.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (mixed) return (mixed[1] ? Number(mixed[1]) : 0) + Number(mixed[2]) / Number(mixed[3]);
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const deNum = (x) => String(x).replace('.', ',');

export function formatAmount(n, unit = '') {
  if (n == null || Number.isNaN(n)) return '';
  if (unit === 'g' || unit === 'ml' || unit === 'mg') {
    const r = n >= 100 ? Math.round(n / 5) * 5 : n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
    return deNum(r);
  }
  if (unit === 'kg' || unit === 'l') return deNum(Math.round(n * 100) / 100);
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  const steps = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
  let best = steps[0];
  let dist = 1;
  for (const s of steps) {
    const d = Math.abs(frac - s[0]);
    if (d < dist) { dist = d; best = s; }
  }
  if (dist <= 0.04) {
    const w = best[0] === 1 ? whole + 1 : whole;
    if (!w && !best[1]) return '0';
    return (w ? String(w) : '') + best[1];
  }
  return deNum(Math.round(n * 10) / 10);
}

// Menge + Einheit als Text, z. B. „1½ EL“, „2–3 Zehen“, „400 g“.
export function formatQuantity(amount, unit, amountMax = null, factor = 1) {
  if (amount == null) return '';
  const a = amount * factor;
  const max = amountMax != null ? amountMax * factor : null;
  const num = max != null ? `${formatAmount(a, unit)}–${formatAmount(max, unit)}` : formatAmount(a, unit);
  const label = unitLabel(unit, max ?? a);
  return label ? `${num} ${label}` : num;
}

// ---------- Zutaten zerlegen ----------

export function parseIngredientLine(line) {
  let rest = String(line).trim().replace(/^[-•*]\s*/, '');
  if (!rest) return null;
  let amount = null;
  let amountMax = null;
  let unit = '';
  const q = rest.match(QTY_RE);
  if (q && q[0].trim()) {
    amount = parseNumber(q[1]);
    amountMax = q[2] ? parseNumber(q[2]) : null;
    rest = rest.slice(q[0].length);
  }
  // „1 kleine Zwiebel“ → Zwiebel (Hinweis: klein), damit Einkaufsliste und Vorrat die Zutat erkennen.
  let size = '';
  const sz = rest.match(/^(klein|groß|gross|mittelgroß)(?:e|er|es|en)?\s+(?=\S)/i);
  if (sz) {
    size = sz[1].toLowerCase().replace('gross', 'groß');
    rest = rest.slice(sz[0].length);
  }
  const u = rest.match(/^([A-Za-zÄÖÜäöüß]+\.?)(?=\s|$|,)/);
  if (u) {
    const cu = canonicalUnit(u[1]);
    // „Prise Salz“ ohne Zahl zählt als 1 Prise; ein Wort wie „Salz“ bleibt der Name.
    if (cu && (amount != null || rest.slice(u[0].length).trim())) {
      unit = cu;
      if (amount == null) amount = 1;
      rest = rest.slice(u[0].length).trim();
    }
  }
  let note = '';
  const paren = rest.match(/\s*\(([^)]*)\)\s*/);
  if (paren) {
    note = paren[1].trim();
    rest = (rest.slice(0, paren.index) + ' ' + rest.slice(paren.index + paren[0].length)).trim();
  }
  const comma = rest.indexOf(',');
  if (comma >= 0) {
    const after = rest.slice(comma + 1).trim();
    note = note ? `${after}, ${note}` : after;
    rest = rest.slice(0, comma).trim();
  }
  if (size) note = note ? `${size}, ${note}` : size;
  if (!rest) return null;
  return { amount, amountMax, unit, name: rest, note };
}

// Mehrzeiliger Text → strukturierte Zutaten. Zeilen mit „:“ am Ende beginnen einen Abschnitt,
// eine Leerzeile beendet ihn.
export function parseIngredients(text) {
  const out = [];
  let section = '';
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) { section = ''; continue; }
    if (/:$/.test(line)) { section = line.slice(0, -1).trim(); continue; }
    const ing = parseIngredientLine(line);
    if (ing) out.push(section ? { ...ing, section } : ing);
  }
  return out;
}

export function ingredientToText(ing) {
  const qty = formatQuantity(ing.amount, ing.unit, ing.amountMax);
  const unitWord = ing.unit === 'Stück' && ing.amount != null ? ' Stück' : '';
  return `${qty}${unitWord}${qty ? ' ' : ''}${ing.name}${ing.note ? ', ' + ing.note : ''}`.trim();
}

export function ingredientsToText(ingredients = []) {
  const lines = [];
  let section = '';
  for (const ing of ingredients) {
    if ((ing.section || '') !== section) {
      section = ing.section || '';
      if (lines.length) lines.push('');
      if (section) lines.push(section + ':');
    }
    lines.push(ingredientToText(ing));
  }
  return lines.join('\n');
}

export function parseSteps(text) {
  return String(text)
    .split('\n')
    .map((s) => s.trim().replace(/^(?:schritt\s*)?\d+\s*[.):]\s*/i, ''))
    .filter(Boolean);
}

export function groupBySection(ingredients = []) {
  const groups = [];
  for (const ing of ingredients) {
    const name = ing.section || '';
    let g = groups[groups.length - 1];
    if (!g || g.name !== name) { g = { name, items: [] }; groups.push(g); }
    g.items.push(ing);
  }
  return groups;
}

// ---------- Zutaten-Katalog ----------

export function normalizeName(name) {
  return String(name).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Ohne Lookbehind, damit es auch auf älteren iPhones (Safari < 16.4) läuft.
function singular(n) {
  return n.replace(/^(.*?[a-zäöüß]{3})(?:en|n|s|e)$/, '$1');
}

// Findet die Katalog-Zutat zu einem Namen („Zwiebeln“ → Zwiebel) und liefert einen stabilen Schlüssel.
export function resolveIngredient(name, catalog = []) {
  const n = normalizeName(name);
  const s = singular(n);
  for (const c of catalog) {
    const names = [c.name, ...(c.synonyms || [])].map(normalizeName);
    if (names.includes(n) || names.some((x) => singular(x) === s)) return { key: c.id, entry: c };
  }
  return { key: 'n:' + s, entry: null };
}

// ---------- Einkaufsliste ----------

// Was man nur ganz kaufen kann, wird zum Einkaufen aufgerundet (5½ Eier → 6).
const WHOLE_UNITS = ['', 'Dose', 'Packung', 'Päckchen', 'Becher', 'Glas', 'Kopf', 'Knolle'];

export function formatQuantities(quantities) {
  return Object.entries(quantities)
    .map(([base, value]) => {
      if (base === 'g' && value >= 1000) return formatQuantity(value / 1000, 'kg');
      if (base === 'ml' && value >= 1000) return formatQuantity(value / 1000, 'l');
      return formatQuantity(WHOLE_UNITS.includes(base) ? Math.ceil(value - 1e-9) : value, base);
    })
    .join(' + ');
}

export function addQuantities(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v;
  return out;
}

// Von Hand eingetippte Menge („2 l“, „6“) als Zahl verstehen, damit sie mit anderen addiert werden kann.
export function quantitiesFromText(text) {
  if (!text || !text.trim()) return {};
  const p = parseIngredientLine(`${text} x`);
  if (!p || p.amount == null || p.name !== 'x') return null;
  const { base, value } = toBase(p.amountMax ?? p.amount, p.unit);
  return { [base]: value };
}

// Gleiche Zutat aus mehreren Quellen (Plan, einzelnes Rezept, Standard) als eine Zeile anzeigen.
export function combineShoppingItems(items) {
  const rows = new Map();
  for (const i of items) {
    const id = `${i.key}|${i.checked ? 1 : 0}`;
    const row = rows.get(id);
    const q = i.quantities ?? quantitiesFromText(i.amountText);
    if (!row) {
      rows.set(id, { ...i, quantities: q, ids: [i.id], sources: [i.source], fromRecipeIds: [...(i.fromRecipeIds || [])], texts: i.amountText ? [i.amountText] : [] });
      continue;
    }
    row.ids.push(i.id);
    row.sources.push(i.source);
    row.basic = row.basic && i.basic;
    row.needed = row.needed || i.needed;
    for (const r of i.fromRecipeIds || []) if (!row.fromRecipeIds.includes(r)) row.fromRecipeIds.push(r);
    row.quantities = row.quantities && q ? addQuantities(row.quantities, q) : null;
    if (i.amountText) row.texts.push(i.amountText);
  }
  return [...rows.values()].map(({ texts, ...r }) => ({
    ...r,
    amountText: r.ids.length > 1 && r.quantities ? formatQuantities(r.quantities) : texts.join(' + '),
  }));
}

// Sammelt die Zutaten aller geplanten Gerichte, rechnet Portionen um und fasst gleiche Zutaten zusammen.
export function buildShoppingList({ entries, recipes, catalog = [] }) {
  const items = new Map();
  for (const e of entries) {
    if (!e.recipeId || e.cooked) continue;
    const r = recipes.find((x) => x.id === e.recipeId);
    if (!r) continue;
    const factor = (e.servings || r.servings || 1) / (r.servings || 1);
    for (const ing of r.ingredients || []) {
      const { key, entry } = resolveIngredient(ing.name, catalog);
      let it = items.get(key);
      if (!it) {
        it = { key, name: entry ? entry.name : ing.name, aisle: entry?.aisle || 'Sonstiges', quantities: {}, fromRecipeIds: [], basic: !!entry?.basic };
        items.set(key, it);
      }
      const qty = ing.amountMax ?? ing.amount;
      if (qty != null) {
        const { base, value } = toBase(qty * factor, ing.unit);
        it.quantities[base] = (it.quantities[base] || 0) + value;
      }
      if (!it.fromRecipeIds.includes(r.id)) it.fromRecipeIds.push(r.id);
    }
  }
  return [...items.values()].map((it) => ({ ...it, amountText: formatQuantities(it.quantities) }));
}

// Ersetzt die Plan-Artikel einer Liste durch neu erzeugte; Hand- und Standard-Artikel bleiben, Häkchen auch.
export function mergeGeneratedItems(existing, generated, makeId) {
  const kept = existing.filter((i) => i.source !== 'plan');
  const previous = new Map(existing.filter((i) => i.source === 'plan').map((i) => [i.key, i]));
  const fresh = generated.map((g) => {
    const old = previous.get(g.key);
    return { ...g, id: old ? old.id : makeId(), source: 'plan', checked: old ? old.checked : false, needed: !!old?.needed };
  });
  return [...kept, ...fresh];
}

export function isInPantry(key, pantry, catalog) {
  return pantry.some((p) => resolveIngredient(p.name, catalog).key === key);
}

// ---------- Datum & Woche ----------

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

// Beginn des Planungszeitraums, in dem `d` liegt. startDay: 0 = Montag … 6 = Sonntag.
// Überlappen sich zwei Zeiträume (z. B. Fr–Fr), gehört der Starttag zum neuen.
export function startOfPeriod(d, startDay = 0) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((((x.getDay() + 6) % 7) - startDay + 7) % 7));
}

export function periodDates(start, length = 7) {
  return Array.from({ length }, (_, i) => toISODate(addDays(start, i)));
}

export const startOfWeek = (d) => startOfPeriod(d, 0);
export const weekDates = (start) => periodDates(start, 7);

export function weekdayShort(iso) {
  return WEEKDAYS_SHORT[(parseISODate(iso).getDay() + 6) % 7];
}

// „Fr 13. – Fr 20. November“ bzw. über den Monatswechsel „Fr 27. Nov. – Fr 4. Dez.“
export function formatPeriod(start, length) {
  const end = addDays(start, length - 1);
  const wd = (d) => WEEKDAYS_SHORT[(d.getDay() + 6) % 7];
  if (start.getMonth() === end.getMonth()) return `${wd(start)} ${start.getDate()}. – ${wd(end)} ${end.getDate()}. ${MONTHS[end.getMonth()]}`;
  return `${wd(start)} ${start.getDate()}. ${MONTHS[start.getMonth()].slice(0, 3)}. – ${wd(end)} ${end.getDate()}. ${MONTHS[end.getMonth()].slice(0, 3)}.`;
}

export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

export function formatWeekRange(start) {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}.–${end.getDate()}. ${MONTHS[end.getMonth()]}`;
  return `${start.getDate()}. ${MONTHS[start.getMonth()].slice(0, 3)}. – ${end.getDate()}. ${MONTHS[end.getMonth()].slice(0, 3)}.`;
}

export function formatDayLong(iso) {
  const d = parseISODate(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseISODate(toIso) - parseISODate(fromIso)) / 86400000);
}

export function relativeDays(days) {
  if (days < -1) return `vor ${-days} Tagen`;
  if (days === -1) return 'gestern';
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  return `in ${days} Tagen`;
}

// Erster Tag ohne Eintrag im gewünschten Slot, sonst null.
export function nextFreeDay(dates, entries, slot) {
  return dates.find((d) => !entries.some((e) => e.date === d && e.slot === slot)) || null;
}

// ---------- Vorrat ----------

export function pantryStatus(item, todayIso) {
  const days = item.expiresAt ? daysBetween(todayIso, item.expiresAt) : null;
  const soon = item.useSoon || (days != null && days <= 3);
  let label = '';
  if (days != null) label = days < 0 ? 'abgelaufen' : relativeDays(days);
  return { days, soon, label, urgent: days != null && days <= 1 };
}

// Rezepte, die Zutaten verwenden, die bald verbraucht werden müssen – meiste Treffer zuerst.
export function matchRecipesToItems(recipes, items, catalog) {
  const wanted = new Map(items.map((p) => [resolveIngredient(p.name, catalog).key, p.name]));
  return recipes
    .map((r) => {
      const matches = [];
      for (const ing of r.ingredients || []) {
        const k = resolveIngredient(ing.name, catalog).key;
        if (wanted.has(k) && !matches.includes(wanted.get(k))) matches.push(wanted.get(k));
      }
      return { recipe: r, matches };
    })
    .filter((m) => m.matches.length)
    .sort((a, b) => b.matches.length - a.matches.length);
}

// ---------- Rezepte filtern ----------

export function filterRecipes(recipes, { q = '', categoryId = null, tagIds = [], favorites = false, sort = 'name' } = {}) {
  const needle = normalizeName(q);
  let list = recipes.filter((r) => {
    if (categoryId && !(r.categoryIds || []).includes(categoryId)) return false;
    if (tagIds.some((t) => !(r.tagIds || []).includes(t))) return false;
    if (favorites && !r.favorite) return false;
    if (needle) {
      const hay = normalizeName([r.title, r.description, ...(r.ingredients || []).map((i) => i.name)].join(' '));
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const byName = (a, b) => a.title.localeCompare(b.title, 'de');
  const sorters = {
    name: byName,
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || byName(a, b),
    recent: (a, b) => (b.lastCookedAt || 0) - (a.lastCookedAt || 0) || byName(a, b),
    new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    time: (a, b) => totalMinutes(a) - totalMinutes(b) || byName(a, b),
  };
  return [...list].sort(sorters[sort] || byName);
}

export function totalMinutes(r) {
  return (Number(r.prepMin) || 0) + (Number(r.cookMin) || 0);
}

// Erste Minutenangabe in einem Zubereitungsschritt, z. B. für den Timer im Kochmodus.
export function minutesInStep(text) {
  const m = String(text).match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:min\b|minuten|minute)/i);
  return m ? Number(m[2] || m[1]) : null;
}
