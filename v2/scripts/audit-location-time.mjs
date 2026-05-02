#!/usr/bin/env node
/**
 * Location + time accuracy audit.
 *
 * For each sampled event we ask the local LLM (any model) two questions:
 *   1. Does the description mention an ADDRESS or VENUE different from the one
 *      stored in our DB? (location drift)
 *   2. Does the description mention a TIME different from the one we display?
 *      ("Doors at 7" vs DB time "20:00" should NOT flag — but "rescheduled to
 *      Saturday at 3pm" against a Friday 8pm DB row SHOULD flag.)
 *
 * Output: location-time-audit-YYYY-MM-DD.csv
 *
 * Usage:
 *   node scripts/audit-location-time.mjs                    # 60 events
 *   node scripts/audit-location-time.mjs --limit=200
 *   node scripts/audit-location-time.mjs --source=local
 *   node scripts/audit-location-time.mjs --apply            # auto-hide
 *                                                          # confirmed location/time mismatches
 *
 * Auto-detects LM Studio / Ollama / llama.cpp on default ports — see lib/llm.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chatJson, printLLMHeader } from './lib/llm.mjs'

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
const LIMIT  = parseInt(argv.limit ?? '60', 10)
const SOURCE = typeof argv.source === 'string' ? argv.source : null
const APPLY  = argv.apply === true

const sb = createClient(
  process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, db: { schema: 'public' } }
)

const TODAY_ISO = new Date().toISOString().slice(0, 10)
const SYSTEM = `You audit cultural-event listings for accuracy.

Today's date is ${TODAY_ISO}. Future-dated events are NOT stale.
You are given the metadata we currently display (title, venue, address, date, time, source URL) and the source's own description text. Your job is to flag CONFIRMED contradictions between the displayed metadata and the description — not subjective taste, not minor format differences.

Return STRICT JSON shaped exactly:
{
  "venue_ok":  true | false,
  "time_ok":   true | false,
  "rescheduled": true | false,
  "reason":    "<one short sentence — only fill if any field is false>"
}

Rules:
- If the description is silent on venue/time, the displayed value is fine — return true.
- "Doors at 7, show at 8" with displayed time "20:00" or "8:00 PM" is OK (true).
- A description that names a different physical venue OR a different street address sets venue_ok=false.
- A description that says "rescheduled to <new date/time>" or "now <new date>" sets rescheduled=true AND time_ok=false.
- "Online", "via Zoom", "livestream" in the description while the DB has a physical venue → venue_ok=false.
- Be conservative. You're flagging things to be human-reviewed; false negatives are far cheaper than false positives.
- ONLY emit the JSON object. No prose. No code fences.`

function buildUserMsg(e) {
  const title = e.raw?.name?.text ?? e.raw?.name ?? '(no title)'
  const desc  = e.raw?.description?.text ?? e.raw?.description ?? e.raw?.info ?? ''
  const descShort = typeof desc === 'string' ? desc.slice(0, 1200) : ''
  // Display time = whatever we'd show users
  const time = e.raw?.dates?.start?.localTime ?? ''
  return [
    `Displayed metadata:`,
    `  title:   ${title}`,
    `  venue:   ${e.venue_name ?? '(none)'}`,
    `  date:    ${e.event_date}`,
    `  time:    ${time}`,
    `  source:  ${e.source}`,
    '',
    `Source description (verbatim, may be truncated):`,
    descShort || '(none)',
  ].join('\n')
}

// Skip events with no description — Gemma can't audit nothing
function hasDescription(e) {
  const desc = e.raw?.description?.text ?? e.raw?.description ?? e.raw?.info ?? ''
  return typeof desc === 'string' && desc.trim().length > 80
}

const todayDb = new Date().toISOString().slice(0, 10)
let q = sb.from('events')
  .select('id, source, venue_name, event_date, raw, hidden')
  .eq('hidden', false)
  .gte('event_date', todayDb)
if (SOURCE) q = q.eq('source', SOURCE)
const { data: events, error } = await q.limit(2000)
if (error) { console.error('DB error:', error.message); process.exit(2) }

const auditable = events.filter(hasDescription)
console.log(`Eligible: ${auditable.length} of ${events.length} events have a description ≥80 chars`)
if (auditable.length === 0) { console.log('Nothing to audit — exit'); process.exit(0) }

// Stratified sample by source
const bySrc = new Map()
for (const r of auditable) {
  if (!bySrc.has(r.source)) bySrc.set(r.source, [])
  bySrc.get(r.source).push(r)
}
const sources = [...bySrc.keys()]
const per = Math.max(1, Math.floor(LIMIT / sources.length))
const sample = []
for (const s of sources) {
  const list = bySrc.get(s)
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  sample.push(...list.slice(0, per))
}

await printLLMHeader()
console.log(`Auditing location/time on ${sample.length} events…\n`)

const findings = []
let i = 0
for (const e of sample) {
  i++
  process.stdout.write(`  [${String(i).padStart(3)}/${sample.length}] ${e.id.padEnd(35)} … `)
  try {
    const res = await chatJson({
      system: SYSTEM,
      user: buildUserMsg(e),
      schemaHint: '{ "venue_ok": bool, "time_ok": bool, "rescheduled": bool, "reason": "..." }',
      maxTokens: 250,
    })
    const v = res.venue_ok !== false   // default true
    const t = res.time_ok  !== false
    const r = res.rescheduled === true
    if (v && t && !r) {
      console.log('OK')
    } else {
      const codes = [v ? null : 'venue', t ? null : 'time', r ? 'rescheduled' : null].filter(Boolean)
      console.log(`flagged: ${codes.join(',')} — ${(res.reason||'').slice(0,80)}`)
      findings.push({
        id: e.id, source: e.source,
        title: (e.raw?.name?.text ?? e.raw?.name ?? '').toString().replace(/[\r\n,]+/g, ' ').slice(0, 100),
        venue: (e.venue_name ?? '').replace(/[\r\n,]+/g, ' ').slice(0, 80),
        event_date: e.event_date,
        venue_ok: v, time_ok: t, rescheduled: r,
        reason: (res.reason || '').replace(/[\r\n,]+/g, ' ').slice(0, 240),
      })
    }
  } catch (err) {
    console.log(`ERR: ${err.message.slice(0,80)}`)
  }
}

const date = new Date().toISOString().slice(0, 10)
const csvPath = path.join(__dirname, `location-time-audit-${date}.csv`)
const header = 'id,source,title,venue,event_date,venue_ok,time_ok,rescheduled,reason'
const rows = findings.map(f =>
  `"${f.id}","${f.source}","${f.title}","${f.venue}","${f.event_date}",${f.venue_ok},${f.time_ok},${f.rescheduled},"${f.reason}"`
)
fs.writeFileSync(csvPath, [header, ...rows].join('\n'))
console.log(`\nWrote ${findings.length} findings to ${csvPath}`)

if (APPLY && findings.length) {
  // Hide events flagged for venue change OR rescheduling — these are the
  // higher-confidence "remove from site" signals. Time-only mismatches
  // (often "doors vs show" confusion) are warnings, not auto-applied.
  const blockable = findings.filter(f => f.venue_ok === false || f.rescheduled === true)
  if (!blockable.length) {
    console.log('No auto-apply candidates (venue + rescheduled). Time-only mismatches are warnings.')
  } else {
    const ids = [...new Set(blockable.map(b => b.id))]
    console.log(`\nApplying: hiding ${ids.length} events with venue or reschedule flags…`)
    const hiddenAt = new Date().toISOString()
    for (const finding of blockable) {
      const reason = finding.rescheduled ? 'audit_rescheduled' : 'audit_venue_mismatch'
      const { data: row } = await sb.from('events').select('ai_enrichment').eq('id', finding.id).single()
      const merged = { ...(row?.ai_enrichment ?? {}), hide_reason: reason, hidden_at: hiddenAt }
      const { error: updateErr } = await sb.from('events').update({ hidden: true, ai_enrichment: merged }).eq('id', finding.id)
      if (updateErr) console.error(`  ✗ ${finding.id}: ${updateErr.message}`)
      else console.log(`  ✅ ${finding.id} (${reason})`)
    }
  }
}
