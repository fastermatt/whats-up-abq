/**
 * Netlify Scheduled Function — ig-publisher
 *
 * Runs every 5 minutes. Picks up pending IG posts from ig_scheduled_posts
 * whose scheduled_for <= now, publishes them to Instagram, and marks them done.
 *
 * No server-side state or cron infra needed — Netlify fires this automatically.
 *
 * Reliability hardening (2026-06-15, toward unattended auto-posting):
 *   - Atomic pending→publishing claim so overlapping invocations can't double-post.
 *   - Retry/backoff + res.ok handling on every Graph API call; 4xx (bad token /
 *     params) fail fast, 429/5xx/network retry.
 *   - Image-URL pre-flight: refuses data:/blank/non-public URLs before hitting IG.
 *   - Failures recorded as status='failed' (matches the queue UI bucket).
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

/** A non-retryable Graph API error (bad token, bad params, permissions). */
class TerminalError extends Error {}

/**
 * Fetch a Graph API JSON endpoint with retry + backoff. 4xx (except 429) are
 * terminal and fail fast — retrying a bad token or bad params just wastes time
 * and risks rate limits. 429 / 5xx / network errors retry with 2s,4s backoff.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function igFetch(url: string, init?: RequestInit, attempts = 3): Promise<any> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init)
      const data = await res.json().catch(() => ({}))
      if (res.ok && !data?.error) return data
      const msg = data?.error?.message ?? `HTTP ${res.status}`
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new TerminalError(`IG API ${res.status}: ${msg}`)
      }
      lastErr = new Error(`IG API ${res.status}: ${msg}`) // 429 / 5xx → retry
    } catch (e) {
      if (e instanceof TerminalError) throw e
      lastErr = e // network error → retry
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 2000 * 2 ** i))
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/** Graph API can only fetch publicly reachable http(s) URLs — never a data: URL,
 *  blob, or blank. Guards against the suggestion-accept path that stored a
 *  data:image/... URL directly into the queue. */
function isPublicHttpUrl(u: string | undefined | null): boolean {
  return !!u && /^https?:\/\//i.test(u)
}

async function pollStatus(containerId: string, token: string, maxAttempts = 12): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000))
    try {
      const data = await igFetch(
        `${IG_API}/${containerId}?fields=status_code,status&access_token=${token}`,
        undefined,
        2,
      ) as { status_code?: string }
      if (data.status_code === 'FINISHED') return true
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') return false
    } catch {
      // Transient poll failure — keep polling until maxAttempts.
    }
  }
  return false
}

async function createContainer(
  igUserId: string,
  token: string,
  params: Record<string, string>
): Promise<string> {
  const body = new URLSearchParams({ access_token: token, ...params })
  const data = await igFetch(`${IG_API}/${igUserId}/media`, { method: 'POST', body }) as { id?: string }
  if (!data.id) throw new Error('Failed to create container (no id returned)')
  return data.id
}

async function publishContainer(igUserId: string, token: string, creationId: string): Promise<string> {
  const body = new URLSearchParams({ creation_id: creationId, access_token: token })
  const data = await igFetch(`${IG_API}/${igUserId}/media_publish`, { method: 'POST', body }) as { id?: string }
  if (!data.id) throw new Error('Failed to publish (no id returned)')
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
    // ── Atomic claim: pending → publishing. Only the invocation that flips the
    // row proceeds, so two overlapping cron runs can't double-post the same row. ──
    const { data: claimed, error: claimErr } = await supabase
      .from('ig_scheduled_posts')
      .update({ status: 'publishing' })
      .eq('id', post.id)
      .eq('status', 'pending')
      .select('id')
    if (claimErr) {
      console.error(`ig-publisher: claim error for ${post.id}:`, claimErr.message)
      continue
    }
    if (!claimed || claimed.length === 0) {
      console.log(`ig-publisher: ${post.id} already claimed elsewhere, skipping`)
      continue
    }

    try {
      // ── Pre-flight: every image must be a public URL Graph API can fetch. ──
      if (!post.image_urls?.length || !post.image_urls.every(isPublicHttpUrl)) {
        throw new Error('Invalid image URL — must be a public http(s) URL (not a data: URL or blank)')
      }

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

      // Mark as published (guard on the claimed 'publishing' state)
      await supabase
        .from('ig_scheduled_posts')
        .update({ status: 'published', post_id: postId, published_at: new Date().toISOString() })
        .eq('id', post.id)

      console.log(`ig-publisher: published ${post.id} → IG post ${postId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`ig-publisher: failed to publish ${post.id}:`, msg)

      // Mark as failed (matches the queue UI bucket) so it doesn't retry forever.
      await supabase
        .from('ig_scheduled_posts')
        .update({ status: 'failed', error_msg: msg })
        .eq('id', post.id)
    }
  }
}
