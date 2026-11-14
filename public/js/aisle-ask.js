// „Wo steht das im Supermarkt?“ – Nachfrage bei Zutaten, die die App nicht sicher einordnen kann.
import { store } from './store.js';
import { icon } from './icons.js';
import { esc, openDialog, toast } from './ui.js';
import { AISLES } from './seed.js';
import { classifyIngredient, collectUnsure } from './model.js';
import { confirmAisle, shopOptions } from './actions.js';
import { navigate } from './main.js';

export const classify = (name, unit = '') => classifyIngredient(name, unit, store.all('catalog'), shopOptions());

// Fenster mit den Abteilungen des Haushalts. Vorausgewählt ist die Vermutung der App.
export function askAisle(name, { unit = '', onDone = () => {} } = {}) {
  const guess = classify(name, unit);
  const aisles = store.settings().aisleOrder || AISLES;
  let chosen = guess.aisle;
  let basic = guess.basic;
  openDialog({
    title: 'Wo steht das im Supermarkt?',
    body: `
      <p class="sheet-lead"><b>${esc(name)}</b></p>
      <p class="muted small">${guess.sure ? 'Die App vermutet:' : 'Die App ist unsicher. Vermutung:'} <b>${esc(guess.aisle)}</b>. Eure Wahl gilt für alle und wird gemerkt – auch für Varianten wie „frische …“.</p>
      <div class="chip-wrap" data-aisles>${aisles.map((a) => `<button type="button" class="chip${a === chosen ? ' active' : ''}" data-pick="${esc(a)}" aria-pressed="${a === chosen}">${esc(a)}</button>`).join('')}</div>
      <label class="check-row"><input type="checkbox" data-basic${basic ? ' checked' : ''}> Haben wir meistens zu Hause (Grundvorrat)</label>
      <div class="sheet-actions"><button type="button" class="btn ghost" data-close>Später</button>
        <button type="button" class="btn primary" data-save>${chosen === guess.aisle ? 'Passt so' : 'Merken'}</button></div>`,
    mount(dlg, close) {
      const label = () => { dlg.querySelector('[data-save]').textContent = chosen === guess.aisle ? 'Passt so' : 'Merken'; };
      dlg.querySelector('[data-aisles]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        chosen = b.dataset.pick;
        dlg.querySelectorAll('[data-pick]').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b); });
        label();
      });
      dlg.querySelector('[data-basic]').addEventListener('change', (e) => { basic = e.target.checked; });
      dlg.querySelector('[data-save]').addEventListener('click', () => {
        confirmAisle(name, chosen, basic);
        toast(`${name}: ${chosen}`);
        close();
        onDone();
      });
    },
  });
}

// Nach Import oder Speichern: Hinweis, wenn neue Rezepte Zutaten enthalten, die die App nicht einordnen kann.
export function hintUnsure(recipeIds) {
  const unsure = collectUnsure({ recipes: store.all('recipes'), catalog: store.all('catalog'), options: shopOptions(), recipeIds, withList: false });
  if (!unsure.length) return;
  const one = recipeIds.length === 1 ? `?rezept=${recipeIds[0]}` : '';
  toast(`${unsure.length} ${unsure.length === 1 ? 'Zutat ist' : 'Zutaten sind'} noch keiner Abteilung zugeordnet`, { label: 'Klären', run: () => navigate(`zutaten${one}`) });
}

// Kleines rotes Ausrufezeichen hinter einer unklaren Zutat.
export const unsureButton = (name, unit = '') => `<button type="button" class="unsure-btn" data-ask="${esc(name)}" data-unit="${esc(unit)}" aria-label="Abteilung unklar: ${esc(name)} – antippen zum Klären" title="Abteilung unklar – antippen zum Klären">!</button>`;
