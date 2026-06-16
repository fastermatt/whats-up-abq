/**
 * GET /api/admin/ig/week-events
 *
 * Returns the top-rated event for each of the next 7 days, intended for
 * the week-at-a-time scheduler at /admin/ig/week.
 *
 * Query params:
 *   start    — ISO date (YYYY-MM-DD). Defaults to today.
 *   per_day  — events per day (default 1, max 3)
 *
 * Response: array of { date: 'YYYY-MM-DD', events: WeekEvent[] }
 *   WeekEvent extends EventSearchResult with verified enrichment for captions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface WeekEvent {
  id: string
  title: string
  date: string                  // YYYY-MM-DD
  time: string | null
  venue: string | null
  category: string | null
  imageUrl: string | null
  popularityScore: number | null
  rank: number
  about: string | null          // ai_enrichment.about (used for caption pre-fill)
  highlights: string[]
  venueTips: string | null
  localRec: string | null
  nearbyDining: { name: string; note?: string }[]
  price: string | null
  featured: boolean
}

export interface WeekDay {
  date: string                  // YYYY-MM-DD
  weekday: string               // 'Mon' / 'Tue' / etc
  events: WeekEvent[]
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
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

function weekdayShort(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Denver' })
}

function plusDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cleanHighlights(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(cleanString)
    .filter((item): item is string => Boolean(item))
    .slice(0, 2)
}

function cleanNearbyDining(value: unknown): { name: string; note?: string }[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const rec = item as Record<string, unknown>
      const name = cleanString(rec.name)
      if (!name) return null
      const note = cleanString(rec.note)
      return note ? { name, note } : { name }
    })
    .filter((item): item is { name: string; note?: string } => Boolean(item))
    .slice(0, 2)
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
  ai_enrichment: Record<string, unknown> | null
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url       = new URL(request.url)
  const startStr  = url.searchParams.get('start')?.trim()
  const perDayRaw = parseInt(url.searchParams.get('per_day') ?? '1', 10)
  const perDay    = Math.min(Math.max(1, perDayRaw), 3)

  const today    = new Date().toISOString().slice(0, 10)
  const start    = startStr && /^\d{4}-\d{2}-\d{2}$/.test(startStr) ? startStr : today
  const end      = plusDays(start, 6)

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, raw, event_date, venue_name, category, cached_photo_url, popularity_score, featured, source, ai_enrichment')
    .eq('hidden', false)
    .gte('event_date', start)
    .lte('event_date', end)
    .order('event_date', { ascending: true })
    .limit(400)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by date, score, take top N per day.
  const byDay = new Map<string, EventRow[]>()
  for (const row of (data as EventRow[]) ?? []) {
    const day = String(row.event_date).slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(row)
  }

  const days: WeekDay[] = []
  for (let i = 0; i < 7; i += 1) {
    const date = plusDays(start, i)
    const rows = byDay.get(date) ?? []
    const scored = rows.map(row => ({
      row,
      score: row.popularity_score ?? heuristicScore(row as unknown as Record<string, unknown>),
    }))
    scored.sort((a, b) => b.score - a.score)

    const events: WeekEvent[] = scored.slice(0, perDay).map(({ row, score }, idx) => {
      const raw = row.raw ?? {}
      const ai  = row.ai_enrichment ?? {}
      const dates = (raw as Record<string, Record<string, unknown>>).dates as
        | Record<string, Record<string, unknown>>
        | undefined
      const time =
        (dates?.start?.localTime as string | undefined) ??
        ((raw as Record<string, unknown>).time as string | undefined) ??
        null
      const price = (raw as Record<string, unknown>).price as string | null ?? null

      return {
        id:              String(row.id),
        title:           String((raw as Record<string, unknown>).name ?? ''),
        date:            String(row.event_date).slice(0, 10),
        time:            time ?? null,
        venue:           row.venue_name,
        category:        row.category,
        imageUrl:        row.cached_photo_url,
        popularityScore: Math.round(score * 10) / 10,
        rank:            idx + 1,
        about:           cleanString((ai as Record<string, unknown>).about),
        highlights:      cleanHighlights((ai as Record<string, unknown>).highlights),
        venueTips:       cleanString((ai as Record<string, unknown>).venue_tips),
        localRec:        cleanString((ai as Record<string, unknown>).local_rec),
        nearbyDining:    cleanNearbyDining((ai as Record<string, unknown>).nearby_dining),
        price,
        featured:        row.featured === true,
      }
    })

    days.push({ date, weekday: weekdayShort(date), events })
  }

  return NextResponse.json(days)
}
