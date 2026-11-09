// „Mehr“: Personen, Import & Export, Gerät, Farbschema, Wochenplan, Kategorien, Tags, Abteilungen, Standard-Einkäufe.
import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, toast, confirmDialog } from '../ui.js';
import { MEAL_SLOTS, TAG_TONES, AISLES } from '../seed.js';
import { WEEKDAYS, formatPeriod } from '../model.js';
import { periodStartFor } from '../actions.js';
import { peopleSection, mountPeople } from './people.js';
import { deviceSection, mountDevice } from '../device.js';


const theme = window.RezepteTheme;

function paletteCard(id, p, active) {
  const sw = p.light;
  return `<button type="button" class="palette${active ? ' active' : ''}" data-palette="${id}" aria-pressed="${active}">
    <span class="swatches">
      <i style="background:${sw.bg}"></i><i style="background:${sw.accent}"></i><i style="background:${sw['accent-2']}"></i><i style="background:${sw['surface-3']}"></i>
    </span>
    <span class="palette-name">${esc(p.label)}${active ? icon('check') : ''}</span>
    <span class="palette-desc">${esc(p.desc)}</span>
  </button>`;
}

const COLOR_FIELDS = [
  ['bg', 'Hintergrund', 'Seitenfarbe'],
  ['accent', 'Hauptfarbe', 'Buttons, aktive Elemente'],
  ['accent2', 'Zweitfarbe', 'Hinweise, Akzente'],
  ['surface', 'Flächen', 'Chips, Kacheln, Felder'],
];

function customCard(pref, active) {
  const c = pref.custom || theme.customFrom(pref.palette);
  return `<button type="button" class="palette${active ? ' active' : ''}" data-palette="custom" aria-pressed="${active}">
    <span class="swatches" data-custom-swatches>${COLOR_FIELDS.map(([k]) => `<i style="background:${c[k]}"></i>`).join('')}</span>
    <span class="palette-name">Eigenes${active ? icon('check') : ''}</span>
    <span class="palette-desc">4 Farben selbst wählen</span>
  </button>`;
}

function contrastNote(c) {
  const btn = theme.buttonColor(c);
  const notes = [];
  if (btn !== c.accent.toUpperCase()) notes.push(`Damit die Schrift auf Buttons lesbar bleibt, nutzt die App dafür einen dunkleren Ton der Hauptfarbe <i class="mini-swatch" style="background:${btn}"></i>.`);
  // Gleiche Schwelle wie in theme.js (Luminanz 0,35 ≙ Kontrast zu Weiß 2,6).
  if (theme.contrast(c.bg, '#FFFFFF') > 2.6) notes.push('Bei so dunklem Hintergrund schaltet die App auf die dunkle Darstellung.');
  return notes.join(' ') || 'Für den Dunkelmodus werden passende dunkle Töne automatisch abgeleitet.';
}

function customEditor(pref) {
  const c = pref.custom;
  return `
    <div class="custom-colors">
      ${COLOR_FIELDS.map(([k, label, hint]) => `
        <label class="color-field">
          <input type="color" value="${c[k]}" data-color="${k}" aria-label="${label}">
          <span class="color-text"><b>${label}</b><em>${hint}</em></span>
          <span class="mono muted small" data-hex="${k}">${c[k].toUpperCase()}</span>
        </label>`).join('')}
    </div>
    <p class="muted small" data-contrast-note>${contrastNote(c)}</p>
    <div class="setting-row"><span class="muted small">Als Startpunkt übernehmen</span>
      <div class="btn-row">${Object.entries(theme.PALETTES).map(([id, p]) => `<button type="button" class="btn small" data-from="${id}">${esc(p.label)}</button>`).join('')}</div>
    </div>`;
}

