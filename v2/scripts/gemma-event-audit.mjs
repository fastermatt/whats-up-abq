#!/usr/bin/env node
/**
 * Gemma-powered event accuracy audit.
 *
 * For each sampled event, ask local Gemma (LM Studio at :1234) to flag specific
 * accuracy issues that the regression test suite can't catch from data shape alone:
 *   - Category mismatch (title clearly suggests different category than assigned)
 *   - Cancellation / postponement signals in title or description
 *   - Online-only event slipping through (mentions "Zoom" / "stream" / "virtual")
 *   - Geographic mismatch (description indicates non-ABQ location)
 *   - Title / venue logical mismatch (adult comedy at a public library, etc.)
 *
 * Usage:
 *   node scripts/gemma-event-audit.mjs                      # 50 random events
 *   node scripts/gemma-event-audit.mjs --limit=200          # bigger sample
 *   node scripts/gemma-event-audit.mjs --source=eventbrite  # one source
 *   node scripts/gemma-event-audit.mjs --apply              # auto-hide flagged-cancelled events
 *
 * Output: gemma-audit-YYYY-MM-DD.csv with columns:
 *   id, source, title, venue, category, severity, flag, suggestion
 *
 * "severity" is one of: info | warn | block. Only "block" rows are auto-applied
 * (cancellations, online events, foreign events) and only with --apply.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
for (const envFile of [path.join(__dirname, '.env'), path.join(__dirname, '..', '..', 'scripts', '.env')]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
    break
  }
}

const argv = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const LIMIT  = parseInt(argv.limit ?? '50', 10)
const SOURCE = typeof argv.source === 'string' ? argv.source : null
const APPLY  = argv.apply === true
const MODEL  = process.env.LM_STUDIO_MODEL || 'gemma-4-e4b-uncensored-hauhaucs-aggressive'
const LM_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/chat/completions'

const sb = createClient(
  process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, db: { schema: 'public' } }
)

// ── Sample events to audit ──────────────────────────────────────────────────
const todayDb = new Date().toISOString().slice(0, 10)
let q = sb.from('events')
  .select('id, source, category, venue_name, event_date, raw, ai_enrichment')
  .eq('hidden', false)
  .gte('event_date', todayDb)

if (SOURCE) q = q.eq('source', SOURCE)

const { data: events, error } = await q.limit(2000)
if (error) { console.error('DB error:', error.message); process.exit(2) }

// Stratify random sample across sources so we don't audit only TM
function stratifySample(rows, total) {
  const bySource = new Map()
  for (const r of rows) {
    if (!bySource.has(r.source)) bySource.set(r.source, [])
    bySource.get(r.source).push(r)
  }
  const sources = [...bySource.keys()]
  const perSource = Math.max(1, Math.floor(total / sources.length))
  const out = []
  for (const s of sources) {
    const list = bySource.get(s)
    // Fisher-Yates shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    out.push(...list.slice(0, perSource))
  }
  return out.slice(0, total)
}

const sample = stratifySample(events, LIMIT)
console.log(`Auditing ${sample.length} events across ${new Set(sample.map(e => e.source)).size} sources via Gemma…\n`)

// ── Gemma prompt ────────────────────────────────────────────────────────────
const SYSTEM = `You audit cultural-event listings for an Albuquerque, New Mexico events website.
For each event, return STRICT JSON with this exact shape — no prose, no code fences, no commentary:
{
  "flags": [
    { "severity": "info" | "warn" | "block", "code": "string", "reason": "string", "suggestion": "string" }
  ]
}

Available codes (use these exact strings; pick the closest match):
- "category-mismatch"   — assigned category clearly wrong given title/description
- "title-venue-odd"     — venue and event type don't fit (adult-themed event at a public library, etc.)
- "cancelled"           — title or description indicates cancellation
- "postponed"           — indicates postponement
- "online-only"         — clearly virtual / Zoom / livestream
- "non-abq"             — clearly not in the Albuquerque metro
- "stale-date"          — date language indicates the event already happened
- "spam-or-scam"        — looks like spam, MLM, religious recruitment, sketchy investment, etc.

Severity guide:
- "block"  — should be hidden from the site (cancelled, online-only, non-abq, spam, postponed)
- "warn"   — likely wrong but human should confirm (category-mismatch, title-venue-odd)
- "info"   — minor / borderline issue

If there are NO problems, return {"flags": []}.

CRITICAL: Output ONLY the JSON object. No prose, no markdown, no explanation.`

function buildUserMsg(e) {
  const title = e.raw?.name?.text ?? e.raw?.name ?? '(no title)'
  const desc  = e.raw?.description?.text ?? e.raw?.description ?? e.raw?.info ?? ''
  const descShort = typeof desc === 'string' ? desc.slice(0, 600) : ''
  return [
    `id: ${e.id}`,
    `source: ${e.source}`,
    `title: ${title}`,
    `venue: ${e.venue_name ?? '(none)'}`,
    `category (currently assigned): ${e.category ?? '(none)'}`,
    `event_date: ${e.event_date}`,
    descShort ? `description: ${descShort}` : '',
  ].filter(Boolean).join('\n')
}

async function askGemma(userMsg) {
  const res = await fetch(LM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.2,
      max_tokens: 400,
      stream: false,
    }),
  })
  if (!res.ok) throw new Error(`LM Studio HTTP ${res.status}`)
  const j = await res.json()
  const txt = j.choices?.[0]?.message?.content?.trim() ?? '{"flags":[]}'
  // Strip code fences if Gemma adds them anyway
  const clean = txt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try { return JSON.parse(clean) }
  catch {
    // Try to find the first JSON object in the response
    const m = clean.match(/\{[\s\S]*\}/)
    if (m) { try { return JSON.parse(m[0]) } catch {} }
    return { flags: [], _parseError: clean.slice(0, 120) }
  }
}

// ── Run audit ───────────────────────────────────────────────────────────────
const findings = []
let i = 0
for (const e of sample) {
  i++
  process.stdout.write(`  [${String(i).padStart(3)}/${sample.length}] ${e.id.padEnd(35)} … `)
  try {
    const res = await askGemma(buildUserMsg(e))
    const flags = Array.isArray(res.flags) ? res.flags : []
    if (flags.length === 0) {
      console.log('OK')
    } else {
      const top = flags.map(f => f.code).join(',')
      console.log(`flagged: ${top}`)
      for (const f of flags) {
        findings.push({
          id: e.id, source: e.source,
          title: (e.raw?.name?.text ?? e.raw?.name ?? '').toString().replace(/[\r\n,]+/g, ' ').slice(0, 80),
          venue: (e.venue_name ?? '').replace(/[\r\n,]+/g, ' ').slice(0, 60),
          category: e.category ?? '',
          severity: f.severity ?? 'info',
          code:     f.code ?? 'unknown',
          reason:   (f.reason ?? '').replace(/[\r\n,]+/g, ' ').slice(0, 200),
          suggestion: (f.suggestion ?? '').replace(/[\r\n,]+/g, ' ').slice(0, 200),
        })
      }
    }
  } catch (err) {
    console.log(`ERR: ${err.message}`)
  }
}

// ── Write CSV ───────────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10)
const csvPath = path.join(__dirname, `gemma-audit-${date}.csv`)
const header = 'id,source,title,venue,category,severity,code,reason,suggestion'
const rows = findings.map(f =>
  `"${f.id}","${f.source}","${f.title}","${f.venue}","${f.category}",${f.severity},${f.code},"${f.reason}","${f.suggestion}"`
)
fs.writeFileSync(csvPath, [header, ...rows].join('\n'))
console.log(`\nWrote ${findings.length} findings to ${csvPath}`)

// Summary by severity / code
const bySev = {}
const byCode = {}
for (const f of findings) {
  bySev[f.severity] = (bySev[f.severity] ?? 0) + 1
  byCode[f.code]    = (byCode[f.code]    ?? 0) + 1
}
console.log('\nBy severity:', JSON.stringify(bySev))
console.log('By code:    ', JSON.stringify(byCode))

// ── --apply: auto-hide block-severity events ───────────────────────────────
if (APPLY) {
  const blockable = findings.filter(f =>
    f.severity === 'block' &&
    ['cancelled', 'postponed', 'online-only', 'non-abq', 'spam-or-scam'].includes(f.code)
  )
  if (blockable.length === 0) {
    console.log('\nNo block-severity findings to apply.')
  } else {
    const ids = [...new Set(blockable.map(b => b.id))]
    console.log(`\nApplying: hiding ${ids.length} events (${blockable.map(b => b.code).join(',')})…`)
    const { error: updateErr } = await sb.from('events').update({ hidden: true }).in('id', ids)
    if (updateErr) console.error('Update error:', updateErr.message)
    else console.log(`Hidden ${ids.length} events.`)
  }
} else if (Object.values(bySev).some(c => c > 0)) {
  console.log('\nRe-run with --apply to auto-hide block-severity events.')
}
