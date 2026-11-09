// Rezept-Detail mit Portionen-Rechner und der Kochmodus.
import { store, uid } from '../store.js';
import { icon } from '../icons.js';
import {
  esc, stars, photoHtml, tagChip, tagsById, minutesLabel, daysAgoLabel, toast, openDialog, confirmDialog, todayIso,
} from '../ui.js';
import { groupBySection, formatQuantity, resolveIngredient, isInPantry, minutesInStep } from '../model.js';
import { openPlanDialog, addRecipeToShopping, markCooked } from '../actions.js';
import { navigate } from '../main.js';
import { avatar, memberName, meId } from '../members.js';
import { encodeRecipe, shareUrl } from '../share.js';
import { photoButtons, uploadPhoto } from '../photo-upload.js';
import { deletePhoto, getPhoto, savePhoto, photoUrl } from '../photos.js';

// Portionen und abgehakte Zutaten je Rezept – bleiben beim Neuzeichnen erhalten.
const servingsById = new Map();
const checkedById = new Map();

function ingredientList(recipe, factor, { checkable = true } = {}) {
  const catalog = store.all('catalog');
  const pantry = store.all('pantry');
  const checked = checkedById.get(recipe.id) || new Set();
  return groupBySection(recipe.ingredients).map((g, gi) => `
    ${g.name ? `<h3 class="ing-section">${esc(g.name)}</h3>` : ''}
    <ul class="ing-list">
      ${g.items.map((ing, i) => {
        const idx = `${gi}-${i}`;
        const { key, entry } = resolveIngredient(ing.name, catalog);
        const have = isInPantry(key, pantry, catalog);
        const qty = formatQuantity(ing.amount, ing.unit, ing.amountMax, factor);
        const done = checked.has(idx);
        return `<li class="ing${done ? ' done' : ''}">
          ${checkable ? `<button type="button" class="checkbox${done ? ' on' : ''}" data-ing="${idx}" aria-pressed="${done}" aria-label="${esc(ing.name)} abhaken">${icon('check')}</button>` : ''}
          <span class="ing-qty mono">${esc(qty)}</span>
          <span class="ing-name">${esc(ing.name)}${ing.note ? `<span class="ing-note">, ${esc(ing.note)}</span>` : ''}</span>
          ${have ? '<span class="badge good">im Vorrat</span>' : entry?.basic ? '<span class="badge">Grundvorrat</span>' : ''}
        </li>`;
      }).join('')}
    </ul>`).join('');
}

