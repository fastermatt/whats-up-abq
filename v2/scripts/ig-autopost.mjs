#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { renderIG } from './ig-render.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DENVER_TZ = 'America/Denver'
const DEFAULT_BASE_URL = 'http://localhost:3000'
const DEFAULT_FIXTURE = path.join(__dirname, 'fixtures', 'ig-events-week.json')
const TAG_HANDLES_PATH = path.join(__dirname, 'ig-tag-handles.json')
const OUT_DIR = '/tmp/ig-autopost'

// Morning shift (9 AM MT): digest/roundup discovery posts for the week or weekend.
// All run as Reels for algorithm-boosted reach to non-followers.
const MORNING_ROTATION = {
  0: { id: 'weekly-summary',  kind: 'digest', period: 'this-week',    time: '09:00', reel: true },
  1: { id: 'weekly-summary',  kind: 'digest', period: 'this-week',    time: '09:00', reel: true },
  2: { id: 'top-three',       kind: 'digest', period: 'next-10',      time: '09:00', reel: true },
  3: { id: 'top-three',       kind: 'digest', period: 'next-10',      time: '09:00', reel: true },
  4: { id: 'weekend-digest',  kind: 'digest', period: 'this-weekend', time: '09:00', reel: true },
  5: { id: 'top-three',       kind: 'digest', period: 'this-weekend', time: '09:00', reel: true },
  6: { id: 'weekend-digest',  kind: 'digest', period: 'this-weekend', time: '09:00', reel: true },
}

// Evening shift (7:30 PM MT): mix of single-event spotlights and multi-event
// roundups. Data shows roundup format (247-263 reach) vs single-event (11-12
// reach) — 20x gap. Mon/Thu/Sat are roundup nights to match morning cadence.
const EVENING_ROTATION = {
  0: { id: 'terra',          kind: 'single', period: 'today-or-next', time: '19:30', cats: ['Arts & Theater', 'Music', 'Comedy'],  reel: true },  // Sun
  1: { id: 'top-three',      kind: 'digest', period: 'next-10',       time: '19:30',                                               reel: true },  // Mon — roundup
  2: { id: 'golden-hour',    kind: 'single', period: 'today-or-next', time: '19:30', cats: ['Comedy', 'Arts & Theater', 'Music'],  reel: true },  // Tue
  3: { id: 'split',          kind: 'single', period: 'today-or-next', time: '19:30', cats: ['Arts & Theater', 'Music'],            reel: true },  // Wed
  4: { id: 'weekend-digest', kind: 'digest', period: 'this-weekend',  time: '19:30',                                               reel: true },  // Thu — weekend preview
  5: { id: 'poster',         kind: 'single', period: 'today-or-next', time: '19:30', cats: ['Music', 'Festivals'],                 reel: true },  // Fri
  6: { id: 'top-three',      kind: 'digest', period: 'this-weekend',  time: '19:30',                                               reel: true },  // Sat — weekend picks
}

const SLOT_BY_ID = Object.fromEntries(
  [...Object.values(MORNING_ROTATION), ...Object.values(EVENING_ROTATION)]
    .map(slot => [slot.id, slot])
)

const SYSTEM_PROMPT = `You are a caption writer for ABQ Unplugged (@abqunplugged), Albuquerque's community events guide. You write the way a local who genuinely loves this city would write: warm, excited, helpful, never pushy.

ABQ Unplugged exists because we love Albuquerque and want it to flourish: the people, the businesses, the artists, coffee shops, libraries, kids, parks, community. Every caption should feel like a neighbor sharing something they think you'd enjoy, not a brand trying to sell something.

BRAND VOICE:
- Warm, celebratory, community-first
- Invites, never commands or pressures
- Celebrates the city and its venues, artists, and events
- Never uses FOMO ("don't miss," "last chance," "selling fast," "everyone will be there")
- Never talks down or implies judgment ("worth showing up for," "actually good")
- Never trash-talks or compares to other platforms
- No urgency language, no hype, no commands ("Get out there," "Go now", "Go", "Don't miss")
- Proper capitalization and grammar throughout
- Albuquerque references when natural: ABQ, Burque, the 505, Duke City, Nob Hill, Old Town, etc.

CAPTION STRUCTURE:
1. Warm opener line.
2. Concrete event detail from About or Highlights.
3. A why-go or local line from Local recommendation, Venue tips, or Nearby dining.
4. Practical info line using provided date, time, and venue.
5. Soft CTA: "Full details + more at abqunplugged.com" or "Full details + more at the link in bio".
6. Final line with 4 to 6 tasteful, relevant hashtags mixing ABQ/local, category, and event-specific tags. Never more than 6.

For a DIGEST (multiple events), the IMAGE already lists every event with its day, time, and venue. Keep the caption SHORT: one warm hook line, one line of context, the CTA, then the hashtags. Do NOT re-list or describe the individual events. Aim for under 60 words before the hashtags.

For a REEL post (marked as such in the prompt), the first line must be a concise scroll-stopping hook — one short sentence that names what's happening and makes someone pause. Same-day wording like "tonight" or "this evening" is allowed only when the prompt explicitly says so. Close with one light engagement invite on the final line: "Which would you go to? 👇" or "Drop your pick below 👇" — keep it casual, never forced.

RULES:
- Never make up details not in the event data
- Use ONLY the provided fields. Never invent facts, reviews, venue details, artist details, crowd claims, dining, prices, or recommendations.
- Never use: "unforgettable," "epic," "hidden gem," "vibrant," "nestled," "don't miss," "you have to," "a night you won't forget," "fun for the whole family," "this is your sign"
- No FOMO, pressure, urgency, or commands.
- No em dashes. Use commas, periods, or line breaks.
- For any date, use the provided "Date" text EXACTLY as written. Never compute, infer, or state a day of the week that differs from the provided Date.
- No time-relative wording like "tonight," "this weekend," or "this week" unless the prompt explicitly says same-day wording is allowed.
- Never open with or state a relative day ("Thursday's here," "the weekend is here," "Friday brings"). Reference events only by the provided Date.
- Use at most ONE prestige adjective in the whole caption (legendary, iconic, timeless, acclaimed, world-renowned, beloved). Stacking them reads like AI.
- No soft commands either: avoid "make a night of it," "plan a...," "get ready," "arrive early," "don't forget," "grab a," "be sure to."
- Invent nothing about the crowd or experience ("you might get pulled on stage," "best sightlines") unless it is in the provided fields.
- The link in bio points to abqunplugged.com. Frame CTAs as "find more details" / "link in bio" not "get your tickets"
- Never name a ticket vendor or platform (Ticketmaster, SeatGeek, Eventbrite, etc.) and never add a "tickets available through X" line. It is not in the provided fields. Point people to abqunplugged.com for details and tickets.
- Use "Full details + more at abqunplugged.com" or "Full details + more at the link in bio" for CTA lines
- Keep it scannable with line breaks.

OUTPUT FORMAT:
Return a JSON object with one key, "caption", containing the finished caption text with actual line breaks.
Return only the JSON object. No markdown, no code fences, no explanation.`

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) args[key] = true
    else {
      args[key] = next
      i += 1
    }
  }
  return args
}

