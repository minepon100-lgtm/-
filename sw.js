// オフラインキャッシュ（http(s)で配信した場合のみ有効）
const CACHE = 'wvd-offline-v1';
const FILES = ['./', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './js/data.js', './js/maps.js', './js/core.js', './js/ui.js', './js/creation.js', './js/town.js',
  './js/gacha.js', './js/dungeon.js', './js/battle.js', './js/main.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res;
  })));
});
