/**
 * Event enrichment + accuracy checking via DeepSeek API.
 *
 * Two modes:
 *   default   — classify events missing mood (same as enrich-moods-lm.mjs)
 *   --validate — also re-check events with known-bad mood values and fix them
 *
 * Advantages over Gemma/LM Studio:
 *   - Batch: 10 events per API call (10× fewer round-trips)
 *   - Cloud: no local LM Studio dependency
 *   - Accuracy: DeepSeek V3 catches mis-classifications, invalid enum values,
 *               and obvious errors (cupping workshop classified as "kids", etc.)
 *   - Confidence: returns 0–1 confidence score stored in ai_enrichment
 *
 * Usage:
 *   node scripts/enrich-deepseek.mjs [options]
 *   node scripts/enrich-deepseek.mjs --validate          # also fix bad values
 *   node scripts/enrich-deepseek.mjs --limit=50          # cap at 50 events
 *   node scripts/enrich-deepseek.mjs --dry-run           # preview only
 *   node scripts/enrich-deepseek.mjs --validate --fix-all # re-classify everything
 *   node scripts/enrich-deepseek.mjs --batch=5           # smaller batches
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load .env ────────────────────────────────────────────────────────────────
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', 'scripts', '.env'),
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
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'REDACTED_DEEPSEEK_KEY'
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env')
  process.exit(1)
}

// ── CLI args ─────────────────────────────────────────────────────────────────
const isDryRun   = process.argv.includes('--dry-run')
const doValidate = process.argv.includes('--validate')
const fixAll     = process.argv.includes('--fix-all')
const limitArg   = process.argv.find(a => a.startsWith('--limit='))
const batchArg   = process.argv.find(a => a.startsWith('--batch='))
const MAX_EVENTS = limitArg ? parseInt(limitArg.split('=')[1]) : 300
const BATCH_SIZE = batchArg ? parseInt(batchArg.split('=')[1]) : 10
const DELAY_MS   = 300  // between API calls — DeepSeek rate limits are generous

// ── Valid enum values ─────────────────────────────────────────────────────────
const VALID_MOODS     = new Set(['chill','energetic','romantic','family','artsy','rowdy','educational','foodie'])
const VALID_IO        = new Set(['indoor','outdoor','mixed'])
const VALID_AGE       = new Set(['all-ages','adult','21-plus'])

// Moods from the old rules engine that are no longer valid — these events need fixing
const INVALID_MOODS   = new Set(['live-music','family-fun','free-tonight','nightlife','arts-culture','sports-rec'])

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const today    = new Date().toISOString().slice(0, 10)

// ── Extract fields from DB row ────────────────────────────────────────────────
function extractFields(row) {
  const raw  = row.raw || {}
  const nameField = raw.name || raw.title || ''
  const title = typeof nameField === 'object' ? (nameField?.text || '') : nameField
  const desc =
    raw.description?.text ||
    (typeof raw.description === 'string' ? raw.description : '') ||
    raw.info || ''
  const venue = row.venue_name || raw.venue?.name || raw._embedded?.venues?.[0]?.name || ''
  return {
    title: String(title).trim(),
    desc:  String(desc).trim().slice(0, 350),
    venue: String(venue).trim(),
  }
}

// ── Build batch prompt ────────────────────────────────────────────────────────
function buildBatchPrompt(events) {
  const numbered = events.map((e, i) => {
    const { title, venue, desc } = extractFields(e)
    const existing = e.ai_enrichment || {}
    const existingStr = existing.mood
      ? ` [Current: mood=${existing.mood}, age=${existing.age_appeal || '?'}]`
      : ' [No existing classification]'
    return `${i + 1}. "${title}" at "${venue || 'unknown venue'}".${existingStr}${desc ? ` Info: "${desc}"` : ''}`
  }).join('\n\n')

  return `Classify these ${events.length} Albuquerque events. Return ONLY a JSON array, same order as input. No prose, no markdown.

Each object must have exactly these keys:
- "mood": one of exactly: chill | energetic | romantic | family | artsy | rowdy | educational | foodie
- "indoor_outdoor": one of exactly: indoor | outdoor | mixed
- "age_appeal": one of exactly: all-ages | adult | 21-plus
- "confidence": number 0.0–1.0
- "fix_needed": true if the current mood or age_appeal is wrong or invalid, false if already correct

Classification guide:
- chill: yoga, meditation, quiet gatherings, gentle walks, book clubs, low-energy social
- energetic: concerts, sports, dance, live music with crowds, festivals, upbeat fitness
- romantic: date-night venues, wine events, intimate dinners, couples activities
- family: children's activities, storytimes, LEGO, science for kids — but only if genuinely family-focused
- artsy: visual art, theater, dance performance, gallery openings, film
- rowdy: loud bars, comedy, karaoke, sports bars, anything with a boisterous crowd
- educational: workshops, lectures, skill classes, library programs, historical tours
- foodie: food/drink events, tastings, cooking classes, food markets
- age_appeal adult: any event that can include minors but is primarily aimed at adults (art openings, most concerts)
- age_appeal 21-plus: explicitly 21+ or requires alcohol purchase
- age_appeal all-ages: specifically designed for children/families, or genuinely open to all

Events:
${numbered}`
}

// ── Call DeepSeek ─────────────────────────────────────────────────────────────
async function classifyBatch(events) {
  const prompt = buildBatchPrompt(events)

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        },
        body: JSON.stringify({
          model:       DEEPSEEK_MODEL,
          temperature: 0,
          max_tokens:  1024,
          messages: [
            {
              role: 'system',
              content: 'You classify cultural events. Return ONLY valid JSON arrays. No explanations, no markdown. Use only the exact enum values specified. Be strict about age_appeal — adult events that happen to allow children are still "adult", not "all-ages".',
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        const text = await res.text()
        if (attempt < 2) { await delay(1000 * (attempt + 1)); continue }
        return { error: `HTTP ${res.status}: ${text.slice(0, 120)}` }
      }

      const json   = await res.json()
      const raw    = (json.choices?.[0]?.message?.content ?? '').trim()

      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '')

      let parsed
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        if (attempt < 2) { await delay(500); continue }
        return { error: `JSON parse failed: ${raw.slice(0, 120)}` }
      }

      if (!Array.isArray(parsed) || parsed.length !== events.length) {
        if (attempt < 2) { await delay(500); continue }
        return { error: `Expected array of ${events.length}, got ${JSON.stringify(parsed).slice(0, 80)}` }
      }

      // Validate and sanitize each result
      const results = parsed.map((r, i) => {
        const mood         = VALID_MOODS.has(r.mood) ? r.mood : null
        const indoor_outdoor = VALID_IO.has(r.indoor_outdoor) ? r.indoor_outdoor : 'indoor'
        const age_appeal   = VALID_AGE.has(r.age_appeal)   ? r.age_appeal : 'all-ages'
        const confidence   = typeof r.confidence === 'number' ? Math.min(1, Math.max(0, r.confidence)) : 0.7
        const fix_needed   = !!r.fix_needed

        if (!mood) {
          const { title } = extractFields(events[i])
          console.warn(`  [${i+1}] Invalid mood "${r.mood}" for "${title.slice(0,40)}" — skipping`)
          return null
        }

        return { mood, indoor_outdoor, age_appeal, confidence, fix_needed }
      })

      return { results }
    } catch (err) {
      if (attempt < 2) { await delay(1000 * (attempt + 1)); continue }
      return { error: err.message }
    }
  }
  return { error: 'Max retries reached' }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Fetch rows ────────────────────────────────────────────────────────────────
async function fetchRows() {
  let rows = []

  if (fixAll) {
    // Re-classify everything
    const { data, error } = await supabase
      .from('events')
      .select('id, venue_name, raw, ai_enrichment, event_date')
      .eq('hidden', false)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(MAX_EVENTS)
    if (error) { console.error(error.message); process.exit(1) }
    rows = data || []
  } else {
    // 1. Events with no mood at all
    const { data: noMood } = await supabase
      .from('events')
      .select('id, venue_name, raw, ai_enrichment, event_date')
      .eq('hidden', false)
      .gte('event_date', today)
      .is('ai_enrichment->mood', null)
      .order('event_date', { ascending: true })
      .limit(MAX_EVENTS)
    rows = noMood || []

    // 2. Events with invalid mood values (from old rules engine)
    if (doValidate && rows.length < MAX_EVENTS) {
      const remaining = MAX_EVENTS - rows.length
      const { data: allEnriched } = await supabase
        .from('events')
        .select('id, venue_name, raw, ai_enrichment, event_date')
        .eq('hidden', false)
        .gte('event_date', today)
        .not('ai_enrichment', 'is', null)
        .order('event_date', { ascending: true })
        .limit(remaining * 5) // fetch extra, filter locally

      const badRows = (allEnriched || []).filter(row => {
        const mood      = row.ai_enrichment?.mood
        const age       = row.ai_enrichment?.age_appeal
        const hasBadMood = mood && INVALID_MOODS.has(mood)
        const hasBadAge  = age && !VALID_AGE.has(age)
        return hasBadMood || hasBadAge
      }).slice(0, remaining)

      if (badRows.length) {
        console.log(`Found ${badRows.length} events with invalid mood/age values to fix`)
        rows = rows.concat(badRows)
      }
    }
  }

  return rows
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nDeepSeek Event Enrichment — ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Model: ${DEEPSEEK_MODEL}`)
  console.log(`Mode:  ${fixAll ? 'fix-all' : doValidate ? 'missing + validate' : 'missing only'}`)
  console.log(`Max:   ${MAX_EVENTS} events | Batch: ${BATCH_SIZE} per call`)
  console.log(`Today: ${today}\n`)

  const rows = await fetchRows()
  console.log(`Fetched ${rows.length} events to process`)

  if (rows.length === 0) {
    console.log('Nothing to do. Run with --validate to also fix invalid mood values.')
    return
  }

  let enriched = 0, skipped = 0, fixed = 0, errors = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch   = rows.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const batchEnd = Math.min(i + BATCH_SIZE, rows.length)
    console.log(`\n─── Batch ${batchNum} (${i + 1}–${batchEnd} of ${rows.length}) ───`)

    if (isDryRun) {
      batch.forEach((row, j) => {
        const { title } = extractFields(row)
        const existing = row.ai_enrichment?.mood || 'none'
        console.log(`  [${i+j+1}] "${title.slice(0,50)}" [current: ${existing}]`)
      })
      enriched += batch.length
      continue
    }

    const { results, error } = await classifyBatch(batch)

    if (error) {
      console.error(`  Batch error: ${error}`)
      errors += batch.length
      await delay(2000)
      continue
    }

    // Write results
    for (let j = 0; j < batch.length; j++) {
      const row    = batch[j]
      const result = results[j]
      if (!result) { skipped++; continue }

      const { title } = extractFields(row)
      const existing  = row.ai_enrichment?.mood || 'none'
      const wasFixed  = result.fix_needed || INVALID_MOODS.has(existing) || !VALID_MOODS.has(existing)
      const flag      = wasFixed ? '✱ FIXED' : '  '
      const conf      = `[${(result.confidence * 100).toFixed(0)}%]`

      console.log(`  ${flag} ${conf} ${result.mood.padEnd(12)} ${result.indoor_outdoor.padEnd(8)} ${result.age_appeal.padEnd(10)} "${title.slice(0,38)}"${wasFixed ? ` (was: ${existing})` : ''}`)

      const existing_enrichment = row.ai_enrichment || {}
      const ai_enrichment = {
        ...existing_enrichment,
        mood:             result.mood,
        indoor_outdoor:   result.indoor_outdoor,
        age_appeal:       result.age_appeal,
        mood_confidence:  result.confidence,
        mood_enriched_at: new Date().toISOString(),
        mood_model:       'deepseek-chat',
      }

      const { error: updateErr } = await supabase
        .from('events')
        .update({ ai_enrichment })
        .eq('id', row.id)

      if (updateErr) {
        console.error(`    Update error: ${updateErr.message}`)
        errors++
      } else {
        if (wasFixed) fixed++
        else enriched++
      }
    }

    if (i + BATCH_SIZE < rows.length) await delay(DELAY_MS)
  }

  console.log('\n═══════════ Results ═══════════')
  console.log(`Classified: ${enriched}`)
  console.log(`Fixed (bad values): ${fixed}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors:  ${errors}`)
  if (doValidate && !fixAll) {
    console.log('\nTip: run with --fix-all to re-classify all upcoming events')
  }
  console.log('\nDone.')
}

main().catch(console.error)
