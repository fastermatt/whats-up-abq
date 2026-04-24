#!/usr/bin/env node
/**
 * check-broken-links.mjs
 *
 * Checks every visible upcoming event's external URL for 404s.
 * Auto-hides confirmed 404s. Flags 403/429/timeout for manual review.
 *
 * Usage:
 *   node scripts/check-broken-links.mjs             # live run (hides broken)
 *   node scripts/check-broken-links.mjs --dry-run   # report only, no DB writes
 *   node scripts/check-broken-links.mjs --source=ticketmaster
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load env ──────────────────────────────────────────────────────────────────
for (const f of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env.local'),
]) {
  if (fs.existsSync(f)) {
    fs.readFileSync(f, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
      if (m) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
    })
  }
}

const DRY_RUN  = process.argv.includes('--dry-run')
const SRC_FILTER = (process.argv.find(a => a.startsWith('--source=')) || '').replace('--source=', '') || null
const CONCURRENCY = 6
const TIMEOUT_MS  = 12_000

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ── Fetch events ──────────────────────────────────────────────────────────────
async function loadEvents() {
  let q = supabase
    .schema('public')
    .from('events')
    .select('id, source, event_date, raw')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .not('raw->url', 'is', null)
    .order('event_date', { ascending: true })

  if (SRC_FILTER) q = q.eq('source', SRC_FILTER)

  // Supabase default limit is 1000 — override to get all events
  q = q.range(0, 9999)

  const { data, error } = await q
  if (error) throw error
  return data.filter(e => e.raw?.url)
}

// ── URL check ─────────────────────────────────────────────────────────────────
async function checkUrl(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    // Try HEAD first — less bandwidth
    let res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      signal: ctrl.signal,
      redirect: 'follow',
    })
    // Some servers reject HEAD with 405 — fallback to GET
    if (res.status === 405) {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
        signal: ctrl.signal,
        redirect: 'follow',
      })
    }
    clearTimeout(timer)
    return { status: res.status, ok: res.ok }
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') return { status: 'timeout', ok: false }
    return { status: `error:${err.message.slice(0, 60)}`, ok: false }
  }
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
async function pool(items, fn, concurrency) {
  const results = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

// ── Main ──────────────────────────────────────────────────────────────────────
const events = await loadEvents()
console.log(`\nChecking ${events.length} event URLs${SRC_FILTER ? ` (source: ${SRC_FILTER})` : ''}${DRY_RUN ? ' [DRY RUN]' : ''}…\n`)

const broken    = []  // 404 confirmed
const blocked   = []  // 403/429 — bot-blocked, can't tell
const timeouts  = []  // network timeout
const errors    = []  // other fetch errors

let checked = 0

const results = await pool(events, async (event) => {
  const url = event.raw.url
  const { status, ok } = await checkUrl(url)
  checked++

  const tag =
    status === 404 ? '💀 404' :
    status === 403 ? '🔒 403' :
    status === 429 ? '⏳ 429' :
    status === 'timeout' ? '⌛ TIMEOUT' :
    String(status).startsWith('error:') ? `❌ ERR` :
    ok ? `✅ ${status}` : `⚠️  ${status}`

  process.stdout.write(`\r[${checked}/${events.length}] ${tag.padEnd(12)} ${url.slice(0, 80)}`)

  if (status === 404) broken.push({ ...event, url, status })
  else if (status === 403 || status === 429) blocked.push({ ...event, url, status })
  else if (status === 'timeout') timeouts.push({ ...event, url, status })
  else if (String(status).startsWith('error:')) errors.push({ ...event, url, status })

  return { event, url, status, ok }
}, CONCURRENCY)

process.stdout.write('\n\n')

// ── Report ────────────────────────────────────────────────────────────────────
console.log('═'.repeat(70))
console.log(`RESULTS: ${checked} checked | ${broken.length} broken (404) | ${blocked.length} blocked | ${timeouts.length} timeouts | ${errors.length} errors`)
console.log('═'.repeat(70))

if (broken.length) {
  console.log('\n💀 BROKEN (404) — will be hidden:')
  broken.forEach(e => console.log(`  ${e.id.padEnd(50)} ${e.url}`))
}

const realBlocked = blocked.filter(e => !['ticketmaster','seatgeek'].includes(e.source))
const tmSgBlocked  = blocked.filter(e =>  ['ticketmaster','seatgeek'].includes(e.source))
if (realBlocked.length) {
  console.log('\n🔒 BOT-BLOCKED (403/429) — manual review needed:')
  realBlocked.forEach(e => console.log(`  [${e.status}] ${e.id.padEnd(46)} ${e.url}`))
}
if (tmSgBlocked.length) {
  console.log(`\n🤖 ${tmSgBlocked.length} Ticketmaster/SeatGeek events returned 401/403 (normal bot-blocking — not evidence of broken links)`)
}

if (timeouts.length) {
  console.log('\n⌛ TIMEOUTS — may be slow or down:')
  timeouts.forEach(e => console.log(`  ${e.id.padEnd(50)} ${e.url}`))
}

if (errors.length) {
  console.log('\n❌ ERRORS:')
  errors.forEach(e => console.log(`  ${e.id.padEnd(50)} ${e.status}`))
}

// ── Auto-hide 404s ────────────────────────────────────────────────────────────
if (broken.length && !DRY_RUN) {
  console.log(`\nHiding ${broken.length} events with confirmed 404 URLs…`)
  const ids = broken.map(e => e.id)
  const { error } = await supabase
    .schema('public')
    .from('events')
    .update({ hidden: true })
    .in('id', ids)
  if (error) {
    console.error('DB update failed:', error.message)
  } else {
    console.log(`✅ Hid ${ids.length} events.`)
    ids.forEach(id => console.log(`  • ${id}`))
  }
} else if (broken.length && DRY_RUN) {
  console.log(`\n[DRY RUN] Would hide ${broken.length} events — run without --dry-run to apply.`)
}

// ── Write report CSV ──────────────────────────────────────────────────────────
const reportPath = path.join(__dirname, `broken-links-${new Date().toISOString().slice(0,10)}.csv`)
const rows = results.map(r => [
  r.event.id,
  r.event.source,
  r.event.event_date,
  r.status,
  r.ok ? 'ok' : (r.status === 404 ? 'hidden' : 'flagged'),
  r.url,
].join(','))
fs.writeFileSync(reportPath, ['id,source,date,status,action,url', ...rows].join('\n'))
console.log(`\nFull report written to: ${reportPath}`)
