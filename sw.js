// שומר את האולפן במכשיר כדי שייפתח כמו אפליקציה (וגם בלי אינטרנט).
// כל פעם קודם מנסים מהאינטרנט – כדי לקבל עדכונים – ורק בלי אינטרנט משתמשים בעותק השמור.
const CACHE = 'ai-studio-v1';
const FILES = ['./', 'index.html', 'app.js', 'player.js', 'game-runtime.js', 'paint.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // שירותי AI – תמיד ישר לאינטרנט
  e.respondWith(fetch(e.request)
    .then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
