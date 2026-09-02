#!/usr/bin/env node
/**
 * scrape-amp-concerts.mjs — scraper for ampconcerts.org
 *
 * AMP Concerts is New Mexico's premier nonprofit concert promoter. They book
 * shows at 15+ venues across the state including KiMo, NHCC, The Lensic, Meow
 * Wolf, Tumbleroot, Winrock Park, Engine70, FUSION, Unit B, etc.
 *
 * Stack: CodeIgniter (PHP) site + holdmyticket.com ticketing platform.
 *
 * Discovery approach (in order tried):
 *   ✓ /wp-json/tribe/events/v1/events  → 404 (NOT WordPress)
 *   ✓ holdmyticket widget data API     → opaque riot.js bundle, fetch_all over CORS
 *   ✓ JSON-LD Event blocks on /event/{id}/{slug} pages → CLEAN, COMPLETE, USED
 *
 * Strategy:
 *   1. Fetch ampconcerts.org homepage (lists ~40-60 upcoming events)
 *   2. Extract every /event/{id}/{slug} URL
 *   3. For each event page:
 *      - Parse the JSON-LD <script type="application/ld+json"> Event block
 *      - Pull title, startDate (with TZ), location.name, location.address,
 *        image, offers (for ticket URL + price)
 *      - Pull og:description for the description
 *   4. Filter to greater-ABQ only (exclude Santa Fe, Las Cruces, Taos)
 *   5. Upsert to Supabase events table with source='local', id='amp-{eventId}'
 *
 * Usage:
 *   node scripts/scrape-amp-concerts.mjs              # full run
 *   node scripts/scrape-amp-concerts.mjs --dry-run    # no DB writes; print first 10
 *   node scripts/scrape-amp-concerts.mjs --limit=10   # only first 10
 *   node scripts/scrape-amp-concerts.mjs --verbose    # extra logging
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { extractBestImage, isLikelyBadImage } from './lib/image-extractor.mjs'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Env ───────────────────────────────────────────────────────────────────────
for (const f of [join(__dir, '.env'), join(__dir, '../.env.local')]) {
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

// ── Args ──────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2)
const DRY_RUN  = args.includes('--dry-run')
const VERBOSE  = args.includes('--verbose')
const LIMIT    = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '999')

const UA       = 'ABQUnplugged/2.0 (community aggregator; 4mattcarlson@gmail.com)'
const BASE_URL = 'https://www.ampconcerts.org'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Greater Albuquerque allow-list (everything else gets filtered out) ────────
// AMP books at 15+ venues across NM. Per the brief:
//   KEEP: Albuquerque, Rio Rancho, NHCC, KiMo (ABQ), Bernalillo, Corrales,
//         Sandia/Santa Ana Star arena venues
//   EXCLUDE: Santa Fe (Lensic, Meow Wolf, Unit B, Tumbleroot in SF, etc.),
//            Las Cruces, Taos
const ABQ_CITIES = new Set([
  'albuquerque', 'abq', 'rio rancho', 'bernalillo', 'los ranchos',
  'los ranchos de albuquerque', 'corrales', 'sandia park', 'tijeras',
  'cedar crest', 'placitas', 'edgewood',
])

// ── HTTP ──────────────────────────────────────────────────────────────────────
async function httpGet(url, timeout = 15000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
      signal: AbortSignal.timeout(timeout),
    })
    return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : null }
  } catch (e) {
    return { ok: false, error: e.message, text: null }
  }
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
function decodeEntities(s) {
  if (!s) return s
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim()
}

function getMeta(html, propOrName) {
  // Try both property= and name= variants in either order
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${propOrName}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${propOrName}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return decodeEntities(m[1])
  }
  return null
}

// ── Discovery: list all event URLs from homepage ──────────────────────────────
async function fetchEventUrls() {
  const r = await httpGet(BASE_URL, 20000)
  if (!r.ok || !r.text) {
    console.error(`Failed to fetch ${BASE_URL}: ${r.error ?? r.status}`)
    return []
  }

  // URL pattern: /event/{numericId}/{slug}
  const matches = [...r.text.matchAll(/\/event\/(\d+)\/([a-z0-9_-]+)/gi)]
  const seen = new Set()
  const out = []
  for (const [, id, slug] of matches) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      slug,
      url: `${BASE_URL}/event/${id}/${slug}`,
    })
  }
  return out
}

// ── Per-event extraction: parse JSON-LD ───────────────────────────────────────
function extractJsonLd(html) {
  // Find all JSON-LD script blocks; grab the first one whose @type is "Event"
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const [, body] of blocks) {
    try {
      const parsed = JSON.parse(body.trim())
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        if (item['@type'] === 'Event' || (Array.isArray(item['@type']) && item['@type'].includes('Event'))) {
          return item
        }
      }
    } catch {
      // Try a more lenient cleanup pass — strip control chars / trailing junk
      try {
        const cleaned = body.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        const parsed = JSON.parse(cleaned)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
          if (item && (item['@type'] === 'Event' || (Array.isArray(item['@type']) && item['@type'].includes('Event')))) {
            return item
          }
        }
      } catch { /* ignore */ }
    }
  }
  return null
}

