#!/usr/bin/env node
/**
 * scrape-babydolls.mjs — scraper for babydollshouseofjazz.com
 *
 * Babydoll's House of Jazz & Blues — 6501 Americas Parkway Ste 110, Albuquerque NM
 * Site platform: Sociavore (no REST API, pure HTML scrape)
 *
 * Strategy:
 *   1. Fetch /events listing page → parse all event URLs
 *   2. For each event page, use DeepSeek to extract: title, date, time, description
 *   3. Images: pull imagedelivery.net URLs from page HTML, use /public variant for full-res
 *   4. Venue/address/category are fixed (it's a jazz club with live music)
 *   5. Upsert to Supabase with id='babydolls-{eventId}', source='local'
 *
 * Usage:
 *   node scripts/scrape-babydolls.mjs                # full run
 *   node scripts/scrape-babydolls.mjs --dry-run      # no DB writes
 *   node scripts/scrape-babydolls.mjs --limit=10     # first 10 events
 *   node scripts/scrape-babydolls.mjs --skip-images  # skip image hosting
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
if (!DEEPSEEK_KEY) { console.error('Missing DEEPSEEK_API_KEY'); process.exit(1) }

// ── Args ──────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2)
const DRY_RUN  = args.includes('--dry-run')
const SKIP_IMG = args.includes('--skip-images')
const LIMIT    = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '999')

const UA       = 'ABQUnplugged/2.0 (community aggregator; 4mattcarlson@gmail.com)'
const BASE_URL = 'https://babydollshouseofjazz.com'

// Fixed venue data — it's always the same location
const VENUE_NAME    = "Babydoll's House of Jazz & Blues"
const VENUE_ADDRESS = '6501 Americas Parkway Suite 110'
const VENUE_CITY    = 'Albuquerque'
const VENUE_ZIP     = '87110'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── HTTP ──────────────────────────────────────────────────────────────────────
async function httpGet(url, timeout = 15000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
      signal: AbortSignal.timeout(timeout),
    })
    return { ok: res.ok, status: res.status, text: res.ok ? await res.text() : null }
  } catch (e) {
    return { ok: false, error: e.message, text: null }
  }
}

// ── Image URL cleaning ────────────────────────────────────────────────────────
// Sociavore uses Cloudflare Images (imagedelivery.net).
// The listing page shows blur placeholders (blur=1,fit=contain,width=32) for event card images.
// The detail page header area has a venue background image (no blur params, small height).
// Strategy: prefer the FIRST blur thumbnail (it's the event card image), strip blur → /public.
// Skip tiny height-constrained images (format=auto,height=80 = venue logo).
function cleanImageUrl(url) {
  if (!url) return null
  const m = url.match(/^(https:\/\/imagedelivery\.net\/[^/]+\/[^/]+)\//)
  if (m) return m[1] + '/public'
  return url
}

function extractImageFromHtml(html) {
  const matches = [...html.matchAll(/https:\/\/imagedelivery\.net\/[^\s"'>]+/g)]
  if (matches.length === 0) return null

  const urls = matches.map(m => m[0])

  // Skip venue logo/header images (identified by small height param or format=auto,height)
  const notLogo = urls.filter(u => !u.includes('height=80') && !u.includes('format=auto,height'))

  // Prefer blur thumbnails — these are the event-specific card images (first one = main card)
  const blurImages = notLogo.filter(u => u.includes('blur=1'))
  if (blurImages.length > 0) return cleanImageUrl(blurImages[0])

  // Fallback: first non-logo image of any kind
  if (notLogo.length > 0) return cleanImageUrl(notLogo[0])
  return cleanImageUrl(urls[0])
}

// ── Date extraction from HTML ─────────────────────────────────────────────────
// Try to pull the date from HTML before sending to DeepSeek.
// Sociavore uses patterns like "Thursday, May 07" or "Friday, Jun 12" in the event header.
const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
}
function extractDateFromHtml(html) {
  // Try <time datetime="YYYY-MM-DD"> first (standard HTML5)
  const timeAttr = html.match(/datetime="(\d{4}-\d{2}-\d{2})"/i)
  if (timeAttr) return timeAttr[1]

  // Try JSON-LD startDate
  const jsonLd = html.match(/"startDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/)
  if (jsonLd) return jsonLd[1]

  // Try plain text pattern: "Thursday, May 07" / "Friday, Jun 12" / "Saturday, Jul 02"
  const textDate = html.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]{3})\s+(\d{1,2})/i)
  if (textDate) {
    const month = MONTH_MAP[textDate[1].toLowerCase().slice(0, 3)]
    const day   = textDate[2].padStart(2, '0')
    if (month) return `2026-${month}-${day}`
  }

  return null
}

// ── Time extraction from HTML ─────────────────────────────────────────────────
function extractTimeFromHtml(html) {
  // Pattern: "6:00pm - 10:00pm" or "10:00pm - 1:00am"
  const m = html.match(/(\d{1,2}:\d{2})\s*(?:am|pm)/i)
  if (!m) return null
  const [, raw] = m
  const isPm = html.match(/(\d{1,2}:\d{2})\s*(pm)/i)?.[2]?.toLowerCase() === 'pm'
  const [h, min] = raw.split(':').map(Number)
  let hour = h
  if (isPm && hour < 12) hour += 12
  if (!isPm && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// ── DeepSeek — extract description (date/time handled by HTML regex first) ────
async function deepseekExtract(eventUrl, html, knownDate, knownTime) {
  // Strip scripts/styles/nav/footer — but NOT <header> (Sociavore puts date in header sections)
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{3,}/g, '\n\n')
    .slice(0, 10000)

  // If we already have date/time from HTML parsing, tell DeepSeek to use them
  const dateHint = knownDate ? `The date has already been extracted as ${knownDate} — use this exactly.` : 'Extract the date from the page. Dates appear as e.g. "Thursday, May 07" or "Friday, Jun 12". Convert to YYYY-MM-DD using year 2026.'
  const timeHint = knownTime ? `The start time has already been extracted as ${knownTime} — use this exactly.` : 'Extract start time in HH:MM 24h format.'

  const prompt = `Extract event details from this Sociavore event page for Babydoll's House of Jazz & Blues in Albuquerque, NM.
URL: ${eventUrl}

Return ONLY a JSON object with these fields (no markdown, no explanation):
- title: string (clean event name, no venue name in it)
- date: string (YYYY-MM-DD — ${dateHint})
- startTime: string|null (HH:MM 24h — ${timeHint})
- description: string (describe the performers and show, max 350 chars, plain text)

HTML:
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
        temperature: 0.1,
        max_tokens: 300,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const text = json.choices[0].message.content.trim()
    const jsonStr = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    const data = JSON.parse(jsonStr)
    if (!data.title) throw new Error('Missing title')

    // Always prefer HTML-extracted date/time over DeepSeek's attempt
    if (knownDate) data.date = knownDate
    if (knownTime) data.startTime = knownTime
    if (!data.date) throw new Error('No date available')

    return data
  } catch (e) {
    console.error(`    DeepSeek error: ${e.message}`)
    return null
  }
}

// ── Image hosting ─────────────────────────────────────────────────────────────
async function hostImage(eventId, imageUrl) {
  if (!imageUrl || SKIP_IMG) return null

  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 4000) return null

    const hash = createHash('md5').update(buf).digest('hex').slice(0, 8)

    let uploadBuf = buf
    let ext = 'jpg'
    try {
      const { default: sharp } = await import('sharp')
      uploadBuf = await sharp(buf).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
      ext = 'webp'
    } catch { /* sharp not available */ }

    const filename = `${eventId}-${hash}.${ext}`

    // Check if already hosted
    const { data: existing } = await supabase.storage.from('event-photos').list('', { search: filename })
    if (existing && existing.length > 0) {
      const { data: { publicUrl } } = supabase.storage.from('event-photos').getPublicUrl(filename)
      return publicUrl
    }

    const { error } = await supabase.storage.from('event-photos').upload(
      filename, uploadBuf, { contentType: ext === 'webp' ? 'image/webp' : 'image/jpeg', upsert: false }
    )
    if (error) return null

    const { data: { publicUrl } } = supabase.storage.from('event-photos').getPublicUrl(filename)
    return publicUrl
  } catch { return null }
}

