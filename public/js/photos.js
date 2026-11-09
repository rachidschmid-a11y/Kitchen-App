// Fotos: Das komprimierte Bild (ca. 100–190 KB) liegt in Firestore unter households/kueche/photos/{id},
// jedes Gerät hält eine Kopie in IndexedDB – so erscheinen Bilder sofort und auch offline.
// Rezepte merken sich nur die photoId.
// Neue Fotos werden erst hochgeladen, wenn ein Rezept sie benutzt (Formular abgebrochen → nichts hochgeladen).
// Die Verbindung zu Firestore kommt über setRemote() aus cloud.js – diese Datei kennt Firebase nicht.
import { uid } from './store.js';

const DB = 'rezepte-app-fotos';
const STORE = 'photos';
const urls = new Map(); // `${id}:${variant}` → Object-URL, damit Bilder beim Neuzeichnen nicht flackern
const loading = new Map(); // id → laufender Download
let dbPromise = null;
let remote = null; // { put(id, photo), get(id), del(id) }

export function setRemote(r) {
  remote = r;
}

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    // Bei Anfragen das Ergebnis liefern – auch wenn es leer ist (sonst käme die Anfrage selbst zurück).
    t.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Speichern abgebrochen – ist der Speicher voll?'));
  });
}

const putLocal = (p) => tx('readwrite', (s) => s.put(p));
const getLocal = (id) => tx('readonly', (s) => s.get(id));

// Nur auf diesem Gerät speichern; hochgeladen wird es von syncPhotos(), sobald ein Rezept es benutzt.
export async function savePhoto({ full, thumb, width, height }, id = uid()) {
  await putLocal({ id, full, thumb, width, height, createdAt: Date.now(), synced: false });
  forget(id);
  return id;
}

export async function getPhoto(id) {
  if (!id) return null;
  const local = await getLocal(id).catch(() => null);
  if (local || !remote) return local || null;
  if (!loading.has(id)) {
    loading.set(id, remote.get(id).then(async (p) => {
      if (p) await putLocal({ ...p, id, synced: true }).catch(() => {});
      return p ? { ...p, id } : null;
    }).finally(() => loading.delete(id)));
  }
  return loading.get(id);
}

// Löscht das Foto für alle (Rezept gelöscht, Foto ersetzt oder entfernt).
export async function deletePhoto(id) {
  if (!id) return;
  forget(id);
  await tx('readwrite', (s) => s.delete(id)).catch(() => {});
  if (remote) await remote.del(id).catch((e) => console.warn('Foto konnte nicht gelöscht werden', e));
}

function forget(id) {
  for (const v of ['thumb', 'full']) {
    const key = `${id}:${v}`;
    if (urls.has(key)) { URL.revokeObjectURL(urls.get(key)); urls.delete(key); }
  }
}

export const cachedUrl = (id, variant = 'thumb') => urls.get(`${id}:${variant}`) || null;

export async function photoUrl(id, variant = 'thumb') {
  const key = `${id}:${variant}`;
  if (urls.has(key)) return urls.get(key);
  const p = await getPhoto(id);
  const blob = p?.[variant] || p?.full;
  if (!blob) return null;
  if (urls.has(key)) return urls.get(key);
  const url = URL.createObjectURL(blob);
  urls.set(key, url);
  return url;
}

// Platzhalter mit data-photo-id durch das echte Bild ersetzen (nach jedem Zeichnen aufgerufen).
export function hydratePhotos(root) {
  root.querySelectorAll('[data-photo-id]').forEach(async (el) => {
    const url = await photoUrl(el.dataset.photoId, el.dataset.variant || 'thumb').catch(() => null);
    if (!url || !el.isConnected) return;
    const img = document.createElement('img');
    img.className = el.dataset.cls || '';
    img.alt = '';
    img.src = url;
    img.decoding = 'async';
    el.replaceWith(img);
  });
}

const allLocal = () => tx('readonly', (s) => s.getAll());

// Fotos, die ein Rezept benutzt, aber noch nicht hochgeladen sind, hochladen.
const uploading = new Set();
export async function syncPhotos(usedIds) {
  if (!remote) return 0;
  const used = new Set(usedIds.filter(Boolean));
  const list = (await allLocal().catch(() => [])).filter((p) => p.synced === false || p.synced == null);
  let n = 0;
  for (const p of list) {
    if (!used.has(p.id) || uploading.has(p.id)) continue;
    uploading.add(p.id);
    try {
      await remote.put(p.id, p);
      await putLocal({ ...p, synced: true });
      n++;
    } catch (e) {
      console.warn('Foto-Upload fehlgeschlagen', e);
    } finally {
      uploading.delete(p.id);
    }
  }
  return n;
}

// Kopien auf diesem Gerät, die kein Rezept mehr braucht, freigeben. Gelöscht wird nur lokal –
// noch nicht hochgeladene Fotos (z. B. Formular abgebrochen) und Zwischenkopien.
export async function cleanupPhotos(usedIds, keepIds = []) {
  const keep = new Set([...usedIds, ...keepIds].filter(Boolean));
  const list = await allLocal();
  const hour = 60 * 60 * 1000;
  const orphans = list.filter((p) => !keep.has(p.id) && !uploading.has(p.id) && Date.now() - (p.createdAt || 0) > hour);
  for (const p of orphans) {
    forget(p.id);
    await tx('readwrite', (s) => s.delete(p.id));
  }
  return orphans.length;
}

// Beim Abmelden: Kopien der gemeinsamen Fotos vom Gerät entfernen (nicht hochgeladene bleiben).
export async function clearPhotoCache() {
  const list = await allLocal().catch(() => []);
  for (const p of list) if (p.synced) await tx('readwrite', (s) => s.delete(p.id)).catch(() => {});
}

// Für die komplette Sicherung: Blobs ↔ data-URLs
const toDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
const fromDataUrl = (url) => fetch(url).then((r) => r.blob());

export async function exportPhotos(ids) {
  const out = [];
  for (const id of [...new Set(ids.filter(Boolean))]) {
    const p = await getPhoto(id).catch(() => null);
    if (p?.full) out.push({ id, width: p.width, height: p.height, full: await toDataUrl(p.full), thumb: await toDataUrl(p.thumb || p.full) });
  }
  return out;
}

export async function importPhotos(list = []) {
  for (const p of list) await savePhoto({ full: await fromDataUrl(p.full), thumb: await fromDataUrl(p.thumb), width: p.width, height: p.height }, p.id);
  return list.length;
}

export async function photoStorageBytes() {
  const list = await allLocal();
  return list.reduce((sum, p) => sum + (p.full?.size || 0) + (p.thumb?.size || 0), 0);
}
