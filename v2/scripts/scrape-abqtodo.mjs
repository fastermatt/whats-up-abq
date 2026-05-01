#!/usr/bin/env node
/**
 * scrape-abqtodo.mjs — DeepSeek-powered scraping engine for abqtodo.com
 *
 * DeepSeek does the heavy lifting:
 *   ✅ Reads each event page's HTML and extracts ALL fields intelligently
 *   ✅ Finds the correct image URL from the page (not the broken API image)
 *   ✅ Parses dates and times correctly from the actual page content
 *   ✅ Classifies the category with full context
 *   ✅ Cleans up venue names (strips embedded addresses)
 *
 * The Tribe REST API is used only to get the list of event URLs.
 * Everything else comes from DeepSeek reading the real page HTML.
 *
 * Usage:
 *   node scripts/scrape-abqtodo.mjs                # full run
 *   node scripts/scrape-abqtodo.mjs --dry-run      # no DB writes
 *   node scripts/scrape-abqtodo.mjs --limit=20     # first 20 events
 *   node scripts/scrape-abqtodo.mjs --days=30      # 30-day window
 *   node scripts/scrape-abqtodo.mjs --skip-images  # skip image hosting
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createHash } from 'crypto'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Env ───────────────────────────────────────────────────────────────────────
for (const f of [join(__dir, '.env'), join(__dir, '../.env.local')]) {
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY

if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

// ── Args ──────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2)
const DRY_RUN   = args.includes('--dry-run')
const SKIP_IMG  = args.includes('--skip-images')
const LIMIT     = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '999')
const DAYS      = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] ?? '90')

const UA        = 'ABQUnplugged/2.0 (community aggregator; 4mattcarlson@gmail.com)'
const API_BASE  = 'https://abqtodo.com/wp-json/tribe/events/v1/events'

// Known placeholder image hashes — images that are NOT real event photos
const PLACEHOLDER_HASHES = new Set(['336632cc', 'e9bd5d12', '7a10f4c2'])

const ABQ_CITIES = new Set([
  'albuquerque', 'abq', 'rio rancho', 'bernalillo', 'los ranchos',
  'los ranchos de albuquerque', 'corrales', 'sandia park', 'tijeras',
  'cedar crest', 'placitas', 'edgewood',
])
const VIRTUAL_RE = /\b(virtual event|online (class|event|workshop|webinar)|zoom (webinar|meeting)|via zoom|livestream|live ?stream|webinar|google meet|microsoft teams)\b/i
const VALID_CATS = ['Music','Sports','Arts & Theater','Comedy','Family','Food & Drink','Film','Community','Festivals','Outdoor']

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── HTTP ──────────────────────────────────────────────────────────────────────
async function httpGet(url, timeout = 15000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/json,*/*' },
      signal: AbortSignal.timeout(timeout),
    })
    return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : null }
  } catch (e) {
    return { ok: false, error: e.message, text: null }
  }
}

// ── DeepSeek — core extraction engine ────────────────────────────────────────
/**
 * Send a cleaned event page HTML to DeepSeek and get back structured data.
 * DeepSeek handles all the intelligence: finding the right image, parsing dates,
 * cleaning venue names, classifying category, etc.
 */
async function deepseekExtract(eventUrl, html) {
  // Strip scripts, styles, nav, footer to reduce tokens but keep event content
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{3,}/g, '\n\n')
    .slice(0, 12000) // ~3k tokens — enough for the event content

  const prompt = `You are extracting structured event data from an abqtodo.com event page.
URL: ${eventUrl}

Extract ALL of the following from the HTML. Return ONLY a single JSON object, no markdown, no explanation.

Required fields:
- title: string (clean event name, no HTML entities)
- date: string (YYYY-MM-DD format)
- time: string|null (HH:MM 24h format, null if all-day)
- venue: string (venue/location name ONLY — not the street address. e.g. "Taylor Ranch Library" not "5700 Bogart St NW")
- address: string|null (street address if available)
- city: string (default "Albuquerque")
- description: string (clean text description, max 400 chars, no HTML)
- imageUrl: string|null (the BEST quality image URL from the page — look for og:image meta tag first, then the largest <img> inside the event content. Must be an absolute https:// URL. null if no real image found)
- category: string (exactly one of: Music, Sports, Arts & Theater, Comedy, Family, Food & Drink, Film, Community, Festivals, Outdoor)
- price: string (e.g. "Free", "$15", "$10–$25". Default "Free" if not mentioned)
- isFree: boolean

Category rules:
- Yoga/Pilates/Zumba/fitness → Sports
- Plays/musicals/dance performances/ballet → Arts & Theater
- Library programs/book clubs/civic meetings → Community
- LEGO/Storytime/kids crafts/children's programs → Family
- Concerts/bands/live music/open mic → Music
- Craft fairs/farmers markets (non-food focus) → Community
- Knitting/sewing/needlecraft clubs → Community

HTML content:
${cleaned}

Return only the JSON object:`

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 512,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const text = json.choices[0].message.content.trim()

    // Parse JSON — handle code blocks if DeepSeek wraps it
    const jsonStr = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    const data = JSON.parse(jsonStr)

    // Validate required fields
    if (!data.title || !data.date) throw new Error('Missing title or date')
    if (!VALID_CATS.includes(data.category)) data.category = 'Community'

    return data
  } catch (e) {
    return null // Caller handles failure
  }
}

