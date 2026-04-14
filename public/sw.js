// Service Worker — PWA installability only.
// No fetch interception. No caching. All requests go to network.

const CACHE_NAME = 'greetme-v3';

self.addEventListener('install', (event) => {
  // Clear any previously cached assets
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear all caches on activate (belt and suspenders)
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});
