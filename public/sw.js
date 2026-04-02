// ABQ Unplugged — Service Worker
// Strategy:
//   - Static assets (JS/CSS/icons/images): Cache-first, serve from cache, update in bg
//   - App shell (HTML): Network-first with cache fallback
//   - Supabase API calls: Network-only (live data required)
//   - places-data.json: Cache-first (large file, rarely changes)

const CACHE_VERSION = 'abq-202604011500';
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
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
      <title>ABQ Unplugged — Offline</title>
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{
          font-family:'Helvetica Neue',system-ui,sans-serif;
          background:#f5f0e8;
          display:flex;align-items:center;justify-content:center;
          min-height:100dvh;padding:32px 24px;text-align:center;
        }
        .card{
          background:#fff;border-radius:20px;padding:40px 32px;
          box-shadow:4px 4px 0 rgba(0,0,0,0.08);max-width:360px;width:100%;
        }
        .logo{
          width:72px;height:72px;border-radius:16px;
          background:linear-gradient(135deg,#8B3A0F,#c45000);
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 20px;box-shadow:0 4px 16px rgba(139,58,15,0.35);
        }
        .logo svg{width:40px;height:40px}
        h1{font-size:22px;font-weight:900;color:#1a1a1a;letter-spacing:-0.03em;margin-bottom:8px}
        p{font-size:14px;color:#666;line-height:1.55;margin-bottom:28px}
        button{
          width:100%;padding:14px 20px;
          background:linear-gradient(135deg,#8B3A0F,#c45000);
          color:#fff;border:none;border-radius:14px;
          font-size:15px;font-weight:800;cursor:pointer;
          letter-spacing:-0.01em;
          box-shadow:0 4px 12px rgba(139,58,15,0.3);
        }
        .signal{font-size:48px;margin-bottom:20px}
      </style>
      </head><body>
      <div class="card">
        <div class="signal">📡</div>
        <div class="logo">
          <svg viewBox="0 0 40 40" fill="none">
            <text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle"
              font-family="Georgia,serif" font-weight="900" font-size="22" fill="white">ABQ</text>
          </svg>
        </div>
        <h1>You're offline</h1>
        <p>ABQ Unplugged needs a connection to show fresh events and places.<br>Check your signal and try again.</p>
        <button onclick="location.reload()">Try Again</button>
      </div>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
