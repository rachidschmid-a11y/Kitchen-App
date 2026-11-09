// Foto hochladen (Galerie oder Kamera) → komprimieren → im Fotospeicher ablegen.
// Wird im Rezeptformular und direkt auf der Rezeptseite benutzt.
import { icon } from './icons.js';
import { compressImage, formatBytes } from './image.js';
import { savePhoto, photoUrl } from './photos.js';

// „Foto wählen“ öffnet am Handy Galerie/Dateien, „Kamera“ direkt die Kamera.
export function photoButtons({ hasPhoto = false } = {}) {
  return `
    <label class="btn">${icon('image')} ${hasPhoto ? 'Anderes Foto' : 'Foto wählen'}<input type="file" accept="image/*" data-photo-file hidden></label>
    <label class="btn">${icon('camera')} Kamera<input type="file" accept="image/*" capture="environment" data-photo-file hidden></label>`;
}

export function describe(r) {
  const saved = r.originalBytes > r.bytes ? ` – ${Math.round((1 - r.bytes / r.originalBytes) * 100)} % kleiner` : '';
  return `${formatBytes(r.originalBytes)} → ${formatBytes(r.bytes)}${saved} · ${r.width} × ${r.height} px · ${r.type === 'image/webp' ? 'WebP' : 'JPEG'}`;
}

// status(text) zeigt den Fortschritt an; liefert { id, url, info }.
export async function uploadPhoto(file, status = () => {}) {
  status(`Foto wird komprimiert … (${formatBytes(file.size)})`);
  const r = await compressImage(file);
  status('Foto wird gespeichert …');
  const id = await savePhoto(r);
  return { id, url: await photoUrl(id, 'full'), info: describe(r), result: r };
}
