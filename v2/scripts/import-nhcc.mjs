#!/usr/bin/env node
/**
 * Import events from NHCC (National Hispanic Cultural Center).
 *
 * Uses the WordPress Tribe Events REST API:
 *   https://nhccnm.org/wp-json/tribe/events/v1/events
 *
 * This gives us:
 *   • Event-specific featured images (every event has one)
 *   • Full venue details with address
 *   • Cost info
 *   • Tags for categorization
 *
 * Source tag: 'nhcc'
 * ID format:  nhcc-{wp_post_id}
 *
 * Usage:
 *   node scripts/import-nhcc.mjs [--dry-run] [--limit=60]
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in scripts/.env or environment
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load .env ────────────────────────────────────────────────────────────────
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
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const perRunLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 999

const API_BASE = 'https://nhccnm.org/wp-json/tribe/events/v1/events'
const USER_AGENT = 'ABQUnplugged/2.0 (community aggregator; 4mattcarlson@gmail.com)'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip HTML tags and decode common HTML entities */
function stripHtml(html) {
  if (!html) return null
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#038;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600)
}

/** Decode HTML entities in a title/venue string */
function decodeTitle(s) {
  if (!s) return ''
  return s
    // Named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Numeric entities — generic handler
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim()
}

/**
 * Classify NHCC event into our site categories.
 * Uses tags (from NHCC taxonomy) + title keywords.
 */
function classify(title, tags) {
  const tagNames = tags.map(t => t.name.toLowerCase())
  const text = (title + ' ' + tagNames.join(' ')).toLowerCase()

  // Film — check first since some events are film+music
  if (tagNames.some(t => ['film', 'cine'].includes(t)) && !/\bopera\b/.test(text))
    return 'Film'

  // Sports
  if (/\b(lucha libre|wrestling|mma|boxing)\b/.test(text))
    return 'Sports'

  // Family — check before others to catch family film nights etc.
  if (tagNames.some(t => ['family', 'early childhood'].includes(t))
    || /\b(storytime|story time|niño|niños|chiquitos)\b/.test(text))
    return 'Family'

  // Music / Opera / Performing Arts
  if (tagNames.some(t => ['opera'].includes(t)))
    return 'Arts & Theater'
  if (tagNames.some(t => ['music', 'orchestra'].includes(t))
    && !tagNames.some(t => ['theatre', 'theater'].includes(t)))
    return 'Music'

  // Dance performance
  if (tagNames.some(t => ['dance', 'baile!', 'baile'].includes(t))
    && /\b(performance|show|recital|concert|dance company|magnify|ballet)\b/.test(text))
    return 'Arts & Theater'

  // Theater / Performing Arts
  if (tagNames.some(t => ['theatre', 'theater', 'performing arts'].includes(t)))
    return 'Arts & Theater'

  // Art Museum / Gallery
  if (tagNames.some(t => ['art museum', 'visual arts'].includes(t))
    || /\b(exhibit|exhibition|gallery|museo|museum)\b/.test(text))
    return 'Arts & Theater'

  // Dance classes → Community
  if (tagNames.some(t => ['dance', 'baile!', 'baile'].includes(t)))
    return 'Community'

  // Food & Drink
  if (tagNames.some(t => ['food'].includes(t))
    || /\b(tasting|culinary|cooking|food truck|farmers market)\b/.test(text))
    return 'Food & Drink'

  // Default for NHCC: Community
  return 'Community'
}

/** Format price: empty/null → 'Free', otherwise pass through */
function formatPrice(cost) {
  if (!cost || cost.trim() === '' || /free/i.test(cost)) return 'Free'
  // Some prices look like "10 - 20" → "$10–$20"
  const range = cost.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return `$${range[1]}–$${range[2]}`
  const single = cost.match(/\d+/)
  if (single) return `$${single[0]}`
  return cost
}

