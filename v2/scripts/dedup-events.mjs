/**
 * Cross-source event deduplication.
 *
 * Finds duplicate events (same event ingested from multiple sources or twice
 * from the same source) and hides the losers while preserving all ticket links
 * on the winner.
 *
 * Two distinct dup classes found in the DB:
 *   1. SAME-SOURCE (majority): SeatGeek ingests both "seatgeek_12345" and
 *      "seatgeek_sg-12345" for the same numeric ID — pure ingest bug.
 *   2. CROSS-SOURCE (31 groups): same show on Ticketmaster + SeatGeek.
 *
 * Dedup key: normalize(title, 35 chars) + event_date + venue
 *   - strip non-alphanumeric, lowercase, take first 35 chars
 *   - "Buckethead" → "buckethead", "A at B"/"B vs A" both share 35-char prefix
 *   - Venue is required in pass 1 so unrelated same-name events at different
 *     businesses are never merged. Pass 2 handles conservative cross-source
 *     title variants at the same venue/date.
 *
 * Source priority (winner selection): ticketmaster > seatgeek > eventbrite >
 *   local > nhcc — ticketmaster rows tend to have the best photo
 *   and venue_name data. Within the same source, prefer the non-"sg-" ID
 *   (the plain numeric one has a venue_name populated).
 *
 * Safety:
 *   - NEVER deletes. Sets hidden=true + ai_enrichment.dedup_reason on losers.
 *   - Skips events that are already hidden.
 *   - --dry-run prints what would happen without touching the DB.
 *   - All ticket URLs from losers are appended to winner's raw.ticket_links.
 *
 * Usage:
 *   node scripts/dedup-events.mjs --dry-run
 *   node scripts/dedup-events.mjs
 *   node scripts/dedup-events.mjs --limit=50   # cap groups processed
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in scripts/.env
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Load .env (same pattern as enrich-moods-lm.mjs) ──────────────────────────
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', 'scripts', '.env'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
    console.log('Loaded env from:', envFile)
    break
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const MAX_GROUPS = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const today = new Date().toISOString().slice(0, 10)

// Source priority — higher index = higher priority (winner)
// Ticketmaster is preferred over SeatGeek for the primary record because it
// generally has the strongest organizer imagery; alternate URLs are merged.
const SOURCE_PRIORITY = ['nhcc', 'local', 'eventbrite', 'seatgeek', 'ticketmaster']
function sourcePriority(source) {
  const idx = SOURCE_PRIORITY.indexOf(source)
  return idx === -1 ? 0 : idx
}

// Sports venues where there is only ONE event per date — any TM+SG pair here
// is definitely the same event (home/away team order in title doesn't matter).
const SPORTS_VENUES = new Set([
  'Rio Grande Credit Union Field at Isotopes Park',
])

// Detect Ticketmaster "PSS VIP Parking" / add-on listings — these are never
// real events; they're parking passes sold alongside the main ticket.
function isTMAddOn(row) {
  if (row.source !== 'ticketmaster') return false
  const name = ((row.raw || {}).name || '').toLowerCase()
  return name.includes('pss vip parking') || name.includes('vip parking') || name.includes('photo in the lobby')
}

// Normalize a title for fuzzy first-word comparison.
// Strips punctuation and returns the first word in lowercase.
function firstWordNorm(title) {
  if (!title) return ''
  const stripped = title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim()
  return stripped.split(/\s+/)[0] || ''
}

// ─── Title normalizer ──────────────────────────────────────────────────────────
// Strip non-alphanumeric, lowercase, take first 35 chars.
// This is intentionally simple — false positives are caught by date match;
// false negatives (missed dups) are acceptable vs. wrongly merging different events.
function normalizeTitle(raw) {
  if (!raw) return ''
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 35)
}

// ─── Extract the event title from a DB row ────────────────────────────────────
function getTitle(row) {
  const raw = row.raw || {}
  const nameField = raw.name || raw.title || ''
  const title = typeof nameField === 'object' ? (nameField?.text || '') : nameField
  return String(title).trim()
}

function getLocalTime5(row) {
  const raw = row.raw || {}
  const value = raw?.dates?.start?.localTime
    ?? raw?.start?.local
    ?? raw?.datetime_local
    ?? raw?.time
    ?? ''
  const match = String(value).match(/(?:T|\b)(\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`
}

// ─── Extract all ticket/purchase URLs from a row ─────────────────────────────
// Ticket links are stored variously across sources. We pull every URL we can find.
function extractTicketUrls(row) {
  const raw = row.raw || {}
  const urls = new Set()

  // Explicit ticket_links array (if we've already merged some)
  if (Array.isArray(raw.ticket_links)) {
    raw.ticket_links.forEach(u => u && urls.add(u))
  }

  // SeatGeek: raw.url is the ticket page
  if (raw.url && typeof raw.url === 'string') urls.add(raw.url)

  // Ticketmaster: raw.url is the event page; raw._embedded.priceRanges not a URL
  // TM ticket purchase is usually via raw.url too
  if (raw.ticketUrl && typeof raw.ticketUrl === 'string') urls.add(raw.ticketUrl)

  // Eventbrite: raw.url
  // NHCC/local: raw.url

  // Remove empty/null
  return [...urls].filter(Boolean)
}

async function fetchUpcomingVisible() {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .schema('public')
      .from('events')
      .select('id, source, event_date, venue_name, raw, ai_enrichment, cached_photo_url')
      .eq('hidden', false)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return { data: rows, error: null }
}

// ─── Pick winner from a group of duplicate rows ───────────────────────────────
// Rules: highest source priority wins. Within same source, prefer non-sg- ID
// (those tend to have venue_name populated). Tiebreak: whichever has a photo.
function pickWinner(rows) {
  return rows.slice().sort((a, b) => {
    const sPriority = sourcePriority(b.source) - sourcePriority(a.source)
    if (sPriority !== 0) return sPriority

    // Prefer non-"sg-" IDs within seatgeek (those have venue_name)
    const aIsSg = a.id.includes('_sg-') ? 1 : 0
    const bIsSg = b.id.includes('_sg-') ? 1 : 0
    if (aIsSg !== bIsSg) return aIsSg - bIsSg

    // Prefer rows with a cached photo
    const aPhoto = a.cached_photo_url ? 1 : 0
    const bPhoto = b.cached_photo_url ? 1 : 0
    return bPhoto - aPhoto
  })[0]
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nEvent Deduplication — ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`)
  console.log(`Today: ${today}\n`)

  // Fetch all upcoming visible events (we only dedup future events to be safe)
  console.log('Fetching upcoming visible events...')
  const { data: rows, error } = await fetchUpcomingVisible()

  if (error) {
    console.error('Fetch error:', error.message)
    process.exit(1)
  }

  console.log(`Fetched ${rows.length} upcoming visible events\n`)

  // ─── Group by dedup key ──────────────────────────────────────────────────────
  const groups = new Map() // key → [rows]

  for (const row of rows) {
    const title = getTitle(row)
    const venue = String(row.venue_name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const time = getLocalTime5(row)
    if (!title || !venue || !time) continue

    const key = `${normalizeTitle(title)}::${String(row.event_date).slice(0, 10)}::${time}::${venue}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  // Keep only groups with more than one row
  const dupGroups = [...groups.values()].filter(g => g.length > 1)

  console.log(`Found ${dupGroups.length} duplicate groups among ${rows.length} events`)
  if (dupGroups.length === 0) {
    console.log('Nothing to deduplicate.')
    return
  }

  // ─── Process each group ──────────────────────────────────────────────────────
  let groupsProcessed = 0
  let totalHidden = 0
  let totalTicketsMerged = 0
  let totalErrors = 0

  const capped = dupGroups.slice(0, MAX_GROUPS)
  if (MAX_GROUPS < dupGroups.length) {
    console.log(`(capped to first ${MAX_GROUPS} groups via --limit)\n`)
  }

  for (const group of capped) {
    const winner = pickWinner(group)
    const losers = group.filter(r => r.id !== winner.id)
    const winnerTitle = getTitle(winner)

    // Collect all unique ticket URLs from losers that aren't already on the winner
    const winnerUrls = new Set(extractTicketUrls(winner))
    const newUrls = []
    for (const loser of losers) {
      for (const url of extractTicketUrls(loser)) {
        if (!winnerUrls.has(url)) {
          winnerUrls.add(url)
          newUrls.push(url)
        }
      }
    }

    const crossSource = new Set(group.map(r => r.source)).size > 1

    if (isDryRun) {
      console.log(`[DRY] GROUP: "${winnerTitle.slice(0, 50)}" on ${winner.event_date}`)
      console.log(`       Winner: ${winner.id} (${winner.source})`)
      for (const l of losers) {
        console.log(`       Hide:   ${l.id} (${l.source})`)
      }
      if (newUrls.length > 0) {
        console.log(`       Merge ${newUrls.length} ticket URL(s) → winner`)
      }
      console.log(`       Type: ${crossSource ? 'CROSS-SOURCE' : 'SAME-SOURCE'}`)
      console.log('')
      groupsProcessed++
      totalHidden += losers.length
      totalTicketsMerged += newUrls.length
      continue
    }

    // ── Live: update winner with merged ticket_links ───────────────────────────
    if (newUrls.length > 0) {
      const existingLinks = Array.isArray(winner.raw?.ticket_links)
        ? winner.raw.ticket_links
        : []
      const mergedLinks = [...new Set([...existingLinks, ...newUrls])]
      const updatedRaw = { ...(winner.raw || {}), ticket_links: mergedLinks }

      const { error: winnerErr } = await supabase
        .schema('public')
        .from('events')
        .update({ raw: updatedRaw })
        .eq('id', winner.id)

      if (winnerErr) {
        console.error(`  ERROR updating winner ${winner.id}: ${winnerErr.message}`)
        totalErrors++
      } else {
        totalTicketsMerged += newUrls.length
      }
    }

    // ── Live: hide each loser ─────────────────────────────────────────────────
    for (const loser of losers) {
      const loserTitle = getTitle(loser)
      const existingEnrichment = loser.ai_enrichment || {}
      const updatedEnrichment = {
        ...existingEnrichment,
        dedup_reason: `Duplicate of ${winner.id} (${winner.source}). ` +
          `Same event detected: title="${loserTitle.slice(0, 40)}", date=${loser.event_date}. ` +
          `Hidden by dedup-events.mjs on ${new Date().toISOString().slice(0, 10)}.`,
        dedup_primary_id: winner.id,
        dedup_hidden_at: new Date().toISOString(),
      }

      const { error: loserErr } = await supabase
        .schema('public')
        .from('events')
        .update({ hidden: true, ai_enrichment: updatedEnrichment })
        .eq('id', loser.id)

      if (loserErr) {
        console.error(`  ERROR hiding loser ${loser.id}: ${loserErr.message}`)
        totalErrors++
      } else {
        console.log(`  Hidden: ${loser.id} (${loser.source}) → winner: ${winner.id} | "${winnerTitle.slice(0, 40)}"`)
        totalHidden++
      }
    }

    groupsProcessed++
  }

  // ─── Pass 2: Venue+Date cross-source dedup ────────────────────────────────────
  // Catches events where titles differ between sources (sports games home/away
  // order, concert "Artist Tour Name" vs "Artist with Opener", etc.).
  // Safety boundary: ordinary events must share an explicit start time. This
  // prevents multiple same-day Broadway/comedy performances from collapsing.

  console.log('\n─── Pass 2: Venue+Date cross-source dedup ─────────────')

  // Re-fetch to pick up any changes from Pass 1
  const { data: rows2, error: err2 } = await fetchUpcomingVisible()

  if (err2) {
    console.error('Pass 2 fetch error:', err2.message)
  } else {
    // Group by venue_name + event_date (date only, not time)
    const byVenueDate = new Map()
    for (const row of rows2) {
      if (!row.venue_name) continue
      const dateOnly = String(row.event_date).slice(0, 10)
      const key = `${row.venue_name}::${dateOnly}`
      if (!byVenueDate.has(key)) byVenueDate.set(key, [])
      byVenueDate.get(key).push(row)
    }

    // Keep only groups with both TM and SG present
    const venueGroups = [...byVenueDate.values()].filter(g => {
      const sources = new Set(g.map(r => r.source))
      return sources.has('ticketmaster') && sources.has('seatgeek')
    }).slice(0, MAX_GROUPS)

    let pass2Hidden = 0
    const pass2HiddenIds = new Set()
    for (const group of venueGroups) {
      const tmRows = group.filter(r => r.source === 'ticketmaster')
      const sgRows = group.filter(r => r.source === 'seatgeek')

      for (const tm of tmRows) {
        if (tm.hidden || pass2HiddenIds.has(tm.id)) continue
        const tmTitle = getTitle(tm)
        const venueName = tm.venue_name
        const tmTime = getLocalTime5(tm)

        const isAddOn = isTMAddOn(tm)
        const isSports = SPORTS_VENUES.has(venueName)
        const matches = sgRows.filter(sg => {
          if (pass2HiddenIds.has(sg.id)) return false
          const sgTime = getLocalTime5(sg)
          if (!tmTime || !sgTime || tmTime !== sgTime) return false
          if (isSports) return true
          const sgTitle = getTitle(sg)
          const tmFirst = firstWordNorm(tmTitle)
          const sgFirst = firstWordNorm(sgTitle)
          if (tmFirst.length >= 4 && tmFirst === sgFirst) return true
          const tmNorm5 = tmTitle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
          const sgNorm5 = sgTitle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
          if (tmNorm5.length >= 5 && tmNorm5 === sgNorm5) return true
          if (sgTitle.length >= 5 && tmTitle.toLowerCase().includes(sgTitle.toLowerCase())) return true
          return false
        })

        const candidates = isAddOn ? [tm] : [tm, ...matches]
        if (!isAddOn && matches.length === 0) continue
        const winner = isAddOn ? null : pickWinner(candidates)
        const losers = isAddOn ? [tm] : candidates.filter(row => row.id !== winner.id)
        const reason = isAddOn
          ? 'TM add-on/parking pass'
          : isSports
            ? `Sports venue+time dedup (${venueName})`
            : 'Concert venue+date+time title match'

        for (const loser of losers) {
          if (pass2HiddenIds.has(loser.id)) continue
          if (isDryRun) {
            console.log(`[DRY P2] Hide ${loser.id}: "${getTitle(loser).slice(0, 50)}" (${reason})`)
            pass2HiddenIds.add(loser.id)
            pass2Hidden++
            continue
          }
          const enrichment = {
            ...(loser.ai_enrichment || {}),
            dedup_reason: `${reason}. Hidden by dedup-events.mjs pass 2 on ${today}.`,
            dedup_primary_id: winner?.id ?? null,
            dedup_hidden_at: new Date().toISOString(),
          }
          const { error: hideErr } = await supabase.schema('public').from('events')
            .update({ hidden: true, ai_enrichment: enrichment })
            .eq('id', loser.id)
          if (hideErr) {
            console.error(`  ERROR hiding ${loser.id}: ${hideErr.message}`)
            totalErrors++
          } else {
            console.log(`  P2 hidden: ${loser.id} (${reason}): "${getTitle(loser).slice(0, 45)}"`)
            pass2HiddenIds.add(loser.id)
            pass2Hidden++
            totalHidden++
          }
        }
      }
    }
    console.log(`Pass 2 hidden: ${pass2Hidden}`)
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n─── Summary ───────────────────────────────────────────')
  if (isDryRun) console.log('(DRY RUN — no changes made)')
  console.log(`Groups found:        ${dupGroups.length}`)
  console.log(`Groups processed:    ${groupsProcessed}`)
  console.log(`Rows hidden:         ${totalHidden}`)
  console.log(`Ticket URLs merged:  ${totalTicketsMerged}`)
  if (totalErrors > 0) console.log(`Errors:              ${totalErrors}`)
  console.log('\nDone.')
  console.log('To reverse: UPDATE public.events SET hidden=false WHERE ai_enrichment->>\'dedup_reason\' IS NOT NULL;')
}

main().catch(console.error)
