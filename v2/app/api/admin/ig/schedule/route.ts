/**
 * POST /api/admin/ig/schedule
 *
 * Schedules a feed post or carousel via Instagram native scheduling.
 * IG auto-publishes at the given time — no server-side cron needed.
 *
 * Body (FEED):
 *   { imageDataUrl: string, caption?: string, mediaType: 'FEED',
 *     scheduledFor: string (ISO 8601), eventId?: string, location_id?: string }
 *
 * Body (CAROUSEL):
 *   { imageDataUrls: string[], caption?: string, mediaType: 'CAROUSEL',
 *     scheduledFor: string (ISO 8601), eventId?: string }
 *
 * Constraints:
 *   - scheduledFor must be 10 min – 75 days in the future
 *   - STORIES cannot be scheduled via the Graph API (returns 400)
 *
 * Returns: { postId, scheduledFor, mediaType }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const IG_API = 'https://graph.facebook.com/v19.0'

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

async function createContainer(
  igUserId: string,
  token: string,
  params: Record<string, string>
): Promise<string> {
  const body = new URLSearchParams({ access_token: token, ...params })
  const res = await fetch(`${IG_API}/${igUserId}/media`, { method: 'POST', body })
  const data = await res.json()
  if (!data.id) throw new Error(data.error?.message ?? 'Failed to create media container')
  return data.id
}

async function pollStatus(containerId: string, token: string, maxAttempts = 12): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(`${IG_API}/${containerId}?fields=status_code,status&access_token=${token}`)
    const data = await res.json()
    if (data.status_code === 'FINISHED') return true
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') return false
  }
  return false
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

  // Stories can't be scheduled via the Graph API
  if (mediaType === 'STORIES') {
    return NextResponse.json(
      { error: 'Instagram Stories cannot be scheduled via the API. Publish Stories immediately instead.' },
      { status: 400 }
    )
  }

  // Validate scheduledFor
  if (!scheduledFor) {
    return NextResponse.json({ error: 'scheduledFor is required' }, { status: 400 })
  }
  const scheduledDate = new Date(scheduledFor)
  if (isNaN(scheduledDate.getTime())) {
    return NextResponse.json({ error: 'scheduledFor is not a valid date' }, { status: 400 })
  }
  const now = Date.now()
  const minMs = 10 * 60 * 1000         // 10 minutes
  const maxMs = 75 * 24 * 60 * 60 * 1000  // 75 days
  const diffMs = scheduledDate.getTime() - now
  if (diffMs < minMs) {
    return NextResponse.json(
      { error: 'scheduledFor must be at least 10 minutes in the future' },
      { status: 400 }
    )
  }
  if (diffMs > maxMs) {
    return NextResponse.json(
      { error: 'scheduledFor must be at most 75 days in the future' },
      { status: 400 }
    )
  }

  const scheduledUnix = String(Math.floor(scheduledDate.getTime() / 1000))

  const igToken  = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  if (!igToken || !igUserId) {
    return NextResponse.json({ error: 'Instagram credentials not configured' }, { status: 500 })
  }

  const supabase  = await createServiceClient()
  const timestamp = Date.now()

  try {
    // ── CAROUSEL ─────────────────────────────────────────────────────────────
    if (mediaType === 'CAROUSEL') {
      if (!imageDataUrls || imageDataUrls.length < 2) {
        return NextResponse.json({ error: 'CAROUSEL requires imageDataUrls (min 2)' }, { status: 400 })
      }

      // Upload all images and create child containers
      const childContainerIds: string[] = []
      const uploadedUrls: string[] = []

      for (let i = 0; i < imageDataUrls.length; i++) {
        const buffer  = decodeBase64(imageDataUrls[i])
        const filename = `ig-posts/sched_${timestamp}_${i}.jpg`
        const publicUrl = await uploadToSupabase(supabase, buffer, filename)
        uploadedUrls.push(publicUrl)

        const childId = await createContainer(igUserId, igToken, {
          image_url: publicUrl,
          is_carousel_item: 'true',
        })
        childContainerIds.push(childId)
      }

      // Poll each child
      for (const childId of childContainerIds) {
        const ready = await pollStatus(childId, igToken)
        if (!ready) throw new Error(`Child container ${childId} failed or timed out`)
      }

      // Create parent with native scheduling params
      const parentId = await createContainer(igUserId, igToken, {
        media_type: 'CAROUSEL',
        children: childContainerIds.join(','),
        published: 'false',
        scheduled_publish_time: scheduledUnix,
        ...(caption ? { caption } : {}),
      })

      const parentReady = await pollStatus(parentId, igToken)
      if (!parentReady) throw new Error('Carousel parent container failed or timed out')

      // Publish (IG holds it until scheduledUnix)
      const publishBody = new URLSearchParams({ creation_id: parentId, access_token: igToken })
      const publishRes  = await fetch(`${IG_API}/${igUserId}/media_publish`, { method: 'POST', body: publishBody })
      const publish     = await publishRes.json()
      if (!publish.id) throw new Error(publish.error?.message ?? 'Failed to schedule carousel')

      const postId: string = publish.id

      // Log
      const { error: logErr } = await supabase.from('ig_post_log').insert({
        post_id:    postId,
        media_type: 'CAROUSEL',
        image_url:  uploadedUrls[0],
        caption:    caption ?? null,
        event_id:   eventId ?? null,
        slide_count: imageDataUrls.length,
        posted_at:  scheduledDate.toISOString(),
      })
      if (logErr) console.error('Failed to log scheduled carousel:', logErr)

      return NextResponse.json({ postId, scheduledFor, mediaType: 'CAROUSEL' })
    }

    // ── FEED ──────────────────────────────────────────────────────────────────
    if (!imageDataUrl) {
      return NextResponse.json({ error: 'imageDataUrl is required for FEED' }, { status: 400 })
    }

    const buffer   = decodeBase64(imageDataUrl)
    const filename = `ig-posts/sched_${timestamp}.jpg`
    const imageUrl = await uploadToSupabase(supabase, buffer, filename)

    const containerParams: Record<string, string> = {
      image_url: imageUrl,
      published: 'false',
      scheduled_publish_time: scheduledUnix,
    }
    if (caption)     containerParams.caption     = caption
    if (location_id) containerParams.location_id = location_id

    const containerId = await createContainer(igUserId, igToken, containerParams)

    const ready = await pollStatus(containerId, igToken)
    if (!ready) throw new Error('Media container processing timed out')

    // Publish (IG auto-fires at scheduledUnix)
    const publishBody = new URLSearchParams({ creation_id: containerId, access_token: igToken })
    const publishRes  = await fetch(`${IG_API}/${igUserId}/media_publish`, { method: 'POST', body: publishBody })
    const publish     = await publishRes.json()
    if (!publish.id) throw new Error(publish.error?.message ?? 'Failed to schedule post')

    const postId: string = publish.id

    // Log with scheduled time as posted_at so history is ordered correctly
    const { error: logErr } = await supabase.from('ig_post_log').insert({
      post_id:    postId,
      media_type: 'FEED',
      image_url:  imageUrl,
      caption:    caption ?? null,
      event_id:   eventId ?? null,
      slide_count: 1,
      posted_at:  scheduledDate.toISOString(),
    })
    if (logErr) console.error('Failed to log scheduled post:', logErr)

    return NextResponse.json({ postId, scheduledFor, mediaType: 'FEED' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Instagram schedule error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
