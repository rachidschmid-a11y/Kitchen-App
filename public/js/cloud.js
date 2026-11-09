// Abgleich mit Firestore: households/kueche (Einstellungen) und je Sammlung households/kueche/{sammlung}/{id}.
// Nach jeder Änderung vergleicht die App ihren Stand mit dem zuletzt bekannten und schickt nur die
// Unterschiede – auch Änderungen, die eine Ansicht direkt am Objekt gemacht hat, gehen so nicht verloren.
import {
  collection, doc, onSnapshot, writeBatch, setDoc, getDoc, getDocFromServer, getDocFromCache, deleteDoc, Bytes,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db, householdRef } from './firebase.js';
import { store, COLLECTIONS, byCreated, normalize } from './store.js';
import { seedData } from './seed.js';
import { setRemote, syncPhotos } from './photos.js';

const MAX_OPS = 400; // Firestore erlaubt 500 Schreibvorgänge pro Paket
const MAX_PHOTO = 1_000_000; // ein Dokument darf höchstens 1 MiB groß sein

const baseline = { settings: null };
for (const c of COLLECTIONS) baseline[c] = new Map();
const json = (v) => JSON.stringify(v);
let unsubs = [];
let photoTimer = null;

// ---------- Haushalt öffnen ----------

// 'ready' | 'empty' | 'denied' | 'offline'
export async function openHousehold() {
  try {
    const snap = await getDocFromServer(householdRef);
    return snap.exists() ? 'ready' : 'empty';
  } catch (e) {
    if (e.code === 'permission-denied') return 'denied';
    try {
      const snap = await getDocFromCache(householdRef);
      return snap.exists() ? 'ready' : 'offline';
    } catch (err) {
      return 'offline';
    }
  }
}

// ---------- Schreiben ----------

function diffOps(state) {
  const ops = [];
  const sj = json(state.settings);
  if (sj !== baseline.settings) {
    ops.push({ ref: householdRef, data: { settings: state.settings, version: 1 } });
    baseline.settings = sj;
  }
  for (const col of COLLECTIONS) {
    const known = baseline[col];
    const seen = new Set();
    for (const d of state[col]) {
      if (!d || typeof d.id !== 'string' || !d.id || d.id.includes('/')) continue;
      seen.add(d.id);
      const j = json(d);
      if (known.get(d.id) === j) continue;
      const { id, ...data } = d;
      ops.push({ ref: doc(householdRef, col, id), data });
      known.set(id, j);
    }
    for (const id of [...known.keys()]) {
      if (seen.has(id)) continue;
      ops.push({ ref: doc(householdRef, col, id), del: true });
      known.delete(id);
    }
  }
  return ops;
}

function send(ops) {
  const commits = [];
  for (let i = 0; i < ops.length; i += MAX_OPS) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + MAX_OPS)) {
      try {
        if (op.del) batch.delete(op.ref);
        else batch.set(op.ref, op.data);
      } catch (e) {
        console.error('Eintrag kann nicht gespeichert werden', op.ref.path, e);
        store.reportError(e);
      }
    }
    // Ohne Netz bleibt das Paket im Offline-Speicher und geht später raus.
    commits.push(batch.commit().catch((e) => { console.error(e); store.reportError(e); }));
  }
  return Promise.all(commits);
}

function push(state) {
  const ops = diffOps(state);
  if (ops.length) send(ops);
  clearTimeout(photoTimer);
  photoTimer = setTimeout(() => syncPhotos(state.recipes.map((r) => r.photoId)).catch(() => {}), 400);
}

// ---------- Lesen ----------

// Lauscht auf alle Sammlungen; resolved, sobald jede einmal geliefert hat.
export function startSync() {
  stopSync();
  setRemote(photoRemote);
  return new Promise((resolve, reject) => {
    const waiting = new Set(['settings', ...COLLECTIONS]);
    const arrived = (name) => {
      if (!waiting.delete(name) || waiting.size) return;
      store.connect(push);
      resolve();
      syncPhotos(store.all('recipes').map((r) => r.photoId)).catch(() => {});
    };
    const fail = (e) => { console.error(e); if (waiting.size) reject(e); else store.reportError(e); };
    unsubs.push(onSnapshot(householdRef, (snap) => {
      const settings = snap.data()?.settings || {};
      baseline.settings = null;
      store.receive('settings', settings);
      baseline.settings = json(store.settings());
      arrived('settings');
    }, fail));
    for (const col of COLLECTIONS) {
      unsubs.push(onSnapshot(collection(householdRef, col), (qs) => {
        const docs = qs.docs.map((s) => ({ id: s.id, ...s.data() })).sort(byCreated);
        store.receive(col, docs);
        baseline[col] = new Map(store.all(col).map((d) => [d.id, json(d)]));
        arrived(col);
      }, fail));
    }
  });
}

export function stopSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
  store.connect(null);
  setRemote(null);
}

// ---------- Leerer Haushalt: Grundeinrichtung oder Daten aus dem Prototyp ----------

// Schreibt einen kompletten Stand (Sicherung, Prototyp oder Grundeinrichtung) in den leeren Haushalt.
export async function writeAll(data) {
  const state = normalize(JSON.parse(JSON.stringify(data)));
  baseline.settings = null;
  for (const c of COLLECTIONS) baseline[c] = new Map();
  await send(diffOps(state));
}

export const seedHousehold = () => writeAll(seedData());

// ---------- Fotos ----------

const toBytes = async (blob) => Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer()));
const toBlob = (bytes, type) => new Blob([bytes.toUint8Array()], { type: type || 'image/jpeg' });

const photoRemote = {
  async put(id, p) {
    const size = (p.full?.size || 0) + (p.thumb?.size || 0);
    if (size > MAX_PHOTO) throw new Error(`Foto zu groß für die Datenbank (${Math.round(size / 1024)} KB)`);
    // Nicht auf den Server warten: Ohne Netz liegt das Foto im Offline-Speicher und geht später raus.
    const write = setDoc(doc(householdRef, 'photos', id), {
      full: await toBytes(p.full),
      fullType: p.full.type || 'image/jpeg',
      thumb: await toBytes(p.thumb || p.full),
      thumbType: (p.thumb || p.full).type || 'image/jpeg',
      width: p.width || null,
      height: p.height || null,
      createdAt: p.createdAt || Date.now(),
    });
    // Fehler (z. B. keine Berechtigung) melden; ohne Netz nach kurzer Zeit als „unterwegs“ werten.
    write.catch((e) => console.error('Foto-Upload', e));
    await Promise.race([write, new Promise((res) => setTimeout(res, 8000))]);
  },
  async get(id) {
    const snap = await getDoc(doc(householdRef, 'photos', id));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { full: toBlob(d.full, d.fullType), thumb: toBlob(d.thumb, d.thumbType), width: d.width, height: d.height, createdAt: d.createdAt };
  },
  del: (id) => deleteDoc(doc(householdRef, 'photos', id)),
};
