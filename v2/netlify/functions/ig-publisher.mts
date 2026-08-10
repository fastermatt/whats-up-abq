/**
 * Netlify Scheduled Function — ig-publisher
 *
 * Runs every 15 minutes. Picks up pending IG posts from ig_scheduled_posts
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
 *
 * Reels rebuild (2026-07-23):
 *   - REELS video containers take 30-120s to process, far longer than this
 *     function's execution limit. The old code polled inline and got killed
 *     mid-poll, leaving rows wedged in 'publishing' forever with the post
 *     sometimes live and sometimes not. Now the flow is STATEFUL: create the
 *     container, persist container_id on the row, and let the next 5-minute
 *     invocation check status and publish. Each invocation does seconds of
 *     work, so nothing gets killed and nothing double-posts.
 *   - Every DB write is error-checked. A silent failed UPDATE was how rows
 *     got stuck in 'publishing' with no error_msg.
 */

import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────────────
// Every 15 min. At */5 this polled 8,640 times/month to publish a handful of
// posts; most runs found an empty queue. 15 min keeps scheduling granularity
// acceptable for IG while cutting ~5,800 invocations/month.
export const config = { schedule: '*/15 * * * *' }

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

/** One immediate container-status check (no pre-wait). */
async function containerStatus(containerId: string, token: string): Promise<'FINISHED' | 'IN_PROGRESS' | 'ERROR'> {
  const data = await igFetch(
    `${IG_API}/${containerId}?fields=status_code,status&access_token=${token}`,
    undefined,
    2,
  ) as { status_code?: string }
  if (data.status_code === 'FINISHED') return 'FINISHED'
  if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') return 'ERROR'
  return 'IN_PROGRESS'
}

/** Short inline poll for fast media (images finish in seconds). */
async function pollStatus(containerId: string, token: string, maxAttempts = 4): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 4000))
    try {
      const s = await containerStatus(containerId, token)
      if (s === 'FINISHED') return true
      if (s === 'ERROR') return false
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
  media_type: 'FEED' | 'STORIES' | 'CAROUSEL' | 'REELS'
  image_urls: string[]
  caption: string | null
  location_id: string | null
  event_id: string | null
  container_id: string | null
}

type Supa = ReturnType<typeof supabaseAdmin>

// ── DB writes (always error-checked — silent failures wedge the queue) ───────

async function markPublished(supabase: Supa, rowId: string, postId: string) {
  const { error } = await supabase
    .from('ig_scheduled_posts')
    .update({ status: 'published', post_id: postId, published_at: new Date().toISOString() })
    .eq('id', rowId)
  if (error) console.error(`ig-publisher: FAILED to mark ${rowId} published (IG post ${postId} IS live):`, error.message)
}

async function markFailed(supabase: Supa, rowId: string, msg: string) {
  const { error } = await supabase
    .from('ig_scheduled_posts')
    .update({ status: 'failed', error_msg: msg.slice(0, 500) })
    .eq('id', rowId)
  if (error) console.error(`ig-publisher: FAILED to mark ${rowId} failed:`, error.message)
}

async function logPost(supabase: Supa, post: ScheduledPost, postId: string, slideCount: number) {
  const { error } = await supabase.from('ig_post_log').insert({
    post_id: postId,
    media_type: post.media_type,
    image_url: post.image_urls[0] ?? null,
    caption: post.caption,
    event_id: post.event_id,
    slide_count: slideCount,
    posted_at: new Date().toISOString(),
  })
  if (error) console.error(`ig-publisher: ig_post_log insert failed for ${postId}:`, error.message)
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

  // ── Phase 1: resume Reels whose container was created on a previous tick ──
  const { data: resumable, error: resumeErr } = await supabase
    .from('ig_scheduled_posts')
    .select('id, media_type, image_urls, caption, location_id, event_id, container_id')
    .eq('status', 'publishing')
    .not('container_id', 'is', null)
    .limit(5)

  if (resumeErr) {
    console.error('ig-publisher: resume fetch error:', resumeErr.message)
  } else {
    for (const post of (resumable ?? []) as ScheduledPost[]) {
      try {
        const status = await containerStatus(post.container_id as string, igToken)
        if (status === 'IN_PROGRESS') {
          console.log(`ig-publisher: ${post.id} container still processing, will retry next tick`)
          continue
        }
        if (status === 'ERROR') {
          await markFailed(supabase, post.id, `Container ${post.container_id} failed/expired during processing`)
          continue
        }
        const postId = await publishContainer(igUserId, igToken, post.container_id as string)
        await logPost(supabase, post, postId, 1)
        await markPublished(supabase, post.id, postId)
        console.log(`ig-publisher: resumed + published ${post.id} → IG post ${postId}`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`ig-publisher: resume failed for ${post.id}:`, msg)
        if (err instanceof TerminalError) await markFailed(supabase, post.id, msg)
        // Non-terminal errors: leave the row for the next tick.
      }
    }
  }

  // ── Phase 2: fresh pending posts due right now ─────────────────────────────
  const { data: posts, error: fetchErr } = await supabase
    .from('ig_scheduled_posts')
    .select('id, media_type, image_urls, caption, location_id, event_id, container_id')
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

      if (post.media_type === 'REELS') {
        // Stateful flow: create container → persist container_id → try one
        // quick status check. Video processing usually outlives this function,
        // so publishing happens in Phase 1 of a later tick if not ready now.
        const containerParams: Record<string, string> = {
          media_type: 'REELS',
          video_url: post.image_urls[0],
          share_to_feed: 'true',
        }
        if (post.caption) containerParams.caption = post.caption

        const containerId = await createContainer(igUserId, igToken, containerParams)
        const { error: saveErr } = await supabase
          .from('ig_scheduled_posts')
          .update({ container_id: containerId })
          .eq('id', post.id)
        if (saveErr) {
          // Without a persisted container_id the row can never resume — fail
          // it now rather than wedge it. (The orphan container just expires.)
          throw new Error(`Could not persist container_id ${containerId}: ${saveErr.message}`)
        }

        const status = await containerStatus(containerId, igToken).catch(() => 'IN_PROGRESS' as const)
        if (status !== 'FINISHED') {
          console.log(`ig-publisher: ${post.id} reel container ${containerId} processing — deferred to next tick`)
          continue
        }
        const postId = await publishContainer(igUserId, igToken, containerId)
        await logPost(supabase, post, postId, 1)
        await markPublished(supabase, post.id, postId)
        console.log(`ig-publisher: published ${post.id} → IG post ${postId}`)
        continue
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
        await logPost(supabase, post, postId, post.image_urls.length)
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
        await logPost(supabase, post, postId, 1)
      }

      await markPublished(supabase, post.id, postId)
      console.log(`ig-publisher: published ${post.id} → IG post ${postId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`ig-publisher: failed to publish ${post.id}:`, msg)
      await markFailed(supabase, post.id, msg)
    }
  }
}
