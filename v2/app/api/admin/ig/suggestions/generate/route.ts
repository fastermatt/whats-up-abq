/**
 * POST /api/admin/ig/suggestions/generate
 *
 * Generates Instagram post suggestions based on the DeepSeek-derived posting
 * schedule. For each day in the target window, picks events from the DB,
 * generates an AI caption via DeepSeek, and inserts suggestion rows.
 *
 * Body (all optional — JSON):
 *   { start?: "YYYY-MM-DD", end?: "YYYY-MM-DD" }   // MDT dates, inclusive
 * When start+end are omitted, defaults to the coming Mon→Sun week.
 * Each day maps to its day-of-week template, so a 3-day range yields 3 posts,
 * a 14-day range yields 14, etc. Range is capped at 31 days.
 *
 * The weekly schedule (MDT times), applied by day-of-week:
 *   Mon 12:00 — WeeklyFive      (the week ahead, 5 picks)
 *   Tue 17:30 — BreweryNights   (after-work taproom crowd)
 *   Wed 12:00 — SingleEvent     (spotlight a standout, photo-led)
 *   Thu 17:30 — WeekendDigest   (weekend-planning peak)
 *   Fri 16:30 — Tonight         (peak "what's tonight" intent)
 *   Sat 10:30 — SingleEvent     (Saturday's big event, photo-led)
 *   Sun 16:00 — Tonight         (low-key "something tonight")
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { venueHandles } from '@/lib/venue-instagram'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // caption generation can take a few seconds

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.cookies.get('admin_token')?.value === secret
}

// ── Weekly schedule ───────────────────────────────────────────────────────────

type PostType = 'WeeklyFive' | 'BreweryNights' | 'WeekendDigest' | 'SingleEvent' | 'Tonight' | 'DeepDive'

interface DaySlot {
  dow: number      // 0=Sun … 6=Sat
  postType: PostType
  templateId: string
  hour: number
  minute: number
  // For WeekendDigest: 'headliners' = the biggest weekend events;
  // 'under-radar' = free / local / overlooked picks (no overlap with headliners).
  variant?: 'headliners' | 'under-radar'
}

// Weekly content calendar (all times MDT). Designed around what actually earns
// attention for a local-events account, plus discovery:
//
//   Mon  9:00am  WeeklyFive    — "the week ahead", the Monday-morning planning post
//   Tue  5:30pm  SingleEvent   — the week's marquee show, photo-led (highest reach)
//   Wed  12:00pm DeepDive      — ONE under-the-radar event people would miss
//   Thu  5:30pm  BreweryNights — themed taproom + live-music roundup
//   Fri 11:00am  WeekendDigest (headliners)  — the weekend's biggest draws
//   Fri  4:30pm  WeekendDigest (under-radar) — free/local/overlooked, NO overlap
//   Sat 10:30am  SingleEvent   — Saturday's standout, photo-led
//   Sun  4:00pm  Tonight       — low-key "what's on" roundup
//
// Two weekend digests both land Friday (peak weekend-planning intent). They share
// the same post type, so the per-type cross-run dedup guarantees zero overlapping
// events between them — the headliners post takes the top draws, the under-radar
// post takes the next tier (free, local, smaller venues). 8 posts/week.
const WEEKLY_SLOTS: DaySlot[] = [
  { dow: 1, postType: 'WeeklyFive',    templateId: 'weekly-five',    hour: 9,  minute: 0  },
  { dow: 2, postType: 'SingleEvent',   templateId: 'poster',         hour: 17, minute: 30 },
  { dow: 3, postType: 'DeepDive',      templateId: 'split',          hour: 12, minute: 0  },
  { dow: 4, postType: 'BreweryNights', templateId: 'tonight-list',   hour: 17, minute: 30 },
  { dow: 5, postType: 'WeekendDigest', templateId: 'weekend-digest', hour: 11, minute: 0, variant: 'headliners'  },
  { dow: 5, postType: 'WeekendDigest', templateId: 'weekend-digest', hour: 16, minute: 30, variant: 'under-radar' },
  { dow: 6, postType: 'SingleEvent',   templateId: 'poster',         hour: 10, minute: 30 },
  { dow: 0, postType: 'Tonight',       templateId: 'tonight-list',   hour: 16, minute: 0  },
]

// ── Date helpers (America/Denver, DST-aware) ──────────────────────────────────

function toMDT(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
}

/** Denver UTC offset in hours for a given date: 6 in MDT (summer), 7 in MST
 *  (winter). Computed from the IANA zone so it's correct year-round. */
