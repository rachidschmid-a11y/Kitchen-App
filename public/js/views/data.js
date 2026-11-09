// „Import & Export“: Rezeptdateien hinein und hinaus, Vorlage, komplette Sicherung.
import { store, readLegacy } from '../store.js';
import { icon } from '../icons.js';
import { esc, toast, openDialog, confirmDialog, downloadJson, todayIso } from '../ui.js';
import { recipeListFrom, previewImport, importRecipes, exportRecipes } from '../importer.js';
import { TEMPLATE } from '../exchange.js';
import { exportPhotos, importPhotos, deletePhoto } from '../photos.js';

let exportScope = 'all';

const FIELDS = [
  ['title / titel', 'Name des Rezepts', true],
  ['ingredients / zutaten', 'Liste von Textzeilen („250 g Mehl“) oder ein Text mit Zeilenumbrüchen; „Für den Teig:“ beginnt einen Abschnitt', true],
  ['steps / zubereitung', 'Liste von Schritten oder ein Text', true],
  ['servings / portionen', 'Zahl (oder „4 Portionen“)'],
  ['prepMin, cookMin / vorbereitung, kochzeit', 'Minuten (oder „1 Std. 20 Min.“)'],
  ['categories, tags / kategorien, tags', 'Namen, als Liste oder mit Komma getrennt – fehlende werden angelegt'],
  ['description, source / beschreibung, quelle', 'Text'],
  ['notes, tips / notizen, tipps', 'Text oder Liste – werden zu Notizen im Rezept'],
  ['rating, favorite / bewertung, favorit', '0–5 bzw. true/false'],
];

function readFile(file) {
  return file.text().then((t) => JSON.parse(t));
}

export function handleImportData(data) {
  const list = recipeListFrom(data);
  if (list) return recipeImportDialog(list);
  if (Array.isArray(data?.recipes) && data?.settings) return restoreDialog(data);
  toast('Die Datei enthält keine Rezepte in einem bekannten Format.');
  return null;
}

export function recipeImportDialog(list) {
  const p = previewImport(list);
  const names = (arr) => arr.slice(0, 8).map((r) => esc(r.title)).join(', ') + (arr.length > 8 ? ` und ${arr.length - 8} weitere` : '');
  openDialog({
    title: 'Rezepte importieren',
    wide: true,
    body: `
      <div class="import-summary">
        <div class="stat good"><b class="mono">${p.fresh.length}</b><span>neu</span></div>
        <div class="stat"><b class="mono">${p.duplicates.length}</b><span>gibt es schon</span></div>
        <div class="stat${p.invalid.length ? ' warn' : ''}"><b class="mono">${p.invalid.length}</b><span>unbrauchbar</span></div>
      </div>
      ${p.fresh.length ? `<p class="small"><b>Neu:</b> ${names(p.fresh)}</p>` : ''}
      ${p.duplicates.length ? `
        <p class="small"><b>Gibt es schon:</b> ${names(p.duplicates)}</p>
        <div class="field"><span>Was tun mit vorhandenen Rezepten?</span>
          <div class="segment">${[['skip', 'Überspringen'], ['replace', 'Aktualisieren'], ['copy', 'Als Kopie']].map(([v, l], i) => `<label class="seg-opt"><input type="radio" name="dups" value="${v}"${i ? '' : ' checked'}><span>${l}</span></label>`).join('')}</div>
          <em class="muted small">„Aktualisieren“ überschreibt Zutaten, Schritte und Angaben – eure Notizen bleiben erhalten.</em>
        </div>` : ''}
      ${p.invalid.length ? `<details class="invalid-list"><summary>${p.invalid.length === 1 ? '1 Eintrag wird' : `${p.invalid.length} Einträge werden`} nicht übernommen</summary><ul>${p.invalid.map((x) => `<li>${esc(x.title)} – ${esc(x.error)}</li>`).join('')}</ul></details>` : ''}
      <p class="muted small">Eure vorhandenen Rezepte, Pläne und Listen bleiben erhalten. Fehlende Kategorien und Tags werden angelegt.</p>
      <div class="sheet-actions"><button type="button" class="btn ghost" data-close>Abbrechen</button>
        <button type="button" class="btn primary" data-go ${p.fresh.length || p.duplicates.length ? '' : 'disabled'}>Übernehmen</button></div>`,
    mount(dlg, close) {
      dlg.querySelector('[data-go]').addEventListener('click', () => {
        const mode = dlg.querySelector('input[name="dups"]:checked')?.value || 'skip';
        const res = importRecipes(list, { duplicates: mode });
        close();
        const parts = [res.added && `${res.added} neu`, res.updated && `${res.updated} aktualisiert`, res.skipped && `${res.skipped} übersprungen`].filter(Boolean);
        toast(`Import fertig: ${parts.join(', ') || 'nichts geändert'}`);
      });
    },
  });
}

