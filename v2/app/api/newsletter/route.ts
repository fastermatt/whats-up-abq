import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PUBLICATION_ID = 'pub_ad8d3710-77c3-4bda-947b-18a1497ccbc6'

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))

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

  if (res.ok) return NextResponse.json({ ok: true })

  const err = await res.json().catch(() => ({}))
  console.error('[newsletter] Beehiiv error:', res.status, err)
  return NextResponse.json({ error: 'Subscription failed' }, { status: 500 })
}
