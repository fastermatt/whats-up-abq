/**
 * PATCH /api/admin/ig/suggestions/[id]
 *
 * Accept or reject a suggestion. On accept, schedules the post.
 * Body: { action: 'accept' | 'reject', reason?: string, caption?: string, imageDataUrl?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.cookies.get('admin_token')?.value === secret
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

interface PatchBody {
  action: 'accept' | 'reject' | 'skip'
  reason?: string
  caption?: string
  imageDataUrl?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body: PatchBody = await req.json()
  const supabase = await createServiceClient()

  if (body.action === 'accept') {
    // Guard: never accept a post with no caption or no rendered image — both
    // would publish a broken post downstream.
    if (body.caption !== undefined && !body.caption.trim()) {
      return NextResponse.json({ error: 'Caption is empty — add a caption before accepting.' }, { status: 400 })
    }
    if (!body.imageDataUrl || !body.imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Post image not ready yet — wait for the preview to render, then accept.' }, { status: 400 })
    }

    let publicImageUrl: string
    try {
      const buffer = decodeBase64(body.imageDataUrl)
      const filename = `ig-posts/sched_${Date.now()}.jpg`
      publicImageUrl = await uploadToSupabase(supabase, buffer, filename)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image upload failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    // Update suggestion to accepted
    const updatePayload: Record<string, unknown> = {
      status: 'accepted',
      caption_edited: body.caption ? true : false,
    }
    if (body.caption)       updatePayload.caption = body.caption
    updatePayload.image_data_url = publicImageUrl

    const { error: updateErr } = await supabase
      .schema('public')
      .from('ig_post_suggestions')
      .update(updatePayload)
      .eq('id', id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Fetch the suggestion to schedule the post
    const { data: suggestion } = await supabase
      .schema('public')
      .from('ig_post_suggestions')
      .select('*')
      .eq('id', id)
      .single()

    if (suggestion) {
      // Create an ig_scheduled_post entry (uses existing scheduling infrastructure)
      const { error: schedErr } = await supabase
        .schema('public')
        .from('ig_scheduled_posts')
        .insert({
          image_urls:     [publicImageUrl],   // ig_scheduled_posts.image_urls is text[] — NOT image_data_url
          caption:        body.caption ?? suggestion.caption ?? '',
          scheduled_for:  suggestion.scheduled_for,
          media_type:     'FEED',
          status:         'pending',
          suggestion_id:  id,
        })

      if (schedErr) console.warn('[suggestions] Failed to create scheduled post:', schedErr.message)
    }

    return NextResponse.json({ ok: true, status: 'accepted' })
  }

  if (body.action === 'reject') {
    const { error } = await supabase
      .schema('public')
      .from('ig_post_suggestions')
      .update({ status: 'rejected', rejection_reason: body.reason ?? '' })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'rejected' })
  }

  if (body.action === 'skip') {
    const { error } = await supabase
      .schema('public')
      .from('ig_post_suggestions')
      .update({ status: 'skipped' })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'skipped' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
