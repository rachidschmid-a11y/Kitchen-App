// Datenablage: Die App arbeitet mit einem Abbild des Haushalts im Speicher. cloud.js hält es mit
// Firestore (households/kueche/…) abgeglichen – Änderungen gehen sofort raus, Änderungen der
// anderen kommen sofort rein. Die Ansichten merken davon nichts: all/get/add/update/remove wie bisher.
import { seedData, DEFAULT_SETTINGS } from './seed.js';

const LEGACY_KEY = 'rezepte-app/v1'; // Prototyp: alles lag im localStorage dieses Browsers
export const COLLECTIONS = ['recipes', 'categories', 'tags', 'mealPlan', 'planInbox', 'shoppingItems', 'staples', 'pantry', 'catalog'];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const listeners = new Set();
const errorListeners = new Set();
let batching = 0;
let dirty = false;
let syncer = null; // bekommt nach jeder Änderung den ganzen Stand und schickt die Unterschiede los
let renderTimer = null;
// Wer gerade angemeldet ist – wird bei neuen Einträgen als „by“ gespeichert.
let actor = () => null;
let state = normalize({});

function normalizeRecipe(r) {
  // Früher gab es pro Rezept ein einzelnes Notizfeld – jetzt eine Liste datierter Notizen.
  if (!Array.isArray(r.noteLog)) r.noteLog = r.notes ? [{ id: uid(), text: r.notes, createdAt: r.updatedAt || r.createdAt || Date.now() }] : [];
  delete r.notes;
  return r;
}

export function normalize(s) {
  for (const c of COLLECTIONS) if (!Array.isArray(s[c])) s[c] = [];
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  s.recipes.forEach(normalizeRecipe);
  // Reihenfolge über alle Geräte gleich: nach Anlagezeit. Einträge ohne Zeit (Grundeinrichtung)
  // bekommen ihre Position, damit sie in der gewohnten Reihenfolge bleiben.
  for (const c of COLLECTIONS) s[c].forEach((d, i) => { if (typeof d.createdAt !== 'number') d.createdAt = i; });
  return s;
}

export const byCreated = (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// info.remote = true: die Änderung kam von einem anderen Gerät (nicht von dieser Ansicht).
function notify(info = {}) {
  listeners.forEach((fn) => fn(info));
}

// Vergleich unabhängig von der Reihenfolge der Felder (Firestore liefert sie alphabetisch sortiert).
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}

function commit() {
  if (batching) { dirty = true; return; }
  try {
    syncer?.(state);
  } catch (e) {
    errorListeners.forEach((fn) => fn(e));
  }
  notify();
}

export const store = {
  // Viele Änderungen am Stück (z. B. ein Import) speichern und zeichnen nur einmal.
  transaction(fn) {
    batching++;
    try { return fn(); } finally {
      batching--;
      if (!batching && dirty) { dirty = false; commit(); }
    }
  },
  all: (col) => state[col],
  get: (col, id) => state[col].find((d) => d.id === id) || null,
  setActor(fn) {
    actor = fn;
  },
  add(col, doc) {
    const d = { id: uid(), createdAt: Date.now(), by: actor(), ...doc };
    state[col].push(d);
    commit();
    return d;
  },
  update(col, id, patch) {
    const d = state[col].find((x) => x.id === id);
    if (!d) return null;
    Object.assign(d, patch, { updatedAt: Date.now() });
    commit();
    return d;
  },
  remove(col, id) {
    state[col] = state[col].filter((d) => d.id !== id);
    commit();
  },
  // Mehrere Änderungen auf einmal, z. B. eine neu erzeugte Einkaufsliste.
  setAll(col, docs) {
    const now = Date.now();
    state[col] = docs.map((d, i) => (typeof d.createdAt === 'number' ? d : { ...d, createdAt: now + i }));
    commit();
  },
  settings: () => state.settings,
  setSettings(patch) {
    Object.assign(state.settings, patch);
    commit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  onError(fn) {
    errorListeners.add(fn);
  },
  reportError(e) {
    errorListeners.forEach((fn) => fn(e));
  },
  exportData: () => JSON.parse(JSON.stringify(state)),
  // Komplette Sicherung zurückspielen – ersetzt den gemeinsamen Stand für alle.
  importData(data) {
    state = normalize(JSON.parse(JSON.stringify(data)));
    delete state.photos;
    commit();
  },
  // Leerer Haushalt mit Grundeinrichtung (Kategorien, Tags, Katalog, Standard-Einkäufe).
  reset() {
    state = normalize(seedData());
    commit();
  },

  // ---------- nur für cloud.js ----------
  connect(fn) {
    syncer = fn;
  },
  // Stand vom Server übernehmen, ohne ihn zurückzuschicken. Mehrere Sammlungen kurz hintereinander
  // werden zu einem Neuzeichnen zusammengefasst.
  // Ist nichts anders als hier schon bekannt (z. B. das Echo der eigenen Änderung), wird nicht neu gezeichnet.
  receive(col, value) {
    const next = col === 'settings' ? { ...DEFAULT_SETTINGS, ...(value || {}) } : col === 'recipes' ? value.map(normalizeRecipe) : value;
    const same = stable(col === 'settings' ? state.settings : state[col]) === stable(next);
    if (col === 'settings') state.settings = next;
    else state[col] = next;
    if (same) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => notify({ remote: true }), 30);
  },
};

// ---------- Daten aus dem Prototyp (localStorage dieses Browsers) ----------

export function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const data = normalize(JSON.parse(raw));
    const count = COLLECTIONS.reduce((n, c) => n + data[c].length, 0);
    return count ? data : null;
  } catch (e) { return null; }
}
