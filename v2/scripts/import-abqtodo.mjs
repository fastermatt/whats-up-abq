#!/usr/bin/env node
/**
 * Import events from abqtodo.com
 *
 * Uses the same WordPress Tribe Events REST API pattern as NHCC:
 *   https://abqtodo.com/wp-json/tribe/events/v1/events
 *
 * Fills the previously-missing `source='local'` pipeline — abqtodo was a
 * one-time manual import that was going stale. This script refreshes it
 * weekly as part of the Tuesday pipeline.
 *
 * Safety rails:
 *   - Blocks obvious virtual events (title/venue/description regex) — same
 *     logic as import-eventbrite.mjs so we don't re-introduce bugs.
 *   - Preserves image_status = 'rejected' on re-import (DB trigger handles it).
 *   - Only keeps events whose venue city is in the ABQ metro whitelist.
 *   - Upserts by (id) — safe to re-run any time.
 *
 * Source tag: 'local'
 * ID format:  abqtodo-{wp_post_id}
 *
 * Usage:
 *   node scripts/import-abqtodo.mjs [--dry-run] [--limit=N]
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load .env ────────────────────────────────────────────────────────────────
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env.local'),
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
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set.')
  process.exit(1)
}

const isDryRun    = process.argv.includes('--dry-run')
const limitArg    = process.argv.find(a => a.startsWith('--limit='))
const perRunLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 9999

const API_BASE   = 'https://abqtodo.com/wp-json/tribe/events/v1/events'
const USER_AGENT = 'ABQUnplugged/2.0 (community aggregator; 4mattcarlson@gmail.com)'

// Metro cities we accept — anything else gets rejected.
const ABQ_CITIES = new Set([
  'albuquerque', 'abq', 'rio rancho', 'bernalillo', 'los ranchos',
  'los ranchos de albuquerque', 'corrales', 'sandia park', 'tijeras',
  'cedar crest', 'placitas', 'edgewood',
])

const VIRTUAL_RE = /\b(virtual event|online (class|event|workshop|webinar|meeting)|zoom webinar|zoom meeting|via zoom|live ?stream|webinar|online\/virtual|google meet|microsoft teams)\b/i

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html) {
  if (!html) return null
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&#038;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 600)
}

function decodeTitle(s) {
  if (!s) return ''
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim()
}

/** Classify abqtodo event into site categories using tags + title keywords. */
function classify(title, description, tags) {
  const tagSlugs = tags.map(t => (t.slug || t.name || '').toLowerCase())
  const text     = (title + ' ' + (description || '') + ' ' + tagSlugs.join(' ')).toLowerCase()

  // Arts & Theater first — auditions, musicals, plays, ballet, opera
  // (this must beat the Community default when keywords like "musical" appear)
  if (/\b(audition|the musical\b|broadway|play\b|the play\b|ballet|opera|theatre|theater company)\b/.test(text))
    return 'Arts & Theater'

  // Family / Kids — many abqtodo events are storytimes
  if (tagSlugs.some(s => ['family', 'kids', 'children', 'early-childhood'].includes(s))
      || /\b(storytime|story time|lego|duplo|kid|children|baby|toddler|family fun|family friendly)\b/.test(text))
    return 'Family'

  // Comedy
  if (tagSlugs.some(s => ['comedy','stand-up','improv'].includes(s))
      || /\b(comedy|stand.?up|improv|open mic)\b/.test(text))
    return 'Comedy'

  // Film
  if (tagSlugs.some(s => ['film','cinema','movie','movies','screening'].includes(s))
      || /\b(film screening|movie night|short film)\b/.test(text))
    return 'Film'

  // Sports
  if (tagSlugs.some(s => ['sports','fitness','running','yoga'].includes(s))
      || /\b(5k|10k|marathon|race|yoga|pilates|crossfit|fitness class)\b/.test(text))
    return 'Sports'

  // Outdoor — but don't misclassify indoor cultural-center events
  if (!/\b(cultural center|museum|gallery|indoor|center\b)\b/.test(text)
      && (tagSlugs.some(s => ['outdoor','outdoors','hiking','nature'].includes(s))
          || /\b(hike|trail|bosque|balloon fiesta|rio grande nature|open space|nature walk)\b/.test(text)))
    return 'Outdoor'

  // Festivals
  if (tagSlugs.some(s => ['festival','festivals','fair','fiesta'].includes(s))
      || /\b(festival|fiesta|fair|gran baile)\b/.test(text))
    return 'Festivals'

  // Food & Drink
  if (tagSlugs.some(s => ['food','drink','beer','wine','dining','culinary'].includes(s))
      || /\b(tasting|wine|brewery|beer|farmers market|culinary|cooking class|pairing)\b/.test(text))
    return 'Food & Drink'

  // Music
  if (tagSlugs.some(s => ['music','concert','concerts','live-music'].includes(s))
      || /\b(concert|live music|singer|songwriter|band|performance|album release)\b/.test(text))
    return 'Music'

  // Arts & Theater
  if (tagSlugs.some(s => ['art','arts','theatre','theater','gallery','exhibition','dance','crafts','craft'].includes(s))
      || /\b(gallery|exhibit|exhibition|art walk|ballet|opera|theatre|theater|play|pottery|painting class|crafts)\b/.test(text))
    return 'Arts & Theater'

  // Default
  return 'Community'
}

