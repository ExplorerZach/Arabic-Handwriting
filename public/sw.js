// Bump this version string every time you deploy changes
const CACHE = 'arabic-v126';

// All critical assets needed for the app to work
const ASSETS = [
  '/',
  '/index.html',
  '/assets/index-bKwED3TJ.js',
  '/assets/index-C1YSdnxF.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ────────────────────────────────────────────
// INSTALL — cache all critical assets
// ────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        console.log('[SW] Caching critical assets');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting()) // Activate new SW immediately
  );
});

// ────────────────────────────────────────────
// ACTIVATE — clean up old caches
// ────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim()) // Take control of all open tabs
  );
});

// ────────────────────────────────────────────
// FETCH — serve from cache, fall back to network
// ────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;

  // 1. Let API calls pass through to the network (no caching)
  if (request.url.includes('openrouter.ai')) return;

  // 2. Only handle GET requests
  if (request.method !== 'GET') return;

  e.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Serve from cache immediately
          return cachedResponse;
        }

        // Not in cache — fetch from network
        return fetch(request)
          .then(networkResponse => {
            // Don't cache non-ok responses or opaque responses
            if (
              !networkResponse ||
              networkResponse.status !== 200 ||
              networkResponse.type === 'opaque'
            ) {
              return networkResponse;
            }

            // Cache the new resource for future use
            const responseToCache = networkResponse.clone();
            caches.open(CACHE).then(cache => {
              cache.put(request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
            // Both cache and network failed
            // For navigation requests (page loads), serve the cached index.html
            // This is essential for SPA routing to work offline
            if (request.mode === 'navigate') {
              console.log('[SW] Navigation failed, serving cached /index.html');
              return caches.match('/index.html');
            }

            // For other requests (images, scripts, etc.), just fail gracefully
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});
