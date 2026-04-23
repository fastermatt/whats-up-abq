import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Returns the current user's matched events, newest + highest-scoring first.
// Shape is compatible with /events card components.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  const { data: matches, error } = await supabase
    .from('notification_matches')
    .select('event_id, score, match_reasons, matched_at, dismissed')
    .eq('user_id', user.id)
    .eq('dismissed', false)
    .order('score', { ascending: false })
    .order('matched_at', { ascending: false })
    .limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!matches?.length) return NextResponse.json({ events: [] })

  const ids = matches.map(m => m.event_id)
  const { data: events } = await supabase
    .from('events')
    .select('id, raw, event_date, category, venue_name, neighborhood, neighborhood_slug, cached_photo_url, image_status, ai_enrichment')
    .in('id', ids)
    .eq('hidden', false)
    .gte('event_date', today)

  const byId = new Map((events ?? []).map(e => [e.id, e]))
  const output = matches
    .filter(m => byId.has(m.event_id))
    .map(m => {
      const e = byId.get(m.event_id)!
      return {
        ...e,
        match_score: m.score,
        match_reasons: m.match_reasons,
      }
    })
    .slice(0, 40)

  return NextResponse.json({ events: output })
}
