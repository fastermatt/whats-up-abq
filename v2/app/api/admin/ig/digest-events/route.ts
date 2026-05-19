/**
 * GET /api/admin/ig/digest-events
 *
 * Returns the top N events for a given time period, ranked by popularity
 * score (or heuristic if score is absent). Used to auto-populate the
 * digest IG templates (weekend-digest, tonight-list, weekly-five).
 *
 * Query params:
 *   period  — 'tonight' | 'this-weekend' | 'this-week' (default: 'this-weekend')
 *   limit   — number of events to return (default: 5, max: 10)
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

type Period = 'tonight' | 'this-weekend' | 'this-week'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

function toMDT(d: Date): string {
  // Return YYYY-MM-DD in America/Denver
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
}

function getDateRange(period: Period): { start: string; end: string } {
  const now = new Date()
  const todayMDT = toMDT(now)

  if (period === 'tonight') {
    return { start: todayMDT, end: todayMDT }
  }

  if (period === 'this-weekend') {
    // Sat + Sun of the current week (or next weekend if today is Mon–Thu)
    const dayOfWeek = now.getDay() // 0=Sun, 6=Sat
    let daysToSat = (6 - dayOfWeek + 7) % 7
    if (daysToSat === 0) daysToSat = 0 // today IS Saturday
    const sat = new Date(now)
    sat.setDate(now.getDate() + daysToSat)
    const sun = new Date(sat)
    sun.setDate(sat.getDate() + 1)
    return { start: toMDT(sat), end: toMDT(sun) }
  }

  // this-week: today through 6 days out
  const end = new Date(now)
  end.setDate(now.getDate() + 6)
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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const period  = (url.searchParams.get('period') ?? 'this-weekend') as Period
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '5', 10)
  const limit    = Math.min(Math.max(1, limitRaw), 10)

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

  // Score and sort
  const scored = rows.map(row => {
    const score = row.popularity_score ?? heuristicScore(row as unknown as Record<string, unknown>)
    return { row, score }
  })
  scored.sort((a, b) => b.score - a.score)

  const events: DigestEvent[] = scored.slice(0, limit).map(({ row, score }) => {
    const raw  = row.raw ?? {}
    const dates = (raw as Record<string, Record<string, unknown>>).dates as
      | Record<string, Record<string, unknown>>
      | undefined
    const time =
      (dates?.start?.localTime as string | undefined) ??
      ((raw as Record<string, unknown>).time as string | undefined) ??
      null

    // Format time to "7:00 PM" style if it's HH:MM:SS
    let formattedTime = time
    if (time && /^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
      const [h, m] = time.split(':').map(Number)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const h12  = h % 12 || 12
      formattedTime = `${h12}:${String(m).padStart(2, '0')} ${ampm}`
    }

    return {
      id:             String(row.id),
      title:          String((raw as Record<string, unknown>).name ?? ''),
      date:           String(row.event_date).slice(0, 10),
      time:           formattedTime,
      venue:          row.venue_name,
      category:       row.category,
      imageUrl:       row.cached_photo_url,
      popularityScore: Math.round(score * 10) / 10,
    }
  })

  return NextResponse.json({ period, start, end, events })
}
