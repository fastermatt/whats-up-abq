/**
 * POST /api/admin/ig/schedule
 *
 * Queues a post for scheduled publishing.
 * Images are uploaded to Supabase Storage immediately (public URLs needed later).
 * A Netlify scheduled function (netlify/functions/ig-publisher.mts) polls
 * ig_scheduled_posts every 5 minutes and fires the actual IG publish call.
 *
 * Body (FEED):
 *   { imageDataUrl: string, caption?: string, mediaType: 'FEED',
 *     scheduledFor: string (ISO 8601), eventId?: string, location_id?: string }
 *
 * Body (CAROUSEL):
 *   { imageDataUrls: string[], caption?: string, mediaType: 'CAROUSEL',
 *     scheduledFor: string (ISO 8601), eventId?: string }
 *
 * Returns: { id, scheduledFor, status: 'pending' }
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

async function uploadToSupabase(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  buffer: Buffer,
  filename: string
): Promise<string> {
  const { error } = await supabase.storage
    .from('event-photos')
    .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-photos/${filename}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    imageDataUrl?: string
    imageDataUrls?: string[]
    caption?: string
    mediaType: 'FEED' | 'STORIES' | 'CAROUSEL'
    scheduledFor: string
    eventId?: string
    location_id?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { imageDataUrl, imageDataUrls, caption, mediaType, scheduledFor, eventId, location_id } = body

  if (!mediaType || !scheduledFor) {
    return NextResponse.json({ error: 'Missing required fields: mediaType, scheduledFor' }, { status: 400 })
  }

  // Validate scheduledFor — must be at least 5 minutes in the future
  const scheduledDate = new Date(scheduledFor)
  if (isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: 'scheduledFor is not a valid date' }, { status: 400 })
  }
  if (scheduledDate.getTime() < Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: 'scheduledFor must be at least 5 minutes in the future' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const timestamp = Date.now()
  const uploadedUrls: string[] = []

  try {
    if (mediaType === 'CAROUSEL') {
      if (!imageDataUrls || imageDataUrls.length < 2) {
        return NextResponse.json({ error: 'CAROUSEL requires imageDataUrls (min 2)' }, { status: 400 })
      }
      for (let i = 0; i < imageDataUrls.length; i++) {
        const buffer = decodeBase64(imageDataUrls[i])
        const filename = `ig-posts/sched_${timestamp}_${i}.jpg`
        uploadedUrls.push(await uploadToSupabase(supabase, buffer, filename))
      }
    } else {
      // FEED or STORIES — single image
      if (!imageDataUrl) {
        return NextResponse.json({ error: 'imageDataUrl is required for FEED/STORIES' }, { status: 400 })
      }
      const buffer = decodeBase64(imageDataUrl)
      const filename = `ig-posts/sched_${timestamp}.jpg`
      uploadedUrls.push(await uploadToSupabase(supabase, buffer, filename))
    }

    const { data, error } = await supabase
      .from('ig_scheduled_posts')
      .insert({
        scheduled_for: scheduledFor,
        media_type: mediaType,
        image_urls: uploadedUrls,
        caption: caption ?? null,
        event_id: eventId ?? null,
        location_id: location_id ?? null,
        status: 'pending',
      })
      .select('id, scheduled_for, status')
      .single()

    if (error) throw new Error(`DB insert failed: ${error.message}`)

    return NextResponse.json({ id: data.id, scheduledFor: data.scheduled_for, status: data.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Schedule error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = await createServiceClient()
  // The Queue page (app/admin/ig/queue/page.tsx) expects this exact shape:
  //   { id, created_at, scheduled_for, media_type, image_urls, caption,
  //     event_id, status, post_id, error_msg, published_at }
  // Earlier this select renamed image_urls → slide_count and dropped
  // created_at / event_id / published_at, so the page showed blank
  // thumbnails and missing "Published <date>" labels.
  const { data, error } = await supabase
    .from('ig_scheduled_posts')
    .select('id, created_at, scheduled_for, media_type, image_urls, caption, event_id, status, post_id, error_msg, published_at')
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
    .eq('status', 'pending')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