async function restoreDialog(data) {
  const ok = await confirmDialog({
    title: 'Komplette Sicherung wiederherstellen?',
    text: `${data.recipes.length} Rezepte samt Wochenplan, Listen, Vorrat und Einstellungen ersetzen den aktuellen Stand – für alle, die die App benutzen. Am besten vorher eine Sicherung herunterladen.`,
    confirm: 'Wiederherstellen',
  });
  if (!ok) return;
  const before = store.all('recipes').map((r) => r.photoId).filter(Boolean);
  // Fotos zuerst ablegen – sie werden hochgeladen, sobald die Rezepte sie benutzen.
  const n = await importPhotos(data.photos || []).catch(() => 0);
  store.importData(data);
  const keep = new Set(store.all('recipes').map((r) => r.photoId));
  before.filter((id) => !keep.has(id)).forEach((id) => deletePhoto(id));
  toast(`Sicherung wiederhergestellt${n ? ` (mit ${n} Fotos)` : ''}`);
}

async function legacyDialog(legacy) {
  const ok = await confirmDialog({
    title: 'Daten aus dem Prototyp übernehmen?',
    text: `${legacy.recipes.length} Rezepte samt Wochenplan, Listen, Vorrat und Einstellungen aus diesem Browser ersetzen den gemeinsamen Stand – für alle. Am besten vorher eine Sicherung herunterladen.`,
    confirm: 'Übernehmen',
  });
  if (!ok) return;
  const before = store.all('recipes').map((r) => r.photoId).filter(Boolean);
  store.importData(legacy);
  const keep = new Set(store.all('recipes').map((r) => r.photoId));
  before.filter((id) => !keep.has(id)).forEach((id) => deletePhoto(id));
  try { localStorage.setItem('rezepte-app/migrated', new Date().toISOString()); } catch (e) { /* egal */ }
  toast(`${legacy.recipes.length} Rezepte übernommen`);
}

function exportList() {
  const all = store.all('recipes');
  if (exportScope === 'fav') return all.filter((r) => r.favorite);
  if (exportScope.startsWith('cat:')) return all.filter((r) => (r.categoryIds || []).includes(exportScope.slice(4)));
  return all;
}

