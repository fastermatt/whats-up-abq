/**
 * Shared image URL helpers — used in both server components (page.tsx)
 * and client components (EventImage.tsx) to ensure preload URLs
 * exactly match the rendered <img> src values.
 */

/** Domains that CAPTCHA/hotlink-block direct browser loads.
 *  Routing through /api/image-proxy fetches server-side from Netlify's IP.
 *
 *  Removed 2026-05-09 (Lighthouse caught a regression):
 *    - s1.ticketm.net, media.ticketmaster.com, seatgeekimages.com
 *  Direct fetches to TM/SG CDNs now succeed (verified 200 OK with browser UA).
 *  Routing them through Netlify Image CDN instead gives AVIF + resize, cutting
 *  per-card image bytes from ~510 KB original JPEG to ~30 KB AVIF. They're in
 *  netlify.toml's remote_images allowlist now. Keep the abqtodo / nhccnm /
 *  do505 / lovenm domains — they still hotlink-block. */
export const PROXY_DOMAINS = [
  'abqtodo.com',
  'nhccnm.org',
  'do505.com',
  'lovenm.org',
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
 *
 * `width` is the target width in CSS pixels. Pass the actual rendered
 * card width (not 2x) — Netlify already serves AVIF which scales well
 * on hi-DPI screens. Defaults to 600 for back-compat.
 */
export function netlifyImageUrl(url: string, width = 600): string {
  if (
    url.startsWith('data:') ||
    url.startsWith('/.netlify/') ||
    url.startsWith('/api/image-proxy')
  ) {
    return url
  }
  return `/.netlify/images?url=${encodeURIComponent(url)}&w=${width}&q=70&fm=avif`
}

/**
 * Compute the final src URL for an event image — the exact value that
 * will be in the <img src> attribute. Use this for preload <link> hrefs
 * so the browser can match them correctly.
 */
export function eventImageSrc(rawUrl: string, width = 600): string {
  return netlifyImageUrl(proxyIfNeeded(rawUrl), width)
}
