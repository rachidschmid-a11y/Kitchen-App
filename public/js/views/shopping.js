// Einkaufsliste: nach Abteilungen sortiert, mit Standard-Einkäufen und Vorratsabgleich.
import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, openDialog, toast, confirmDialog } from '../ui.js';
import { AISLES } from '../seed.js';
import { parseIngredientLine, formatQuantity, isInPantry, resolveIngredient, toISODate, combineShoppingItems } from '../model.js';
import { addShoppingItem, setStapleOnList, learnAisle, generateShoppingList, periodStartFor } from '../actions.js';
import { meId, memberName } from '../members.js';

// Abteilung → Lagerort, wenn Gekauftes in den Vorrat wandert.
const AISLE_LOCATION = { 'Kühlregal': 'Kühlschrank', 'Fleisch & Fisch': 'Kühlschrank', 'Tiefkühl': 'Tiefkühler' };

function originText(row) {
  const parts = (row.fromRecipeIds || []).map((id) => store.get('recipes', id)?.title).filter(Boolean);
  if (row.sources.includes('staple')) parts.unshift('Standard');
  if (row.sources.includes('manual')) parts.unshift('manuell');
  return parts.join(', ') || 'Rezept';
}

function ring(done, total) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const frac = total ? done / total : 0;
  return `<div class="ring" role="img" aria-label="${done} von ${total} erledigt">
    <svg viewBox="0 0 54 54"><circle class="ring-track" cx="27" cy="27" r="${r}"/>
    <circle class="ring-bar" cx="27" cy="27" r="${r}" stroke-dasharray="${c * frac} ${c}"/></svg>
    <span class="mono">${done}/${total}</span></div>`;
}

