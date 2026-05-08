/**
 * Shared image URL helpers — used in both server components (page.tsx)
 * and client components (EventImage.tsx) to ensure preload URLs
 * exactly match the rendered <img> src values.
 */

/** Domains that CAPTCHA/hotlink-block direct browser loads.
 *  Routing through /api/image-proxy fetches server-side from Netlify's IP. */
export const PROXY_DOMAINS = [
  'abqtodo.com',
  'nhccnm.org',
  'do505.com',
  'lovenm.org',
  'seatgeekimages.com',   // ad-blockers sometimes flag SeatGeek's image CDN
  's1.ticketm.net',       // Ticketmaster CDN
  'media.ticketmaster.com',
]

/** Route through /api/image-proxy if the domain is in PROXY_DOMAINS. */
export function proxyIfNeeded(url: string): string {
  try {
    const host = new URL(url).hostname
    if (PROXY_DOMAINS.some(d => host === d || host.endsWith('.' + d))) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`
    }
  } catch {
    // malformed URL — return as-is
  }
  return url
}

/**
 * Route external image URLs through Netlify Image CDN for automatic
 * WebP/AVIF conversion and resizing. Skips:
 *  - data: URIs (inline images)
 *  - URLs already going through /.netlify/ (avoid double-proxying)
 *  - URLs already going through /api/image-proxy (handled by proxyIfNeeded)
 */
export function netlifyImageUrl(url: string): string {
  if (
    url.startsWith('data:') ||
    url.startsWith('/.netlify/') ||
    url.startsWith('/api/image-proxy')
  ) {
    return url
  }
  return `/.netlify/images?url=${encodeURIComponent(url)}&w=600&q=75&fm=avif`
}

/**
 * Compute the final src URL for an event image — the exact value that
 * will be in the <img src> attribute. Use this for preload <link> hrefs
 * so the browser can match them correctly.
 */
export function eventImageSrc(rawUrl: string): string {
  return netlifyImageUrl(proxyIfNeeded(rawUrl))
}
