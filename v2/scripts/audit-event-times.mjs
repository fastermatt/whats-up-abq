/**
 * audit-event-times.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Compares every event's stored start time against the live source website.
 * Covers all sources: ticketmaster, seatgeek, eventbrite, local, volunteer, nhcc.
 *
 * Lookup strategy per source:
 *   ticketmaster  → TM Discovery API (no scraping needed)
 *   seatgeek      → URL slug parse (instant); SG API fallback
 *   eventbrite    → JSON-LD from page; LM Studio fallback
 *   local / volunteer / nhcc → JSON-LD from page; LM Studio fallback
 *
 * --fix mode (HIGH-CONFIDENCE only):
 *   Automatically patches raw.dates.start.localTime in the DB for any WRONG
 *   or MISSING event where the source time was confirmed via a reliable method
 *   (tm-api, sg-api, url-parse, json-ld). LLM-sourced times are never auto-fixed.
 *
 * Usage:
 *   node scripts/audit-event-times.mjs [options]
 *
 * Options:
 *   --limit=N          Max events to check per run (default: 500)
 *   --source=NAME      Only one source: ticketmaster|seatgeek|eventbrite|local|...
 *   --fix              Auto-patch DB for WRONG/MISSING (high-confidence only)
 *   --dry-run          List events but don't fetch source pages
 *   --no-llm           Skip LM Studio fallback (faster)
 *   --skip-unknown     Omit UNKNOWN rows from CSV
 *   --output=PATH      CSV path (default: scripts/time-audit-YYYY-MM-DD.csv)
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY in scripts/.env (or env)
 * Optional: LM Studio at localhost:1234 for fallback extraction
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Load .env ────────────────────────────────────────────────────────────────
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', 'scripts', '.env'),
  path.join(__dirname, '..', '..', 'scripts', '.env'),
  path.join(__dirname, '..', '.env.local'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
    break
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const TM_API_KEY    = process.env.TICKETMASTER_API_KEY
const SG_AID        = process.env.SEATGEEK_AID || process.env.SEATGEEK_CLIENT_ID
const LM_URL        = 'http://localhost:1234/v1/chat/completions'
const LM_MODEL      = process.env.LM_MODEL || 'google/gemma-4-e4b'

// Only trust these methods for auto-fix — never fix from LLM output
const HIGH_CONFIDENCE = new Set(['tm-api', 'sg-api', 'url-parse', 'json-ld'])

if (!SUPABASE_KEY) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env')
  process.exit(1)
}

const args         = process.argv.slice(2)
const isDryRun     = args.includes('--dry-run')
const doFix        = args.includes('--fix')
const noLLM        = args.includes('--no-llm')
const skipUnknown  = args.includes('--skip-unknown')
const limitArg     = args.find(a => a.startsWith('--limit='))
const sourceArg    = args.find(a => a.startsWith('--source='))
const outputArg    = args.find(a => a.startsWith('--output='))

const MAX_EVENTS    = limitArg ? parseInt(limitArg.split('=')[1]) : 500
const SOURCE_FILTER = sourceArg ? sourceArg.split('=')[1] : null
const today         = new Date().toISOString().slice(0, 10)
const OUTPUT_CSV    = outputArg
  ? outputArg.split('=')[1]
  : path.join(__dirname, `time-audit-${today}.csv`)

const ALL_SOURCES   = ['ticketmaster', 'seatgeek', 'eventbrite', 'local', 'volunteer', 'nhcc']
const FETCH_DELAY_MS       = 1200   // pause between page fetches
const FETCH_TIMEOUT_MS     = 15000
const MAX_SCRAPE_ERRORS    = 25     // stop if site is hammering us back

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const delay    = ms => new Promise(r => setTimeout(r, ms))

// ─── Time conversion helpers ──────────────────────────────────────────────────

/** "18:30" or "18:30:00" (24h) → "6:30 PM" */
function to12h(time24) {
  if (!time24) return null
  const [hStr, mStr] = time24.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr || '0', 10)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

