// Abläufe, die von mehreren Ansichten aus gestartet werden: einplanen, vormerken, Einkaufsliste füllen.
import { store, uid } from './store.js';
import { icon } from './icons.js';
import { esc, openDialog, toast, photoHtml, todayIso } from './ui.js';
import { MEAL_SLOTS } from './seed.js';
import {
  startOfPeriod, addDays, periodDates, weekdayShort, parseISODate, buildShoppingList, mergeGeneratedItems,
  resolveIngredient, nextFreeDay, formatDayLong, normalizeName,
} from './model.js';

export const slotLabel = (id) => MEAL_SLOTS.find((s) => s.id === id)?.label || '';
export const activeSlots = () => MEAL_SLOTS.filter((s) => store.settings().mealSlots.includes(s.id));
export const defaultSlot = () => (store.settings().mealSlots.includes('dinner') ? 'dinner' : store.settings().mealSlots[0]);

// Planungszeitraum aus den Einstellungen, z. B. Freitag + 8 Tage. Er wiederholt sich wöchentlich.
export function planSettings() {
  const s = store.settings();
  return { startDay: s.planStartDay ?? 0, length: s.planLength ?? 7 };
}

export function periodStartFor(which) {
  const start = startOfPeriod(new Date(), planSettings().startDay);
  return which === 'next' ? addDays(start, 7) : start;
}

export function periodDatesFor(which) {
  return periodDates(periodStartFor(which), planSettings().length);
}

function entryTitle(e) {
  if (e.recipeId) return store.get('recipes', e.recipeId)?.title || 'Gelöschtes Rezept';
  return e.note;
}

// Dialog „In Wochenplan“: Woche wählen, Tag antippen – oder auf den Merkzettel legen.
export function openPlanDialog({ recipeId = null, note = '', servings = null, inboxId = null, entryId = null }) {
  let which = 'this';
  let slot = defaultSlot();
  const recipe = recipeId ? store.get('recipes', recipeId) : null;
  const title = recipe ? recipe.title : note;
  const today = todayIso();

  const daysHtml = () => {
    return periodDatesFor(which).map((d) => {
      const taken = store.all('mealPlan').filter((e) => e.date === d && e.slot === slot && e.id !== entryId);
      const past = d < today;
      return `<button type="button" class="day-pick${past ? ' past' : ''}${d === today ? ' today' : ''}" data-date="${d}">
        <span class="dp-day">${weekdayShort(d)}</span><span class="dp-date mono">${parseISODate(d).getDate()}.</span>
        <span class="dp-taken">${taken.length ? esc(taken.map(entryTitle).join(', ')) : 'frei'}</span></button>`;
    }).join('');
  };

  openDialog({
    title: entryId ? 'Auf anderen Tag legen' : 'In den Wochenplan',
    body: `
      <p class="sheet-lead">${esc(title)}</p>
      <div class="segment" role="tablist">
        <button type="button" class="active" data-week="this">Diese Woche</button>
        <button type="button" data-week="next">Nächste Woche</button>
      </div>
      ${activeSlots().length > 1 ? `<div class="chip-scroll">${activeSlots().map((s) => `<button type="button" class="chip${s.id === slot ? ' active' : ''}" data-slot="${s.id}">${s.label}</button>`).join('')}</div>` : ''}
      <div class="day-grid" data-days>${daysHtml()}</div>
      ${entryId ? '' : `<button type="button" class="btn ghost full" data-inbox>${icon('inbox')} Nur vormerken (Merkzettel)</button>`}`,
    mount(dlg, close) {
      const refresh = () => { dlg.querySelector('[data-days]').innerHTML = daysHtml(); };
      dlg.addEventListener('click', (e) => {
        const w = e.target.closest('[data-week]');
        if (w) {
          which = w.dataset.week;
          dlg.querySelectorAll('[data-week]').forEach((b) => b.classList.toggle('active', b === w));
          refresh();
        }
        const s = e.target.closest('[data-slot]');
        if (s) {
          slot = s.dataset.slot;
          dlg.querySelectorAll('[data-slot]').forEach((b) => b.classList.toggle('active', b === s));
          refresh();
        }
        const d = e.target.closest('[data-date]');
        if (d) {
          if (entryId) store.update('mealPlan', entryId, { date: d.dataset.date, slot });
          else {
            store.add('mealPlan', { date: d.dataset.date, slot, recipeId, note, servings: servings || recipe?.servings || null, cooked: false });
            if (inboxId) store.remove('planInbox', inboxId);
          }
          toast(`${title} → ${formatDayLong(d.dataset.date)}`);
          close();
        }
        if (e.target.closest('[data-inbox]')) {
          store.add('planInbox', { recipeId, note, servings: servings || recipe?.servings || null });
          toast(`${title} vorgemerkt`);
          close();
        }
      });
    },
  });
}

