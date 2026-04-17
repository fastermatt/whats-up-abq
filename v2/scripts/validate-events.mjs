#!/usr/bin/env node
/**
 * Data quality validation for the public.events table.
 *
 * Checks:
 *   ✓ Event counts by source (warns if any source is suspiciously low)
 *   ✓ Category coverage (fails if > 2% of events have null category)
 *   ✓ Mood enrichment coverage (warns if < 80%)
 *   ✓ Neighborhood tag coverage (warns if < 75%)
 *   ✓ Photo coverage (warns if < 50%)
 *   ✓ No events with obviously bad dates (past events not hidden, dates > 3 years out)
 *   ✓ Spot-check: known anchors exist (TEB, NM United, NHCC events)
 *
 * Exit codes:
 *   0 = all checks passed (warnings are OK)
 *   1 = one or more FAIL checks
 *
 * Usage:
 *   node scripts/validate-events.mjs [--strict]
 *
 *   --strict  Treat warnings as failures
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in scripts/.env or environment
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
if (!SUPABASE_KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1) }

const isStrict = process.argv.includes('--strict')
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Supabase REST API base for raw queries
const REST = SUPABASE_URL + '/rest/v1'
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

/** Fetch ALL rows for a query, paginating through Supabase's 1000-row limit */
async function rest(path, pageSize = 1000) {
  const allRows = []
  let offset = 0
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const r = await fetch(`${REST}${path}${sep}limit=${pageSize}&offset=${offset}`, {
      headers: { ...HEADERS, 'Prefer': 'count=exact' },
    })
    const rows = await r.json()
    if (!Array.isArray(rows) || rows.length === 0) break
    allRows.push(...rows)
    if (rows.length < pageSize) break  // last page
    offset += pageSize
  }
  return allRows
}

const today     = new Date().toISOString().slice(0, 10)
const threeYrs  = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

// ── Check results ─────────────────────────────────────────────────────────────

const results = []  // { label, status: 'pass'|'warn'|'fail', detail }

function pass(label, detail) { results.push({ label, status: 'pass', detail }) }
function warn(label, detail) { results.push({ label, status: 'warn', detail }) }
function fail(label, detail) { results.push({ label, status: 'fail', detail }) }

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkCounts() {
  const rows = await rest(`/events?hidden=eq.false&event_date=gte.${today}&select=source`)
  if (!Array.isArray(rows)) { fail('Event fetch', 'Could not query events table'); return }

  const counts = {}
  for (const r of rows) counts[r.source] = (counts[r.source] || 0) + 1
  const total = rows.length

  const thresholds = {
    seatgeek:     { warn: 100, fail: 50 },
    ticketmaster: { warn: 100, fail: 50 },
    eventbrite:   { warn:  30, fail: 10 },
    nhcc:         { warn:  15, fail:  5 },
    local:        { warn:  10, fail:  3 },
    volunteer:    { warn:   5, fail:  1 },
  }

  const lines = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([src, n]) => `${src}: ${n}`)
    .join(', ')

  if (total < 200) fail('Total events', `Only ${total} upcoming — expected ≥200. ${lines}`)
  else if (total < 400) warn('Total events', `${total} upcoming events (low). ${lines}`)
  else pass('Total events', `${total} upcoming. ${lines}`)

  for (const [src, { warn: warnAt, fail: failAt }] of Object.entries(thresholds)) {
    const n = counts[src] || 0
    if (n < failAt) fail(`Source: ${src}`, `Only ${n} events (expect ≥${failAt})`)
    else if (n < warnAt) warn(`Source: ${src}`, `${n} events (low, expect ≥${warnAt})`)
    else pass(`Source: ${src}`, `${n} events ✓`)
  }
}

