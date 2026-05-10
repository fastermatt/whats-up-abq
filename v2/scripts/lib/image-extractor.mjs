/**
 * image-extractor.mjs — intelligent best-image picker for scraped HTML
 *
 * Given an HTML string + base URL, returns the best image URL it can find,
 * preferring (in order):
 *   1. <meta property="og:image">
 *   2. <meta name="twitter:image"> (and twitter:image:src)
 *   3. JSON-LD Event.image (string, array, or { url })
 *   4. <img> with class/id matching event|featured|hero|cover|banner|thumbnail (width >= 200 if known)
 *   5. First <img> with width >= 200 in <article>/<main>/<.content>
 *   6. First reasonable <img> on page
 *
 * Filters out:
 *   - data: URIs
 *   - .svg sprites and small/icon SVGs
 *   - URLs containing logo|icon|sprite|placeholder|pixel|1x1|spacer|blank
 *   - tiny dimensions (width or height < 100 when declared)
 *
 * Resolves relative URLs against the base URL.
 *
 * Public API:
 *   extractBestImage(html, baseUrl)      → string | null
 *   extractAllCandidates(html, baseUrl)  → string[]   (debugging / dry-run)
 *   isLikelyBadImage(url)                → boolean    (exposed for reuse)
 *
 * Uses cheerio if available (it is, in v2/package.json), with a regex fallback.
 */

import { load as loadCheerio } from 'cheerio'

// ── Blacklist substrings (case-insensitive) ──────────────────────────────────
const BAD_URL_PARTS = [
  'logo', 'icon', 'sprite', 'placeholder', 'pixel', '1x1',
  'spacer', 'blank.gif', 'transparent.png', 'avatar', 'favicon',
  '/wp-includes/images/', 'gravatar.com',
]

// File extensions that look like images
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif|heic)(\?|#|$)/i

export function isLikelyBadImage(url) {
  if (!url) return true
  const lower = url.toLowerCase()
  if (lower.startsWith('data:')) return true
  // Block .svg sprites (sprites usually contain "sprite" already, but block plain .svg too as
  // these are almost never event photos — they're icons or logos).
  if (/\.svg(\?|#|$)/i.test(lower)) return true
  for (const bad of BAD_URL_PARTS) {
    if (lower.includes(bad)) return true
  }
  return false
}

/** Resolve a possibly-relative URL against a base URL. Returns null on failure. */
function resolveUrl(url, baseUrl) {
  if (!url) return null
  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return null
  }
}

/** Parse an int safely from a string/number attribute. */
function toInt(v) {
  if (v === undefined || v === null) return null
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? n : null
}

/** Extract og:image / twitter:image / JSON-LD via cheerio.  Returns ordered candidates. */
function extractMetaCandidates($, baseUrl) {
  const out = []

  // og:image (and og:image:secure_url, og:image:url)
  $('meta[property="og:image"], meta[property="og:image:secure_url"], meta[property="og:image:url"]').each((_, el) => {
    const c = $(el).attr('content')
    if (c) out.push(c)
  })

  // twitter:image (name AND property variants)
  $('meta[name="twitter:image"], meta[property="twitter:image"], meta[name="twitter:image:src"], meta[property="twitter:image:src"]').each((_, el) => {
    const c = $(el).attr('content')
    if (c) out.push(c)
  })

  // JSON-LD Event.image
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).contents().text()
    if (!txt) return
    try {
      const data = JSON.parse(txt)
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        collectJsonLdImages(item, out)
      }
    } catch {
      // Some sites embed multiple JSON objects; try a more lenient extraction
      const imgMatches = [...txt.matchAll(/"image"\s*:\s*"([^"]+)"/g)]
      for (const m of imgMatches) out.push(m[1])
    }
  })

  return out
    .map(u => resolveUrl(u, baseUrl))
    .filter(u => u && !isLikelyBadImage(u))
}

function collectJsonLdImages(node, out) {
  if (!node || typeof node !== 'object') return
  // If the node has @type Event/Movie/CreativeWork/etc., use its image
  const img = node.image
  if (img) {
    if (typeof img === 'string') out.push(img)
    else if (Array.isArray(img)) {
      for (const i of img) {
        if (typeof i === 'string') out.push(i)
        else if (i && typeof i === 'object' && typeof i.url === 'string') out.push(i.url)
      }
    } else if (typeof img === 'object' && typeof img.url === 'string') {
      out.push(img.url)
    }
  }
  // Recurse into @graph and itemListElement
  if (Array.isArray(node['@graph'])) {
    for (const n of node['@graph']) collectJsonLdImages(n, out)
  }
  if (Array.isArray(node.itemListElement)) {
    for (const n of node.itemListElement) collectJsonLdImages(n?.item ?? n, out)
  }
}

