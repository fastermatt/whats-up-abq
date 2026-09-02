#!/usr/bin/env node
/**
 * audit-accuracy.mjs
 * Uses DeepSeek V3 to audit upcoming events for accuracy:
 *   - Category mismatches (title implies different category)
 *   - Suspicious or generic venue names
 *   - Title quality issues (HTML entities, truncation, garbage)
 *   - Image missing when it should exist
 *
 * Usage:
 *   node scripts/audit-accuracy.mjs               # full audit
 *   node scripts/audit-accuracy.mjs --limit=100   # first 100 events
 *   node scripts/audit-accuracy.mjs --source=abqtodo
 *   node scripts/audit-accuracy.mjs --dry-run     # show what would be sent
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

// ── Load env ──────────────────────────────────────────────────────────────
function loadEnv() {
  const candidates = [
    join(__dir, '.env'),
    join(__dir, '../.env.local'),
    join(__dir, '../.env'),
  ]
  for (const f of candidates) {
    if (existsSync(f)) {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z_]+)=(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
      }
    }
  }
}
loadEnv()

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEEPSEEK_KEY  = process.env.DEEPSEEK_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE credentials')
  process.exit(1)
}

// ── Args ──────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2)
const DRY_RUN   = args.includes('--dry-run')
const LIMIT     = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '500')
const SOURCE    = args.find(a => a.startsWith('--source='))?.split('=')[1] ?? null
const BATCH_SZ  = 30

// ── Supabase ──────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function fetchEvents() {
  const today = new Date().toISOString().slice(0, 10)
  const PAGE  = 500
  let rows    = []
  let offset  = 0

  while (rows.length < LIMIT) {
    let q = supabase
      .schema('public')
      .from('events')
      .select('id, source, raw, category, venue_name, event_date, cached_photo_url, image_status, ai_enrichment')
      .eq('hidden', false)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .range(offset, offset + Math.min(PAGE, LIMIT - rows.length) - 1)

    if (SOURCE) q = q.eq('source', SOURCE)

    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    rows = rows.concat(data)
    if (data.length < PAGE) break
    offset += PAGE
  }

  return rows.slice(0, LIMIT)
}

function extractTitle(raw) {
  return raw?.name ?? raw?.title ?? raw?.summary ?? ''
}

function extractDesc(raw) {
  const d = raw?.description ?? raw?.summary ?? ''
  // Strip HTML
  return d.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, 300)
}

// ── DeepSeek call ─────────────────────────────────────────────────────────
async function callDeepSeek(prompt) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2048,
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek error: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.choices[0].message.content.trim()
}

// ── Audit prompt ──────────────────────────────────────────────────────────
function buildPrompt(batch) {
  const lines = batch.map(e => {
    const raw    = e.raw ?? {}
    const title  = extractTitle(raw)
    const desc   = extractDesc(raw)
    const img    = e.cached_photo_url ? 'yes' : (e.image_status === 'rejected' ? 'rejected' : 'missing')
    return `ID:${e.id} | SRC:${e.source} | CAT:${e.category ?? '?'} | VENUE:${e.venue_name ?? '?'} | DATE:${e.event_date} | IMG:${img}\nTITLE: ${title}\nDESC: ${desc}`
  }).join('\n\n---\n\n')

  return `You are a data quality auditor for ABQ Unplugged, an Albuquerque NM events site. Review each event below and flag any issues.

Valid categories: Music, Sports, Arts & Theater, Comedy, Family, Food & Drink, Film, Community, Festivals, Outdoor

For each problematic event output a JSON object on its own line (no markdown fences):
{"id":"<id>","issue":"<issue_type>","detail":"<one sentence>","suggested_fix":"<value if applicable>"}

Issue types:
- "wrong_category" — title/description clearly implies a different category
- "bad_title" — HTML entities, truncated, or garbled text in title
- "bad_venue" — venue name is an address, URL, or clearly wrong
- "duplicate_title" — title is identical or near-identical to another event in this batch
- "image_rejected_but_should_have_one" — image is 'rejected' but the event title suggests a well-known ticketed show that should have real artwork

Only output lines for events with real issues. Skip events that look fine. If no issues found, output: NO_ISSUES

Events to audit:
${lines}`
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Fetching events (limit=${LIMIT}${SOURCE ? ` source=${SOURCE}` : ''})…`)
  const events = await fetchEvents()
  console.log(`Fetched ${events.length} events`)

  if (DRY_RUN) {
    const sample = events.slice(0, BATCH_SZ)
    console.log('\n── Sample prompt (first batch) ──')
    console.log(buildPrompt(sample))
    return
  }

  const issues = []
  const batches = []
  for (let i = 0; i < events.length; i += BATCH_SZ) {
    batches.push(events.slice(i, i + BATCH_SZ))
  }

  console.log(`Auditing ${batches.length} batches of ${BATCH_SZ}…\n`)

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]
    process.stdout.write(`Batch ${b + 1}/${batches.length}… `)
    try {
      const prompt   = buildPrompt(batch)
      const response = await callDeepSeek(prompt)

      if (response.trim() === 'NO_ISSUES') {
        console.log('✓ clean')
        continue
      }

      const lines = response.split('\n').filter(l => l.trim().startsWith('{'))
      let found = 0
      for (const line of lines) {
        try {
          const obj = JSON.parse(line)
          if (obj.id && obj.issue) {
            issues.push(obj)
            found++
          }
        } catch {}
      }
      console.log(`${found} issue(s)`)

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════')
  console.log(`AUDIT COMPLETE — ${issues.length} issue(s) found across ${events.length} events`)
  console.log('══════════════════════════════════════════\n')

  if (issues.length === 0) {
    console.log('✅ No issues found!')
    return
  }

  // Group by issue type
  const grouped = {}
  for (const issue of issues) {
    grouped[issue.issue] = grouped[issue.issue] ?? []
    grouped[issue.issue].push(issue)
  }

  for (const [type, list] of Object.entries(grouped)) {
    console.log(`\n── ${type.toUpperCase()} (${list.length}) ──`)
    for (const i of list) {
      console.log(`  ${i.id}`)
      console.log(`    ${i.detail}`)
      if (i.suggested_fix) console.log(`    → fix: ${i.suggested_fix}`)
    }
  }

  // ── Auto-fix: wrong categories ─────────────────────────────────────────
  const categoryFixes = issues.filter(i => i.issue === 'wrong_category' && i.suggested_fix)
  if (categoryFixes.length > 0) {
    console.log(`\n══════════════════════════════════════════`)
    console.log(`Applying ${categoryFixes.length} category fix(es)…`)
    let fixed = 0
    for (const fix of categoryFixes) {
      const { error } = await supabase
        .schema('public')
        .from('events')
        .update({ category: fix.suggested_fix })
        .eq('id', fix.id)
      if (error) {
        console.log(`  ✗ ${fix.id}: ${error.message}`)
      } else {
        console.log(`  ✓ ${fix.id}: → ${fix.suggested_fix}`)
        fixed++
      }
    }
    console.log(`Applied ${fixed}/${categoryFixes.length} category fixes`)
  }

  // ── Auto-reject: images that are bad for known reasons ────────────────
  // (We don't auto-fix image issues — user should use admin panel)
  const imageIssues = issues.filter(i => i.issue === 'image_rejected_but_should_have_one')
  if (imageIssues.length > 0) {
    console.log(`\n── IMAGE ISSUES REQUIRING MANUAL REVIEW ──`)
    console.log(`${imageIssues.length} events have rejected images but probably should have artwork.`)
    console.log('Fix via admin panel: /admin/ig?id=<event_id> — or re-run host-event-images.mjs')
    console.log('Event IDs:')
    for (const i of imageIssues) console.log(`  https://abqunplugged.com/events/${i.id}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
