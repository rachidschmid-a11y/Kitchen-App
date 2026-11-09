// Firebase-Anbindung: App, Google-Anmeldung und Firestore mit Offline-Speicher.
// Wer Zugriff hat, steht allein in firestore.rules (E-Mail-Liste); die App selbst kennt keine Adressen.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut as fbSignOut,
  onAuthStateChanged, connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  doc, terminate, clearIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { loadFirebaseConfig, EMULATOR_CONFIG } from './firebase-config.js';

// Ein Haushalt für alle: households/kueche (Einstellungen) mit den Sammlungen darunter.
export const HOUSEHOLD_ID = 'kueche';

const EMU_KEY = 'rezepte-app/emulator';
function emulatorWanted() {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return false;
  const q = new URLSearchParams(location.search);
  try {
    if (q.has('emu')) sessionStorage.setItem(EMU_KEY, q.get('emu') === '0' ? '0' : '1');
    return sessionStorage.getItem(EMU_KEY) === '1';
  } catch (e) { return q.get('emu') === '1'; }
}

export const usingEmulator = emulatorWanted();

const config = usingEmulator ? EMULATOR_CONFIG : await loadFirebaseConfig();
if (!config) {
  document.getElementById('view').innerHTML = `<div class="gate"><div class="gate-card card"><h1>Firebase-Konfiguration fehlt</h1>
    <p>Die App muss über Firebase Hosting laufen (<code>firebase deploy</code>) oder lokal eine Datei <code>js/firebase-config.local.js</code> haben – siehe README.</p></div></div>`;
  throw new Error('Firebase-Konfiguration fehlt');
}
export const app = initializeApp(config);
export const auth = getAuth(app);
let cacheOk = true;
let firestore;
try {
  // Offline-Speicher: Die App startet auch ohne Netz, Änderungen werden später übertragen.
  // Mehrere Tabs teilen sich denselben Speicher.
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
} catch (e) {
  cacheOk = false;
  firestore = initializeFirestore(app, { ignoreUndefinedProperties: true });
}
export const db = firestore;
export const offlineCache = () => cacheOk;

if (usingEmulator) {
  connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, location.hostname, 8080);
}

export const householdRef = doc(db, 'households', HOUSEHOLD_ID);

export function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

// Nur im Emulator: Anmeldung ohne Google-Fenster mit einer Test-Adresse.
export function signInTest(email) {
  if (!usingEmulator) throw new Error('Nur im Emulator');
  const name = email.split('@')[0].replace(/[._-]+/g, ' ');
  const token = JSON.stringify({ sub: 'test-' + email.replace(/\W/g, ''), email, email_verified: true, name });
  return signInWithCredential(auth, GoogleAuthProvider.credential(token));
}

export const onUser = (fn) => onAuthStateChanged(auth, fn);

// Abmelden räumt auch den Offline-Speicher dieses Geräts auf (wichtig auf fremden Geräten).
export async function signOut() {
  await fbSignOut(auth);
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (e) { console.warn('Offline-Speicher konnte nicht geleert werden', e); }
}
