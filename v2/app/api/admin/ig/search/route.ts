/**
 * GET /api/admin/ig/search
 *
 * Admin-only event search for the IG editor.
 *
 * Normal mode params:
 *   q         — text search on event title (optional; empty = browse)
 *   time      — today | tonight | tomorrow | this-weekend | this-week | upcoming
 *   category  — exact top-level category filter
 *   limit     — max results (default 16, max 30)
 *
 * Top-picks mode:
 *   mode=top-picks   — returns top 3 events per day for the next 14 days,
 *                      ranked by popularity_score (or heuristic fallback).
 *                      Response includes `popularityScore` and `rank` fields.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getTimeRange, type TimeFilter } from '@/lib/utils/dates'

export const dynamic = 'force-dynamic'

export interface EventSearchResult {
  id: string
  title: string
  date: string
  venue: string | null
  category: string | null
  imageUrl: string | null
  popularityScore?: number | null
  rank?: number
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

const VALID_TIME: TimeFilter[] = ['today', 'tonight', 'tomorrow', 'this-weekend', 'this-week', 'upcoming']

// SQL expression for heuristic score when popularity_score is NULL.
// Used as fallback so top-picks works before scoring script has run.
const HEURISTIC_SQL = `(
  CASE category
    WHEN 'Festivals'      THEN 7.5
    WHEN 'Music'          THEN 7.0
    WHEN 'Arts & Theater' THEN 6.5
    WHEN 'Comedy'         THEN 6.5
    WHEN 'Food & Drink'   THEN 6.0
    WHEN 'Outdoor'        THEN 5.5
    WHEN 'Sports'         THEN 5.5
    WHEN 'Family'         THEN 5.0
    WHEN 'Film'           THEN 4.5
    ELSE 4.0
  END
  -- Weekend bonus
  + CASE EXTRACT(DOW FROM event_date::date)
      WHEN 5 THEN 1.5
      WHEN 6 THEN 1.5
      WHEN 4 THEN 0.8
      WHEN 0 THEN 0.5
      ELSE 0
    END
  -- Evening time bonus
  + CASE WHEN raw->>'time' IS NOT NULL AND (raw->>'time') >= '17:00' THEN 0.5 ELSE 0 END
  -- Has photo
  + CASE WHEN cached_photo_url IS NOT NULL THEN 0.3 ELSE 0 END
  -- Featured
  + CASE WHEN featured = true THEN 1.5 ELSE 0 END
  -- Ticketed sources tend to be bigger productions
  + CASE WHEN source IN ('ticketmaster', 'seatgeek') THEN 0.5 ELSE 0 END
)`

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url  = new URL(request.url)
  const mode = url.searchParams.get('mode')

  const supabase = await createServiceClient()

  // ── Top-picks mode: top 3 per day, next 14 days ─────────────────────────
  if (mode === 'top-picks') {
    const today   = new Date().toISOString().slice(0, 10)
    const endDate = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)

    const { data, error } = await supabase.rpc('top_picks_per_day', {
      p_start: today,
      p_end:   endDate,
      p_per_day: 3,
    })

    if (error) {
      // RPC may not exist yet — fall back to raw SQL via a regular query
      // (Supabase JS doesn't support window functions directly, so we do a
      //  best-effort flat query and slice in JS)
      const { data: flat, error: flatErr } = await supabase
        .from('events')
        .select('id, raw, event_date, venue_name, category, cached_photo_url, popularity_score, featured, source')
        .eq('hidden', false)
        .gte('event_date', today)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true })
        .limit(200)

      if (flatErr) return NextResponse.json({ error: flatErr.message }, { status: 500 })

      // Score and group in JS
      const scored = (flat ?? []).map(row => {
        const score = (row.popularity_score as number | null) ??
          heuristicScore(row as Record<string, unknown>)
        return { ...row, _score: score }
      })

      // Group by date, take top 3 per day
      const byDay = new Map<string, typeof scored>()
      for (const row of scored) {
        const day = String(row.event_date).slice(0, 10)
        if (!byDay.has(day)) byDay.set(day, [])
        byDay.get(day)!.push(row)
      }

      const results: EventSearchResult[] = []
      for (const [, dayEvents] of byDay) {
        dayEvents.sort((a, b) => b._score - a._score)
        dayEvents.slice(0, 3).forEach((row, idx) => {
          results.push(toResult(row as Record<string, unknown>, row._score, idx + 1))
        })
      }

      return NextResponse.json(results)
    }

    // RPC success
    const results: EventSearchResult[] = (data ?? []).map((row: Record<string, unknown>) =>
      toResult(row, row.effective_score as number, row.rn as number)
    )
    return NextResponse.json(results)
  }

  // ── Normal search mode ───────────────────────────────────────────────────
  const q         = url.searchParams.get('q')?.trim() ?? ''
  const timeParam = url.searchParams.get('time') ?? 'upcoming'
  const category  = url.searchParams.get('category')?.trim() ?? ''
  const limit     = Math.min(parseInt(url.searchParams.get('limit') ?? '16', 10), 30)

  const timeFilter: TimeFilter = VALID_TIME.includes(timeParam as TimeFilter)
    ? (timeParam as TimeFilter)
    : 'upcoming'

  const { gte, lte } = getTimeRange(timeFilter)

  let query = supabase
    .from('events')
    .select('id, raw, event_date, venue_name, category, cached_photo_url, popularity_score')
    .eq('hidden', false)
    .gte('event_date', gte)
    .order('event_date', { ascending: true })
    .limit(limit)

  if (lte) query = query.lte('event_date', lte)
  if (category) query = query.eq('category', category)
  if (q) query = query.ilike('raw->>name', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: EventSearchResult[] = (data ?? []).map(row => toResult(row as Record<string, unknown>))
  return NextResponse.json(results)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toResult(
  row: Record<string, unknown>,
  score?: number,
  rank?: number,
): EventSearchResult {
  const raw = row.raw as Record<string, unknown> | null
  return {
    id:              String(row.id ?? ''),
    title:           String(raw?.name ?? raw?.title ?? ''),
    date:            String(row.event_date ?? ''),
    venue:           (row.venue_name as string | null) ?? null,
    category:        (row.category as string | null) ?? null,
    imageUrl:        (row.cached_photo_url as string | null) ?? null,
    popularityScore: score != null ? Math.round(score * 10) / 10 : (row.popularity_score as number | null),
    rank,
  }
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

  const raw = row.raw as Record<string, Record<string, unknown>> | null
  const dates = raw?.dates as Record<string, Record<string, unknown>> | undefined
  const time = String(dates?.start?.localTime ?? raw?.time ?? '')
  if (time && time >= '17:00') s += 0.5

  if (row.cached_photo_url) s += 0.3
  if (row.featured === true) s += 1.5
  const src = String(row.source ?? '')
  if (src === 'ticketmaster' || src === 'seatgeek') s += 0.5

  return Math.min(10, Math.max(1, s))
}

// Suppress unused import warning — HEURISTIC_SQL is for future RPC use
void HEURISTIC_SQL
