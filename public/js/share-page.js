// Öffentliche Ansicht eines geteilten Rezepts: nur dieses eine Rezept, Portionen umrechnen, als PDF speichern.
// Greift bewusst nicht auf die gespeicherten Daten der App zu.
import { decodeRecipe } from './share.js';
import { groupBySection, formatQuantity } from './model.js';
import { icon } from './icons.js';

const root = document.getElementById('share');
const params = new URLSearchParams(location.hash.slice(1));
let recipe = null;
let servings = 1;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const minutes = (m) => (!m ? '–' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

function render() {
  const factor = servings / (recipe.servings || 1);
  const isUrl = /^https?:\/\//.test(recipe.source);
  root.innerHTML = `
    <p class="share-brand">${icon('pot')} ${recipe.from ? `Geteilt aus „${esc(recipe.from)}“` : 'Geteiltes Rezept'}</p>
    <article class="card detail-card share-card">
      ${recipe.categories.length ? `<p class="eyebrow">${esc(recipe.categories.join(' · '))}</p>` : ''}
      <h1 class="detail-title">${esc(recipe.title)}</h1>
      ${recipe.tags.length ? `<div class="tag-row">${recipe.tags.map((t) => `<span class="tag tone-teal">${esc(t)}</span>`).join('')}</div>` : ''}
      ${recipe.description ? `<p class="detail-desc">${esc(recipe.description)}</p>` : ''}
      <div class="info-tiles">
        <div class="info-tile"><span class="label">Portionen</span>
          <div class="stepper">
            <button type="button" class="no-print" data-serv="-1" aria-label="Weniger Portionen" ${servings <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
            <b class="mono">${servings}</b>
            <button type="button" class="no-print" data-serv="1" aria-label="Mehr Portionen">${icon('plus')}</button>
          </div></div>
        <div class="info-tile"><span class="label">Vorbereiten</span><b class="mono">${minutes(recipe.prepMin)}</b></div>
        <div class="info-tile"><span class="label">Kochen/Backen</span><b class="mono">${minutes(recipe.cookMin)}</b></div>
      </div>
    </article>
    <div class="detail-cols">
      <section class="card">
        <div class="card-head"><h2>Zutaten</h2></div>
        ${groupBySection(recipe.ingredients).map((g) => `
          ${g.name ? `<h3 class="ing-section">${esc(g.name)}</h3>` : ''}
          <ul class="ing-list">${g.items.map((i) => `<li class="ing">
            <span class="ing-qty mono">${esc(formatQuantity(i.amount, i.unit, i.amountMax, factor))}</span>
            <span class="ing-name">${esc(i.name)}${i.note ? `<span class="ing-note">, ${esc(i.note)}</span>` : ''}</span></li>`).join('')}</ul>`).join('')}
      </section>
      <section class="card">
        <div class="card-head"><h2>Zubereitung</h2></div>
        <ol class="steps">${recipe.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </section>
    </div>
    ${recipe.notes ? `<aside class="note-box">${icon('note')}<div><b>Notizen</b><p class="note-text">${esc(recipe.notes)}</p></div></aside>` : ''}
    ${recipe.source ? `<p class="source">${icon('link')} Quelle: ${isUrl ? `<a href="${esc(recipe.source)}" rel="noopener">${esc(recipe.source)}</a>` : esc(recipe.source)}</p>` : ''}
    <div class="share-actions no-print">
      <button type="button" class="btn primary" data-pdf>${icon('download')} Als PDF speichern</button>
      <button type="button" class="btn" data-copy>${icon('link')} Link kopieren</button>
    </div>
    <p class="muted small no-print">Tipp: Im Druckfenster als Ziel „Als PDF speichern“ wählen.</p>`;
}

function showError() {
  root.innerHTML = `<div class="empty">${icon('book')}<p>Dieser Rezept-Link ist unvollständig oder beschädigt.<br>Bitte lass ihn dir noch einmal schicken.</p></div>`;
}

root.addEventListener('click', async (e) => {
  const s = e.target.closest('[data-serv]');
  if (s) { servings = Math.max(1, servings + Number(s.dataset.serv)); render(); }
  if (e.target.closest('[data-pdf]')) window.print();
  if (e.target.closest('[data-copy]')) {
    const url = location.href.replace(/&druck=1/, '');
    try { await navigator.clipboard.writeText(url); e.target.closest('[data-copy]').innerHTML = `${icon('check')} Kopiert`; } catch (err) { prompt('Link kopieren:', url); }
  }
});

(async () => {
  try {
    recipe = await decodeRecipe(params.get('r') || '');
  } catch (err) {
    showError();
    return;
  }
  servings = recipe.servings || 1;
  document.title = `${recipe.title} – Rezept`;
  render();
  if (params.get('druck') === '1') {
    await document.fonts?.ready;
    setTimeout(() => window.print(), 150);
  }
})();
