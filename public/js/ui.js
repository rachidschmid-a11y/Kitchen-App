// Kleine UI-Helfer, die alle Ansichten teilen.
import { icon } from './icons.js';
import { store } from './store.js';
import { toISODate } from './model.js';
import { cachedUrl, hydratePhotos } from './photos.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export const deNum = (n) => String(n).replace('.', ',');

export function toast(message, action) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').addEventListener('click', () => { action.run(); el.remove(); });
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4000);
}

// Dialog als Bottom-Sheet (Handy) bzw. zentriert (Desktop). `mount` bekommt das Dialog-Element.
export function openDialog({ title, body, mount, wide = false }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet' + (wide ? ' wide' : '');
  dlg.innerHTML = `
    <div class="sheet-head"><h2>${esc(title)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button></div>
    <div class="sheet-body">${body}</div>`;
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); };
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) close();
  });
  dlg.showModal();
  mount?.(dlg, close);
  hydratePhotos(dlg);
  return close;
}

export function confirmDialog({ title, text, confirm = 'Löschen', danger = true }) {
  return new Promise((resolve) => {
    let answered = false;
    openDialog({
      title,
      body: `<p class="muted">${esc(text)}</p>
        <div class="sheet-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button>
        <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirm)}</button></div>`,
      mount(dlg, close) {
        dlg.querySelector('[data-ok]').addEventListener('click', () => { answered = true; resolve(true); close(); });
        dlg.addEventListener('close', () => { if (!answered) resolve(false); });
      },
    });
  });
}

export function stars(rating = 0, { interactive = false } = {}) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    const fill = rating >= i ? 'full' : rating >= i - 0.5 ? 'half' : '';
    out += interactive
      ? `<button type="button" class="star ${fill}" data-rate="${i}" aria-label="${i} von 5 Sternen">${icon('star')}</button>`
      : `<span class="star ${fill}">${icon('star')}</span>`;
  }
  return `<span class="stars${interactive ? ' interactive' : ''}" role="${interactive ? 'group' : 'img'}" aria-label="Bewertung ${deNum(rating || 0)} von 5">${out}</span>`;
}

export function tagChip(tag, { active = false, removable = false } = {}) {
  if (!tag) return '';
  return `<span class="tag tone-${tag.tone || 'green'}${active ? ' active' : ''}">${esc(tag.name)}${removable ? icon('x') : ''}</span>`;
}

// Foto oder ein ruhiger Platzhalter in den Farben des Schemas. Fotos liegen in IndexedDB und werden
// nach dem Zeichnen nachgeladen (hydratePhotos) – einmal geladen kommen sie sofort aus dem Zwischenspeicher.
export function photoHtml(recipe, cls = '', variant = 'thumb') {
  if (recipe.photoId) {
    const url = cachedUrl(recipe.photoId, variant);
    if (url) return `<img class="${cls}" src="${url}" alt="" decoding="async">`;
  } else if (recipe.photo) return `<img class="${cls}" src="${recipe.photo}" alt="" loading="lazy">`;
  const n = [...(recipe.id || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
  const lazy = recipe.photoId ? ` data-photo-id="${recipe.photoId}" data-variant="${variant}" data-cls="${cls}"` : '';
  return `<div class="${cls} photo-ph ph-${n}"${lazy} aria-hidden="true">${icon('pot')}</div>`;
}

export function recipeById(id) {
  return store.get('recipes', id);
}

export function tagsById(ids = []) {
  return ids.map((id) => store.get('tags', id)).filter(Boolean);
}

export function minutesLabel(min) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const todayIso = () => toISODate(new Date());

// Datei im Browser erzeugen und herunterladen – nichts geht übers Netz.
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function daysAgoLabel(ts) {
  if (!ts) return '';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  if (days < 14) return 'vor einer Woche';
  if (days < 60) return `vor ${Math.round(days / 7)} Wochen`;
  return `vor ${Math.round(days / 30)} Monaten`;
}
