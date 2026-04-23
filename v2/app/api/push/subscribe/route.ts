/**
 * POST /api/push/subscribe
 * Save a Web Push subscription to the push_subscriptions table.
 * Device-based (no auth required) — the subscription endpoint is the
 * browser-generated unique identifier.
 *
 * Body: { subscription: PushSubscription }
 * Returns: 201 on save, 400 on bad payload, 500 on DB error
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSsrClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Service role client for writing to push_subscriptions (bypasses RLS)
const svcClient = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sub = body.subscription as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
    }

    // Try to identify the user (optional — subscription still works anonymously)
    let userId: string | null = null
    try {
      const ssr = await createSsrClient()
      const { data: { user } } = await ssr.auth.getUser()
      userId = user?.id ?? null
    } catch {
      // Anonymous — no session cookies — proceed without user_id
    }

    // Upsert by endpoint — same device re-subscribing gets updated keys
    const { error } = await svcClient
      .from('push_subscriptions')
      .upsert(
        {
          endpoint: sub.endpoint,
          p256dh:   sub.keys.p256dh,
          auth:     sub.keys.auth,
          user_id:  userId,
          prefs:    body.prefs ?? { new_events: true, upcoming: true, matches: true },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('[push/subscribe] DB error:', error.message)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    return NextResponse.json({ subscribed: true, linkedToUser: !!userId }, { status: 201 })
  } catch (e) {
    console.error('[push/subscribe] Error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/push/subscribe
 * Remove a push subscription (user opted out).
 */
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json()
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

    await svcClient.from('push_subscriptions').delete().eq('endpoint', endpoint)
    return NextResponse.json({ unsubscribed: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