async function loadEnv() {
  for (const file of [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env'),
  ]) {
    try {
      const text = await readFile(file, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
        if (!m || process.env[m[1]] !== undefined) continue
        process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
      }
    } catch {}
  }
}

function denverDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)
  const get = type => parts.find(p => p.type === type)?.value
  const iso = `${get('year')}-${get('month')}-${get('day')}`
  return { iso, weekday: get('weekday') }
}

function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

function addDays(iso, days) {
  const d = parseISODate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function weekdayIndex(iso) {
  return parseISODate(iso).getUTCDay()
}

// Correct, timezone-safe human date ("Friday, June 19, 2026"). parseISODate
// builds the date at UTC noon, so formatting in UTC yields the right calendar
// day + weekday. The caption model must use this verbatim (it guessed wrong
// weekdays when given the raw ISO date).
function humanDate(iso) {
  if (!iso) return null
  return parseISODate(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function dateRangeFor(period, date, events = []) {
  if (period === 'this-week') return { start: date, end: addDays(date, 6) }
  if (period === 'next-10') return { start: date, end: addDays(date, 10) }
  if (period === 'this-weekend') {
    const daysToSat = (6 - weekdayIndex(date) + 7) % 7
    const sat = addDays(date, daysToSat)
    return { start: sat, end: addDays(sat, 1) }
  }
  if (period === 'today-or-next') {
    const todayEvents = events.filter(e => e.date === date)
    if (todayEvents.length > 0) return { start: date, end: date }
    return { start: addDays(date, 1), end: addDays(date, 7) }
  }
  return { start: date, end: date }
}

function mdtIso(date, hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const utcGuess = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`)
  const denverHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: DENVER_TZ, hour: '2-digit', hour12: false }).format(utcGuess))
  let offsetHours = h - denverHour
  if (offsetHours < -12) offsetHours += 24
  if (offsetHours > 12) offsetHours -= 24
  return new Date(Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    h + offsetHours,
    m,
    0,
    0,
  )).toISOString()
}

function formatTime(time) {
  if (!time || typeof time !== 'string') return null
  const trimmed = time.trim()
  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(trimmed)) {
    return trimmed.replace(/\s+/g, ' ').toUpperCase()
  }
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [h, m] = trimmed.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
  }
  return trimmed
}

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cleanHighlights(value) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, 2) : []
}

function cleanNearbyDining(value) {
  return Array.isArray(value)
    ? value.map(item => {
      if (!item || typeof item !== 'object') return null
      const name = cleanString(item.name)
      const note = cleanString(item.note)
      return name ? (note ? `${name}: ${note}` : name) : null
    }).filter(Boolean).slice(0, 2)
    : []
}

function eventFromFixture(event) {
  return {
    id: String(event.id),
    title: cleanString(event.title) ?? '',
    date: String(event.date).slice(0, 10),
    localTime: event.localTime ?? null,
    time: formatTime(event.localTime ?? event.time),
    venue: cleanString(event.venue),
    category: cleanString(event.category),
    imageUrl: cleanString(event.imageUrl),
    popularityScore: Number(event.popularityScore ?? 0),
    featured: event.featured === true,
    about: cleanString(event.about),
    highlights: cleanHighlights(event.highlights),
    venueTips: cleanString(event.venueTips),
    localRec: cleanString(event.localRec),
    nearbyDining: cleanNearbyDining(event.nearbyDining),
  }
}

function eventFromRow(row) {
  const raw = row.raw ?? {}
  const ai = row.ai_enrichment ?? {}
  const title = cleanString(raw.name) ?? cleanString(raw.title) ?? cleanString(row.venue_name) ?? ''
  const rawTime = raw?.dates?.start?.localTime ?? raw.time ?? null
  return {
    id: String(row.id),
    title,
    date: String(row.event_date).slice(0, 10),
    localTime: rawTime,
    time: formatTime(rawTime),
    venue: cleanString(row.venue_name),
    category: cleanString(row.category),
    imageUrl: cleanString(row.cached_photo_url),
    popularityScore: Number(row.popularity_score ?? heuristicScore(row)),
    featured: row.featured === true,
    about: cleanString(ai.about),
    highlights: cleanHighlights(ai.highlights),
    venueTips: cleanString(ai.venue_tips),
    localRec: cleanString(ai.local_rec),
    nearbyDining: cleanNearbyDining(ai.nearby_dining),
  }
}

function heuristicScore(row) {
  const catScore = {
    Festivals: 7.5,
    Music: 7.0,
    'Arts & Theater': 6.5,
    Comedy: 6.5,
    'Food & Drink': 6.0,
    Outdoor: 5.5,
    Sports: 5.5,
    Family: 5.0,
    Film: 4.5,
  }
  let score = catScore[String(row.category ?? '')] ?? 4
  const dow = weekdayIndex(String(row.event_date).slice(0, 10))
  if (dow === 5 || dow === 6) score += 1.5
  else if (dow === 4) score += 0.8
  else if (dow === 0) score += 0.5
  if (row.cached_photo_url) score += 0.3
  if (row.featured === true) score += 1.5
  return Math.min(10, Math.max(1, score))
}

function venueKey(venue) {
  return (venue ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
}

function titleKey(title) {
  return (title ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).join(' ')
}

function artistCore(title) {
  return (title ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 5).join(' ')
}

function dedupeEvents(events) {
  const first = new Map()
  for (const event of events) {
    const key = `${event.date}|${venueKey(event.venue)}|${titleKey(event.title)}`
    const existing = first.get(key)
    if (!existing || event.popularityScore > existing.popularityScore) first.set(key, event)
  }

  const second = new Map()
  for (const event of first.values()) {
    const date = event.date
    const vkey = venueKey(event.venue)
    const core = artistCore(event.title)
    let merged = false
    for (const [key, existing] of second) {
      const [d2, v2] = key.split('|')
      if (d2 !== date || v2 !== vkey) continue
      const core2 = artistCore(existing.title)
      if (core && core2 && (core.includes(core2) || core2.includes(core))) {
        if (event.popularityScore > existing.popularityScore) second.set(key, event)
        merged = true
        break
      }
    }
    if (!merged) second.set(`${date}|${vkey}|${core}`, event)
  }
  return [...second.values()]
}

function hasRealPhoto(event) {
  const url = event.imageUrl ?? ''
  if (!url) return false
  return !/Horizontal-Rule|rocket_cropped/i.test(url)
}

function isIsotopesGame(event) {
  const text = `${event.title} ${event.venue} ${event.category}`.toLowerCase()
  return text.includes('isotopes') || text.includes('space cowboys at albuquerque') || (text.includes(' vs ') && text.includes('baseball'))
}

function filterIsotopesSpam(events) {
  let kept = false
  return events.filter(event => {
    if (!isIsotopesGame(event)) return true
    if (kept) return false
    kept = true
    return true
  })
}

// Quality gate: ABQ Unplugged features in-person events, so an event with no
// real venue (or an online/virtual/webinar "venue") is never auto-posted. This
// excludes the low-quality no-venue Eventbrite listings that otherwise slip into
// thin weeks (e.g. garbled webinar titles).
function passesQualityGate(event) {
  const venue = (event.venue ?? '').trim()
  if (!venue) return false
  if (/\b(online|virtual|webinar|zoom|livestream|live\s?stream|twitch)\b/i.test(venue)) return false
  return true
}

function selectDiverse(events, count) {
  const selected = []
  const seenCat = new Set()
  for (const event of events) {
    if (selected.length >= count) break
    const cat = event.category ?? '__none__'
    if (!seenCat.has(cat)) {
      seenCat.add(cat)
      selected.push(event)
    }
  }
  const selectedIds = new Set(selected.map(e => e.id))
  for (const event of events) {
    if (selected.length >= count) break
    if (!selectedIds.has(event.id)) {
      selected.push(event)
      selectedIds.add(event.id)
    }
  }
  return selected
}

function eventInRange(event, range) {
  return event.date >= range.start && event.date <= range.end
}

function selectEvents(slot, allEvents, date, recentlyPostedIds) {
  const initialRange = dateRangeFor(slot.period, date, allEvents)
  const range = slot.period === 'today-or-next' ? dateRangeFor(slot.period, date, allEvents.filter(e => !recentlyPostedIds.has(e.id))) : initialRange
  const pool = dedupeEvents(allEvents)
    .filter(passesQualityGate)
    .filter(event => eventInRange(event, range))
    .filter(event => !recentlyPostedIds.has(event.id))
    .sort((a, b) => b.popularityScore - a.popularityScore)

  if (slot.kind === 'single') {
    const candidates = pool.filter(hasRealPhoto)
    const preferred = candidates.filter(event => slot.cats?.includes(event.category ?? ''))
    return [(preferred[0] ?? candidates[0])].filter(Boolean)
  }

  if (slot.id === 'top-three') {
    return filterIsotopesSpam(pool.filter(hasRealPhoto)).slice(0, 3)
  }

  return selectDiverse(filterIsotopesSpam(pool), slot.id === 'weekly-summary' ? 6 : 5)
}

function buildContext(slot, events, date) {
  if (slot.kind === 'single') {
    const event = events[0]
    return {
      title: event.title,
      date: event.date,
      time: event.time ?? undefined,
      venue: event.venue ?? undefined,
      category: event.category ?? undefined,
      imageUrl: event.imageUrl ?? undefined,
      tagline: event.about ?? `${event.category ?? 'Event'} in Albuquerque`,
      cta: 'abqunplugged.com',
    }
  }

  return {
    postDate: date,
    cta: 'abqunplugged.com',
    events: events.map(event => ({
      title: event.title,
      date: event.date,
      time: event.time ?? undefined,
      venue: event.venue ?? undefined,
      category: event.category ?? undefined,
      imageUrl: event.imageUrl ?? undefined,
    })),
  }
}

function renderCaptionContext(events, kind, date) {
  if (kind === 'single') {
    const event = events[0]
    return [
      `Title: ${event.title}`,
      event.category && `Category: ${event.category}`,
      event.date && `Date: ${humanDate(event.date)}`,
      event.time && `Time: ${event.time}`,
      event.venue && `Venue: ${event.venue}`,
      'Site URL: https://abqunplugged.com',
      event.about && `About: ${event.about}`,
      event.highlights.length > 0 && `Highlights: ${event.highlights.join(' | ')}`,
      event.venueTips && `Venue tips: ${event.venueTips}`,
      event.localRec && `Local recommendation: ${event.localRec}`,
      event.nearbyDining.length > 0 && `Nearby dining: ${event.nearbyDining.join(' | ')}`,
    ].filter(Boolean).join('\n')
  }

  return [
    `Digest date: ${humanDate(date)}`,
    'Events:',
    ...events.map((event, i) => [
      `${i + 1}. ${event.title}`,
      event.category && `   Category: ${event.category}`,
      event.date && `   Date: ${humanDate(event.date)}`,
      event.time && `   Time: ${event.time}`,
      event.venue && `   Venue: ${event.venue}`,
      event.about && `   About: ${event.about}`,
      event.highlights.length > 0 && `   Highlights: ${event.highlights.join(' | ')}`,
      event.venueTips && `   Venue tips: ${event.venueTips}`,
      event.localRec && `   Local recommendation: ${event.localRec}`,
    ].filter(Boolean).join('\n')),
    'Site URL: https://abqunplugged.com',
  ].join('\n')
}

// Hard cap + dedupe hashtags (the model sometimes emits 10-15). Strips all
// hashtags then re-appends the first `max` unique ones as a clean final line.
function capHashtags(caption, max = 6) {
  const tags = caption.match(/#[A-Za-z0-9_]+/g) || []
  if (tags.length <= max) return caption
  const kept = []
  const seen = new Set()
  for (const t of tags) {
    const k = t.toLowerCase()
    if (!seen.has(k)) { seen.add(k); kept.push(t) }
    if (kept.length >= max) break
  }
  const body = caption
    .replace(/#[A-Za-z0-9_]+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
  return `${body}\n\n${kept.join(' ')}`
}

function stripFences(text) {
  let cleaned = text.trim()
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence) cleaned = fence[1].trim()
  return cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
}

async function generateCaption(events, slot, date, reelNote = '') {
  const dryRun = process.argv.includes('--dry-run')
  if (!process.env.DEEPSEEK_API_KEY) {
    if (!dryRun) throw new Error('DEEPSEEK_API_KEY is required')
    return fallbackCaption(events, slot)
  }

  const userPrompt = `Write one Instagram caption for this ABQ Unplugged ${slot.kind === 'single' ? 'event' : 'event digest'}${reelNote}:

${renderCaptionContext(events, slot.kind, date)}

The link in bio goes to abqunplugged.com, an events discovery site for all of Albuquerque, not a page for a specific event. Frame any CTA around discovering more events, not getting tickets directly.`

  let res
  try {
    res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      temperature: 0.8,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
    })
  } catch (error) {
    if (dryRun) return fallbackCaption(events, slot)
    throw error
  }
  if (!res.ok) throw new Error(`DeepSeek API error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek returned no caption content')

  let caption
  try {
    const parsed = JSON.parse(stripFences(content))
    caption = cleanString(parsed.caption)
  } catch {
    // DeepSeek returned malformed JSON (e.g. unescaped quote in caption) — use raw text
    caption = cleanString(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
  }
  if (!caption) throw new Error('DeepSeek caption response missing caption')
  // Replace em dashes (and stray "--") with a comma, collapsing surrounding
  // spaces so "word — that" becomes "word, that" (not "word , that").
  const cleaned = caption
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+--\s+/g, ', ')
    .replace(/ {2,}/g, ' ')
  return capHashtags(cleaned, 6)
}

function fallbackCaption(events, slot) {
  const body = slot.kind === 'single'
    ? `${events[0].title}\n${[events[0].date, events[0].time, events[0].venue].filter(Boolean).join(' · ')}`
    : events.map(event => `${event.title} · ${[event.date, event.time, event.venue].filter(Boolean).join(' · ')}`).join('\n')
  return `${body}\n\nFull details + more at abqunplugged.com\n\n#ABQ #Albuquerque #505 #Burque #ABQEvents #ThingsToDoABQ #NewMexico #DukeCity`
}

async function loadTagMap() {
  const data = JSON.parse(await readFile(TAG_HANDLES_PATH, 'utf8'))
  return {
    venues: data.venues ?? {},
    artists: data.artists ?? {},
  }
}

function mentionsFor(events, tagMap) {
  const handles = []
  for (const event of events) {
    const venueHandle = event.venue ? tagMap.venues[event.venue] : null
    if (venueHandle) handles.push(`@${venueHandle}`)
    const artistHandle = tagMap.artists[event.title]
    if (artistHandle) handles.push(`@${artistHandle}`)
  }
  return [...new Set(handles)]
}

function appendMentions(caption, mentions) {
  if (mentions.length === 0) return caption
  return `${caption.trim()}\n\n${mentions.join(' ')}`
}

function supabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function loadFixtureEvents(fixturePath) {
  const json = JSON.parse(await readFile(fixturePath, 'utf8'))
  return (json.events ?? []).map(eventFromFixture)
}

async function loadLiveEvents(supabase, range) {
  const { data, error } = await supabase
    .from('events')
    .select('id, raw, event_date, venue_name, category, cached_photo_url, popularity_score, featured, ai_enrichment')
    .eq('hidden', false)
    .gte('event_date', range.start)
    .lte('event_date', `${range.end}T23:59:59`)
    .not('cached_photo_url', 'is', null)
    .order('event_date', { ascending: true })
    .limit(500)
  if (error) throw new Error(`Event query failed: ${error.message}`)
  return (data ?? []).map(eventFromRow)
}

async function recentlyPostedIds(supabase) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('ig_post_log')
    .select('event_id')
    .gte('posted_at', since)
    .not('event_id', 'is', null)
  if (error) throw new Error(`ig_post_log query failed: ${error.message}`)
  return new Set((data ?? []).map(row => row.event_id).filter(Boolean))
}

async function uploadPng(supabase, buffer, date, slotId) {
  const digest = createHash('sha1').update(buffer).digest('hex').slice(0, 10)
  const filename = `ig-posts/autopost_${date}_${slotId}_${digest}.png`
  const { error } = await supabase.storage
    .from('event-photos')
    .upload(filename, buffer, { contentType: 'image/png', upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  return `${url}/storage/v1/object/public/event-photos/${filename}`
}

// Decorative font candidates — need a font with geometric Unicode symbols
// (◆ ★ ●) for the animated floating overlays. DejaVu is pre-installed on
// Ubuntu (GitHub Actions runners). The macOS fallback is best-effort.
const DECOR_FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',      // Ubuntu — primary
  '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',  // Ubuntu Noto
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf', // macOS
  '/Library/Fonts/Arial Unicode MS.ttf',                  // macOS alt
]

// Convert a rendered 4:5 PNG (1080×1350) into a 9:16 MP4 (1080×1920) using
// ffmpeg. Scales to fill the full frame (no letterbox bands) and applies a
// slow horizontal drift using crop + frame-number math instead of zoompan —
// zoompan has known per-frame floating-point jitter that makes text hard to
// read. Requires ffmpeg on PATH (Ubuntu runners have it; `brew install ffmpeg`).
//
// Floating vector decoratives (◆ ★ ●) are composited as a subtle animated
// layer over the top 55% of the frame using ffmpeg drawtext with sinusoidal
// position expressions. Text/event info in the bottom 45% is never touched.
async function generateReel(pngPath) {
  const mp4Path = pngPath.replace(/\.png$/, '.mp4')

  // Find a font that covers the geometric symbol block (U+25A0–U+25FF)
  const fontFile = DECOR_FONT_CANDIDATES.find(p => existsSync(p))

  // Floating decoratives — terra ◆ and teal ★ ● that drift with different
  // phases so they never move in sync. All kept above y=1050 (top 55% of
  // 1920) so the bottom event-info cluster is never obscured.
  // t = elapsed seconds in ffmpeg expression context.
  const decor = fontFile ? [
    // top-left diamond, terra, gentle figure-eight
    `drawtext=fontfile=${fontFile}:text=◆:fontsize=100:fontcolor=0x9a442d@0.13:x=100+28*sin(0.72*t):y=175+22*cos(0.55*t)`,
    // top-right star, teal, slower circular drift
    `drawtext=fontfile=${fontFile}:text=★:fontsize=82:fontcolor=0x006a62@0.13:x=820+32*cos(0.80*t+1.05):y=340+28*sin(0.62*t+0.52)`,
    // center-upper small diamond, teal
    `drawtext=fontfile=${fontFile}:text=◆:fontsize=66:fontcolor=0x006a62@0.10:x=510+22*cos(0.52*t+2.09):y=560+18*sin(0.74*t+1.00)`,
    // left-middle circle, terra, slowest drift
    `drawtext=fontfile=${fontFile}:text=●:fontsize=54:fontcolor=0x9a442d@0.08:x=155+18*sin(0.61*t+3.49):y=760+22*cos(0.42*t+1.96)`,
  ] : []

  const vf = [
    // Fill 9:16 from 4:5 source: scale to height (1920), width 1536
    'scale=1536:1920',
    // Slow 200px horizontal drift — smooth (floor keeps it integer)
    "crop=1080:1920:'228+floor(200*n/540)':0",
    // Animated floating decoratives in top 55% — text zone unaffected
    ...decor,
    'fade=t=in:st=0:d=0.8,fade=t=out:st=17.2:d=0.8',
    'format=yuv420p',
  ].join(',')

  execFileSync('ffmpeg', [
    '-y', '-loop', '1', '-i', pngPath,
    '-vf', vf,
    '-t', '18', '-r', '30',
    '-c:v', 'libx264', '-crf', '22', '-preset', 'fast',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    mp4Path,
  ], { stdio: 'pipe' })
  return mp4Path
}

async function uploadMp4(supabase, mp4Path, date, slotId) {
  const buffer = await readFile(mp4Path)
  const digest = createHash('sha1').update(buffer).digest('hex').slice(0, 10)
  const filename = `ig-posts/autopost_${date}_${slotId}_${digest}.mp4`
  const { error } = await supabase.storage
    .from('event-photos')
    .upload(filename, buffer, { contentType: 'video/mp4', upsert: false })
  if (error) throw new Error(`MP4 upload failed: ${error.message}`)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  return `${url}/storage/v1/object/public/event-photos/${filename}`
}

// Category-to-visual mapping for DALL-E 3 prompts. Generates atmospheric
// backgrounds matched to the event's mood and scene when OPENAI_API_KEY is set.
// Style: linocut illustration, terra+teal+black+beige palette — matches site design.
const CATEGORY_VISUALS = {
  Music:           'make a lively concert image in Albuquerque with a full band on stage, crowd singing along and dancing with joy, guitars blazing',
  Comedy:          'comedy club stage in Albuquerque, spotlight on performer, audience laughing, warm intimate venue',
  'Arts & Theater':'dramatic theater stage in Albuquerque, performers in colorful costumes, golden footlights, audience watching',
  Festivals:       'outdoor street festival in Albuquerque plaza, vendor tents with colorful banners, crowd dancing and browsing, adobe buildings',
  'Food & Drink':  'lively brewery in Albuquerque, people toasting with craft beers, bartender at long tap bar, warm amber lighting',
  Outdoor:         'Sandia Mountains at golden hour, hot air balloon rising, vast New Mexico desert landscape below',
  Sports:          'packed sports stadium in Albuquerque at night, crowd cheering, bright field lights, electric atmosphere',
  Family:          'families exploring Albuquerque park on sunny day, children playing, cottonwood trees, Sandia Mountains backdrop',
  Film:            'outdoor film screening in Albuquerque park at night, audience on blankets under stars, glowing screen',
}

function buildImagePrompt(slot, events) {
  const catVisual = events.map(e => CATEGORY_VISUALS[e.category ?? '']).filter(Boolean)[0]
    ?? 'make a lively evening image in downtown Albuquerque with people celebrating, city lights, Sandia Mountains silhouette'
  return `${catVisual}, linocut hand drawn imagery using terra and teal and black and beige, bold outlines, flat graphic color, woodblock print style, expressive joyful people, no text, no logos, vertical composition`
}

async function generateOpenAIImage(prompt) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1792',
        quality: 'standard',
        response_format: 'b64_json',
      }),
    })
    if (!res.ok) {
      console.error(`[openai] API error ${res.status}: ${await res.text()}`)
      return null
    }
    const data = await res.json()
    const b64 = data?.data?.[0]?.b64_json
    if (!b64) { console.error('[openai] no image bytes in response'); return null }
    return Buffer.from(b64, 'base64')
  } catch (err) {
    console.error('[openai] image generation failed:', err instanceof Error ? err.message : err)
    return null
  }
}

