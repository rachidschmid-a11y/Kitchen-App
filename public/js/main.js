// App-Hülle: Navigation, Hash-Router und Neuzeichnen bei Datenänderungen.
import { store } from './store.js';
import { icon, GOOGLE_LOGO } from './icons.js';
import { toast, todayIso, esc } from './ui.js';
import { pantryStatus } from './model.js';
import { recipesView } from './views/recipes.js';
import { recipeView, cookView } from './views/recipe.js';
import { editView } from './views/edit.js';
import { planView } from './views/plan.js';
import { shoppingView } from './views/shopping.js';
import { pantryView } from './views/pantry.js';
import { settingsView } from './views/settings.js';
import { importView } from './views/import.js';
import { dataView } from './views/data.js';
import { me, meId, avatar, whoSkipped, setUser } from './members.js';
import { whoAmIDialog } from './views/people.js';
import { initDevice } from './device.js';
import { hydratePhotos, cleanupPhotos } from './photos.js';
import { readLegacy } from './store.js';
import { onUser, signIn, signInTest, signOut, usingEmulator } from './firebase.js';
import { openHousehold, startSync, stopSync, writeAll, seedHousehold } from './cloud.js';

const NAV = [
  ['rezepte', 'Rezepte', 'book'],
  ['plan', 'Wochenplan', 'calendar'],
  ['einkauf', 'Einkauf', 'cart'],
  ['vorrat', 'Vorrat', 'box'],
  ['mehr', 'Mehr', 'sliders'],
];

const ROUTES = [
  [/^rezepte$/, 'rezepte', () => recipesView],
  [/^neu$/, 'rezepte', () => editView],
  [/^import$/, 'rezepte', () => importView],
  [/^rezept\/([\w-]+)$/, 'rezepte', () => recipeView],
  [/^rezept\/([\w-]+)\/bearbeiten$/, 'rezepte', () => editView],
  [/^rezept\/([\w-]+)\/kochen$/, 'rezepte', () => cookView],
  [/^plan(?:\/(naechste))?$/, 'plan', () => planView],
  [/^einkauf$/, 'einkauf', () => shoppingView],
  [/^vorrat$/, 'vorrat', () => pantryView],
  [/^mehr$/, 'mehr', () => settingsView],
  [/^daten$/, 'mehr', () => dataView],
];

const viewEl = document.getElementById('view');
let current = null;
let lastPath = null;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function navigate(path) {
  location.hash = '#/' + path;
}

function renderNav(section) {
  const open = new Set(store.all('shoppingItems').filter((i) => !i.checked).map((i) => i.key)).size;
  const today = todayIso();
  const soon = store.all('pantry').filter((p) => pantryStatus(p, today).soon).length;
  const badges = { einkauf: open, vorrat: soon };
  const self = me();
  document.getElementById('navLinks').innerHTML = NAV.map(([id, label, ic]) => `
    <a href="#/${id}" class="nav-link${section === id ? ' active' : ''}"${section === id ? ' aria-current="page"' : ''}>
      ${id === 'mehr' && self ? avatar(self, 'nav-avatar') : icon(ic)}<span class="nav-label">${label}</span>
      ${badges[id] ? `<span class="nav-badge${id === 'vorrat' ? ' gold' : ''}">${badges[id]}</span>` : ''}
    </a>`).join('');
  document.getElementById('brandName').textContent = store.settings().householdName;
  document.getElementById('navAccount').innerHTML = self
    ? `${avatar(self)}<span><b>${esc(self.name)}</b><em>Profil &amp; Personen</em></span>`
    : `${icon('users')}<span><b>Wer bist du?</b><em>Profil anlegen</em></span>`;
}

