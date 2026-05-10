#!/usr/bin/env node
/**
 * Import upcoming Ticketmaster events for the Greater ABQ Metro area.
 *
 * Uses the Ticketmaster Discovery API v2 with geo-radius search.
 * Stores the raw TM API response so normalizeTM() can read it.
 *
 * Source tag : 'ticketmaster'
 * ID format  : ticketmaster_{tm_event_id}
 *
 * Usage:
 *   TICKETMASTER_API_KEY=xxx node scripts/import-ticketmaster.mjs [--dry-run] [--limit=500]
 *   — or put TICKETMASTER_API_KEY in scripts/.env
 *
 * Get a free key at: https://developer.ticketmaster.com/
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
const TM_KEY       = process.env.TICKETMASTER_API_KEY

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env')
  process.exit(1)
}
if (!TM_KEY) {
  console.error('❌ TICKETMASTER_API_KEY not set.')
  console.error('   Get a free key at: https://developer.ticketmaster.com/')
  console.error('   Then add TICKETMASTER_API_KEY=xxx to scripts/.env')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const perRunLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 999

// Greater ABQ Metro center + radius
const METRO_LAT = 35.1053
const METRO_LNG = -106.6464
const METRO_RADIUS = 40 // miles

const TM_API = 'https://app.ticketmaster.com/discovery/v2/events.json'
const USER_AGENT = 'ABQUnplugged/2.0 (community aggregator; 4mattcarlson@gmail.com)'

// Category classification from TM segment/genre
const SEGMENT_MAP = {
  'Music':           'Music',
  'Sports':          'Sports',
  'Arts & Theatre':  'Arts & Theater',
  'Film':            'Film',
  'Miscellaneous':   'Community',
  'Family':          'Family',
}

function mapTMCategory(segment, genre) {
  const cat = SEGMENT_MAP[segment] || 'Community'
  // Refine
  if (cat === 'Arts & Theater') {
    if (/comedy/i.test(genre)) return 'Comedy'
  }
  if (cat === 'Music') {
    if (/comedy/i.test(genre)) return 'Comedy'
  }
  return cat
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Fetch all events from Ticketmaster Discovery API ──────────────────────────

async function fetchAll() {
  console.log(`🔵 Fetching Ticketmaster events for Greater ABQ Metro...`)
  console.log(`   Center: ${METRO_LAT}, ${METRO_LNG}  |  Radius: ${METRO_RADIUS} miles\n`)

  const all = []
  let page = 0
  let totalPages = 1
  const now = new Date().toISOString().split('.')[0] + 'Z'

  while (page < totalPages && page < 10) {
    const params = new URLSearchParams({
      apikey:        TM_KEY,
      latlong:       `${METRO_LAT},${METRO_LNG}`,
      radius:        String(METRO_RADIUS),
      unit:          'miles',
      locale:        '*',
      sort:          'date,asc',
      size:          '200',
      page:          String(page),
      startDateTime: now,
    })

    const resp = await fetch(`${TM_API}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20000),
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error(`❌ TM API error: HTTP ${resp.status} — ${text.slice(0, 200)}`)
      break
    }

    const data = await resp.json()
    if (data.fault) {
      console.error(`❌ TM API fault: ${data.fault.faultstring}`)
      break
    }

    const pageInfo = data.page || {}
    totalPages = pageInfo.totalPages || 1
    const events = data._embedded?.events || []
    all.push(...events)

    console.log(`  Page ${page + 1}/${totalPages}: ${events.length} events (total: ${all.length})`)
    page++
    if (page < totalPages) await new Promise(r => setTimeout(r, 400))
  }

  // Deduplicate by TM event id
  const seen = new Set()
  const unique = all.filter(ev => {
    if (seen.has(ev.id)) return false
    seen.add(ev.id)
    return true
  })

  console.log(`\n  ✅ ${unique.length} unique events fetched\n`)
  return unique
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiEvents = await fetchAll()

  // Filter shell/test/junk events that Ticketmaster leaks into the API
  const real = apiEvents.filter(ev => {
    const title = (ev.name || '').toLowerCase()
    if (/non.manifested shell/i.test(title)) return false
    if (/test event/i.test(title)) return false
    // Parking upsell packages — "PSS VIP Parking" suffix pattern
    if (/pss vip parking/i.test(ev.name || '')) return false
    // Season-level placeholder events (not individual shows)
    if (/\b(season|series)\b.{0,30}\d{4}/i.test(title) && /amphitheater|amp\b/i.test(title)) return false
    // Deposit / season ticket placeholders
    if (/deposits\b/i.test(title) && /season|goatheads/i.test(title)) return false
    // Merchandise add-on rows (photo packages, wooden souvenirs, etc.)
    if (/magical christmas ballets.*(photo|wooden)/i.test(title)) return false
    return true
  })
  console.log(`  ${real.length} events after filtering shell/test events\n`)

  if (isDryRun) console.log('  🔍 DRY RUN — no DB writes\n')

  // Load existing TM ids
  const { data: existing } = await supabase
    .schema('public')
    .from('events')
    .select('id')
    .eq('source', 'ticketmaster')
  const existingIds = new Set((existing ?? []).map(e => e.id))
  console.log(`  ${existingIds.size} existing Ticketmaster events in DB`)

  const toProcess = real.slice(0, perRunLimit)
  console.log(`  Processing ${toProcess.length} events\n`)

  let inserted = 0, updated = 0, skipped = 0

  for (let i = 0; i < toProcess.length; i++) {
    const ev = toProcess[i]
    const id = `ticketmaster_${ev.id}`
    const title = ev.name || 'Untitled Event'

    const startDate = ev.dates?.start?.localDate
    if (!startDate) {
      console.log(`  [${i + 1}/${toProcess.length}] ⚠️  SKIP (no date): ${title}`)
      skipped++
      continue
    }

    // Skip cancelled events — TM keeps them in the feed with status.code='cancelled'.
    // Rescheduled events carry the NEW date, so they're kept.
    const statusCode = ev.dates?.status?.code
    if (statusCode === 'cancelled') {
      console.log(`  [${i + 1}/${toProcess.length}] ⚠️  SKIP (cancelled): ${title}`)
      skipped++
      continue
    }

    const startTime = ev.dates?.start?.localTime
    const eventDate = (startTime && startTime !== '00:00:00')
      ? `${startDate}T${startTime.slice(0, 5)}:00-07:00`
      : startDate

    // Classification
    const cls = ev.classifications?.[0] || {}
    const segment = cls.segment?.name || ''
    const genre   = cls.genre?.name   || ''
    const category = mapTMCategory(segment, genre)

    // Best image — Ticketmaster supplies many crops per event. Preference:
    //   1. RETINA_PORTRAIT_3_2     (highest-quality portrait, ~1080x1440)
    //   2. RETINA_LANDSCAPE_16_9   (highest landscape)
    //   3. LANDSCAPE_LARGE_16_9
    //   4. Widest 16:9 non-fallback
    //   5. Any non-fallback
    // Each candidate must NOT be a fallback (TM's generic placeholder).
    const allImages = (ev.images || []).filter(i => !i.fallback)
    const byUrlKeyword = (kw) => allImages.find(i => i.url?.includes(kw))
    const widestRatio = (ratio) => {
      const filtered = allImages.filter(i => i.ratio === ratio)
      filtered.sort((a, b) => (b.width || 0) - (a.width || 0))
      return filtered[0]
    }
    const widestAny = () => {
      const sorted = [...allImages].sort((a, b) => (b.width || 0) - (a.width || 0))
      return sorted[0]
    }
    const pickedImage =
         byUrlKeyword('RETINA_PORTRAIT_3_2')
      ?? byUrlKeyword('RETINA_LANDSCAPE_16_9')
      ?? byUrlKeyword('LANDSCAPE_LARGE_16_9')
      ?? widestRatio('16_9')
      ?? widestAny()
    const imageUrl = pickedImage?.url ?? null

    const venueName = ev._embedded?.venues?.[0]?.name || null

    console.log(`  [${i + 1}/${toProcess.length}] ${title}`)
    console.log(`    ${startDate}  ${category}  ${venueName}`)

    const row = {
      id,
      source: 'ticketmaster',
      raw: ev,            // store full TM API response — normalizeTM() reads this
      event_date: eventDate,
      category,
      venue_name: venueName,
      cached_photo_url: imageUrl,
      hidden: false,
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
✅ Ticketmaster Import complete
   Inserted : ${inserted}
   Updated  : ${updated}
   Skipped  : ${skipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