/** Format ISO datetime like "2026-05-15T19:00:00-06:00" → { date: "2026-05-15", time: "19:00" } */
function splitIsoDateTime(iso) {
  if (!iso || typeof iso !== 'string') return { date: null, time: null }
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return { date: null, time: null }
  const date = m[1]
  // Time is optional; only set HH:MM if it's present AND not midnight (which often means "no time given")
  if (!m[2] || !m[3]) return { date, time: null }
  const hh = m[2], mm = m[3]
  if (hh === '00' && mm === '00') return { date, time: null }
  return { date, time: `${hh}:${mm}` }
}

/** Pull the cheapest non-zero ticket URL from JSON-LD offers, falling back to first offer URL. */
function pickTicketUrl(jsonLd, eventUrl) {
  const offers = Array.isArray(jsonLd?.offers) ? jsonLd.offers : (jsonLd?.offers ? [jsonLd.offers] : [])
  // Prefer the deepest direct ticket URL
  for (const o of offers) {
    if (o?.url && /tickets\.holdmyticket\.com|holdmyticket\.com\/tickets/.test(o.url)) {
      return o.url
    }
  }
  for (const o of offers) {
    if (o?.url) return o.url
  }
  return eventUrl
}

function pickPriceLabel(jsonLd) {
  const offers = Array.isArray(jsonLd?.offers) ? jsonLd.offers : (jsonLd?.offers ? [jsonLd.offers] : [])
  if (offers.length === 0) return 'See ticketing'
  // Numeric prices only
  const prices = offers
    .map(o => parseFloat(o?.price))
    .filter(p => Number.isFinite(p))
  if (prices.length === 0) return 'See ticketing'
  if (prices.every(p => p === 0)) return 'Free'
  const lo = Math.min(...prices.filter(p => p > 0))
  const hi = Math.max(...prices)
  return lo === hi ? `$${lo.toFixed(0)}` : `$${lo.toFixed(0)}–$${hi.toFixed(0)}`
}

