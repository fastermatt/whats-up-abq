/**
 * GET /api/admin/ig/search?q=&time=tonight&category=Music&limit=12
 *
 * Admin-only event search for the IG editor. Supports:
 *   q         — text search on event title (optional; empty = browse mode)
 *   time      — today | tonight | tomorrow | this-weekend | this-week | upcoming (default)
 *   category  — exact top-level category (Music, Comedy, Sports, etc.)
 *   limit     — max results (default 12, max 30)
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
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

const VALID_TIME: TimeFilter[] = ['today', 'tonight', 'tomorrow', 'this-weekend', 'this-week', 'upcoming']

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const q         = url.searchParams.get('q')?.trim() ?? ''
  const timeParam = url.searchParams.get('time') ?? 'upcoming'
  const category  = url.searchParams.get('category')?.trim() ?? ''
  const limit     = Math.min(parseInt(url.searchParams.get('limit') ?? '12', 10), 30)

  const timeFilter: TimeFilter = VALID_TIME.includes(timeParam as TimeFilter)
    ? (timeParam as TimeFilter)
    : 'upcoming'

  const { gte, lte } = getTimeRange(timeFilter)

  const supabase = await createServiceClient()

  let query = supabase
    .from('events')
    .select('id, raw, event_date, venue_name, category, cached_photo_url')
    .eq('hidden', false)
    .gte('event_date', gte)
    .order('event_date', { ascending: true })
    .limit(limit)

  if (lte) query = query.lte('event_date', lte)
  if (category) query = query.eq('category', category)
  if (q) query = query.ilike('raw->>name', `%${q}%`)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: EventSearchResult[] = (data ?? []).map(row => ({
    id: row.id as string,
    title: (row.raw as Record<string, unknown>)?.name as string ?? '',
    date: row.event_date as string,
    venue: row.venue_name as string | null,
    category: row.category as string | null,
    imageUrl: row.cached_photo_url as string | null,
  }))

  return NextResponse.json(results)
}
