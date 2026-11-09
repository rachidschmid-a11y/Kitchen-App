// Rezept anlegen/bearbeiten. Zutaten als Freitext – die App zerlegt sie Zeile für Zeile.
import { store, uid } from '../store.js';
import { icon } from '../icons.js';
import { resetImport } from './import.js';
import { esc, toast, photoHtml } from '../ui.js';
import { photoButtons, uploadPhoto } from '../photo-upload.js';
import { deletePhoto } from '../photos.js';
import { TAG_TONES } from '../seed.js';
import { parseIngredients, ingredientsToText, parseSteps, formatQuantity } from '../model.js';
import { navigate } from '../main.js';

function preview(text) {
  const ings = parseIngredients(text);
  if (!ings.length) return '<p class="muted small">Die erkannten Zutaten erscheinen hier.</p>';
  let section = '';
  return `<ul class="parse-list">${ings.map((i) => {
    const head = i.section && i.section !== section ? `<li class="parse-section">${esc((section = i.section))}</li>` : '';
    return `${head}<li><span class="mono">${esc(formatQuantity(i.amount, i.unit, i.amountMax) || '–')}</span>
      <b>${esc(i.name)}</b>${i.note ? `<span class="muted">${esc(i.note)}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

function chipsHtml(items, selected, attr) {
  return items.map((x) => {
    const on = selected.includes(x.id);
    return `<button type="button" class="${attr === 'tag' ? `tag-filter tone-${x.tone}` : 'chip'}${on ? ' active' : ''}" data-${attr}="${x.id}" aria-pressed="${on}">${on ? icon('check') : ''}${esc(x.name)}</button>`;
  }).join('');
}

// Entwurf aus dem Import (Text oder KI-Antwort), wird beim nächsten Öffnen von „Neues Rezept“ übernommen.
let pendingImport = null;
export function startDraft(d) { pendingImport = d; }

const byName = (items, names) => names
  .map((n) => items.find((x) => x.name.toLowerCase() === String(n).toLowerCase())?.id)
  .filter(Boolean);

function fromImport(d) {
  const categories = store.all('categories');
  const tags = store.all('tags');
  const unknown = [...d.categories.filter((n) => !byName(categories, [n]).length), ...d.tags.filter((n) => !byName(tags, [n]).length)];
  return {
    recipe: {
      title: d.title, description: d.description, servings: d.servings || 4, prepMin: d.prepMin ?? '', cookMin: d.cookMin ?? '',
      steps: d.steps, source: d.source, categoryIds: byName(categories, d.categories), tagIds: byName(tags, d.tags), photo: null,
    },
    notes: [
      d.tips && { text: `Tipp aus dem Original: ${d.tips}`, original: true },
      d.uncertain && { text: `Beim Import unsicher: ${d.uncertain}` },
    ].filter(Boolean),
    warnings: [...d.warnings, ...(unknown.length ? [`Nicht zugeordnet (gibt es nicht): ${unknown.join(', ')}`] : [])],
    uncertain: d.uncertain,
    ingredientsText: d.ingredientsText,
  };
}

export function editView({ params }) {
  const existing = params[0] ? store.get('recipes', params[0]) : null;
  if (params[0] && !existing) { navigate('rezepte'); return null; }
  const imported = !existing && pendingImport ? fromImport(pendingImport) : null;
  pendingImport = null;
  const r = existing || imported?.recipe || { title: '', description: '', servings: 4, prepMin: '', cookMin: '', ingredients: [], steps: [], source: '', categoryIds: [], tagIds: [], photo: null };
  const draft = { categoryIds: [...(r.categoryIds || [])], tagIds: [...(r.tagIds || [])], photoId: r.photoId || null, photo: r.photoId ? null : r.photo || null };
  const categories = [...store.all('categories')].sort((a, b) => a.order - b.order);
  const ingText = imported ? imported.ingredientsText : ingredientsToText(r.ingredients);

  const html = `
    <header class="page-head">
      <div><p class="eyebrow">${existing ? 'Rezept bearbeiten' : imported ? 'Importiert' : 'Neues Rezept'}</p><h1>${existing ? esc(r.title) : imported ? 'Bitte kurz prüfen' : 'Rezept anlegen'}</h1></div>
    </header>
    ${imported ? `<aside class="import-check">
      ${icon('sparkle')}
      <div><b>Erkannt und vorausgefüllt.</b> Schaut kurz über Zutaten und Schritte – rechts seht ihr, wie die App die Zutaten versteht.
        ${imported.warnings.length || imported.uncertain ? `<ul>${imported.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}${imported.uncertain ? `<li><b>Die KI war unsicher bei:</b> ${esc(imported.uncertain)}</li>` : ''}</ul>` : ''}
        ${imported.notes.length ? '<p class="small">Tipps und Unsicherheiten landen beim Speichern als Notiz im Rezept.</p>' : ''}</div>
    </aside>` : ''}
    <form class="edit-form" novalidate>
      <section class="card form-card">
        <div class="photo-field">
          <div class="photo-preview" data-photo>${photoHtml({ id: r.id || 'neu', photoId: draft.photoId, photo: draft.photo }, '', 'full')}</div>
          <div class="photo-actions">
            <div class="btn-row">${photoButtons({ hasPhoto: !!(draft.photoId || draft.photo) })}</div>
            <p class="muted small" data-photo-info>${draft.photoId || draft.photo ? '' : 'Wird nach dem Hochladen automatisch verkleinert (ähnlich WhatsApp).'}</p>
            <button type="button" class="link-btn" data-photo-remove ${draft.photoId || draft.photo ? '' : 'hidden'}>Foto entfernen</button>
          </div>
        </div>
        <label class="field"><span>Titel</span><input id="fTitle" name="title" required value="${esc(r.title)}" placeholder="z. B. Omas Apfelkuchen"></label>
        <label class="field"><span>Kurzbeschreibung</span><input name="description" value="${esc(r.description)}" placeholder="Ein Satz, der Lust macht"></label>
        <div class="field-row">
          <label class="field"><span>Portionen</span><input name="servings" type="number" min="1" inputmode="numeric" value="${esc(r.servings)}"></label>
          <label class="field"><span>Vorbereiten (min)</span><input name="prepMin" type="number" min="0" inputmode="numeric" value="${esc(r.prepMin)}"></label>
          <label class="field"><span>Kochen/Backen (min)</span><input name="cookMin" type="number" min="0" inputmode="numeric" value="${esc(r.cookMin)}"></label>
        </div>
      </section>

      <section class="card form-card">
        <div class="field"><span>Kategorien</span><div class="chip-wrap" data-cats>${chipsHtml(categories, draft.categoryIds, 'cat')}</div></div>
        <div class="field"><span>Tags</span>
          <div class="chip-wrap" data-tags>${chipsHtml(store.all('tags'), draft.tagIds, 'tag')}</div>
          <div class="inline-form small"><input data-new-tag placeholder="Neuer Tag, z. B. laktosefrei" autocomplete="off"><button type="button" class="btn" data-add-tag>${icon('plus')} Tag</button></div>
        </div>
      </section>

      <section class="card form-card">
        <div class="two-col">
          <label class="field"><span>Zutaten <em>eine pro Zeile · „Für den Teig:“ startet einen Abschnitt</em></span>
            <textarea name="ingredients" rows="12" data-ing placeholder="200 g Mehl&#10;3 Eier&#10;1 Prise Salz">${esc(ingText)}</textarea></label>
          <div class="field"><span>So versteht die App das</span><div class="parse-preview" data-preview>${preview(ingText)}</div></div>
        </div>
        <label class="field"><span>Zubereitung <em>ein Schritt pro Zeile</em></span>
          <textarea name="steps" rows="8" placeholder="Ofen auf 180 °C vorheizen.&#10;Alles verrühren.">${esc(r.steps.join('\n'))}</textarea></label>
      </section>

      <section class="card form-card">
        <p class="muted small">Notizen zu Änderungen und Extra-Schritten fügt ihr direkt im Rezept unter „Unsere Notizen“ hinzu.</p>
        <label class="field"><span>Quelle</span><input name="source" value="${esc(r.source)}" placeholder="Link oder Kochbuch mit Seite"></label>
      </section>

      <div class="form-actions">
        <a class="btn ghost" href="${existing ? `#/rezept/${existing.id}` : imported ? '#/import' : '#/rezepte'}">${imported ? 'Zurück zum Import' : 'Abbrechen'}</a>
        <button type="submit" class="btn primary">${icon('check')} Speichern</button>
      </div>
    </form>`;

  return {
    title: existing ? 'Bearbeiten' : 'Neues Rezept',
    live: false,
    html,
    mount(root) {
      const form = root.querySelector('form');
      root.querySelector('[data-ing]').addEventListener('input', (e) => { root.querySelector('[data-preview]').innerHTML = preview(e.target.value); });

      const info = root.querySelector('[data-photo-info]');
      root.querySelectorAll('[data-photo-file]').forEach((input) => input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
          const up = await uploadPhoto(file, (t) => { info.textContent = t; });
          draft.photoId = up.id;
          draft.photo = null;
          root.querySelector('[data-photo]').innerHTML = `<img src="${up.url}" alt="">`;
          info.textContent = up.info;
          root.querySelector('[data-photo-remove]').hidden = false;
        } catch (err) { info.textContent = ''; toast(err.message); }
      }));
      root.querySelector('[data-photo-remove]').addEventListener('click', (e) => {
        draft.photo = null;
        draft.photoId = null;
        info.textContent = '';
        root.querySelector('[data-photo]').innerHTML = photoHtml({ id: 'neu', photo: null });
        e.target.hidden = true;
      });

      const addTag = () => {
        const input = root.querySelector('[data-new-tag]');
        const name = input.value.trim();
        if (!name) return;
        const tags = store.all('tags');
        const found = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
        const tag = found || store.add('tags', { name, tone: TAG_TONES[tags.length % TAG_TONES.length] });
        if (!draft.tagIds.includes(tag.id)) draft.tagIds.push(tag.id);
        root.querySelector('[data-tags]').innerHTML = chipsHtml(store.all('tags'), draft.tagIds, 'tag');
        input.value = '';
      };
      root.querySelector('[data-add-tag]').addEventListener('click', addTag);
      root.querySelector('[data-new-tag]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } });

      root.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cat]');
        const t = e.target.closest('[data-tag]');
        if (!c && !t) return;
        const [list, id, el] = c ? [draft.categoryIds, c.dataset.cat, c] : [draft.tagIds, t.dataset.tag, t];
        const i = list.indexOf(id);
        i >= 0 ? list.splice(i, 1) : list.push(id);
        const on = i < 0;
        el.classList.toggle('active', on);
        el.setAttribute('aria-pressed', on);
        el.querySelector('svg')?.remove();
        if (on) el.insertAdjacentHTML('afterbegin', icon('check'));
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const title = String(f.get('title')).trim();
        if (!title) { root.querySelector('#fTitle').focus(); toast('Bitte einen Titel eingeben'); return; }
        const doc = {
          title,
          description: String(f.get('description')).trim(),
          servings: Math.max(1, Number(f.get('servings')) || 1),
          prepMin: Number(f.get('prepMin')) || null,
          cookMin: Number(f.get('cookMin')) || null,
          ingredients: parseIngredients(f.get('ingredients')),
          steps: parseSteps(f.get('steps')),
          source: String(f.get('source')).trim(),
          categoryIds: draft.categoryIds,
          tagIds: draft.tagIds,
          photoId: draft.photoId,
          photo: draft.photo,
        };
        let id;
        if (existing) {
          const oldPhoto = existing.photoId;
          store.update('recipes', existing.id, doc);
          if (oldPhoto && oldPhoto !== draft.photoId) deletePhoto(oldPhoto); // ersetztes Foto freigeben
          id = existing.id;
        }
        else {
          const noteLog = (imported?.notes || []).map((n) => ({ ...n, id: uid(), createdAt: Date.now() }));
          id = store.add('recipes', { ...doc, rating: 0, favorite: false, lastCookedAt: null, noteLog }).id;
          if (imported) resetImport();
        }
        toast('Gespeichert');
        navigate(`rezept/${id}`);
      });
    },
  };
}