/** "6:30 PM" → "18:30"  (for DB storage) */
function to24h(time12) {
  if (!time12) return null
  const m = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2]
  const suffix = m[3].toUpperCase()
  if (suffix === 'PM' && h !== 12) h += 12
  if (suffix === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}`
}

/** Normalise any time string → "H:MM AM/PM" for comparison.
 *  Handles: "7:30 PM", "19:30", "19:30:00", "7:30PM", "7PM",
 *           ISO "2026-04-25T19:30:00", ISO "2026-04-25T19:30:00-06:00" */
function normaliseTime(raw) {
  if (!raw) return null
  raw = String(raw).trim()

  // ISO datetime with timezone offset — strip offset, use local part
  const isoTz = raw.match(/T(\d{2}):(\d{2})(?::\d{2})?([+-]\d{2}:\d{2}|Z)?/)
  if (isoTz) {
    return to12h(`${isoTz[1]}:${isoTz[2]}`)
  }

  // 24h "HH:MM" or "HH:MM:SS"
  const h24 = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (h24) return to12h(`${h24[1]}:${h24[2]}`)

  // 12h "7:30 PM" / "7:30PM" / "7 PM"
  const h12 = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (h12) {
    const hr  = parseInt(h12[1], 10)
    const mn  = parseInt(h12[2] || '0', 10)
    const suf = h12[3].toUpperCase()
    let h24v  = hr
    if (suf === 'PM' && hr !== 12) h24v += 12
    if (suf === 'AM' && hr === 12) h24v = 0
    return to12h(`${h24v}:${mn}`)
  }

  return null
}

/** Parse time from SeatGeek URL slug.
 *  "…2026-04-25-8-pm/…" → "8:00 PM"
 *  "…2026-08-22-7-30-pm/…" → "7:30 PM" */
function parseSeatGeekUrlTime(url) {
  if (!url) return null
  const m = url.match(/-(\d{4})-(\d{2})-(\d{2})-(\d{1,2})(?:-(\d{2}))?-(am|pm)(?:\/|$)/i)
  if (!m) return null
  const h   = parseInt(m[4], 10)
  const min = parseInt(m[5] || '0', 10)
  const suf = m[6].toUpperCase()
  let h24   = h
  if (suf === 'PM' && h !== 12) h24 += 12
  if (suf === 'AM' && h === 12) h24 = 0
  return to12h(`${h24}:${min}`)
}

// ─── HTTP fetch ───────────────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
]
let uaIdx = 0

async function fetchPage(url) {
  const ua   = USER_AGENTS[uaIdx++ % USER_AGENTS.length]
  const resp = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.text()
}

// ─── JSON-LD extraction ───────────────────────────────────────────────────────
function extractJsonLdTime(html) {
  const blocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )]
  for (const block of blocks) {
    try {
      const data  = JSON.parse(block[1])
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        const evts = item['@graph']
          ? item['@graph'].filter(x =>
              x['@type'] === 'Event' || (Array.isArray(x['@type']) && x['@type'].includes('Event'))
            )
          : (item['@type'] === 'Event' || (Array.isArray(item['@type']) && item['@type'].includes('Event')))
            ? [item] : []
        for (const evt of evts) {
          const sd = evt.startDate || evt.startTime
          if (sd) return normaliseTime(sd)
        }
      }
    } catch {}
  }
  return null
}

// ─── LM Studio fallback ───────────────────────────────────────────────────────
async function extractTimeWithLLM(html, eventName, eventDate) {
  const stripped = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 4000)

  const prompt =
    `Event: "${eventName}" on ${eventDate}.\n` +
    `From this page text, what is the event start time?\n` +
    `Reply ONLY with the time like "7:30 PM" or "12:00 AM". If not found reply "unknown".\n\n` +
    `Page:\n${stripped}`

  try {
    const res = await fetch(LM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const text = (json.choices?.[0]?.message?.content ?? '').trim()
    if (text.toLowerCase() === 'unknown') return null
    return normaliseTime(text) || null
  } catch {
    return null
  }
}

// ─── Source-specific ID extractors ───────────────────────────────────────────
function extractTmId(event) {
  const fromId = event.id?.replace(/^ticketmaster_/, '')
  if (fromId && fromId !== event.id) return fromId
  const url = event.raw?.url || ''
  return url.split('/').pop()?.split('?')[0] || null
}

function extractSgId(event) {
  const fromId = event.id?.replace(/^seatgeek_/, '')
  if (fromId && fromId !== event.id) return fromId
  const m = (event.raw?.url || '').match(/\/(\d+)(?:\?|$)/)
  return m ? m[1] : null
}

// ─── API lookups ──────────────────────────────────────────────────────────────
async function getTmTimeViaApi(event) {
  if (!TM_API_KEY) return null
  const tmId = extractTmId(event)
  if (!tmId) return null
  try {
    const res  = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events/${tmId}.json?apikey=${TM_API_KEY}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return normaliseTime(data?.dates?.start?.localTime)
  } catch { return null }
}

async function getSgTimeViaApi(event) {
  if (!SG_AID) return null
  const sgId = extractSgId(event)
  if (!sgId) return null
  try {
    const res  = await fetch(
      `https://api.seatgeek.com/2/events/${sgId}?aid=${SG_AID}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return normaliseTime(data?.datetime_local)
  } catch { return null }
}

