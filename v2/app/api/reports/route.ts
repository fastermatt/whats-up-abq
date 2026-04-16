import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_TYPES = ['wrong_info', 'wrong_category', 'event_cancelled', 'duplicate', 'other', 'suggest_update']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, event_title, report_type, message, user_email } = body

    if (!event_id || !report_type || !VALID_TYPES.includes(report_type)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const supabase = await createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .schema('public')
      .from('event_reports')
      .insert({
        event_id: String(event_id).slice(0, 200),
        event_title: event_title ? String(event_title).slice(0, 200) : null,
        report_type,
        message: message ? String(message).slice(0, 2000) : null,
        user_email: user_email ? String(user_email).slice(0, 200) : null,
      })

    if (error) {
      console.error('[reports] Insert error:', error.message)
      return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
