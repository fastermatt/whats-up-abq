/**
 * Route remote images through /api/image-proxy so Konva can both:
 *   1. Bypass CAPTCHA/hotlink blocks (abqtodo.com, nhccnm.org, do505.com, lovenm.org)
 *   2. Get CORS headers so the canvas stays exportable (no tainted-canvas errors)
 *
 * Data URLs and same-origin paths pass through unchanged.
 * Domains not on the proxy's allowlist also pass through (user may paste any URL).
 */
const PROXIABLE_DOMAINS = [
  'abqtodo.com',
  'nhccnm.org',
  'do505.com',
  'lovenm.org',
  'img.evbuc.com',
  'cdn.evbuc.com',
  's1.ticketm.net',
  'media.ticketmaster.com',
  'seatgeekimages.com',
  'sgassets.com',
  'cdn.abqunplugged.com',
  'r2.dev',
  'supabase.co',
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
