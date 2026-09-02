#!/usr/bin/env node
/**
 * Import upcoming SeatGeek events for Albuquerque, NM.
 *
 * Uses the SeatGeek v2 API with AID (affiliate ID) for auth.
 * Stores events in TM-compatible raw format so normalizeSG() can read them.
 *
 * Source tag : 'seatgeek'
 * ID format  : seatgeek_{seatgeek_numeric_id}
 *
 * Usage:
 *   node scripts/import-seatgeek.mjs [--dry-run] [--limit=200]
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SEATGEEK_AID in scripts/.env
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
// Accept either SEATGEEK_AID (preferred) or SEATGEEK_CLIENT_ID (legacy GitHub secret name)
const SG_AID       = process.env.SEATGEEK_AID || process.env.SEATGEEK_CLIENT_ID

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env')
  process.exit(1)
}
if (!SG_AID) {
  console.error('❌ SEATGEEK_AID not set. Add it to scripts/.env')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const perRunLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 999

const SG_API = 'https://api.seatgeek.com/2/events'
const USER_AGENT = 'ABQUnplugged/2.0 (community aggregator; 4mattcarlson@gmail.com)'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Category mapping ──────────────────────────────────────────────────────────

const TYPE_TO_CATEGORY = {
  // Music
  'concert':              'Music',
  'music_festival':       'Music',
  'band':                 'Music',
  'classical_orchestral_instrumental': 'Music',
  'theater_classical_orchestral_instrumental': 'Music',
  // Sports
  'minor_league_baseball':'Sports',
  'major_league_baseball':'Sports',
  'nba':                  'Sports',
  'wnba':                 'Sports',
  'nfl':                  'Sports',
  'nhl':                  'Sports',
  'mls':                  'Sports',
  'usl':                  'Sports',   // USL Championship — NM United
  'ncaa_football':        'Sports',
  'ncaa_basketball':      'Sports',
  'ncaa_baseball':        'Sports',
  'ncaa_soccer':          'Sports',
  'soccer':               'Sports',
  'football':             'Sports',
  'boxing_mma':           'Sports',
  'wrestling':            'Sports',
  'rodeo':                'Sports',
  'golf':                 'Sports',
  'tennis':               'Sports',
  'marathon':             'Sports',
  // Comedy
  'comedy':               'Comedy',
  'theater_comedy':       'Comedy',
  // Arts & Theater — all theater/* variants SeatGeek uses
  'theater':              'Arts & Theater',
  'theater_broadway_national_tours': 'Arts & Theater',
  'broadway_tickets_national': 'Arts & Theater',
  'theater_classical':    'Arts & Theater',
  'theater_dance_performance_tour': 'Arts & Theater',
  'classical':            'Arts & Theater',
  'dance':                'Arts & Theater',
  'dance_performance_tour': 'Arts & Theater',
  'opera':                'Arts & Theater',
  'ballet':               'Arts & Theater',
  'circus':               'Arts & Theater',
  // Family
  'theater_family':       'Family',
  'cirque_du_soleil':     'Family',
  'family':               'Family',
  // Other
  'film':                 'Film',
  'festival':             'Festivals',
  'food':                 'Food & Drink',
}

// Title-based overrides for events whose SG type doesn't map cleanly
const TITLE_OVERRIDES = [
  { pattern: /new mexico united/i,        category: 'Sports' },
  { pattern: /albuquerque isotopes/i,     category: 'Sports' },
  { pattern: /chupacabras/i,              category: 'Sports' },
  { pattern: /\bUSL\b/i,                 category: 'Sports' },
  { pattern: /philharmonic/i,             category: 'Music' },
  { pattern: /symphony|orchestra/i,       category: 'Music' },
  { pattern: /ballet|nutcracker/i,        category: 'Arts & Theater' },
  { pattern: /\bmusical\b|\bbroadway\b/i, category: 'Arts & Theater' },
]

function mapType(type, title = '') {
  // Check title-based overrides first (highest confidence)
  for (const { pattern, category } of TITLE_OVERRIDES) {
    if (pattern.test(title)) return category
  }
  if (!type) return 'Community'
  return TYPE_TO_CATEGORY[type] || 'Community'
}

// Map SG type → segment/genre for normalizeSG() compatibility
function makeClassifications(ev) {
  const category = mapType(ev.type)
  const perf = ev.performers?.[0] || {}
  return [{
    segment: { name: category === 'Sports' ? 'Sports' : category === 'Music' ? 'Music' : category },
    genre:   { name: perf.type || ev.type || 'Other' },
  }]
}

// ── Transform SG API event → TM-compatible raw format ─────────────────────────

function transform(ev) {
  const venue = ev.venue || {}
  const perf  = ev.performers?.[0] || {}

  // Collect images from primary performer
  const images = []
  if (perf.image)              images.push({ url: perf.image })
  if (perf.images?.huge && perf.images.huge !== perf.image)
    images.push({ url: perf.images.huge })

  // Deduplicate
  const seen = new Set()
  const uniqueImages = images.filter(img => {
    if (seen.has(img.url)) return false
    seen.add(img.url)
    return true
  })

  const localDT = ev.datetime_local || ''
  const localDate = localDT ? localDT.split('T')[0] : null
  const localTime = localDT && localDT.includes('T') ? localDT.split('T')[1]?.slice(0, 5) : null

  return {
    id:   ev.id,
    name: ev.title || perf.name || 'Untitled Event',
    url:  ev.url,
    _source: 'seatgeek',

    dates: {
      start: {
        localDate,
        localTime: localTime || null,
        dateTime:  ev.datetime_utc || null,
      },
    },

    images: uniqueImages,

    _embedded: {
      venues: [{
        name:    venue.name,
        address: { line1: venue.address || null },
        city:    { name: venue.city || 'Albuquerque' },
        state:   { stateCode: venue.state || 'NM' },
        location: (venue.location?.lat && venue.location?.lon) ? {
          latitude:  String(venue.location.lat),
          longitude: String(venue.location.lon),
        } : undefined,
      }],
    },

    classifications: makeClassifications(ev),

    ticketLinks: ev.url ? [{ source: 'SeatGeek', url: ev.url }] : [],

    priceRanges: (ev.stats?.lowest_price != null) ? [{
      min:      ev.stats.lowest_price || 0,
      max:      ev.stats.highest_price || ev.stats.lowest_price || 0,
      currency: 'USD',
    }] : undefined,

    info: ev.description || perf.description || perf.short_bio || null,
  }
}

// ── Fetch all events from SeatGeek ────────────────────────────────────────────

async function fetchAll() {
  const now = new Date().toISOString()
  let page = 1
  let totalPages = 1
  const all = []

  console.log('🔵 Fetching SeatGeek events for Albuquerque...')

  while (page <= totalPages && page <= 10) {
    const params = new URLSearchParams({
      'venue.city':       'Albuquerque',
      'venue.state':      'NM',
      'sort':             'datetime_utc.asc',
      'datetime_utc.gte': now,
      'per_page':         '100',   // SeatGeek API caps at 100
      'page':             String(page),
      'aid':              SG_AID,
    })

    const resp = await fetch(`${SG_API}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20000),
    })

    if (!resp.ok) {
      console.error(`❌ SeatGeek API error: HTTP ${resp.status}`)
      break
    }

    const data = await resp.json()
    if (!data.events?.length) break

    all.push(...data.events)
    totalPages = Math.ceil((data.meta?.total || 0) / 100)
    console.log(`  Page ${page}/${totalPages}: ${data.events.length} events (total: ${all.length})`)
    page++
    if (page <= totalPages) await new Promise(r => setTimeout(r, 400))
  }

  console.log(`  ✅ ${all.length} total events fetched\n`)
  return all
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiEvents = await fetchAll()

  // Filter to future events only (belt-and-suspenders)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = apiEvents.filter(ev => {
    const d = (ev.datetime_local || '').slice(0, 10)
    return d >= today
  })
  console.log(`  ${upcoming.length} events are upcoming (>= today)\n`)

  if (isDryRun) console.log('  🔍 DRY RUN — no DB writes\n')

  // Load existing SeatGeek IDs to detect new vs updated
  const { data: existing } = await supabase
    .schema('public')
    .from('events')
    .select('id')
    .eq('source', 'seatgeek')
  const existingIds = new Set((existing ?? []).map(e => e.id))
  console.log(`  ${existingIds.size} existing SeatGeek events in DB`)

  // ── Guard: detect and suppress legacy V1 duplicates ─────────────────────────
  // The old fetch-data.cjs used id format `seatgeek_sg-{numeric}`, which created
  // duplicate rows alongside the correct `seatgeek_{numeric}` rows from this importer.
  // Find any surviving `seatgeek_sg-*` rows and mark them hidden so they don't surface.
  if (!isDryRun) {
    const { data: legacyRows } = await supabase
      .schema('public')
      .from('events')
      .select('id, ai_enrichment')
      .eq('source', 'seatgeek')
      .like('id', 'seatgeek_sg-%')
    const legacyList = legacyRows ?? []
    if (legacyList.length > 0) {
      console.log(`  ⚠️  Found ${legacyList.length} legacy seatgeek_sg-* rows — marking hidden`)
      let suppressed = 0
      for (const row of legacyList) {
        const merged = {
          ...(row.ai_enrichment ?? {}),
          dedup_reason: 'superseded by seatgeek_{numeric} V2 importer',
        }
        const { error: dedupError } = await supabase
          .schema('public')
          .from('events')
          .update({ hidden: true, ai_enrichment: merged })
          .eq('id', row.id)
        if (dedupError) {
          console.warn(`    ⚠️  Could not suppress ${row.id}: ${dedupError.message}`)
        } else {
          suppressed++
        }
      }
      console.log(`  ✅ Suppressed ${suppressed} legacy duplicate rows`)
    } else {
      console.log(`  ✅ No legacy seatgeek_sg-* duplicates found`)
    }
  }

  const toProcess = upcoming.slice(0, perRunLimit)
  console.log(`  Processing ${toProcess.length} events\n`)

  let inserted = 0, updated = 0, skipped = 0

  for (let i = 0; i < toProcess.length; i++) {
    const ev = toProcess[i]
    const raw = transform(ev)
    const id = `seatgeek_${ev.id}`
    const title = raw.name
    const localDate = raw.dates?.start?.localDate

    if (!localDate) {
      console.log(`  [${i + 1}/${toProcess.length}] ⚠️  SKIP (no date): ${title}`)
      skipped++
      continue
    }

    const category = mapType(ev.type, raw.name)
    const venueName = ev.venue?.name || null

    // Build event_date: include time if available
    const localTime = raw.dates?.start?.localTime
    const eventDate = localTime && localTime !== '00:00'
      ? `${localDate}T${localTime}:00-07:00`
      : localDate

    const imageUrl = raw.images?.[0]?.url || null

    console.log(`  [${i + 1}/${toProcess.length}] ${title}`)
    console.log(`    ${localDate}  ${category}  ${venueName}`)

    const row = {
      id,
      source: 'seatgeek',
      raw,
      event_date: eventDate,
      category,
      venue_name: venueName,
      cached_photo_url: imageUrl,
      featured: false,
    }

    if (isDryRun) {
      console.log(`    → DRY: would upsert ${id}`)
      inserted++
      continue
    }

    const isNew = !existingIds.has(id)
    const { error } = await supabase
      .schema('public')
      .from('events')
      .upsert(row, { onConflict: 'id' })

    if (error) {
      console.error(`    ❌ DB error: ${error.message}`)
      skipped++
    } else {
      console.log(`    ✅ ${isNew ? 'Inserted' : 'Updated'}`)
      if (isNew) inserted++
      else updated++
    }

    if ((i + 1) % 50 === 0) await new Promise(r => setTimeout(r, 200))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SeatGeek Import complete
   Inserted : ${inserted}
   Updated  : ${updated}
   Skipped  : ${skipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
