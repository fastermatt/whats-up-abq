/**
 * ABQ Unplugged — Service Worker
 *
 * Handles:
 * 1. Web Push notifications (receive + show)
 * 2. Notification clicks (open/focus app)
 * 3. Offline fallback for installed PWA — serves /offline when the
 *    network is fully unavailable. Does NOT cache HTML/event data
 *    (would show stale content); only caches the offline shell + icons.
 *
 * Cache strategy is intentionally minimal: precache the offline page
 * and brand icons so the installed PWA never shows a browser-default
 * connection-error chrome. Everything else goes network-first.
 */

const APP_NAME = 'ABQ Unplugged'
const DEFAULT_ICON = '/icon-192.png'
const DEFAULT_URL  = '/'

// Cache version — bump to force clients to re-precache.
// Increment when the offline page or precached assets change.
const CACHE_VERSION = 'abq-shell-v1'
const PRECACHE_URLS = [
  '/offline',
  '/icon-192.png',
  '/icon-512.png',
  '/logo-terra.svg',
  '/manifest.json',
]

// ── Install: precache the offline shell ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // If any single asset fails (e.g. dev environment), don't block install.
      })
    )
  )
  self.skipWaiting()
})

// ── Activate: drop stale cache versions ──────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: network-first, fall back to /offline for navigations ─────────────
// Only intercepts top-level navigation requests so dynamic data + APIs always
// hit the network. When the network is fully unavailable AND the request is
// a navigation, serve the precached /offline page instead of the browser
// default connection-error chrome.
self.addEventListener('fetch', (event) => {
  const { request } = event
  // Only handle GETs
  if (request.method !== 'GET') return
  // Only intercept navigations (top-level page loads)
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_VERSION)
      const offlineRes = await cache.match('/offline')
      return offlineRes ?? new Response('Offline', { status: 503, statusText: 'Offline' })
    })
  )
})

// ── Push event ────────────────────────────────────────────────────────────────
// Fired when the server sends a push message via Web Push Protocol.
// Parse the JSON payload and show a system notification.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: APP_NAME, body: event.data?.text() || 'Something is happening in ABQ tonight' }
  }

  const title   = data.title   || APP_NAME
  const options = {
    body:               data.body    || 'Tap to see what\'s on tonight',
    icon:               data.icon    || DEFAULT_ICON,
    badge:              DEFAULT_ICON,
    data:               { url: data.url || DEFAULT_URL },
    tag:                data.tag     || 'abq-unplugged',
    renotify:           false,
    requireInteraction: false,
    silent:             false,
    timestamp:          Date.now(),
    actions: data.actions || [],
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// ── Notification click ────────────────────────────────────────────────────────
// When the user taps a notification: close it, then open or focus the app.

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || DEFAULT_URL
  const fullUrl = new URL(url, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If the app is already open in a tab/window, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(fullUrl)
          return
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(fullUrl)
    })
  )
})

// ── Push subscription change ──────────────────────────────────────────────────
// Fires when the browser rotates push credentials. Re-subscribe automatically.

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then((subscription) => {
      return fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription }),
      })
    })
  )
})
