#!/usr/bin/env node
/**
 * Rule-based mood + metadata enrichment for all events.
 *
 * Assigns mood, indoor_outdoor, and age_appeal using deterministic
 * keyword and category rules — no LLM, no API keys, runs anywhere.
 *
 * Mood presets (matches lib/moods.ts):
 *   live-music | date-night | family-fun | free-tonight |
 *   chill      | nightlife  | foodie     | outdoor
 *
 * Usage:
 *   node scripts/enrich-moods-rules.mjs [--dry-run] [--all] [--limit=200]
 *
 *   --all      Re-enrich every event (not just unenriched ones)
 *   --dry-run  Print what would be written without saving
 *   --limit=N  Cap at N events per run (default: 500)
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in scripts/.env or environment
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
if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

const isDryRun  = process.argv.includes('--dry-run')
const enrichAll = process.argv.includes('--all')
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const limit     = limitArg ? parseInt(limitArg.split('=')[1], 10) : 500

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Rule helpers ──────────────────────────────────────────────────────────────

/** Combine all searchable text for an event into one lowercase string */
function makeText(row) {
  const r = row.raw || {}
  const name        = r.name || r.title || ''
  const description = r.description || r.info || ''
  const venue       = row.venue_name || r.venue || r._embedded?.venues?.[0]?.name || ''
  return (name + ' ' + description + ' ' + venue).toLowerCase()
}

/** Extract start hour (0–23) from event_date or raw */
function startHour(row) {
  const r = row.raw || {}
  // Try event_date column first (has time if stored as ISO)
  const dt = row.event_date || ''
  if (dt.includes('T')) {
    const timePart = dt.split('T')[1]
    const h = parseInt(timePart?.split(':')[0] || '0', 10)
    if (!isNaN(h)) return h
  }
  // Try raw dates
  const localTime = r.dates?.start?.localTime || ''
  if (localTime) {
    const h = parseInt(localTime.split(':')[0], 10)
    if (!isNaN(h)) return h
  }
  return null  // unknown
}

function hasKeyword(text, ...words) {
  return words.some(w => {
    const re = typeof w === 'string' ? new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') : w
    return re.test(text)
  })
}

function venueIs(text, ...words) {
  // Match venue name portion (after the general text)
  return hasKeyword(text, ...words)
}

// ── Indoor / outdoor ──────────────────────────────────────────────────────────

function classifyIndoorOutdoor(row, text) {
  const category = row.category || ''
  if (category === 'Outdoor') return 'outdoor'
  if (hasKeyword(text, 'amphitheater', 'amphitheatre', 'park', 'field at', 'stadium',
    'balloon', 'trail', 'hike', 'hiking', 'outdoor', 'open.?air', 'fairground',
    'plaza', 'rooftop', 'patio', 'race track', 'racetrack', 'golf course'))
    return 'outdoor'
  return 'indoor'
}

// ── Age appeal ────────────────────────────────────────────────────────────────

function classifyAgeAppeal(row, text) {
  const category = row.category || ''
  const r = row.raw || {}

  // Explicit 21+ indicator
  const name = (r.name || r.title || '').toLowerCase()
  if (/\b21\s*\+|\b21\s*and\s*(over|up)|\bover\s*21\b/.test(name)) return 'adults'

  // Family / kids content
  if (category === 'Family') return 'kids'
  if (hasKeyword(text, 'storytime', 'story time', 'toddler', 'children', 'kids',
    'youth', 'summer camp', 'school', 'camp congress', 'lego', 'duplo',
    'early childhood', 'niño', 'niños', 'chiquitos'))
    return 'kids'

  // Bar / nightclub / adult venues
  if (hasKeyword(text, 'nightclub', 'bar ', 'brewery', 'brewpub', 'effex', 'revel',
    'lounge', 'casino', 'comedy club', 'hyena', 'stand.?up', 'craft beer',
    'wine tasting', 'cocktail'))
    return 'adults'

  return 'all-ages'
}

// ── Primary mood ──────────────────────────────────────────────────────────────

/**
 * Returns one of: live-music | date-night | family-fun | free-tonight |
 *                 chill | nightlife | foodie | outdoor
 */
