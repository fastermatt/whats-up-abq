#!/usr/bin/env node
/**
 * scrape-lovenm.mjs — scraper for lovenm.org events
 *
 * Love NM (formerly Collective YA) — community Christian outreach org in Albuquerque.
 * Site is a simple WordPress install (NOT The Events Calendar plugin).
 * Events live at /event/{slug}/ and are linked from the homepage.
 *
 * Strategy:
 *   1. Fetch homepage → extract all /event/ hrefs (dedup by slug)
 *   2. For each event page: pull og:title, og:image, og:description + body text
 *   3. Use DeepSeek to extract: date (YYYY-MM-DD), time (human-readable string or null)
 *   4. Upsert to Supabase with id='lovenm-{slug}', source='local'
 *   5. Time stored as raw.time (human-readable), picked up by normalizeLocal() r.time fallback
 *
 * Usage:
 *   node scripts/scrape-lovenm.mjs                # full run
 *   node scripts/scrape-lovenm.mjs --dry-run      # no DB writes
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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
const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

const UA       = 'ABQUnplugged/2.0 (community aggregator; 4mattcarlson@gmail.com)'
const BASE_URL = 'https://lovenm.org'

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

// ── Meta extraction ───────────────────────────────────────────────────────────
function extractOgMeta(html) {
  const get = (prop) => {
    const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'))
    return m ? m[1] : null
  }
  return {
    title: get('title'),
    description: get('description'),
    image: get('image'),
    url: get('url'),
  }
}

function extractBodyText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').replace(/&#8217;/g, "'")
    .replace(/\s{3,}/g, '\n')
    .trim()
    .slice(0, 4000)
}

// ── DeepSeek — extract date, time, AND full enrichment in one call ───────────
async function deepseekExtract(slug, title, bodyText, ogDesc) {
  const prompt = `You are extracting structured event data from a Love NM community event page in Albuquerque, NM.

Event slug: ${slug}
Event title: ${title}
og:description: ${ogDesc ?? '(none)'}
Body text (up to 3000 chars):
${bodyText.slice(0, 3000)}

Today's date is ${new Date().toISOString().slice(0, 10)}. All events on this page are UPCOMING (future). If a date like "June 25" would fall in the past for 2025, use 2026. Your extracted date MUST be >= ${new Date().toISOString().slice(0, 10)}.

Return ONLY a JSON object (no markdown, no explanation):
{
  "date": "YYYY-MM-DD",
  "time": "human-readable time range or null (e.g. '4:00 PM – 9:30 PM', 'Evening', null)",
  "venue": "venue name or null",
  "address": "street address or null",
  "description": "2-3 sentence plain-text description of what the event is and who it's for. No HTML, no nav boilerplate.",
  "about": "1-2 punchy sentences for an event listing card. Highlight what makes it compelling.",
  "highlights": ["bullet 1", "bullet 2", "bullet 3"],
  "artists": ["artist name", "..."],
  "schedule": [{"time": "3:00 PM", "act": "Doors Open"}, ...],
  "age_appeal": "all-ages | adult | kids | teens",
  "indoor_outdoor": "indoor | outdoor | both",
  "is_christian": true
}

Rules:
- date REQUIRED. If the page shows a weekday + month/day, trust month/day over weekday if they conflict.
- time: extract from schedule if available; null if not mentioned.
- artists: list of performer/artist names found on the page; empty array [] if none.
- schedule: extract the full schedule if listed; empty array [] if not mentioned.
- highlights: 2-4 specific bullet points about what attendees will experience.
- is_christian: true if event is explicitly Christian/faith-based/hosted by a church.
- Omit fields you cannot determine — do NOT hallucinate values.

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
        max_tokens: 600,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const text = json.choices[0].message.content.trim()
    const jsonStr = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error(`    DeepSeek error: ${e.message}`)
    return null
  }
}

// ── Get event URLs from homepage ──────────────────────────────────────────────
// Captures both internal lovenm.org/event/ links AND external event links
// (e.g. freedomabq.com) that appear in the events section of the homepage.
async function fetchEventSlugs() {
  const r = await httpGet(BASE_URL, 20000)
  if (!r.ok || !r.text) {
    console.error('Failed to fetch lovenm.org homepage')
    return []
  }

  const seen = new Set()
  const events = []

  // 1. Internal /event/ slugs
  const internalMatches = [...r.text.matchAll(/href=["'](https:\/\/lovenm\.org\/event\/([^/"]+)\/?)["']/g)]
  for (const [, , slug] of internalMatches) {
    if (!seen.has(slug)) {
      seen.add(slug)
      events.push({ slug, url: `${BASE_URL}/event/${slug}/`, external: false })
    }
  }

  // 2. External event URLs linked from the #events section.
  // Isolate the events section to avoid grabbing nav/footer links.
  const eventsSectionMatch = r.text.match(/id="events"([\s\S]*?)id="serving-opportunities"/)
  const eventsSection = eventsSectionMatch ? eventsSectionMatch[1] : ''

  // Known external event domains promoted by Love NM.
  // slug: stable ID suffix used for the DB record (year-scoped)
  // titleOverride: use this name instead of whatever the og:title says
  const EXTERNAL_EVENTS = [
    { domain: 'freedomabq.com', slug: 'freedom-celebration', titleOverride: 'Freedom Celebration' },
  ]
  for (const { domain, slug, titleOverride } of EXTERNAL_EVENTS) {
    const extMatches = [...eventsSection.matchAll(new RegExp(`href=["'](https?://${domain.replace('.', '\\.')}[^"']*)["']`, 'g'))]
    if (extMatches.length > 0 && !seen.has(slug)) {
      seen.add(slug)
      events.push({ slug, url: extMatches[0][1], external: true, titleOverride })
    }
  }

  return events
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`💜 scrape-lovenm ${DRY_RUN ? '— DRY RUN ' : ''}`)
  console.log()

  // Load existing lovenm records
  const { data: existing } = await supabase.schema('public').from('events')
    .select('id, image_status, cached_photo_url, ai_enrichment').like('id', 'lovenm-%')
  const existingById = new Map((existing ?? []).map(e => [e.id, e]))
  console.log(`${existingById.size} existing lovenm events in DB\n`)

  // Get event slugs from homepage
  console.log('Fetching events from lovenm.org…')
  const events = await fetchEventSlugs()
  console.log(`  Found ${events.length} unique event URLs\n`)

  if (events.length === 0) {
    console.log('No events found — exiting')
    return
  }

  let inserted = 0, updated = 0, failed = 0, skipped = 0

  for (let i = 0; i < events.length; i++) {
    const { slug, url, external } = events[i]
    // External events get a year-scoped ID so they re-upsert annually
    const recordId = external
      ? `lovenm-${slug}-${new Date().getFullYear()}`
      : `lovenm-${slug}`
    // Note: lovenm-freedom-celebration-2026 was manually inserted; the scraper
    // will upsert over it with the same ID, keeping data fresh.

    process.stdout.write(`  [${i+1}/${events.length}] ${recordId} — fetching… `)

    const pageRes = await httpGet(url, 12000)
    if (!pageRes.ok || !pageRes.text) {
      console.log(`HTTP ${pageRes.status ?? 'error'} — skip`)
      failed++
      continue
    }

    const meta = extractOgMeta(pageRes.text)
    const bodyText = extractBodyText(pageRes.text)

    // Clean title: use override for external events, strip suffixes for internal
    const rawTitle = meta.title ?? slug
    const title = events[i].titleOverride ?? rawTitle
      .replace(/\s*[-–]\s*Love\s*NM\s*$/i, '')
      .trim()

    process.stdout.write('DeepSeek… ')
    const extracted = await deepseekExtract(slug, title, bodyText, meta.description)

    if (!extracted || !extracted.date) {
      console.log('parse failed — skip')
      failed++
      await new Promise(r => setTimeout(r, 500))
      continue
    }

    // Skip past events
    const today = new Date().toISOString().slice(0, 10)
    if (extracted.date < today) {
      console.log(`past (${extracted.date}) — skip`)
      skipped++
      await new Promise(r => setTimeout(r, 200))
      continue
    }

    console.log(`${extracted.date} | time:${extracted.time ?? 'null'}`)

    if (DRY_RUN) {
      console.log(`    → ${title}`)
      console.log(`    → venue: ${extracted.venue ?? '(none)'} | ${extracted.address ?? '(no addr)'}`)
      console.log(`    → img: ${meta.image?.slice(0, 70) ?? 'none'}`)
      if (existingById.has(recordId)) { updated++ } else { inserted++ }
      await new Promise(r => setTimeout(r, 200))
      continue
    }

    // Build raw payload — compatible with normalizeLocal()
    const raw = {
      id: recordId,
      url,
      title,
      name: title,   // mirror — search pre-filter queries raw->>name
      description: extracted.description ?? null,
      image: meta.image ?? null,
      images: meta.image ? [{ url: meta.image }] : [],
      time: extracted.time ?? null,
      dates: { start: { localDate: extracted.date, localTime: null } },
      venue: extracted.venue ?? 'Albuquerque',
      address: extracted.address ?? null,
      city: 'Albuquerque',
      isFree: true,
      category: 'Community',
      ...(extracted.artists?.length ? { artists: extracted.artists } : {}),
      ...(extracted.schedule?.length ? { schedule: extracted.schedule } : {}),
      _source: 'lovenm',
      scraped_at: new Date().toISOString(),
      scraped_by: 'scrape-lovenm',
    }

    // Build ai_enrichment — preserve existing admin-set fields, layer in fresh data
    const prior = existingById.get(recordId)
    const existingEnrichment = prior?.ai_enrichment ?? {}
    const aiEnrichment = {
      ...existingEnrichment,
      ...(extracted.about       ? { about: extracted.about }             : {}),
      ...(extracted.highlights?.length ? { highlights: extracted.highlights } : {}),
      ...(extracted.age_appeal  ? { age_appeal: extracted.age_appeal }   : {}),
      ...(extracted.indoor_outdoor ? { indoor_outdoor: extracted.indoor_outdoor } : {}),
      ...(extracted.is_christian ? { christian_music: true, christian_artist: extracted.artists?.join(', ') || title } : {}),
      enriched_at: new Date().toISOString(),
      enriched_by: 'scrape-lovenm',
    }

    // Preserve admin-rejected image
    const adminRejected = prior?.image_status === 'rejected'
    const cachedPhotoUrl = adminRejected
      ? (prior?.cached_photo_url ?? null)
      : (meta.image ?? null)
    const imageStatus = adminRejected ? 'rejected'
      : meta.image ? 'unverified'
      : null

    const row = {
      id: recordId,
      source: 'local',
      raw,
      event_date: extracted.date,
      cached_photo_url: cachedPhotoUrl,
      image_status: imageStatus,
      ai_enrichment: aiEnrichment,
      featured: false,
      hidden: false,
      category: 'Community',
      venue_name: extracted.venue ?? 'Albuquerque',
    }

    const { error } = await supabase.schema('public').from('events')
      .upsert(row, { onConflict: 'id' })

    if (error) {
      console.log(`    ✗ DB error: ${error.message}`)
      failed++
    } else {
      const isNew = !existingById.has(recordId)
      console.log(`    ${isNew ? '✅ inserted' : '↑  updated'} | img:${meta.image ? '✓' : '✗'}`)
      if (isNew) { inserted++ } else { updated++ }
    }

    await new Promise(r => setTimeout(r, 500))
  }

  console.log()
  console.log(`✓ Done — inserted:${inserted} updated:${updated} skipped:${skipped} failed:${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('CRASH:', err.stack || err)
  process.exit(2)
})
