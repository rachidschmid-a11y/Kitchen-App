// Firestore erlaubt keine leeren Feldnamen. Die Einkaufsliste speichert Mengen aber nach Einheit,
// und Stückzahlen ohne Einheit („5 Paprika“) stehen unter dem Schlüssel "". Solche Schlüssel werden
// beim Speichern umbenannt und beim Lesen zurückübersetzt – die übrige App merkt davon nichts.
export const EMPTY_KEY = '_ohne_einheit_';

function mapKeys(value, from, to) {
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, from, to));
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k === from ? to : k] = mapKeys(v, from, to);
  return out;
}

export const toFirestore = (value) => mapKeys(value, '', EMPTY_KEY);
export const fromFirestore = (value) => mapKeys(value, EMPTY_KEY, '');