export function dataView({ rerender }) {
  const recipes = store.all('recipes');
  const favs = recipes.filter((r) => r.favorite).length;
  const categories = [...store.all('categories')].sort((a, b) => a.order - b.order);
  const count = exportList().length;
  const legacy = readLegacy();

  const html = `
    <header class="page-head">
      <div><p class="eyebrow">Mehr</p><h1>Import &amp; Export</h1></div>
      <a class="btn ghost" href="#/mehr">${icon('chevronLeft')} Zurück</a>
    </header>

    <section class="card settings">
      <div class="card-head"><h2>${icon('upload')} Rezepte aus Datei importieren</h2><span class="muted small">auch hunderte auf einmal</span></div>
      <label class="drop-zone" data-drop>
        ${icon('upload')}
        <b>JSON-Datei wählen oder hierher ziehen</b>
        <span>Austauschformat dieser App – z. B. zu Hause mit Claude vorbereitet oder aus einem Export</span>
        <input type="file" accept=".json,application/json" data-file hidden>
      </label>
      <details class="paste-json"><summary>Oder JSON-Text einfügen</summary>
        <textarea id="jsonPaste" rows="6" placeholder='{"rezepte": [ { "title": "…", "ingredients": ["…"], "steps": ["…"] } ]}'></textarea>
        <button type="button" class="btn small" data-paste-go>Prüfen</button>
      </details>
      <p class="muted small">Vor dem Übernehmen zeigt die App, was neu ist, was es schon gibt und was nicht passt. Nichts wird ungefragt überschrieben.</p>
    </section>

    <section class="card settings">
      <div class="card-head"><h2>${icon('download')} Rezepte exportieren</h2><span class="muted small">zum Sichern, Weitergeben oder Bearbeiten</span></div>
      <div class="chip-wrap">
        <button type="button" class="chip${exportScope === 'all' ? ' active' : ''}" data-scope="all">Alle <span class="mono">${recipes.length}</span></button>
        <button type="button" class="chip${exportScope === 'fav' ? ' active' : ''}" data-scope="fav">Favoriten <span class="mono">${favs}</span></button>
        ${categories.map((c) => {
          const n = recipes.filter((r) => (r.categoryIds || []).includes(c.id)).length;
          return n ? `<button type="button" class="chip${exportScope === `cat:${c.id}` ? ' active' : ''}" data-scope="cat:${c.id}">${esc(c.name)} <span class="mono">${n}</span></button>` : '';
        }).join('')}
      </div>
      <div class="btn-row"><button type="button" class="btn primary" data-export ${count ? '' : 'disabled'}>${icon('download')} ${count} ${count === 1 ? 'Rezept' : 'Rezepte'} als Datei</button></div>
      <p class="muted small">Ohne Fotos. Die Datei lässt sich hier wieder importieren – auch auf einem anderen Gerät.</p>
    </section>

    <section class="card settings">
      <div class="card-head"><h2>${icon('list')} Vorlage &amp; Format</h2></div>
      <p class="small">Pflichtfelder sind fett. Deutsche und englische Feldnamen funktionieren beide – die vollständige Beschreibung steht in <span class="mono">docs/FORMAT.md</span> im Projekt.</p>
      <table class="format-table"><tbody>${FIELDS.map(([k, d, req]) => `<tr><td class="mono">${req ? `<b>${esc(k)}</b>` : esc(k)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>
      <div class="btn-row"><button type="button" class="btn" data-template>${icon('download')} Vorlage herunterladen</button></div>
    </section>

    <section class="card settings">
      <div class="card-head"><h2>${icon('box')} Komplette Sicherung</h2><span class="muted small">alles aus der gemeinsamen Datenbank</span></div>
      <p class="muted small">Rezepte mit Fotos, Wochenplan, Merkzettel, Einkaufsliste, Vorrat, Personen und Einstellungen in einer Datei. Beim Wiederherstellen wird der gemeinsame Stand ersetzt – für alle.</p>
      <div class="btn-row">
        <button type="button" class="btn" data-backup>${icon('download')} Sicherung herunterladen</button>
        <label class="btn">${icon('upload')} Sicherung wiederherstellen<input type="file" accept=".json,application/json" data-restore hidden></label>
        <button type="button" class="btn ghost danger-text" data-reset>${icon('trash')} Alles zurücksetzen</button>
      </div>
    </section>
    ${legacy ? `
    <section class="card settings">
      <div class="card-head"><h2>${icon('cloud')} Daten aus dem Prototyp</h2><span class="muted small">nur in diesem Browser</span></div>
      <p class="muted small">Hier liegen noch ${legacy.recipes.length} Rezepte aus der Zeit vor Firebase${localStorage.getItem('rezepte-app/migrated') ? ' – sie wurden bereits übernommen' : ''}. Übernehmen ersetzt den gemeinsamen Stand.</p>
      <div class="btn-row"><button type="button" class="btn" data-legacy>${icon('cloud')} In die Datenbank übernehmen</button></div>
    </section>` : ''}`;

  return {
    title: 'Import & Export',
    html,
    mount(root) {
      const onFile = async (file) => {
        if (!file) return;
        try { handleImportData(await readFile(file)); } catch (e) { toast('Die Datei ist kein gültiges JSON.'); }
      };
      root.querySelector('[data-file]').addEventListener('change', (e) => { onFile(e.target.files[0]); e.target.value = ''; });
      root.querySelector('[data-restore]').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
          const data = await readFile(file);
          if (Array.isArray(data?.recipes) && data?.settings) restoreDialog(data);
          else handleImportData(data);
        } catch (err) { toast('Die Datei ist kein gültiges JSON.'); }
      });
      const drop = root.querySelector('[data-drop]');
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); onFile(e.dataTransfer.files[0]); });
      root.addEventListener('click', async (e) => {
        const scope = e.target.closest('[data-scope]');
        if (scope) { exportScope = scope.dataset.scope; rerender(); }
        if (e.target.closest('[data-export]')) {
          downloadJson(`rezepte-${todayIso()}.json`, exportRecipes(exportList()));
          toast(`${exportList().length} Rezepte exportiert`);
        }
        if (e.target.closest('[data-template]')) downloadJson('rezepte-vorlage.json', TEMPLATE);
        if (e.target.closest('[data-backup]')) {
          toast('Sicherung wird erstellt …');
          const photos = await exportPhotos(store.all('recipes').map((r) => r.photoId)).catch(() => []);
          downloadJson(`unsere-kueche-sicherung-${todayIso()}.json`, { ...store.exportData(), photos });
          toast(`Sicherung erstellt${photos.length ? ` – mit ${photos.length} Fotos` : ''}`);
        }
        if (e.target.closest('[data-paste-go]')) {
          try { handleImportData(JSON.parse(root.querySelector('#jsonPaste').value)); } catch (err) { toast('Das ist kein gültiges JSON – fehlt eine Klammer oder ein Komma?'); }
        }
        if (e.target.closest('[data-reset]')) {
          const ok = await confirmDialog({ title: 'Alles zurücksetzen?', text: `Alle ${store.all('recipes').length} Rezepte mit Fotos, Pläne, Listen, Personen und der Vorrat werden aus der gemeinsamen Datenbank gelöscht – für alle, die die App benutzen. Vorher unbedingt eine Sicherung herunterladen.`, confirm: 'Alles löschen' });
          if (ok) {
            const photoIds = store.all('recipes').map((r) => r.photoId).filter(Boolean);
            store.reset();
            photoIds.forEach((id) => deletePhoto(id));
            toast('Alles zurückgesetzt');
          }
        }
        if (e.target.closest('[data-legacy]')) legacyDialog(readLegacy());
      });
    },
  };
}