function classifyMood(row, text) {
  const category = row.category || ''
  const r = row.raw || {}
  const hour = startHour(row)
  const isEvening = hour !== null ? hour >= 18 : null  // null = unknown
  const isFree = !!(r.isFree || r.price === 'Free' || /\bfree\b/.test(r.name || r.title || ''))
  const priceRanges = r.priceRanges
  const hasPrice = priceRanges?.[0]?.min > 0

  // 1. OUTDOOR — highest priority for outdoor events
  if (category === 'Outdoor') return 'outdoor'
  if (hasKeyword(text, 'balloon fiesta', 'balloon festival', 'hot air balloon',
    'hike', 'hiking', 'trail run', 'cycling event', 'bike race', 'triathlon'))
    return 'outdoor'

  // 2. FAMILY FUN — kids/family events
  if (category === 'Family') return 'family-fun'
  if (hasKeyword(text, 'storytime', 'toddler', 'kids', 'children', 'youth',
    'summer camp', 'lego club', 'early childhood', 'family fun'))
    return 'family-fun'

  // 3. FREE TONIGHT — free events (any category, any time)
  if (isFree && !hasPrice) return 'free-tonight'

  // 4. FOODIE — food & drink events
  if (category === 'Food & Drink') return 'foodie'
  if (hasKeyword(text, 'tasting', 'culinary', 'winemaker', 'brewery tour',
    'food festival', 'farmers market', 'cooking class', 'food truck'))
    return 'foodie'

  // 5. NIGHTLIFE — late music/comedy at bar/club venues
  if ((category === 'Music' || category === 'Comedy') &&
    (isEvening === null || isEvening) &&
    hasKeyword(text, 'nightclub', 'effex', 'club', 'lounge', 'bar ', 'revel',
      'launchpad', 'sunshine theater', 'el rey', 'dirty bourbon', 'juno',
      'nexus', 'bottle', 'draft', 'tipsy', 'dj ', 'dance floor'))
    return 'nightlife'

  // 6. LIVE MUSIC — music events generally
  if (category === 'Music') return 'live-music'

  // 7. DATE NIGHT — ticketed evening arts/comedy
  if ((category === 'Comedy' || category === 'Arts & Theater') && isEvening !== false)
    return 'date-night'
  if (hasKeyword(text, 'comedy show', 'live comedy', 'stand.?up', 'improv show',
    'theatre performance', 'musical', 'ballet', 'opera', 'symphony',
    'date night', 'valentine'))
    return 'date-night'

  // 8. CHILL — film, arts, community daytime
  if (category === 'Film') return 'chill'
  if (category === 'Arts & Theater' && isEvening === false) return 'chill'
  if (category === 'Community' && !isEvening) return 'chill'

  // Default based on broad category
  if (category === 'Sports') return 'chill'
  if (category === 'Festivals') return 'outdoor'

  return 'chill'  // safe fallback
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎨 Rule-based mood enrichment starting...')
  const today = new Date().toISOString().slice(0, 10)

  // Fetch events — unenriched only (or all with --all)
  let query = supabase
    .schema('public')
    .from('events')
    .select('id, source, raw, category, venue_name, event_date, ai_enrichment')
    .eq('hidden', false)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(limit)

  if (!enrichAll) {
    // Only events where mood is not yet set
    query = query.or('ai_enrichment.is.null,ai_enrichment->>mood.is.null')
  }

  const { data: events, error: fetchErr } = await query
  if (fetchErr) { console.error('DB fetch error:', fetchErr.message); process.exit(1) }
  if (!events?.length) { console.log('  No events need enrichment. Done.'); return }

  console.log(`  ${events.length} events to enrich (mode: ${enrichAll ? 'ALL' : 'unenriched only'})`)
  if (isDryRun) console.log('  🔍 DRY RUN — no writes\n')

  const moodCounts = {}
  let enriched = 0, skipped = 0

  for (let i = 0; i < events.length; i++) {
    const row = events[i]
    const text = makeText(row)

    const mood         = classifyMood(row, text)
    const indoorOutdoor = classifyIndoorOutdoor(row, text)
    const ageAppeal    = classifyAgeAppeal(row, text)

    moodCounts[mood] = (moodCounts[mood] || 0) + 1

    if (isDryRun) {
      const name = (row.raw?.name || row.raw?.title || row.id).slice(0, 50)
      console.log(`  ${mood.padEnd(14)} ${indoorOutdoor.padEnd(8)} ${ageAppeal.padEnd(9)} | ${name}`)
      enriched++
      continue
    }

    const enrichment = {
      ...(row.ai_enrichment || {}),
      mood,
      indoor_outdoor: indoorOutdoor,
      age_appeal:     ageAppeal,
      enriched_by:    'rules',
      enriched_at:    new Date().toISOString(),
    }

    const { error } = await supabase
      .schema('public')
      .from('events')
      .update({ ai_enrichment: enrichment })
      .eq('id', row.id)

    if (error) {
      console.error(`  ❌ ${row.id}: ${error.message}`)
      skipped++
    } else {
      enriched++
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  Progress: ${i + 1}/${events.length} (${enriched} enriched)`)
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Mood enrichment complete
   Enriched : ${enriched}
   Skipped  : ${skipped}

Mood distribution:
${Object.entries(moodCounts).sort((a,b) => b[1]-a[1]).map(([m,c]) => `   ${m.padEnd(14)} ${c}`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
