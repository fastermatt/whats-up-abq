/**
 * enrich-photos-dalle.mjs
 *
 * Generates illustrated/graphic event photos via DALL-E 3 for events that
 * have no cached_photo_url. Uploads to Supabase Storage and updates the row.
 *
 * Usage:
 *   node scripts/enrich-photos-dalle.mjs               # events missing photos
 *   node scripts/enrich-photos-dalle.mjs --dry-run     # preview prompts only
 *   node scripts/enrich-photos-dalle.mjs --limit=20    # cap at 20 images
 *   node scripts/enrich-photos-dalle.mjs --category=Music  # one category only
 *   node scripts/enrich-photos-dalle.mjs --all         # ALL events (overwrites existing)
 *
 * Requires: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load .env ─────────────────────────────────────────────────────────────────
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env.local'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
    break
  }
}

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY   = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY')
  process.exit(1)
}

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)
const dryRun      = 'dry-run' in args
const all         = 'all' in args
const limit       = args.limit ? parseInt(args.limit, 10) : 100
const onlyCategory = args.category ?? null

// ── Style constants ───────────────────────────────────────────────────────────
const STYLE =
  'Bold editorial graphic illustration. Southwestern New Mexico art style. ' +
  'Warm terracotta rust (#9a442d) and desert cream color palette with sage green accents. ' +
  'Flat graphic shapes with subtle painterly texture, strong silhouettes, ' +
  'no text, no logos, no readable signs, no human faces visible. ' +
  'Print poster aesthetic, square format.'

const CATEGORY_SCENES = {
  'Music':          'concert stage with guitar and microphone silhouettes, crowd below, dramatic stage lighting beams',
  'Comedy':         'comedy club spotlight on a wooden stage, microphone stand, warm intimate interior, arched ceiling',
  'Arts & Theater': 'dramatic theater proscenium arch, rich curtains drawn back, footlights glow, empty stage',
  'Festivals':      'outdoor festival grounds at dusk, string lights overhead, tent peaks, Sandia Mountain horizon',
  'Food & Drink':   'cozy restaurant interior, adobe archways, candlelit tables, hanging string lights, clay pottery',
  'Outdoor':        'Sandia Mountains peak silhouette at golden hour, sweeping desert landscape, hot air balloon',
  'Sports':         'stadium at night from above, floodlit playing field, geometric diamond or court pattern',
  'Family':         'sunny Albuquerque park, desert wildflowers, cottonwood trees, blue sky with clouds',
  'Film':           'classic movie theater interior, rows of velvet seats, projection light beam cutting through dark',
  'Community':      'warm community gathering, adobe building exterior, string lights, people silhouettes in conversation',
  'Nightlife':      'rooftop bar at night, Albuquerque city lights below, cocktail glasses, Sandia silhouette',
  'Holiday & Seasonal': 'New Mexico luminarias along an adobe wall at night, warm glowing candles, desert garden',
}

const DEFAULT_SCENE =
  'vibrant Albuquerque street scene at golden hour, Old Town adobe architecture, ' +
  'desert plants, Sandia Mountain silhouette on the horizon'

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildPrompt(event) {
  const scene = CATEGORY_SCENES[event.category] ?? DEFAULT_SCENE
  const venueHint = event.venue_name ? `, set near ${event.venue_name}` : ''
  return `${scene}${venueHint}. ${STYLE}`
}

async function generateImage(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API ${res.status}: ${text}`)
  }
  const data = await res.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('No image bytes in response')
  return { buffer: Buffer.from(b64, 'base64'), revisedPrompt: data?.data?.[0]?.revised_prompt }
}

async function uploadToStorage(supabase, buffer, eventId) {
  const digest = createHash('sha1').update(buffer).digest('hex').slice(0, 8)
  const filename = `event-photos/ai-illus/${eventId}_${digest}.jpg`
  const { error } = await supabase.storage
    .from('event-photos')
    .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return `${SUPABASE_URL}/storage/v1/object/public/event-photos/${filename}`
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  let query = supabase
    .schema('public')
    .from('events')
    .select('id, title: raw->name, category, venue_name, cached_photo_url')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true })
    .limit(limit)

  if (!all) {
    query = query.is('cached_photo_url', null)
  }
  if (onlyCategory) {
    query = query.eq('category', onlyCategory)
  }

  const { data: events, error } = await query
  if (error) { console.error('DB query failed:', error.message); process.exit(1) }
  if (!events?.length) { console.log('No events need photos.'); return }

  console.log(`\nFound ${events.length} event(s) to process${dryRun ? ' [DRY RUN]' : ''}\n`)

  let generated = 0
  let failed = 0

  for (const event of events) {
    const title = typeof event.title === 'string' ? event.title : (event.title?.text ?? event.id)
    const prompt = buildPrompt(event)

    console.log(`[${generated + failed + 1}/${events.length}] ${title}`)
    console.log(`  Category: ${event.category ?? 'unknown'} | Venue: ${event.venue_name ?? 'unknown'}`)

    if (dryRun) {
      console.log(`  Prompt: ${prompt.slice(0, 120)}…\n`)
      generated++
      continue
    }

    try {
      console.log(`  Generating…`)
      const { buffer, revisedPrompt } = await generateImage(prompt)

      console.log(`  Uploading…`)
      const url = await uploadToStorage(supabase, buffer, event.id)

      const { error: updateErr } = await supabase
        .schema('public')
        .from('events')
        .update({
          cached_photo_url: url,
          ai_enrichment: supabase.rpc ? undefined : { dalle_prompt: revisedPrompt ?? prompt },
        })
        .eq('id', event.id)

      if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`)

      console.log(`  ✓ ${url}\n`)
      generated++

      // Rate limit: DALL-E 3 allows ~5 imgs/min on standard tier
      await delay(13000)
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}\n`)
      failed++
      await delay(2000)
    }
  }

  console.log(`\nDone. Generated: ${generated} | Failed: ${failed}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