/**
 * Extract <img> candidates ranked by:
 *  - "feature" hint in class/id/alt → boosted
 *  - width attribute (when present)
 *  - container hint (article/main/content)
 */
function extractImgCandidates($, baseUrl) {
  const FEATURE_HINTS = /event|featured|hero|cover|banner|thumbnail|wp-post-image|attachment-/i
  const CONTAINER_SEL = 'article, main, [role="main"], .content, .entry-content, .event, .post, .single'

  const candidates = []

  $('img').each((_, el) => {
    const $el = $(el)
    const rawSrc = $el.attr('src')
      || $el.attr('data-src')
      || $el.attr('data-lazy-src')
      || $el.attr('data-original')
      || ($el.attr('srcset') || '').split(',').pop()?.trim().split(/\s+/)[0]
    if (!rawSrc) return

    const url = resolveUrl(rawSrc, baseUrl)
    if (!url || isLikelyBadImage(url)) return

    const widthAttr  = toInt($el.attr('width'))
    const heightAttr = toInt($el.attr('height'))
    if ((widthAttr !== null && widthAttr < 100) || (heightAttr !== null && heightAttr < 100)) return

    const className = ($el.attr('class') || '') + ' ' + ($el.attr('id') || '') + ' ' + ($el.attr('alt') || '')
    const isFeatureHint = FEATURE_HINTS.test(className)

    // Container check: any ancestor matching CONTAINER_SEL
    const inContainer = $el.parents(CONTAINER_SEL).length > 0

    candidates.push({
      url,
      width: widthAttr ?? 0,
      isFeatureHint,
      inContainer,
    })
  })

  // Rank: feature-hint > inContainer > width descending
  candidates.sort((a, b) => {
    if (a.isFeatureHint !== b.isFeatureHint) return a.isFeatureHint ? -1 : 1
    if (a.inContainer !== b.inContainer) return a.inContainer ? -1 : 1
    return (b.width || 0) - (a.width || 0)
  })

  return candidates.map(c => c.url)
}

/** Regex fallback if cheerio fails to parse (extremely rare). */
function regexExtract(html, baseUrl) {
  const out = []
  const ogRe = /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/gi
  for (const m of html.matchAll(ogRe)) out.push(m[1])
  // reverse order tag attributes
  const ogReRev = /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["']/gi
  for (const m of html.matchAll(ogReRev)) out.push(m[1])
  // JSON-LD lite
  const ldImgRe = /"image"\s*:\s*"([^"]+)"/g
  for (const m of html.matchAll(ldImgRe)) out.push(m[1])
  return out.map(u => resolveUrl(u, baseUrl)).filter(u => u && !isLikelyBadImage(u))
}

/** Return all candidate image URLs in preference order (debug helper). */
export function extractAllCandidates(html, baseUrl) {
  if (!html) return []
  let $
  try {
    $ = loadCheerio(html)
  } catch {
    return regexExtract(html, baseUrl)
  }

  const meta = extractMetaCandidates($, baseUrl)
  const imgs = extractImgCandidates($, baseUrl)

  const ordered = [...meta, ...imgs]
  // Dedup while preserving order
  const seen = new Set()
  const dedup = []
  for (const u of ordered) {
    if (seen.has(u)) continue
    seen.add(u)
    dedup.push(u)
  }
  return dedup
}

/** Return the single best image URL, or null if none found. */
export function extractBestImage(html, baseUrl) {
  const all = extractAllCandidates(html, baseUrl)
  return all[0] ?? null
}

/**
 * Validate that a URL points to a real image (HEAD request, fall back to GET if HEAD blocked).
 * Returns true if Content-Type starts with `image/`, OR the URL has an image extension and
 * we couldn't validate via headers.
 *
 * Use sparingly — adds an HTTP roundtrip.
 */
export async function validateImageUrl(url, opts = {}) {
  if (!url) return false
  const { timeoutMs = 8_000, userAgent = 'ABQUnplugged/2.0 (+https://abqunplugged.com)' } = opts

  const hasImageExt = IMAGE_EXT_RE.test(url)

  try {
    let res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': userAgent },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    // Some hosts 405/403 HEAD; fall back to a tiny GET
    if (!res.ok || res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': userAgent, 'Range': 'bytes=0-1023' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      })
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (ct.startsWith('image/')) return true
    if (res.ok && hasImageExt) return true
    return false
  } catch {
    return hasImageExt
  }
}
