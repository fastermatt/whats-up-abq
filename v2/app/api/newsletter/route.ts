import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PUBLICATION_ID = 'pub_ad8d3710-77c3-4bda-947b-18a1497ccbc6'

function safeAnalyticsId(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 8 && value.length <= 100
    ? value
    : null
}

export async function POST(req: NextRequest) {
  const { email, analytics, source } = await req.json().catch(() => ({}))

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const apiKey = process.env.BEEHIIV_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Newsletter not configured' }, { status: 503 })
  }

  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: 'abqunplugged.com',
        utm_medium: 'website',
      }),
    }
  )

  if (res.ok) {
    const visitorId = safeAnalyticsId(analytics?.visitor_id)
    const sessionId = safeAnalyticsId(analytics?.session_id)
    if (visitorId && sessionId) {
      const supabase = createServiceClient()
      const { error } = await supabase.from('analytics').insert({
        event_type: 'newsletter_signup',
        visitor_id: visitorId,
        session_id: sessionId,
        device: null,
        data: {
          source: typeof source === 'string' ? source.slice(0, 80) : 'website',
          user_agent: req.headers.get('user-agent') || '',
        },
      })
      if (error) console.error('[newsletter] Analytics insert failed:', error.message)
    }
    return NextResponse.json({ ok: true })
  }

  const err = await res.json().catch(() => ({}))
  console.error('[newsletter] Beehiiv error:', res.status, err)
  return NextResponse.json({ error: 'Subscription failed' }, { status: 500 })
}
