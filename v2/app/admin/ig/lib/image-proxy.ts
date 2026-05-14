/**
 * Route remote images through /api/image-proxy ONLY when necessary.
 *
 * Two reasons a domain needs proxying in the Konva/canvas context:
 *
 * 1. CAPTCHA-block: abqtodo, nhccnm, do505, lovenm block direct browser fetches
 *    entirely — the proxy fetches server-side (no CAPTCHA) and re-serves.
 *
 * 2. No CORS headers: Konva calls useImage(url, 'anonymous') which sets
 *    crossOrigin='anonymous' on the underlying HTMLImageElement. If the CDN
 *    doesn't return Access-Control-Allow-Origin, the browser refuses the load
 *    entirely and img stays undefined → blank canvas slot.
 *    Ticketmaster (s1.ticketm.net, media.ticketmaster.com) and SeatGeek CDNs
 *    don't send CORS headers — they work fine in plain <img> tags on the public
 *    site but fail in the canvas editor. Proxy re-serves them with the right headers.
 *
 * Note: the public site (EventImage component) uses plain <img> tags, not canvas,
 * so those CDNs load fine there without proxying. This proxy is only needed here.
 */
const PROXIABLE_DOMAINS = [
  // CAPTCHA-blocked domains
  'abqtodo.com',
  'nhccnm.org',
  'do505.com',
  'lovenm.org',
  // No CORS headers — canvas load fails without proxy
  's1.ticketm.net',
  'media.ticketmaster.com',
  'seatgeekimages.com',
]

export function proxyIfNeeded(url: string): string {
  if (!url) return url
  if (url.startsWith('data:')) return url
  if (url.startsWith('/'))     return url
  try {
    const host = new URL(url).hostname
    if (PROXIABLE_DOMAINS.some(d => host === d || host.endsWith('.' + d))) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`
    }
  } catch {
    // malformed URL — return as-is
  }
  return url
}