/** Detect if a venue is in greater Albuquerque metro. */
function isInAbqMetro({ city, venueName }) {
  const c = (city || '').toLowerCase().replace(/,?\s*(nm|new mexico)\s*$/i, '').trim()
  if (c && ABQ_CITIES.has(c)) return true
  // Defensive: if city is missing but venue name is one of AMP's well-known ABQ venues
  const v = (venueName || '').toLowerCase()
  if (/\b(kimo|national hispanic cultural center|nhcc|albuquerque|rio rancho|outpost performance|sunshine theater|sandia (?:resort|casino)|santa ana star)\b/.test(v)) {
    // But if venue has "Lensic" or "Meow Wolf" then it's Santa Fe even with no explicit city
    if (/\b(lensic|meow wolf|tumbleroot)\b/.test(v)) return false
    return true
  }
  return false
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🎵 scrape-amp-concerts ${DRY_RUN ? '— DRY RUN ' : ''}`)
  console.log()

  // Load existing AMP rows (image_status preservation)
  const { data: existing } = await supabase.schema('public').from('events')
    .select('id, image_status, cached_photo_url, ai_enrichment').like('id', 'amp-%')
  const existingById = new Map((existing ?? []).map(e => [e.id, e]))
  console.log(`${existingById.size} existing AMP events in DB\n`)

  // Discover event URLs
  console.log(`Fetching event URL list from ${BASE_URL}…`)
  const eventLinks = await fetchEventUrls()
  console.log(`  Found ${eventLinks.length} unique event URLs\n`)

  if (eventLinks.length === 0) {
    console.log('No events found — exiting')
    return
  }

  const toProcess = eventLinks.slice(0, LIMIT)
  const today = new Date().toISOString().slice(0, 10)

  // Stats
  let inserted = 0, updated = 0, blockedCity = 0, skippedPast = 0, failed = 0
  let withImage = 0, withTime = 0
  const venuesSeen = new Map()  // venue → count
  const drySamples = []

  for (let i = 0; i < toProcess.length; i++) {
    const { id, slug, url } = toProcess[i]
    const recordId = `amp-${id}`

    process.stdout.write(`  [${i+1}/${toProcess.length}] ${id} ${slug.slice(0, 30)}… `)

    const pageRes = await httpGet(url, 12000)
    if (!pageRes.ok || !pageRes.text) {
      console.log(`HTTP ${pageRes.status ?? 'error'} — skip`)
      failed++
      await new Promise(r => setTimeout(r, 300))
      continue
    }

    const ld = extractJsonLd(pageRes.text)
    if (!ld) {
      console.log('no JSON-LD — skip')
      failed++
      await new Promise(r => setTimeout(r, 200))
      continue
    }

    // ── Extract fields from JSON-LD ─────────────────────────────────────────
    const title = decodeEntities(ld.name)
    const { date: eventDate, time: eventTime } = splitIsoDateTime(ld.startDate)
    if (!title || !eventDate) {
      console.log('missing title/date — skip')
      failed++
      continue
    }

    // Skip past events
    if (eventDate < today) {
      console.log(`past (${eventDate}) — skip`)
      skippedPast++
      continue
    }

    // Venue + city
    const loc = ld.location || {}
    const venueName = decodeEntities(loc.name) || null
    const addr = loc.address || {}
    const venueAddress = decodeEntities(addr.streetAddress) || null
    const city = decodeEntities(addr.addressLocality) || null
    const state = decodeEntities(addr.addressRegion) || 'NM'
    const postalCode = decodeEntities(addr.postalCode) || null

    // ── Greater-ABQ filter ─────────────────────────────────────────────────
    if (!isInAbqMetro({ city, venueName })) {
      if (VERBOSE) console.log(`⊘ out_of_metro: ${venueName} (${city || 'no-city'})`)
      else console.log(`⊘ ${city || 'no-city'}`)
      blockedCity++
      continue
    }

    // ── Image: prefer JSON-LD image, then meta extractor ───────────────────
    let imageUrl = null
    if (typeof ld.image === 'string') imageUrl = ld.image
    else if (Array.isArray(ld.image)) {
      const firstStr = ld.image.find(x => typeof x === 'string')
      const firstObj = ld.image.find(x => x && typeof x === 'object' && typeof x.url === 'string')
      imageUrl = firstStr || firstObj?.url || null
    } else if (ld.image?.url) {
      imageUrl = ld.image.url
    }

    // Upgrade http:// → https:// for AMP/holdmyticket image URLs (they all support TLS)
    if (imageUrl && imageUrl.startsWith('http://')) imageUrl = 'https://' + imageUrl.slice(7)

    // Validate via the image-extractor blacklist
    if (imageUrl && isLikelyBadImage(imageUrl)) imageUrl = null

    // Fallback: scan the HTML for og:image / first <img>
    if (!imageUrl) {
      imageUrl = extractBestImage(pageRes.text, url)
    }

    if (imageUrl) withImage++
    if (eventTime) withTime++

    // Description: og:description (cleaner than JSON-LD which has no description field)
    const description = (getMeta(pageRes.text, 'og:description') || '').slice(0, 500)

    // Ticket URL: prefer holdmyticket direct ticket URL
    const ticketUrl = pickTicketUrl(ld, url)
    const priceLabel = pickPriceLabel(ld)
    const isFree = priceLabel === 'Free'

    // Track venue diversity
    venuesSeen.set(venueName || 'Unknown', (venuesSeen.get(venueName || 'Unknown') || 0) + 1)

    console.log(`${eventDate}${eventTime ? ' '+eventTime : ''} | ${venueName || 'Unknown'} | img:${imageUrl ? '✓' : '✗'}`)

    // ── Dry-run: collect sample, no DB write ───────────────────────────────
    if (DRY_RUN) {
      if (drySamples.length < 10) {
        drySamples.push({
          id: recordId,
          title,
          date: eventDate,
          time: eventTime,
          venue: venueName,
          city,
          image: imageUrl?.slice(0, 80) ?? null,
          ticketUrl,
          price: priceLabel,
        })
      }
      if (existingById.has(recordId)) updated++
      else inserted++
      await new Promise(r => setTimeout(r, 150))
      continue
    }

    // ── Build raw payload (compatible with normalizeLocal) ─────────────────
    const raw = {
      id: recordId,
      url,
      name: title,
      title,
      description,
      info: description,
      image: imageUrl || null,
      images: imageUrl ? [{ url: imageUrl }] : [],
      time: eventTime || null,
      dates: {
        start: {
          localDate: eventDate,
          localTime: eventTime || null,
        },
      },
      isFree,
      _source: 'amp',
      _embedded: {
        venues: [{
          name: venueName || 'Albuquerque',
          city: { name: city || 'Albuquerque' },
          state: { name: state },
          address: { line1: venueAddress || '' },
          postalCode: postalCode || '',
        }],
      },
      ticketLinks: [{ url: ticketUrl }],
      amp_id: id,
      amp_slug: slug,
      price: priceLabel,
      scraped_at: new Date().toISOString(),
      scraped_by: 'scrape-amp-concerts',
    }

    // event_date column: include time if set (with -06:00/-07:00 offset from JSON-LD)
    // JSON-LD already contains the offset — re-construct from original startDate
    const eventDatetime = ld.startDate || eventDate

    // Image-status preservation (admin reject takes priority)
    const prior = existingById.get(recordId)
    const adminRejected = prior?.image_status === 'rejected'

    let cachedPhotoUrl
    let imageStatus
    if (adminRejected) {
      cachedPhotoUrl = prior?.cached_photo_url ?? null
      imageStatus = 'rejected'
    } else if (imageUrl) {
      cachedPhotoUrl = imageUrl
      imageStatus = 'unverified'
    } else {
      cachedPhotoUrl = prior?.cached_photo_url ?? null
      imageStatus = prior?.image_status ?? null
    }

    const row = {
      id: recordId,
      source: 'local',
      raw,
      event_date: eventDatetime,
      cached_photo_url: cachedPhotoUrl,
      image_status: imageStatus,
      featured: false,
      category: 'Music',          // AMP is overwhelmingly music; audit-accuracy may re-categorize
      venue_name: venueName || null,
    }

    const { error } = await supabase.schema('public').from('events')
      .upsert(row, { onConflict: 'id' })

    if (error) {
      console.log(`    ✗ DB error: ${error.message}`)
      failed++
    } else {
      const isNew = !existingById.has(recordId)
      if (isNew) inserted++
      else updated++
    }

    await new Promise(r => setTimeout(r, 350))
  }

  // ── Final report ───────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 scrape-amp-concerts complete
   Discovered    : ${eventLinks.length}
   Processed     : ${toProcess.length}
   Inserted      : ${inserted}
   Updated       : ${updated}
   Out-of-metro  : ${blockedCity}
   Past          : ${skippedPast}
   Failed        : ${failed}
   With image    : ${withImage}/${toProcess.length - blockedCity - skippedPast - failed}
   With time     : ${withTime}/${toProcess.length - blockedCity - skippedPast - failed}
   Venues        : ${venuesSeen.size}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  // Venue breakdown (helps spot misclassification)
  if (venuesSeen.size > 0) {
    console.log('\nVenue distribution (kept events):')
    const sorted = [...venuesSeen.entries()].sort((a, b) => b[1] - a[1])
    for (const [venue, count] of sorted) {
      console.log(`  ${count.toString().padStart(3)}  ${venue}`)
    }
  }

  if (DRY_RUN && drySamples.length > 0) {
    console.log('\n--- DRY RUN: first 10 samples ---')
    for (const s of drySamples) {
      console.log(JSON.stringify(s, null, 2))
    }
  }

  if (failed > 0 && !DRY_RUN) process.exit(1)
}

main().catch(err => {
  console.error('CRASH:', err.stack || err)
  process.exit(2)
})
