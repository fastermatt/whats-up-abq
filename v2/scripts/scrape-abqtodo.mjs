#!/usr/bin/env node
/**
 * scrape-abqtodo.mjs — DeepSeek-powered scraping engine for abqtodo.com
 *
 * The Tribe REST API is the source of truth for event identity, date, time,
 * venue, description, price, and image. DeepSeek optionally improves category
 * classification and copy, but a failed or truncated AI response can never
 * prevent a valid Tribe event from importing.
 *
 * The Tribe REST API provides: event URL list + direct image URLs.
 * The API returns ev.image.url / ev.image.sizes.large.url for each event —
 * these are used as the primary image source (no DeepSeek og:image extraction needed).
 * DeepSeek imageUrl is kept as a fallback for events the API returns without an image.
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
import {
  prepareEventImage,
  removeSupersededImage,
  uploadPreparedImage,
} from './lib/event-image-pipeline.mjs'

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
  } catch (error) {
    return { ok: false, error: error.message, text: null }
  }
}

function htmlToText(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
}

function classifyTribeEvent(apiEv) {
  const taxonomy = (apiEv.categories ?? []).map(cat => `${cat.name} ${cat.slug}`).join(' ')
  const haystack = htmlToText(`${apiEv.title ?? ''} ${taxonomy} ${apiEv.description ?? ''}`).toLowerCase()

  const rules = [
    ['Comedy', /\b(comedy|comedian|improv|stand[ -]?up)\b/],
    ['Film', /\b(film|movie|cinema|screening)\b/],
    ['Music', /\b(concert|music|musical artist|band|singer|dj|open mic|orchestra|symphony)\b/],
    ['Sports', /\b(sport|fitness|yoga|pilates|zumba|run|race|game|tournament|soccer|baseball|basketball|football|hockey)\b/],
    ['Outdoor', /\b(outdoor|hike|hiking|trail|nature walk|birding|camping|climbing)\b/],
    ['Food & Drink', /\b(food|drink|beer|brew|wine|cocktail|restaurant|dinner|brunch|tasting|culinary)\b/],
    ['Festivals', /\b(festival|fiesta|fair|parade|celebration)\b/],
    ['Family', /\b(family|families|kids?|children|childrens|storytime|lego|teen|youth)\b/],
    ['Arts & Theater', /\b(art|arts|theatre|theater|play|ballet|dance performance|gallery|museum|exhibit)\b/],
  ]

  return rules.find(([, pattern]) => pattern.test(haystack))?.[0] ?? 'Community'
}

function tribeExtract(apiEv) {
  const start = apiEv.start_date_details ?? {}
  const values = apiEv.cost_details?.values ?? []
  const cost = htmlToText(apiEv.cost ?? '')
  const isFree = values.length === 0 && (!cost || /\bfree\b/i.test(cost))
  const description = htmlToText(apiEv.description ?? apiEv.excerpt ?? '').slice(0, 400)

  return {
    title: htmlToText(apiEv.title) || `ABQ event ${apiEv.id}`,
    date: [start.year, start.month, start.day].every(Boolean)
      ? `${start.year}-${start.month}-${start.day}`
      : String(apiEv.start_date ?? '').slice(0, 10),
    time: apiEv.all_day ? null : [start.hour, start.minutes].every(v => v != null)
      ? `${String(start.hour).padStart(2, '0')}:${String(start.minutes).padStart(2, '0')}`
      : (String(apiEv.start_date ?? '').slice(11, 16) || null),
    venue: htmlToText(apiEv.venue?.venue) || 'Albuquerque',
    address: htmlToText(apiEv.venue?.address) || null,
    city: htmlToText(apiEv.venue?.city) || 'Albuquerque',
    description,
    imageUrl: apiEv.image?.sizes?.large?.url ?? apiEv.image?.url ?? null,
    category: classifyTribeEvent(apiEv),
    price: isFree ? 'Free' : (cost || 'See event page'),
    isFree,
  }
}

// ── DeepSeek — core extraction engine ────────────────────────────────────────
/**
 * Send a cleaned event page HTML to DeepSeek and get back structured data.
 * DeepSeek handles all the intelligence: finding the right image, parsing dates,
 * cleaning venue names, classifying category, etc.
 */
