// Woher die App ihre Firebase-Zugangsdaten bekommt – ohne dass sie im Code stehen:
// 1. Auf Firebase Hosting automatisch aus /__/firebase/init.json (stellt Firebase selbst bereit).
// 2. Lokal (`npm start`) aus js/firebase-config.local.js – Vorlage: firebase-config.local.example.js.
// Die Werte sind nicht geheim; geschützt werden die Daten durch die Google-Anmeldung und firestore.rules.

// Lokale Tests mit den Firebase-Emulatoren (npm run emulators): http://localhost:5180/?emu=1
// Dann spricht die App nur mit dem Emulator-Projekt „demo-…“ – nie mit echten Daten.
export const EMULATOR_PROJECT = 'demo-unsere-kueche';
export const EMULATOR_CONFIG = { apiKey: 'demo-key', authDomain: 'localhost', projectId: EMULATOR_PROJECT, appId: 'demo-app' };

// Die zuletzt geladenen Werte bleiben auf dem Gerät, damit die App auch ohne Netz startet.
const SAVED_KEY = 'rezepte-app/firebase-config';

export async function loadFirebaseConfig() {
  try {
    const res = await fetch('/__/firebase/init.json', { cache: 'no-cache' });
    if (res.ok && /json/.test(res.headers.get('content-type') || '')) {
      const cfg = await res.json();
      if (cfg?.apiKey && cfg?.projectId) {
        try { localStorage.setItem(SAVED_KEY, JSON.stringify(cfg)); } catch (e) { /* privates Fenster */ }
        return cfg;
      }
    }
  } catch (e) { /* nicht auf Firebase Hosting oder offline */ }
  try {
    const mod = await import('./firebase-config.local.js');
    if (mod.firebaseConfig?.apiKey) return mod.firebaseConfig;
  } catch (e) { /* keine lokale Konfiguration */ }
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY));
    if (saved?.apiKey && saved?.projectId) return saved;
  } catch (e) { /* nichts gemerkt */ }
  return null;
}
