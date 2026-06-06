import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { handle } = body as { handle?: string }

  if (!handle) {
    return NextResponse.json({ error: 'handle is required' }, { status: 400 })
  }

  // Sanitize handle before interpolating into the PostgREST .or() filter —
  // commas/parens would otherwise inject extra filter conditions.
  const h = handle.replace(/^@/, '').replace(/[^a-zA-Z0-9_.-]/g, '')

  // Look up profile by handle (stored with or without @)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .or(`handle.eq.${h},handle.eq.@${h}`)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (profile.id === user.id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  const { error } = await supabase
    .from('follows')
    .upsert(
      { follower_id: user.id, following_id: profile.id },
      { onConflict: 'follower_id,following_id' }
    )

  if (error) {
    console.error('[follow] Upsert error:', error.message)
    return NextResponse.json({ error: 'Failed to follow' }, { status: 500 })
  }

  return NextResponse.json({ following: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { handle } = body as { handle?: string }

  if (!handle) {
    return NextResponse.json({ error: 'handle is required' }, { status: 400 })
  }

  // Sanitize handle (see POST) before interpolating into the .or() filter.
  const h = handle.replace(/^@/, '').replace(/[^a-zA-Z0-9_.-]/g, '')

  // Look up profile by handle
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .or(`handle.eq.${h},handle.eq.@${h}`)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', profile.id)

  if (error) {
    console.error('[follow] Delete error:', error.message)
    return NextResponse.json({ error: 'Failed to unfollow' }, { status: 500 })
  }

  return NextResponse.json({ following: false })
}
