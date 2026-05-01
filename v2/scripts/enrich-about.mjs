/**
 * Generate `about` + `highlights` copy for events that have none.
 *
 * Uses DeepSeek V3 to write engaging, local-voice descriptions —
 * not press-release boilerplate. Results stored in ai_enrichment.
 *
 * Usage:
 *   node scripts/enrich-about.mjs              # fill missing only
 *   node scripts/enrich-about.mjs --dry-run    # preview only
 *   node scripts/enrich-about.mjs --fix-all    # rewrite all about text
 *   node scripts/enrich-about.mjs --limit=100  # cap at N events
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
    console.log('Loaded env from:', envFile)
    break
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'REDACTED_DEEPSEEK_KEY'
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not set.')
  process.exit(1)
}

// ── CLI args ──────────────────────────────────────────────────────────────────
const isDryRun  = process.argv.includes('--dry-run')
const fixAll    = process.argv.includes('--fix-all')
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const batchArg  = process.argv.find(a => a.startsWith('--batch='))
const MAX       = limitArg ? parseInt(limitArg.split('=')[1]) : 500
const BATCH     = batchArg ? parseInt(batchArg.split('=')[1]) : 5   // smaller batches — longer output
const DELAY_MS  = 400

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const today    = new Date().toISOString().slice(0, 10)

// ── Extract readable fields from a DB row ─────────────────────────────────────
function extractFields(row) {
  const raw = row.raw || {}
  const nameField = raw.name || raw.title || ''
  const title = typeof nameField === 'object' ? (nameField?.text || '') : nameField
  const desc =
    raw.description?.text ||
    (typeof raw.description === 'string' ? raw.description : '') ||
    raw.info || ''
  const venue = row.venue_name || raw.venue?.name || raw._embedded?.venues?.[0]?.name || ''
  const ai    = row.ai_enrichment || {}
  return {
    title:    String(title).trim(),
    desc:     decodeHtml(String(desc).trim().slice(0, 500)),
    venue:    String(venue).trim().replace(/\s{2,}/g, ' ').split('—')[0].split(',')[0].trim(),
    mood:     ai.mood || '',
    age:      ai.age_appeal || '',
    io:       ai.indoor_outdoor || '',
    category: row.category || '',
  }
}

function decodeHtml(str) {
  return str
    .replace(/&#(\d+);/g,            (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g,  (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g,  '&').replace(/&lt;/g,   '<').replace(/&gt;/g,    '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g,  "'").replace(/&#39;/g,   "'")
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Build prompt ──────────────────────────────────────────────────────────────
function buildPrompt(events) {
  const numbered = events.map((e, i) => {
    const { title, venue, desc, mood, age, io } = extractFields(e)
    const meta = [mood, io, age].filter(Boolean).join(', ')
    return [
      `${i + 1}. "${title}" at "${venue || 'Albuquerque'}"`,
      meta ? `   Tags: ${meta}` : '',
      desc ? `   Source description: "${desc.slice(0, 400)}"` : '   (no source description — infer from title/venue)',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  return `You write copy for ABQ Unplugged, an Albuquerque local events guide. Your voice is warm, direct, and specific — like a knowledgeable friend, not a press release.

For each event below, return a JSON array (same order) where each object has:
- "about": 2–3 sentences. Lead with what makes this worth going to. Specific details beat generalities. No "This event" or "This workshop" openers. No em dashes.
- "highlights": array of 3 concise bullet strings (10–20 words each). What to expect, what to know, what makes it memorable. Start each with a verb or key noun.
- "tip": one short insider tip (under 15 words). Parking, tickets, best time to arrive, what to wear, etc. Empty string if nothing useful to say.

Rules:
- Never open a sentence with "This event", "This workshop", "This class", "This is", or "Join us".
- No em dashes (use commas or colons instead).
- Keep "about" under 200 characters per sentence.
- If a source description is provided, use its facts but rewrite the voice entirely.
- If there is no source description, synthesize from the title and venue — be honest, don't invent specifics.
- Return ONLY a JSON array. No markdown, no prose.

Events:
${numbered}`
}

// ── Call DeepSeek ─────────────────────────────────────────────────────────────
async function generateAbout(events) {
  const prompt = buildPrompt(events)

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        },
        body: JSON.stringify({
          model:       'deepseek-chat',
          temperature: 0.4,  // some creativity, but grounded
          max_tokens:  2048,
          messages: [
            {
              role:    'system',
              content: 'You write sharp, local event copy for Albuquerque. Return ONLY valid JSON arrays. No explanations, no markdown.',
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(45000),
      })

      if (!res.ok) {
        const text = await res.text()
        if (attempt < 2) { await delay(1000 * (attempt + 1)); continue }
        return { error: `HTTP ${res.status}: ${text.slice(0, 120)}` }
      }

      const json    = await res.json()
      const raw     = (json.choices?.[0]?.message?.content ?? '').trim()
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '')

      let parsed
      try { parsed = JSON.parse(cleaned) }
      catch {
        if (attempt < 2) { await delay(500); continue }
        return { error: `JSON parse failed: ${raw.slice(0, 120)}` }
      }

      if (!Array.isArray(parsed) || parsed.length !== events.length) {
        if (attempt < 2) { await delay(500); continue }
        return { error: `Expected ${events.length} items, got ${parsed?.length}` }
      }

      return { results: parsed }
    } catch (err) {
      if (attempt < 2) { await delay(1000 * (attempt + 1)); continue }
      return { error: err.message }
    }
  }
  return { error: 'Max retries' }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Fetch rows ────────────────────────────────────────────────────────────────
async function fetchRows() {
  const query = fixAll
    ? supabase.from('events').select('id, venue_name, raw, ai_enrichment, event_date, category').eq('hidden', false).gte('event_date', today).order('event_date', { ascending: true })
    : supabase.from('events').select('id, venue_name, raw, ai_enrichment, event_date, category').eq('hidden', false).gte('event_date', today).is('ai_enrichment->about', null).order('event_date', { ascending: true })

  // Paginate past Supabase's 1000-row cap
  let rows = [], offset = 0
  const PAGE = 1000
  while (rows.length < MAX) {
    const { data, error } = await query.range(offset, offset + PAGE - 1)
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    rows = rows.concat(data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return rows.slice(0, MAX)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nDeepSeek About Generator — ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Mode: ${fixAll ? 'rewrite all' : 'fill missing only'}`)
  console.log(`Max: ${MAX} | Batch: ${BATCH}\n`)

  const rows = await fetchRows()
  console.log(`Fetched ${rows.length} events to enrich`)
  if (!rows.length) { console.log('Nothing to do.'); return }

  let done = 0, skipped = 0, errors = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch    = rows.slice(i, i + BATCH)
    const batchNum = Math.floor(i / BATCH) + 1
    console.log(`\n─── Batch ${batchNum} (${i + 1}–${Math.min(i + BATCH, rows.length)} of ${rows.length}) ───`)

    if (isDryRun) {
      batch.forEach((row, j) => {
        const { title, venue } = extractFields(row)
        console.log(`  [${i+j+1}] "${title.slice(0, 50)}" @ ${venue.slice(0, 30)}`)
      })
      done += batch.length
      continue
    }

    const { results, error } = await generateAbout(batch)

    if (error) {
      console.error(`  Batch error: ${error}`)
      errors += batch.length
      await delay(2000)
      continue
    }

    for (let j = 0; j < batch.length; j++) {
      const row    = batch[j]
      const result = results[j]
      const { title } = extractFields(row)

      if (!result?.about) {
        console.log(`  [skip] "${title.slice(0, 40)}" — no about returned`)
        skipped++
        continue
      }

      // Validate highlights
      const highlights = Array.isArray(result.highlights)
        ? result.highlights.filter(h => typeof h === 'string' && h.trim().length > 5).slice(0, 4)
        : []

      console.log(`  ✓ "${title.slice(0, 42)}"`)
      console.log(`    ${result.about.slice(0, 100)}…`)

      const existing     = row.ai_enrichment || {}
      const ai_enrichment = {
        ...existing,
        about:            result.about,
        highlights:       highlights,
        localTips:        result.tip && result.tip.trim() ? result.tip.trim() : (existing.localTips ?? null),
        about_model:      'deepseek-chat',
        about_enriched_at: new Date().toISOString(),
      }

      const { error: updateErr } = await supabase
        .from('events')
        .update({ ai_enrichment })
        .eq('id', row.id)

      if (updateErr) {
        console.error(`    Update error: ${updateErr.message}`)
        errors++
      } else {
        done++
      }
    }

    if (i + BATCH < rows.length) await delay(DELAY_MS)
  }

  console.log('\n═══════════ Results ═══════════')
  console.log(`Written:  ${done}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Errors:   ${errors}`)
  console.log('\nDone.')
}

main().catch(console.error)
