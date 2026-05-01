#!/usr/bin/env node
/**
 * enrich-about-deepseek.mjs
 *
 * Enriches ABQ Unplugged events with AI-generated editorial content via DeepSeek,
 * replacing the LM Studio / Gemma 4B step in the ingest pipeline.
 *
 * Fields written to ai_enrichment (JSONB):
 *   about          — 1-2 sentences about the performer / event
 *   highlights     — 2-3 bullet points on what to expect
 *   venue_tips     — neighborhood + parking / arrival info
 *   nearby_dining  — [{name, why}] pre-seeded from KNOWN_VENUES
 *   local_rec      — one verifiable insider tip
 *
 * Advantages over Gemma/LM Studio:
 *   - 5× concurrent calls → 500 events in ~3 minutes vs 7 hours
 *   - DeepSeek V4 Flash follows complex hallucination-prevention rules reliably
 *   - No LM Studio dependency — runs anywhere
 *   - Cost: ~$0.50–0.80 for a full 500-event catch-up; cents for weekly increments
 *
 * Usage:
 *   node scripts/enrich-about-deepseek.mjs                  # incremental (skip enriched)
 *   node scripts/enrich-about-deepseek.mjs --limit=50       # cap at 50
 *   node scripts/enrich-about-deepseek.mjs --force          # re-enrich everything
 *   node scripts/enrich-about-deepseek.mjs --dry-run        # preview prompt, no writes
 *   node scripts/enrich-about-deepseek.mjs --source=nhcc   # single source
 *   node scripts/enrich-about-deepseek.mjs --id=tm-123456   # single event
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Env ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  for (const f of [join(__dir, '.env'), join(__dir, '../.env.local'), join(__dir, '../.env')]) {
    if (existsSync(f)) {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
      }
    }
  }
}
loadEnv()

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEEPSEEK_KEY  = process.env.DEEPSEEK_API_KEY ?? 'REDACTED_DEEPSEEK_KEY'

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase credentials'); process.exit(1) }

// ── Args ──────────────────────────────────────────────────────────────────────
const argv      = process.argv.slice(2)
const DRY_RUN   = argv.includes('--dry-run')
const FORCE     = argv.includes('--force')
const LIMIT     = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '500')
const SOURCE    = argv.find(a => a.startsWith('--source='))?.split('=')[1] ?? null
const SINGLE_ID = argv.find(a => a.startsWith('--id='))?.split('=')[1] ?? null
const CONCURRENCY = 5   // parallel DeepSeek calls

// ── Venue knowledge base ──────────────────────────────────────────────────────
// Pre-seeded neighborhood + parking + dining data for known ABQ venues.
// Injected into prompts so DeepSeek doesn't need to hallucinate local geography.
const KNOWN_VENUES = {
  'nexus brewery': {
    neighborhood: 'near I-25 / Pan American Freeway in northeast Albuquerque (midtown, close to Uptown)',
    parking: 'Large parking lot on-site.',
    nearby_dining: [
      { name: "Flying Star Cafe (Juan Tabo)", why: "Excellent NM comfort food, great green chile, 10 min away" },
      { name: "Gecko's Bar & Tapas (Montgomery)", why: "Lively bar, solid pub grub, 5 min drive" },
    ],
  },
  'isleta amphitheater': {
    neighborhood: 'in the South Valley near I-25 south',
    parking: 'Large parking lots on-site; expect heavy traffic — arrive 45–60 min early for big shows.',
    nearby_dining: [
      { name: "El Pinto (4th St NW)", why: "Legendary NM restaurant with a huge patio; 20 min north" },
      { name: "Garcia's Kitchen (Central)", why: "Classic NM diner, open late, green chile everything" },
    ],
  },
  'isleta amphitheatre': {
    neighborhood: 'in the South Valley near I-25 south',
    parking: 'Large parking lots on-site; expect heavy traffic — arrive 45–60 min early for big shows.',
    nearby_dining: [
      { name: "El Pinto (4th St NW)", why: "Legendary NM restaurant with a huge patio; 20 min north" },
      { name: "Garcia's Kitchen (Central)", why: "Classic NM diner, open late, green chile everything" },
    ],
  },
  'first financial credit union amphitheater': {
    neighborhood: 'in the South Valley near I-25 south',
    parking: 'Large parking lots on-site; expect heavy traffic — arrive 45–60 min early for big shows.',
    nearby_dining: [
      { name: "El Pinto (4th St NW)", why: "Legendary NM restaurant, huge patio, 20 min north" },
    ],
  },
  'tingley coliseum': {
    neighborhood: 'at Expo New Mexico / State Fairgrounds, midtown (near Louisiana Blvd)',
    parking: 'Fairgrounds parking on-site; $10–15 typical.',
    nearby_dining: [
      { name: "Flying Star Cafe (Nob Hill)", why: "New Mexican comfort food, 10 min east" },
      { name: "Casa de Benavidez (Rio Grande Blvd)", why: "Family-run NM classics, great margaritas, 15 min west" },
    ],
  },
  'expo new mexico': {
    neighborhood: 'at the State Fairgrounds, midtown Albuquerque',
    parking: 'Large fairgrounds parking; $10–15 typical.',
    nearby_dining: [
      { name: "Flying Star Cafe (Nob Hill)", why: "Excellent green chile dishes, 10 min east" },
      { name: "Quarters BBQ (Louisiana Blvd)", why: "Local BBQ institution right nearby" },
    ],
  },
  'sandia resort': {
    neighborhood: 'at the base of the Sandia Mountains in the far northeast (Tramway area)',
    parking: 'Free valet and self-parking on-site.',
    nearby_dining: [
      { name: "Range Cafe (Bernalillo)", why: "NM diner institution, great breakfast/lunch, 20 min north" },
    ],
  },
  'sandia casino': {
    neighborhood: 'at the base of the Sandia Mountains in the far northeast (Tramway area)',
    parking: 'Free parking on-site.',
    nearby_dining: [
      { name: "Range Cafe (Bernalillo)", why: "NM diner institution, 20 min north" },
    ],
  },
  'hard rock hotel': {
    neighborhood: 'in the South Valley near I-25 south (exit 220)',
    parking: 'Free parking on-site.',
    nearby_dining: [
      { name: "El Pinto (4th St NW)", why: "Legendary NM restaurant, 20 min north on I-25" },
      { name: "Barelas Coffee House", why: "Classic green chile breakfast, 15 min north" },
    ],
  },
  'hard rock casino': {
    neighborhood: 'in the South Valley near I-25 south (exit 220)',
    parking: 'Free parking on-site.',
    nearby_dining: [
      { name: "El Pinto (4th St NW)", why: "Legendary NM restaurant, 20 min north on I-25" },
    ],
  },
  'popejoy hall': {
    neighborhood: 'on the UNM campus in central Albuquerque',
    parking: 'UNM Yale Parking Structure closest ($1–2/hr after 5 PM).',
    nearby_dining: [
      { name: "Frontier Restaurant (Central & Cornell)", why: "Open until midnight, legendary green chile cheeseburgers, UNM institution since 1971" },
      { name: "Flying Star Cafe (Nob Hill)", why: "Upscale diner vibe, great cocktails and NM food, 10 min walk" },
    ],
  },
  'keller hall': {
    neighborhood: 'on the UNM campus in central Albuquerque',
    parking: 'UNM parking structures nearby.',
    nearby_dining: [
      { name: "Frontier Restaurant (Central & Cornell)", why: "Open until midnight, 2 min walk" },
    ],
  },
  'launchpad': {
    neighborhood: 'on Central Ave in Downtown/EDo (East Downtown)',
    parking: 'Free 2-hr street parking on Central; free after 6 PM.',
    nearby_dining: [
      { name: "Frontier Restaurant", why: "10 min east, open until midnight" },
      { name: "Twisters Burritos (Central)", why: "Late-night green chile burritos, 5 min walk" },
    ],
  },
  'sunshine theater': {
    neighborhood: 'on Central Ave in Downtown Albuquerque',
    parking: 'Street parking on Central; free city lot 1 block south on 1st St after 6 PM.',
    nearby_dining: [
      { name: "Frontier Restaurant", why: "10 min east, open until midnight" },
      { name: "Gold Street Caffe", why: "Downtown cocktails and bites, short walk" },
    ],
  },
  'el rey theater': {
    neighborhood: 'on Central Ave in Downtown/EDo (East Downtown)',
    parking: 'Free street parking on Central Ave and side streets after 6 PM.',
    nearby_dining: [
      { name: "Frontier Restaurant", why: "Open until midnight, 10 min east" },
      { name: "Twisters Burritos (Central)", why: "Quick NM burritos, walking distance" },
    ],
  },
  'kimo theatre': {
    neighborhood: 'on Central Ave in Downtown Albuquerque (Pueblo Deco landmark, 1927)',
    parking: 'Street parking on Central; city garage on 2nd St.',
    nearby_dining: [
      { name: "Gold Street Caffe", why: "Right downtown, cocktails and small plates" },
      { name: "Frontier Restaurant", why: "15 min walk east on Central, open late" },
    ],
  },
  'meow wolf': {
    neighborhood: 'in the Railyard district of Santa Fe — NOT Albuquerque, about 60 miles north on I-25',
    parking: 'Dedicated parking lot adjacent to the venue.',
    nearby_dining: [
      { name: "Tomasita's (Santa Fe)", why: "Classic NM restaurant in the Railyard area, 5 min walk" },
      { name: "Second Street Brewery (Santa Fe)", why: "Local brewery with great food, walking distance" },
    ],
  },
  'kiva auditorium': {
    neighborhood: 'at the Albuquerque Convention Center, Downtown',
    parking: 'Convention Center parking garage (~$10); street parking on surrounding blocks.',
    nearby_dining: [
      { name: "Gold Street Caffe", why: "Walkable, cocktails and tapas" },
      { name: "Casa de Benavidez", why: "NM classics and margaritas, 15 min west" },
    ],
  },
  'albuquerque convention': {
    neighborhood: 'in Downtown Albuquerque',
    parking: 'Convention Center parking garage; street parking on 2nd and 3rd St.',
    nearby_dining: [
      { name: "Gold Street Caffe", why: "Walking distance, cocktails and small plates" },
    ],
  },
  'isotopes park': {
    neighborhood: 'just south of UNM on Avenida Cesar Chavez, central Albuquerque',
    parking: 'Large stadium lots on-site; $5–10 cash. Arrive 30 min early.',
    nearby_dining: [
      { name: "Frontier Restaurant (Central & Cornell)", why: "Open until midnight, right by UNM" },
      { name: "Flying Star Cafe (Nob Hill)", why: "Great for pre-game, 10 min east" },
    ],
  },
  'rio grande credit union field': {
    neighborhood: 'just south of UNM on Avenida Cesar Chavez, central Albuquerque',
    parking: 'Large stadium lots on-site; $5–10 cash.',
    nearby_dining: [
      { name: "Frontier Restaurant (Central & Cornell)", why: "Open until midnight" },
    ],
  },
  'rio rancho events center': {
    neighborhood: 'in Rio Rancho, about 15 miles northwest of downtown Albuquerque',
    parking: 'Free parking on-site.',
    nearby_dining: [
      { name: "Tucanos Brazilian Grill (Rio Rancho)", why: "All-you-can-eat Brazilian BBQ nearby" },
    ],
  },
  'revel entertainment': {
    neighborhood: 'near the Pan American Freeway (I-25 & Paseo del Norte area), north Albuquerque',
    parking: 'Large parking lot on-site; free.',
    nearby_dining: [
      { name: "El Pinto (4th St NW)", why: "Great NM restaurant, 15 min southwest" },
    ],
  },
  'hotel albuquerque': {
    neighborhood: 'in Old Town Albuquerque, near the original plaza',
    parking: 'Hotel parking garage on-site.',
    nearby_dining: [
      { name: "Casa de Benavidez (Rio Grande Blvd)", why: "NM classics and great margaritas, 5 min drive" },
      { name: "Antiquity Restaurant (Old Town)", why: "Old Town staple, classic steaks and NM food" },
    ],
  },
  'abq biopark': {
    neighborhood: "in Albuquerque's South Valley/Barelas near the Rio Grande",
    parking: 'Large parking lots on-site; $3 typical.',
    nearby_dining: [
      { name: "Barelas Coffee House (4th St SW)", why: "Legendary NM breakfast, 5 min away" },
    ],
  },
  'albuquerque museum': {
    neighborhood: 'in Old Town Albuquerque near the plaza',
    parking: 'Museum lot on Mountain Rd NW; street parking around Old Town plaza.',
    nearby_dining: [
      { name: "Casa Chaco (Hotel Albuquerque)", why: "Patio dining with Old Town views, 5 min walk" },
      { name: "Antiquity Restaurant (Old Town)", why: "Old-school NM steaks and enchiladas right in Old Town" },
    ],
  },
  'national hispanic cultural': {
    neighborhood: 'in the Barelas neighborhood, south of Downtown along 4th St SW',
    parking: 'Free parking lot on-site.',
    nearby_dining: [
      { name: "Barelas Coffee House (4th St SW)", why: "Cash-only NM breakfast institution, literally around the corner" },
    ],
  },
  'nhcc': {
    neighborhood: 'in the Barelas neighborhood, south of Downtown along 4th St SW',
    parking: 'Free parking lot on-site.',
    nearby_dining: [
      { name: "Barelas Coffee House (4th St SW)", why: "Cash-only NM breakfast institution" },
    ],
  },
  'harwood art center': {
    neighborhood: 'in the EDo / East Downtown neighborhood on Menaul Blvd NE',
    parking: 'Street parking on Menaul and side streets.',
    nearby_dining: [
      { name: "Flying Star Cafe (Nob Hill)", why: "Great coffee and NM food, 15 min east" },
    ],
  },
  'outpost performance space': {
    neighborhood: 'in the EDo / East Downtown neighborhood',
    parking: 'Street parking nearby.',
    nearby_dining: [
      { name: "Frontier Restaurant", why: "Nearby NM institution, open late" },
    ],
  },
  "hyena's comedy": {
    neighborhood: 'in the Uptown / Northeast Heights area (near Menaul & Louisiana)',
    parking: 'Strip mall parking lot on-site; free.',
    nearby_dining: [
      { name: "Quarters BBQ (Louisiana Blvd)", why: "Local BBQ institution right nearby, great pre-show dinner" },
    ],
  },
  'route 66 casino': {
    neighborhood: 'west of Albuquerque on I-40 (exit 140), about 20 miles from Downtown',
    parking: 'Free parking lots on-site.',
    nearby_dining: [
      { name: "Route 66 Casino restaurants", why: "Several on-site dining options; Six66 Steakhouse for pre-show" },
    ],
  },
}

function getVenueContext(venueName = '', address = '') {
  const combined = (venueName + ' ' + address).toLowerCase()
  for (const [pattern, info] of Object.entries(KNOWN_VENUES)) {
    if (combined.includes(pattern)) return info
  }
  // Address-based fallback
  if (/pan american|pan-american freeway/.test(combined)) {
    return { neighborhood: 'near the Pan American Freeway (I-25), midtown/north Albuquerque', parking: null, nearby_dining: [] }
  }
  if (/central ave/.test(combined)) {
    const block = parseInt(combined.match(/(\d+)\s+central/)?.[1] ?? '0')
    if (block < 1000) return { neighborhood: 'on Central Ave in Downtown Albuquerque', parking: null, nearby_dining: [] }
    if (block < 3000) return { neighborhood: 'on Central Ave / EDo (East Downtown)', parking: null, nearby_dining: [] }
    if (block < 5000) return { neighborhood: 'on Central Ave in the Nob Hill neighborhood', parking: null, nearby_dining: [] }
    return { neighborhood: 'on Central Ave in the Heights', parking: null, nearby_dining: [] }
  }
  if (/university blvd/.test(combined)) return { neighborhood: 'on University Blvd near UNM', parking: null, nearby_dining: [] }
  if (/lomas blvd/.test(combined))     return { neighborhood: 'on Lomas Blvd in central Albuquerque', parking: null, nearby_dining: [] }
  if (/paseo del norte/.test(combined)) return { neighborhood: 'near Paseo del Norte, north Albuquerque', parking: null, nearby_dining: [] }
  return null
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function fetchEvents() {
  const today = new Date().toISOString().slice(0, 10)
  let q = supabase.schema('public').from('events')
    .select('id, source, raw, category, venue_name, event_date, ai_enrichment')
    .eq('hidden', false)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(LIMIT)

  // Incremental: skip events that already have the about field populated.
  // This correctly catches events that have mood data but no about (ai_enrichment NOT NULL
  // but about IS NULL) — the old `is('ai_enrichment', null)` check missed 445 such events.
  if (!FORCE) {
    q = q.or('ai_enrichment.is.null,ai_enrichment->>about.is.null')
  }
  if (SOURCE)    q = q.eq('source', SOURCE)
  if (SINGLE_ID) q = q.eq('id', SINGLE_ID)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

// ── Prompt ────────────────────────────────────────────────────────────────────
function buildPrompt(event) {
  const raw     = event.raw ?? {}
  const name    = raw.name ?? raw.title ?? raw.summary ?? 'Unknown Event'
  const info    = (raw.description ?? raw.summary ?? (typeof raw.description === 'object' ? raw.description?.text : '') ?? '')
    .replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, 500)

  const tmVenue = raw._embedded?.venues?.[0]
  const ebVenue = raw.venue
  const venueName = event.venue_name
    ?? tmVenue?.name
    ?? (typeof ebVenue === 'object' ? ebVenue?.name : ebVenue)
    ?? ''
  const addrLine = tmVenue?.address?.line1
    ?? (typeof ebVenue === 'object' ? (ebVenue?.address?.localized_address_display ?? ebVenue?.address?.address_1) : null)
    ?? raw.address ?? ''
  const city     = tmVenue?.city?.name ?? 'Albuquerque'
  const segment  = raw.classifications?.[0]?.segment?.name ?? ''
  const genre    = raw.classifications?.[0]?.genre?.name ?? ''
  const category = [segment, genre].filter(Boolean).join(' / ') || event.category || 'Event'

  const ctx         = getVenueContext(venueName, addrLine)
  const neighborhoodLine = ctx?.neighborhood ? `- Venue neighborhood (USE VERBATIM): ${ctx.neighborhood}` : ''
  const parkingLine      = ctx?.parking ? `- Parking: ${ctx.parking}` : ''
  const diningSeeds      = ctx?.nearby_dining?.length
    ? `- Nearby dining (verified, use these): ${JSON.stringify(ctx.nearby_dining)}`
    : ''
  const hasSeeds = !!(ctx?.nearby_dining?.length)

  return `You are a knowledgeable local Albuquerque guide helping people decide whether to attend an event.

Given the event details below, produce a JSON object with EXACTLY these keys:

{
  "about": "1-2 SPECIFIC sentences about the performer, act, or event. Return null if you have nothing beyond restating the title.",
  "highlights": ["Specific detail about the experience", "Another detail about the performance itself", "Optional third — only if genuinely distinct"],
  "venue_tips": "WHERE in Albuquerque the venue is + parking/arrival info. Use the Venue neighborhood line verbatim if provided. Return null only if venue is completely unknown.",
  "nearby_dining": [{"name": "Restaurant name", "why": "What it is and why it pairs with this event"}],
  "local_rec": "One SPECIFIC verifiable insider tip about this exact venue or neighborhood. Return null if you cannot name something concrete."
}

EVENT DETAILS:
- Name: ${name}
- Category: ${category}
- Date: ${event.event_date ?? ''}
- Venue: ${venueName || '(unknown)'}${addrLine ? ' — ' + addrLine + ', ' + city + ', NM' : ''}
${neighborhoodLine}
${parkingLine}
${diningSeeds}
${info ? `- Description: ${info}` : ''}

RULES — follow exactly:
1. Return ONLY the raw JSON object. No markdown fences, no preamble, no trailing text.
2. "about": If NO Description line is provided, return null. Do NOT infer style/sound/genre from the title alone.
3. "highlights": Every item MUST come from facts in the Description or title. NEVER invent crowd vibe, atmosphere, or audience experience. If no description, return at most 1 highlight that only restates the category. NEVER include venue address, parking, or start time here.
4. "venue_tips": Use the Venue neighborhood line verbatim if provided. Never invent an ABQ neighborhood name.
5. "nearby_dining": ${hasSeeds ? 'Use ONLY the verified seeds listed above — include 2-3 of them. No others.' : 'Return [] — no dining seeds provided. Do NOT suggest any restaurants.'}
6. "local_rec": Return null UNLESS you know a SPECIFIC, VERIFIABLE fact about this exact venue (e.g., "The KiMo has a stunning 1927 Pueblo Deco lobby worth arriving early for"). Generic tips like "parking can be busy" are NOT acceptable.
7. Never state specific day names unless explicitly in the event text.
8. If venue is in Rio Rancho or Santa Fe, note the distance from Albuquerque.
9. NEVER invent claims like "bring a camera", "free for members", "RSVP required" unless the description says so.`
}

// ── DeepSeek call ─────────────────────────────────────────────────────────────
async function callDeepSeek(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
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
          temperature: 0.2,
          max_tokens: 800,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
      }
      const json = await res.json()
      return json.choices[0].message.content.trim()
    } catch (err) {
      if (attempt < retries) {
        console.warn(`  ⚠ retry ${attempt + 1}/${retries}: ${err.message}`)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      } else {
        throw err
      }
    }
  }
}

function parseResult(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')
  return JSON.parse(jsonMatch[0])
}

// ── Worker ────────────────────────────────────────────────────────────────────
async function enrichEvent(event, idx, total) {
  const label = `[${idx + 1}/${total}] ${(event.raw?.name ?? event.raw?.title ?? event.id).slice(0, 60)}`
  try {
    const prompt  = buildPrompt(event)
    if (DRY_RUN) {
      console.log(`\n── DRY RUN: ${label} ──`)
      console.log(prompt.slice(0, 800))
      return
    }
    const raw     = await callDeepSeek(prompt)
    const parsed  = parseResult(raw)

    // Merge with existing ai_enrichment (mood/mood_confidence may already be set).
    // Use jsonb_set approach: spread existing data, then overlay our new fields.
    const existing = event.ai_enrichment ?? {}
    const merged = { ...existing, ...parsed }

    const { error } = await supabase
      .schema('public')
      .from('events')
      .update({ ai_enrichment: merged })
      .eq('id', event.id)

    if (error) throw new Error(error.message)
    console.log(`  ✅ ${label}`)
  } catch (err) {
    console.log(`  ✗  ${label} — ${err.message}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🤖  ABQ Unplugged — DeepSeek Event Enrichment`)
  console.log(`    Mode: ${FORCE ? 'FORCE (re-enrich all)' : 'INCREMENTAL (skip enriched)'}`)
  console.log(`    Limit: ${LIMIT}${SOURCE ? `  Source: ${SOURCE}` : ''}${SINGLE_ID ? `  ID: ${SINGLE_ID}` : ''}`)
  console.log(`    Concurrency: ${CONCURRENCY} parallel calls\n`)

  const events = await fetchEvents()
  console.log(`📥  Found ${events.length} event(s) needing enrichment\n`)

  if (events.length === 0) {
    console.log('✅  Nothing to enrich.')
    return
  }

  if (DRY_RUN && events.length > 0) {
    await enrichEvent(events[0], 0, events.length)
    console.log(`\n(dry-run: showed first event only)`)
    return
  }

  // Process in concurrent batches
  for (let i = 0; i < events.length; i += CONCURRENCY) {
    const batch = events.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map((e, j) => enrichEvent(e, i + j, events.length)))
  }

  const total = events.length
  const done  = total  // we don't track failures separately in the count
  console.log(`\n✅  Enrichment complete — ${done} event(s) processed`)
}

main().catch(err => { console.error(err); process.exit(1) })
