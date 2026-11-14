// „Zutaten prüfen“: alle Zutaten, die die App keiner Abteilung sicher zuordnen kann, auf einen Blick.
import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc } from '../ui.js';
import { collectUnsure } from '../model.js';
import { shopOptions } from '../actions.js';
import { askAisle } from '../aisle-ask.js';

export const unsureList = (recipeIds = null) => collectUnsure({
  recipes: store.all('recipes'), catalog: store.all('catalog'), shoppingItems: store.all('shoppingItems'), options: shopOptions(), recipeIds,
});

export function ingredientsView({ query, rerender }) {
  const only = query.rezept ? store.get('recipes', query.rezept) : null;
  const list = unsureList(only ? [only.id] : null);
  const where = (u) => {
    const titles = u.recipeIds.map((id) => store.get('recipes', id)?.title).filter(Boolean);
    const parts = [];
    if (titles.length) parts.push(titles.length === 1 ? titles[0] : `${titles.length} Rezepte`);
    if (u.onList) parts.push('Einkaufsliste');
    return parts.join(' · ');
  };

  const html = `
    <header class="page-head">
      <div><p class="eyebrow">Mehr</p><h1>Zutaten prüfen</h1></div>
      <a class="btn ghost" href="${only ? `#/rezept/${only.id}` : '#/mehr'}">${icon('chevronLeft')} Zurück</a>
    </header>
    <p class="muted">Bei diesen Zutaten ist sich die App nicht sicher, in welcher Abteilung sie stehen${only ? ` (Rezept „${esc(only.title)}“)` : ''}. Einmal antippen und zuordnen – die Wahl gilt für alle und für ähnliche Namen.</p>
    ${list.length ? `<section class="card settings"><ul class="edit-list unsure-list">${list.map((u) => `<li>
      <button type="button" class="unsure-row" data-ask="${esc(u.name)}" data-unit="${esc(u.unit || '')}">
        <span class="unsure-btn static" aria-hidden="true">!</span>
        <span class="grow"><b>${esc(u.name)}</b><em class="muted small">${esc(where(u))}</em></span>
        <span class="aisle-chip">${esc(u.aisle)}?</span>${icon('chevronRight')}
      </button></li>`).join('')}</ul></section>` : `
      <div class="empty">${icon('check')}<p>Alles einsortiert – bei keiner Zutat ist die App unsicher.</p></div>`}`;

  return {
    title: 'Zutaten prüfen',
    html,
    mount(root) {
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ask]');
        if (b) askAisle(b.dataset.ask, { unit: b.dataset.unit, onDone: rerender });
      });
    },
  };
}