// ─── Per-event source lookup ──────────────────────────────────────────────────
async function getSourceTime(event, useLLM) {
  const url = event.raw?.url

  if (event.source === 'ticketmaster') {
    const t = await getTmTimeViaApi(event)
    return { sourceTime: t, method: t ? 'tm-api' : 'tm-api-failed' }
  }

  if (event.source === 'seatgeek') {
    const urlTime = parseSeatGeekUrlTime(url)
    if (urlTime) return { sourceTime: urlTime, method: 'url-parse' }
    const apiTime = await getSgTimeViaApi(event)
    return { sourceTime: apiTime, method: apiTime ? 'sg-api' : 'sg-no-time' }
  }

  // All other sources (eventbrite, local, volunteer, nhcc): scrape page
  if (!url) return { sourceTime: null, method: 'no-url' }

  let html
  try {
    html = await fetchPage(url)
  } catch (err) {
    return { sourceTime: null, method: `fetch-error: ${err.message.slice(0, 40)}` }
  }

  const jldTime = extractJsonLdTime(html)
  if (jldTime) return { sourceTime: jldTime, method: 'json-ld' }

  if (useLLM) {
    const name    = event.raw?.name || event.raw?.title || ''
    const llmTime = await extractTimeWithLLM(html, name, event.event_date)
    return { sourceTime: llmTime, method: llmTime ? 'llm' : 'llm-unknown' }
  }

  return { sourceTime: null, method: 'not-found' }
}