async function deepseekExtract(eventUrl, html) {
  if (!DEEPSEEK_KEY || !html) return null
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
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        temperature: 0.1,
        max_tokens: 900,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('Empty response')

    // Parse JSON — handle code blocks if DeepSeek wraps it
    const jsonStr = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    const data = JSON.parse(jsonStr)

    // Validate required fields
    if (!data.title || !data.date) throw new Error('Missing title or date')
    if (!VALID_CATS.includes(data.category)) data.category = 'Community'

    return data
  } catch (error) {
    console.warn(`DeepSeek extraction failed: ${error.message}`)
    return null
  }
}

// ── Image hosting ─────────────────────────────────────────────────────────────
async function hostImage(eventId, imageUrl) {
  if (!imageUrl || SKIP_IMG || !imageUrl.startsWith('http')) {
    return { ok: false, reason: 'skipped', permanent: false }
  }

  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { ok: false, reason: `http-${res.status}`, permanent: false }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 4000) return { ok: false, reason: 'too-small-bytes', permanent: true }

    const hash = createHash('md5').update(buf).digest('hex').slice(0, 8)
    if (PLACEHOLDER_HASHES.has(hash)) {
      console.log(`    ⚠ Placeholder hash ${hash}`)
      return { ok: false, reason: `placeholder-${hash}`, permanent: true }
    }

    const prepared = await prepareEventImage(buf)
    if (!prepared.ok) {
      return {
        ok: false,
        reason: prepared.reason,
        permanent: prepared.quality === 'rejected',
        prepared,
      }
    }

    const uploaded = await uploadPreparedImage(supabase, eventId, prepared)
    if (!uploaded.ok) return { ok: false, reason: uploaded.reason, permanent: false }
    return { ok: true, ...uploaded, prepared }
  } catch (error) {
    return { ok: false, reason: error.message, permanent: false }
  }
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

