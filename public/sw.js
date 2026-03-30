// ABQ Unplugged — Service Worker
// Strategy:
//   - Static assets (JS/CSS/icons/images): Cache-first, serve from cache, update in bg
//   - App shell (HTML): Network-first with cache fallback
//   - Supabase API calls: Network-only (live data required)
//   - places-data.json: Cache-first (large file, rarely changes)

const CACHE_VERSION = 'abq-202603292054';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const DATA_CACHE  = `${CACHE_VERSION}-data`;

// Files to pre-cache on install
const PRECACHE_SHELL = [
  '/',
  '/manifest.json',
];

const PRECACHE_ASSETS = [
  '/favicon.svg',
  '/favicon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/apple-touch-icon-180.png',
  '/og-image.jpg',
];

const PRECACHE_DATA = [
  '/places-data.json',
];

// ─── Install: pre-cache essentials ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then(c => c.addAll(PRECACHE_SHELL)),
      caches.open(ASSET_CACHE).then(c => c.addAll(PRECACHE_ASSETS)),
      caches.open(DATA_CACHE).then(c => c.addAll(PRECACHE_DATA)),
    ]).then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('abq-') && !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: routing strategies ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API — always live data
  if (url.hostname.includes('supabase')) return;

  // Skip browser-extension or non-http requests
  if (!url.protocol.startsWith('http')) return;

  // places-data.json → cache-first (large, stable)
  if (url.pathname === '/places-data.json') {
    event.respondWith(cacheFirst(DATA_CACHE, request));
    return;
  }

  // Hashed JS/CSS assets (/assets/*.js, /assets/*.css) → cache-first immutable
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(ASSET_CACHE, request));
    return;
  }

  // Static files: icons, images, splash, fonts → cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/splash/') ||
    url.pathname.startsWith('/screenshots/') ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(ASSET_CACHE, request));
    return;
  }

  // manifest.json → cache-first
  if (url.pathname === '/manifest.json') {
    event.respondWith(cacheFirst(SHELL_CACHE, request));
    return;
  }

  // App shell / navigation → network-first with offline fallback
  if (request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(networkFirst(SHELL_CACHE, request, '/'));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(SHELL_CACHE, request, null));
});

// ─── Strategy helpers ─────────────────────────────────────────────────────────

async function cacheFirst(cacheName, request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(cacheName, request, fallbackPath) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackPath) {
      const fallback = await caches.match(fallbackPath);
      if (fallback) return fallback;
    }
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ABQ Unplugged — Offline</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:system-ui;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px}
      h1{font-size:2rem;margin-bottom:8px}p{color:#aaa;margin-bottom:24px}
      button{background:#566500;color:#fff;border:none;border-radius:12px;padding:12px 24px;font-size:1rem;cursor:pointer}</style>
      </head><body>
      <div><div style="font-size:3rem">📡</div>
      <h1>You're offline</h1>
      <p>ABQ Unplugged needs a connection to load fresh data.<br>Check your signal and try again.</p>
      <button onclick="location.reload()">Try Again</button></div>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
