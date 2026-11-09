// Wochenplan: aktuelle und nächste Woche, Merkzettel mit „Aktivieren“.
import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, photoHtml, openDialog, toast, todayIso } from '../ui.js';
import { isoWeek, formatPeriod, weekdayShort, parseISODate, formatDayLong } from '../model.js';
import {
  periodStartFor, periodDatesFor, planSettings, activeSlots, openPlanDialog, openRecipePicker, activateInbox, generateShoppingList, entryTitle, markCooked,
} from '../actions.js';
import { navigate } from '../main.js';
import { avatar, members, memberName } from '../members.js';

function entryCard(e, { past }) {
  const r = e.recipeId ? store.get('recipes', e.recipeId) : null;
  if (!r) {
    return `<div class="entry note${e.cooked ? ' cooked' : ''}">
      <span class="entry-ic">${icon('note')}</span><span class="entry-title">${esc(e.note || 'Gelöschtes Rezept')}</span>
      <button type="button" class="icon-btn" data-entry-menu="${e.id}" aria-label="Optionen">${icon('more')}</button></div>`;
  }
  return `<div class="entry${e.cooked ? ' cooked' : ''}">
    <a class="entry-link" href="#/rezept/${r.id}">${photoHtml(r, 'entry-thumb')}
      <span class="entry-text"><span class="entry-title">${esc(r.title)}</span>
      <span class="entry-meta mono">${e.servings || r.servings} Port.${e.cooked ? ' · gekocht' : ''}${members().length > 1 && e.by ? avatar(e.by, 'mini') : ''}</span></span></a>
    <button type="button" class="check-btn${e.cooked ? ' on' : ''}" data-cooked="${e.id}" aria-pressed="${!!e.cooked}" aria-label="Gekocht" title="${past || e.cooked ? 'Gekocht' : 'Als gekocht markieren'}">${icon('check')}</button>
    <button type="button" class="icon-btn" data-entry-menu="${e.id}" aria-label="Optionen">${icon('more')}</button>
  </div>`;
}

function inboxCard(item) {
  const r = item.recipeId ? store.get('recipes', item.recipeId) : null;
  return `<div class="inbox-item${r ? '' : ' note'}">
    ${r ? photoHtml(r, 'entry-thumb') : `<span class="entry-ic">${icon('note')}</span>`}
    <span class="entry-title">${esc(r ? r.title : item.note)}</span>
    <button type="button" class="btn small primary" data-activate="${item.id}">Aktivieren</button>
    <button type="button" class="icon-btn" data-inbox-menu="${item.id}" aria-label="Optionen">${icon('more')}</button>
  </div>`;
}

export function planView({ params }) {
  const which = params[0] === 'naechste' ? 'next' : 'this';
  const start = periodStartFor(which);
  const dates = periodDatesFor(which);
  const { startDay, length } = planSettings();
  const today = todayIso();
  const slots = activeSlots();
  const entries = store.all('mealPlan').filter((e) => dates.includes(e.date));
  const inbox = store.all('planInbox');
  const planned = dates.filter((d) => entries.some((e) => e.date === d)).length;

  const days = dates.map((d) => {
    const isToday = d === today;
    const past = d < today;
    const slotsHtml = slots.map((s) => {
      const list = entries.filter((e) => e.date === d && e.slot === s.id);
      return `<div class="slot">
        ${slots.length > 1 ? `<span class="slot-label">${s.label}</span>` : ''}
        ${list.map((e) => entryCard(e, { past })).join('')}
        ${list.length ? '' : `<button type="button" class="add-entry" data-add="${d}" data-slot="${s.id}">${icon('plus')} Gericht oder Notiz</button>`}
      </div>`;
    }).join('');
    return `<div class="day${isToday ? ' today' : ''}${past ? ' past' : ''}">
      <div class="day-tile"><span>${weekdayShort(d)}</span><b class="mono">${parseISODate(d).getDate()}</b>${isToday ? '<em>Heute</em>' : ''}</div>
      <div class="day-slots">${slotsHtml}</div>
    </div>`;
  }).join('');

  const inboxHtml = `
    <section class="card inbox">
      <div class="card-head"><h2>${icon('inbox')} Merkzettel</h2><span class="muted small">Ideen ohne festen Tag</span></div>
      ${inbox.length ? inbox.map(inboxCard).join('') : '<p class="muted small">Noch nichts vorgemerkt.</p>'}
      <form class="inline-form" data-inbox-form>
        <input id="inboxNote" placeholder="Idee notieren, z. B. „Kürbissuppe“" autocomplete="off">
        <button type="submit" class="btn">${icon('plus')}</button>
        <button type="button" class="btn" data-inbox-recipe>${icon('book')} Rezept</button>
      </form>
    </section>`;

  const html = `
    <header class="page-head">
      <div><p class="eyebrow">Wochenplan · ${startDay === 0 && length === 7 ? `KW ${isoWeek(start)}` : `${length} Tage`}</p><h1>${formatPeriod(start, length)}</h1></div>
      <span class="badge accent mono">${planned} von ${length} geplant</span>
    </header>
    <div class="segment" role="tablist">
      <a href="#/plan" class="${which === 'this' ? 'active' : ''}" role="tab" aria-selected="${which === 'this'}">Diese Woche</a>
      <a href="#/plan/naechste" class="${which === 'next' ? 'active' : ''}" role="tab" aria-selected="${which === 'next'}">Nächste Woche${inbox.length ? ` <span class="seg-count">${inbox.length}</span>` : ''}</a>
    </div>
    ${which === 'next' ? inboxHtml : inbox.length ? `<a class="hint-link" href="#/plan/naechste">${icon('inbox')} ${inbox.length} ${inbox.length === 1 ? 'Idee' : 'Ideen'} auf dem Merkzettel ${icon('arrowRight')}</a>` : ''}
    <div class="days">${days}</div>
    <button type="button" class="btn primary full" data-generate>${icon('cart')} Einkaufsliste aus ${which === 'next' ? 'nächster' : 'dieser'} Woche</button>`;

  return {
    title: 'Wochenplan',
    html,
    mount(root) {
      root.querySelector('[data-inbox-form]')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = root.querySelector('#inboxNote');
        const note = input.value.trim();
        if (!note) return;
        store.add('planInbox', { recipeId: null, note, servings: null });
      });
      root.addEventListener('click', (e) => {
        const add = e.target.closest('[data-add]');
        if (add) {
          openRecipePicker({
            title: formatDayLong(add.dataset.add),
            suggestInbox: true,
            onPick: (pick) => store.add('mealPlan', { date: add.dataset.add, slot: add.dataset.slot, cooked: false, servings: null, ...pick }),
          });
        }
        const cooked = e.target.closest('[data-cooked]');
        if (cooked) {
          const entry = store.get('mealPlan', cooked.dataset.cooked);
          if (entry.cooked) store.update('mealPlan', entry.id, { cooked: false });
          else markCooked(entry.recipeId, entry.id);
        }
        const act = e.target.closest('[data-activate]');
        if (act) activateInbox(act.dataset.activate);
        const em = e.target.closest('[data-entry-menu]');
        if (em) entryMenu(em.dataset.entryMenu);
        const im = e.target.closest('[data-inbox-menu]');
        if (im) inboxMenu(im.dataset.inboxMenu);
        if (e.target.closest('[data-inbox-recipe]')) {
          openRecipePicker({ title: 'Auf den Merkzettel', onPick: (pick) => store.add('planInbox', { servings: null, ...pick }) });
        }
        if (e.target.closest('[data-generate]')) {
          const n = generateShoppingList(which);
          if (!n) { toast('In dieser Woche sind keine offenen Rezepte geplant.'); return; }
          toast(`Einkaufsliste aktualisiert: ${n} Zutaten aus dem Plan`);
          navigate('einkauf');
        }
      });
    },
  };
}

