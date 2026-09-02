#!/usr/bin/env node
/**
 * Import upcoming Eventbrite events for Albuquerque, NM.
 *
 * Scrapes the Eventbrite public discovery pages (JSON-LD) since the
 * location-based API search was deprecated in 2020. The EVENTBRITE_TOKEN
 * is used optionally to enrich venue details for found events.
 *
 * Source tag : 'eventbrite'
 * ID format  : eb-{eventbrite_numeric_id}
 *
 * Usage:
 *   node scripts/import-eventbrite.mjs [--dry-run] [--limit=200]
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in scripts/.env
 * Optional: EVENTBRITE_TOKEN for venue enrichment
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load .env ─────────────────────────────────────────────────────────────────
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '..', 'scripts', '.env'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
    break
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EB_TOKEN     = process.env.EVENTBRITE_TOKEN   // optional — used for enrichment

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const perRunLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 999

// ABQ metro bounding box (lat/lng) — coarse filter
const METRO = { latMin: 34.8, latMax: 35.45, lngMin: -107.1, lngMax: -106.3 }

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ABQ metro city names — used when no lat/lng is available.
// 2026-04-26: Rio Rancho removed per user feedback. RR is a separate
// city ~30 min from Albuquerque proper and shows up too often in search
// results, diluting the "things to do in ABQ" promise. To re-include
// later, add back here AND add an explicit "Rio Rancho" neighborhood.
const ABQ_CITIES = new Set([
  'albuquerque', 'bernalillo', 'corrales', 'los lunas',
  'belen', 'edgewood', 'tijeras', 'cedar crest', 'los ranchos',
  'los ranchos de albuquerque', 'alburquerque',
])

// Rio Rancho zips (87124, 87144) — explicit reject even if lat/lng is in
// the wider metro box, since they're "in" geographic ABQ but socially RR.
const RIO_RANCHO_ZIPS = new Set(['87124', '87144'])

// ── Discovery pages to scrape ─────────────────────────────────────────────────
const DISCOVERY_URLS = [
  'https://www.eventbrite.com/d/nm--albuquerque/events/',
  'https://www.eventbrite.com/d/nm--albuquerque/events/?page=2',
  'https://www.eventbrite.com/d/nm--albuquerque/events/?page=3',
  'https://www.eventbrite.com/d/nm--albuquerque/events/?page=4',
  'https://www.eventbrite.com/d/nm--albuquerque/music/',
  'https://www.eventbrite.com/d/nm--albuquerque/food-and-drink/',
  'https://www.eventbrite.com/d/nm--albuquerque/arts/',
  'https://www.eventbrite.com/d/nm--albuquerque/family-and-education/',
  'https://www.eventbrite.com/d/nm--albuquerque/community/',
  // 'https://www.eventbrite.com/d/nm--rio-rancho/events/'  // removed 2026-04-26 — RR is its own city
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isInMetro(lat, lng) {
  const la = parseFloat(lat), lo = parseFloat(lng)
  return la >= METRO.latMin && la <= METRO.latMax && lo >= METRO.lngMin && lo <= METRO.lngMax
}

function isFuture(dateStr) {
  const today = new Date().toISOString().slice(0, 10)
  return dateStr >= today
}

/** "7:00 PM" → "19:00" */
function to24h(timeStr) {
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return undefined
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = m[3].toUpperCase()
  if (ampm === 'PM' && h < 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return String(h).padStart(2, '0') + ':' + min
}

function guessCategory(name, desc) {
  const t = (name + ' ' + (desc || '')).toLowerCase()
  if (/\b(music|concert|band|dj|live music|jazz|blues|folk|rock|country|hip.?hop|r&b|electronic|metal)\b/.test(t)) return 'Music'
  if (/\b(comedy|stand.?up|improv|open mic|laugh)\b/.test(t)) return 'Comedy'
  if (/\b(theater|theatre|play|musical|opera|ballet|dance performance|recital)\b/.test(t)) return 'Arts & Theater'
  if (/\b(film|movie|cinema|screening)\b/.test(t)) return 'Film'
  if (/\b(art|gallery|exhibit|exhibit|paint|sculpt|craft)\b/.test(t)) return 'Arts & Theater'
  if (/\b(sport|run|5k|marathon|bike|yoga|fitness|triathlon)\b/.test(t)) return 'Sports'
  if (/\b(kids?|child|family|baby|toddler|youth|storytime)\b/.test(t)) return 'Family'
  if (/\b(food|drink|beer|wine|tasting|brewery|cocktail|dinner|culinary)\b/.test(t)) return 'Food & Drink'
  if (/\b(festival|market|fair|fiesta)\b/.test(t)) return 'Festivals'
  if (/\b(outdoor|hike|trail|nature|garden)\b/.test(t)) return 'Outdoor'
  if (/\b(volunteer|fundrais|charity|nonprofit)\b/.test(t)) return 'Community'
  return 'Community'
}

/** Transform an Eventbrite JSON-LD Event item → our normalized raw format */
function transformJsonLd(item, timeBySlug) {
  const startDate = item.startDate || ''
  const localDate = startDate ? startDate.slice(0, 10) : ''
  if (!localDate || !isFuture(localDate)) return null

  // Extract event ID from URL
  const urlMatch = (item.url || '').match(/\/e\/[a-z0-9-]+-(\d+)/i)
  const ebId = urlMatch ? urlMatch[1] : null
  if (!ebId) return null

  // Get start time — from JSON-LD datetime, or from HTML-scraped time map
  let localTime = startDate.length > 10 ? startDate.slice(11, 16) : undefined
  if (!localTime && timeBySlug?.[ebId]) localTime = timeBySlug[ebId]

  const loc   = item.location || {}
  const addr  = loc.address   || {}
  const geo   = loc.geo       || {}
  const lat   = geo.latitude
  const lng   = geo.longitude

  // ── Geo-filter: require positive ABQ evidence ──────────────────────────────
  // Block virtual/online events — multi-signal check
  if (loc['@type'] === 'VirtualLocation') return null

  // Virtual signals: title, venue name, or street address explicitly says so
  const VIRTUAL_RE = /\b(virtual(?:ly)?|online (class|event|workshop|webinar|meeting)|zoom webinar|zoom meeting|via zoom|live ?stream|webinar|online\/virtual|google meet|microsoft teams)\b/i
  const _virtualHaystack = [
    item.name || '',
    loc.name || '',
    addr.streetAddress || '',
    typeof item.description === 'string' ? item.description.slice(0, 300) : '',
  ].join(' | ')
  if (VIRTUAL_RE.test(_virtualHaystack)) return null

  // Block vendor-registration listings — these are sign-up forms for craft
  // fair vendors, not public events. Persona testing surfaced one example
  // (RCCCNM Craft Fair flyer titled "VENDOR REGISTRATION") slipping through.
  const VENDOR_ONLY_RE = /\b(vendor (?:registration|sign[- ]?up|application|info|booth)|become a vendor|book a booth|exhibitor (?:application|registration)|sign up to vend|booth (?:fee|application))\b/i
  if (VENDOR_ONLY_RE.test(item.name || '')) return null

  // Block non-US Eventbrite domains (co.uk, .ca, .fr, .es, .nl, .com.mx, etc.)
  const eventUrl = item.url || ''
  if (eventUrl && !/eventbrite\.com\//.test(eventUrl)) return null

  const cityName = (addr.addressLocality || '').toLowerCase().trim()
  const postalCode = (addr.postalCode || '').toString().trim()
  const streetAddr = (addr.streetAddress || '').toString()
  const venueName = (loc.name || '').toString().trim()

  // Hard reject Rio Rancho (zip + city + street-mentions). Catches RR events
  // whose lat/lng fall inside the wider ABQ box but are socially a different city.
  if (RIO_RANCHO_ZIPS.has(postalCode)) return null
  if (cityName === 'rio rancho') return null
  if (/\brio\s+rancho\b/i.test(streetAddr)) return null
  if (/\b(87124|87144)\b/.test(streetAddr)) return null

  // Eventbrite discovery sometimes assigns the searched city to cruises,
  // livestreams, and other non-local listings. A city string alone is not
  // sufficient evidence that a visitor can physically attend in Albuquerque.
  if (!venueName && !streetAddr && !(lat && lng)) return null

  if (lat && lng) {
    // Has coordinates — apply metro bounding box
    if (!isInMetro(lat, lng)) return null
  } else if (cityName) {
    // No coords but has a city — must be in ABQ area
    if (!ABQ_CITIES.has(cityName)) return null
  } else {
    // No location evidence at all — reject
    return null
  }
  // ───────────────────────────────────────────────────────────────────────────

  const name   = item.name || 'Untitled Event'
  const desc   = typeof item.description === 'string' ? item.description : ''
  const category = guessCategory(name, desc)
  const imgUrl = item.image
    ? (typeof item.image === 'string' ? item.image : item.image?.url ?? item.image?.[0] ?? null)
    : null

  return {
    id:      `eb-${ebId}`,
    name,
    url:     item.url,
    _source: 'eventbrite',
    info:    desc.slice(0, 400) || null,
    images:  imgUrl ? [{ url: imgUrl }] : [],
    dates: {
      start: {
        localDate,
        localTime: localTime || null,
      },
    },
    _embedded: {
      venues: [{
        name:    loc.name || addr.streetAddress || '',
        address: { line1: addr.streetAddress || '' },
        city:    { name: addr.addressLocality || '' },
        state:   { name: addr.addressRegion   || '' },
        location: (lat && lng) ? { latitude: String(lat), longitude: String(lng) } : undefined,
      }],
    },
    classifications: [{ segment: { name: category } }],
    ticketLinks:     item.url ? [{ url: item.url }] : [],
    isFree: /free/i.test(name) || /free/i.test(desc),
  }
}

/** Fetch a single Eventbrite discovery page and extract events from JSON-LD */
async function scrapePage(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20000),
  })
  if (!resp.ok) {
    console.warn(`  ⚠️  ${url} → HTTP ${resp.status}`)
    return []
  }
  const body = await resp.text()
  const events = []

  // Build event-ID → time map from HTML card data
  const timeBySlug = {}
  const cardTimeRe = /data-event-id="(\d+)"[\s\S]{0,2000}?(\d{1,2}:\d{2}\s*[AP]M)/gi
  let tm
  while ((tm = cardTimeRe.exec(body)) !== null) {
    const ebId = tm[1]
    if (!timeBySlug[ebId]) timeBySlug[ebId] = to24h(tm[2].trim())
  }

  // Parse JSON-LD script tags
  const ldMatches = [...body.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const ldMatch of ldMatches) {
    try {
      const ld = JSON.parse(ldMatch[1])
      let items = []
      if (ld['@type'] === 'ItemList') {
        items = (ld.itemListElement || []).map(e => e.item).filter(Boolean)
      } else if (ld['@type'] === 'Event') {
        items = [ld]
      }
      for (const item of items) {
        if (item?.['@type'] !== 'Event') continue
        const ev = transformJsonLd(item, timeBySlug)
        if (ev) events.push(ev)
      }
    } catch { /* malformed JSON-LD — skip */ }
  }

  // Fallback: try __SERVER_DATA__ if no JSON-LD events found
  if (events.length === 0) {
    const sdMatch = body.match(/window\.__SERVER_DATA__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)
    if (sdMatch) {
      try {
        const sd = JSON.parse(sdMatch[1])
        const jsonld = sd?.jsonld || sd?.search_data?.jsonld || []
        const items = Array.isArray(jsonld)
          ? jsonld
          : (jsonld?.itemListElement?.map(e => e.item) || [])
        for (const item of items) {
          if (item?.['@type'] !== 'Event') continue
          const ev = transformJsonLd(item, timeBySlug)
          if (ev) events.push(ev)
        }
      } catch { /* skip */ }
    }
  }

  return events
}

