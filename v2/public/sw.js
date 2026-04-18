/**
 * ABQ Unplugged — Service Worker
 *
 * Minimal SW that handles:
 * 1. Web Push notifications (receive + show)
 * 2. Notification clicks (open/focus app)
 *
 * No caching strategy — this is a dynamic events site.
 * The browser handles its own HTTP caching; a SW cache
 * would show stale event data and confuse users.
 */

const APP_NAME = 'ABQ Unplugged'
const DEFAULT_ICON = '/icon-192.png'
const DEFAULT_URL  = '/'

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
