import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const VALID_CATEGORIES = [
  'Music', 'Comedy', 'Sports', 'Arts & Theater', 'Family',
  'Film', 'Food & Drink', 'Festivals', 'Outdoor', 'Community',
]

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const token = request.cookies.get('admin_token')?.value
  return token === secret
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, category, subcategory, hidden, featured, title_override, admin_notes } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .schema('public').from('events').select('ai_enrichment').eq('id', id).single()

  const updates: Record<string, unknown> = {}

  if (typeof hidden === 'boolean') updates.hidden = hidden
  if (typeof featured === 'boolean') updates.featured = featured

  if (category !== undefined || subcategory !== undefined || title_override !== undefined || admin_notes !== undefined) {
    const ai = (existing?.ai_enrichment as Record<string, unknown>) ?? {}
    if (category !== undefined) ai.category = category
    if (subcategory !== undefined) ai.subcategory = subcategory || null
    if (title_override !== undefined) ai.title_override = title_override || null
    if (admin_notes !== undefined) ai.admin_notes = admin_notes || null
    ai.admin_edited_at = new Date().toISOString()
    updates.ai_enrichment = ai
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .schema('public').from('events').update(updates).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
