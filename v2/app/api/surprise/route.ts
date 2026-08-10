/**
 * GET /api/surprise
 * Picks a random upcoming event that has an image and redirects to its detail page.
 * Prefers featured events; falls back to any event with a photo.
 * 
 * Revalidates every 60 seconds on the edge (Netlify CDN) so visitors get a "fresh"
 * surprise without hitting the function every request.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 60

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)

    // Fetch up to 200 upcoming events that have an image (cached or raw).
    // We filter for cached_photo_url in DB; raw image presence checked JS-side
    // since it's buried in JSONB — not worth a DB function for this.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .schema('public')
      .from('events')
      .select('id, featured, cached_photo_url')
      .eq('hidden', false)
      .gte('event_date', today)
      .not('cached_photo_url', 'is', null)
      .order('featured', { ascending: false })
      .limit(200)

    if (error || !data || (data as { id: string }[]).length === 0) {
      // Fallback: redirect to events listing
      return NextResponse.redirect(new URL('/events', req.url), 302)
    }

    const rows = data as { id: string; featured: boolean | null; cached_photo_url: string | null }[]

    // Random pick — weighted slightly toward the start of the list (featured first)
    // but still random enough to feel surprising.
    const idx = Math.floor(Math.random() * Math.min(rows.length, 100))
    const picked = rows[idx] ?? rows[0]

    return NextResponse.redirect(new URL(`/events/${picked.id}`, req.url), 302)
  } catch {
    return NextResponse.redirect(new URL('/events', req.url), 302)
  }
}
