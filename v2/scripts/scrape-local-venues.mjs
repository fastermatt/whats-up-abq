#!/usr/bin/env node
/**
 * scrape-local-venues.mjs
 *
 * Scrapes event listings directly from local ABQ venue websites.
 * No images — just band/artist name, date, time, and venue.
 * Stored as source='local-venue' in Supabase.
 *
 * Flow per venue:
 *   1. Fetch venue homepage (or events subpage) HTML
 *   2. Claude Haiku — extract raw event text from the HTML
 *   3. DeepSeek    — normalize into structured JSON array
 *   4. Upsert to Supabase
 *
 * Usage:
 *   node scripts/scrape-local-venues.mjs [--dry-run] [--venue=thirsty-eye]
 *
 * Add new venues to the VENUES map below.
 * Requires in scripts/.env:
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   DEEPSEEK_API_KEY  (optional — falls back to hardcoded key)
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

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL     = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY    = process.env.ANTHROPIC_API_KEY
const DEEPSEEK_KEY     = process.env.DEEPSEEK_API_KEY || 'REDACTED_DEEPSEEK_KEY'
const HAIKU_MODEL      = 'claude-haiku-4-5'
const DEEPSEEK_MODEL   = 'deepseek-chat'
const USER_AGENT       = 'ABQUnplugged/2.0 (community events; 4mattcarlson@gmail.com)'

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set in scripts/.env')
  process.exit(1)
}
// Haiku is optional — falls back to DeepSeek for extraction when key not set
const USE_HAIKU = !!ANTHROPIC_KEY
if (!USE_HAIKU) {
  console.log('ℹ️  No ANTHROPIC_API_KEY — using DeepSeek for extraction (add key to scripts/.env for Haiku)')
}

const isDryRun   = process.argv.includes('--dry-run')
const venueArg   = process.argv.find(a => a.startsWith('--venue='))?.split('=')[1]
const verbose    = process.argv.includes('--verbose')

// ── Venue map ─────────────────────────────────────────────────────────────────
// slug → { name, url, neighborhood, address }
// url: the page that actually lists upcoming events
// Add new venues here — the script handles HTTP errors gracefully (skips the venue).
const VENUES = {
  'thirsty-eye': {
    name: 'Thirsty Eye Brewing Company',
    url: 'https://thirstyeyebrew.com/',
    neighborhood: 'nob-hill',
    address: '3200 Central Ave SE, Albuquerque, NM 87106',
  },
  'canteen-brewhouse': {
    name: 'Canteen Brewhouse',
    url: 'https://canteenbrewhouse.com/events/',
    neighborhood: 'downtown',
    address: '2381 Aztec Rd NE, Albuquerque, NM 87107',
  },
  'marble-brewery-downtown': {
    name: 'Marble Brewery Downtown',
    url: 'https://marblebrewery.com/events/',
    neighborhood: 'downtown',
    address: '111 Marble Ave NW, Albuquerque, NM 87102',
  },
  'launchpad': {
    name: 'Launchpad',
    url: 'https://launchpadrocks.com/',
    neighborhood: 'downtown',
    address: '618 Central Ave SW, Albuquerque, NM 87102',
  },
  // high-and-drying: domain offline (no DNS as of 2026-05)
  // bosque-brewing-nob-hill: domain offline (no DNS as of 2026-05)
  // tractor-brewing-nob-hill: domain flagged by SafeBrowse (abandoned/dangerous as of 2026-05)
  'outpost-performance-space': {
    name: 'Outpost Performance Space',
    url: 'https://outpostspace.org/',
    neighborhood: 'nob-hill',
    address: '210 Yale Blvd SE, Albuquerque, NM 87106',
  },
  'hops-and-dough': {
    name: 'Hops & Dough Taproom',
    url: 'https://hopsndough.com/events/',
    neighborhood: 'los-ranchos',
    address: '3128 Coors Blvd NW, Albuquerque, NM 87120',
  },
  // dirty-bourbon: 403 Cloudflare block on all programmatic requests (as of 2026-05)
  'holiday-bowl': {
    name: "Skidmore's Holiday Bowl",
    url: 'https://holidaybowlabq.com/',
    neighborhood: 'nob-hill',
    address: '3628 Central Ave SE, Albuquerque, NM 87106',
  },
  'mineshaft-tavern': {
    name: 'Mineshaft Tavern',
    url: 'https://themineshafttavern.com/',
    neighborhood: 'cedar-crest',
    address: '2846 NM-14, Cedar Crest, NM 87008',
  },
  'el-pinto': {
    name: 'El Pinto Restaurant & Cantina',
    url: 'https://elpinto.com/calendar/',
    neighborhood: 'north-valley',
    address: '10500 4th St NW, Albuquerque, NM 87114',
  },
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch a URL's HTML, follow redirects, return text (null on failure) */
async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      console.log(`    HTTP ${res.status} from ${url}`)
      return null
    }
    return await res.text()
  } catch (err) {
    console.log(`    Fetch error: ${err.message}`)
    return null
  }
}

