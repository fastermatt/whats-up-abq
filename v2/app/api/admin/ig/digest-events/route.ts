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
  const pool   = Math.min(Math.max(5, parseInt(url.searchParams.get('pool') ?? '12', 10)), 20)
  const picks  = Math.min(Math.max(1, parseInt(url.searchParams.get('picks') ?? '5', 10)), 8)

  // Accept explicit start+end dates OR fall back to period preset
  const startParam = url.searchParams.get('start')
  const endParam   = url.searchParams.get('end')
  let start: string, end: string, period: string

  if (startParam && endParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startParam) || !/^\d{4}-\d{2}-\d{2}$/.test(endParam)) {
      return NextResponse.json({ error: 'start/end must be YYYY-MM-DD' }, { status: 400 })
    }
    start  = startParam
    end    = endParam
    period = start === end ? 'tonight' : 'custom'
  } else {
    const p = (url.searchParams.get('period') ?? 'this-weekend') as Period
    if (!['tonight', 'this-weekend', 'this-week'].includes(p)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
    }
    const range = getDateRange(p)
    start  = range.start
    end    = range.end
    period = p
  }

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

  // Score
  const scored = rows.map(row => ({
    row,
    score: row.popularity_score ?? heuristicScore(row as unknown as Record<string, unknown>),
  }))

  // Deduplicate: same event from multiple sources (TM + SeatGeek often both list the same show)
  // Strategy: match on (date, venue, first-2-words-of-title). This catches:
  //   "Joe Jackson" (SeatGeek) vs "Joe Jackson + Band – Hope and Fury Tour" (TM)
  //   "John Mulaney" (SeatGeek) vs "John Mulaney: Mister Whatever" (TM)
  //   "NM United vs Phoenix" (SeatGeek) vs "USL Cup: NM United vs Phoenix" (TM)
  // Second pass: if venue is the same and either title contains the other → merge.
  function titleKey(raw: Record<string, unknown> | null): string {
    const r = raw ?? {}
    const t = String((r as Record<string, unknown>).name ?? (r as Record<string, unknown>).title ?? '')
    // Use first 2 words — catches "Joe Jackson" matching "Joe Jackson + Band..."
    return t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).join(' ')
  }
  function venueKey(v: string | null): string {
    return (v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  }

  const deduped = new Map<string, typeof scored[number]>()
  for (const item of scored) {
    const date    = item.row.event_date?.toString().slice(0, 10) ?? ''
    const vkey    = venueKey(item.row.venue_name)
    const tkey    = titleKey(item.row.raw)
    const key     = `${date}|${vkey}|${tkey}`
    const existing = deduped.get(key)
    if (!existing || item.score > existing.score) {
      deduped.set(key, item)
    }
  }

  // Second-pass dedup: same date+venue, and one artist name fully contains the other
  // Catches "NM United vs Phoenix" vs "USL Cup: NM United vs Phoenix" (different first 2 words)
  function artistCore(raw: Record<string, unknown> | null): string {
    const r = raw ?? {}
    const t = String((r as Record<string, unknown>).name ?? (r as Record<string, unknown>).title ?? '')
    return t.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 5).join(' ')
  }
  const deduped2 = new Map<string, typeof scored[number]>()
  for (const item of [...deduped.values()]) {
    const date = item.row.event_date?.toString().slice(0, 10) ?? ''
    const vkey = venueKey(item.row.venue_name)
    const core = artistCore(item.row.raw)
    let merged = false
    for (const [k2, existing] of deduped2) {
      const [d2, v2] = k2.split('|')
      if (d2 !== date || v2 !== vkey) continue
      const core2 = artistCore(existing.row.raw)
      // If one title contains the other as a substring → same event
      if (core.includes(core2) || core2.includes(core)) {
        if (item.score > existing.score) deduped2.set(k2, item)
        merged = true
        break
      }
    }
    if (!merged) deduped2.set(`${date}|${vkey}|${core}`, item)
  }

  // Sort deduplicated results descending by score
  const dedupedSorted = [...deduped2.values()].sort((a, b) => b.score - a.score)

  // Build the pool of candidates from deduplicated results
  const events: DigestEvent[] = dedupedSorted.slice(0, pool).map(({ row, score }) =>
    rowToDigestEvent(row, score)
  )

  // Recommend diverse picks from within the pool only — so all recommended IDs
  // exist in the pool the client receives (prevents ghost selections that block picking)
  const recommended = selectDiverse(events, picks)

  const body: DigestResponse = { period, start, end, events, recommended }
  return NextResponse.json(body)
}