export function settingsView({ rerender }) {
  const s = store.settings();
  const pref = theme.current();
  const categories = [...store.all('categories')].sort((a, b) => a.order - b.order);
  const tags = store.all('tags');
  const order = s.aisleOrder || AISLES;

  const html = `
    <header class="page-head"><div><p class="eyebrow">Mehr</p><h1>Einstellungen</h1></div></header>

    ${peopleSection()}

    <a class="card settings link-card" href="#/daten">
      <span class="link-card-ic">${icon('download')}</span>
      <span><b>Import &amp; Export</b><em>Rezepte als Datei sichern, viele Rezepte auf einmal importieren, Vorlage herunterladen</em></span>
      ${icon('chevronRight')}
    </a>

    ${deviceSection()}

    <section class="card settings">
      <div class="card-head"><h2>${icon('palette')} Farbschema</h2><span class="muted small">gilt für dieses Gerät</span></div>
      <div class="palettes">${Object.entries(theme.PALETTES).map(([id, p]) => paletteCard(id, p, pref.palette === id)).join('')}${customCard(pref, pref.palette === 'custom')}</div>
      ${pref.palette === 'custom' ? customEditor(pref) : ''}
      <div class="setting-row"><span>Helligkeit</span>
        <div class="segment compact">${[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, l]) => `<button type="button" class="${pref.mode === v ? 'active' : ''}" data-mode="${v}">${l}</button>`).join('')}</div>
      </div>
    </section>

    <section class="card settings">
      <div class="card-head"><h2>${icon('calendar')} Wochenplan</h2></div>
      <div class="setting-row"><label for="planStart">Planung beginnt am</label>
        <select id="planStart">${WEEKDAYS.map((d, i) => `<option value="${i}"${(s.planStartDay ?? 0) === i ? ' selected' : ''}>${d}</option>`).join('')}</select></div>
      <div class="setting-row"><span>Tage pro Planung</span>
        <div class="stepper">
          <button type="button" data-len="-1" aria-label="Ein Tag weniger" ${(s.planLength ?? 7) <= 3 ? 'disabled' : ''}>${icon('minus')}</button>
          <b class="mono">${s.planLength ?? 7}</b>
          <button type="button" data-len="1" aria-label="Ein Tag mehr" ${(s.planLength ?? 7) >= 10 ? 'disabled' : ''}>${icon('plus')}</button>
        </div></div>
      <p class="plan-preview">Aktuell: <b>${formatPeriod(periodStartFor('this'), s.planLength ?? 7)}</b><br>
        <span class="muted small">Jede Woche beginnt eine neue Planung. Bei mehr als 7 Tagen gehört der letzte Tag auch schon zur nächsten Planung – dort steht dasselbe Gericht.</span></p>
      <div class="field"><span>Welche Mahlzeiten plant ihr?</span>
        <div class="chip-wrap">${MEAL_SLOTS.map((m) => {
          const on = s.mealSlots.includes(m.id);
          return `<button type="button" class="chip${on ? ' active' : ''}" data-slot="${m.id}" aria-pressed="${on}">${on ? icon('check') : ''}${m.label}</button>`;
        }).join('')}</div></div>
    </section>

    <section class="card settings">
      <div class="card-head"><h2>${icon('book')} Kategorien</h2><span class="muted small">Was ist es?</span></div>
      <ul class="edit-list">${categories.map((c, i) => `<li>
        <input value="${esc(c.name)}" data-cat-name="${c.id}" aria-label="Kategorie umbenennen">
        <button type="button" class="icon-btn" data-cat-move="${c.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">${icon('chevronUp')}</button>
        <button type="button" class="icon-btn" data-cat-move="${c.id}" data-dir="1" ${i === categories.length - 1 ? 'disabled' : ''} aria-label="Nach unten">${icon('chevronDown')}</button>
        <button type="button" class="icon-btn danger" data-cat-del="${c.id}" aria-label="Löschen">${icon('trash')}</button></li>`).join('')}</ul>
      <form class="inline-form" data-cat-form><input id="newCat" placeholder="Neue Kategorie" autocomplete="off"><button class="btn" type="submit">${icon('plus')} Hinzufügen</button></form>
    </section>

    <section class="card settings">
      <div class="card-head"><h2>${icon('leaf')} Tags</h2><span class="muted small">Eigenschaften zum Filtern · Farbe antippen zum Wechseln</span></div>
      <div class="chip-wrap">${tags.map((t) => `<span class="tag tone-${t.tone} editable">
        <button type="button" class="tone-dot" data-tone="${t.id}" aria-label="Farbe wechseln"></button>${esc(t.name)}
        <button type="button" class="tag-x" data-tag-del="${t.id}" aria-label="${esc(t.name)} löschen">${icon('x')}</button></span>`).join('')}</div>
      <form class="inline-form" data-tag-form><input id="newTag" placeholder="Neuer Tag, z. B. laktosefrei" autocomplete="off"><button class="btn" type="submit">${icon('plus')} Hinzufügen</button></form>
    </section>

    <section class="card settings">
      <div class="card-head"><h2>${icon('cart')} Abteilungen</h2><span class="muted small">Reihenfolge wie in eurem Supermarkt</span></div>
      <ol class="edit-list ordered">${order.map((a, i) => `<li><span class="mono muted">${i + 1}</span><span class="grow">${esc(a)}</span>
        <button type="button" class="icon-btn" data-aisle="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(a)} nach oben">${icon('chevronUp')}</button>
        <button type="button" class="icon-btn" data-aisle="${i}" data-dir="1" ${i === order.length - 1 ? 'disabled' : ''} aria-label="${esc(a)} nach unten">${icon('chevronDown')}</button></li>`).join('')}</ol>
    </section>

    <section class="card settings">
      <div class="card-head"><h2>${icon('list')} Standard-Einkäufe</h2><span class="muted small">mit einem Tipp auf der Liste</span></div>
      <ul class="edit-list">${store.all('staples').map((st) => `<li><span class="grow">${esc(st.name)}</span><span class="mono muted">${esc(st.defaultAmount || '')}</span>
        <button type="button" class="icon-btn danger" data-staple-del="${st.id}" aria-label="${esc(st.name)} löschen">${icon('trash')}</button></li>`).join('')}</ul>
      <form class="inline-form" data-staple-form>
        <input id="newStaple" placeholder="z. B. Hafermilch" autocomplete="off">
        <input id="newStapleAmount" class="short" placeholder="Menge" autocomplete="off">
        <select id="newStapleAisle" aria-label="Abteilung">${order.map((a) => `<option>${esc(a)}</option>`).join('')}</select>
        <button class="btn" type="submit">${icon('plus')}</button>
      </form>
    </section>`;

  return {
    title: 'Einstellungen',
    html,
    mount(root) {
      root.querySelector('#planStart').addEventListener('change', (e) => store.setSettings({ planStartDay: Number(e.target.value) }));
      mountPeople(root);
      mountDevice(root);
      root.querySelectorAll('[data-cat-name]').forEach((inp) => inp.addEventListener('change', () => {
        const name = inp.value.trim();
        if (name) store.update('categories', inp.dataset.catName, { name });
      }));
      root.querySelector('[data-cat-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = root.querySelector('#newCat').value.trim();
        if (name) store.add('categories', { name, order: categories.length });
      });
      root.querySelector('[data-tag-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = root.querySelector('#newTag').value.trim();
        if (name) store.add('tags', { name, tone: TAG_TONES[tags.length % TAG_TONES.length] });
      });
      root.querySelector('[data-staple-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = root.querySelector('#newStaple').value.trim();
        if (name) store.add('staples', { name, defaultAmount: root.querySelector('#newStapleAmount').value.trim(), aisle: root.querySelector('#newStapleAisle').value });
      });
      // Farbwähler: live anwenden, ohne neu zu zeichnen (sonst schließt sich der Wähler).
      root.querySelectorAll('[data-color]').forEach((input) => input.addEventListener('input', () => {
        const custom = { ...theme.current().custom, [input.dataset.color]: input.value };
        theme.set({ custom, customSaved: true });
        root.querySelector(`[data-hex="${input.dataset.color}"]`).textContent = input.value.toUpperCase();
        root.querySelector('[data-custom-swatches]').innerHTML = COLOR_FIELDS.map(([k]) => `<i style="background:${custom[k]}"></i>`).join('');
        root.querySelector('[data-contrast-note]').innerHTML = contrastNote(custom);
      }));

      root.addEventListener('click', async (e) => {
        const pal = e.target.closest('[data-palette]');
        if (pal) {
          // Beim ersten Mal startet „Eigenes“ mit den Farben des bisher gewählten Schemas.
          const patch = { palette: pal.dataset.palette };
          if (pal.dataset.palette === 'custom' && pref.palette !== 'custom' && !pref.customSaved) patch.custom = theme.customFrom(pref.palette);
          theme.set(patch);
          rerender();
        }
        const from = e.target.closest('[data-from]');
        if (from) { theme.set({ custom: theme.customFrom(from.dataset.from), customSaved: true }); rerender(); }
        const mode = e.target.closest('[data-mode]');
        if (mode) { theme.set({ mode: mode.dataset.mode }); rerender(); }
        const len = e.target.closest('[data-len]');
        if (len) store.setSettings({ planLength: Math.min(10, Math.max(3, (s.planLength ?? 7) + Number(len.dataset.len))) });
        const slot = e.target.closest('[data-slot]');
        if (slot) {
          const id = slot.dataset.slot;
          const next = s.mealSlots.includes(id) ? s.mealSlots.filter((x) => x !== id) : [...s.mealSlots, id];
          if (!next.length) { toast('Mindestens eine Mahlzeit bleibt aktiv.'); return; }
          store.setSettings({ mealSlots: MEAL_SLOTS.map((m) => m.id).filter((m) => next.includes(m)) });
        }
        const cm = e.target.closest('[data-cat-move]');
        if (cm) {
          const i = categories.findIndex((c) => c.id === cm.dataset.catMove);
          const j = i + Number(cm.dataset.dir);
          const list = [...categories];
          [list[i], list[j]] = [list[j], list[i]];
          list.forEach((c, k) => { if (c.order !== k) store.update('categories', c.id, { order: k }); });
        }
        const cd = e.target.closest('[data-cat-del]');
        if (cd) {
          const c = store.get('categories', cd.dataset.catDel);
          const used = store.all('recipes').filter((r) => r.categoryIds?.includes(c.id)).length;
          if (used && !(await confirmDialog({ title: 'Kategorie löschen?', text: `„${c.name}“ wird bei ${used} Rezepten entfernt.` }))) return;
          for (const r of store.all('recipes').filter((x) => x.categoryIds?.includes(c.id))) store.update('recipes', r.id, { categoryIds: r.categoryIds.filter((x) => x !== c.id) });
          store.remove('categories', c.id);
        }
        const tone = e.target.closest('[data-tone]');
        if (tone) {
          const t = store.get('tags', tone.dataset.tone);
          store.update('tags', t.id, { tone: TAG_TONES[(TAG_TONES.indexOf(t.tone) + 1) % TAG_TONES.length] });
        }
        const td = e.target.closest('[data-tag-del]');
        if (td) {
          const t = store.get('tags', td.dataset.tagDel);
          const used = store.all('recipes').filter((r) => r.tagIds?.includes(t.id)).length;
          if (used && !(await confirmDialog({ title: 'Tag löschen?', text: `„${t.name}“ wird bei ${used} Rezepten entfernt.` }))) return;
          for (const r of store.all('recipes').filter((x) => x.tagIds?.includes(t.id))) store.update('recipes', r.id, { tagIds: r.tagIds.filter((x) => x !== t.id) });
          store.remove('tags', t.id);
        }
        const ai = e.target.closest('[data-aisle]');
        if (ai) {
          const i = Number(ai.dataset.aisle);
          const j = i + Number(ai.dataset.dir);
          const list = [...order];
          [list[i], list[j]] = [list[j], list[i]];
          store.setSettings({ aisleOrder: list });
        }
        const sd = e.target.closest('[data-staple-del]');
        if (sd) store.remove('staples', sd.dataset.stapleDel);
      });
    },
  };
}
