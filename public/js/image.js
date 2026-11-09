// Fotos nach dem Hochladen verkleinern und komprimieren – ähnlich WhatsApp (dort ca. 1600 px, JPEG ~75 %),
// hier etwas sparsamer: längste Seite 1280 px, Ziel-Dateigröße abhängig von der Bildfläche.
// Die Qualität wird per Suche so hoch wie möglich gewählt, ohne das Ziel zu überschreiten.

export const MAX_EDGE = 1280; // Detailansicht, auch auf Retina-Handys scharf
export const MIN_EDGE = 800; // kleiner wird nur verkleinert, wenn das Ziel sonst nicht erreichbar ist
export const THUMB_EDGE = 480; // Kacheln in der Rezeptliste
const Q_MIN = 0.45;
const Q_MAX = 0.86;

export function fitSize(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

// ~0,9 Bit pro Bildpunkt: 1280×960 → ca. 135 KB, kleine Bilder mind. 50 KB, große höchstens 190 KB.
export function targetBytes(w, h) {
  return Math.round(Math.min(190_000, Math.max(50_000, w * h * 0.11)));
}

// Höchste Qualität, deren Ergebnis noch ins Ziel passt (binäre Suche, 6 Schritte).
// encode(quality) → Promise<Blob>; reine Logik, getestet in tests/image.test.js.
export async function bestQuality(encode, target) {
  let lo = Q_MIN;
  let hi = Q_MAX;
  let best = null;
  const top = await encode(hi);
  if (top.size <= target) return { blob: top, quality: hi };
  for (let i = 0; i < 6; i++) {
    const q = (lo + hi) / 2;
    const blob = await encode(q);
    if (blob.size <= target) { best = { blob, quality: q }; lo = q; } else hi = q;
  }
  if (best) return best;
  const low = await encode(Q_MIN);
  return { blob: low, quality: Q_MIN, overTarget: low.size > target };
}

// ---------- Browser-Teil ----------

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* weiter mit <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// In Halbierungsschritten verkleinern: deutlich schärfer als ein einziger großer Sprung.
function draw(source, w, h) {
  let src = source;
  let sw = source.width;
  let sh = source.height;
  while (sw / 2 >= w * 1.2) {
    const c = document.createElement('canvas');
    c.width = Math.round(sw / 2);
    c.height = Math.round(sh / 2);
    const cx = c.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; // transparente PNGs bekommen weißen statt schwarzen Hintergrund
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return out;
}

const toBlob = (canvas, type, q) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht gespeichert werden'))), type, q));

let webpOk = null;
async function outputType() {
  if (webpOk == null) {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    try { webpOk = (await toBlob(c, 'image/webp', 0.8)).type === 'image/webp'; } catch (e) { webpOk = false; }
  }
  return webpOk ? 'image/webp' : 'image/jpeg'; // WebP ist bei gleicher Qualität ~25 % kleiner
}

export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Das ist keine Bilddatei.');
  let source;
  try { source = await decode(file); } catch (e) {
    throw new Error(/heic|heif/i.test(file.type + file.name) ? 'HEIC-Fotos kann dieser Browser nicht öffnen – bitte am Handy direkt hochladen oder als JPG speichern.' : 'Das Bild konnte nicht geöffnet werden.');
  }
  const type = await outputType();
  let edge = Math.min(MAX_EDGE, Math.max(source.width, source.height));
  let result;
  let w;
  let h;
  for (;;) {
    [w, h] = fitSize(source.width, source.height, edge);
    const canvas = draw(source, w, h);
    result = await bestQuality((q) => toBlob(canvas, type, q), targetBytes(w, h));
    if (!result.overTarget || edge <= MIN_EDGE) break;
    edge = Math.max(MIN_EDGE, Math.round(edge * 0.85));
  }
  const [tw, th] = fitSize(source.width, source.height, THUMB_EDGE);
  const thumb = await toBlob(draw(source, tw, th), type, 0.72);
  source.close?.();
  return { full: result.blob, thumb, width: w, height: h, type, quality: result.quality, originalBytes: file.size, bytes: result.blob.size + thumb.size };
}

export function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

// Fürs Auslesen mit Gemini: Text muss scharf bleiben → größer (2048 px) und als JPEG, nicht gespeichert.
export async function prepareForAi(file, maxEdge = 2048) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Das ist keine Bilddatei.');
  let source;
  try { source = await decode(file); } catch (e) {
    throw new Error(/heic|heif/i.test(file.type + file.name) ? 'HEIC-Fotos kann dieser Browser nicht öffnen – bitte als JPG speichern.' : 'Das Bild konnte nicht geöffnet werden.');
  }
  const [w, h] = fitSize(source.width, source.height, maxEdge);
  const blob = await toBlob(draw(source, w, h), 'image/jpeg', 0.85);
  source.close?.();
  return blob;
}
