/* Service Worker von „Unsere Küche“ – wie bei „Unser Nest“:
   Die App startet auch ohne Internet (z. B. im Supermarkt mit schlechtem Empfang).
   - Eigene Dateien: zuerst aus dem Netz (immer die neueste Version), ohne Verbindung aus dem Zwischenspeicher.
   - Schriften und die Firebase-Bibliothek (feste Version): ändern sich nicht → aus dem Zwischenspeicher.
   Die Daten selbst hält Firestore in seinem eigenen Offline-Speicher; Anfragen an die Datenbank laufen
   nie über diesen Service Worker.
   Bei neuen Dateien: APP_SHELL ergänzen (ein Test prüft das) und CACHE hochzählen. */

var CACHE = 'unsere-kueche-v8';
var APP_SHELL = [
  './', 'index.html', 'teilen.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'js/actions.js', 'js/ai-import.js', 'js/cloud.js', 'js/device.js', 'js/exchange.js', 'js/firebase.js', 'js/firebase-config.js', 'js/firestore-safe.js', 'js/icons.js', 'js/image.js', 'js/importer.js', 'js/photo-upload.js', 'js/photos.js', 'js/main.js', 'js/members.js',
  'js/model.js', 'js/recipe-text.js', 'js/seed.js', 'js/share.js', 'js/share-page.js', 'js/store.js', 'js/theme.js', 'js/ui.js',
  'js/views/data.js', 'js/views/edit.js', 'js/views/import.js', 'js/views/pantry.js', 'js/views/people.js', 'js/views/plan.js',
  'js/views/recipe.js', 'js/views/recipes.js', 'js/views/settings.js', 'js/views/shopping.js',
];
var FIREBASE_SDK = [
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL).then(function () { return cache.addAll(FIREBASE_SDK); });
    }).catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('unsere-kueche-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function networkFirst(request) {
  // cache: 'no-cache' = beim Server nachfragen, ob es eine neuere Version gibt (sonst liefert der
  // Browser nach Updates manchmal alte Dateien aus seinem eigenen Zwischenspeicher).
  return fetch(request.mode === 'navigate' ? request.url : request, { cache: 'no-cache' }).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(request, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(request, { ignoreSearch: true }).then(function (hit) {
      return hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error());
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (hit) {
    return hit || fetch(request).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(request, copy); });
      }
      return res;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
  else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) event.respondWith(cacheFirst(req));
  else if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) event.respondWith(cacheFirst(req));
});
