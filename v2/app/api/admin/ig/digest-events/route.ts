/**
 * GET /api/admin/ig/digest-events
 *
 * Returns a pool of top candidates for a given period plus a recommended
 * selection of 5 that maximises category variety.
 *
 * Query params:
 *   period  — 'tonight' | 'this-weekend' | 'this-week' (default: 'this-weekend')
 *   pool    — total candidates to return (default: 12, max: 20)
 *   picks   — how many events to recommend (default: 5, max: 8)
 *
 * Response:
 *   { period, start, end, events: DigestEvent[], recommended: string[] }
 *
 *   `events`      — full ranked pool (up to `pool` events)
 *   `recommended` — IDs of the diverse top picks the UI should pre-select
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DigestEvent {
  id: string
  title: string
  date: string        // YYYY-MM-DD
  time: string | null
  venue: string | null
  category: string | null
  imageUrl: string | null
  popularityScore: number
}

export interface DigestResponse {
  period: string
  start: string
  end: string
  events: DigestEvent[]
  recommended: string[]  // IDs of category-diverse top picks
}

type Period = 'tonight' | 'this-weekend' | 'this-week'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

function toMDT(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
}

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date()
  const todayMDT = toMDT(now)

  if (period === 'tonight') {
    return { start: todayMDT, end: todayMDT }
  }

  if (period === 'this-weekend') {
    const dayOfWeek = now.getDay()
    const daysToSat = (6 - dayOfWeek + 7) % 7 || 0
    const sat = new Date(now); sat.setDate(now.getDate() + daysToSat)
    const sun = new Date(sat); sun.setDate(sat.getDate() + 1)
    return { start: toMDT(sat), end: toMDT(sun) }
  }

  // this-week: today + 6 days
  const end = new Date(now); end.setDate(now.getDate() + 6)
  return { start: todayMDT, end: toMDT(end) }
}

function heuristicScore(row: Record<string, unknown>): number {
  const cat = String(row.category ?? '')
  const catScore: Record<string, number> = {
    'Festivals': 7.5, 'Music': 7.0, 'Arts & Theater': 6.5, 'Comedy': 6.5,
    'Food & Drink': 6.0, 'Outdoor': 5.5, 'Sports': 5.5,
    'Family': 5.0, 'Film': 4.5,
  }
  let s = catScore[cat] ?? 4.0
  const date = new Date(String(row.event_date ?? '') + 'T12:00:00')
  const dow = date.getDay()
  if (dow === 5 || dow === 6) s += 1.5
  else if (dow === 4) s += 0.8
  else if (dow === 0) s += 0.5
  if (row.cached_photo_url) s += 0.3
  if (row.featured === true) s += 1.5
  const src = String(row.source ?? '')
  if (src === 'ticketmaster' || src === 'seatgeek') s += 0.5
  return Math.min(10, Math.max(1, s))
}

/**
 * Diversity selection: walk the sorted list and pick the best event from
 * each category first, then fill remaining slots from whatever's left.
 * Result: at most 1 per category until we have `picks` events, then
 * continue filling from high-score events regardless of category if
 * there aren't enough distinct categories.
 */
function selectDiverse(
  events: DigestEvent[],
  picks: number,
): string[] {
  const seenCat = new Set<string>()
  const selected: string[] = []

  // First pass: one per category
  for (const e of events) {
    if (selected.length >= picks) break
    const cat = e.category ?? '__none__'
    if (!seenCat.has(cat)) {
      seenCat.add(cat)
      selected.push(e.id)
    }
  }

  // Second pass: fill remaining slots from top score (may repeat categories)
  if (selected.length < picks) {
    const selectedSet = new Set(selected)
    for (const e of events) {
      if (selected.length >= picks) break
      if (!selectedSet.has(e.id)) {
        selected.push(e.id)
        selectedSet.add(e.id)
      }
    }
  }

  return selected
}

interface EventRow {
  id: string
  raw: Record<string, unknown> | null
  event_date: string
  venue_name: string | null
  category: string | null
  cached_photo_url: string | null
  popularity_score: number | null
  featured: boolean | null
  source: string | null
}

function rowToDigestEvent(row: EventRow, score: number): DigestEvent {
  const raw  = row.raw ?? {}
  const dates = (raw as Record<string, Record<string, unknown>>).dates as
    | Record<string, Record<string, unknown>>
    | undefined
  const time =
    (dates?.start?.localTime as string | undefined) ??
    ((raw as Record<string, unknown>).time as string | undefined) ??
    null

  let formattedTime = time
  if (time && /^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    formattedTime = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  // raw.name (Ticketmaster/SeatGeek) | raw.title (local/volunteer/Eventbrite) | venue fallback
  const r = raw as Record<string, unknown>
  const title = String(r.name ?? r.title ?? '').trim() || (row.venue_name ?? '')

  return {
    id:              String(row.id),
    title,
    date:            String(row.event_date).slice(0, 10),
    time:            formattedTime,
    venue:           row.venue_name,
    category:        row.category,
    imageUrl:        row.cached_photo_url,
    popularityScore: Math.round(score * 10) / 10,
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url   = new URL(request.url)
  const period = (url.searchParams.get('period') ?? 'this-weekend') as Period
  const pool   = Math.min(Math.max(5, parseInt(url.searchParams.get('pool') ?? '12', 10)), 20)
  const picks  = Math.min(Math.max(1, parseInt(url.searchParams.get('picks') ?? '5', 10)), 8)

  if (!['tonight', 'this-weekend', 'this-week'].includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  const { start, end } = getDateRange(period)

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, raw, event_date, venue_name, category, cached_photo_url, popularity_score, featured, source')
    .eq('hidden', false)
    .gte('event_date', start)
    .lte('event_date', end + 'T23:59:59')
    .order('event_date', { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data as EventRow[]) ?? []

  // Score and sort descending
  const scored = rows
    .map(row => ({
      row,
      score: row.popularity_score ?? heuristicScore(row as unknown as Record<string, unknown>),
    }))
    .sort((a, b) => b.score - a.score)

  // Build the pool of candidates
  const events: DigestEvent[] = scored.slice(0, pool).map(({ row, score }) =>
    rowToDigestEvent(row, score)
  )

  // Recommend diverse picks from the full sorted pool (not just the sliced pool)
  const allEvents: DigestEvent[] = scored.map(({ row, score }) => rowToDigestEvent(row, score))
  const recommended = selectDiverse(allEvents, picks)

  const body: DigestResponse = { period, start, end, events, recommended }
  return NextResponse.json(body)
}
