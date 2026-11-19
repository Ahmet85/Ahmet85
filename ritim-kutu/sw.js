// Çevrimdışı çalışma. Yeni sürüm yayınlarken CACHE adını artır.
const CACHE = 'ritim-kutu-v6';
const FILES = ['./', 'index.html', 'styles.css?v=6', 'core.js?v=6', 'data.js?v=6', 'app.js?v=6', 'manifest.webmanifest',
  'fonts/caveat-latin-500-normal.woff2', 'fonts/caveat-latin-ext-500-normal.woff2', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('ritim-kutu-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// Önce ağ (güncel sürüm), olmazsa önbellek (çevrimdışı)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then((m) => m || caches.match('index.html'))));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
