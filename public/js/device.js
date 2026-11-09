// Geräte-Tauglichkeit wie bei „Unser Nest“: als App installieren (Android/Desktop per Knopf,
// iPhone/iPad per „Zum Home-Bildschirm“), Offline-Start, dauerhafter Speicher und ein Gerätecheck.
import { icon } from './icons.js';
import { toast, openDialog } from './ui.js';
import { store } from './store.js';
import { photoStorageBytes } from './photos.js';
import { formatBytes } from './image.js';
import { offlineCache } from './firebase.js';

const DISMISS_KEY = 'rezepte-app/install-dismissed';
let installPrompt = null;

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
// iPads melden sich seit iPadOS 13 als „Macintosh“ – erkennbar am Touchscreen.
export const isIpad = () => /ipad/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
export const isIos = () => /iphone|ipod/i.test(navigator.userAgent) || isIpad();
const isMacSafari = () => /macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints <= 1 && /safari/i.test(navigator.userAgent) && !/chrome|chromium|edg|firefox/i.test(navigator.userAgent);
function iosBrowser() {
  const ua = navigator.userAgent;
  if (/CriOS/.test(ua)) return 'Chrome';
  if (/FxiOS/.test(ua)) return 'Firefox';
  if (/EdgiOS/.test(ua)) return 'Edge';
  return 'Safari';
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) return;
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service Worker nicht registriert', err));
}

function banner() {
  let b = document.getElementById('installBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'installBanner';
    b.className = 'install-banner';
    b.hidden = true;
    document.body.appendChild(b);
    b.addEventListener('click', (e) => {
      const t = e.target.closest('[data-install]');
      if (!t) return;
      if (t.dataset.install === 'yes') promptInstall();
      else if (t.dataset.install === 'help') installHelp();
      else { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (err) { /* egal */ } b.hidden = true; }
    });
  }
  return b;
}

function showInstallBanner() {
  const b = banner();
  let dismissed = false;
  try { dismissed = !!localStorage.getItem(DISMISS_KEY); } catch (e) { /* egal */ }
  if (dismissed || isStandalone() || (!installPrompt && !isIos())) { b.hidden = true; return; }
  if (document.body.classList.contains('gated')) { setTimeout(showInstallBanner, 3000); return; }
  b.innerHTML = `<img src="icons/icon-192.png" alt="">
    <div><b>Unsere Küche als App</b><span>${installPrompt
      ? 'Auf den Startbildschirm legen – startet schneller und funktioniert auch offline.'
      : 'Über „Teilen → Zum Home-Bildschirm“ – dann startet die Küche wie eine App.'}</span></div>
    ${installPrompt ? '<button type="button" class="btn small primary" data-install="yes">Installieren</button>' : '<button type="button" class="btn small primary" data-install="help">So geht’s</button>'}
    <button type="button" class="icon-btn" data-install="no" aria-label="Hinweis ausblenden">${icon('x')}</button>`;
  b.hidden = false;
}

export function promptInstall() {
  if (!installPrompt) return;
  installPrompt.prompt();
  installPrompt.userChoice.finally(() => { installPrompt = null; showInstallBanner(); store.setSettings({}); });
}

export const canInstall = () => !!installPrompt;

export function initDevice() {
  registerServiceWorker();
  // Daten nicht vom Browser aufräumen lassen (Safari löscht sonst nach 7 Tagen ohne Besuch).
  navigator.storage?.persist?.().catch(() => {});
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    showInstallBanner();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    banner().hidden = true;
    toast('Unsere Küche ist jetzt als App installiert.');
  });
  setTimeout(showInstallBanner, 1500);
}

// ---------- Anleitung für iPhone, iPad und Safari am Mac ----------

const step = (ic, html) => `<li><span class="step-ic">${icon(ic)}</span><span>${html}</span></li>`;