function formatPrice(cost) {
  if (!cost || cost.trim() === '' || /free/i.test(cost)) return 'Free'
  const range = cost.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return `$${range[1]}–$${range[2]}`
  const single = cost.match(/\d+/)
  if (single) return `$${single[0]}`
  return cost
}

async function fetchAllEvents() {
  const today = new Date()
  const startDate = today.toISOString().slice(0, 10)
  const end   = new Date(today.getTime() + 90 * 86400000)
  const endDate = end.toISOString().slice(0, 10)

  let page = 1
  // Keep only the earliest upcoming occurrence per series (by slug).
  const bySlug = new Map()  // slug -> event
  const MAX_PAGES = 30 // hard safety cap — should be plenty with end_date=+90d

  while (page <= MAX_PAGES) {
    const url = `${API_BASE}?per_page=50&status=publish&start_date=${startDate}&end_date=${endDate}&page=${page}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20000),
    })
    if (!resp.ok) {
      console.error(`❌ API error: HTTP ${resp.status}`)
      break
    }
    const data = await resp.json()
    const events = data.events || []
    if (events.length === 0) break

    for (const ev of events) {
      const slug = ev.slug || `id-${ev.id}`
      const existing = bySlug.get(slug)
      if (!existing || (ev.start_date || '') < (existing.start_date || '')) {
        bySlug.set(slug, ev)
      }
    }
    console.log(`  Page ${page}: ${events.length} events (unique-series so far: ${bySlug.size})`)
    if (page >= (data.total_pages || 1)) break
    page++
    await new Promise(r => setTimeout(r, 250))
  }

  return Array.from(bySlug.values()).sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
}

function shouldBlock(ev, title, description, venue) {
  // Block virtual events by title/venue/description
  const haystack = [title, venue?.venue, venue?.address, description].filter(Boolean).join(' | ')
  if (VIRTUAL_RE.test(haystack)) return 'virtual'

  // Block if city not in ABQ metro (normalize: strip trailing ", NM" / state, lowercase)
  const city = (venue?.city || '')
    .toLowerCase()
    .replace(/,?\s*(nm|new mexico)\s*$/i, '')
    .replace(/[.]/g, '')
    .trim()
  if (city && !ABQ_CITIES.has(city)) return `out_of_metro:${city}`

  return null
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔵 Fetching abqtodo.com events via Tribe REST API...')
  const events = await fetchAllEvents()
  console.log(`  Total fetched: ${events.length} events\n`)

  if (isDryRun) console.log('  🔍 DRY RUN — no DB writes\n')

  const { data: existing } = await supabase
    .schema('public').from('events')
    .select('id, image_status, cached_photo_url')
    .like('id', 'abqtodo-%')
  const existingById = new Map((existing ?? []).map(e => [e.id, e]))
  console.log(`  ${existingById.size} existing abqtodo events in DB`)

  const toProcess = events.slice(0, perRunLimit)
  console.log(`  Processing ${toProcess.length} events\n`)

  let inserted = 0, updated = 0, skipped = 0, blocked = 0

  for (let i = 0; i < toProcess.length; i++) {
    const ev    = toProcess[i]
    const title = decodeTitle(ev.title)
    const id    = `abqtodo-${ev.id}`
    const description = stripHtml(ev.description) || stripHtml(ev.excerpt)
    const venue = ev.venue || {}

    const blockReason = shouldBlock(ev, title, description, venue)
    if (blockReason) {
      console.log(`  [${i + 1}/${toProcess.length}] ⊘ BLOCK (${blockReason}): ${title}`)
      blocked++
      continue
    }

    const imageUrl = ev.image?.url || ev.image?.sizes?.large?.url || null
    if (!imageUrl) {
      console.log(`  [${i + 1}/${toProcess.length}] ⚠ SKIP (no image): ${title}`)
      skipped++
      continue
    }

    // Parse start date
    const startDateRaw = ev.start_date || ''
    const eventDate    = startDateRaw.slice(0, 10)
    if (!eventDate) {
      console.log(`  [${i + 1}/${toProcess.length}] ⚠ SKIP (no date): ${title}`)
      skipped++
      continue
    }

    const startTime   = startDateRaw.slice(11, 16)
    const isAllDay    = ev.all_day || startTime === '00:00'
    const eventDatetime = isAllDay ? eventDate : `${eventDate}T${startTime}:00-07:00`

    const venueName = decodeTitle(venue.venue || '')
    const venueAddr = [
      venue.address,
      venue.city ? `${venue.city}, ${venue.state || 'NM'} ${venue.zip || ''}`.trim() : null,
    ].filter(Boolean).join(', ')

    const tags     = ev.tags || []
    const category = classify(title, description, tags)
    const price    = formatPrice(ev.cost)

    console.log(`  [${i + 1}/${toProcess.length}] ${title}`)
    console.log(`    ${eventDate}${!isAllDay ? ' '+startTime : ''}  ${category}  ${venueName || '(no venue)'}  ${price}`)

    // Build raw payload matching the 'local' normalizer contract
    const raw = {
      id,
      url: ev.url || `https://abqtodo.com/event/${ev.slug || ''}/`,
      info: description?.slice(0, 500) || '',
      name: title,
      dates: {
        start: {
          localDate: eventDate,
          localTime: isAllDay ? null : startTime,
        },
      },
      images: imageUrl ? [{ url: imageUrl }] : [],
      isFree: price === 'Free',
      _source: 'local',
      _embedded: {
        venues: [{
          name: venueName || 'Albuquerque',
          city:  { name: venue.city || 'Albuquerque' },
          state: { name: venue.state || 'NM' },
          address: { line1: venue.address || '' },
          postalCode: venue.zip || null,
        }],
      },
      description,
      ticketLinks: [{ url: ev.url || 'https://abqtodo.com' }],
      classifications: [{ segment: { name: category } }],
      abqtodo_id: ev.id,
      abqtodo_slug: ev.slug,
    }

    // Preserve admin rejections
    const prior = existingById.get(id)
    const preserveCached = prior?.image_status === 'rejected'

    const row = {
      id,
      source: 'local',
      raw,
      event_date: isAllDay ? eventDate : eventDatetime,
      cached_photo_url: preserveCached ? (prior.cached_photo_url ?? null) : imageUrl,
      featured: false,
      hidden: false,
      category,
      venue_name: venueName || null,
    }

    if (isDryRun) {
      console.log(`    → DRY RUN: would upsert ${id}`)
      inserted++
      continue
    }

    const isNew = !existingById.has(id)
    const { error } = await supabase
      .schema('public').from('events')
      .upsert(row, { onConflict: 'id' })

    if (error) {
      console.error(`    ❌ DB error: ${error.message}`)
      skipped++
    } else {
      console.log(`    ✅ ${isNew ? 'Inserted' : 'Updated'}`)
      if (isNew) inserted++
      else updated++
    }

    await new Promise(r => setTimeout(r, 80))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ abqtodo Import complete
   Inserted : ${inserted}
   Updated  : ${updated}
   Blocked  : ${blocked}
   Skipped  : ${skipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