// Merkzettel-Eintrag auf den nächsten freien Tag der nächsten Woche legen.
export function activateInbox(inboxId) {
  const item = store.get('planInbox', inboxId);
  if (!item) return;
  const slot = defaultSlot();
  const today = todayIso();
  const date = nextFreeDay(periodDatesFor('next').filter((d) => d >= today), store.all('mealPlan'), slot);
  if (!date) { toast('Nächste Woche ist schon voll – Tag bitte selbst wählen.'); openPlanDialog({ ...item, inboxId }); return; }
  store.add('mealPlan', { date, slot, recipeId: item.recipeId, note: item.note, servings: item.servings, cooked: false });
  store.remove('planInbox', inboxId);
  toast(`${entryTitle(item)} → ${formatDayLong(date)}`);
}

// Rezeptauswahl (für einen leeren Tag oder den Merkzettel) mit Suche und Notiz-Alternative.
// Mit `suggestInbox` stehen die Merkzettel-Ideen oben; gewählte Ideen verlassen den Merkzettel.
export function openRecipePicker({ title, onPick, suggestInbox = false }) {
  const inbox = suggestInbox ? store.all('planInbox') : [];
  const inboxHtml = inbox.length ? `
    <div class="pick-group"><span class="label">${icon('inbox')} Vom Merkzettel</span>
      ${inbox.map((item) => {
        const r = item.recipeId ? store.get('recipes', item.recipeId) : null;
        return `<button type="button" class="pick-row suggested" data-inbox-pick="${item.id}">
          ${r ? photoHtml(r, 'pick-thumb') : `<span class="pick-thumb note-thumb">${icon('note')}</span>`}
          <span class="pick-title">${esc(entryTitle(item))}</span>${icon('plus')}
        </button>`;
      }).join('')}
    </div>` : '';
  const list = (q) => {
    const n = normalizeName(q);
    const recipes = store.all('recipes')
      .filter((r) => !n || normalizeName(r.title).includes(n))
      .sort((a, b) => a.title.localeCompare(b.title, 'de'));
    if (!recipes.length) return '<p class="muted small">Kein Rezept gefunden.</p>';
    return recipes.map((r) => `
      <button type="button" class="pick-row" data-pick="${r.id}">
        ${photoHtml(r, 'pick-thumb')}<span class="pick-title">${esc(r.title)}</span>${icon('chevronRight')}
      </button>`).join('');
  };
  openDialog({
    title,
    body: `
      ${inboxHtml}
      <form class="inline-form" data-note-form>
        <input id="pickNote" type="text" placeholder="Freie Notiz, z. B. „Reste“ oder „Essen gehen“" autocomplete="off">
        <button class="btn" type="submit">${icon('note')} Notiz</button>
      </form>
      <div class="search small"><span class="search-ic">${icon('search')}</span><input type="search" id="pickSearch" placeholder="Rezept suchen" autocomplete="off"></div>
      <div class="pick-list" data-list>${list('')}</div>`,
    mount(dlg, close) {
      dlg.querySelector('#pickSearch').addEventListener('input', (e) => { dlg.querySelector('[data-list]').innerHTML = list(e.target.value); });
      dlg.querySelector('[data-note-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const note = dlg.querySelector('#pickNote').value.trim();
        if (!note) return;
        onPick({ recipeId: null, note });
        close();
      });
      dlg.addEventListener('click', (e) => {
        const ip = e.target.closest('[data-inbox-pick]');
        if (ip) {
          const item = store.get('planInbox', ip.dataset.inboxPick);
          onPick({ recipeId: item.recipeId, note: item.note, servings: item.servings });
          store.remove('planInbox', item.id);
          close();
          return;
        }
        const p = e.target.closest('[data-pick]');
        if (!p) return;
        const r = store.get('recipes', p.dataset.pick);
        onPick({ recipeId: r.id, note: '', servings: r.servings });
        close();
      });
    },
  });
}

