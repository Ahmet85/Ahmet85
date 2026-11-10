// Çevrimdışı oynanabilmesi için önbellek. Önce ağ (her seferinde sunucuya 'değişti mi?' diye sorulur),
// ağ yoksa önbellek. Böylece güncellemeler hemen gelir, internet yokken de oyun açılır.
const CACHE = 'okto-v27';
const FILES = ['./', './index.html', './game.js', './manifest.json', './icon.svg', './apple-touch-icon.png', './okto.js', './reef.js', './zones.js', './enemies.js', './bosses.js', './campaign.js', './boss-ai.js', './cinema.js', './skills.js', './title.js', './music.js', './fonts/fredoka-700-latin.woff2', './fonts/fredoka-700-latin-ext.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(r => {
    if (r.ok && !req.url.includes('/splash/')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
