/**
 * Route remote images through /api/image-proxy ONLY when necessary.
 *
 * The invariant (see memory/image_system.md): the IG admin image must ALWAYS
 * match the public page image. The public site loads Supabase/R2/TM/SG/EB URLs
 * directly, so the editor must too — otherwise a stale proxy cache at any layer
 * (browser, Netlify edge, Cloudflare) can serve different bytes than the site.
 *
 * Only hosts that CAPTCHA-block browser requests genuinely require the proxy.
 * Everything else has Access-Control-Allow-Origin: * set at the origin CDN,
 * so Konva can load them directly without tainting the canvas.
 */
const PROXIABLE_DOMAINS = [
  'abqtodo.com',
  'nhccnm.org',
  'do505.com',
  'lovenm.org',
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