// Einkaufsliste aus den geplanten Gerichten einer Woche (neu) erzeugen.
export function generateShoppingList(which) {
  const dates = periodDatesFor(which);
  const entries = store.all('mealPlan').filter((e) => dates.includes(e.date));
  const generated = buildShoppingList({ entries, recipes: store.all('recipes'), catalog: store.all('catalog') });
  const merged = mergeGeneratedItems(store.all('shoppingItems'), generated, uid);
  store.setAll('shoppingItems', merged);
  store.setSettings({ listGeneratedFor: dates[0] });
  return generated.length;
}

// Zutaten eines einzelnen Rezepts (mit gewählten Portionen) auf die Liste setzen.
export function addRecipeToShopping(recipe, servings) {
  const generated = buildShoppingList({ entries: [{ recipeId: recipe.id, servings }], recipes: [recipe], catalog: store.all('catalog') });
  store.setAll('shoppingItems', [...store.all('shoppingItems'), ...generated.map((g) => ({ ...g, id: uid(), source: 'recipe', checked: false }))]);
  return generated.length;
}

// Freien Artikel hinzufügen; Abteilung kommt aus dem Katalog (wird dort gelernt).
// Steht die Zutat schon unter „Wahrscheinlich schon da“, wird sie stattdessen auf die Liste geholt.
export function addShoppingItem({ name, amountText = '' }) {
  const { key, entry } = resolveIngredient(name, store.all('catalog'));
  const open = store.all('shoppingItems').filter((i) => i.key === key && !i.checked);
  if (open.length && !amountText) {
    store.setAll('shoppingItems', store.all('shoppingItems').map((i) => (open.includes(i) ? { ...i, needed: true } : i)));
    toast(`${open[0].name} steht auf der Liste`);
    return;
  }
  store.add('shoppingItems', {
    key, name: entry ? entry.name : name, amountText, aisle: entry?.aisle || 'Sonstiges',
    source: 'manual', checked: false, needed: true, fromRecipeIds: [],
  });
}

// Standard-Einkauf mit gewählter Menge auf die Liste setzen (oder die Menge ändern).
export function setStapleOnList(staple, amountText) {
  const { key, entry } = resolveIngredient(staple.name, store.all('catalog'));
  const own = store.all('shoppingItems').find((i) => i.key === key && !i.checked && i.source === 'staple');
  if (own) store.update('shoppingItems', own.id, { amountText, needed: true });
  else {
    store.add('shoppingItems', {
      key, name: staple.name, amountText, aisle: staple.aisle || entry?.aisle || 'Sonstiges',
      source: 'staple', checked: false, needed: true, fromRecipeIds: [],
    });
  }
}

// Abteilung für eine Zutat merken, damit sie beim nächsten Mal richtig einsortiert wird.
export function learnAisle(name, aisle) {
  const catalog = store.all('catalog');
  const { entry } = resolveIngredient(name, catalog);
  if (entry) store.update('catalog', entry.id, { aisle });
  else store.add('catalog', { name, aisle, synonyms: [], basic: false });
}

export function markCooked(recipeId, entryId = null) {
  store.update('recipes', recipeId, { lastCookedAt: Date.now() });
  if (entryId) store.update('mealPlan', entryId, { cooked: true });
}

export { entryTitle };
