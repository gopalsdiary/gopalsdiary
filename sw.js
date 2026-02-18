// ============================================================
// Service Worker — Gopals Diary PWA
// Strategy:
//   • Shell / documents  → Network-first, cache fallback
//   • Static assets      → Cache-first, network fallback, then cache
//   • External CDN/API   → Network-only (no caching of third-party auth)
//   • Offline fallback   → /offline.html
// ============================================================

const CACHE_VERSION = 'v3';
const CACHE_NAME    = `gopals-diary-${CACHE_VERSION}`;

// Core shell assets that must be available offline
const PRECACHE_URLS = [
  './',
  './home.html',
  './offline.html',
  './manifest.json',
  './favicon.ico',
  './favicon.png',
  './favicon.svg'
];

// Domains we should NEVER cache (auth / CDN content)
const SKIP_CACHE_ORIGINS = [
  'supabase.co',
  'supabase.io',
  'ibb.co',
  'jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Precache failed:', err))
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('gopals-diary-') && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Helpers ───────────────────────────────────────────────────
function shouldSkipCache(url) {
  return SKIP_CACHE_ORIGINS.some(origin => url.hostname.includes(origin));
}

function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|webp|avif)(\?.*)?$/.test(url.pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Final fallback: offline page
    const offline = await cache.match('./offline.html');
    return offline ?? new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-http(s) requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Skip third-party / auth requests entirely
  if (shouldSkipCache(url)) return;

  // Same-origin only from here on
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    // Static files: cache-first (fast repeated loads)
    event.respondWith(cacheFirst(request));
  } else {
    // HTML / navigation: network-first (always fresh content)
    event.respondWith(networkFirst(request));
  }
});

// ── Background Sync: update check ────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
