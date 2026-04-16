import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title, description, venue, address, event_date, event_time,
      ticket_url, price, category, contact_name, contact_email,
    } = body

    if (!title?.trim() || !event_date) {
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
    }

    if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .schema('public')
      .from('event_reports')
      .insert({
        event_id: 'submission_new',
        type: 'event_submission',
        details: JSON.stringify({
          title: title.trim(),
          description: description?.trim() || null,
          venue: venue?.trim() || null,
          address: address?.trim() || null,
          event_date,
          event_time: event_time?.trim() || null,
          ticket_url: ticket_url?.trim() || null,
          price: price?.trim() || null,
          category: category || null,
          contact_name: contact_name?.trim() || null,
          contact_email: contact_email?.trim() || null,
        }),
        status: 'pending',
      })

    if (error) {
      console.error('Submit error:', error)
      return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Submit error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
