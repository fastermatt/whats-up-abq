/**
 * POST /api/admin/ig/schedule  — queue a post for later publishing
 * GET  /api/admin/ig/schedule  — list scheduled + recent posts
 * DELETE /api/admin/ig/schedule?id=xxx — cancel a pending post
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

function decodeBase64(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64, 'base64')
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    imageDataUrls?: string[]
    caption?: string
    mediaType: 'FEED' | 'STORIES' | 'CAROUSEL'
    scheduledFor: string
    eventId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { imageDataUrls, caption, mediaType, scheduledFor, eventId } = body
  if (!imageDataUrls || imageDataUrls.length === 0 || !mediaType || !scheduledFor) {
    return NextResponse.json({ error: 'Missing required fields: imageDataUrls, mediaType, scheduledFor' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const timestamp = Date.now()
  const uploadedUrls: string[] = []

  try {
    // Upload images to storage now so scheduler can post directly from URLs
    for (let i = 0; i < imageDataUrls.length; i++) {
      const buffer = decodeBase64(imageDataUrls[i])
      const filename = `ig-posts/sched_${timestamp}_${i}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('event-photos')
        .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      const { data: urlData } = supabase.storage.from('event-photos').getPublicUrl(filename)
      uploadedUrls.push(urlData.publicUrl)
    }

    const { data, error } = await supabase
      .from('ig_scheduled_posts')
      .insert({
        scheduled_for: scheduledFor,
        media_type: mediaType,
        image_urls: uploadedUrls,
        caption: caption ?? null,
        event_id: eventId ?? null,
        status: 'pending',
      })
      .select('id, scheduled_for, status')
      .single()

    if (error) throw new Error(`DB insert error: ${error.message}`)

    return NextResponse.json({ id: data.id, scheduledFor: data.scheduled_for, status: data.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('ig_scheduled_posts')
    .select('*')
    .neq('status', 'cancelled')
    .order('scheduled_for', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('ig_scheduled_posts')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending') // only cancel pending posts

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
