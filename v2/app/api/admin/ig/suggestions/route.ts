/**
 * GET /api/admin/ig/suggestions
 * Returns all pending + recently reviewed suggestions, newest generation first.
 *
 * Query params:
 *   status   — filter by status (default: all)
 *   limit    — max rows (default: 50)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.cookies.get('admin_token')?.value === secret
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url    = new URL(req.url)
  const status = url.searchParams.get('status')
  const limit  = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50', 10))

  const supabase = await createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .schema('public')
    .from('ig_post_suggestions')
    .select('id, created_at, post_type, template_id, event_ids, event_data, caption, scheduled_for, status, rejection_reason, caption_edited, strategy_notes, generation_id, image_data_url')
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stats
  const { data: stats } = await (supabase as any)
    .schema('public')
    .from('ig_post_suggestions')
    .select('status')
    .gte('created_at', new Date(Date.now() - 14 * 86400 * 1000).toISOString())

  const counts = (stats ?? []).reduce(
    (acc: Record<string, number>, row: { status: string }) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    },
    {}
  )

  return NextResponse.json({ suggestions: data ?? [], stats: counts })
}
