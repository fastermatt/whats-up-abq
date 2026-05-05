/**
 * GET /api/admin/ig/search?q=wilco&limit=8
 * Searches upcoming, visible events by title for the IG editor event picker.
 * Returns a minimal shape: id, title, date, venue, category, imageUrl.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

export interface EventSearchResult {
  id: string
  title: string
  date: string
  venue: string | null
  category: string | null
  imageUrl: string | null
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 30)

  if (!q) {
    return NextResponse.json([] as EventSearchResult[])
  }

  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('events')
    .select('id, raw, event_date, venue_name, category, cached_photo_url')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .ilike('raw->>name', `%${q}%`)
    .order('event_date', { ascending: true })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

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
