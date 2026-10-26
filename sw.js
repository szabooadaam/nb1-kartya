/* Offline működés: az app fájljai a telefonon is tárolódnak.
 * Ha van net, mindig a friss fájlokat tölti le (így a kezdőképernyős app is frissül),
 * net nélkül a tárolt példányt mutatja. Új kiadásnál érdemes a VERSION-t is növelni. */
const VERSION = 'nb1-kartya-0.8beta-4';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/format.js',
  './js/catalog.js',
  './js/colors.js',
  './js/card.js',
  './js/data.js',
  './js/app.js',
  './fonts/inter-latin-wght-normal.woff2',
  './fonts/inter-latin-ext-wght-normal.woff2',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' – a böngésző saját gyorsítótárát is megkerüli, hogy tényleg a friss fájl kerüljön be
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// előbb a hálózat (friss), ha nincs net, a tárolt példány
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.open(VERSION).then((c) => c.match(e.request, { ignoreSearch: true })).then((hit) => hit || caches.match('./index.html')))
  );
});
