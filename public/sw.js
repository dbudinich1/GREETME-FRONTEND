// Service Worker — PWA installability only.
// No fetch interception. No caching. All requests go to network.
// Bumping CACHE_NAME forces the browser to treat this as a NEW service worker:
// it re-installs, purges ALL caches (incl. any from a prior caching SW), and
// skipWaiting()+clients.claim() activate it immediately so the page can reload to
// the freshly-deployed bundle (see the controllerchange handler in index.html).

const CACHE_NAME = 'greetme-v4';

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
