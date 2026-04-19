/**
 * Admin: reject/verify/restore an event's image.
 *
 * Why this exists:
 *   Third-party sources (TM, SG, EB) sometimes associate the wrong image with
 *   an event. We can't fix their data, but we can flag it as rejected so every
 *   render path in the app falls back to the category fallback image.
 *   This is the single chokepoint — setting image_status='rejected' neutralizes
 *   cached_photo_url, raw.image, and raw.images[] in one shot.
 *
 * Usage:
 *   POST /api/admin/reject-image
 *     body: { id: string, status: 'rejected' | 'verified' | 'unverified' }
 *
 *   'rejected'    → imageUrl forced to null by normalizeRow → category fallback
 *   'verified'    → admin confirmed image matches event (metadata only)
 *   'unverified'  → default, trust the source
 *
 * Also clears cached_photo_url on 'rejected' so stale third-party URLs don't
 * regress if the status is ever flipped back.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['unverified', 'verified', 'rejected'] as const
type ImageStatus = typeof VALID_STATUSES[number]

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const token = request.cookies.get('admin_token')?.value
  return token === secret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: unknown; status?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : null
  const status = typeof body.status === 'string' ? body.status as ImageStatus : null

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const supabase = await createServiceClient()

  const updates: Record<string, unknown> = { image_status: status }

  // On reject: also null cached_photo_url. This guarantees the normalizer falls
  // to the raw.image path; combined with image_status='rejected' (which forces
  // imageUrl=null in normalizeRow), the event gets the category fallback.
  if (status === 'rejected') {
    updates.cached_photo_url = null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .schema('public')
    .from('events')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id, status })
}
