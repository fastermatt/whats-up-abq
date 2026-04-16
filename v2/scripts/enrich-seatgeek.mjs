/**
 * LLM enrichment for SeatGeek "concert" events — assigns music subcategory.
 * Runs Gemma 4 via LM Studio at localhost:1234.
 *
 * Usage: node scripts/enrich-seatgeek.mjs [--dry-run] [--limit=50]
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in scripts/.env or environment
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env from scripts/ directory (two levels up from v2/scripts/)
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '..', 'scripts', '.env'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
    break
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env'); process.exit(1) }
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/chat/completions'

const MUSIC_SUBCATEGORIES = [
  'Rock', 'Pop', 'Country', 'Jazz', 'Hip-Hop', 'R&B', 'Electronic',
  'Latin', 'Folk', 'Metal', 'Classical', 'Blues', 'Reggae', 'Soul',
  'Indie', 'Alternative',
]

const isDryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 400

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function classifyWithGemma(title, performer, venue) {
  const prompt = `You are a music event classifier. Given an event, reply with ONLY one word: the music subcategory.

Choose exactly one of: Rock, Pop, Country, Jazz, Hip-Hop, R&B, Electronic, Latin, Folk, Metal, Classical, Blues, Reggae, Soul, Indie, Alternative, Comedy, Theater, Sports, Other

Event title: ${title}
${performer ? `Performer: ${performer}` : ''}
${venue ? `Venue: ${venue}` : ''}

Reply with only one word from the list above.`

  try {
    const res = await fetch(LM_STUDIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemma-4-e4b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0,
      }),
    })
    const json = await res.json()
    const text = json.choices?.[0]?.message?.content?.trim() ?? 'Other'
    // Extract first word, strip punctuation
    const word = text.split(/\s/)[0].replace(/[^a-zA-Z&\-]/g, '')
    return word || 'Other'
  } catch (e) {
    console.error('  Gemma error:', e.message)
    return null
  }
}

async function main() {
  console.log(`Fetching SeatGeek upcoming events (limit: ${limit}, dry-run: ${isDryRun})...`)

  const today = new Date().toISOString().slice(0, 10)

  const { data: events, error } = await supabase
    .schema('public')
    .from('events')
    .select('id, raw, ai_enrichment')
    .eq('source', 'seatgeek')
    .eq('hidden', false)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(limit)

  if (error) { console.error('Supabase error:', error.message); process.exit(1) }

  // Only process events not already enriched
  const toEnrich = events.filter(e => !e.ai_enrichment?.subcategory)
  console.log(`Found ${events.length} SeatGeek events, ${toEnrich.length} need enrichment.\n`)

  let enriched = 0, skipped = 0, errors = 0

  for (let i = 0; i < toEnrich.length; i++) {
    const row = toEnrich[i]
    const raw = row.raw
    // SG events stored in TM-compatible format
    const title = raw.name || ''
    const venues = raw._embedded?.venues || []
    const venue = venues[0]?.name || ''
    const classifications = raw.classifications || []
    const segment = classifications[0]?.segment?.name || ''
    const genre = classifications[0]?.genre?.name || ''

    // Skip if genre is already specific (not 'Other' or empty)
    if (genre && genre !== 'Other') {
      skipped++
      continue
    }

    // Skip if clearly not a music/concert event
    if (segment === 'Sports' || segment === 'Family' || segment === 'Arts & Theatre') {
      skipped++
      continue
    }

    let category = 'Music'
    let subcategory = null

    const result = await classifyWithGemma(title, '', venue)
    if (!result) { errors++; continue }

    // Map Gemma result to category/subcategory
    if (['Comedy'].includes(result)) {
      category = 'Comedy'
      subcategory = null
    } else if (['Theater'].includes(result)) {
      category = 'Arts & Theater'
      subcategory = null
    } else if (['Sports'].includes(result)) {
      skipped++ // let mapCategory handle
      continue
    } else if (MUSIC_SUBCATEGORIES.includes(result)) {
      category = 'Music'
      subcategory = result
    } else {
      // Other / unrecognized — leave as-is
      skipped++
      continue
    }

    const enrichment = {
      ...(row.ai_enrichment || {}),
      category,
      ...(subcategory ? { subcategory } : {}),
      enriched_by: 'gemma',
      enriched_at: new Date().toISOString(),
    }

    if (isDryRun) {
      console.log(`[DRY] ${title} → ${category}${subcategory ? ' · ' + subcategory : ''}`)
    } else {
      const { error: updateError } = await supabase
        .schema('public')
        .from('events')
        .update({ ai_enrichment: enrichment })
        .eq('id', row.id)

      if (updateError) {
        console.error(`  Error updating ${row.id}:`, updateError.message)
        errors++
      } else {
        enriched++
      }
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${toEnrich.length} | enriched: ${enriched} | skipped: ${skipped} | errors: ${errors}`)
    }
  }

  console.log(`\nDone! enriched: ${enriched} | skipped: ${skipped} | errors: ${errors}`)
}

main().catch(console.error)