/** Strip most HTML tags to reduce context size sent to Haiku */
function roughStripHtml(html) {
  return html
    // Remove scripts, styles, nav, header, footer, aside
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    // Keep tag contents but remove the tags themselves
    .replace(/<[^>]+>/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    // Cap at 12,000 chars to stay well within Haiku context
    .slice(0, 12_000)
}

/** Call Claude Haiku to extract raw event text from stripped HTML */
async function extractWithHaiku(venueText, venueName) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: `You are a data extraction assistant. Extract ONLY upcoming event information from venue website text.
Return a plain-text list, one event per line. Include the date, performer/act name, and time if available.
Skip past events (before today's date). Skip generic filler text.
If no events are found, respond with "NO_EVENTS".
Today's date is ${new Date().toISOString().slice(0, 10)}.`,
      messages: [
        {
          role: 'user',
          content: `Extract all upcoming events from the ${venueName} website text below:\n\n${venueText}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Haiku API error ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text?.trim() ?? ''
}

/** DeepSeek fallback: extract raw event text when no Anthropic key is available */
async function extractWithDeepSeek(venueText, venueName) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{
        role: 'user',
        content: `Extract ONLY upcoming events from the ${venueName} website text below. Return a plain-text list, one event per line with date, performer name, and time if available. Skip past events. If none found, respond with "NO_EVENTS". Today is ${new Date().toISOString().slice(0, 10)}.\n\n${venueText}`,
      }],
      temperature: 0.1,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepSeek extract error ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

/** Call DeepSeek to normalize extracted text into a structured JSON array */
async function normalizeWithDeepSeek(rawText, venueName) {
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `
You are a JSON data normalizer. Convert this list of upcoming events at "${venueName}" into a JSON array.
Return ONLY valid JSON — no markdown, no commentary, no code fences.
Today is ${today}. Only include events on or after today.
If the input is "NO_EVENTS" or has nothing useful, return an empty array: []

Each event object must have exactly these fields:
{
  "title": "Performer or event name (string)",
  "date": "YYYY-MM-DD (string, required)",
  "time": "HH:MM in 24h format or null if unknown",
  "notes": "Any extra detail like cover charge or open mic signup time, or null"
}

Rules:
- Use the current year (${new Date().getFullYear()}) unless the date implies next year
- If only a month/day is given (e.g. "May 3") infer year as ${new Date().getFullYear()} or ${new Date().getFullYear() + 1} based on whether that date has passed
- If time is like "7pm" convert to "19:00"
- "doors at X" → use that as time
- If the venue says events run a default time (e.g. "7-9 PM unless noted") apply it when no specific time is given
- Deduplicate obvious repeats

Input:
${rawText}
`

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepSeek API error ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  let text = data.choices?.[0]?.message?.content?.trim() ?? '[]'

  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    if (verbose) console.log('    ⚠️  DeepSeek returned non-JSON:', text.slice(0, 300))
    return []
  }
}

/** Build a stable deterministic ID for a local venue event */
function buildId(venueSlug, date, title) {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `local-venue-${venueSlug}-${date}-${titleSlug}`
}

/** Classify event into site categories based on title keywords.
 *  Values must match DB check constraint (title-cased). */
function classify(title) {
  const t = title.toLowerCase()
  if (/comedy|stand.?up|improv|bard/.test(t)) return 'Comedy'
  if (/trivia|quiz|bingo|book.?club|book.?swap|craft|bedazzl|run.?club|yoga/.test(t)) return 'Food & Drink'
  if (/record.?fair|story.?slam|art/.test(t)) return 'Arts & Theater'
  if (/adoption|charity|benefit|walk|run|5k/.test(t)) return 'Community'
  if (/festival|fest/.test(t)) return 'Festivals'
  return 'Music' // live music is the default for local venue events
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎸 Local Venue Scraper${isDryRun ? ' [DRY RUN]' : ''}`)
  console.log('━'.repeat(50))

  // Filter to a single venue if --venue= arg provided
  const targetVenues = venueArg
    ? Object.entries(VENUES).filter(([slug]) => slug === venueArg)
    : Object.entries(VENUES)

  if (venueArg && targetVenues.length === 0) {
    console.error(`❌ Unknown venue slug: "${venueArg}"`)
    console.log('Available slugs:', Object.keys(VENUES).join(', '))
    process.exit(1)
  }

  // Load existing local-venue IDs to detect new vs updated
  const { data: existingRows } = await supabase
    .schema('public')
    .from('events')
    .select('id')
    .eq('source', 'local-venue')
  const existingIds = new Set((existingRows ?? []).map(r => r.id))

  let totalInserted = 0
  let totalUpdated  = 0
  let totalSkipped  = 0
  let venuesOk      = 0
  let venuesFailed  = 0

  for (const [slug, venue] of targetVenues) {
    console.log(`\n🏠 ${venue.name}`)
    console.log(`   ${venue.url}`)

    // 1. Fetch HTML
    const html = await fetchHtml(venue.url)
    if (!html) {
      console.log('   ⚠️  Could not fetch — skipping')
      venuesFailed++
      continue
    }
    if (verbose) console.log(`   HTML: ${html.length.toLocaleString()} chars`)

    // 2. Strip + extract with Haiku (or DeepSeek if no Anthropic key)
    const strippedText = roughStripHtml(html)
    if (verbose) console.log(`   Stripped: ${strippedText.length.toLocaleString()} chars`)

    let rawEventText
    try {
      if (USE_HAIKU) {
        rawEventText = await extractWithHaiku(strippedText, venue.name)
        if (verbose) console.log('   Haiku output:', rawEventText.slice(0, 300))
      } else {
        rawEventText = await extractWithDeepSeek(strippedText, venue.name)
        if (verbose) console.log('   DeepSeek extract output:', rawEventText.slice(0, 300))
      }
    } catch (err) {
      console.log(`   ❌ Extraction failed: ${err.message}`)
      venuesFailed++
      continue
    }

    if (!rawEventText || rawEventText === 'NO_EVENTS' || rawEventText.length < 10) {
      console.log('   ℹ️  No events found')
      venuesOk++
      continue
    }

    // 3. Normalize with DeepSeek
    let events
    try {
      events = await normalizeWithDeepSeek(rawEventText, venue.name)
    } catch (err) {
      console.log(`   ❌ DeepSeek failed: ${err.message}`)
      venuesFailed++
      continue
    }

    if (events.length === 0) {
      console.log('   ℹ️  No structured events extracted')
      venuesOk++
      continue
    }

    console.log(`   📅 ${events.length} event(s) found`)
    venuesOk++

    // 4. Upsert each event
    for (const ev of events) {
      if (!ev.date || !ev.title) {
        if (verbose) console.log(`   ⚠️  Skipping incomplete event: ${JSON.stringify(ev)}`)
        totalSkipped++
        continue
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) {
        if (verbose) console.log(`   ⚠️  Bad date format: ${ev.date}`)
        totalSkipped++
        continue
      }

      // Skip past events
      const today = new Date().toISOString().slice(0, 10)
      if (ev.date < today) {
        if (verbose) console.log(`   ⏭  Past event: ${ev.date} ${ev.title}`)
        totalSkipped++
        continue
      }

      const id = buildId(slug, ev.date, ev.title)
      const category = classify(ev.title)

      // Build event_date — include time if available
      const eventDate = ev.time
        ? `${ev.date}T${ev.time}:00-07:00`
        : ev.date

      const raw = {
        title: ev.title,
        venue: venue.name,
        venue_name: venue.name,
        address: venue.address,
        city: 'Albuquerque',
        category,
        isFree: false,
        notes: ev.notes ?? null,
        source_url: venue.url,
        // Store scraped time separately for display
        start_time: ev.time ?? null,
        // TM-compat format for normalizeLocal
        dates: {
          start: {
            localDate: ev.date,
            localTime: ev.time ? `${ev.time}:00` : null,
          },
        },
      }

      const row = {
        id,
        source: 'local-venue',
        raw,
        event_date: eventDate,
        cached_photo_url: null,
        featured: false,
        hidden: false,
        category,
        venue_name: venue.name,
        neighborhood: venue.neighborhood ?? null,
      }

      const isNew = !existingIds.has(id)
      console.log(`   ${isNew ? '➕' : '🔄'} ${ev.date}  ${ev.title}`)
      if (ev.notes) console.log(`      ${ev.notes}`)

      if (isDryRun) {
        if (isNew) totalInserted++
        else totalUpdated++
        continue
      }

      const { error } = await supabase
        .schema('public')
        .from('events')
        .upsert(row, { onConflict: 'id' })

      if (error) {
        console.log(`   ❌ DB error: ${error.message}`)
        totalSkipped++
      } else {
        if (isNew) totalInserted++
        else totalUpdated++
      }
    }

    // Small delay between venues to be polite
    await new Promise(r => setTimeout(r, 1_000))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Venue scraper complete
   Venues OK     : ${venuesOk}
   Venues failed : ${venuesFailed}
   Inserted      : ${totalInserted}
   Updated       : ${totalUpdated}
   Skipped       : ${totalSkipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
