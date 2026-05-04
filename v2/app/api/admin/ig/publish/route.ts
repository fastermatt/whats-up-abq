/**
 * POST /api/admin/ig/publish
 *
 * Publishes a feed post or Story to @abqunplugged Instagram from the IG Editor.
 *
 * Body: { imageDataUrl: string (JPEG base64), caption: string, mediaType?: 'FEED' | 'STORIES' }
 * Returns: { postId: string, imageUrl: string, mediaType: 'FEED' | 'STORIES' }
 *
 * Flow:
 *  1. Decode JPEG data URL → buffer
 *  2. Upload to Supabase Storage (event-photos/ig-posts/)
 *  3. Create Instagram media container via Graph API
 *     - Feed: image_url + caption
 *     - Story: image_url + media_type=STORIES (no caption — Instagram ignores it)
 *  4. Poll container status until FINISHED (up to 60s)
 *  5. Publish container → get post ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

async function pollStatus(containerId: string, token: string, maxAttempts = 12): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${token}`
    )
    const data = await res.json()
    if (data.status_code === 'FINISHED') return true
    if (data.status_code === 'ERROR') return false
  }
  return false
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { imageDataUrl?: string; caption?: string; mediaType?: 'FEED' | 'STORIES' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { imageDataUrl, caption, mediaType = 'FEED' } = body
  const isStory = mediaType === 'STORIES'

  if (!imageDataUrl) {
    return NextResponse.json({ error: 'imageDataUrl is required' }, { status: 400 })
  }
  if (!isStory && !caption?.trim()) {
    return NextResponse.json({ error: 'caption is required for feed posts' }, { status: 400 })
  }

  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  if (!igToken || !igUserId) {
    return NextResponse.json({ error: 'Instagram credentials not configured' }, { status: 500 })
  }

  // 1. Decode data URL → buffer
  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')

  // 2. Upload to Supabase Storage
  const supabase = await createServiceClient()
  const filename = `ig-posts/${isStory ? 'story' : 'post'}_${Date.now()}.jpg`

  const { error: uploadError } = await supabase.storage
    .from('event-photos')
    .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-photos/${filename}`

  // 3. Create Instagram media container
  const containerParams = new URLSearchParams({
    image_url: imageUrl,
    access_token: igToken,
  })
  if (isStory) {
    containerParams.set('media_type', 'STORIES')
  } else {
    containerParams.set('caption', caption!)
  }

  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media`,
    { method: 'POST', body: containerParams }
  )
  const container = await containerRes.json()

  if (!container.id) {
    return NextResponse.json(
      { error: container.error?.message ?? 'Failed to create media container' },
      { status: 500 }
    )
  }

  // 4. Poll until Instagram finishes processing
  const ready = await pollStatus(container.id, igToken)
  if (!ready) {
    return NextResponse.json({ error: 'Media processing timed out or failed' }, { status: 500 })
  }

  // 5. Publish
  const publishParams = new URLSearchParams({
    creation_id: container.id,
    access_token: igToken,
  })

  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
    { method: 'POST', body: publishParams }
  )
  const publish = await publishRes.json()

  if (!publish.id) {
    return NextResponse.json(
      { error: publish.error?.message ?? 'Failed to publish' },
      { status: 500 }
    )
  }

  return NextResponse.json({ postId: publish.id, imageUrl, mediaType })
}
