import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Fire-and-forget admin notification via Resend
export const dynamic = 'force-dynamic'

interface SubmissionNotice {
  title: string
  submittedBy: string
  submissionId: string
  eventDate: string
  venueName: string
  category: string
  isFree: boolean
  description: string
}

async function notifyAdmin(s: SubmissionNotice) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  const price = s.isFree ? '🆓 Free' : '💰 Ticketed'
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: 'ABQ Unplugged <noreply@abqunplugged.com>',
        to: ['4mattcarlson@gmail.com'],
        subject: `🎉 New submission: ${s.title}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 16px;color:#9a442d">New Event Submission</h2>
            <table style="width:100%;border-collapse:collapse;font-size:15px">
              <tr><td style="padding:6px 0;color:#666;width:110px">Event</td><td style="padding:6px 0"><strong>${s.title}</strong></td></tr>
              <tr><td style="padding:6px 0;color:#666">Date</td><td style="padding:6px 0">${s.eventDate}</td></tr>
              <tr><td style="padding:6px 0;color:#666">Venue</td><td style="padding:6px 0">${s.venueName}</td></tr>
              <tr><td style="padding:6px 0;color:#666">Category</td><td style="padding:6px 0">${s.category}</td></tr>
              <tr><td style="padding:6px 0;color:#666">Price</td><td style="padding:6px 0">${price}</td></tr>
              <tr><td style="padding:6px 0;color:#666">Submitter</td><td style="padding:6px 0">${s.submittedBy}</td></tr>
            </table>
            <p style="margin:16px 0;padding:12px;background:#f5f5f5;border-radius:6px;font-size:14px;color:#333">${s.description.slice(0, 400)}${s.description.length > 400 ? '…' : ''}</p>
            <a href="https://abqunplugged.com/admin/submissions" style="display:inline-block;padding:10px 20px;background:#9a442d;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Review in admin →</a>
          </div>
        `,
      }),
    })
  } catch { /* ignore — notification is best-effort */ }
}