export function installHelp() {
  const ipad = isIpad();
  const browser = iosBrowser();
  let steps;
  if (!isIos()) {
    steps = [
      step('dots', 'In der Menüleiste oben <b>Ablage</b> öffnen.'),
      step('addSquare', '<b>Zum Dock hinzufügen …</b> wählen und mit <b>Hinzufügen</b> bestätigen.'),
      step('check', '„Unsere Küche“ startet jetzt aus dem Dock wie eine eigene App. Dort einmal mit Google anmelden.'),
    ];
  } else {
    const where = browser === 'Safari'
      ? (ipad ? '<b>oben rechts</b> neben der Adresszeile' : '<b>unten in der Mitte</b>')
      : browser === 'Chrome' ? '<b>oben rechts</b> in der Adresszeile' : 'im Menü des Browsers';
    steps = [
      step('iosShare', `Auf das <b>Teilen-Symbol</b> tippen – ${where}. Siehst du es nicht, zuerst auf <b>„…“</b> neben der Adresszeile tippen und dann auf <b>Teilen</b>.`),
      step('addSquare', 'In der Liste <b>„Zum Home-Bildschirm“</b> wählen – eventuell etwas nach unten wischen oder auf <b>„Mehr“</b> tippen.'),
      step('check', 'Falls angezeigt, <b>„Als Web-App öffnen“</b> eingeschaltet lassen und oben rechts auf <b>Hinzufügen</b> tippen.'),
      step('book', `„Küche“ jetzt vom Home-Bildschirm öffnen und dort <b>einmal mit Google anmelden</b> – die App hat ${ipad ? 'auf dem iPad' : 'auf dem iPhone'} ihren eigenen Speicher.`),
    ];
  }
  openDialog({
    title: isIos() ? `Als App auf ${ipad ? 'dem iPad' : 'dem iPhone'}` : 'Als App auf dem Mac',
    body: `
      <ol class="install-steps">${steps.join('')}</ol>
      ${isIos() ? `<p class="hint-box small">Kein „Zum Home-Bildschirm“ im Menü? Dann ist die Seite vermutlich in WhatsApp, Mail oder einer anderen App geöffnet. Dort zuerst <b>„In Safari öffnen“</b> wählen${browser === 'Safari' ? '' : ` – oder es direkt in Safari probieren (du nutzt gerade ${browser})`}.</p>` : ''}
      <div class="sheet-actions"><button type="button" class="btn primary" data-close>Verstanden</button></div>`,
  });
}

// ---------- Gerätecheck für „Mehr“ ----------

function checks() {
  return [
    ['Als App installiert', isStandalone(), isStandalone() ? 'startet vom Startbildschirm' : isIos() || isMacSafari() ? 'Anleitung über den Knopf unten' : canInstall() ? 'über den Knopf unten möglich' : 'im Browser-Menü „App installieren“'],
    ['Offline-Start', 'serviceWorker' in navigator && !!navigator.serviceWorker.controller, 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'aktiv' : 'aktiv nach dem nächsten Neuladen') : 'nicht unterstützt'],
    ['Verbindung zur Datenbank', navigator.onLine, navigator.onLine ? 'online – Änderungen sehen alle sofort' : 'offline – Änderungen werden übertragen, sobald wieder Netz da ist'],
    ['Offline-Speicher', offlineCache(), offlineCache() ? 'Rezepte und Listen auch ohne Netz verfügbar' : 'nicht verfügbar (z. B. privates Fenster) – die App braucht Internet'],
    ['Fotos auf diesem Gerät', 'indexedDB' in window, 'indexedDB' in window ? '<span data-photo-bytes>wird berechnet …</span>' : 'nicht verfügbar – Fotos werden jedes Mal neu geladen'],
    ['Rezepte teilen & PDF', 'CompressionStream' in window, 'CompressionStream' in window ? 'unterstützt' : 'braucht iOS 16.4 / aktuellen Browser'],
    ['Bildschirm bleibt an (Kochmodus)', 'wakeLock' in navigator, 'wakeLock' in navigator ? 'unterstützt' : 'nicht unterstützt – Bildschirm ggf. manuell anlassen'],
    ['Zwischenablage für Import', !!navigator.clipboard?.readText, navigator.clipboard?.readText ? 'unterstützt' : 'Text bitte selbst einfügen'],
  ];
}

export function deviceSection() {
  return `
    <section class="card settings" id="geraet">
      <div class="card-head"><h2>${icon('box')} App &amp; Gerät</h2><span class="muted small">Gerätecheck</span></div>
      <ul class="check-list">${checks().map(([label, ok, detail]) => `<li class="${ok ? 'ok' : 'warn'}">${icon(ok ? 'check' : 'x')}<span><b>${label}</b><em>${detail}</em></span></li>`).join('')}</ul>
      ${canInstall() ? `<div class="btn-row"><button type="button" class="btn primary" data-install-now>${icon('download')} Als App installieren</button></div>` : ''}
      ${!canInstall() && !isStandalone() && (isIos() || isMacSafari()) ? `<div class="btn-row"><button type="button" class="btn primary" data-install-help>${icon('download')} Als App installieren – so geht’s</button></div>
        <p class="muted small">Auf ${isIpad() ? 'dem iPad' : isIos() ? 'dem iPhone' : 'dem Mac'} gibt es dafür keinen Knopf in der App – ${isIos() ? 'Apple erlaubt das nur über das Teilen-Menü' : 'Safari macht das über das Menü „Ablage“'}. Die Anleitung zeigt die Schritte.</p>` : ''}
    </section>`;
}

export function mountDevice(root) {
  root.querySelector('[data-install-now]')?.addEventListener('click', promptInstall);
  root.querySelector('[data-install-help]')?.addEventListener('click', installHelp);
  const el = root.querySelector('[data-photo-bytes]');
  if (el) {
    Promise.all([photoStorageBytes(), navigator.storage?.estimate?.() ?? null]).then(([bytes, est]) => {
      const free = est?.quota ? `, frei: ca. ${formatBytes(est.quota - (est.usage || 0))}` : '';
      el.textContent = `${formatBytes(bytes)} zwischengespeichert${free}`;
    }).catch(() => { el.textContent = 'unbekannt'; });
  }
}
