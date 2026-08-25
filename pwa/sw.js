/**
 * Coffee Ratio Calculator — sw.js (Service Worker)
 *
 * Lifecycle: install → activate → fetch
 * Strategy: Cache-first on install, network-first on fetch, cache fallback.
 *
 * ── Install Event ──────────────────────────────────────────────
 * Opens the cache with name CACHE_NAME and pre-caches all static
 * assets listed in ASSETS_TO_CACHE. This ensures offline availability
 * on first load.
 *
 * ── Activate Event ─────────────────────────────────────────────
 * Deletes all caches whose names differ from CACHE_NAME. This
 * cleans up stale versions when the service worker is updated.
 * clients.claim() takes immediate control of open pages.
 *
 * ── Fetch Event ────────────────────────────────────────────────
 * Network-first strategy:
 *   1. Try fetch() from the network
 *   2. If network fails, fall back to caches.match()
 *   3. On successful fetch, clone the response and cache it
 *      (so subsequent offline loads get fresh content)
 */

const CACHE_NAME = 'coffee-ratio-v11';
const ASSETS_TO_CACHE = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
];

// Install — cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(response => response || new Response('Offline'));
      })
  );
});