async function checkCategories() {
  const all = await rest(`/events?hidden=eq.false&event_date=gte.${today}&select=category`)
  if (!Array.isArray(all)) { warn('Categories', 'Could not fetch'); return }

  const nullCat = all.filter(r => !r.category).length
  const pct = (nullCat / all.length * 100).toFixed(1)
  if (nullCat === 0) pass('Category coverage', '100% of events have a category ✓')
  else if (nullCat / all.length < 0.02) warn('Category coverage', `${nullCat} events (${pct}%) missing category`)
  else fail('Category coverage', `${nullCat} events (${pct}%) have no category — run import scripts`)
}

async function checkMoodEnrichment() {
  const all = await rest(`/events?hidden=eq.false&event_date=gte.${today}&select=ai_enrichment`)
  if (!Array.isArray(all)) { warn('Mood enrichment', 'Could not fetch'); return }

  const withMood = all.filter(r => r.ai_enrichment?.mood).length
  const pct = (withMood / all.length * 100).toFixed(1)
  if (withMood / all.length >= 0.95) pass('Mood enrichment', `${pct}% of events have mood ✓`)
  else if (withMood / all.length >= 0.80) warn('Mood enrichment', `${pct}% enriched (target 95%)`)
  else fail('Mood enrichment', `Only ${pct}% (${withMood}/${all.length}) have mood tags — run enrich-moods-rules.mjs`)
}

async function checkNeighborhoods() {
  const all = await rest(`/events?hidden=eq.false&event_date=gte.${today}&select=neighborhood_slug`)
  if (!Array.isArray(all)) { warn('Neighborhoods', 'Could not fetch'); return }

  const tagged = all.filter(r => r.neighborhood_slug).length
  const pct = (tagged / all.length * 100).toFixed(1)
  if (tagged / all.length >= 0.90) pass('Neighborhood tags', `${pct}% tagged ✓`)
  else if (tagged / all.length >= 0.75) warn('Neighborhood tags', `${pct}% tagged (target 90%)`)
  else fail('Neighborhood tags', `Only ${pct}% tagged — run tag-neighborhoods.mjs`)
}

async function checkPhotos() {
  const all = await rest(`/events?hidden=eq.false&event_date=gte.${today}&select=cached_photo_url`)
  if (!Array.isArray(all)) { warn('Photos', 'Could not fetch'); return }

  const withPhoto = all.filter(r => r.cached_photo_url).length
  const pct = (withPhoto / all.length * 100).toFixed(1)
  if (withPhoto / all.length >= 0.70) pass('Photo coverage', `${pct}% have photos ✓`)
  else if (withPhoto / all.length >= 0.50) warn('Photo coverage', `${pct}% have photos`)
  else warn('Photo coverage', `Only ${pct}% have photos (many events rely on fallback illustrations)`)
}

async function checkBadDates() {
  // Events more than 3 days in the past that aren't hidden
  // (allow a 3-day grace — the site already filters these out by event_date, so
  //  this only matters if there are very old records piling up)
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
  const past = await rest(
    `/events?hidden=eq.false&event_date=lt.${threeDaysAgo}&select=id,event_date,source&limit=50`
  )
  if (Array.isArray(past) && past.length > 20) {
    warn('Stale past events', `${past.length} events > 3 days old still in DB (not hidden) — consider a purge`)
  } else {
    pass('Past events', `${Array.isArray(past) ? past.length : 0} stale events (within acceptable range) ✓`)
  }

  // Far-future events (> 3 years out)
  const farFuture = await rest(
    `/events?hidden=eq.false&event_date=gt.${threeYrs}&select=id,event_date&limit=5`
  )
  if (Array.isArray(farFuture) && farFuture.length > 0) {
    warn('Far-future events', `${farFuture.length} events > 3 years out`)
  } else {
    pass('Date range', `All events within 3 years ✓`)
  }
}

