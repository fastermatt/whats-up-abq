/**
 * POST /api/admin/ig/suggestions/generate
 *
 * Generates 7 days of Instagram post suggestions based on the DeepSeek-derived
 * posting schedule. For each day of the coming week, picks events from the DB,
 * generates an AI caption via DeepSeek, and inserts suggestion rows.
 *
 * The weekly schedule (MDT times):
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

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // caption generation can take a few seconds

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.cookies.get('admin_token')?.value === secret
}

// ── Weekly schedule ───────────────────────────────────────────────────────────

type PostType = 'WeeklyFive' | 'BreweryNights' | 'WeekendDigest' | 'SingleEvent' | 'Tonight'

interface DaySlot {
  dow: number      // 0=Sun … 6=Sat
  postType: PostType
  templateId: string
  hour: number
  minute: number
}

// Optimal weekly cadence for a local-events IG account (all times MDT).
// Mix: SingleEvent ×2 (photo-led, most shareable), Tonight ×2 (high-utility),
// WeeklyFive ×1, WeekendDigest ×1, BreweryNights ×1 = 7 posts/week.
// One post per day; never two of the same type back-to-back. WeekendDigest
// lands Thursday late-afternoon — the moment people actually commit to
// weekend plans (research-consistent peak for weekend-intent local content).
// SingleEvent templateId is overridden per-event below (poster/golden-hour/
// split when a photo exists, broadside when it doesn't).
const WEEKLY_SLOTS: DaySlot[] = [
  { dow: 1, postType: 'WeeklyFive',    templateId: 'weekly-five',    hour: 12, minute: 0  }, // Mon noon — plan the week
  { dow: 2, postType: 'BreweryNights', templateId: 'tonight-list',   hour: 17, minute: 30 }, // Tue after-work taproom crowd
  { dow: 3, postType: 'SingleEvent',   templateId: 'poster',         hour: 12, minute: 0  }, // Wed lunch — spotlight a standout
  { dow: 4, postType: 'WeekendDigest', templateId: 'weekend-digest', hour: 17, minute: 30 }, // Thu after-work — weekend planning peak
  { dow: 5, postType: 'Tonight',       templateId: 'tonight-list',   hour: 16, minute: 30 }, // Fri — "what's tonight" peak intent
  { dow: 6, postType: 'SingleEvent',   templateId: 'poster',         hour: 10, minute: 30 }, // Sat morning — spotlight Saturday's event
  { dow: 0, postType: 'Tonight',       templateId: 'tonight-list',   hour: 16, minute: 0  }, // Sun — low-key "something tonight"
]

// ── Date helpers (MDT = UTC-6) ────────────────────────────────────────────────

function toMDT(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
}

function mdtToUTC(dateStr: string, hour: number, minute: number): Date {
  // dateStr = YYYY-MM-DD in MDT; convert to UTC timestamp
  const [y, m, day] = dateStr.split('-').map(Number)
  // MDT = UTC-6; schedule time → UTC
  const utc = new Date(Date.UTC(y, m - 1, day, hour + 6, minute, 0))
  return utc
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

const CAPTION_SYSTEM = `You write short, punchy Instagram captions for ABQ Unplugged — Albuquerque NM's local events guide.
Voice: Burqueño insider — confident, slightly playful, never corporate.
Rules:
- No em dashes. No "Discover", "Unleash", "amazing", "epic", "#Blessed".
- NO time-relative phrases ("tonight", "this week", "tomorrow") UNLESS the prompt explicitly says the post is for that exact day — these captions are scheduled days ahead and stale time claims look broken.
- First line is a hook with a specific, concrete detail (an artist name, a venue, a vivid image). Not a generic greeting.
- Include a save/tag prompt for roundup posts ("Save this", "Tag who you'd bring").
- End with: abqunplugged.com 🌵
- Exactly 8 hashtags on the final line: #ABQ #Albuquerque #505 #BurqueLife #ThingsToDo505 plus 3 specific to the events.
- Body under 200 characters before the hashtag line.`

const CAPTION_PROMPTS: Record<PostType, (events: EventSnap[]) => string> = {
  WeeklyFive: (e) => `Write an Instagram caption for a "5 things to do this week in Albuquerque" post.
Events: ${e.map(ev => `${ev.title} (${ev.date})`).join(', ')}
Hook with "This week in Burque:" or similar. List events briefly. Keep it punchy.`,

  BreweryNights: (e) => `Write an Instagram caption for a "brewery nights in ABQ" post.
Events: ${e.map(ev => `${ev.title} @ ${ev.venue} on ${ev.date}`).join(', ')}
Hook: something about cold beer + live music. Mention 1-2 venues by name.`,

  WeekendDigest: (e) => `Write an Instagram caption for a "this weekend in Albuquerque" roundup.
Events: ${e.map(ev => `${ev.title} (${ev.date})`).join(', ')}
Hook: "Your Albuquerque weekend, sorted:" or similar. Tease 2-3 highlights.`,

  SingleEvent: (e) => `Write an Instagram caption spotlighting this one Albuquerque event.
Event: ${e[0]?.title} at ${e[0]?.venue} on ${e[0]?.date}${e[0]?.time ? ` at ${e[0].time}` : ''}.
Hook with a specific detail that makes someone want to go. Create urgency without "amazing" or "epic".`,

  Tonight: (e) => `Write an Instagram caption for a "what's happening in ABQ tonight" post.
Events: ${e.map(ev => `${ev.title}${ev.time ? ` at ${ev.time}` : ''}`).join(', ')}
Hook: "Tonight in Burque:" or "Last-minute plans?" Make it feel alive.`,
}

async function generateCaption(postType: PostType, events: EventSnap[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey || events.length === 0) return ''

  const userPrompt = CAPTION_PROMPTS[postType](events)

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: CAPTION_SYSTEM },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 200,
      }),
    })
    if (!res.ok) return ''
    const data = await res.json() as { choices: { message: { content: string } }[] }
    return data.choices[0]?.message?.content?.trim() ?? ''
  } catch {
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

  // Determine the week to generate (next Mon → following Sun)
  const monday = nextMondayMDT()

  // Build list of (date, slot) pairs for the 7-day window
  const slots = WEEKLY_SLOTS.map(slot => {
    const diff = (slot.dow - monday.getDay() + 7) % 7
    const date = addDays(monday, diff)
    const dateStr = toMDT(date)
    const scheduledFor = mdtToUTC(dateStr, slot.hour, slot.minute)
    return { ...slot, dateStr, scheduledFor }
  }).sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())

  // Fetch upcoming events for the week
  const weekStart = toMDT(monday)
  const weekEnd   = toMDT(addDays(monday, 6))

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

  // Weekend events (Sat + Sun of the generated week)
  const satStr = toMDT(addDays(monday, 5))
  const sunStr = toMDT(addDays(monday, 6))
  const weekendSnaps = snaps.filter(e => e.date === satStr || e.date === sunStr)

  // Build suggestions
  const insertions: Record<string, unknown>[] = []

  // Image-based event templates (use event photo as hero)
  const IMAGE_TEMPLATES = ['poster', 'golden-hour', 'split', 'paper', 'dispatch'] as const

  for (const slot of slots) {
    let selected: EventSnap[] = []
    let strategyNotes = ''
    let templateId = slot.templateId   // may be overridden below

    switch (slot.postType) {
      case 'WeeklyFive': {
        // One diverse pick per day, sorted by score
        const seen = new Set<string>()
        const byDay = new Map<string, EventSnap[]>()
        for (const e of snaps) {
          if (!byDay.has(e.date)) byDay.set(e.date, [])
          byDay.get(e.date)!.push(e)
        }
        for (const [, dayEvents] of byDay) {
          const best = dayEvents[0]
          if (best && !seen.has(best.id)) {
            selected.push(best)
            seen.add(best.id)
          }
          if (selected.length >= 5) break
        }
        // Fill remaining from top events
        for (const e of snaps) {
          if (selected.length >= 5) break
          if (!seen.has(e.id)) { selected.push(e); seen.add(e.id) }
        }
        strategyNotes = 'Mon: weekly overview, diverse picks across the week for habitual check-in'
        break
      }
      case 'BreweryNights':
        selected = brewerySnaps.slice(0, 5)
        strategyNotes = 'Tue 5:30pm: after-work taproom crowd — brewery + live music is peak ABQ midweek engagement'
        break
      case 'WeekendDigest':
        selected = weekendSnaps.slice(0, 5)
        strategyNotes = 'Thu 5:30pm: weekend-planning peak — the moment people commit to weekend plans'
        break
      case 'SingleEvent': {
        // Best event on or near that day (score 8+), prefer events with photos
        const dayEvents = eventsOn(slot.dateStr)
        const high = dayEvents.filter(e => e.popularityScore >= 8)
        const withPhoto = (high.length > 0 ? high : dayEvents).filter(e => e.imageUrl)
        const any = (high.length > 0 ? high : dayEvents)
        selected = (withPhoto.length > 0 ? withPhoto : any).slice(0, 1)
        if (selected.length === 0) {
          // Fallback: best upcoming event with photo
          const withImg = snaps.filter(e => e.popularityScore >= 7 && e.imageUrl)
          selected = (withImg.length > 0 ? withImg : snaps.filter(e => e.popularityScore >= 7)).slice(0, 1)
        }

        // Choose image-based template when event has a photo, typographic otherwise
        const hasPhoto = !!selected[0]?.imageUrl
        if (hasPhoto) {
          // Rotate between poster, golden-hour, split based on category for variety
          const cat = selected[0]?.category ?? ''
          if (cat === 'Music' || cat === 'Festivals') templateId = 'poster'          // full bleed, dramatic
          else if (cat === 'Food & Drink' || cat === 'Community') templateId = 'golden-hour' // warm, inviting
          else templateId = 'split'   // photo top, clean info bottom
        } else {
          // No photo: use strong typographic template
          templateId = 'broadside'
        }

        strategyNotes = `Wed/Sat spotlight — ${hasPhoto ? `photo post (${templateId})` : 'type-only (no photo)'}, highest-score event for max shareability`
        break
      }
      case 'Tonight':
        selected = eventsOn(slot.dateStr).slice(0, 5)
        strategyNotes = 'Fri 4:30pm / Sun 4pm: "what\'s happening tonight?" peak intent scroll window'
        break
    }

    if (selected.length === 0) continue

    // Generate AI caption
    const caption = await generateCaption(slot.postType, selected)

    // For event templates (image-based), store single event ctx fields at top level too
    const isEventTemplate = IMAGE_TEMPLATES.includes(templateId as typeof IMAGE_TEMPLATES[number]) || templateId === 'broadside' || templateId === 'marquee'
    const extraEventCtx = isEventTemplate && selected[0] ? {
      event_ctx: {
        title:    selected[0].title,
        date:     selected[0].date,
        time:     selected[0].time,
        venue:    selected[0].venue,
        category: selected[0].category,
        imageUrl: selected[0].imageUrl,
      }
    } : {}

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
      ...extraEventCtx,
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
    weekStart,
    weekEnd,
  })
}