async function uploadImageBuffer(supabase, buffer, mime, date, label, ext) {
  const digest = createHash('sha1').update(buffer).digest('hex').slice(0, 10)
  const filename = `ig-posts/autopost_${date}_${label}_${digest}.${ext}`
  const { error } = await supabase.storage
    .from('event-photos')
    .upload(filename, buffer, { contentType: mime, upsert: false })
  if (error) throw new Error(`Image upload failed: ${error.message}`)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  return `${url}/storage/v1/object/public/event-photos/${filename}`
}

async function queuePost(supabase, { date, slot, imageUrl, caption, events, mediaType = 'FEED', scheduledFor }) {
  const { data, error } = await supabase
    .from('ig_scheduled_posts')
    .insert({
      scheduled_for: scheduledFor ?? mdtIso(date, slot.time),
      media_type: mediaType,
      image_urls: [imageUrl],
      caption,
      event_id: slot.kind === 'single' ? events[0].id : null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw new Error(`DB insert failed: ${error.message}`)
  return data.id
}

async function sendFailureAlert(date, slotId, error) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_EMAIL) return
  const message = error instanceof Error ? error.message : String(error)
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'ABQ Unplugged <alerts@abqunplugged.com>',
      to: [process.env.ALERT_EMAIL],
      subject: `IG autopost failed ${date} ${slotId}`,
      text: `IG autopost failed ${date} ${slotId}: ${message}`,
    }),
  }).catch(alertErr => {
    console.error('Failure alert send failed:', alertErr instanceof Error ? alertErr.message : alertErr)
  })
}

