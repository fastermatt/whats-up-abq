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
  'cdn.midjourney.com',       // Midjourney category fallback images
  'imagedelivery.net',        // Cloudflare Images CDN (Babydoll's House of Jazz, Sociavore sites)
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
        // Browser cache aggressively — each ?url= is a distinct URL from
        // the browser's perspective.
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
        // Netlify's edge keys the cache on PATH ONLY by default, so every
        // /api/image-proxy?url=X collapsed onto one entry and visitors got
        // whichever image was cached first. The previous workaround disabled
        // the CDN entirely — correct, but it meant every single <img> load
        // spent a function invocation.
        //
        // Netlify-Vary: query=url makes the cache key include the ?url param,
        // which fixes the collision AND lets the edge serve repeats for free.
        'Netlify-CDN-Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
        'Netlify-Vary': 'query=url',
      },
    })
  } catch (err) {
    console.error('[image-proxy] fetch failed:', err)
    return new Response('Failed to fetch image', { status: 500 })
  }
}