function render({ keepScroll = false } = {}) {
  const { path, query } = parseHash();
  let match = null;
  for (const [re, section, getView] of ROUTES) {
    const m = path.match(re);
    if (m) { match = { section, view: getView(), params: m.slice(1) }; break; }
  }
  if (!match) { navigate('rezepte'); return; }

  const active = document.activeElement;
  const focusId = active && viewEl.contains(active) && active.id ? active.id : null;
  const sel = focusId && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
  const scrollY = window.scrollY;

  const result = match.view({ params: match.params, query, path, rerender: () => render({ keepScroll: true }) });
  if (!result) return;
  current = { ...result, path, section: match.section };
  viewEl.innerHTML = `<div class="screen ${result.cls || ''}">${result.html}</div>`;
  result.mount?.(viewEl.firstElementChild);
  hydratePhotos(viewEl);
  document.body.classList.toggle('immersive', !!result.immersive);
  document.title = result.title ? `${result.title} · ${store.settings().householdName}` : store.settings().householdName;
  renderNav(match.section);

  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus({ preventScroll: true });
      if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* kein Textfeld */ }
    }
  }
  window.scrollTo(0, keepScroll ? scrollY : 0);
}

window.addEventListener('hashchange', () => {
  if (!started) return;
  const { path } = parseHash();
  render({ keepScroll: path === lastPath });
  lastPath = path;
});

// Bei Datenänderungen neu zeichnen – außer in Formularen, die ihren eigenen Stand halten.
store.subscribe(() => {
  if (!started) return;
  if (current && current.live === false) { renderNav(current.section); return; }
  render({ keepScroll: true });
});

let lastErrorToast = 0;
store.onError((e) => {
  if (Date.now() - lastErrorToast < 4000) return;
  lastErrorToast = Date.now();
  toast(e?.code === 'permission-denied' ? 'Keine Berechtigung zum Speichern – bitte neu anmelden.' : 'Speichern fehlgeschlagen – bitte später noch einmal versuchen.');
});
store.setActor(meId);

// ---------- Anmeldung & Start ----------

let started = false;
const MIGRATED_KEY = 'rezepte-app/migrated';

function gate(html, mount) {
  started = false;
  document.body.classList.add('gated');
  document.body.classList.remove('immersive');
  viewEl.innerHTML = `<div class="gate"><div class="gate-card card">
    <div class="gate-brand">${icon('book')}<span>Unsere Küche</span></div>${html}</div></div>`;
  mount?.(viewEl.querySelector('.gate-card'));
}

const showLoading = (text = 'Rezepte werden geladen …') => gate(`<p class="gate-wait"><span class="spinner" aria-hidden="true"></span>${esc(text)}</p>`);

function showSignIn(error = '') {
  gate(`
    <h1>Willkommen in eurer Küche</h1>
    <p class="muted">Rezepte, Wochenplan, Einkaufsliste und Vorrat – gemeinsam auf all euren Geräten.</p>
    <button type="button" class="btn g-btn" data-signin>${GOOGLE_LOGO}<span>Mit Google anmelden</span></button>
    ${error ? `<p class="gate-error" role="alert">${esc(error)}</p>` : ''}
    ${usingEmulator ? `<form class="inline-form gate-test" data-test-login>
      <input id="testMail" type="email" placeholder="Adresse aus firestore.rules" aria-label="Test-Adresse">
      <button class="btn small" type="submit">Test-Anmeldung</button></form>
      <p class="muted small">Emulator-Modus: Daten nur auf diesem Rechner, nicht in der echten Datenbank.</p>` : ''}`, (card) => {
    card.querySelector('[data-signin]').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try { await signIn(); } catch (err) {
        if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err?.code)) return showSignIn();
        showSignIn(err?.code === 'auth/popup-blocked' ? 'Das Anmeldefenster wurde blockiert – bitte Pop-ups für diese Seite erlauben.' : `Anmeldung fehlgeschlagen (${err?.code || err?.message || 'unbekannt'}).`);
      }
    });
    card.querySelector('[data-test-login]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      signInTest(card.querySelector('#testMail').value.trim()).catch((err) => showSignIn(err.message));
    });
  });
}

function showDenied(user) {
  gate(`
    <h1>Kein Zugriff</h1>
    <p>Das Google-Konto <b>${esc(user.email || '')}</b> ist für diese Küche nicht freigeschaltet.</p>
    <p class="muted small">Freigeschaltete Konten stehen in den Sicherheitsregeln des Firebase-Projekts (firestore.rules).</p>
    <button type="button" class="btn primary" data-other>${icon('logout')} Mit anderem Konto anmelden</button>`, (card) => {
    card.querySelector('[data-other]').addEventListener('click', () => signOut().finally(() => location.reload()));
  });
}

