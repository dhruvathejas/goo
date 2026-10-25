// Offline support. Every app file is precached on install; requests are answered
// from the cache first and refreshed in the background, so the game opens instantly
// and picks up new files on the next launch.
// Bump VERSION on every release: a new version re-downloads the whole set at once,
// so modules that import each other always come from the same release.

const VERSION = 'goo-v2';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/main.js',
  'js/game.js',
  'js/autopilot.js',
  'js/renderer.js',
  'js/input.js',
  'js/audio.js',
  'js/storage.js',
  'js/ring.js',
  'fonts/fredoka-latin.woff2',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  // `reload` skips the HTTP cache so a new version never precaches stale copies.
  const requests = FILES.map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      // By URL: navigation requests can't be re-issued with a different cache mode.
      const refresh = fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((response) => {
          // Only whole, successful responses go in the cache (206 partials would throw).
          if (response.status === 200) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached || Response.error());
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return refresh;
    }),
  );
});