// ─── DB fix: patch raw.dates.start.localTime ─────────────────────────────────
async function applyFix(eventId, sourceTime12h) {
  const time24 = to24h(sourceTime12h)
  if (!time24) {
    console.error(`    ⚠ Could not convert "${sourceTime12h}" to 24h — skipping`)
    return false
  }
  const { error } = await supabase.rpc('', {}).then(() => ({ error: null }))
    .catch(() => ({ error: 'rpc-not-used' }))

  // Use raw SQL via execute_sql not available here — use Supabase update instead
  // jsonb_set needs to be done via a raw update. We'll use the Supabase JS
  // workaround: fetch full raw, update the field, write back.
  const { data: row, error: fetchErr } = await supabase
    .from('events')
    .select('raw')
    .eq('id', eventId)
    .single()

  if (fetchErr || !row) return false

  const updatedRaw = {
    ...row.raw,
    dates: {
      ...(row.raw.dates || {}),
      start: {
        ...((row.raw.dates || {}).start || {}),
        localTime: time24,
      },
    },
  }

  const { error: updateErr } = await supabase
    .from('events')
    .update({ raw: updatedRaw })
    .eq('id', eventId)

  return !updateErr
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  ABQ UNPLUGGED — EVENT TIME AUDIT')
  if (doFix) console.log('  ⚡ --fix mode: will patch DB for high-confidence mismatches')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // ── LM Studio check ──
  let lmAvailable = false
  if (!noLLM) {
    try {
      const ping = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(3000) })
      lmAvailable = ping.ok
      console.log(lmAvailable ? '✓ LM Studio reachable\n' : '⚠ LM Studio not reachable — skipping LLM fallback\n')
    } catch {
      console.log('⚠ LM Studio not reachable — skipping LLM fallback\n')
    }
  }

  // ── Fetch events ──
  const sources = SOURCE_FILTER ? [SOURCE_FILTER] : ALL_SOURCES
  console.log(`Sources : ${sources.join(', ')}`)
  console.log(`Limit   : ${MAX_EVENTS}`)
  console.log(`Fix mode: ${doFix ? 'ON (high-confidence only)' : 'OFF (audit only)'}\n`)

  const { data: events, error } = await supabase
    .from('events')
    .select('id, source, event_date, raw, venue_name')
    .in('source', sources)
    .gte('event_date', today)
    .not('raw', 'is', null)
    .order('event_date', { ascending: true })
    .limit(MAX_EVENTS)

  if (error) { console.error('Supabase error:', error); process.exit(1) }
  console.log(`Found ${events.length} events to check\n`)

  if (isDryRun) {
    for (const e of events) {
      const t = to12h(e.raw?.dates?.start?.localTime)
      const name = e.raw?.name || e.raw?.title || ''
      console.log(`  [${e.source.padEnd(13)}] ${e.event_date}  ${(t || 'no-time').padEnd(10)}  ${name.slice(0, 55)}`)
    }
    return
  }

  // ── Audit loop ──
  const results   = []
  let ok = 0, wrong = 0, missing = 0, noTime = 0, unknown = 0
  let scrapeErrors = 0, fixedCount = 0

  for (let i = 0; i < events.length; i++) {
    const event   = events[i]
    const name    = event.raw?.name || event.raw?.title || event.venue_name || '(no name)'
    const ourRaw  = event.raw?.dates?.start?.localTime
    const ourTime = normaliseTime(ourRaw)

    // Determine if we need a delay before this request
    const isInstant = event.source === 'seatgeek' && !!parseSeatGeekUrlTime(event.raw?.url)
    const isTmApi   = event.source === 'ticketmaster'  // TM API has its own rate limit handling
    if (!isInstant) await delay(isTmApi ? 300 : FETCH_DELAY_MS)

    process.stdout.write(
      `[${String(i + 1).padStart(3)}/${events.length}] ${event.source.padEnd(13)} ${event.event_date}  `
    )

    const { sourceTime, method } = await getSourceTime(event, lmAvailable)
    if (method.startsWith('fetch-error')) scrapeErrors++

    // Midnight (12:00 AM / 00:00) from source usually means "all-day / no time set"
    // — WordPress, Eventbrite, and abqtodo all use T00:00:00 as the default when no
    //   time has been entered. Treat it the same as no source time.
    const sourceMidnight = sourceTime === '12:00 AM'
    const effectiveSourceTime = sourceMidnight ? null : sourceTime

    // Determine status
    let status
    if (!ourRaw && !effectiveSourceTime)       { status = 'NO-TIME'; noTime++ }
    else if (!ourRaw && effectiveSourceTime)   { status = 'MISSING'; missing++ }
    else if (!effectiveSourceTime)             { status = 'UNKNOWN'; unknown++ }
    else if (ourTime === effectiveSourceTime)  { status = 'OK';      ok++ }
    else                                       { status = 'WRONG';   wrong++ }

    // Auto-fix WRONG and MISSING (high-confidence only, not in dry-run, never midnight)
    let fixed = false
    if (doFix && effectiveSourceTime && HIGH_CONFIDENCE.has(method) &&
        (status === 'WRONG' || status === 'MISSING')) {
      fixed = await applyFix(event.id, effectiveSourceTime)
      if (fixed) fixedCount++
    }

    const icon = status === 'OK' ? '✓'
               : status === 'WRONG' ? '✗'
               : status === 'MISSING' ? '!'
               : '?'
    const fixTag = fixed ? ' ✏ FIXED' : ''

    console.log(
      `${icon} ${status.padEnd(8)} our=${ourTime || ourRaw || 'none'}` +
      `  source=${effectiveSourceTime || (sourceMidnight ? '(midnight=no-time)' : '?')}  [${method}]${fixTag}  ${name.slice(0, 40)}`
    )

    results.push({
      status: fixed ? `${status}→FIXED` : status,
      source: event.source,
      event_date: event.event_date,
      our_time: ourTime || ourRaw || '',
      source_time: effectiveSourceTime || '',
      method,
      fixed: fixed ? 'yes' : '',
      name,
      venue: event.venue_name || '',
      url: event.raw?.url || '',
      event_id: event.id,
    })

    if (scrapeErrors >= MAX_SCRAPE_ERRORS) {
      console.warn(`\n⚠ ${MAX_SCRAPE_ERRORS} consecutive scrape errors — stopping early`)
      break
    }
  }

  // ── Write CSV ──
  const csvRows = skipUnknown ? results.filter(r => !r.status.startsWith('UNKNOWN')) : results
  const header  = 'status,source,event_date,our_time,source_time,method,fixed,name,venue,url,event_id'
  const lines   = csvRows.map(r =>
    [r.status, r.source, r.event_date, r.our_time, r.source_time, r.method, r.fixed,
     `"${r.name.replace(/"/g, '""')}"`,
     `"${r.venue.replace(/"/g, '""')}"`,
     r.url, r.event_id,
    ].join(',')
  )
  fs.writeFileSync(OUTPUT_CSV, [header, ...lines].join('\n'))

  // ── Summary ──
  const total = results.length
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  RESULTS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  ✓ OK       ${String(ok).padStart(4)}  (times match)`)
  console.log(`  ✗ WRONG    ${String(wrong).padStart(4)}  (times differ — source has different time)`)
  console.log(`  ! MISSING  ${String(missing).padStart(4)}  (we stored no time, source has one)`)
  console.log(`  - NO-TIME  ${String(noTime).padStart(4)}  (neither side has a time)`)
  console.log(`  ? UNKNOWN  ${String(unknown).padStart(4)}  (couldn't read source page)`)
  console.log(`  ─ Total    ${String(total).padStart(4)}`)
  if (doFix) {
    console.log(`\n  ✏ Fixed    ${String(fixedCount).padStart(4)}  (DB patched)`)
  }
  console.log()

  const actionable = results.filter(r => r.status === 'WRONG' || r.status === 'MISSING')
  if (actionable.length) {
    const unfixed = actionable.filter(r => !r.fixed)
    if (unfixed.length) {
      console.log('  ⚠ STILL NEEDS ATTENTION:')
      for (const r of unfixed) {
        console.log(`    [${r.source}] ${r.event_date}  our=${r.our_time || 'none'} → source=${r.source_time}  [${r.method}]`)
        console.log(`    ${r.name}`)
        if (r.url) console.log(`    ${r.url}`)
        console.log()
      }
    }
    if (doFix && fixedCount > 0) {
      console.log(`  ✅ ${fixedCount} event(s) patched automatically.`)
    }
  } else {
    console.log('  🎉 No time mismatches found!')
  }

  console.log(`\n  CSV: ${OUTPUT_CSV}\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
