// Rezept-Übersicht: Suche, Kategorie- und Tag-Filter, Kachel-Raster.
import { store } from '../store.js';
import { me } from '../members.js';
import { icon } from '../icons.js';
import { esc, deNum, photoHtml, tagsById, minutesLabel, todayIso } from '../ui.js';
import { filterRecipes, totalMinutes, pantryStatus, matchRecipesToItems, ingredientMatches } from '../model.js';

// Worin gesucht wird, merkt sich jedes Gerät.
const SEARCH_KEY = 'rezepte-app/suche-in';
const SEARCH_MODES = [['all', 'Name & Zutaten', 'Rezept oder Zutat suchen'], ['name', 'Name', 'Rezeptname suchen'], ['ingredients', 'Zutaten', 'Zutat suchen, z. B. Feta, Paprika']];
const savedMode = (() => { try { return localStorage.getItem(SEARCH_KEY); } catch (e) { return null; } })();

const filters = { q: '', searchIn: SEARCH_MODES.some(([m]) => m === savedMode) ? savedMode : 'all', categoryId: null, tagIds: [], favorites: false, sort: 'name' };

const SORTS = [['name', 'Name'], ['recent', 'Zuletzt gekocht'], ['rating', 'Bewertung'], ['time', 'Schnellste'], ['new', 'Neueste']];

function tile(r, matches) {
  const time = totalMinutes(r);
  const meta = [time ? minutesLabel(time) : '', r.rating ? `★ ${deNum(r.rating)}` : ''].filter(Boolean).join(' · ');
  return `
    <a class="tile" href="#/rezept/${r.id}">
      <div class="tile-photo">${photoHtml(r)}${r.favorite ? `<span class="tile-fav" aria-label="Favorit">${icon('heart')}</span>` : ''}</div>
      <div class="tile-body">
        <h3>${esc(r.title)}</h3>
        ${meta ? `<p class="tile-meta mono">${meta}</p>` : ''}
        ${matches ? `<p class="tile-match">${icon('leaf')} ${esc(matches.join(', '))}</p>`
          : `<div class="tile-tags">${tagsById(r.tagIds).slice(0, 3).map((t) => `<span class="tile-tag tone-${t.tone}">${esc(t.name)}</span>`).join('')}</div>`}
      </div>
    </a>`;
}