export function recipeView({ params, rerender }) {
  const recipe = store.get('recipes', params[0]);
  if (!recipe) return notFound();
  const servings = servingsById.get(recipe.id) || recipe.servings || 1;
  const factor = servings / (recipe.servings || 1);
  const categories = (recipe.categoryIds || []).map((id) => store.get('categories', id)?.name).filter(Boolean);
  const isUrl = /^https?:\/\//.test(recipe.source || '');

  const html = `
    <div class="detail-hero${recipe.photoId || recipe.photo ? ' has-photo' : ''}">
      ${photoHtml(recipe, 'hero-img', 'full')}
      ${recipe.photoId || recipe.photo
        ? '<button type="button" class="hero-zoom" data-zoom aria-label="Foto groß anzeigen"></button>'
        : `<div class="hero-add" data-hero-add>${photoButtons()}<span class="hero-status" data-hero-status></span></div>`}
      <a class="hero-btn left" href="#/rezepte" aria-label="Zurück zu den Rezepten">${icon('chevronLeft')}</a>
      <button type="button" class="hero-btn right2" data-share aria-label="Rezept teilen" title="Teilen">${icon('share')}</button>
      <button type="button" class="hero-btn right${recipe.favorite ? ' on' : ''}" data-fav aria-pressed="${!!recipe.favorite}" aria-label="Favorit">${icon('heart')}</button>
    </div>

    <article class="card detail-card">
      <a class="btn small card-edit" href="#/rezept/${recipe.id}/bearbeiten">${icon('edit')} Bearbeiten</a>
      ${categories.length ? `<p class="eyebrow">${esc(categories.join(' · '))}</p>` : ''}
      <h1 class="detail-title">${esc(recipe.title)}</h1>
      <div class="rating-row">
        ${stars(recipe.rating, { interactive: true })}
        ${recipe.lastCookedAt ? `<span class="muted small">zuletzt gekocht ${daysAgoLabel(recipe.lastCookedAt)}</span>` : '<span class="muted small">noch nie gekocht</span>'}
      </div>
      ${recipe.tagIds?.length ? `<div class="tag-row">${tagsById(recipe.tagIds).map((t) => tagChip(t)).join('')}</div>` : ''}
      ${recipe.description ? `<p class="detail-desc">${esc(recipe.description)}</p>` : ''}
      <div class="info-tiles">
        <div class="info-tile">
          <span class="label">Portionen</span>
          <div class="stepper">
            <button type="button" data-serv="-1" aria-label="Weniger Portionen" ${servings <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
            <b class="mono" aria-live="polite">${servings}</b>
            <button type="button" data-serv="1" aria-label="Mehr Portionen">${icon('plus')}</button>
          </div>
        </div>
        <div class="info-tile"><span class="label">Vorbereiten</span><b class="mono">${minutesLabel(recipe.prepMin) || '–'}</b></div>
        <div class="info-tile"><span class="label">Kochen/Backen</span><b class="mono">${minutesLabel(recipe.cookMin) || '–'}</b></div>
      </div>
      ${recipe.by && memberName(recipe.by) ? `<p class="by-line">${avatar(recipe.by, 'mini')} angelegt von ${esc(memberName(recipe.by))}</p>` : ''}
      ${recipe.source ? `<p class="source">${icon('link')} ${isUrl ? `<a href="${esc(recipe.source)}" target="_blank" rel="noopener">${esc(new URL(recipe.source).hostname)}</a>` : esc(recipe.source)}</p>` : ''}
    </article>

    <div class="detail-cols">
      <section class="card">
        <div class="card-head"><h2>Zutaten</h2>${servings !== recipe.servings ? `<span class="badge accent mono">für ${servings} statt ${recipe.servings}</span>` : ''}</div>
        ${recipe.ingredients.length ? ingredientList(recipe, factor) : '<p class="muted small">Noch keine Zutaten.</p>'}
      </section>
      <section class="card">
        <div class="card-head"><h2>Zubereitung</h2></div>
        ${recipe.steps.length ? `<ol class="steps">${recipe.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="muted small">Noch keine Schritte.</p>'}
      </section>
    </div>

    ${notesSection(recipe)}

    <div class="action-bar">
      <button type="button" class="btn primary" data-plan>${icon('calendar')}<span class="long-label">In Wochenplan</span><span class="short-label">Planen</span></button>
      <button type="button" class="btn shop-btn" data-shop aria-label="Zutaten auf die Einkaufsliste" title="Einkaufsliste">${icon('cart')}<span class="btn-label">Einkaufsliste</span></button>
      <a class="btn icon-only" href="#/rezept/${recipe.id}/kochen" aria-label="Kochmodus" title="Kochmodus">${icon('flame')}</a>
      <button type="button" class="btn icon-only" data-menu aria-label="Weitere Aktionen" title="Mehr">${icon('more')}</button>
    </div>`;

  return {
    title: recipe.title,
    cls: 'detail',
    html,
    mount(root) {
      mountNotes(root, recipe, rerender);
      mountHeroPhoto(root, recipe);
      root.addEventListener('click', async (e) => {
        if (e.target.closest('[data-fav]')) store.update('recipes', recipe.id, { favorite: !recipe.favorite });
        const rate = e.target.closest('[data-rate]');
        if (rate) {
          const v = Number(rate.dataset.rate);
          store.update('recipes', recipe.id, { rating: recipe.rating === v ? v - 0.5 : v });
        }
        const serv = e.target.closest('[data-serv]');
        if (serv) { servingsById.set(recipe.id, Math.max(1, servings + Number(serv.dataset.serv))); rerender(); }
        const ing = e.target.closest('[data-ing]');
        if (ing) {
          const set = checkedById.get(recipe.id) || new Set();
          set.has(ing.dataset.ing) ? set.delete(ing.dataset.ing) : set.add(ing.dataset.ing);
          checkedById.set(recipe.id, set);
          rerender();
        }
        if (e.target.closest('[data-plan]')) openPlanDialog({ recipeId: recipe.id, servings });
        if (e.target.closest('[data-shop]')) {
          const n = addRecipeToShopping(recipe, servings);
          toast(`${n} Zutaten für ${servings} Portionen auf der Einkaufsliste`, { label: 'Ansehen', run: () => navigate('einkauf') });
        }
        if (e.target.closest('[data-menu]')) openMenu(recipe);
        if (e.target.closest('[data-share]')) openShareDialog(recipe);
      });
    },
  };
}

// ---------- Notizen: Änderungen und Extra-Schritte, datiert, neueste zuerst ----------

let editingNote = null;

const noteDate = (ts) => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

function notesSection(recipe) {
  const notes = [...(recipe.noteLog || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return `
    <section class="card notes-card" id="notizen">
      <div class="card-head"><h2>${icon('note')} Unsere Notizen</h2><span class="muted small">Änderungen, Extra-Schritte, Erfahrungen</span></div>
      ${notes.length ? `<ul class="note-list">${notes.map((n) => `
        <li class="note-item${n.original ? ' original' : ''}">
          <div class="note-meta"><span class="mono">${noteDate(n.createdAt)}</span>${n.by && memberName(n.by) ? `<span class="by-line">${avatar(n.by, 'mini')}${esc(memberName(n.by))}</span>` : ''}${n.original ? '<span class="badge">aus dem Original</span>' : ''}
            <span class="note-actions">
              <button type="button" class="icon-btn" data-note-edit="${n.id}" aria-label="Notiz bearbeiten">${icon('edit')}</button>
              <button type="button" class="icon-btn danger" data-note-del="${n.id}" aria-label="Notiz löschen">${icon('trash')}</button>
            </span></div>
          ${editingNote === n.id
            ? `<form class="note-form" data-note-save="${n.id}"><textarea id="noteEdit" rows="3">${esc(n.text)}</textarea>
                <div class="btn-row"><button type="button" class="btn small ghost" data-note-cancel>Abbrechen</button><button class="btn small primary" type="submit">Speichern</button></div></form>`
            : `<p class="note-text">${esc(n.text)}</p>`}
        </li>`).join('')}</ul>` : '<p class="muted small">Noch keine Notizen. Haltet hier fest, was ihr beim Kochen geändert habt.</p>'}
      <form class="note-form" data-note-add>
        <textarea id="noteNew" rows="2" placeholder="z. B. 10 Min. länger backen, nur 1 Zwiebel, mit Feta bestreuen"></textarea>
        <button class="btn small primary" type="submit">${icon('plus')} Notiz hinzufügen</button>
      </form>
    </section>`;
}

function mountNotes(root, recipe, rerender) {
  const save = (noteLog) => store.update('recipes', recipe.id, { noteLog });
  root.querySelector('[data-note-add]').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = root.querySelector('#noteNew').value.trim();
    if (!text) return;
    save([...(recipe.noteLog || []), { id: uid(), text, createdAt: Date.now(), by: meId() }]);
    toast('Notiz gespeichert');
  });
  root.querySelector('[data-note-save]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = root.querySelector('#noteEdit').value.trim();
    const id = e.target.dataset.noteSave;
    editingNote = null;
    save(recipe.noteLog.map((n) => (n.id === id ? { ...n, text, editedAt: Date.now() } : n)).filter((n) => n.text));
  });
  root.querySelector('#noteEdit')?.focus();
  root.addEventListener('click', (e) => {
    const ed = e.target.closest('[data-note-edit]');
    if (ed) { editingNote = ed.dataset.noteEdit; rerender(); }
    if (e.target.closest('[data-note-cancel]')) { editingNote = null; rerender(); }
    const del = e.target.closest('[data-note-del]');
    if (del) {
      const before = recipe.noteLog;
      save(before.filter((n) => n.id !== del.dataset.noteDel));
      toast('Notiz gelöscht', { label: 'Rückgängig', run: () => save(before) });
    }
  });
}

// ---------- Foto direkt auf der Rezeptseite ----------

async function setRecipePhoto(recipe, file, status = (t) => t && toast(t)) {
  try {
    const up = await uploadPhoto(file, status);
    const old = recipe.photoId;
    store.update('recipes', recipe.id, { photoId: up.id, photo: null });
    if (old) deletePhoto(old);
    toast(`Foto gespeichert: ${up.info}`);
  } catch (err) { toast(err.message); }
}

function mountHeroPhoto(root, recipe) {
  root.querySelectorAll('.hero-add [data-photo-file]').forEach((input) => input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    const statusEl = root.querySelector('[data-hero-status]');
    if (file) setRecipePhoto(recipe, file, (t) => { statusEl.textContent = t; });
  }));
  root.querySelector('[data-zoom]')?.addEventListener('click', async () => {
    const url = recipe.photoId ? await photoUrl(recipe.photoId, 'full') : recipe.photo;
    if (!url) return;
    openDialog({ title: recipe.title, wide: true, body: `<img class="zoom-img" src="${url}" alt="Foto: ${esc(recipe.title)}">` });
  });
}

function openMenu(recipe) {
  openDialog({
    title: recipe.title,
    body: `<div class="menu-list">
      <a class="menu-row" href="#/rezept/${recipe.id}/bearbeiten" data-close>${icon('edit')} Bearbeiten</a>
      <button type="button" class="menu-row" data-act="share">${icon('share')} Teilen per Link</button>
      <button type="button" class="menu-row" data-act="pdf">${icon('download')} Als PDF speichern</button>
      ${recipe.photoId ? `<label class="menu-row">${icon('image')} Foto ändern<input type="file" accept="image/*" data-photo-file hidden></label>
      <button type="button" class="menu-row" data-act="photo-del">${icon('image')} Foto entfernen</button>` : ''}
      <button type="button" class="menu-row" data-act="cooked">${icon('check')} Heute gekocht</button>
      <button type="button" class="menu-row" data-act="dup">${icon('copy')} Duplizieren</button>
      <button type="button" class="menu-row danger" data-act="del">${icon('trash')} Löschen</button>
    </div>`,
    mount(dlg, close) {
      dlg.querySelector('[data-photo-file]')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        close();
        if (file) setRecipePhoto(recipe, file);
      });
      dlg.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        // Fenster sofort öffnen (sonst blockt der Browser das Pop-up), Adresse danach setzen.
        const pdfWindow = act === 'pdf' ? window.open('', '_blank') : null;
        close();
        if (act === 'share') openShareDialog(recipe);
        if (pdfWindow) pdfWindow.location.href = shareUrl(await encodeRecipe(recipe, shareOptions(recipe, true)), { print: true });
        if (act === 'cooked') { markCooked(recipe.id); toast('Als gekocht vermerkt'); }
        if (act === 'photo-del') {
          const old = recipe.photoId;
          store.update('recipes', recipe.id, { photoId: null });
          deletePhoto(old);
          toast('Foto entfernt');
        }
        if (act === 'dup') {
          const { id, createdAt, updatedAt, ...rest } = recipe;
          // Eigene Kopie des Fotos, damit Löschen des einen das andere nicht mitnimmt.
          const p = recipe.photoId ? await getPhoto(recipe.photoId) : null;
          const photoId = p ? await savePhoto(p, uid()) : null;
          const copy = store.add('recipes', { ...rest, id: uid(), photoId, title: recipe.title + ' (Kopie)', lastCookedAt: null });
          navigate(`rezept/${copy.id}/bearbeiten`);
        }
        if (act === 'del') {
          const ok = await confirmDialog({ title: 'Rezept löschen?', text: `„${recipe.title}“ wird gelöscht. Geplante Tage behalten den Namen als Notiz.` });
          if (!ok) return;
          for (const e of store.all('mealPlan').filter((x) => x.recipeId === recipe.id)) store.update('mealPlan', e.id, { recipeId: null, note: recipe.title });
          for (const e of store.all('planInbox').filter((x) => x.recipeId === recipe.id)) store.update('planInbox', e.id, { recipeId: null, note: recipe.title });
          store.remove('recipes', recipe.id);
          deletePhoto(recipe.photoId);
          navigate('rezepte');
          toast('Rezept gelöscht');
        }
      });
    },
  });
}

function shareOptions(recipe, includeNotes) {
  return {
    includeNotes,
    categories: (recipe.categoryIds || []).map((id) => store.get('categories', id)?.name).filter(Boolean),
    tags: tagsById(recipe.tagIds).map((t) => t.name),
    from: store.settings().householdName,
  };
}

// Link erzeugen, der nur dieses Rezept enthält. Empfänger können es ansehen, umrechnen und als PDF speichern.
function openShareDialog(recipe) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  openDialog({
    title: 'Rezept teilen',
    body: `
      <p class="sheet-lead">${esc(recipe.title)}</p>
      <p class="muted small">Wer den Link bekommt, sieht nur dieses eine Rezept – nichts von euren anderen Rezepten, Plänen oder Listen – und kann es als PDF speichern. Fotos werden nicht mitgeschickt.</p>
      ${recipe.noteLog?.length ? '<label class="check-row"><input type="checkbox" data-notes> Unsere Notizen mitschicken</label>' : ''}
      <div class="share-link"><input readonly data-url aria-label="Link zum Rezept" value="Link wird erstellt …"></div>
      <div class="share-actions">
        ${navigator.share ? `<button type="button" class="btn primary" data-native>${icon('share')} Teilen …</button>` : ''}
        <button type="button" class="btn${navigator.share ? '' : ' primary'}" data-copy>${icon('link')} Link kopieren</button>
        <a class="btn ghost" data-open target="_blank" rel="noopener">${icon('arrowRight')} Vorschau</a>
      </div>
      ${local ? '<p class="hint-box">Lokale Version: Dieser Link funktioniert nur auf diesem Rechner. Links für andere bitte in der veröffentlichten App erstellen.</p>' : ''}`,
    mount(dlg) {
      let url = '';
      const update = async () => {
        const includeNotes = !!dlg.querySelector('[data-notes]')?.checked;
        if (!('CompressionStream' in window)) {
          dlg.querySelector('[data-url]').value = 'Auf diesem Gerät nicht möglich – braucht iOS 16.4 oder einen aktuellen Browser.';
          return;
        }
        url = shareUrl(await encodeRecipe(recipe, shareOptions(recipe, includeNotes)));
        dlg.querySelector('[data-url]').value = url;
        dlg.querySelector('[data-open]').href = url;
      };
      update();
      dlg.querySelector('[data-notes]')?.addEventListener('change', update);
      dlg.querySelector('[data-url]').addEventListener('focus', (e) => e.target.select());
      dlg.querySelector('[data-copy]').addEventListener('click', async (e) => {
        try {
          await navigator.clipboard.writeText(url);
          e.currentTarget.innerHTML = `${icon('check')} Kopiert`;
        } catch (err) {
          dlg.querySelector('[data-url]').select();
          toast('Link markiert – bitte selbst kopieren');
        }
      });
      dlg.querySelector('[data-native]')?.addEventListener('click', () => {
        navigator.share({ title: recipe.title, text: `Rezept: ${recipe.title}`, url }).catch(() => {});
      });
    },
  });
}

function notFound() {
  return {
    title: 'Nicht gefunden',
    html: `<div class="empty">${icon('book')}<p>Dieses Rezept gibt es nicht (mehr).</p><a class="btn primary" href="#/rezepte">Zu den Rezepten</a></div>`,
  };
}

// ---------- Kochmodus ----------

const cook = { recipeId: null, step: 0, showIngredients: false, timer: null };
let wakeLock = null;
let timerTick = null;

async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* nicht unterstützt */ }
}

function releaseAwake() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) { /* kein Audio */ }
}

// Kochmodus auf beliebigem Weg verlassen (Zurück-Taste, Link) → Bildschirm darf wieder ausgehen.
window.addEventListener('hashchange', () => {
  if (!location.hash.endsWith('/kochen')) { releaseAwake(); clearInterval(timerTick); }
});

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function cookView({ params, rerender }) {
  const recipe = store.get('recipes', params[0]);
  if (!recipe) return notFound();
  if (cook.recipeId !== recipe.id) Object.assign(cook, { recipeId: recipe.id, step: 0, showIngredients: false, timer: null });
  const total = recipe.steps.length;
  const step = Math.min(cook.step, Math.max(0, total - 1));
  const text = recipe.steps[step] || 'Für dieses Rezept sind noch keine Schritte hinterlegt.';
  const minutes = minutesInStep(text);
  const servings = servingsById.get(recipe.id) || recipe.servings || 1;
  const factor = servings / (recipe.servings || 1);
  const t = cook.timer;
  const left = t ? Math.max(0, Math.round((t.end - Date.now()) / 1000)) : 0;
  keepAwake();

  const html = `
    <header class="cook-head">
      <a class="icon-btn big" href="#/rezept/${recipe.id}" aria-label="Kochmodus beenden">${icon('x')}</a>
      <div class="cook-title"><span class="eyebrow">Kochmodus</span><b>${esc(recipe.title)}</b></div>
      <button type="button" class="btn small${cook.showIngredients ? ' primary' : ''}" data-toggle-ing>${icon('list')} Zutaten</button>
      ${recipe.noteLog?.length ? `<button type="button" class="btn small${cook.showNotes ? ' primary' : ''}" data-toggle-notes>${icon('note')} Notizen</button>` : ''}
    </header>
    ${cook.showIngredients ? `<section class="card cook-ings">${ingredientList(recipe, factor)}</section>` : ''}
    ${cook.showNotes && recipe.noteLog?.length ? `<section class="note-box cook-notes">${icon('note')}<div>${recipe.noteLog.map((n) => `<p class="note-text">${esc(n.text)}</p>`).join('')}</div></section>` : ''}
    <div class="cook-progress" aria-hidden="true">${recipe.steps.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    <p class="cook-count mono">Schritt ${total ? step + 1 : 0} von ${total}</p>
    <p class="cook-step">${esc(text)}</p>
    <div class="cook-timer">
      ${t ? `<div class="timer-chip${left === 0 ? ' done' : ''}">${icon('timer')}<span class="mono" data-timer-left>${left ? mmss(left) : 'Fertig!'}</span>
          <button type="button" class="link-btn" data-timer-stop>${left ? 'Stopp' : 'OK'}</button></div>`
        : minutes ? `<button type="button" class="btn" data-timer="${minutes}">${icon('timer')} Timer ${minutes} min</button>` : ''}
    </div>
    <div class="cook-nav">
      <button type="button" class="btn big" data-step="-1" ${step === 0 ? 'disabled' : ''}>${icon('chevronLeft')} Zurück</button>
      ${step < total - 1
        ? `<button type="button" class="btn big primary" data-step="1">Weiter ${icon('chevronRight')}</button>`
        : `<button type="button" class="btn big primary" data-done>${icon('check')} Fertig gekocht</button>`}
    </div>`;

  return {
    title: 'Kochmodus',
    cls: 'cook',
    immersive: true,
    html,
    mount(root) {
      clearInterval(timerTick);
      if (t && left > 0) {
        timerTick = setInterval(() => {
          const l = Math.max(0, Math.round((t.end - Date.now()) / 1000));
          const el = root.querySelector('[data-timer-left]');
          if (!el || !root.isConnected) { clearInterval(timerTick); return; }
          el.textContent = l ? mmss(l) : 'Fertig!';
          if (!l) { clearInterval(timerTick); beep(); rerender(); }
        }, 1000);
      }
      root.addEventListener('click', (e) => {
        const s = e.target.closest('[data-step]');
        if (s) { cook.step = Math.max(0, Math.min(total - 1, step + Number(s.dataset.step))); rerender(); }
        if (e.target.closest('[data-toggle-ing]')) { cook.showIngredients = !cook.showIngredients; rerender(); }
        if (e.target.closest('[data-toggle-notes]')) { cook.showNotes = !cook.showNotes; rerender(); }
        const tm = e.target.closest('[data-timer]');
        if (tm) { cook.timer = { end: Date.now() + Number(tm.dataset.timer) * 60000 }; rerender(); }
        if (e.target.closest('[data-timer-stop]')) { cook.timer = null; rerender(); }
        if (e.target.closest('[data-done]')) {
          const today = todayIso();
          const entry = store.all('mealPlan').find((x) => x.recipeId === recipe.id && !x.cooked && x.date <= today);
          markCooked(recipe.id, entry?.id);
          cook.recipeId = null;
          releaseAwake();
          toast('Guten Appetit! Als gekocht vermerkt.');
          navigate(`rezept/${recipe.id}`);
        }
        if (e.target.closest('a[href]')) { releaseAwake(); clearInterval(timerTick); }
      });
    },
  };
}