/** Fetch all upcoming NHCC events across pages */
async function fetchAllEvents() {
  const today = new Date().toISOString().slice(0, 10)
  let page = 1
  let all = []

  while (true) {
    const url = `${API_BASE}?per_page=50&status=publish&start_date=${today}&page=${page}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    })
    if (!resp.ok) {
      console.error(`❌ API error: HTTP ${resp.status}`)
      break
    }
    const data = await resp.json()
    const events = data.events || []
    if (events.length === 0) break
    all = all.concat(events)
    console.log(`  Page ${page}: ${events.length} events (total so far: ${all.length})`)
    if (page >= data.total_pages) break
    page++
    await new Promise(r => setTimeout(r, 300)) // polite delay
  }

  return all
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔵 Fetching NHCC events via WordPress REST API...')
  const events = await fetchAllEvents()
  console.log(`  Total fetched: ${events.length} events\n`)

  if (isDryRun) console.log('  🔍 DRY RUN — no DB writes\n')

  // Load existing NHCC IDs to detect new vs updated
  const { data: existing } = await supabase
    .schema('public')
    .from('events')
    .select('id')
    .eq('source', 'nhcc')
  const existingIds = new Set((existing ?? []).map(e => e.id))
  console.log(`  ${existingIds.size} existing NHCC events in DB`)

  // Apply per-run limit
  const toProcess = events.slice(0, perRunLimit)
  console.log(`  Processing ${toProcess.length} events\n`)

  let inserted = 0, updated = 0, skipped = 0

  for (let i = 0; i < toProcess.length; i++) {
    const ev = toProcess[i]
    const title = decodeTitle(ev.title)
    const id = `nhcc-${ev.id}`

    // Require image (Matt's rule)
    const imageUrl = ev.image?.url
    if (!imageUrl) {
      console.log(`  [${i + 1}/${toProcess.length}] ⚠️  SKIP (no image): ${title}`)
      skipped++
      continue
    }

    // Parse start date — format: "2026-04-16 10:00:00"
    const startDateRaw = ev.start_date || ''
    const eventDate = startDateRaw.slice(0, 10) // YYYY-MM-DD
    if (!eventDate) {
      console.log(`  [${i + 1}/${toProcess.length}] ⚠️  SKIP (no date): ${title}`)
      skipped++
      continue
    }

    // Build datetime string for event_date (keep time if not midnight)
    const startTime = startDateRaw.slice(11, 16) // HH:MM
    const isAllDay = ev.all_day || startTime === '00:00'
    const eventDatetime = isAllDay ? eventDate : `${eventDate}T${startTime}:00-07:00`

    // Venue
    const venue = decodeTitle(ev.venue?.venue || 'National Hispanic Cultural Center')
    const venueAddr = [
      ev.venue?.address,
      ev.venue?.city ? `${ev.venue.city}, ${ev.venue.state} ${ev.venue.zip}`.trim() : null,
    ].filter(Boolean).join(', ')
    const address = venueAddr || '1701 4th St SW, Albuquerque, NM 87102'

    // Category from tags + title
    const tags = ev.tags || []
    const category = classify(title, tags)
    const price = formatPrice(ev.cost)
    const tagNames = tags.map(t => t.name).join(', ')

    // Strip HTML description, prefer excerpt if description is very long
    const description = stripHtml(ev.description) || stripHtml(ev.excerpt)

    console.log(`  [${i + 1}/${toProcess.length}] ${title}`)
    console.log(`    ${eventDate}  ${category}  ${venue}  ${price}`)

    // Build raw payload in 'local' normalizer format
    const raw = {
      title,
      venue,
      venue_name: venue,
      address,
      city: ev.venue?.city || 'Albuquerque',
      description,
      image: imageUrl,
      url: ev.url || 'https://nhccnm.org/events/',
      isFree: price === 'Free',
      price: price === 'Free' ? null : price,
      category,
      tags: tagNames,
      // Original WP data for reference
      nhcc_id: ev.id,
      nhcc_slug: ev.slug,
    }

    const row = {
      id,
      source: 'nhcc',
      raw,
      event_date: isAllDay ? eventDate : eventDatetime,
      cached_photo_url: imageUrl,
      featured: false,
      hidden: false,
      category,
      venue_name: venue,
    }

    if (isDryRun) {
      console.log(`    → DRY RUN: would upsert ${id}`)
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

    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ NHCC Import complete
   Inserted : ${inserted}
   Updated  : ${updated}
   Skipped  : ${skipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