async function fetchExistingEvents() {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.schema('public').from('events')
      .select('id, image_status, cached_photo_url, image_width, image_height, image_bytes, image_hash, image_quality')
      .like('id', 'abqtodo-%')
      .range(offset, offset + 999)
    if (error) throw new Error(`Existing ABQtodo query failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🤖 scrape-abqtodo (DeepSeek engine) ${DRY_RUN ? '— DRY RUN ' : ''}— ${DAYS}d window, limit=${LIMIT}`)
  console.log()

  // Load existing abqtodo records
  const existing = await fetchExistingEvents()
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

    const baseline = tribeExtract(apiEv)

    // Fetch the actual event page for optional AI enrichment. The Tribe API is
    // complete enough to import safely even if the page or AI service is down.
    const pageRes = await httpGet(eventUrl, 12000)

    // Virtual event check on page HTML
    if (apiEv.is_virtual || (pageRes.text && VIRTUAL_RE.test(pageRes.text.slice(0, 3000)))) {
      console.log('virtual — skip')
      blocked++
      await new Promise(r => setTimeout(r, 300))
      continue
    }

    // Tribe API provides image directly — prefer large size, fall back to full URL
    // This is more reliable than asking DeepSeek to find og:image in HTML.
    const apiImageUrl = apiEv.image?.sizes?.large?.url
      ?? apiEv.image?.sizes?.medium?.url
      ?? apiEv.image?.url
      ?? null

    // DeepSeek is enrichment, not a gate. Keep authoritative API date/time and
    // location fields so a hallucination cannot move an event.
    process.stdout.write(pageRes.text ? 'DeepSeek… ' : `page HTTP ${pageRes.status ?? 'error'}; API baseline… `)
    const ai = pageRes.text ? await deepseekExtract(eventUrl, pageRes.text) : null
    const extracted = {
      ...baseline,
      category: ai && VALID_CATS.includes(ai.category) ? ai.category : baseline.category,
    }

    // Candidate image: API image first, DeepSeek extraction as fallback
    const candidateImageUrl = apiImageUrl ?? extracted.imageUrl ?? null

    console.log(`${extracted.date}${extracted.time ? ' '+extracted.time : ''} | ${extracted.category} | img:${candidateImageUrl ? (apiImageUrl ? '✓api' : '✓ds') : '✗'}`)

    if (DRY_RUN) {
      console.log(`    → ${extracted.title} @ ${extracted.venue}`)
      console.log(`    → ${extracted.price} | ${candidateImageUrl?.slice(0, 70) ?? 'no image'}`)
      if (existingById.has(id)) { updated++ } else { inserted++ }
      await new Promise(r => setTimeout(r, 200))
      continue
    }

    // Host image to Supabase Storage
    const prior = existingById.get(id)
    // A rejection is an admin-owned decision. The old check depended on an
    // ai_enrichment flag that the admin API never wrote, so imports could undo it.
    const adminRejected = prior?.image_status === 'rejected'
    const previousHostedUrl = prior?.cached_photo_url?.includes('supabase')
      ? prior.cached_photo_url
      : null
    let hostedUrl = adminRejected ? null : previousHostedUrl
    let hostedResult = null

    if (!adminRejected && candidateImageUrl && !SKIP_IMG) {
      hostedResult = await hostImage(id, candidateImageUrl)
      if (hostedResult.ok) {
        hostedUrl = hostedResult.url
        if (!hostedResult.reused) imagesHosted++
      } else {
        console.log(`    ⚠ image not hosted: ${hostedResult.reason}`)
      }
      await new Promise(r => setTimeout(r, 200))
    }

    // Final photo URL: Supabase-hosted > Tribe API/DeepSeek URL > prior DB URL (never wipe)
    // abqtodo.com URLs work through EventImage's /api/image-proxy — storing them directly is fine
    const permanentlyRejected = hostedResult?.permanent === true && !hostedUrl
    const finalPhotoUrl = adminRejected || permanentlyRejected
      ? null
      : (hostedUrl ?? candidateImageUrl ?? prior?.cached_photo_url ?? null)

    const finalImageStatus = adminRejected
      ? 'rejected'
      : permanentlyRejected
        ? 'rejected'
        : hostedUrl
          ? (prior?.image_status === 'verified' && hostedUrl === previousHostedUrl ? 'verified' : 'unverified')
        : finalPhotoUrl
          ? 'unverified'
          : null

    // Build raw payload
    const raw = {
      id,
      url: eventUrl,
      name: extracted.title,
      description: extracted.description,
      info: extracted.description,
      image: candidateImageUrl || null,
      images: candidateImageUrl ? [{ url: candidateImageUrl }] : [],
      api_image: apiImageUrl || null,    // raw Tribe API image URL for reference
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
          // Prefer Tribe API venue fields when present (real street addresses)
          // over DeepSeek's HTML extraction, which often returns empty strings
          // for the address even when Tribe has the data. This was the root
          // cause of the local-events-have-street-addresses regression where
          // 305 of 376 local events lacked addresses (2026-05-09 fix).
          city:  { name: apiEv.venue?.city  || extracted.city || 'Albuquerque' },
          state: { name: apiEv.venue?.state || 'NM' },
          address: { line1: apiEv.venue?.address || extracted.address || '' },
          postalCode: apiEv.venue?.zip || '',
        }],
      },
      ticketLinks: [{ url: eventUrl }],
      abqtodo_id:   apiEv.id,
      abqtodo_slug: apiEv.slug,
      scraped_at:   new Date().toISOString(),
      scraped_by:   ai ? 'tribe-api+deepseek-v4' : 'tribe-api',
    }

    const eventDatetime = (extracted.time && extracted.time !== '00:00')
      ? `${extracted.date}T${extracted.time}:00-07:00`
      : extracted.date

    const row = {
      id,
      source: 'local',
      raw,
      event_date: eventDatetime,
      cached_photo_url: finalPhotoUrl,
      image_status: finalImageStatus,
      featured: false,
      hidden: false,
      category: extracted.category,
      venue_name: extracted.venue || null,
      image_width: hostedResult?.ok ? hostedResult.prepared.srcW : (prior?.image_width ?? null),
      image_height: hostedResult?.ok ? hostedResult.prepared.srcH : (prior?.image_height ?? null),
      image_bytes: hostedResult?.ok ? hostedResult.prepared.outSize : (prior?.image_bytes ?? null),
      image_hash: hostedResult?.ok ? hostedResult.prepared.hash : (prior?.image_hash ?? null),
      image_quality: permanentlyRejected
        ? 'rejected'
        : hostedResult?.ok
          ? hostedResult.prepared.quality
          : (prior?.image_quality ?? null),
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
      if (hostedResult?.ok) {
        const cleanup = await removeSupersededImage({
          supabase,
          previousUrl: previousHostedUrl,
          nextUrl: hostedResult.url,
          supabaseUrl: SUPABASE_URL,
        })
        if (cleanup.removed) console.log(`    🧹 removed superseded image: ${cleanup.key}`)
      }
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
