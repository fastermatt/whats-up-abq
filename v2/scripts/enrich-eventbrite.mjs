/**
 * LLM enrichment for Eventbrite + local/volunteer events.
 * Assigns category (and subcategory for music) using Gemma 4 via LM Studio.
 *
 * Usage: node scripts/enrich-eventbrite.mjs [--dry-run] [--source=eventbrite|local|volunteer]
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXZmdXRlYm1ia2p2bHJoaXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIzODAzMiwiZXhwIjoyMDg5ODE0MDMyfQ.z0ROQshAv4qOLIONKESzZZFUH6dN9coiB_aX6MAWEls'
const LM_STUDIO_URL = 'http://localhost:1234/v1/chat/completions'

const isDryRun = process.argv.includes('--dry-run')
const sourceArg = process.argv.find(a => a.startsWith('--source='))
const sources = sourceArg
  ? [sourceArg.split('=')[1]]
  : ['eventbrite', 'local', 'volunteer']

const VALID_CATEGORIES = [
  'Music', 'Comedy', 'Sports', 'Arts & Theater', 'Family',
  'Film', 'Food & Drink', 'Festivals', 'Outdoor', 'Community',
]
const MUSIC_SUBS = [
  'Rock', 'Pop', 'Country', 'Jazz', 'Hip-Hop', 'R&B', 'Electronic',
  'Latin', 'Folk', 'Metal', 'Classical', 'Blues', 'Soul', 'Alternative', 'Indie',
]

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function classifyEvent(title, description, venue, rawCategory) {
  const prompt = `You are an event classifier for an Albuquerque event website.
Classify this event into ONE category. Reply with JSON only, no explanation.

Categories: Music, Comedy, Sports, Arts & Theater, Family, Film, Food & Drink, Festivals, Outdoor, Community

If category is Music, also provide subcategory from: Rock, Pop, Country, Jazz, Hip-Hop, R&B, Electronic, Latin, Folk, Metal, Classical, Blues, Soul, Alternative, Indie, Other

Event title: ${title}
${rawCategory ? `Source category: ${rawCategory}` : ''}
${venue ? `Venue: ${venue}` : ''}
${description ? `Description: ${description.slice(0, 200)}` : ''}

Reply with JSON: {"category": "Music", "subcategory": "Rock"} or {"category": "Community"}`

  try {
    const res = await fetch(LM_STUDIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemma-4-e4b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 40,
        temperature: 0,
      }),
    })
    const json = await res.json()
    const text = (json.choices?.[0]?.message?.content ?? '').trim()
    // Extract JSON from response
    const match = text.match(/\{[^}]+\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    const category = parsed.category
    if (!VALID_CATEGORIES.includes(category)) return null
    const subcategory = (category === 'Music' && MUSIC_SUBS.includes(parsed.subcategory))
      ? parsed.subcategory : null
    return { category, subcategory }
  } catch {
    return null
  }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10)
  let totalEnriched = 0, totalSkipped = 0, totalErrors = 0

  for (const source of sources) {
    console.log(`\n=== Processing source: ${source} ===`)

    const { data: events } = await supabase
      .schema('public')
      .from('events')
      .select('id, raw, ai_enrichment')
      .eq('source', source)
      .eq('hidden', false)
      .gte('event_date', today)
      .order('event_date', { ascending: true })

    if (!events?.length) { console.log('No events found.'); continue }

    // Only process un-enriched events
    const toEnrich = events.filter(e => !e.ai_enrichment?.category)
    console.log(`Found ${events.length} events, ${toEnrich.length} need enrichment`)

    let enriched = 0, skipped = 0, errors = 0

    for (let i = 0; i < toEnrich.length; i++) {
      const row = toEnrich[i]
      const raw = row.raw

      // Extract fields based on source format
      let title = '', description = '', venue = '', rawCategory = ''
      if (source === 'eventbrite') {
        const nameField = raw.name
        title = (typeof nameField === 'object' ? nameField?.text : nameField) ?? ''
        description = raw.description?.text ?? raw.description ?? ''
        venue = raw.venue?.name ?? ''
        rawCategory = raw.category?.name ?? ''
      } else {
        // local / volunteer — TM-compatible or custom format
        title = raw.name || raw.title || ''
        description = raw.info || raw.description || ''
        venue = raw._embedded?.venues?.[0]?.name || raw.venue_name || raw.venue || ''
        rawCategory = raw.category || ''
      }

      if (!title) { skipped++; continue }

      const result = await classifyEvent(title, description, venue, rawCategory)
      if (!result) { errors++; continue }

      if (isDryRun) {
        console.log(`[DRY] ${title.slice(0, 60)} → ${result.category}${result.subcategory ? ' · ' + result.subcategory : ''}`)
      } else {
        const enrichment = {
          ...(row.ai_enrichment || {}),
          category: result.category,
          ...(result.subcategory ? { subcategory: result.subcategory } : {}),
          enriched_by: 'gemma',
          enriched_at: new Date().toISOString(),
        }
        const { error } = await supabase
          .schema('public').from('events')
          .update({ ai_enrichment: enrichment })
          .eq('id', row.id)
        if (error) { console.error('  Update error:', error.message); errors++ }
        else enriched++
      }

      if ((i + 1) % 20 === 0) {
        console.log(`  ${i + 1}/${toEnrich.length} | enriched: ${enriched} | skipped: ${skipped} | errors: ${errors}`)
      }
    }

    console.log(`Done ${source}: enriched ${enriched}, skipped ${skipped}, errors ${errors}`)
    totalEnriched += enriched; totalSkipped += skipped; totalErrors += errors
  }

  console.log(`\n=== TOTAL: enriched ${totalEnriched}, skipped ${totalSkipped}, errors ${totalErrors} ===`)
}

main().catch(console.error)