export function shoppingView() {
  const items = store.all('shoppingItems');
  const catalog = store.all('catalog');
  const pantry = store.all('pantry');
  const order = store.settings().aisleOrder || AISLES;
  const staples = store.all('staples');
  // „Aktualisieren“ nimmt die Woche, aus der die Liste zuletzt erzeugt wurde.
  const planWeek = store.settings().listGeneratedFor === toISODate(periodStartFor('next')) ? 'next' : 'this';

  // Gleiche Zutaten aus mehreren Quellen → eine Zeile. Was nur über Rezepte kommt und im Vorrat
  // oder Grundvorrat ist, landet unter „Wahrscheinlich schon da“ – bis man es doch kaufen will.
  // Selbst Hinzugefügtes (Standard-Einkauf, Eingabe) steht immer auf der Liste.
  const rows = combineShoppingItems(items).map((r) => {
    const have = !r.checked && isInPantry(r.key, pantry, catalog);
    const fromRecipesOnly = r.sources.every((s) => s === 'plan' || s === 'recipe');
    return { ...r, have, likely: !r.checked && !r.needed && fromRecipesOnly && (have || r.basic) };
  });
  const done = rows.filter((r) => r.checked).length;
  const aisleRows = rows.filter((r) => !r.likely);
  const likelyRows = rows.filter((r) => r.likely);
  const groups = [...new Set([...order, ...aisleRows.map((r) => r.aisle)])]
    .map((aisle) => ({ aisle, rows: aisleRows.filter((r) => (r.aisle || 'Sonstiges') === aisle) }))
    .filter((g) => g.rows.length);

  const row = (r) => `<li class="shop-item${r.checked ? ' done' : ''}${r.likely ? ' have' : ''}">
      <button type="button" class="checkbox${r.checked ? ' on' : ''}" data-check="${r.ids.join(',')}" aria-pressed="${!!r.checked}" aria-label="${esc(r.name)} abhaken">${icon('check')}</button>
      <button type="button" class="shop-main" data-edit="${r.ids.join(',')}">
        <span class="shop-name">${esc(r.name)}</span>
        <span class="shop-origin">${esc(originText(r))}${r.checked && memberName(r.checkedBy) ? ` · ✓ ${esc(memberName(r.checkedBy))}` : ''}</span>
      </button>
      ${r.likely ? `<span class="badge${r.have ? ' good' : ''}">${r.have ? 'im Vorrat' : 'Grundvorrat'}</span>` : ''}
      ${r.amountText ? `<span class="shop-qty mono">${esc(r.amountText)}</span>` : ''}
      ${r.likely ? `<button type="button" class="btn small need-btn" data-need="${r.ids.join(',')}" aria-label="${esc(r.name)} doch kaufen">${icon('plus')} Kaufen</button>` : ''}
    </li>`;

  const html = `
    <header class="page-head">
      <div><p class="eyebrow">Einkauf</p><h1>Einkaufsliste</h1></div>
      ${rows.length ? ring(done, rows.length) : ''}
    </header>

    <form class="add-bar" data-add-form>
      <input id="shopAdd" placeholder="Artikel hinzufügen, z. B. „2 Gurken“" autocomplete="off" enterkeyhint="done">
      <button type="submit" class="round-btn" aria-label="Hinzufügen">${icon('plus')}</button>
    </form>

    ${staples.length ? `<div class="staples">
      <span class="label">Standard-Einkäufe</span>
      <div class="chip-scroll">${staples.map((s) => {
        const key = resolveIngredient(s.name, catalog).key;
        const own = items.find((i) => i.key === key && !i.checked && i.source === 'staple');
        return `<button type="button" class="chip staple${own ? ' active' : ''}" data-staple="${s.id}">${icon(own ? 'check' : 'plus')}${esc(s.name)}${own?.amountText ? ` <span class="mono">${esc(own.amountText)}</span>` : ''}</button>`;
      }).join('')}</div>
    </div>` : ''}

    ${groups.map((g) => {
      const open = g.rows.filter((r) => !r.checked).length;
      const sorted = [...g.rows].sort((a, b) => a.checked - b.checked || a.name.localeCompare(b.name, 'de'));
      return `<section class="card aisle">
        <div class="card-head"><h2>${esc(g.aisle)}</h2><span class="muted small mono">${open ? `${open} offen` : 'erledigt'}</span></div>
        <ul class="shop-list">${sorted.map(row).join('')}</ul>
      </section>`;
    }).join('')}

    ${likelyRows.length ? `<section class="card aisle likely">
      <div class="card-head"><h2>Wahrscheinlich schon da</h2><span class="muted small">Fehlt etwas? „Kaufen“ holt es auf die Liste.</span></div>
      <ul class="shop-list">${likelyRows.sort((a, b) => a.name.localeCompare(b.name, 'de')).map(row).join('')}</ul>
    </section>` : ''}

    ${rows.length ? '' : `
      <div class="empty">${icon('cart')}<p>Die Liste ist leer.</p>
        <button type="button" class="btn primary" data-generate>${icon('calendar')} Aus dem Wochenplan erstellen</button></div>`}

    ${items.length ? `<div class="shop-actions">
      <button type="button" class="btn" data-generate>${icon('refresh')} Aus ${planWeek === 'next' ? 'nächster' : 'dieser'} Woche aktualisieren</button>
      <button type="button" class="btn" data-to-pantry ${done ? '' : 'disabled'}>${icon('box')} Gekauftes in den Vorrat</button>
      <button type="button" class="btn ghost" data-clear ${done ? '' : 'disabled'}>${icon('trash')} Erledigte entfernen</button>
    </div>` : ''}`;

  return {
    title: 'Einkaufsliste',
    html,
    mount(root) {
      root.querySelector('[data-add-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = root.querySelector('#shopAdd');
        const parsed = parseIngredientLine(input.value);
        if (!parsed) return;
        input.value = '';
        addShoppingItem({ name: parsed.name, amountText: formatQuantity(parsed.amount, parsed.unit, parsed.amountMax) });
      });
      root.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-check]');
        if (c) {
          const ids = c.dataset.check.split(',');
          const checked = !store.get('shoppingItems', ids[0]).checked;
          // Wer hat's im Laden abgehakt? (wie „Erledigt von“ in „Unser Nest“)
          store.setAll('shoppingItems', store.all('shoppingItems').map((i) => (ids.includes(i.id) ? { ...i, checked, checkedBy: checked ? meId() : null } : i)));
        }
        const ed = e.target.closest('[data-edit]');
        if (ed) editItem(ed.dataset.edit.split(','));
        const need = e.target.closest('[data-need]');
        if (need) {
          const ids = need.dataset.need.split(',');
          store.setAll('shoppingItems', store.all('shoppingItems').map((i) => (ids.includes(i.id) ? { ...i, needed: true } : i)));
        }
        const st = e.target.closest('[data-staple]');
        if (st) stapleDialog(store.get('staples', st.dataset.staple));
        if (e.target.closest('[data-generate]')) {
          const n = generateShoppingList(planWeek);
          const label = planWeek === 'next' ? 'nächster Woche' : 'dieser Woche';
          toast(n ? `${n} Zutaten aus ${label}` : `In ${label} sind keine offenen Rezepte geplant.`);
        }
        if (e.target.closest('[data-clear]')) {
          store.setAll('shoppingItems', store.all('shoppingItems').filter((i) => !i.checked));
        }
        if (e.target.closest('[data-to-pantry]')) {
          const bought = store.all('shoppingItems').filter((i) => i.checked);
          const ok = await confirmDialog({ title: 'In den Vorrat übernehmen?', text: `${bought.length} gekaufte Artikel landen im Vorrat und verschwinden von der Liste.`, confirm: 'Übernehmen', danger: false });
          if (!ok) return;
          for (const i of bought) {
            if (!store.all('pantry').some((p) => resolveIngredient(p.name, catalog).key === i.key)) {
              store.add('pantry', { name: i.name, amount: i.amountText, location: AISLE_LOCATION[i.aisle] || 'Speisekammer', expiresAt: null, useSoon: false });
            }
          }
          store.setAll('shoppingItems', store.all('shoppingItems').filter((i) => !i.checked));
          toast(`${bought.length} Artikel im Vorrat`);
        }
      });
    },
  };
}