function showOffline() {
  gate(`
    <h1>Keine Verbindung</h1>
    <p class="muted">Beim ersten Öffnen auf einem Gerät braucht die App einmal Internet. Danach funktioniert sie auch offline.</p>
    <button type="button" class="btn primary" data-retry>Noch einmal versuchen</button>`, (card) => {
    card.querySelector('[data-retry]').addEventListener('click', () => location.reload());
  });
}

// Leere Datenbank: Daten aus dem Prototyp (localStorage dieses Browsers) übernehmen oder leer beginnen.
function showSetup(user, legacy) {
  const photos = legacy.recipes.filter((r) => r.photoId).length;
  gate(`
    <h1>Daten übernehmen?</h1>
    <p>In diesem Browser liegen noch Daten aus dem Prototyp:</p>
    <ul class="gate-list">
      <li><b>${legacy.recipes.length}</b> Rezepte${photos ? ` (${photos} mit Foto)` : ''}</li>
      <li><b>${legacy.mealPlan.length + legacy.planInbox.length}</b> Einträge im Wochenplan &amp; Merkzettel</li>
      <li><b>${legacy.shoppingItems.length}</b> Einträge auf der Einkaufsliste, <b>${legacy.pantry.length}</b> im Vorrat</li>
    </ul>
    <p class="muted small">Die gemeinsame Datenbank ist noch leer. Übernommene Daten sehen danach alle, die sich anmelden. Die Daten im Browser bleiben zusätzlich erhalten.</p>
    <div class="btn-row">
      <button type="button" class="btn primary" data-migrate>${icon('cloud')} Übernehmen</button>
      <button type="button" class="btn ghost" data-fresh>Leer beginnen</button>
    </div>`, (card) => {
    card.querySelector('[data-migrate]').addEventListener('click', async () => {
      showLoading('Daten werden übertragen …');
      try {
        await writeAll(legacy);
        try { localStorage.setItem(MIGRATED_KEY, new Date().toISOString()); } catch (e) { /* egal */ }
        await enter(user);
        toast(`${legacy.recipes.length} Rezepte übernommen`);
      } catch (e) { console.error(e); showSetup(user, legacy); toast('Übertragen fehlgeschlagen – bitte noch einmal versuchen.'); }
    });
    card.querySelector('[data-fresh]').addEventListener('click', async () => {
      showLoading();
      await seedHousehold();
      await enter(user);
    });
  });
}

async function enter(user) {
  showLoading();
  await startSync();
  started = true;
  document.body.classList.remove('gated');
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/rezepte');
  lastPath = parseHash().path;
  render();
  // Lokale Fotokopien ohne Rezept freigeben (Prototyp-Fotos bleiben, solange es die alten Daten gibt).
  const legacyPhotos = (readLegacy()?.recipes || []).map((r) => r.photoId);
  cleanupPhotos(store.all('recipes').map((r) => r.photoId), legacyPhotos).catch(() => {});
  // Erstes Mal mit diesem Konto: Anzeigenamen wählen.
  if (!me() && !whoSkipped()) setTimeout(whoAmIDialog, 300);
}

async function boot(user) {
  stopSync();
  setUser(user);
  if (!user) return showSignIn();
  showLoading();
  const status = await openHousehold();
  if (status === 'denied') return showDenied(user);
  if (status === 'offline') return showOffline();
  if (status === 'empty') {
    const legacy = readLegacy();
    if (legacy) return showSetup(user, legacy);
    await seedHousehold();
  }
  try { await enter(user); } catch (e) {
    console.error(e);
    if (e?.code === 'permission-denied') showDenied(user); else showOffline();
  }
}

showLoading('Einen Moment …');
initDevice();
let lastUid;
onUser((user) => {
  if ((user?.uid || null) === lastUid) return;
  lastUid = user?.uid || null;
  boot(user);
});
