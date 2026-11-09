// Rezept importieren: A) Foto auslesen (Gemini direkt in der App), B) Text einfügen,
// C) KI-Chat (Gemini/ChatGPT liest Link oder Video, Antwort wird eingefügt).
// Alles füllt das Rezeptformular vor (bzw. zeigt bei mehreren Rezepten die Importvorschau).
import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, toast } from '../ui.js';
import { parseRecipeText, buildAiPrompt } from '../recipe-text.js';
import { startDraft } from './edit.js';
import { navigate } from '../main.js';
import { recipeImportDialog } from './data.js';
import { prepareForAi } from '../image.js';
import { readRecipePhotos, toDraft, toExchangeRecipe, explainError, MAX_PHOTOS } from '../ai-import.js';
import { app, usingEmulator } from '../firebase.js';

const AI_TOOLS = [
  ['Gemini', 'https://gemini.google.com/app'],
  ['ChatGPT', 'https://chatgpt.com/'],
];

// Bleibt beim Neuzeichnen erhalten.
const state = { tab: 'foto', text: '', answer: '', photos: [], busy: '', hint: '' };

const lists = () => ({
  categories: [...store.all('categories')].sort((a, b) => a.order - b.order).map((c) => c.name),
  tags: store.all('tags').map((t) => t.name),
});

function prompt() {
  return buildAiPrompt(lists());
}