// ── Fetch event URLs from listing page ────────────────────────────────────────
// Also capture per-event card images from the listing (more reliable than detail page scrape)
async function fetchEventUrls() {
  const r = await httpGet(`${BASE_URL}/events`, 20000)
  if (!r.ok || !r.text) {
    console.error('Failed to fetch events listing page')
    return []
  }

  // Parse the HTML to find event cards: each card is a block containing the event link
  // and the event-specific card image. We extract both together to keep them paired.
  const html = r.text
  const byId = new Map()

  // Strategy: find all /events/{id}/{slug} hrefs, then look backwards in the HTML
  // for the nearest imagedelivery.net blur image (the card thumbnail for that event)
  const linkMatches = [...html.matchAll(/href="(\/events\/(\d+)\/([^"]+))"/g)]

  for (const [fullMatch, path, id, slug] of linkMatches) {
    if (byId.has(id)) continue

    // Find the position of this href in the HTML
    const pos = html.indexOf(fullMatch)

    // Look for the nearest imagedelivery.net URL within 2000 chars before this link
    // The card image appears before the link text in Sociavore's markup
    const searchWindow = html.slice(Math.max(0, pos - 2000), pos + 200)
    const imgMatches = [...searchWindow.matchAll(/https:\/\/imagedelivery\.net\/([^/]+)\/([^/]+)\//g)]

    // Prefer non-logo blur images; exclude tiny height-constrained images
    let cardImageUrl = null
    for (const m of [...imgMatches].reverse()) { // reverse = closest to event link first
      const fullUrl = m[0]
      if (fullUrl.includes('height=80') || fullUrl.includes('format=auto,height')) continue
      cardImageUrl = cleanImageUrl(fullUrl)
      break
    }

    byId.set(id, {
      id,
      slug,
      url: `${BASE_URL}${path}`,
      cardImageUrl, // event-specific card thumbnail from listing page
    })
  }

  const events = Array.from(byId.values())
  console.log(`  Found ${events.length} unique events on listing page`)
  return events
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🎷 scrape-babydolls ${DRY_RUN ? '— DRY RUN ' : ''}— limit=${LIMIT}`)
  console.log()

  // Load existing babydolls records
  const { data: existing } = await supabase.schema('public').from('events')
    .select('id, image_status, cached_photo_url').like('id', 'babydolls-%')
  const existingById = new Map((existing ?? []).map(e => [e.id, e]))
  console.log(`${existingById.size} existing babydolls events in DB\n`)

  // Get event list from listing page
  console.log('Fetching events from babydollshouseofjazz.com/events…')
  const eventList = await fetchEventUrls()
  const toProcess = eventList.slice(0, LIMIT)

  let inserted = 0, updated = 0, failed = 0, imagesHosted = 0

  for (let i = 0; i < toProcess.length; i++) {
    const { id: eventId, url: eventUrl, cardImageUrl } = toProcess[i]
    const recordId = `babydolls-${eventId}`

    process.stdout.write(`  [${i+1}/${toProcess.length}] ${recordId} — fetching… `)

    // Fetch the event page
    const pageRes = await httpGet(eventUrl, 12000)
    if (!pageRes.ok || !pageRes.text) {
      console.log(`HTTP ${pageRes.status ?? 'error'} — skip`)
      failed++
      await new Promise(r => setTimeout(r, 300))
      continue
    }

    // Image: prefer the card image from the listing page (event-specific, reliable)
    // Fall back to detail page extraction if listing didn't capture one
    const imageUrl = cardImageUrl ?? extractImageFromHtml(pageRes.text)

    // Pre-extract date/time with regex — more reliable than DeepSeek for simple patterns
    const htmlDate = extractDateFromHtml(pageRes.text)
    const htmlTime = extractTimeFromHtml(pageRes.text)

    // DeepSeek extracts title + description; date/time hints provided
    process.stdout.write('DeepSeek… ')
    const extracted = await deepseekExtract(eventUrl, pageRes.text, htmlDate, htmlTime)

    if (!extracted) {
      console.log('parse failed — skip')
      failed++
      await new Promise(r => setTimeout(r, 500))
      continue
    }

    // Skip past events
    const today = new Date().toISOString().slice(0, 10)
    if (extracted.date < today) {
      console.log(`past (${extracted.date}) — skip`)
      await new Promise(r => setTimeout(r, 200))
      continue
    }

    console.log(`${extracted.date} ${extracted.startTime ?? ''} | img:${imageUrl ? '✓' : '✗'}`)

    if (DRY_RUN) {
      console.log(`    → ${extracted.title}`)
      console.log(`    → ${imageUrl?.slice(0, 80) ?? 'no image'}`)
      if (existingById.has(recordId)) { updated++ } else { inserted++ }
      await new Promise(r => setTimeout(r, 200))
      continue
    }

    // Host image to Supabase Storage
    const prior = existingById.get(recordId)
    const adminRejected = prior?.image_status === 'rejected'
    let hostedUrl = adminRejected ? (prior?.cached_photo_url ?? null) : null

    if (!adminRejected && imageUrl) {
      const needsNewImage = !hostedUrl || !hostedUrl.includes('supabase')
      if (needsNewImage) {
        process.stdout.write(`    Hosting image… `)
        const url = await hostImage(recordId, imageUrl)
        if (url) { hostedUrl = url; imagesHosted++; console.log('✓') }
        else { console.log('✗ (will use source URL)') }
        await new Promise(r => setTimeout(r, 200))
      }
    }

    const finalPhotoUrl = adminRejected
      ? (prior?.cached_photo_url ?? null)
      : (hostedUrl ?? imageUrl ?? prior?.cached_photo_url ?? null)

    const finalImageStatus = adminRejected ? 'rejected'
      : hostedUrl ? 'verified'
      : finalPhotoUrl ? 'unverified'
      : null

    // Build event_date with time
    const eventDatetime = (extracted.startTime && extracted.startTime !== '00:00')
      ? `${extracted.date}T${extracted.startTime}:00-07:00`
      : extracted.date

    // Build raw payload (compatible with normalizeLocal())
    const raw = {
      id: recordId,
      url: eventUrl,
      name: extracted.title,
      description: extracted.description,
      info: extracted.description,
      image: imageUrl || null,
      images: imageUrl ? [{ url: imageUrl }] : [],
      dates: {
        start: {
          localDate: extracted.date,
          localTime: extracted.startTime || null,
        },
      },
      isFree: false,
      _source: 'local',
      _embedded: {
        venues: [{
          name:       VENUE_NAME,
          city:       { name: VENUE_CITY },
          state:      { name: 'NM' },
          address:    { line1: VENUE_ADDRESS },
          postalCode: VENUE_ZIP,
        }],
      },
      ticketLinks: [{ url: eventUrl }],
      babydolls_id:  eventId,
      scraped_at:    new Date().toISOString(),
      scraped_by:    'scrape-babydolls',
    }

    const row = {
      id: recordId,
      source: 'local',
      raw,
      event_date: eventDatetime,
      cached_photo_url: finalPhotoUrl,
      image_status: finalImageStatus,
      featured: false,
      category: 'Music',
      venue_name: VENUE_NAME,
    }

    const { error } = await supabase.schema('public').from('events')
      .upsert(row, { onConflict: 'id' })

    if (error) {
      console.log(`    ✗ DB error: ${error.message}`)
      failed++
    } else {
      const isNew = !existingById.has(recordId)
      console.log(`    ${isNew ? '✅ inserted' : '↑  updated'} | img:${hostedUrl ? '✓ supabase' : finalPhotoUrl ? '✓ src' : '✗'}`)
      if (isNew) { inserted++ } else { updated++ }
    }

    await new Promise(r => setTimeout(r, 400))
  }

  console.log()
  console.log(`✓ Done — inserted:${inserted} updated:${updated} failed:${failed} images_hosted:${imagesHosted}`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('CRASH:', err.stack || err)
  process.exit(2)
})