async function sendEmailAlert(subject, text) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_EMAIL) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: 'ABQ Unplugged <alerts@abqunplugged.com>', to: [process.env.ALERT_EMAIL], subject, text }),
  }).catch(err => console.error('alert send failed:', err instanceof Error ? err.message : err))
}

// Daily token health check. The long-lived USER token does NOT expire
// (expires_at: 0), but Meta's data_access_expires_at (~90 days, reset only by
// a Facebook re-login, NOT by token exchange) will stop posting if it lapses.
// Email a reminder when it's within 14 days so Matt can re-auth in time.
async function checkTokenHealth() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const appId = process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET
  if (!token || !appId || !appSecret) {
    console.warn('token health check skipped (need INSTAGRAM_ACCESS_TOKEN + APP_ID + APP_SECRET)')
    return
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appId)}|${encodeURIComponent(appSecret)}`)
    const d = (await res.json())?.data || {}
    if (d.is_valid === false) {
      await sendEmailAlert('Instagram token INVALID', 'The @abqunplugged access token failed validation. Re-authenticate via the app OAuth to resume autoposting.')
      return
    }
    if (d.data_access_expires_at) {
      const days = Math.round((d.data_access_expires_at - Math.floor(Date.now() / 1000)) / 86400)
      const onIso = new Date(d.data_access_expires_at * 1000).toISOString().slice(0, 10)
      console.log(`token ok; data-access expires ${onIso} (${days}d); token expiry: ${d.expires_at ? new Date(d.expires_at * 1000).toISOString().slice(0, 10) : 'never'}`)
      if (days <= 14) {
        await sendEmailAlert(
          `Instagram data-access expires in ${days} days`,
          `Meta data-access for @abqunplugged expires ${onIso} (in ${days} days). A token exchange does NOT reset it. Log in to Facebook through the app's OAuth flow to extend ~90 days, or autoposting will stop.`,
        )
      }
    }
  } catch (err) {
    console.warn('token health check error:', err instanceof Error ? err.message : err)
  }
}