async function checkAnchors() {
  // Spot-check known events that should always exist
  const anchors = [
    { id: 'local-third-eye-blind-2026', name: 'Third Eye Blind (June 2026)' },
  ]

  for (const anchor of anchors) {
    const rows = await rest(`/events?id=eq.${anchor.id}&select=id,hidden,event_date`)
    if (!Array.isArray(rows) || rows.length === 0) {
      warn(`Anchor: ${anchor.name}`, 'Event not found in DB')
    } else if (rows[0].hidden) {
      warn(`Anchor: ${anchor.name}`, 'Event exists but is hidden')
    } else {
      pass(`Anchor: ${anchor.name}`, `Found, event_date: ${rows[0].event_date} ✓`)
    }
  }

  // Check that NM United soccer events exist (they're big ABQ events)
  const soccer = await rest(
    `/events?source=eq.seatgeek&hidden=eq.false&event_date=gte.${today}&select=id&limit=5`
    + `&raw->>name=ilike.*United*`
  )
  if (Array.isArray(soccer) && soccer.length > 0) {
    pass('NM United events', `${soccer.length} found ✓`)
  } else {
    // Just a soft warning — NM United might be offseason
    warn('NM United events', 'No NM United events found (offseason?)')
  }
}

async function checkSourceFreshness() {
  // Check that each source has events coming up in the next 2 weeks
  // (ensures imports ran recently and aren't totally stale)
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const recent = await rest(
    `/events?hidden=eq.false&event_date=gte.${today}&event_date=lte.${twoWeeks}&select=source`
  )
  if (!Array.isArray(recent)) { warn('Freshness check', 'Could not fetch'); return }

  const counts = {}
  for (const r of recent) counts[r.source] = (counts[r.source] || 0) + 1

  const mustHaveRecent = ['seatgeek', 'ticketmaster', 'eventbrite']
  for (const src of mustHaveRecent) {
    const n = counts[src] || 0
    if (n >= 5) pass(`Freshness: ${src}`, `${n} events in next 2 weeks ✓`)
    else fail(`Freshness: ${src}`, `Only ${n} events in next 2 weeks — data may be stale`)
  }
}

// ── Print results ─────────────────────────────────────────────────────────────

function printResults() {
  const icons = { pass: '✅', warn: '⚠️ ', fail: '❌' }
  let failCount = 0, warnCount = 0

  console.log('\n' + '═'.repeat(60))
  console.log('  ABQ Unplugged — Event Data Validation Report')
  console.log(`  ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`)
  console.log('═'.repeat(60) + '\n')

  for (const { label, status, detail } of results) {
    const icon = icons[status]
    console.log(`${icon} ${label}`)
    console.log(`     ${detail}`)
    if (status === 'fail') failCount++
    if (status === 'warn') warnCount++
  }

  console.log('\n' + '─'.repeat(60))
  const passCount = results.length - failCount - warnCount
  console.log(`  ${passCount} passed  |  ${warnCount} warnings  |  ${failCount} failed`)
  console.log('─'.repeat(60))

  // GitHub Actions step summary format
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## 🔍 Event Data Validation\n',
      `| Check | Status | Detail |`,
      `|-------|--------|--------|`,
      ...results.map(r => `| ${r.label} | ${icons[r.status]} ${r.status.toUpperCase()} | ${r.detail} |`),
      `\n**Summary:** ${passCount} passed, ${warnCount} warnings, ${failCount} failed`,
    ]
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
  }

  if (failCount > 0) {
    console.error(`\n❌ ${failCount} check(s) FAILED`)
    process.exit(1)
  } else if (isStrict && warnCount > 0) {
    console.error(`\n⚠️  ${warnCount} warning(s) in strict mode`)
    process.exit(1)
  } else {
    console.log(`\n✅ Validation passed${warnCount > 0 ? ` (${warnCount} warnings)` : ''}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Validating event data quality...\n')
  await checkCounts()
  await checkCategories()
  await checkMoodEnrichment()
  await checkNeighborhoods()
  await checkPhotos()
  await checkBadDates()
  await checkSourceFreshness()
  await checkAnchors()
  printResults()
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
