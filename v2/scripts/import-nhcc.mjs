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

/**
 * NHCC API does not populate the `cost` field or `all_day: false` for most
 * events — everything is embedded in the description HTML. These helpers
 * extract structured data from the raw HTML before stripping tags.
 */

/** Extract the first start time from NHCC description HTML.
 *  NHCC always puts time in the first couple of paragraphs:
 *    "8:00 am – 5:00 pm" | "12:00 pm" | "5:00 – 7:00 pm" | "10:00 am to 4:00 pm"
 *  Returns "H:MM AM/PM" display string or null if none found. */
function extractTimeFromDesc(html) {
  if (!html) return null
  // Strip tags, decode entities for clean text matching
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
  // Match the first standalone time (not a year like "2026")
  const m = text.match(/\b(\d{1,2}:\d{2})\s*(am|pm)/i)
  if (!m) return null
  let [, hhmm, ampm] = m
  // Normalise: "8:00 am" → "8:00 AM"
  return `${hhmm} ${ampm.toUpperCase()}`
}

/** Extract ticket/reservation URL from NHCC description HTML.
 *  NHCC embeds ticket links as <a href="...">RESERVE YOUR TICKETS HERE!</a>
 *  Returns first external href found (nhccnm.org/wp/... or my.nmculture.org/...) or null. */
function extractTicketUrl(html) {
  if (!html) return null
  // Match <a href="..."> that looks like a ticket/reservation link
  const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:ticket|reserve|purchase|buy|book|register|here)[^<]*)/gi
  let m
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].trim()
    if (href && href.startsWith('http')) return href
  }
  // Fallback: any my.nmculture.org or eventbrite link
  const culturem = html.match(/href=["'](https?:\/\/my\.nmculture\.org\/[^"']+)["']/i)
  if (culturem) return culturem[1]
  const ebrm = html.match(/href=["'](https?:\/\/(?:www\.)?eventbrite\.com\/[^"']+)["']/i)
  if (ebrm) return ebrm[1]
  return null
}

/** Extract price from NHCC description HTML.
 *  The API `cost` field is almost always empty; price is in the description text:
 *    "All tickets $16 each" | "All tickets $20" | "Free" | "free, monthly" | "$2" | "Admission $10"
 *  Returns formatted price string or null (null = unknown, not necessarily free). */
function extractPriceFromDesc(html) {
  if (!html) return null
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

  // Explicit free indicators
  if (/\bfree\s+(?:community\s+)?event\b/i.test(text)) return 'Free'
  if (/\bno\s+cost\b/i.test(text)) return 'Free'
  if (/\bfree\s+(?:admission|entry|to\s+all|for\s+all)\b/i.test(text)) return 'Free'
  // "free, monthly" → free
  if (/\bthis\s+free\b/i.test(text) || /\bfree,?\s+(monthly|program|class)/i.test(text)) return 'Free'

  // Explicit dollar amounts: "$16", "$10–$20", "$2 per person", "tickets $20", "admission $10"
  const rangeM = text.match(/\$(\d+(?:\.\d+)?)\s*(?:–|-)\s*\$(\d+(?:\.\d+)?)/)
  if (rangeM) return `$${rangeM[1]}–$${rangeM[2]}`
  // "All tickets $16 each" | "tickets $20" | "admission $10" | "$16 per"
  const amountM = text.match(/(?:ticket|tickets|admission|cost|price)[^.]{0,30}\$(\d+(?:\.\d+)?)/i)
              || text.match(/\$(\d+(?:\.\d+)?)\s*(?:each|per|per person)/i)
  if (amountM) return `$${amountM[1]}`
  // Bare $ amount early in description (first 300 chars)
  const bareM = text.slice(0, 300).match(/\$(\d+(?:\.\d+)?)/)
  if (bareM) return `$${bareM[1]}`

  return null  // Unknown — do NOT assume free
}