function denverOffsetHours(dateStr: string): number {
  const probe = new Date(dateStr + 'T12:00:00Z')
  const denver = new Date(probe.toLocaleString('en-US', { timeZone: 'America/Denver' }))
  const utc = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' }))
  return Math.round((utc.getTime() - denver.getTime()) / 3_600_000)
}

function mdtToUTC(dateStr: string, hour: number, minute: number): Date {
  // dateStr = YYYY-MM-DD Denver wall time → UTC instant (DST-aware).
  const [y, m, day] = dateStr.split('-').map(Number)
  const off = denverOffsetHours(dateStr)
  return new Date(Date.UTC(y, m - 1, day, hour + off, minute, 0))
}

/** Get the next Monday (MDT) from today */
function nextMondayMDT(): Date {
  const now = new Date()
  const todayMDT = toMDT(now)
  const d = new Date(todayMDT + 'T12:00:00')
  const dow = d.getDay()  // 0=Sun
  const daysToMon = dow === 1 ? 7 : (8 - dow) % 7 || 7
  d.setDate(d.getDate() + daysToMon)
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// ── Event row type ────────────────────────────────────────────────────────────

interface EventRow {
  id: string
  raw: Record<string, unknown> | null
  event_date: string
  venue_name: string | null
  category: string | null
  cached_photo_url: string | null
  popularity_score: number | null
  source: string | null
}

interface EventSnap {
  id: string
  title: string
  date: string
  time: string | null
  venue: string | null
  category: string | null
  imageUrl: string | null
  popularityScore: number
}

function rowToSnap(row: EventRow): EventSnap {
  const raw = (row.raw ?? {}) as Record<string, unknown>
  const dates = (raw as Record<string, Record<string, unknown>>).dates as Record<string, Record<string, unknown>> | undefined
  const localTime = (dates?.start?.localTime as string | undefined) ?? (raw.time as string | undefined) ?? null

  let time = localTime
  if (time && /^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    const [h, m] = time.split(':').map(Number)
    time = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }

  const title = String(raw.name ?? raw.title ?? '').trim() || (row.venue_name ?? '')
  return {
    id: row.id,
    title,
    date: String(row.event_date).slice(0, 10),
    time,
    venue: row.venue_name,
    category: row.category,
    imageUrl: row.cached_photo_url,
    popularityScore: Math.round((row.popularity_score ?? 5) * 10) / 10,
  }
}

// ── Caption generator (DeepSeek) ──────────────────────────────────────────────

const CAPTION_SYSTEM = `You write Instagram captions for ABQ Unplugged — Albuquerque NM's local events guide.

VOICE: You are a Burqueño who has been to these shows, knows these venues, and is texting a friend about what's worth their Friday night. Confident, specific, never corporate. Write complete sentences like a real person — NOT advertising fragments.

BANNED PATTERNS (these instantly sound AI-generated — never use them):
- Three-word fragment sentences: "Cold beer. Live music." / "Four bands. One room."
- Invented crowd sizes or stadium imagery: "12,000 voices", "15,000 boots"
- Generic hype words: "amazing", "epic", "wild", "iconic", "unforgettable", "zero filler", "summer formula"
- Marketing hooks: "Discover", "Unleash", "Don't miss", "You won't want to miss"
- Em dashes
- Stacked bullet lists for every event — pick 1–2 highlights and tell people about them

GOOD APPROACH: Lead with the ONE detail that makes this interesting. Write like you know the venue, the artist's genre, the vibe. Mention a real specific fact if you have one. For roundups, pick what's most interesting and let the rest follow naturally. A save/tag prompt should feel conversational, not like a call-to-action template.

DO NOT use time-relative phrases ("tonight", "this week", "this weekend") unless the prompt explicitly says the post goes live that same day — these are scheduled ahead.

When the prompt provides venue @handles, weave 1–2 naturally into the body. Never invent a handle.

End with: abqunplugged.com 🌵
Final line: exactly 8 hashtags — #ABQ #Albuquerque #505 #BurqueLife #ThingsToDo505 plus 3 specific.
Body length: 150–350 characters (enough to write a real thought, not so long it loses people).`

const CAPTION_PROMPTS: Record<PostType, (events: EventSnap[]) => string> = {
  WeeklyFive: (e) => `Instagram caption for an Albuquerque "five shows worth knowing about this week" post.
Events (with dates so you can reference them naturally): ${e.map(ev => `${ev.title} at ${ev.venue ?? 'ABQ'} on ${ev.date}${ev.time ? ' at ' + ev.time : ''}`).join(' / ')}
Lead with the most impressive or unexpected name on the list. Write it like you're telling a friend which nights are worth planning around — not like you're listing every event. Save this prompt.`,

  BreweryNights: (e) => `Instagram caption for an ABQ brewery live music roundup.
Events: ${e.map(ev => `${ev.title} at ${ev.venue ?? 'ABQ'} on ${ev.date}${ev.time ? ' at ' + ev.time : ''}`).join(' / ')}
Highlight the 1–2 most interesting ones — an album release, a local act worth knowing, or something specific about the venue. Sound like someone who goes to these spots, not like a promo post. Include a tag prompt.`,

  WeekendDigest: (e) => `Instagram caption for an Albuquerque weekend events roundup.
Events: ${e.map(ev => `${ev.title} at ${ev.venue ?? 'ABQ'} on ${ev.date}${ev.time ? ' at ' + ev.time : ''}`).join(' / ')}
Pick the angle that makes this weekend interesting — a surprising pairing, an unusual range, or a standout show. Don't list every event. Write the way you'd explain the weekend to someone deciding what to do. Save this prompt.`,

  SingleEvent: (e) => `Instagram caption spotlighting one Albuquerque event.
Event: ${e[0]?.title} at ${e[0]?.venue} on ${e[0]?.date}${e[0]?.time ? ' at ' + e[0].time : ''}.
Write 2–3 sentences about why this is worth going to. Reference something real about the artist or the venue if you know it. Sound like a local who cares about the show, not a ticket seller.`,

  Tonight: (e) => `Instagram caption for an Albuquerque live events roundup.
Events: ${e.map(ev => `${ev.title} at ${ev.venue ?? 'ABQ'}${ev.time ? ' at ' + ev.time : ''}`).join(' / ')}
Lead with the most interesting name or pairing on the list. Write naturally — you're pointing someone toward their options for the night, not filing a press release. Include a tag prompt.`,

  DeepDive: (e) => `Instagram caption for a "deep dive" spotlight on ONE under-the-radar Albuquerque event most people will scroll past.
Event: ${e[0]?.title} at ${e[0]?.venue} on ${e[0]?.date}${e[0]?.time ? ' at ' + e[0].time : ''} (${e[0]?.category}).
This is the discovery post — the kind of thing that doesn't sell out but is genuinely worth knowing about. Write 3-4 sentences making the case for it: who it's for, what makes it worth the trip, why it's a hidden gem. Sound like a local sharing a tip, not promoting. Earnest, specific, a little protective of the good stuff.`,
}

/** Insert any venue @handles the caption didn't already include, on their own
 *  line just before the hashtag line. Guarantees venues get tagged even if the
 *  model omits them. Never adds a handle not in `handles` (no invention). */
function ensureVenueTags(caption: string, handles: string[]): string {
  if (!caption || handles.length === 0) return caption
  const missing = handles.filter(h => !caption.includes('@' + h))
  if (missing.length === 0) return caption

  const tagLine = '📍 ' + missing.map(h => '@' + h).join(' ')
  const lines = caption.split('\n')
  // Find the last non-empty line; if it's the hashtag line, insert before it.
  let lastIdx = lines.length - 1
  while (lastIdx >= 0 && lines[lastIdx].trim() === '') lastIdx--
  if (lastIdx >= 0 && lines[lastIdx].trim().startsWith('#')) {
    lines.splice(lastIdx, 0, '', tagLine)
    return lines.join('\n')
  }
  return caption + '\n\n' + tagLine
}

/** Deterministic caption used when DeepSeek is unavailable, so a post NEVER
 *  ends up with a blank caption (which kills reach and drops venue tags). */
function fallbackCaption(postType: PostType, events: EventSnap[], handles: string[]): string {
  const hooks: Record<PostType, string> = {
    WeeklyFive:    'This week in Burque:',
    BreweryNights: 'Taproom nights in ABQ:',
    WeekendDigest: 'Your Albuquerque weekend, sorted:',
    SingleEvent:   'On our radar:',
    Tonight:       'Tonight in Burque:',
    DeepDive:      'One you might have missed:',
  }
  const hook = hooks[postType] ?? 'Happening in Albuquerque:'
  const lines = events.slice(0, 5).map(e => `• ${e.title}${e.venue ? ` @ ${e.venue}` : ''}`)
  const tagLine = handles.length ? `\n📍 ${handles.map(h => '@' + h).join(' ')}` : ''
  const saveLine = events.length > 1 ? '\nSave this for later. ' : '\n'
  return `${hook}\n${lines.join('\n')}${tagLine}\n${saveLine}Full details → abqunplugged.com 🌵\n#ABQ #Albuquerque #505 #BurqueLife #ThingsToDo505 #ABQEvents #NewMexico #DukeCity`
}

async function generateCaption(postType: PostType, events: EventSnap[], handles: string[] = [], extra = ''): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (events.length === 0) return ''
  if (!apiKey) {
    console.warn('[generateCaption] DEEPSEEK_API_KEY not set in this environment — using fallback caption')
    return ''
  }

  let userPrompt = CAPTION_PROMPTS[postType](events)
  if (extra) userPrompt += `\n${extra}`
  if (handles.length > 0) {
    userPrompt += `\nVenue tags (use these exact handles when you mention the venue; do not invent any others): ${handles.map(h => '@' + h).join(' ')}`
  }

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // 'deepseek-chat' is the non-thinking alias for deepseek-v4-flash.
        // 'deepseek-v4-flash' by name activates mandatory thinking/reasoning mode
        // which burns 800–2000 tokens internally before writing any output, leaving
        // nothing for the caption. 'deepseek-chat' skips that pass entirely:
        // 0 thinking tokens, ~100 output tokens, real captions every time.
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: CAPTION_SYSTEM },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 400,
      }),
    })
    if (!res.ok) {
      console.error('[generateCaption] DeepSeek HTTP error:', res.status, (await res.text()).slice(0, 300))
      return ''
    }
    const data = await res.json() as { choices: { message: { content: string } }[] }
    return data.choices[0]?.message?.content?.trim() ?? ''
  } catch (err) {
    console.error('[generateCaption] DeepSeek request failed:', err instanceof Error ? err.message : String(err))
    return ''
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const generationId = crypto.randomUUID()

  // ── Resolve the target date window ──────────────────────────────────────────
  // Body (all optional): { weekend?: boolean, start?, end? } MDT, inclusive.
  // weekend → this coming Fri→Sun, led by a "this weekend" digest.
  // start+end → that range. Neither → next Mon→Sun.
  const body = await req.json().catch(() => ({})) as { start?: string; end?: string; weekend?: boolean }
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

  // Explicit slots that aren't derived from the day-of-week mapping (e.g. the
  // weekend digest that leads a weekend batch).
  type ExtraSlot = DaySlot & { dateStr: string }
  const extraSlots: ExtraSlot[] = []

  let dateStrs: string[]
  if (body.weekend) {
    // This weekend = the coming Fri/Sat/Sun (on Sun, rolls to next weekend).
    const todayMDT = toMDT(new Date())
    const todayD = new Date(todayMDT + 'T12:00:00')
    const daysToSat = (6 - todayD.getDay() + 7) % 7   // 0 if Sat, 6 if Sun
    const sat = addDays(todayD, daysToSat)
    const fri = addDays(sat, -1)
    const sun = addDays(sat, 1)
    // Drop any weekend day already past (e.g. Friday when generating on Saturday).
    dateStrs = [toMDT(fri), toMDT(sat), toMDT(sun)].filter(d => d >= todayMDT)
    // Two weekend digests on the earliest remaining day: the headliners and the
    // under-the-radar picks (deduped against each other by post-type memory).
    extraSlots.push(
      { dow: 5, postType: 'WeekendDigest', templateId: 'weekend-digest', hour: 11, minute: 0,  dateStr: dateStrs[0], variant: 'headliners'  },
      { dow: 5, postType: 'WeekendDigest', templateId: 'weekend-digest', hour: 16, minute: 30, dateStr: dateStrs[0], variant: 'under-radar' },
    )
  } else if (body.start && body.end) {
    if (!DATE_RE.test(body.start) || !DATE_RE.test(body.end)) {
      return NextResponse.json({ error: 'start/end must be YYYY-MM-DD' }, { status: 400 })
    }
    if (body.end < body.start) {
      return NextResponse.json({ error: 'end must be on or after start' }, { status: 400 })
    }
    const startD = new Date(body.start + 'T12:00:00')
    const endD   = new Date(body.end + 'T12:00:00')
    const days   = Math.round((endD.getTime() - startD.getTime()) / 86_400_000) + 1
    if (days > 31) {
      return NextResponse.json({ error: 'Range too large (max 31 days)' }, { status: 400 })
    }
    dateStrs = Array.from({ length: days }, (_, i) => toMDT(addDays(startD, i)))
  } else {
    const monday = nextMondayMDT()
    dateStrs = Array.from({ length: 7 }, (_, i) => toMDT(addDays(monday, i)))
  }

  // Map each calendar date to its day-of-week template slot(s). A day can have
  // MORE than one slot (e.g. Friday's two weekend digests), so this is a multimap.
  const slotsByDow = new Map<number, DaySlot[]>()
  for (const s of WEEKLY_SLOTS) {
    const list = slotsByDow.get(s.dow) ?? []
    list.push(s)
    slotsByDow.set(s.dow, list)
  }
  const weekStart = dateStrs[0]
  const weekEnd   = dateStrs[dateStrs.length - 1]

  // Skip days already covered by a pending suggestion, so re-running an
  // overlapping range doesn't create duplicates. Map each pending row's
  // scheduled_for (UTC) back to its MDT calendar date.
  const { data: pendingRows } = await supabase
    .schema('public')
    .from('ig_post_suggestions')
    .select('scheduled_for')
    .eq('status', 'pending')
    .gte('scheduled_for', mdtToUTC(weekStart, 0, 0).toISOString())
    .lte('scheduled_for', mdtToUTC(weekEnd, 23, 59).toISOString())

  const coveredDays = new Set(
    (pendingRows ?? []).map(r => toMDT(new Date(r.scheduled_for as string)))
  )

  const perDaySlots: ExtraSlot[] = dateStrs.flatMap(dateStr => {
    const dow = new Date(dateStr + 'T12:00:00').getDay()
    return (slotsByDow.get(dow) ?? []).map(slot => ({ ...slot, dateStr }))
  })
  const allSlots = [...extraSlots, ...perDaySlots].map(s => ({
    ...s,
    scheduledFor: mdtToUTC(s.dateStr, s.hour, s.minute),
  }))
  const skippedDays = allSlots.filter(s => coveredDays.has(s.dateStr)).length
  const slots = allSlots
    .filter(s => !coveredDays.has(s.dateStr))
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())

  // Fetch events spanning the whole window

  const { data: allRows } = await supabase
    .schema('public')
    .from('events')
    .select('id, raw, event_date, venue_name, category, cached_photo_url, popularity_score, source')
    .eq('hidden', false)
    .gte('event_date', weekStart)
    .lte('event_date', weekEnd + 'T23:59:59')
    .order('popularity_score', { ascending: false, nullsFirst: false })
    .limit(200)

  const rows = (allRows ?? []) as EventRow[]
  const snaps = rows.map(rowToSnap)

  // Helper: events for a specific date
  const eventsOn = (dateStr: string) => snaps.filter(e => e.date === dateStr)

  // Helper: brewery events
  const brewerySnaps = snaps.filter(e =>
    /brew|taproom|distill/i.test(e.venue ?? '')
  )

  // Build suggestions.
  // NOTE: this type mirrors the EXACT columns of public.ig_post_suggestions.
  // Keep it in sync with the table. Typing the array (instead of
  // Record<string, unknown>) makes excess-property checks fire if anyone adds a
  // field that isn't a real column — this is the compile-time guard that would
  // have caught the `event_ctx` insert crash. Do NOT loosen it back to a record.
  interface SuggestionInsert {
    generation_id:  string
    post_type:      PostType
    template_id:    string
    event_ids:      string[]
    event_data:     EventSnap[]
    caption:        string
    scheduled_for:  string
    status:         'pending'
    strategy_notes: string
  }
  const insertions: SuggestionInsert[] = []

  // Image-based event templates (use event photo as hero)
  const IMAGE_TEMPLATES = ['poster', 'golden-hour', 'split', 'paper', 'dispatch'] as const

  // Per-post-type memory so the SAME post type generated twice in one window
  // (e.g. two BreweryNights in a 2-week range) doesn't repeat the same events.
  const usedByType: Record<string, Set<string>> = {}
  const typeSeen = (t: string) => (usedByType[t] ??= new Set<string>())

  // Normalize a title for fuzzy de-duplication: drop a leading "Prefix:" tag
  // (e.g. "USL Cup:"), then strip punctuation/spacing. Catches the same event
  // listed by two sources with slightly different titles.
  const normTitle = (t: string) =>
    (t ?? '').toLowerCase().replace(/^[^:]{1,18}:\s*/, '').replace(/[^a-z0-9]+/g, '')

  // Select up to `max` events. Skips ones already used by this post type, then
  // de-dupes WITHIN the post by (a) normalized title and (b) a date|venue|time
  // slot key — so the same game/show cross-listed by SeatGeek + Ticketmaster
  // only appears once — and caps any one venue to 2 slots.
  const MAX_PER_VENUE = 2
  function pickEvents(candidates: EventSnap[], max: number, exclude: Set<string>): EventSnap[] {
    const out: EventSnap[] = []
    const seenKeys = new Set<string>()
    const venueCount = new Map<string, number>()
    for (const e of candidates) {
      if (exclude.has(e.id)) continue
      const vkey = (e.venue ?? '').trim().toLowerCase()
      const tkey = normTitle(e.title)
      const timeKey = (e.time ?? '').trim().toLowerCase()
      const slotKey = timeKey ? `@${e.date}|${vkey}|${timeKey}` : ''
      if (tkey && seenKeys.has(tkey)) continue
      if (slotKey && seenKeys.has(slotKey)) continue
      if (vkey) {
        const c = venueCount.get(vkey) ?? 0
        if (c >= MAX_PER_VENUE) continue
        venueCount.set(vkey, c + 1)
      }
      if (tkey) seenKeys.add(tkey)
      if (slotKey) seenKeys.add(slotKey)
      out.push(e)
      if (out.length >= max) break
    }
    return out
  }

  for (const slot of slots) {
    let selected: EventSnap[] = []
    let strategyNotes = ''
    let templateId = slot.templateId   // may be overridden below

    const exclude = typeSeen(slot.postType)

    switch (slot.postType) {
      case 'WeeklyFive': {
        // Diverse: best event per day first, then fill by score — then dedupe/cap.
        const byDay = new Map<string, EventSnap[]>()
        for (const e of snaps) {
          if (!byDay.has(e.date)) byDay.set(e.date, [])
          byDay.get(e.date)!.push(e)
        }
        const ordered: EventSnap[] = []
        for (const [, dayEvents] of byDay) if (dayEvents[0]) ordered.push(dayEvents[0])
        ordered.push(...snaps)   // fill pool (pickEvents dedupes by id/title)
        selected = pickEvents(ordered, 5, exclude)
        strategyNotes = 'Weekly overview — diverse picks across the week for a habitual check-in'
        break
      }
      case 'BreweryNights':
        selected = pickEvents(brewerySnaps, 5, exclude)
        strategyNotes = 'Taproom crowd — brewery + live music is peak ABQ community engagement'
        break
      case 'WeekendDigest': {
        // Coming weekend relative to this slot's date.
        const base = new Date(slot.dateStr + 'T12:00:00')
        const toSat = (6 - base.getDay() + 7) % 7
        const satStr = toMDT(addDays(base, toSat))
        const sunStr = toMDT(addDays(base, toSat + 1))
        const weekend = snaps.filter(e => e.date === satStr || e.date === sunStr)
        // Big ticketed shows come from TM/SG; local/free/community come from the
        // other sources (local-, nhcc-, eb-, rrfb, lovenm, abqtodo, babydolls…).
        const isMarquee = (e: EventSnap) => /^(ticketmaster_|seatgeek_)/.test(e.id)

        if (slot.variant === 'under-radar') {
          // The second Friday digest: free / local / smaller-venue picks. Non-marquee
          // events first (best local picks lead), then the rest. The headliner post
          // already ran, so its events are excluded via typeSeen — guaranteeing zero
          // overlap between the two weekend digests.
          const local = weekend.filter(e => !isMarquee(e))
          const rest  = weekend.filter(e => isMarquee(e))
          selected = pickEvents([...local, ...rest], 5, exclude)
          strategyNotes = 'Weekend (under the radar) — free/local/overlooked picks; no overlap with the headliners post'
        } else {
          // The first Friday digest: the weekend's biggest draws, balanced Sat + Sun.
          const sat = weekend.filter(e => e.date === satStr)
          const sun = weekend.filter(e => e.date === sunStr)
          const interleaved = [...sat.slice(0, 3), ...sun.slice(0, 2), ...sat.slice(3), ...sun.slice(2)]
          selected = pickEvents(interleaved, 5, exclude)
          strategyNotes = 'Weekend headliners — the biggest draws Sat + Sun; the high-attention save-bait post'
        }
        break
      }
      case 'DeepDive': {
        // ONE under-the-radar event people would likely miss. Not the marquee
        // headliners (those get their own spotlights) — a real local/community/arts
        // event with a photo and enough substance to write about. Mid popularity:
        // good enough to matter, overlooked enough to be a discovery.
        const isMarquee = (e: EventSnap) => /^(ticketmaster_|seatgeek_)/.test(e.id)
        const band = snaps.filter(e =>
          e.imageUrl && !isMarquee(e) &&
          e.popularityScore >= 4 && e.popularityScore <= 7.5
        )
        // Best within the under-the-radar band (it's worth featuring, just not famous).
        selected = pickEvents(band, 1, exclude)
        if (selected.length === 0) {
          selected = pickEvents(snaps.filter(e => e.imageUrl && !isMarquee(e)), 1, exclude)
        }
        if (selected.length === 0) continue
        templateId = selected[0]?.imageUrl ? 'split' : 'broadside'
        strategyNotes = 'Deep dive — an overlooked local event worth knowing about; the discovery post'
        break
      }
      case 'SingleEvent': {
        // Best event on that day (score 8+), prefer photos; fallback to the next
        // few days only (never a far-future event that contradicts the post date).
        const dayEvents = eventsOn(slot.dateStr)
        const high = dayEvents.filter(e => e.popularityScore >= 8)
        const withPhoto = (high.length > 0 ? high : dayEvents).filter(e => e.imageUrl)
        selected = pickEvents(withPhoto.length > 0 ? withPhoto : (high.length > 0 ? high : dayEvents), 1, exclude)
        if (selected.length === 0) {
          const endStr = toMDT(addDays(new Date(slot.dateStr + 'T12:00:00'), 3))
          const near = snaps.filter(e => e.date >= slot.dateStr && e.date <= endStr && e.popularityScore >= 7)
          const nearImg = near.filter(e => e.imageUrl)
          selected = pickEvents(nearImg.length > 0 ? nearImg : near, 1, exclude)
        }
        if (selected.length === 0) continue   // no suitable spotlight — skip, don't force

        // Image template when a photo exists, typographic otherwise.
        const hasPhoto = !!selected[0]?.imageUrl
        if (hasPhoto) {
          const cat = selected[0]?.category ?? ''
          if (cat === 'Music' || cat === 'Festivals') templateId = 'poster'
          else if (cat === 'Food & Drink' || cat === 'Community') templateId = 'golden-hour'
          else templateId = 'split'
        } else {
          templateId = 'broadside'
        }
        strategyNotes = `Spotlight — ${hasPhoto ? `photo post (${templateId})` : 'type-only (no photo)'}, highest-score event for max shareability`
        break
      }
      case 'Tonight':
        selected = pickEvents(eventsOn(slot.dateStr), 5, exclude)
        strategyNotes = '"What\'s happening tonight?" — peak intent scroll window'
        break
    }

    if (selected.length === 0) continue

    // Remember these so the same post type won't repeat them later in this run.
    selected.forEach(e => exclude.add(e.id))

    // Caption, auto-tagging venue IG handles. Fall back to a deterministic
    // caption if DeepSeek is unavailable so a post is never published blank.
    const handles = venueHandles(selected.map(e => e.venue))
    // The under-the-radar weekend digest gets a distinct framing so the two
    // Friday digests don't read like the same post twice.
    const captionExtra = slot.postType === 'WeekendDigest' && slot.variant === 'under-radar'
      ? 'Frame these as the under-the-radar weekend picks — the free, local, smaller-venue stuff people overlook while everyone talks about the big shows. The locals\' alternative.'
      : ''
    const aiCaption = ensureVenueTags(await generateCaption(slot.postType, selected, handles, captionExtra), handles)
    const caption = aiCaption.trim() || fallbackCaption(slot.postType, selected, handles)

    insertions.push({
      generation_id:  generationId,
      post_type:      slot.postType,
      template_id:    templateId,
      event_ids:      selected.map(e => e.id),
      event_data:     selected,
      caption,
      scheduled_for:  slot.scheduledFor.toISOString(),
      status:         'pending',
      strategy_notes: strategyNotes,
    })
  }

  // Nothing to insert (every day was already covered, or no events matched)
  if (insertions.length === 0) {
    return NextResponse.json({
      generationId,
      generated: 0,
      skipped:   skippedDays,
      reason:    skippedDays > 0 ? 'All days already have pending suggestions' : 'No events found for this period',
      weekStart,
      weekEnd,
    })
  }

  const { data: inserted, error } = await supabase
    .schema('public')
    .from('ig_post_suggestions')
    .insert(insertions)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    generationId,
    generated:  inserted?.length ?? 0,
    skipped:    skippedDays,
    weekStart,
    weekEnd,
  })
}
