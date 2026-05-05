/**
 * POST /api/admin/ig/publish
 *
 * Publishes a feed post, Story, or Carousel to @abqunplugged Instagram.
 *
 * Body:
 *   { imageDataUrl: string, caption: string, mediaType?: 'FEED' | 'STORIES' }          — single image
 *   { imageDataUrls: string[], caption?: string, mediaType: 'CAROUSEL', eventId?: string } — carousel
 *
 * Returns: { postId: string, imageUrl: string, mediaType }
 *
 * Flow (single):
 *  1. Decode JPEG data URL → buffer
 *  2. Upload to Supabase Storage (event-photos/ig-posts/)
 *  3. Create Instagram media container
 *  4. Poll until FINISHED
 *  5. Publish → log to ig_post_log
 *
 * Flow (carousel):
 *  1. Decode + upload each slide image
 *  2. Create child container per image (is_carousel_item=true), poll each
 *  3. Create parent carousel container, poll
 *  4. Publish → log to ig_post_log
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const IG_API = 'https://graph.facebook.com/v19.0'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

async function pollStatus(containerId: string, token: string, maxAttempts = 12): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(
      `${IG_API}/${containerId}?fields=status_code,status&access_token=${token}`
    )
    const data = await res.json()
    if (data.status_code === 'FINISHED') return true
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') return false
  }
  return false
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

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    imageDataUrl?: string
    imageDataUrls?: string[]
    caption?: string
    mediaType?: 'FEED' | 'STORIES' | 'CAROUSEL'
    eventId?: string
    location_id?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { imageDataUrl, imageDataUrls, caption, mediaType = 'FEED', eventId, location_id } = body

  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  if (!igToken || !igUserId) {
    return NextResponse.json({ error: 'Instagram credentials not configured' }, { status: 500 })
  }

  const supabase = await createServiceClient()
  const timestamp = Date.now()

  try {
    // ── CAROUSEL ────────────────────────────────────────────────────────────
    if (mediaType === 'CAROUSEL') {
      if (!imageDataUrls || imageDataUrls.length < 2) {
        return NextResponse.json({ error: 'CAROUSEL requires imageDataUrls (min 2 images)' }, { status: 400 })
      }

      // Upload all images and create child containers
      const childContainerIds: string[] = []
      const uploadedUrls: string[] = []

      for (let i = 0; i < imageDataUrls.length; i++) {
        const buffer = decodeBase64(imageDataUrls[i])
        const filename = `ig-posts/carousel_${timestamp}_${i}.jpg`
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

      // Create parent container
      const parentId = await createContainer(igUserId, igToken, {
        media_type: 'CAROUSEL',
        children: childContainerIds.join(','),
        ...(caption ? { caption } : {}),
      })

      const parentReady = await pollStatus(parentId, igToken)
      if (!parentReady) throw new Error('Carousel parent container failed or timed out')

      // Publish
      const publishBody = new URLSearchParams({ creation_id: parentId, access_token: igToken })
      const publishRes = await fetch(`${IG_API}/${igUserId}/media_publish`, { method: 'POST', body: publishBody })
      const publish = await publishRes.json()
      if (!publish.id) throw new Error(publish.error?.message ?? 'Failed to publish carousel')

      const postId: string = publish.id
      const imageUrl = uploadedUrls[0]

      // Log
      const { error: logErr } = await supabase.from('ig_post_log').insert({
        post_id: postId,
        media_type: 'CAROUSEL',
        image_url: imageUrl,
        caption: caption ?? null,
        event_id: eventId ?? null,
        slide_count: imageDataUrls.length,
        posted_at: new Date().toISOString(),
      })
      if (logErr) console.error('Failed to log carousel post:', logErr)

      return NextResponse.json({ postId, imageUrl, mediaType: 'CAROUSEL' })
    }

    // ── FEED / STORIES ──────────────────────────────────────────────────────
    if (!imageDataUrl) {
      return NextResponse.json({ error: 'imageDataUrl is required for FEED and STORIES' }, { status: 400 })
    }
    const isStory = mediaType === 'STORIES'
    if (!isStory && !caption?.trim()) {
      return NextResponse.json({ error: 'caption is required for feed posts' }, { status: 400 })
    }

    const buffer = decodeBase64(imageDataUrl)
    const filename = `ig-posts/${isStory ? 'story' : 'post'}_${timestamp}.jpg`
    const imageUrl = await uploadToSupabase(supabase, buffer, filename)

    const containerParams: Record<string, string> = { image_url: imageUrl }
    if (isStory) {
      containerParams.media_type = 'STORIES'
    } else {
      containerParams.caption = caption!
      // Optional Instagram location tag (Facebook Place ID from Places search API)
      if (location_id) containerParams.location_id = location_id
    }

    const containerId = await createContainer(igUserId, igToken, containerParams)

    const ready = await pollStatus(containerId, igToken)
    if (!ready) throw new Error('Media processing timed out or failed')

    // Publish
    const publishBody = new URLSearchParams({ creation_id: containerId, access_token: igToken })
    const publishRes = await fetch(`${IG_API}/${igUserId}/media_publish`, { method: 'POST', body: publishBody })
    const publish = await publishRes.json()
    if (!publish.id) throw new Error(publish.error?.message ?? 'Failed to publish')

    const postId: string = publish.id

    // Log
    const { error: logErr } = await supabase.from('ig_post_log').insert({
      post_id: postId,
      media_type: mediaType,
      image_url: imageUrl,
      caption: caption ?? null,
      event_id: eventId ?? null,
      slide_count: 1,
      posted_at: new Date().toISOString(),
    })
    if (logErr) console.error('Failed to log post:', logErr)

    return NextResponse.json({ postId, imageUrl, mediaType })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Instagram publish error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