/** Format price: explicit cost field (rarely populated) → structured display. */
function formatPrice(cost, descHtml) {
  // 1. Structured API field (rarely filled by NHCC)
  if (cost && cost.trim() && !/^\s*$/.test(cost)) {
    if (/free/i.test(cost)) return 'Free'
    const range = cost.match(/(\d+)\s*[-–]\s*(\d+)/)
    if (range) return `$${range[1]}–$${range[2]}`
    const single = cost.match(/(\d+(?:\.\d+)?)/)
    if (single) return `$${single[1]}`
    return cost.trim()
  }
  // 2. Parse from description HTML (NHCC's actual data source for price)
  return extractPriceFromDesc(descHtml)
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

    // ── Time ─────────────────────────────────────────────────────────────────
    // NHCC almost always sets all_day=true and start_date to midnight, putting
    // the real time in the description HTML. Extract it from there first, then
    // fall back to the structured start_date field.
    const startTime = startDateRaw.slice(11, 16) // HH:MM from API
    const isAllDay = ev.all_day || startTime === '00:00'
    const descTime  = extractTimeFromDesc(ev.description)  // "8:00 AM" | null
    // event_date: use date-only when all_day or when the API gives midnight;
    // for rare timestamped events, embed the time in the field.
    const eventDatetime = isAllDay ? eventDate : `${eventDate}T${startTime}:00-07:00`

    // ── Price ─────────────────────────────────────────────────────────────────
    // Pass both the API cost field AND the raw HTML so formatPrice can extract
    // price from the description when the cost field is empty (which is nearly
    // always for NHCC events).
    const price = formatPrice(ev.cost, ev.description)

    // ── Ticket URL ────────────────────────────────────────────────────────────
    // NHCC embeds ticket/reservation links as anchor tags in the description.
    // Extract before stripping HTML.
    const ticketUrl = extractTicketUrl(ev.description)
              || (ev.website && ev.website !== ev.url ? ev.website : null)

    // ── Venue ─────────────────────────────────────────────────────────────────
    const venue = decodeTitle(ev.venue?.venue || 'National Hispanic Cultural Center')
    const venueAddr = [
      ev.venue?.address,
      ev.venue?.city ? `${ev.venue.city}, ${ev.venue.state} ${ev.venue.zip}`.trim() : null,
    ].filter(Boolean).join(', ')
    const address = venueAddr || '1701 4th St SW, Albuquerque, NM 87102'

    // Category from tags + title
    const tags = ev.tags || []
    const category = classify(title, tags)
    const tagNames = tags.map(t => t.name).join(', ')

    // Strip HTML description, prefer excerpt if description is very long
    const description = stripHtml(ev.description) || stripHtml(ev.excerpt)

    const priceDisplay = price ?? 'See website'
    console.log(`  [${i + 1}/${toProcess.length}] ${title}`)
    console.log(`    ${eventDate} ${descTime ?? '(time in desc)'}  ${category}  ${venue}  ${priceDisplay}`)

    // Build raw payload in 'local' normalizer format.
    // The normalizeLocal() dispatcher reads these fields:
    //   title/name → display title
    //   time        → display time string (shown on event cards + detail page)
    //   url         → event page
    //   ticket_url  → CTA button target
    //   isFree      → drives "Free" badge; set only when confirmed free
    //   price       → display string ("$16", "$10–$20", null = unknown)
    const raw = {
      title,
      venue,
      venue_name: venue,
      address,
      city: ev.venue?.city || 'Albuquerque',
      description,
      image: imageUrl,
      url: ev.url || 'https://nhccnm.org/events/',
      ticket_url: ticketUrl ?? undefined,
      // Time from description (e.g. "8:00 AM") — shown on cards and detail page.
      // Only set when we successfully parsed it; absent means "check the event page".
      time: descTime ?? undefined,
      // isFree: ONLY true when we can confirm it from API cost field or description.
      // Leave false when price is unknown — never assume free.
      isFree: price === 'Free',
      price: price === 'Free' ? null : price,  // null for free; string like "$16" otherwise
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