/**
 * POST /api/submit
 *
 * Writes to `public.event_submissions`. Requires a logged-in Supabase Auth user.
 * Enforces a 3-submissions-per-day rate limit per user.
 *
 * Body (JSON):
 *   title, description, venue_name, venue_address, event_date, start_time,
 *   end_time, category, neighborhood_slug, photo_url (already uploaded),
 *   ticket_url, price_min_cents, price_max_cents, is_free
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth ──
    const authed = await createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    // ── Rate limit: 3 per day ──
    const service = await createServiceClient()
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (service as any)
      .schema('public')
      .from('event_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', user.id)
      .gte('created_at', dayAgo)
    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'You\'ve reached the daily limit of 3 event submissions. Try again tomorrow.' },
        { status: 429 },
      )
    }

    // ── Body ──
    const body = await request.json()
    const {
      title, description, venue_name, venue_address,
      event_date, start_time, end_time,
      category, neighborhood_slug, photo_url,
      ticket_url, price_min_cents, price_max_cents, is_free,
    } = body

    // ── Server-side validation — mirrors client rules, can't be bypassed ──
    const VALID_CATEGORIES = [
      'Music', 'Sports', 'Arts & Theater', 'Comedy', 'Family',
      'Food & Drink', 'Film', 'Community', 'Festivals', 'Outdoor',
    ]

    if (!title?.trim() || title.trim().length > 200)
      return NextResponse.json({ error: 'Event name is required (max 200 chars)' }, { status: 400 })

    if (!description?.trim() || description.trim().length < 30)
      return NextResponse.json({ error: 'Description must be at least 30 characters' }, { status: 400 })

    if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date))
      return NextResponse.json({ error: 'Event date is required (YYYY-MM-DD)' }, { status: 400 })

    // Date must be today or future
    if (event_date < new Date().toISOString().slice(0, 10))
      return NextResponse.json({ error: 'Event date must be today or in the future' }, { status: 400 })

    if (!start_time)
      return NextResponse.json({ error: 'Start time is required' }, { status: 400 })

    if (!category || !VALID_CATEGORIES.includes(category))
      return NextResponse.json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })

    if (!venue_name?.trim() || venue_name.trim().length > 200)
      return NextResponse.json({ error: 'Venue name is required (max 200 chars)' }, { status: 400 })

    if (!venue_address?.trim())
      return NextResponse.json({ error: 'Venue address is required' }, { status: 400 })

    // ── Greater Albuquerque metro guard ──
    // Belt + suspenders: ingestion scripts (TM 40-mi radius, SG city=ABQ,
    // EB bbox + zip allowlist) keep commercial sources clean. Community
    // submissions are the one path where bad geo can enter, so reject any
    // address that explicitly names an out-of-metro NM city. Allowlist of
    // metro cities means anything else triggers a soft warning that the
    // venue must be in the ABQ metro.
    const lowerAddr = venue_address.toLowerCase()
    const NON_METRO = [
      'santa fe', 'taos', 'las cruces', 'roswell', 'farmington', 'gallup',
      'silver city', 'los alamos', 'raton', 'carlsbad', 'hobbs',
      'alamogordo', 'deming', 'grants', 'espanola', 'truth or consequences',
      'ruidoso', 'angel fire', 'red river', 'chama',
    ]
    const offending = NON_METRO.find(c => lowerAddr.includes(c))
    if (offending) {
      return NextResponse.json({
        error: `ABQ Unplugged covers the greater Albuquerque metro only. The address looks like ${offending.replace(/\b\w/g, l => l.toUpperCase())} — please submit only events in Albuquerque, Rio Rancho, Bernalillo, Corrales, Los Lunas, Belen, the East Mountains, or surrounding metro areas.`,
      }, { status: 400 })
    }

    if (!photo_url)
      return NextResponse.json({ error: 'An event photo is required' }, { status: 400 })

    if (!is_free && !ticket_url?.trim())
      return NextResponse.json({ error: 'Provide a ticket URL or mark the event as free' }, { status: 400 })

    // ── Metadata for fraud review ──
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const ua = request.headers.get('user-agent')?.slice(0, 500) ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (service as any)
      .schema('public')
      .from('event_submissions')
      .insert({
        submitted_by:      user.id,
        title:             title.trim(),
        description:       description?.trim()?.slice(0, 2000) || null,
        event_date,
        start_time:        start_time || null,
        end_time:          end_time   || null,
        venue_name:        venue_name.trim(),
        venue_address:     venue_address?.trim()?.slice(0, 300) || null,
        category:          category || null,
        neighborhood_slug: neighborhood_slug || null,
        photo_url:         photo_url || null,
        ticket_url:        ticket_url?.trim()?.slice(0, 500) || null,
        price_min_cents:   typeof price_min_cents === 'number' ? price_min_cents : null,
        price_max_cents:   typeof price_max_cents === 'number' ? price_max_cents : null,
        is_free:           !!is_free,
        status:            'pending',
        submitter_ip:      ip,
        user_agent:        ua,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[submit] insert error', error)
      return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 })
    }

    // Bump submitter's count on their profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any)
      .schema('public')
      .rpc('increment_profile_counter', { p_user_id: user.id, p_column: 'events_submitted' })
      .then(() => {}, () => {}) // ignore if RPC doesn't exist

    // Notify admin — fire and forget, never blocks the response
    notifyAdmin({
      title:        title.trim(),
      submittedBy:  user.email ?? user.id,
      submissionId: data?.id ?? '?',
      eventDate:    event_date,
      venueName:    venue_name.trim(),
      category:     category ?? '',
      isFree:       !!is_free,
      description:  description?.trim() ?? '',
    })

    return NextResponse.json({ success: true, id: data?.id })
  } catch (e) {
    console.error('[submit] server error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