function addPhotos(files) {
  const room = MAX_PHOTOS - state.photos.length;
  const picked = [...files].filter((f) => /^image\//.test(f.type || 'image/')).slice(0, Math.max(0, room));
  for (const file of picked) state.photos.push({ file, url: URL.createObjectURL(file) });
  if (files.length > picked.length) toast(`Höchstens ${MAX_PHOTOS} Fotos auf einmal.`);
  state.hint = '';
}

function clearPhotos() {
  state.photos.forEach((p) => URL.revokeObjectURL(p.url));
  state.photos = [];
}

async function readPhotos(rerender) {
  if (!state.photos.length || state.busy) return;
  if (!navigator.onLine) { toast('Keine Verbindung – zum Auslesen braucht die App Internet.'); return; }
  if (usingEmulator) { toast('Im Emulator-Modus gibt es kein Gemini – bitte die echte App benutzen.'); return; }
  const status = (t) => { state.busy = t; rerender(); };
  try {
    status('Fotos werden vorbereitet …');
    const blobs = [];
    for (const p of state.photos) blobs.push(await prepareForAi(p.file));
    const { recipes, hint } = await readRecipePhotos(app, blobs, lists(), status);
    state.busy = '';
    if (!recipes.length) {
      state.hint = hint || 'Auf den Fotos wurde kein Rezept gefunden.';
      rerender();
      return;
    }
    clearPhotos();
    state.hint = '';
    if (hint) toast(hint);
    if (recipes.length === 1) {
      startDraft(toDraft(recipes[0]));
      navigate('neu');
    } else {
      rerender();
      recipeImportDialog(recipes.map(toExchangeRecipe));
    }
  } catch (e) {
    console.error(e);
    state.busy = '';
    state.hint = explainError(e);
    rerender();
  }
}

async function readClipboard() {
  try {
    const t = await navigator.clipboard.readText();
    if (!t.trim()) { toast('Die Zwischenablage ist leer.'); return null; }
    return t;
  } catch (e) {
    toast('Kein Zugriff auf die Zwischenablage – bitte ins Feld tippen und „Einfügen“ wählen.');
    return null;
  }
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}

function takeOver(text, origin) {
  const draft = parseRecipeText(text);
  if (!draft.ingredientsText && !draft.steps.length) {
    toast('Darin habe ich kein Rezept gefunden – stehen Zutaten und Zubereitung im Text?');
    return;
  }
  startDraft({ ...draft, origin });
  navigate('neu');
}

export function importView({ rerender }) {
  const textTab = `
    <section class="card import-card">
      <p class="import-lead">Rezept von einer Webseite, aus Instagram, WhatsApp oder einer Notiz kopieren und hier einfügen. Die App erkennt Titel, Zutaten und Schritte.</p>
      <textarea id="importText" rows="12" placeholder="z. B.&#10;Pfannkuchen&#10;Zutaten für 4 Portionen:&#10;250 g Mehl&#10;500 ml Milch&#10;Zubereitung:&#10;1. Alles verrühren …">${esc(state.text)}</textarea>
      <div class="btn-row">
        <button type="button" class="btn" data-paste="text">${icon('clipboard')} Aus Zwischenablage einfügen</button>
        <button type="button" class="btn primary" data-parse-text>${icon('arrowRight')} Rezept erkennen</button>
      </div>
    </section>`;

  const n = state.photos.length;
  const fotoTab = `
    <section class="card import-card">
      <p class="import-lead">Kochbuchseite, Rezeptkarte, Zeitschrift oder Handschrift fotografieren – Gemini liest das Rezept und die App übernimmt es. Mehrere Seiten eines Rezepts oder mehrere Rezepte gehen auf einmal.</p>
      <div class="btn-row">
        <label class="btn${n ? '' : ' primary'}">${icon('camera')} Foto aufnehmen<input type="file" accept="image/*" capture="environment" data-ai-photo hidden></label>
        <label class="btn">${icon('image')} Fotos wählen<input type="file" accept="image/*" multiple data-ai-photo hidden></label>
      </div>
      ${n ? `<ul class="ai-photos">${state.photos.map((p, i) => `<li><img src="${p.url}" alt="Foto ${i + 1}"><button type="button" class="icon-btn" data-ai-remove="${i}" aria-label="Foto ${i + 1} entfernen">${icon('x')}</button></li>`).join('')}</ul>` : ''}
      ${state.busy ? `<p class="ai-busy" role="status"><span class="spinner" aria-hidden="true"></span>${esc(state.busy)}</p>` : ''}
      ${state.hint ? `<p class="hint-box" role="alert">${esc(state.hint)}</p>` : ''}
      <div class="btn-row">
        <button type="button" class="btn primary" data-ai-read ${n && !state.busy ? '' : 'disabled'}>${icon('sparkle')} ${n > 1 ? `${n} Fotos` : 'Foto'} mit Gemini auslesen</button>
        ${n && !state.busy ? '<button type="button" class="link-btn" data-ai-clear>alle entfernen</button>' : ''}
      </div>
      <p class="muted small">Die Fotos werden nur zum Auslesen an Google Gemini geschickt und nicht gespeichert. Was Gemini nicht sicher lesen kann, wird markiert – nichts wird geraten.</p>
    </section>`;

  const aiTab = `
    <section class="card import-card">
      <p class="import-lead">Für Links und Videos (z. B. Instagram, YouTube) – oder wenn „Foto auslesen“ einmal nicht geht. Eine kostenlose KI liest das Rezept im Chat, die App übernimmt die Antwort.</p>
      <ol class="ki-steps">
        <li>
          <b>Anweisung kopieren und KI öffnen</b>
          <div class="btn-row">${AI_TOOLS.map(([name, url], i) => `<button type="button" class="btn${i ? '' : ' primary'}" data-open-ai="${url}">${icon('sparkle')} ${name} öffnen</button>`).join('')}
            <button type="button" class="link-btn" data-copy-prompt>nur Anweisung kopieren</button></div>
        </li>
        <li>
          <b>Im KI-Chat: Rezept anhängen und senden</b>
          <span>Foto oder Screenshot anhängen (Büroklammer bzw. „+“) <em>oder</em> den Link einfügen – dann die kopierte Anweisung einfügen (lange tippen → „Einfügen“) und absenden.</span>
        </li>
        <li>
          <b>Antwort kopieren und hier einfügen</b>
          <span>Unter der Antwort auf „Kopieren“ tippen.</span>
          <textarea id="aiAnswer" rows="8" placeholder="TITEL: …&#10;ZUTATEN: …&#10;ZUBEREITUNG: …">${esc(state.answer)}</textarea>
          <div class="btn-row">
            <button type="button" class="btn" data-paste="answer">${icon('clipboard')} Aus Zwischenablage einfügen</button>
            <button type="button" class="btn primary" data-parse-answer>${icon('arrowRight')} Rezept übernehmen</button>
          </div>
        </li>
      </ol>
      <details class="prompt-preview"><summary>Anweisung ansehen</summary><pre>${esc(prompt())}</pre></details>
    </section>`;

  const html = `
    <header class="page-head">
      <div><p class="eyebrow">Rezepte</p><h1>Rezept importieren</h1></div>
      <a class="btn ghost" href="#/rezepte">${icon('x')} Abbrechen</a>
    </header>
    <div class="segment" role="tablist">
      <button type="button" class="${state.tab === 'foto' ? 'active' : ''}" data-tab="foto" role="tab" aria-selected="${state.tab === 'foto'}">${icon('camera')} Foto auslesen</button>
      <button type="button" class="${state.tab === 'text' ? 'active' : ''}" data-tab="text" role="tab" aria-selected="${state.tab === 'text'}">${icon('clipboard')} Text</button>
      <button type="button" class="${state.tab === 'ai' ? 'active' : ''}" data-tab="ai" role="tab" aria-selected="${state.tab === 'ai'}">${icon('sparkle')} Link, Video</button>
      <a href="#/daten" role="tab" aria-selected="false">${icon('upload')} Datei</a>
    </div>
    ${state.tab === 'foto' ? fotoTab : state.tab === 'text' ? textTab : aiTab}
    <p class="muted small">Danach öffnet sich das Rezeptformular zum Prüfen – gespeichert wird erst, wenn ihr auf „Speichern“ tippt.</p>`;

  return {
    title: 'Rezept importieren',
    html,
    mount(root) {
      root.querySelector('#importText')?.addEventListener('input', (e) => { state.text = e.target.value; });
      root.querySelector('#aiAnswer')?.addEventListener('input', (e) => { state.answer = e.target.value; });
      root.querySelectorAll('[data-ai-photo]').forEach((input) => input.addEventListener('change', (e) => {
        addPhotos(e.target.files);
        e.target.value = '';
        rerender();
      }));
      root.addEventListener('click', async (e) => {
        const rm = e.target.closest('[data-ai-remove]');
        if (rm) {
          const [p] = state.photos.splice(Number(rm.dataset.aiRemove), 1);
          if (p) URL.revokeObjectURL(p.url);
          rerender();
          return;
        }
        if (e.target.closest('[data-ai-clear]')) { clearPhotos(); state.hint = ''; rerender(); return; }
        if (e.target.closest('[data-ai-read]')) { readPhotos(rerender); return; }
        const tab = e.target.closest('[data-tab]');
        if (tab) { state.tab = tab.dataset.tab; rerender(); return; }
        const paste = e.target.closest('[data-paste]');
        if (paste) {
          const t = await readClipboard();
          if (t == null) return;
          state[paste.dataset.paste] = t;
          rerender();
          return;
        }
        if (e.target.closest('[data-parse-text]')) takeOver(state.text, 'text');
        if (e.target.closest('[data-parse-answer]')) takeOver(state.answer, 'ai');
        if (e.target.closest('[data-copy-prompt]')) toast(await copy(prompt()) ? 'Anweisung kopiert' : 'Kopieren nicht möglich – bitte unter „Anweisung ansehen“ markieren.');
        const ai = e.target.closest('[data-open-ai]');
        if (ai) {
          // Fenster sofort öffnen (sonst blockt der Browser), dann kopieren.
          const win = window.open(ai.dataset.openAi, '_blank', 'noopener');
          const ok = await copy(prompt());
          toast(ok ? 'Anweisung kopiert – im Chat einfügen' : 'Bitte die Anweisung unter „Anweisung ansehen“ kopieren.');
          if (!win) toast('Pop-up blockiert – bitte die KI selbst öffnen.');
        }
      });
    },
  };
}

export function resetImport() {
  state.text = '';
  state.answer = '';
}
