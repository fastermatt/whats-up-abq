/**
 * Netlify Scheduled Function — ig-publisher
 *
 * Runs every 5 minutes. Picks up pending IG posts from ig_scheduled_posts
 * whose scheduled_for <= now, publishes them to Instagram, and marks them done.
 *
 * No server-side state or cron infra needed — Netlify fires this automatically.
 */

import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────────────
export const config = { schedule: '*/5 * * * *' }

const IG_API = 'https://graph.facebook.com/v19.0'

// ── Helpers ───────────────────────────────────────────────────────────────────

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function pollStatus(containerId: string, token: string, maxAttempts = 12): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(`${IG_API}/${containerId}?fields=status_code,status&access_token=${token}`)
    const data = await res.json() as { status_code?: string }
    if (data.status_code === 'FINISHED') return true
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') return false
  }
  return false
}

async function createContainer(
  igUserId: string,
  token: string,
  params: Record<string, string>
): Promise<string> {
  const body = new URLSearchParams({ access_token: token, ...params })
  const res = await fetch(`${IG_API}/${igUserId}/media`, { method: 'POST', body })
  const data = await res.json() as { id?: string; error?: { message: string } }
  if (!data.id) throw new Error(data.error?.message ?? 'Failed to create container')
  return data.id
}

async function publishContainer(igUserId: string, token: string, creationId: string): Promise<string> {
  const body = new URLSearchParams({ creation_id: creationId, access_token: token })
  const res = await fetch(`${IG_API}/${igUserId}/media_publish`, { method: 'POST', body })
  const data = await res.json() as { id?: string; error?: { message: string } }
  if (!data.id) throw new Error(data.error?.message ?? 'Failed to publish')
  return data.id
}

// ── Row type ──────────────────────────────────────────────────────────────────

interface ScheduledPost {
  id: string
  media_type: 'FEED' | 'STORIES' | 'CAROUSEL'
  image_urls: string[]
  caption: string | null
  location_id: string | null
  event_id: string | null
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler() {
  const igToken  = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
  if (!igToken || !igUserId) {
    console.error('ig-publisher: Instagram credentials not set')
    return
  }

  const supabase = supabaseAdmin()

  // Fetch all pending posts due right now (scheduled_for <= current time)
  const { data: posts, error: fetchErr } = await supabase
    .from('ig_scheduled_posts')
    .select('id, media_type, image_urls, caption, location_id, event_id')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(10) // safety cap — don't burst the IG API

  if (fetchErr) {
    console.error('ig-publisher: DB fetch error:', fetchErr.message)
    return
  }
  if (!posts || posts.length === 0) return

  console.log(`ig-publisher: ${posts.length} post(s) due`)

  for (const post of posts as ScheduledPost[]) {
    try {
      let postId: string

      if (post.media_type === 'CAROUSEL') {
        // Create child containers for each image
        const childIds: string[] = []
        for (const imageUrl of post.image_urls) {
          const childId = await createContainer(igUserId, igToken, {
            image_url: imageUrl,
            is_carousel_item: 'true',
          })
          const ready = await pollStatus(childId, igToken)
          if (!ready) throw new Error(`Child container ${childId} failed`)
          childIds.push(childId)
        }

        // Parent carousel container
        const parentParams: Record<string, string> = {
          media_type: 'CAROUSEL',
          children: childIds.join(','),
        }
        if (post.caption) parentParams.caption = post.caption

        const parentId = await createContainer(igUserId, igToken, parentParams)
        const parentReady = await pollStatus(parentId, igToken)
        if (!parentReady) throw new Error('Carousel parent container failed')

        postId = await publishContainer(igUserId, igToken, parentId)

        // Log carousel to ig_post_log
        await supabase.from('ig_post_log').insert({
          post_id: postId,
          media_type: 'CAROUSEL',
          image_url: post.image_urls[0] ?? null,
          caption: post.caption,
          event_id: post.event_id,
          slide_count: post.image_urls.length,
          posted_at: new Date().toISOString(),
        })
      } else {
        // FEED or STORIES — single image
        const containerParams: Record<string, string> = {
          image_url: post.image_urls[0],
        }
        if (post.media_type === 'STORIES') {
          containerParams.media_type = 'STORIES'
        } else {
          if (post.caption) containerParams.caption = post.caption
          if (post.location_id) containerParams.location_id = post.location_id
        }

        const containerId = await createContainer(igUserId, igToken, containerParams)
        const ready = await pollStatus(containerId, igToken)
        if (!ready) throw new Error('Container processing timed out')

        postId = await publishContainer(igUserId, igToken, containerId)

        // Log to ig_post_log
        await supabase.from('ig_post_log').insert({
          post_id: postId,
          media_type: post.media_type,
          image_url: post.image_urls[0],
          caption: post.caption,
          event_id: post.event_id,
          slide_count: 1,
          posted_at: new Date().toISOString(),
        })
      }

      // Mark as published
      await supabase
        .from('ig_scheduled_posts')
        .update({ status: 'published', post_id: postId, published_at: new Date().toISOString() })
        .eq('id', post.id)

      console.log(`ig-publisher: published ${post.id} → IG post ${postId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`ig-publisher: failed to publish ${post.id}:`, msg)

      // Mark as error so it doesn't retry indefinitely
      await supabase
        .from('ig_scheduled_posts')
        .update({ status: 'error', error_msg: msg })
        .eq('id', post.id)
    }
  }
}