// Standard-Einkauf antippen → Menge wählen → auf die Liste (oder Menge ändern / wieder entfernen).
function stapleDialog(staple) {
  const key = resolveIngredient(staple.name, store.all('catalog')).key;
  const own = store.all('shoppingItems').find((i) => i.key === key && !i.checked && i.source === 'staple');
  const fromRecipes = store.all('shoppingItems').filter((i) => i.key === key && !i.checked && i.source !== 'staple');
  const amount = own ? own.amountText : staple.defaultAmount || '';
  openDialog({
    title: own ? `${staple.name} auf der Liste` : `${staple.name} hinzufügen?`,
    body: `<form class="stack" data-form>
      ${fromRecipes.length ? `<p class="muted small">Für eure geplanten Rezepte steht ${esc(staple.name)} schon drauf${fromRecipes[0].amountText ? ` (${esc(combineShoppingItems(fromRecipes)[0].amountText)})` : ''}. Die Menge hier kommt dazu.</p>` : ''}
      <label class="field"><span>Menge</span><input name="amount" id="stapleAmount" value="${esc(amount)}" placeholder="z. B. 2 oder 1 l" autocomplete="off"></label>
      <label class="check-row"><input type="checkbox" name="remember"> Als Standardmenge merken</label>
      <div class="sheet-actions">
        ${own ? `<button type="button" class="btn ghost danger-text" data-remove>${icon('trash')} Von der Liste nehmen</button>` : '<button type="button" class="btn ghost" data-close>Abbrechen</button>'}
        <button type="submit" class="btn primary">${icon(own ? 'check' : 'plus')} ${own ? 'Menge ändern' : 'Zur Einkaufsliste'}</button>
      </div></form>`,
    mount(dlg, close) {
      const input = dlg.querySelector('#stapleAmount');
      input.focus();
      input.select();
      dlg.querySelector('[data-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const amountText = String(f.get('amount')).trim();
        if (f.get('remember') === 'on') store.update('staples', staple.id, { defaultAmount: amountText });
        setStapleOnList(staple, amountText);
        toast(`${staple.name}${amountText ? ` (${amountText})` : ''} steht auf der Einkaufsliste`);
        close();
      });
      dlg.querySelector('[data-remove]')?.addEventListener('click', () => { store.remove('shoppingItems', own.id); close(); });
    },
  });
}

// Bearbeitet eine (evtl. zusammengefasste) Zeile. Wird die Menge von Hand geändert, wird daraus ein Artikel.
function editItem(ids) {
  const row = combineShoppingItems(store.all('shoppingItems').filter((i) => ids.includes(i.id)))[0];
  if (!row) return;
  const item = row;
  const order = store.settings().aisleOrder || AISLES;
  openDialog({
    title: 'Artikel bearbeiten',
    body: `<form class="stack" data-form>
      <label class="field"><span>Name</span><input name="name" value="${esc(item.name)}"></label>
      <label class="field"><span>Menge</span><input name="amountText" value="${esc(item.amountText)}" placeholder="z. B. 500 g"></label>
      <label class="field"><span>Abteilung <em>wird für diese Zutat gemerkt</em></span>
        <select name="aisle">${order.map((a) => `<option${a === item.aisle ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      <div class="sheet-actions">
        <button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Löschen</button>
        <button type="submit" class="btn primary">Speichern</button>
      </div></form>`,
    mount(dlg, close) {
      dlg.querySelector('[data-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const aisle = String(f.get('aisle'));
        const name = String(f.get('name')).trim() || item.name;
        const amountText = String(f.get('amountText')).trim();
        if (aisle !== item.aisle) learnAisle(item.name, aisle);
        const amountChanged = amountText !== item.amountText;
        const next = store.all('shoppingItems')
          .filter((i) => !(amountChanged && ids.includes(i.id) && i.id !== ids[0]))
          .map((i) => {
            if (!ids.includes(i.id)) return i;
            const patch = { ...i, name, aisle };
            return amountChanged ? { ...patch, amountText, quantities: null, source: 'manual' } : patch;
          });
        store.setAll('shoppingItems', next);
        close();
      });
      dlg.querySelector('[data-del]').addEventListener('click', () => {
        store.setAll('shoppingItems', store.all('shoppingItems').filter((i) => !ids.includes(i.id)));
        close();
      });
    },
  });
}
