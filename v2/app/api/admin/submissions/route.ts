import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/submissions
 *
 * Admin action on an event submission. Requires the admin_token cookie.
 *
 * Body: { id, action: 'approve'|'reject'|'needs_info', notes? }
 *
 * On 'approve':
 *   - Insert a new row in public.events with source='community'
 *   - Update event_submissions.status='approved', published_event_id=<new id>
 *   - Increment profiles.events_approved for the submitter
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, action, notes } = await request.json()

  if (!id || !['approve', 'reject', 'needs_info'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sub, error: fetchErr } = await (supabase as any)
    .schema('public').from('event_submissions')
    .select('*').eq('id', id).single()

  if (fetchErr || !sub) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  // ── REJECT or NEEDS_INFO — just flip status ──
  if (action !== 'approve') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .schema('public').from('event_submissions')
      .update({
        status:         action === 'reject' ? 'rejected' : 'needs_info',
        reviewer_notes: notes || null,
        reviewed_at:    new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── APPROVE — promote into public.events ──

  // Generate event id (community prefix + short nanoid-ish)
  const shortId = Math.random().toString(36).slice(2, 10)
  const eventId = `submitted_${shortId}`

  // Build a `raw` JSON blob in the format normalizeLocal() in lib/events.ts expects:
  // - title/name for the event title
  // - dates.start.localDate/localTime for time (same as TM-compat local format)
  // - venue_name (string) + address (string) — NOT nested venue object
  // - url for ticket URL
  // - isFree boolean
  // - priceRanges array for price display
  const rawBlob = {
    title:       sub.title,
    name:        sub.title,
    description: sub.description,
    url:         sub.ticket_url,
    venue_name:  sub.venue_name,
    address:     sub.venue_address,
    isFree:      sub.is_free,
    // Price in TM-compat priceRanges format so normalizeLocal() renders it
    priceRanges: (sub.price_min_cents !== null || sub.price_max_cents !== null) ? [{
      min: (sub.price_min_cents ?? sub.price_max_cents ?? 0) / 100,
      max: (sub.price_max_cents ?? sub.price_min_cents ?? 0) / 100,
    }] : [],
    // Time in TM-compat dates.start format
    dates: sub.start_time ? {
      start: { localDate: sub.event_date, localTime: sub.start_time },
    } : null,
  }

  // Insert into public.events with source='submitted' (matches DB constraint)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabase as any)
    .schema('public').from('events')
    .insert({
      id:                eventId,
      source:            'submitted',
      event_date:        sub.event_date,
      venue_name:        sub.venue_name,
      category:          sub.category,
      neighborhood_slug: sub.neighborhood_slug,
      cached_photo_url:  sub.photo_url,
      submitted_by:      sub.submitted_by,
      hidden:            false,
      featured:          false,
      raw:               rawBlob,
    })

  if (insertErr) {
    return NextResponse.json({ error: `Failed to publish: ${insertErr.message}` }, { status: 500 })
  }

  // Mark the submission approved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .schema('public').from('event_submissions')
    .update({
      status:             'approved',
      reviewer_notes:     notes || null,
      reviewed_at:        new Date().toISOString(),
      published_event_id: eventId,
    })
    .eq('id', id)

  // Bump submitter's approved counter (best-effort). events_approved/trust_score
  // live on PROFILES, not on the submission row — read the profile, then increment.
  if (sub.submitted_by) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prof } = await (supabase as any)
      .schema('public').from('profiles')
      .select('events_approved, trust_score')
      .eq('id', sub.submitted_by)
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .schema('public').from('profiles')
      .update({
        events_approved: (prof?.events_approved ?? 0) + 1,
        trust_score:     (prof?.trust_score ?? 0) + 1,
      })
      .eq('id', sub.submitted_by)
      .then(() => {}, () => {})
  }

  return NextResponse.json({ success: true, event_id: eventId })
}