export function recipesView({ query, rerender }) {
  const passend = query.passend === '1';
  const categories = [...store.all('categories')].sort((a, b) => a.order - b.order);
  const tags = store.all('tags');
  const today = todayIso();
  const soonItems = store.all('pantry').filter((p) => pantryStatus(p, today).soon);

  let list;
  let matchMap = null;
  if (passend) {
    const matches = matchRecipesToItems(store.all('recipes'), soonItems, store.all('catalog'));
    matchMap = new Map(matches.map((m) => [m.recipe.id, m.matches]));
    list = matches.map((m) => m.recipe);
  } else {
    list = filterRecipes(store.all('recipes'), filters);
    // Bei der Zutatensuche zeigt jede Kachel, welche Zutaten gefunden wurden.
    if (filters.searchIn === 'ingredients' && filters.q.trim()) matchMap = new Map(list.map((r) => [r.id, ingredientMatches(r, filters.q)]));
  }
  const hasFilter = filters.q || filters.categoryId || filters.tagIds.length || filters.favorites;

  const html = `
    <header class="page-head">
      <div><p class="eyebrow">${me() ? `Hallo ${esc(me().name)} · ` : ''}${esc(store.settings().householdName)}</p><h1>Rezepte</h1></div>
      <div class="head-actions">
        <a class="btn" href="#/import">${icon('sparkle')} Importieren</a>
        <a class="round-btn" href="#/neu" aria-label="Neues Rezept">${icon('plus')}</a>
      </div>
    </header>

    ${passend ? `
      <div class="banner gold">
        ${icon('leaf')}<div><b>Passt zu dem, was bald weg muss</b><span>${esc(soonItems.map((p) => p.name).join(', '))}</span></div>
        <a class="icon-btn" href="#/rezepte" aria-label="Filter aufheben">${icon('x')}</a>
      </div>` : `
      <div class="search"><span class="search-ic">${icon('search')}</span>
        <input id="recipeSearch" type="search" placeholder="${SEARCH_MODES.find(([m]) => m === filters.searchIn)[2]}" value="${esc(filters.q)}" autocomplete="off" aria-describedby="searchIn"></div>
      <div class="segment compact search-in" id="searchIn" role="radiogroup" aria-label="Suchen in">
        ${SEARCH_MODES.map(([m, label]) => `<button type="button" role="radio" class="${filters.searchIn === m ? 'active' : ''}" aria-checked="${filters.searchIn === m}" data-search-in="${m}">${label}</button>`).join('')}
      </div>
      <div class="chip-scroll" aria-label="Kategorie">
        <button type="button" class="chip${!filters.categoryId ? ' active' : ''}" data-cat="">Alle</button>
        ${categories.map((c) => `<button type="button" class="chip${filters.categoryId === c.id ? ' active' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}
      </div>
      <div class="chip-scroll" aria-label="Tags">
        <button type="button" class="tag-filter${filters.favorites ? ' active' : ''}" data-fav>${filters.favorites ? icon('check') : icon('heart')} Favoriten</button>
        ${tags.map((t) => {
          const on = filters.tagIds.includes(t.id);
          return `<button type="button" class="tag-filter tone-${t.tone}${on ? ' active' : ''}" data-tag="${t.id}" aria-pressed="${on}">${on ? icon('check') : ''}${esc(t.name)}</button>`;
        }).join('')}
      </div>
      ${soonItems.length ? `
        <a class="soon-card" href="#/rezepte?passend=1">
          <span class="soon-ic">${icon('leaf')}</span>
          <span class="soon-text"><b>Bald verbrauchen</b><span>${esc(soonItems.slice(0, 3).map((p) => p.name).join(', '))}${soonItems.length > 3 ? ` +${soonItems.length - 3}` : ''}</span></span>
          <span class="soon-cta">Passende Rezepte ${icon('arrowRight')}</span>
        </a>` : ''}`}

    <div class="list-head">
      <span class="count mono">${list.length} ${list.length === 1 ? 'Rezept' : 'Rezepte'}</span>
      ${hasFilter && !passend ? '<button type="button" class="link-btn" data-clear>Filter zurücksetzen</button>' : ''}
      ${passend ? '' : `<label class="sort"><span class="sr-only">Sortierung</span>
        <select id="recipeSort">${SORTS.map(([v, l]) => `<option value="${v}"${filters.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`}
    </div>

    ${list.length ? `<div class="recipe-grid">${list.map((r) => tile(r, matchMap?.get(r.id))).join('')}</div>` : `
      <div class="empty">
        ${icon('book')}
        <p>${store.all('recipes').length ? 'Kein Rezept passt zu diesen Filtern.' : 'Noch keine Rezepte. Legt das erste an oder importiert eure Sammlung (Import/rezepte-import.json).'}</p>
        ${store.all('recipes').length ? '' : `<div class="btn-row"><a class="btn primary" href="#/neu">${icon('plus')} Rezept anlegen</a><a class="btn" href="#/import">${icon('sparkle')} Rezept importieren</a><a class="btn" href="#/mehr">${icon('upload')} Sammlung (Datei)</a></div>`}
      </div>`}`;

  return {
    title: 'Rezepte',
    html,
    mount(root) {
      root.querySelector('#recipeSearch')?.addEventListener('input', (e) => { filters.q = e.target.value; rerender(); });
      root.querySelector('#recipeSort')?.addEventListener('change', (e) => { filters.sort = e.target.value; rerender(); });
      root.addEventListener('click', (e) => {
        const cat = e.target.closest('[data-cat]');
        if (cat) { filters.categoryId = cat.dataset.cat || null; rerender(); return; }
        const tag = e.target.closest('[data-tag]');
        if (tag) {
          const id = tag.dataset.tag;
          filters.tagIds = filters.tagIds.includes(id) ? filters.tagIds.filter((t) => t !== id) : [...filters.tagIds, id];
          rerender();
          return;
        }
        const mode = e.target.closest('[data-search-in]');
        if (mode) {
          filters.searchIn = mode.dataset.searchIn;
          try { localStorage.setItem(SEARCH_KEY, filters.searchIn); } catch (err) { /* privates Fenster */ }
          rerender();
          document.getElementById('recipeSearch')?.focus({ preventScroll: true });
          return;
        }
        if (e.target.closest('[data-fav]')) { filters.favorites = !filters.favorites; rerender(); return; }
        if (e.target.closest('[data-clear]')) { Object.assign(filters, { q: '', categoryId: null, tagIds: [], favorites: false }); rerender(); }
      });
    },
  };
}
