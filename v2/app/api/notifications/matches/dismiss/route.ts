import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/notifications/matches/dismiss
// Body: { event_id: string, undo?: boolean }
// Marks the current user's notification_matches row as dismissed (or un-dismissed).
// Event detail/for-you cards use this for the thumbs-down "not for me" action.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { event_id?: string; undo?: boolean }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const eventId = (body.event_id || '').toString().trim()
  if (!eventId) return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })

  const dismiss = body.undo !== true

  // Upsert: if no match row exists yet, create one with dismissed=true and score 0
  // so the matcher knows to skip re-creating it until user undismisses.
  const { error } = await supabase
    .from('notification_matches')
    .upsert(
      {
        user_id:  user.id,
        event_id: eventId,
        dismissed: dismiss,
        // leave score/match_reasons alone if the row already exists; defaults apply on insert
      },
      { onConflict: 'user_id,event_id', ignoreDuplicates: false },
    )

  if (error) {
    console.error('[notifications/matches/dismiss] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, dismissed: dismiss })
}
