/**
 * Mood + indoor/outdoor enrichment via LM Studio (Gemma).
 * Adds mood, indoor_outdoor, age_appeal to ai_enrichment jsonb column.
 *
 * Usage: node scripts/enrich-moods-lm.mjs [--dry-run] [--limit=N]
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in scripts/.env
 *
 * Processes up to 200 events missing mood, prioritizing upcoming events.
 * 100ms delay between LLM calls. Stops after 10 consecutive errors.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', 'scripts', '.env'),
  path.join(__dirname, '..', '..', 'scripts', '.env'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
    console.log('Loaded env from:', envFile)
    break
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LM_STUDIO_URL = process.env.LM_STUDIO_URL
  ? `${process.env.LM_STUDIO_URL}/v1/chat/completions`
  : 'http://localhost:1234/v1/chat/completions'
const LM_MODEL = process.env.LM_MODEL || 'google/gemma-4-e4b'

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const MAX_EVENTS = limitArg ? parseInt(limitArg.split('=')[1]) : 200
const BATCH_SIZE = 20
const DELAY_MS = 100
const MAX_CONSECUTIVE_ERRORS = 10

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const today = new Date().toISOString().slice(0, 10)

const VALID_MOODS = ['chill', 'energetic', 'romantic', 'family', 'artsy', 'rowdy', 'educational', 'foodie']
const VALID_INDOOR_OUTDOOR = ['indoor', 'outdoor', 'mixed']
const VALID_AGE_APPEAL = ['all-ages', 'adult', '21-plus']

// ─── Extract event fields from row ───────────────────────────────────────────
function extractFields(row) {
  const raw = row.raw || {}

  // Title
  const nameField = raw.name || raw.title || ''
  const title = typeof nameField === 'object' ? (nameField?.text || '') : nameField

  // Description
  const desc =
    raw.description?.text ||
    (typeof raw.description === 'string' ? raw.description : '') ||
    raw.info ||
    ''

  // Venue
  const venue =
    row.venue_name ||
    raw.venue?.name ||
    raw._embedded?.venues?.[0]?.name ||
    raw.venue_name ||
    ''

  return { title: String(title).trim(), desc: String(desc).trim(), venue: String(venue).trim() }
}

// ─── Call LM Studio ──────────────────────────────────────────────────────────
async function classifyMood(title, venue, desc) {
  const shortDesc = desc.slice(0, 300)
  const prompt = `You classify events for a cultural events site. Respond with ONLY a JSON object, no prose.
Event: "${title}" at "${venue}". Description: "${shortDesc}".
Return: {"mood": one of [chill, energetic, romantic, family, artsy, rowdy, educational, foodie], "indoor_outdoor": one of [indoor, outdoor, mixed], "age_appeal": one of [all-ages, adult, 21-plus]}`

  let lastError = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(LM_STUDIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LM_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,  // reasoning model needs room to think before outputting JSON
          temperature: 0,
        }),
        signal: AbortSignal.timeout(60000),
      })

      if (!res.ok) {
        lastError = `HTTP ${res.status}: ${await res.text()}`
        if (attempt === 0) await delay(500)
        continue
      }

      const json = await res.json()
      const content = (json.choices?.[0]?.message?.content ?? '').trim()
      // Reasoning models may put the answer in reasoning_content if content is empty
      const reasoning = (json.choices?.[0]?.message?.reasoning_content ?? '').trim()
      const text = content || reasoning

      // Extract JSON from response (handles markdown code fences or prose)
      const match = text.match(/\{[^}]+\}/)
      if (!match) {
        lastError = `No JSON in response: ${text.slice(0, 80)}`
        break
      }

      const parsed = JSON.parse(match[0])
      const mood = parsed.mood
      const indoor_outdoor = parsed.indoor_outdoor
      const age_appeal = parsed.age_appeal

      if (!VALID_MOODS.includes(mood)) {
        lastError = `Invalid mood: ${mood}`
        break
      }

      return {
        mood,
        indoor_outdoor: VALID_INDOOR_OUTDOOR.includes(indoor_outdoor) ? indoor_outdoor : 'indoor',
        age_appeal: VALID_AGE_APPEAL.includes(age_appeal) ? age_appeal : 'all-ages',
      }
    } catch (err) {
      lastError = err.message
      if (attempt === 0) await delay(500)
    }
  }

  return { error: lastError }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nMood Enrichment — ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Model: ${LM_MODEL} @ ${LM_STUDIO_URL}`)
  console.log(`Max events: ${MAX_EVENTS} | Batch size: ${BATCH_SIZE}`)
  console.log(`Today: ${today}\n`)

  // Test LM Studio connectivity
  if (!isDryRun) {
    try {
      const ping = await fetch(LM_STUDIO_URL.replace('/chat/completions', '/models'), {
        signal: AbortSignal.timeout(5000),
      })
      if (ping.ok) {
        console.log('LM Studio: reachable')
      } else {
        console.warn('LM Studio: responded with', ping.status)
      }
    } catch (e) {
      console.warn('LM Studio connectivity check failed:', e.message)
      console.warn('Will proceed and fail gracefully if LM Studio is down.\n')
    }
  }

  // Fetch events missing mood, prioritizing future events
  // Strategy: get future events first, then past if under limit
  let allRows = []

  // Future events first (up to MAX_EVENTS)
  const { data: futureEvents, error: e1 } = await supabase
    .from('events')
    .select('id, venue_name, raw, ai_enrichment, event_date')
    .eq('hidden', false)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(MAX_EVENTS)

  if (e1) { console.error('Fetch error:', e1.message); process.exit(1) }

  // Filter to those missing mood
  const futureMissingMood = (futureEvents || []).filter(e => !e.ai_enrichment?.mood)
  allRows = futureMissingMood.slice(0, MAX_EVENTS)

  // If we still have room, add past events
  if (allRows.length < MAX_EVENTS) {
    const remaining = MAX_EVENTS - allRows.length
    const { data: pastEvents } = await supabase
      .from('events')
      .select('id, venue_name, raw, ai_enrichment, event_date')
      .eq('hidden', false)
      .lt('event_date', today)
      .order('event_date', { ascending: false })
      .limit(remaining * 2) // fetch extra to filter

    const pastMissingMood = (pastEvents || []).filter(e => !e.ai_enrichment?.mood)
    allRows = allRows.concat(pastMissingMood.slice(0, remaining))
  }

  console.log(`Found ${allRows.length} events needing mood enrichment`)
  if (allRows.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let enriched = 0, skipped = 0, errors = 0, consecutiveErrors = 0

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i]
    const { title, venue, desc } = extractFields(row)

    if (!title) {
      console.log(`  [${i + 1}/${allRows.length}] Skipping (no title) id=${row.id}`)
      skipped++
      continue
    }

    if (isDryRun) {
      console.log(`[DRY] ${(i + 1).toString().padStart(3)}. "${title.slice(0, 50)}" @ "${venue.slice(0, 30)}"`)
      enriched++
      continue
    }

    // Log every 10 or on batch boundary
    if (i % BATCH_SIZE === 0) {
      console.log(`\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1} (events ${i + 1}–${Math.min(i + BATCH_SIZE, allRows.length)}) ---`)
    }

    const result = await classifyMood(title, venue, desc)

    if (result.error) {
      console.warn(`  [${i + 1}] SKIP "${title.slice(0, 40)}" — ${result.error}`)
      errors++
      consecutiveErrors++
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`\nStopping: ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Last: ${result.error}`)
        break
      }
      await delay(DELAY_MS)
      continue
    }

    consecutiveErrors = 0

    // Merge with existing ai_enrichment
    const existing = row.ai_enrichment || {}
    const ai_enrichment = {
      ...existing,
      mood: result.mood,
      indoor_outdoor: result.indoor_outdoor,
      age_appeal: result.age_appeal,
      mood_enriched_at: new Date().toISOString(),
    }

    const { error: updateErr } = await supabase
      .from('events')
      .update({ ai_enrichment })
      .eq('id', row.id)

    if (updateErr) {
      console.error(`  [${i + 1}] Update error for ${row.id}:`, updateErr.message)
      errors++
      consecutiveErrors++
    } else {
      console.log(`  [${i + 1}] ${result.mood.padEnd(12)} ${result.indoor_outdoor.padEnd(8)} ${result.age_appeal.padEnd(10)} "${title.slice(0, 40)}"`)
      enriched++
      consecutiveErrors = 0
    }

    await delay(DELAY_MS)
  }

  console.log('\n─── Results ───────────────────────────────────')
  console.log(`Enriched: ${enriched}`)
  console.log(`Skipped:  ${skipped} (no title)`)
  console.log(`Errors:   ${errors}`)
  console.log('\nDone.')
}

main().catch(console.error)
