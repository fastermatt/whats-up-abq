/**
 * Image proxy — fetches external images server-side and serves them with proper headers.
 *
 * Two use cases:
 * 1. IG card PNG generation (html-to-image needs CORS-allowed images)
 * 2. Community event images (abqtodo.com, nhccnm.org etc.) that CAPTCHA-block
 *    direct browser loads. Fetching from Netlify's server IP bypasses the block.
 *
 * Only proxies http/https URLs. Cached for 7 days at the CDN edge — event
 * images never change after publication.
 */
export const dynamic = 'force-dynamic'

// Domains this proxy is allowed to fetch from
const ALLOWED_DOMAINS = [
  'abqtodo.com',
  'nhccnm.org',
  'do505.com',
  'lovenm.org',
  'abqtodo.com',
  'img.evbuc.com',
  'cdn.evbuc.com',
  's1.ticketm.net',
  'media.ticketmaster.com',
  'seatgeekimages.com',
  'sgassets.com',
  'cdn.abqunplugged.com',
  'supabase.co',
  'r2.dev',           // Cloudflare R2 public buckets (pub-*.r2.dev) — used for cached_photo_url
  'bsmvfutebmbkjvlrhiyq.supabase.co', // Supabase Storage CDN (place photos, etc.)
]

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return new Response('Missing url parameter', { status: 400 })
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return new Response('Only http/https URLs are supported', { status: 400 })
  }

  // Check allowed domains
  let targetHost: string
  try {
    targetHost = new URL(url).hostname
  } catch {
    return new Response('Invalid URL', { status: 400 })
  }

  const isAllowed = ALLOWED_DOMAINS.some(d => targetHost === d || targetHost.endsWith('.' + d))
  if (!isAllowed) {
    return new Response('Domain not allowed', { status: 403 })
  }

  try {
    // Use a browser User-Agent + same-origin Referer to bypass hotlink/CAPTCHA protections
    const targetOrigin = new URL(url).origin
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Referer': targetOrigin + '/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })

    const contentType = res.headers.get('content-type') || ''

    // If the upstream returned HTML, it's a CAPTCHA/block page — not an image
    if (!res.ok || contentType.startsWith('text/')) {
      console.warn(`[image-proxy] Non-image response from ${url}: status=${res.status} type=${contentType}`)
      return new Response('Image unavailable', { status: 404 })
    }

    const buffer = await res.arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        // Cache aggressively — event images are effectively immutable
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
        'Netlify-CDN-Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('[image-proxy] fetch failed:', err)
    return new Response('Failed to fetch image', { status: 500 })
  }
}