function planOutput({ date, shift, slot, events, caption, tags, pngPath, mp4Path, width, height, aiImagePrompt }) {
  return {
    date,
    shift,
    slot: slot.id,
    templateId: slot.id,
    format: mp4Path ? 'REELS' : 'FEED',
    events: events.map(event => ({ id: event.id, title: event.title, time: event.time })),
    caption,
    tags,
    pngPath,
    mp4Path: mp4Path ?? null,
    aiImagePrompt: aiImagePrompt ?? null,
    width,
    height,
  }
}

async function main() {
  await loadEnv()
  const args = parseArgs(process.argv.slice(2))
  const dryRun = args['dry-run'] === true
  const postNow = args.now === true || args.now === 'true'
  const isStoryMode = args.story === true || args.story === 'true'
  const today = args.date || denverDateParts().iso
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('--date must be YYYY-MM-DD')

  const day = weekdayIndex(today)
  const shift = args.shift || 'morning'
  const dayRotation = shift === 'evening' ? EVENING_ROTATION : MORNING_ROTATION
  // --story forces a shareable digest (top 3 upcoming events across ABQ)
  let slot = isStoryMode
    ? { id: 'top-three', kind: 'digest', period: 'next-10', time: dayRotation[day]?.time || '19:30', reel: false }
    : (args.slot ? SLOT_BY_ID[args.slot] : dayRotation[day])
  if (!slot) throw new Error(`Unknown --slot ${args.slot}`)

  if (!dryRun && process.env.IG_AUTOPOST_ENABLED !== 'true') {
    console.log('autopost disabled')
    return
  }

  // Live runs: check the IG token's data-access window and email a reminder if
  // it's expiring soon (never blocks posting).
  if (!dryRun) await checkTokenHealth()

  const hasServiceKey = Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY)
  const useFixture = Boolean(args.fixture || (dryRun && !hasServiceKey))
  const fixturePath = args.fixture ? path.resolve(String(args.fixture)) : DEFAULT_FIXTURE
  let supabase = null
  let recentIds = new Set()
  let events

  if (useFixture) {
    events = await loadFixtureEvents(fixturePath)
  } else {
    supabase = supabaseClient()
    const broadRange = dateRangeFor(slot.period, today)
    events = await loadLiveEvents(supabase, slot.period === 'today-or-next' ? { start: today, end: addDays(today, 7) } : broadRange)
    if (!dryRun) recentIds = await recentlyPostedIds(supabase)
  }

  // --event <id> / --events <id,id,...> pins specific events (manual override /
  // producing a curated week); otherwise auto-select via rotation rules.
  let selected
  if (args.event || args.events) {
    const ids = String(args.events || args.event).split(',').map(s => s.trim()).filter(Boolean)
    selected = ids.map(id => events.find(e => e.id === id)).filter(Boolean)
    if (selected.length === 0) throw new Error(`--event id(s) not found in pool: ${ids.join(', ')}`)
  } else {
    selected = selectEvents(slot, events, today, recentIds)
  }
  if (selected.length === 0) throw new Error(`No eligible events for ${today} ${slot.id}`)

  const ctx = buildContext(slot, selected, today)

  // DALL-E 3 background: generate a category-matched atmospheric image for Reel posts.
  // Runs only when OPENAI_API_KEY is set. In live mode uploads to Supabase Storage and
  // injects the URL into ctx.imageUrl so the Konva template uses it as the background.
  // Falls back to the event's source photo if the key is absent or the API fails.
  let aiImagePrompt = null
  if (slot.reel && process.env.OPENAI_API_KEY) {
    aiImagePrompt = buildImagePrompt(slot, selected)
    if (!dryRun && supabase) {
      console.error(`[openai] generating background for ${slot.id}…`)
      const aiBuffer = await generateOpenAIImage(aiImagePrompt)
      if (aiBuffer) {
        const aiUrl = await uploadImageBuffer(supabase, aiBuffer, 'image/jpeg', today, `${slot.id}-bg`, 'jpg')
        ctx.imageUrl = aiUrl
        console.error(`[openai] background: ${aiUrl}`)
      }
    } else {
      console.error(`[openai] dry-run image prompt: ${aiImagePrompt.slice(0, 120)}…`)
    }
  }

  const tagMap = await loadTagMap()
  const tags = mentionsFor(selected, tagMap)
  const reelNote = slot.reel
    ? ` (REEL post${shift === 'evening' ? ' — same-day wording like "tonight" and "this evening" is allowed for events happening today' : ''})`
    : ''
  const caption = appendMentions(await generateCaption(selected, slot, today, reelNote), tags)

  // --story renders 9:16 (Story dimensions); regular posts render 4:5
  const renderFormat = isStoryMode ? '9:16' : '4:5'

  const { buffer, width, height } = await renderIG({
    baseUrl: process.env.IG_BASE_URL || DEFAULT_BASE_URL,
    adminToken: process.env.ADMIN_SECRET,
    templateId: slot.id,
    ctx,
    format: renderFormat,
  })

  const isReel = slot.reel === true && !isStoryMode

  if (dryRun) {
    await mkdir(OUT_DIR, { recursive: true })
    const pngPath = path.join(OUT_DIR, `${today}-${slot.id}.png`)
    await writeFile(pngPath, buffer)
    let mp4Path
    if (isReel) {
      try {
        mp4Path = await generateReel(pngPath)
        console.error(`[reel] generated ${mp4Path}`)
      } catch (err) {
        console.error('[reel] ffmpeg not available in dry-run, keeping PNG:', err instanceof Error ? err.message : err)
      }
    }
    console.log(JSON.stringify(planOutput({ date: today, shift, slot, events: selected, caption, tags, pngPath, mp4Path, width, height, aiImagePrompt }), null, 2))
    return
  }

  if (!supabase) supabase = supabaseClient()
  let publicUrl
  let mediaType = 'FEED'
  if (isStoryMode) {
    // Story: 9:16 PNG posted directly to Instagram Stories
    publicUrl = await uploadPng(supabase, buffer, today, `${slot.id}-story`)
    mediaType = 'STORIES'
  } else if (isReel) {
    await mkdir(OUT_DIR, { recursive: true })
    const pngPath = path.join(OUT_DIR, `${today}-${slot.id}.png`)
    await writeFile(pngPath, buffer)
    const mp4Path = await generateReel(pngPath)
    publicUrl = await uploadMp4(supabase, mp4Path, today, slot.id)
    mediaType = 'REELS'
  } else {
    publicUrl = await uploadPng(supabase, buffer, today, slot.id)
  }
  // --now: schedule for right now so the Netlify publisher (runs every 5 min) picks it up immediately
  const scheduledFor = postNow ? new Date().toISOString() : undefined
  const rowId = await queuePost(supabase, { date: today, slot, imageUrl: publicUrl, caption, events: selected, mediaType, scheduledFor })
  const displayTime = scheduledFor ?? mdtIso(today, slot.time)
  console.log(JSON.stringify({ id: rowId, scheduledFor: displayTime, imageUrl: publicUrl, mediaType }, null, 2))
}

main().catch(async error => {
  const args = parseArgs(process.argv.slice(2))
  const date = args.date || denverDateParts().iso
  const errShift = args.shift || 'morning'
  const errRotation = errShift === 'evening' ? EVENING_ROTATION : MORNING_ROTATION
  const slotId = args.slot || SLOT_BY_ID[args.slot]?.id || errRotation[weekdayIndex(date)]?.id || 'unknown'
  await sendFailureAlert(date, slotId, error)
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
