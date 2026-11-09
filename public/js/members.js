// Personen im Haushalt – wie „Unser Nest“: jede Person hat einen Anzeigenamen und ein Kürzel,
// und die App merkt sich, wer etwas angelegt, eingeplant oder abgehakt hat.
// Wer man ist, ergibt sich aus der Google-Anmeldung: Die Person merkt sich die uid des Kontos.
import { store, uid } from './store.js';
import { esc } from './ui.js';

const DEVICE_KEY = 'rezepte-app/device';
export const MEMBER_TONES = ['teal', 'rose', 'blue', 'gold', 'violet', 'green'];
export const MAX_NAME = 24;

function device() {
  try { return JSON.parse(localStorage.getItem(DEVICE_KEY)) || {}; } catch (e) { return {}; }
}

export const members = () => store.settings().members || [];
export const member = (id) => members().find((m) => m.id === id) || null;
let user = null; // angemeldetes Google-Konto
export function setUser(u) {
  user = u ? { uid: u.uid, email: u.email || '', name: u.displayName || '' } : null;
}
export const currentUser = () => user;
export const me = () => (user ? members().find((m) => m.uid === user.uid) || null : null);
export const meId = () => me()?.id || null;
export const memberName = (id) => member(id)?.name || '';

function saveDevice(patch) {
  try { localStorage.setItem(DEVICE_KEY, JSON.stringify({ ...device(), ...patch })); } catch (e) { /* privates Fenster */ }
}

// Diese Person mit dem angemeldeten Google-Konto verbinden (und von jeder anderen lösen).
export function setMe(id) {
  if (!user) return;
  store.setSettings({ members: members().map((m) => (m.id === id ? { ...m, uid: user.uid, email: user.email } : m.uid === user.uid ? { ...m, uid: null, email: null } : m)) });
}

// „Später“ beim Start-Dialog: auf diesem Gerät nicht bei jedem Öffnen erneut fragen.
export const whoSkipped = () => !!user && (device().whoSkipped || []).includes?.(user.uid);
export const skipWho = () => user && saveDevice({ whoSkipped: [...(Array.isArray(device().whoSkipped) ? device().whoSkipped : []), user.uid] });

// Vorname aus dem Google-Konto als Vorschlag für den Anzeigenamen.
export const suggestedName = () => {
  const words = (user?.name || '').split(/[\s.]+/).filter((w) => w && !/^(dr|prof|med|dipl|ing)$/i.test(w));
  return cleanName(words[0] || '');
};

export function addMember(name, self = false) {
  const list = members();
  const m = { id: uid(), name: cleanName(name), tone: MEMBER_TONES[list.length % MEMBER_TONES.length], ...(self && user ? { uid: user.uid, email: user.email } : {}) };
  store.setSettings({ members: [...list, m] });
  return m;
}

export function updateMember(id, patch) {
  store.setSettings({ members: members().map((m) => (m.id === id ? { ...m, ...patch, ...(patch.name != null ? { name: cleanName(patch.name) } : {}) } : m)) });
}

export function removeMember(id) {
  store.setSettings({ members: members().filter((m) => m.id !== id) });
}

export const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

export function initials(name) {
  const parts = String(name || '?').trim().split(/[\s-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2)).toUpperCase();
}

export function avatar(idOrMember, cls = '') {
  const m = typeof idOrMember === 'string' ? member(idOrMember) : idOrMember;
  if (!m) return '';
  return `<span class="avatar tone-${m.tone || 'teal'} ${cls}" title="${esc(m.name)}" aria-hidden="true">${esc(initials(m.name))}</span>`;
}

// „von Alex“ – leer, wenn niemand bekannt ist.
export const byLine = (id, prefix = 'von') => (memberName(id) ? `${prefix} ${memberName(id)}` : '');
