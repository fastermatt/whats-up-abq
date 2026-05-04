// Netlify Scheduled Function — ig-scheduler
// Runs every 15 minutes. Picks up pending ig_scheduled_posts due for publishing
// and posts them to Instagram via the Graph API.
// Schedule: every 15 minutes (cron: "*/15 * * * *")

import { createClient } from '@supabase/supabase-js'

export const config = { schedule: '*/15 * * * *' }

const IG_API = 'https://graph.facebook.com/v19.0'

async function igPost(endpoint: string, token: string, params: Record<string, string>) {
  const body = new URLSearchParams({ access_token: token, ...params })
  const res = await fetch(`${IG_API}/${endpoint}`, { method: 'POST', body })
  return res.json()
}

async function igGet(endpoint: string, token: string, fields: string) {
  const params = new URLSearchParams({ access_token: token, fields })
  const res = await fetch(`${IG_API}/${endpoint}?${params}`)
  return res.json()
}

async function pollStatus(containerId: string, token: string, maxAttempts = 12): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const data = await igGet(containerId, token, 'status_code')
    if (data.status_code === 'FINISHED') return true
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') return false
  }
  return false
}

export default async (_req: Request): Promise<Response> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const igToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

  if (!supabaseUrl || !supabaseKey || !igToken || !igUserId) {
    console.error('ig-scheduler: Missing env vars')
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Fetch pending posts due now
  const { data: posts, error } = await supabase
    .from('ig_scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .limit(10)

  if (error) {
    console.error('ig-scheduler: Supabase query error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let processed = 0
  let failed = 0

  for (const post of posts ?? []) {
    try {
      const { media_type: mediaType, image_urls: imageUrls, caption, event_id: eventId } = post
      let creationId: string | null = null

      if (mediaType === 'FEED' || mediaType === 'STORIES') {
        const params: Record<string, string> = { image_url: imageUrls[0] }
        if (mediaType === 'STORIES') {
          params.media_type = 'STORIES'
        } else {
          params.caption = caption ?? ''
        }
        const result = await igPost(`${igUserId}/media`, igToken, params)
        if (result.error) throw new Error(result.error.message)
        creationId = result.id

      } else if (mediaType === 'CAROUSEL') {
        // Create child containers
        const childIds: string[] = []
        for (const url of imageUrls) {
          const child = await igPost(`${igUserId}/media`, igToken, {
            image_url: url,
            is_carousel_item: 'true',
          })
          if (child.error) throw new Error(`Child container error: ${child.error.message}`)
          childIds.push(child.id)
        }

        // Poll each child
        for (const childId of childIds) {
          const ready = await pollStatus(childId, igToken)
          if (!ready) throw new Error(`Child container ${childId} failed`)
        }

        // Parent container
        const parentParams: Record<string, string> = {
          media_type: 'CAROUSEL',
          children: childIds.join(','),
        }
        if (caption) parentParams.caption = caption
        const parent = await igPost(`${igUserId}/media`, igToken, parentParams)
        if (parent.error) throw new Error(`Parent container error: ${parent.error.message}`)
        creationId = parent.id
      }

      if (!creationId) throw new Error('No container ID created')

      // Poll
      const ready = await pollStatus(creationId, igToken)
      if (!ready) throw new Error(`Container ${creationId} not FINISHED after max attempts`)

      // Publish
      const publish = await igPost(`${igUserId}/media_publish`, igToken, { creation_id: creationId })
      if (publish.error) throw new Error(`Publish error: ${publish.error.message}`)

      const postId = publish.id

      // Mark as published
      await supabase
        .from('ig_scheduled_posts')
        .update({ status: 'published', post_id: postId, published_at: new Date().toISOString() })
        .eq('id', post.id)

      // Log to post log
      await supabase.from('ig_post_log').insert({
        post_id: postId,
        media_type: mediaType,
        image_url: imageUrls[0],
        caption: caption ?? null,
        event_id: eventId ?? null,
        slide_count: imageUrls.length,
        posted_at: new Date().toISOString(),
      })

      processed++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`ig-scheduler: Failed post ${post.id}:`, message)
      await supabase
        .from('ig_scheduled_posts')
        .update({ status: 'failed', error_msg: message })
        .eq('id', post.id)
      failed++
    }
  }

  console.log(`ig-scheduler: processed=${processed} failed=${failed}`)
  return new Response(JSON.stringify({ processed, failed }), { status: 200 })
}