function entryMenu(id) {
  const e = store.get('mealPlan', id);
  if (!e) return;
  const r = e.recipeId ? store.get('recipes', e.recipeId) : null;
  const servings = e.servings || r?.servings || 2;
  openDialog({
    title: entryTitle(e),
    body: `
      <p class="sheet-lead">${formatDayLong(e.date)}${memberName(e.by) ? ` · eingeplant von ${esc(memberName(e.by))}` : ''}</p>
      ${r ? `<div class="setting-row"><span>Portionen</span><div class="stepper">
        <button type="button" data-s="-1" aria-label="Weniger">${icon('minus')}</button><b class="mono" data-sv>${servings}</b>
        <button type="button" data-s="1" aria-label="Mehr">${icon('plus')}</button></div></div>` : ''}
      <div class="menu-list">
        <button type="button" class="menu-row" data-act="move">${icon('move')} Auf anderen Tag legen</button>
        <button type="button" class="menu-row" data-act="inbox">${icon('inbox')} Zurück auf den Merkzettel</button>
        <button type="button" class="menu-row danger" data-act="del">${icon('trash')} Aus dem Plan entfernen</button>
      </div>`,
    mount(dlg, close) {
      let s = servings;
      dlg.addEventListener('click', (ev) => {
        const st = ev.target.closest('[data-s]');
        if (st) {
          s = Math.max(1, s + Number(st.dataset.s));
          dlg.querySelector('[data-sv]').textContent = s;
          store.update('mealPlan', id, { servings: s });
        }
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        close();
        if (act === 'move') openPlanDialog({ recipeId: e.recipeId, note: e.note, entryId: id });
        if (act === 'inbox') { store.add('planInbox', { recipeId: e.recipeId, note: e.note, servings: e.servings }); store.remove('mealPlan', id); }
        if (act === 'del') {
          store.remove('mealPlan', id);
          toast(`${entryTitle(e)} entfernt`, { label: 'Rückgängig', run: () => store.add('mealPlan', e) });
        }
      });
    },
  });
}

function inboxMenu(id) {
  const item = store.get('planInbox', id);
  if (!item) return;
  openDialog({
    title: entryTitle(item),
    body: `<div class="menu-list">
      <button type="button" class="menu-row" data-act="day">${icon('calendar')} Tag selbst wählen</button>
      ${item.recipeId ? `<a class="menu-row" href="#/rezept/${item.recipeId}" data-close>${icon('book')} Rezept ansehen</a>` : ''}
      <button type="button" class="menu-row danger" data-act="del">${icon('trash')} Vom Merkzettel löschen</button>
    </div>`,
    mount(dlg, close) {
      dlg.addEventListener('click', (ev) => {
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        close();
        if (act === 'day') openPlanDialog({ ...item, inboxId: id });
        if (act === 'del') store.remove('planInbox', id);
      });
    },
  });
}
