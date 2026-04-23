import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Body = {
  categories?: string[]
  subcategory_tags?: string[]
  keywords?: string[]
  venues?: string[]
  neighborhoods?: string[]
  moods?: string[]
  include_free?: boolean
  include_paid?: boolean
  price_max_cents?: number | null
  family_friendly?: boolean
  channels?: string[]
  digest_day?: number
  digest_hour?: number
  days_ahead?: number
  enabled?: boolean
  email_opted_in?: boolean
  email_frequency?: string
}

const ALLOWED_CHANNELS = new Set(['in_app', 'email', 'push'])

function sanitizeStringArray(arr: unknown, opts: { max?: number; lower?: boolean } = {}): string[] {
  if (!Array.isArray(arr)) return []
  const out = new Set<string>()
  for (const v of arr) {
    if (typeof v !== 'string') continue
    const t = v.trim()
    if (!t || t.length > 100) continue
    out.add(opts.lower ? t.toLowerCase() : t)
    if (opts.max && out.size >= opts.max) break
  }
  return Array.from(out)
}

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return dflt
  return Math.min(Math.max(Math.trunc(v), min), max)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Sanitize
  const categories       = sanitizeStringArray(body.categories,       { max: 20 })
  const subcategory_tags = sanitizeStringArray(body.subcategory_tags, { max: 50, lower: true })
  const keywords         = sanitizeStringArray(body.keywords,         { max: 30, lower: true })
  const venues           = sanitizeStringArray(body.venues,           { max: 30 })
  const neighborhoods    = sanitizeStringArray(body.neighborhoods,    { max: 30 })
  const moods            = sanitizeStringArray(body.moods,            { max: 10, lower: true })
  const channels         = sanitizeStringArray(body.channels,         { max: 3, lower: true })
                             .filter(c => ALLOWED_CHANNELS.has(c))

  const row = {
    user_id: user.id,
    categories,
    subcategory_tags,
    keywords,
    venues,
    neighborhoods,
    moods,
    include_free:    body.include_free    !== false,
    include_paid:    body.include_paid    !== false,
    price_max_cents: (typeof body.price_max_cents === 'number' && body.price_max_cents >= 0)
                        ? Math.trunc(body.price_max_cents) : null,
    family_friendly: body.family_friendly === true,
    channels:        channels.length ? channels : ['in_app'],
    digest_day:      clampInt(body.digest_day, 0, 6, 4),
    digest_hour:     clampInt(body.digest_hour, 0, 23, 9),
    days_ahead:      clampInt(body.days_ahead, 1, 90, 14),
    enabled:         body.enabled !== false,
  }

  const { error } = await supabase
    .from('user_event_preferences')
    .upsert(row, { onConflict: 'user_id' })

  if (error) {
    console.error('[notification-preferences] upsert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If email channel selected, ensure user_email_prefs has them opted in
  if (row.channels.includes('email')) {
    const email = user.email
    if (email) {
      await supabase
        .from('user_email_prefs')
        .upsert({
          user_id:   user.id,
          email,
          opted_in:  true,
          frequency: body.email_frequency === 'daily' ? 'daily' : 'weekly',
        }, { onConflict: 'user_id' })
    }
  }

  return NextResponse.json({ ok: true })
}
