#!/usr/bin/env node
/**
 * score-popularity.mjs — DeepSeek batch popularity scoring for ABQ Unplugged events
 *
 * Scores events 1.0–10.0 based on likely public interest:
 *   10 = major ticketed show (known artist, amphitheater)
 *   7-9 = popular local festival or well-known annual event
 *   5-6 = solid community event with decent draw
 *   3-4 = niche or small-audience event
 *   1-2 = very limited interest (committee meeting, library storytime)
 *
 * Usage:
 *   node scripts/score-popularity.mjs              # score all unscored events
 *   node scripts/score-popularity.mjs --rescore    # re-score everything
 *   node scripts/score-popularity.mjs --limit=50   # cap at 50 events
 *   node scripts/score-popularity.mjs --dry-run    # print scores, don't save
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

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

const args    = process.argv.slice(2)
const RESCORE = args.includes('--rescore')
const DRY_RUN = args.includes('--dry-run')
const LIMIT   = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '9999')
const BATCH   = 10   // events per DeepSeek call (keep output compact to avoid truncation)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const SYSTEM_PROMPT = `You are ranking local events in Albuquerque, NM by likely public interest and attendance.

Score each event from 1.0 to 10.0:
  9-10 = Major ticketed event — nationally/regionally known artist/performer, large venue (amphitheater, arena, convention center), hundreds to thousands expected
  7-8  = Well-known local event — popular annual festival, prominent local band/performer, recognized venue, strong community draw
  5-6  = Solid community event — regular local show, neighborhood festival, themed gathering with genuine appeal, 50-300 expected
  3-4  = Small niche event — local hobby club, small workshop, community meeting with limited appeal, library program
  1-2  = Very limited interest — committee meeting, support group, routine library storytime, bureaucratic gathering

Factors that RAISE score:
- Famous or nationally-known artist/performer
- Large or prestigious venue (Isleta Amphitheater, Kiva Auditorium, Sandia Casino, Hotel Albuquerque)
- Annual or signature ABQ festival (Balloon Fiesta, Green Chile, Founders Day)
- Paid ticket price suggests production value
- Evening on Friday or Saturday
- Multiple artists / big lineup

Factors that LOWER score:
- Library or community center setting (often smaller crowds)
- "Meeting", "committee", "class", "workshop" in title
- Free + very generic (Open Mic, Game Night at a café)
- Kids storytime, knitting circle, beginner yoga

Return ONLY a JSON array — no markdown, no explanation:
[{"id":"...","score":7.5}, ...]`

async function scoreBatch(events) {
  const payload = events.map(e => ({
    id: e.id,
    title: e.title,
    category: e.category ?? 'Community',
    venue: (e.venue_name ?? 'unknown').slice(0, 60),
    date: e.event_date?.slice(0, 10) ?? '',
    // Keep payload lean — no long descriptions, no nulls
    ...(e.raw?.price ? { price: String(e.raw.price).slice(0, 20) } : {}),
    ...(e.source === 'ticketmaster' || e.source === 'seatgeek' ? { ticketed: true } : {}),
  }))

  // Compact JSON, no indentation — saves tokens
  const prompt = `Score these ${events.length} ABQ events. Return ONLY the JSON array:\n${JSON.stringify(payload)}`

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        temperature: 0.1,
        max_tokens: 2048,  // reasoning_content eats tokens before JSON output; needs headroom
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const text = json.choices[0].message.content.trim()
    const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
    const scores = JSON.parse(cleaned)
    if (!Array.isArray(scores)) throw new Error('Not an array')

    // Return as Map id→score
    return new Map(scores.map(s => [s.id, parseFloat(s.score)]))
  } catch (e) {
    console.error('  DeepSeek batch error:', e.message)
    return new Map()
  }
}

async function main() {
  console.log(`🌟 score-popularity (DeepSeek)${DRY_RUN ? ' — DRY RUN' : ''}${RESCORE ? ' — RESCORE ALL' : ''}`)

  // Only upcoming events worth scoring
  let q = supabase
    .from('events')
    .select('id, source, raw, event_date, venue_name, category, popularity_score')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true })
    .limit(LIMIT)

  if (!RESCORE) q = q.is('popularity_score', null)

  const { data: events, error } = await q
  if (error) { console.error('DB error:', error.message); process.exit(1) }
  if (!events?.length) { console.log('No events to score.'); return }

  console.log(`Scoring ${events.length} events in batches of ${BATCH}…\n`)

  let scored = 0, skipped = 0

  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH)
    process.stdout.write(`  Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(events.length / BATCH)} (${batch.length} events)… `)

    const scoreMap = await scoreBatch(batch)

    if (scoreMap.size === 0) {
      console.log('failed — skipping')
      skipped += batch.length
    } else {
      console.log(`got ${scoreMap.size} scores`)

      for (const ev of batch) {
        const score = scoreMap.get(ev.id)
        if (score === undefined || isNaN(score)) { skipped++; continue }

        const clamped = Math.min(10, Math.max(1, Math.round(score * 10) / 10))

        if (DRY_RUN) {
          const title = (ev.raw?.name ?? ev.id).slice(0, 50)
          console.log(`    ${clamped.toFixed(1)} — ${title}`)
          scored++
          continue
        }

        const { error: upErr } = await supabase
          .from('events')
          .update({ popularity_score: clamped })
          .eq('id', ev.id)

        if (upErr) {
          console.error(`    ✗ ${ev.id}: ${upErr.message}`)
          skipped++
        } else {
          scored++
        }
      }
    }

    // Polite delay between batches
    if (i + BATCH < events.length) await new Promise(r => setTimeout(r, 500))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 score-popularity complete
   Scored   : ${scored}
   Skipped  : ${skipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
