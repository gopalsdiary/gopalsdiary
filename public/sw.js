// Service Worker for Gopals Diary PWA
const CACHE_NAME = 'gopals-diary-v2';
// Use relative paths because app may be served from a subfolder (e.g., /gopalsdiary/)
const CORE_ASSETS = [
  'index.html',
  'offline.html',
  'manifest.json',
  'favicon.svg'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .catch(err => console.log('[SW] Precaching failed:', err))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle navigation and same-origin GET requests with caching strategies
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Network first for navigations
            const networkResponse = await fetch(req);
            // Optionally update cache
            const cache = await caches.open(CACHE_NAME);
            cache.put('index.html', networkResponse.clone());
            return networkResponse;
        } catch (err) {
          console.warn('[SW] Navigation fetch failed, serving offline page');
          const cache = await caches.open(CACHE_NAME);
          const offline = await cache.match('offline.html');
          return offline || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
        }
      })()
    );
    return;
  }

  if (req.method === 'GET' && req.url.startsWith(self.location.origin)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh.status === 200 && fresh.type === 'basic') {
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch (err) {
          // Fallback: offline page only for document requests
          if (req.destination === 'document') {
            const offline = await cache.match('offline.html');
            return offline || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
          }
          return new Response('', { status: 503 });
        }
      })()
    );
  }
});