/** Optional: enrich a single event via Eventbrite API (better venue details) */
async function enrichViaApi(ebId) {
  if (!EB_TOKEN) return null
  try {
    const resp = await fetch(
      `https://www.eventbriteapi.com/v3/events/${ebId}/?expand=venue`,
      { headers: { 'Authorization': `Bearer ${EB_TOKEN}` }, signal: AbortSignal.timeout(8000) }
    )
    if (!resp.ok) return null
    return await resp.json()
  } catch { return null }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🟠 Fetching Eventbrite events for Albuquerque...')
  if (!EB_TOKEN) console.log('  (No EVENTBRITE_TOKEN — skipping API enrichment)')

  const all = new Map() // id → event (dedup)

  for (let i = 0; i < DISCOVERY_URLS.length; i++) {
    const url = DISCOVERY_URLS[i]
    console.log(`  [${i + 1}/${DISCOVERY_URLS.length}] ${url}`)
    const events = await scrapePage(url)
    console.log(`    → ${events.length} events found`)
    for (const ev of events) {
      if (!all.has(ev.id)) all.set(ev.id, ev)
    }
    if (i < DISCOVERY_URLS.length - 1) await new Promise(r => setTimeout(r, 900))
  }

  const allEvents = [...all.values()]
  console.log(`\n  Total unique events: ${allEvents.length}`)
  if (isDryRun) console.log('  🔍 DRY RUN — no DB writes\n')

  // Load existing EB IDs
  const { data: existing } = await supabase
    .schema('public')
    .from('events')
    .select('id')
    .eq('source', 'eventbrite')
  const existingIds = new Set((existing ?? []).map(e => e.id))
  console.log(`  ${existingIds.size} existing Eventbrite events in DB\n`)

  const toProcess = allEvents.slice(0, perRunLimit)
  let inserted = 0, updated = 0, skipped = 0

  for (let i = 0; i < toProcess.length; i++) {
    const ev = toProcess[i]
    const ebNumericId = ev.id.replace('eb-', '')
    const title = ev.name
    const localDate = ev.dates?.start?.localDate
    const localTime = ev.dates?.start?.localTime

    if (!localDate) { skipped++; continue }

    // Build event_date with time if available
    const eventDate = (localTime && localTime !== '00:00')
      ? `${localDate}T${localTime}:00-07:00`
      : localDate

    const category = guessCategory(ev.name, ev.info || '')
    const venueName = ev._embedded?.venues?.[0]?.name || null
    const imageUrl  = ev.images?.[0]?.url || null

    // Optional: enrich top events without a venue name via API
    let enrichedVenue = null
    if (!venueName && EB_TOKEN && i < 30) {
      const apiData = await enrichViaApi(ebNumericId)
      if (apiData?.venue) {
        const v = apiData.venue
        enrichedVenue = v.name
        if (enrichedVenue) {
          ev._embedded.venues[0].name = enrichedVenue
          ev._embedded.venues[0].address.line1 = v.address?.address_1 || ''
        }
        await new Promise(r => setTimeout(r, 200))
      }
    }

    const displayVenue = enrichedVenue || venueName || ''
    console.log(`  [${i + 1}/${toProcess.length}] ${title.slice(0, 55)}`)
    console.log(`    ${localDate}  ${category}  ${displayVenue.slice(0, 40)}`)

    const row = {
      id:              ev.id,
      source:          'eventbrite',
      raw:             ev,
      event_date:      eventDate,
      category,
      venue_name:      displayVenue || null,
      cached_photo_url: imageUrl,
      featured:        false,
    }

    if (isDryRun) {
      console.log(`    → DRY: would upsert ${ev.id}`)
      inserted++
      continue
    }

    const isNew = !existingIds.has(ev.id)
    const { error } = await supabase
      .schema('public')
      .from('events')
      .upsert(row, { onConflict: 'id' })

    if (error) {
      console.error(`    ❌ ${error.message}`)
      skipped++
    } else {
      console.log(`    ✅ ${isNew ? 'Inserted' : 'Updated'}`)
      if (isNew) inserted++
      else updated++
    }

    if ((i + 1) % 30 === 0) await new Promise(r => setTimeout(r, 300))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Eventbrite Import complete
   Inserted : ${inserted}
   Updated  : ${updated}
   Skipped  : ${skipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
