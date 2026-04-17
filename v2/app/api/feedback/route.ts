import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VALID_CATEGORIES = new Set([
  'event_report', 'event_idea', 'site_suggestion', 'bug_report', 'general',
])

/**
 * POST /api/feedback
 *
 * Writes to `public.feedback`. Works both logged-in and anonymously.
 *
 * Body: { category, subject?, message, event_id?, contact_email? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category, subject, message, event_id, contact_email } = body

    if (!category || !VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }
    if (!message?.trim() || message.trim().length < 3) {
      return NextResponse.json({ error: 'Please include a message' }, { status: 400 })
    }
    if (message.trim().length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 chars)' }, { status: 400 })
    }

    // Optional: link to logged-in user if present
    const authed = await createClient()
    const { data: { user } } = await authed.auth.getUser()

    const service = await createServiceClient()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const ua = request.headers.get('user-agent')?.slice(0, 500) ?? null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (service as any)
      .schema('public')
      .from('feedback')
      .insert({
        category,
        submitted_by:  user?.id ?? null,
        email:         user?.email ?? contact_email?.trim()?.slice(0, 200) ?? null,
        subject:       subject?.trim()?.slice(0, 200) || null,
        message:       message.trim(),
        event_id:      event_id || null,
        contact_email: contact_email?.trim()?.slice(0, 200) || null,
        submitter_ip:  ip,
        user_agent:    ua,
        status:        'new',
      })

    if (error) {
      console.error('[feedback] insert error', error)
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[feedback] server error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
