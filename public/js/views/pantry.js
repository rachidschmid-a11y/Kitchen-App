// Vorrat: was zu Hause ist, wo es liegt und was bald weg muss.
import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, openDialog, todayIso, toast } from '../ui.js';
import { LOCATIONS } from '../seed.js';
import { pantryStatus } from '../model.js';

let filter = null;

export function pantryView({ rerender }) {
  const today = todayIso();
  const all = store.all('pantry').map((p) => ({ ...p, status: pantryStatus(p, today) }));
  const soon = all.filter((p) => p.status.soon).sort((a, b) => (a.status.days ?? 99) - (b.status.days ?? 99));
  const shown = filter ? all.filter((p) => p.location === filter) : all;

  const row = (p) => {
    const s = p.status;
    const chip = s.label ? `<span class="exp-chip${s.urgent ? ' urgent' : s.soon ? ' soon' : ''} mono">${esc(s.label)}</span>` : '';
    return `<li class="pantry-item">
      <button type="button" class="pantry-main" data-edit="${p.id}">
        <span class="pantry-name">${esc(p.name)}</span>${p.amount ? `<span class="pantry-amount mono">${esc(p.amount)}</span>` : ''}
      </button>
      ${chip}
      <button type="button" class="icon-btn bookmark${p.useSoon ? ' on' : ''}" data-flag="${p.id}" aria-pressed="${!!p.useSoon}" aria-label="Bald verbrauchen markieren" title="Bald verbrauchen">${icon('bookmark')}</button>
    </li>`;
  };

  const html = `
    <header class="page-head">
      <div><p class="eyebrow">Vorrat</p><h1>${all.length} Lebensmittel zu Hause</h1></div>
      <button type="button" class="round-btn" data-add aria-label="Lebensmittel hinzufügen">${icon('plus')}</button>
    </header>

    ${soon.length ? `<section class="soon-box">
      <div class="soon-head">${icon('leaf')}<h2>Bald verbrauchen</h2></div>
      <div class="chip-wrap">${soon.map((p) => `<span class="soon-chip${p.status.urgent ? ' urgent' : ''}">${esc(p.name)}<em>${p.status.label || 'markiert'}</em></span>`).join('')}</div>
      <a class="btn primary" href="#/rezepte?passend=1">${icon('book')} Passende Rezepte finden</a>
    </section>` : ''}

    <div class="chip-scroll">
      <button type="button" class="chip${!filter ? ' active' : ''}" data-loc="">Alle <span class="mono">${all.length}</span></button>
      ${LOCATIONS.map((l) => `<button type="button" class="chip${filter === l ? ' active' : ''}" data-loc="${l}">${l} <span class="mono">${all.filter((p) => p.location === l).length}</span></button>`).join('')}
    </div>

    ${shown.length ? LOCATIONS.filter((l) => shown.some((p) => p.location === l)).map((l) => `
      <section class="card">
        <div class="card-head"><h2>${l}</h2></div>
        <ul class="pantry-list">${shown.filter((p) => p.location === l).sort((a, b) => (a.status.days ?? 999) - (b.status.days ?? 999) || a.name.localeCompare(b.name, 'de')).map(row).join('')}</ul>
      </section>`).join('') : `<div class="empty">${icon('box')}<p>Hier ist noch nichts eingetragen.</p></div>`}`;

  return {
    title: 'Vorrat',
    html,
    mount(root) {
      root.addEventListener('click', (e) => {
        const loc = e.target.closest('[data-loc]');
        if (loc) { filter = loc.dataset.loc || null; rerender(); }
        const flag = e.target.closest('[data-flag]');
        if (flag) { const p = store.get('pantry', flag.dataset.flag); store.update('pantry', p.id, { useSoon: !p.useSoon }); }
        const ed = e.target.closest('[data-edit]');
        if (ed) editItem(ed.dataset.edit);
        if (e.target.closest('[data-add]')) editItem(null);
      });
    },
  };
}

function editItem(id) {
  const p = id ? store.get('pantry', id) : { name: '', amount: '', location: filter || 'Kühlschrank', expiresAt: '', useSoon: false };
  openDialog({
    title: id ? 'Lebensmittel bearbeiten' : 'Lebensmittel hinzufügen',
    body: `<form class="stack" data-form>
      <label class="field"><span>Name</span><input name="name" id="pName" value="${esc(p.name)}" required placeholder="z. B. Joghurt"></label>
      <div class="field-row">
        <label class="field"><span>Menge <em>optional</em></span><input name="amount" value="${esc(p.amount)}" placeholder="z. B. 500 g"></label>
        <label class="field"><span>Haltbar bis <em>optional</em></span><input name="expiresAt" type="date" value="${esc(p.expiresAt || '')}"></label>
      </div>
      <div class="field"><span>Ort</span><div class="segment">${LOCATIONS.map((l) => `<label class="seg-opt"><input type="radio" name="location" value="${l}"${p.location === l ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <label class="check-row"><input type="checkbox" name="useSoon"${p.useSoon ? ' checked' : ''}> Bald verbrauchen</label>
      <div class="sheet-actions">
        ${id ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Aufgebraucht</button>` : ''}
        <button type="submit" class="btn primary">Speichern</button>
      </div></form>`,
    mount(dlg, close) {
      if (!id) dlg.querySelector('#pName').focus();
      dlg.querySelector('[data-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const name = String(f.get('name')).trim();
        if (!name) return;
        const doc = { name, amount: String(f.get('amount')).trim(), expiresAt: f.get('expiresAt') || null, location: f.get('location') || 'Kühlschrank', useSoon: f.get('useSoon') === 'on' };
        if (id) store.update('pantry', id, doc);
        else { store.add('pantry', doc); toast(`${name} im Vorrat`); }
        close();
      });
      dlg.querySelector('[data-del]')?.addEventListener('click', () => {
        const old = store.get('pantry', id);
        store.remove('pantry', id);
        toast(`${old.name} entfernt`, { label: 'Rückgängig', run: () => store.add('pantry', old) });
        close();
      });
    },
  });
}