// ── Image hosting ─────────────────────────────────────────────────────────────
async function hostImage(eventId, imageUrl) {
  if (!imageUrl || SKIP_IMG) return null
  if (!imageUrl.startsWith('http')) return null

  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 4000) return null // Too small = placeholder

    const hash = createHash('md5').update(buf).digest('hex').slice(0, 8)
    if (PLACEHOLDER_HASHES.has(hash)) {
      console.log(`    ⚠ Placeholder hash ${hash}`)
      return null
    }

    // Resize with sharp if available
    let uploadBuf = buf
    let ext = 'jpg'
    try {
      const { default: sharp } = await import('sharp')
      uploadBuf = await sharp(buf).resize({ width: 1080, withoutEnlargement: false }).webp({ quality: 82 }).toBuffer()
      ext = 'webp'
    } catch { /* sharp not available — upload original */ }

    const filename = `${eventId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('event-photos').upload(
      filename, uploadBuf, { contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg', upsert: false }
    )
    if (error) return null

    const { data: { publicUrl } } = supabase.storage.from('event-photos').getPublicUrl(filename)
    return publicUrl
  } catch { return null }
}

// ── Tribe API — get event URL list ────────────────────────────────────────────
async function fetchEventUrls() {
  const today   = new Date().toISOString().slice(0, 10)
  const endDate = new Date(Date.now() + DAYS * 86400000).toISOString().slice(0, 10)
  const bySlug  = new Map()
  let page = 1

  while (page <= 50) {
    const url = `${API_BASE}?per_page=50&status=publish&start_date=${today}&end_date=${endDate}&page=${page}`
    const r = await httpGet(url, 20000)
    if (!r.ok || !r.text) { console.error(`  API page ${page} failed`); break }

    let data
    try { data = JSON.parse(r.text) } catch { break }

    const events = data.events || []
    if (events.length === 0) break

    for (const ev of events) {
      const slug = ev.slug || `id-${ev.id}`
      const existing = bySlug.get(slug)
      if (!existing || (ev.start_date || '') < (existing.start_date || '')) {
        bySlug.set(slug, ev)
      }
    }

    console.log(`  API page ${page}/${data.total_pages ?? '?'}: ${events.length} events (${bySlug.size} unique)`)
    if (page >= (data.total_pages || 1)) break
    page++
    await new Promise(r => setTimeout(r, 250))
  }

  return Array.from(bySlug.values()).sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🤖 scrape-abqtodo (DeepSeek engine) ${DRY_RUN ? '— DRY RUN ' : ''}— ${DAYS}d window, limit=${LIMIT}`)
  console.log()

  // Load existing abqtodo records
  const { data: existing } = await supabase.schema('public').from('events')
    .select('id, image_status, cached_photo_url').like('id', 'abqtodo-%')
  const existingById = new Map((existing ?? []).map(e => [e.id, e]))
  console.log(`${existingById.size} existing abqtodo events in DB\n`)

  // Get event list from API
  console.log('Fetching event list from Tribe API…')
  const apiEvents = await fetchEventUrls()
  console.log(`\nTotal: ${apiEvents.length} events from API`)

  const toProcess = apiEvents.slice(0, LIMIT)
  console.log(`Processing: ${toProcess.length}\n`)

  let inserted = 0, updated = 0, blocked = 0, failed = 0, imagesHosted = 0
  const failedIds = []

  for (let i = 0; i < toProcess.length; i++) {
    const apiEv   = toProcess[i]
    const id      = `abqtodo-${apiEv.id}`
    const venue   = apiEv.venue || {}
    const eventUrl = apiEv.url || `https://abqtodo.com/event/${apiEv.slug || ''}/`

    // Quick city filter from API (saves a page fetch for out-of-metro events)
    const city = (venue.city || '').toLowerCase().replace(/,?\s*(nm|new mexico)\s*$/i, '').trim()
    if (city && !ABQ_CITIES.has(city)) {
      console.log(`  [${i+1}/${toProcess.length}] ⊘ out_of_metro:${city}`)
      blocked++
      continue
    }

    process.stdout.write(`  [${i+1}/${toProcess.length}] Fetching page… `)

    // Fetch the actual event page
    const pageRes = await httpGet(eventUrl, 12000)
    if (!pageRes.ok || !pageRes.text) {
      console.log(`HTTP ${pageRes.status ?? 'error'} — skip`)
      failed++
      failedIds.push(id)
      await new Promise(r => setTimeout(r, 300))
      continue
    }

    // Virtual event check on page HTML
    if (VIRTUAL_RE.test(pageRes.text.slice(0, 3000))) {
      console.log('virtual — skip')
      blocked++
      await new Promise(r => setTimeout(r, 300))
      continue
    }

    // DeepSeek extracts everything
    process.stdout.write('DeepSeek… ')
    const extracted = await deepseekExtract(eventUrl, pageRes.text)

    if (!extracted) {
      console.log('parse failed — skip')
      failed++
      failedIds.push(id)
      await new Promise(r => setTimeout(r, 500))
      continue
    }

    console.log(`${extracted.date}${extracted.time ? ' '+extracted.time : ''} | ${extracted.category} | img:${extracted.imageUrl ? '✓' : '✗'}`)

    if (DRY_RUN) {
      console.log(`    → ${extracted.title} @ ${extracted.venue}`)
      console.log(`    → ${extracted.price} | ${extracted.imageUrl?.slice(0, 60) ?? 'no image'}`)
      if (existingById.has(id)) { updated++ } else { inserted++ }
      await new Promise(r => setTimeout(r, 200))
      continue
    }

    // Host image to Supabase Storage
    const prior = existingById.get(id)
    // Only preserve ADMIN rejections (flagged via the admin UI reject button).
    // Old pipeline rejections (from host-event-images.mjs) can be overridden
    // by the new scraper since DeepSeek finds the correct og:image.
    const adminRejected = prior?.image_status === 'rejected' && prior?.ai_enrichment?.admin_rejected === true
    let hostedUrl = adminRejected ? (prior?.cached_photo_url ?? null) : null
    // Keep existing Supabase-hosted image if we have one and DeepSeek found no new image
    if (!hostedUrl && prior?.cached_photo_url?.includes('supabase') && !extracted.imageUrl) {
      hostedUrl = prior.cached_photo_url
    }

    if (!adminRejected && extracted.imageUrl) {
      const needsNewImage = !hostedUrl || !hostedUrl.includes('supabase')
      if (needsNewImage) {
        const url = await hostImage(id, extracted.imageUrl)
        if (url) { hostedUrl = url; imagesHosted++ }
        await new Promise(r => setTimeout(r, 200))
      }
    }

    // Build raw payload
    const raw = {
      id,
      url: eventUrl,
      name: extracted.title,
      description: extracted.description,
      info: extracted.description,
      image: extracted.imageUrl || null,
      images: extracted.imageUrl ? [{ url: extracted.imageUrl }] : [],
      dates: {
        start: {
          localDate: extracted.date,
          localTime: extracted.time || null,
        },
      },
      isFree: extracted.isFree ?? extracted.price === 'Free',
      _source: 'local',
      _embedded: {
        venues: [{
          name: extracted.venue || 'Albuquerque',
          city:  { name: extracted.city || 'Albuquerque' },
          state: { name: 'NM' },
          address: { line1: extracted.address || '' },
        }],
      },
      ticketLinks: [{ url: eventUrl }],
      abqtodo_id:   apiEv.id,
      abqtodo_slug: apiEv.slug,
      scraped_at:   new Date().toISOString(),
      scraped_by:   'deepseek-v3',
    }

    const eventDatetime = (extracted.time && extracted.time !== '00:00')
      ? `${extracted.date}T${extracted.time}:00-07:00`
      : extracted.date

    const row = {
      id,
      source: 'local',
      raw,
      event_date: eventDatetime,
      cached_photo_url: adminRejected ? (prior?.cached_photo_url ?? null) : (hostedUrl ?? null),
      image_status: adminRejected ? 'rejected' : (hostedUrl ? 'verified' : null),
      featured: false,
      hidden: false,
      category: extracted.category,
      venue_name: extracted.venue || null,
    }

    const { error } = await supabase.schema('public').from('events')
      .upsert(row, { onConflict: 'id' })

    if (error) {
      console.log(`    ✗ DB error: ${error.message}`)
      failed++
      failedIds.push(id)
    } else {
      const isNew = !existingById.has(id)
      console.log(`    ${isNew ? '✅ inserted' : '↑  updated'} | img:${hostedUrl ? '✓ supabase' : '✗ none'}`)
      if (isNew) { inserted++ } else { updated++ }
    }

    // Polite delay between pages
    await new Promise(r => setTimeout(r, 450))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 scrape-abqtodo (DeepSeek) complete
   Inserted      : ${inserted}
   Updated       : ${updated}
   Blocked       : ${blocked}
   Failed        : ${failed}
   Images hosted : ${imagesHosted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  if (failedIds.length > 0) {
    console.log(`\nFailed IDs (re-run with --limit to retry):`)
    failedIds.forEach(id => console.log(`  ${id}`))
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
