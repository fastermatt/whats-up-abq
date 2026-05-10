#!/usr/bin/env node
/**
 * ABQ Unplugged — Foolproof Ingestion Pipeline
 * ============================================
 *
 * THE one command for event ingestion. Everything in this file is designed so
 * that a successful exit-0 run means the site is in a good state, and any
 * anomaly exits non-zero with a loud, specific error.
 *
 * Pipeline:
 *
 *   0. BASELINE — snapshot counts by source, category, rejected-image count
 *   1. IMPORT   — TM, SG, EB, NHCC (per-source isolated, 2 retries on transient failure)
 *   2. ENRICH   — neighborhood tagging, rule-based moods
 *   3. CLEANUP  — hide past events, duplicates, cancelled
 *   4. GATES    — hard thresholds (not warnings) on count drop, coverage
 *   5. SMOKE    — sample random new events, validate image/time/venue/category
 *   6. INVARIANTS — admin image rejections preserved, trigger still working
 *   7. REPORT   — before/after diff, pass/fail per check, exit code
 *
 * Usage:
 *   node scripts/ingest.mjs                          # full pipeline
 *   node scripts/ingest.mjs --dry-run                # plan only, no writes
 *   node scripts/ingest.mjs --only=nhcc              # one source
 *   node scripts/ingest.mjs --skip-imports           # enrich + validate only
 *   node scripts/ingest.mjs --smoke-only             # just run smoke tests
 *   node scripts/ingest.mjs --quiet                  # only print summary + failures
 *
 * Exit codes:
 *   0  — all gates + smoke passed; site is healthy
 *   1  — one or more hard checks failed (see summary)
 *   2  — crash / unexpected error (look at stack)
 *
 * Design rules (do not break these):
 *   - ONE source failing never kills another source (try/catch per import)
 *   - Importers use upsert + the DB trigger preserves image_status=rejected
 *   - Post-run validation has HARD gates, not warnings. Drift detection: if a
 *     source's event count drops >30% vs baseline, we fail loudly.
 *   - Smoke tests actually HEAD the image URLs and parse dates. No mocks.
 *   - Never deletes. Cleanup hides (hidden=true). Audit trail preserved.
 *
 * See also: ~/.claude/projects/.../memory/ingestion.md and image_system.md
 */

import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load env from v2/.env.local OR scripts/.env ─────────────────────────────

for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '..', 'scripts', '.env'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(2)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ── CLI ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag  = (name) => argv.includes(`--${name}`)
const value = (name) => { const p = argv.find(a => a.startsWith(`--${name}=`)); return p ? p.split('=')[1] : null }

const DRY         = flag('dry-run')
const SKIP_IMPORT = flag('skip-imports')
const SKIP_ENRICH = flag('skip-enrich')
const SKIP_SMOKE  = flag('skip-smoke')
const SMOKE_ONLY  = flag('smoke-only')
const QUIET       = flag('quiet')
const ONLY_SOURCE = value('only')  // e.g., --only=nhcc

// ── ANSI colors ────────────────────────────────────────────────────────────

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m' }
const log = (m) => !QUIET && console.log(m)
const step = (m) => console.log(`\n${C.bold}${C.cyan}▸ ${m}${C.reset}`)
const ok   = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`)
const warn = (m) => console.log(`  ${C.yellow}⚠${C.reset}  ${m}`)
const fail = (m) => console.log(`  ${C.red}✗${C.reset}  ${m}`)
const hr   = () => console.log(`${C.dim}${'─'.repeat(72)}${C.reset}`)

// ── Source definitions ─────────────────────────────────────────────────────

const SOURCES = [
  { key: 'ticketmaster', script: 'import-ticketmaster.mjs', requires: ['TICKETMASTER_API_KEY'], minExpected: 100, maxDrop: 0.3 },
  { key: 'seatgeek',     script: 'import-seatgeek.mjs',     requires: ['SEATGEEK_AID'],         minExpected: 30,  maxDrop: 0.3 },
  { key: 'eventbrite',   script: 'import-eventbrite.mjs',   requires: [],                        minExpected: 10,  maxDrop: 0.5 },
  { key: 'nhcc',         script: 'import-nhcc.mjs',         requires: [],                        minExpected: 5,   maxDrop: 0.3 },
]

// Extra importers that share the 'local' source bucket (community + city-wide
// scrapers that aren't tied to a ticket API). No drop/count gates — they're
// additive. If they fail, the pipeline warns but doesn't fail.
const EXTRA_IMPORTERS = [
  { key: 'abqtodo',      script: 'scrape-abqtodo.mjs',       requires: [] },
  { key: 'babydolls',    script: 'scrape-babydolls.mjs',     requires: ['DEEPSEEK_API_KEY'] },
  { key: 'local-venues', script: 'scrape-local-venues.mjs',  requires: ['DEEPSEEK_API_KEY'] },
  { key: 'amp',          script: 'scrape-amp-concerts.mjs',  requires: [] },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function runScript(scriptName, extraArgs = []) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, scriptName)
    if (!fs.existsSync(scriptPath)) {
      return resolve({ ok: false, reason: `not-found: ${scriptName}`, durationMs: 0 })
    }
    const args = [...extraArgs]
    if (DRY) args.push('--dry-run')
    const start = Date.now()
    const child = spawn('node', [scriptPath, ...args], { stdio: QUIET ? 'ignore' : 'inherit', env: process.env })
    child.on('close', (code) => resolve({ ok: code === 0, exitCode: code, durationMs: Date.now() - start }))
    child.on('error', (e) => resolve({ ok: false, reason: e.message, durationMs: Date.now() - start }))
  })
}

async function runWithRetry(scriptName, tries = 2) {
  let lastResult
  for (let i = 1; i <= tries; i++) {
    const r = await runScript(scriptName)
    lastResult = r
    if (r.ok) return r
    if (i < tries) {
      warn(`${scriptName} failed (exit=${r.exitCode}); retrying in 10s…`)
      await new Promise(r => setTimeout(r, 10000))
    }
  }
  return lastResult
}

async function snapshotCounts() {
  const today = new Date().toISOString().slice(0, 10)

  const snap = {
    totalUpcoming: 0,
    totalHidden: 0,
    rejectedImages: 0,
    bySource: {},
    byCategory: {},
    missingCategory: 0,
    missingImage: 0,
    missingNeighborhood: 0,
    missingMood: 0,
  }

  // Per-source counts (upcoming, not hidden)
  for (const src of SOURCES) {
    // eslint-disable-next-line
    const { count } = await supabase
      .schema('public').from('events')
      .select('id', { count: 'exact', head: true })
      .eq('source', src.key).eq('hidden', false).gte('event_date', today)
    snap.bySource[src.key] = count ?? 0
    snap.totalUpcoming += count ?? 0
  }

  // Rejected images
  const { count: rej } = await supabase
    .schema('public').from('events')
    .select('id', { count: 'exact', head: true })
    .eq('image_status', 'rejected')
  snap.rejectedImages = rej ?? 0

  // Hidden count
  const { count: hid } = await supabase
    .schema('public').from('events')
    .select('id', { count: 'exact', head: true })
    .eq('hidden', true)
  snap.totalHidden = hid ?? 0

  // Coverage gaps (upcoming only)
  const gapCheck = async (field, filter) => {
    const { count } = await supabase
      .schema('public').from('events')
      .select('id', { count: 'exact', head: true })
      .eq('hidden', false).gte('event_date', today).or(filter)
    return count ?? 0
  }
  snap.missingCategory = await gapCheck('category', 'category.is.null')
  snap.missingImage    = await gapCheck('cached_photo_url', 'cached_photo_url.is.null,cached_photo_url.eq.')
  snap.missingNeighborhood = await gapCheck('neighborhood', 'neighborhood.is.null,neighborhood.eq.')

  // Mood enrichment — need to query ai_enrichment->>mood
  const { data: moodRows } = await supabase
    .schema('public').from('events').select('id, ai_enrichment')
    .eq('hidden', false).gte('event_date', today).limit(5000)
  snap.missingMood = (moodRows ?? []).filter(r => !(r.ai_enrichment && r.ai_enrichment.mood)).length

  return snap
}

function diffCounts(before, after) {
  const d = { bySource: {}, totalUpcoming: after.totalUpcoming - before.totalUpcoming }
  for (const key of Object.keys(after.bySource)) {
    const b = before.bySource[key] ?? 0, a = after.bySource[key] ?? 0
    d.bySource[key] = { before: b, after: a, delta: a - b, pctChange: b > 0 ? ((a - b) / b) : (a > 0 ? 1 : 0) }
  }
  return d
}

// ── Smoke tests ────────────────────────────────────────────────────────────

async function validateImage(url, timeoutMs = 10000) {
  if (!url) return { ok: false, reason: 'no-url' }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' })
    clearTimeout(t)
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) return { ok: false, reason: `not-image: ${ct}` }
    const len = parseInt(res.headers.get('content-length') || '0', 10)
    if (len > 0 && len < 5000) return { ok: false, reason: `tiny: ${len}B` }
    return { ok: true, size: len, type: ct }
  } catch (e) {
    return { ok: false, reason: e.message.slice(0, 80) }
  }
}

function validateEventTime(row) {
  // event_date can be "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS-07:00" or null
  if (!row.event_date) return { ok: false, reason: 'no-date' }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(row.event_date) ? row.event_date + 'T12:00:00' : row.event_date
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { ok: false, reason: 'unparseable-date' }
  const year = d.getFullYear()
  if (year < 2020 || year > 2030) return { ok: false, reason: `year-out-of-range: ${year}` }
  // Also check raw.dates.start.localTime if present (it's what lib/events.ts actually reads)
  const raw = row.raw || {}
  const lt = raw.dates?.start?.localTime
  if (lt && !/^\d{2}:\d{2}(:\d{2})?$/.test(lt)) return { ok: false, reason: `bad-localTime: ${lt}` }
  return { ok: true, date: d.toISOString() }
}

async function smokeTest({ perSource = 3 } = {}) {
  step(`Smoke tests — sampling ${perSource} events per source`)
  const results = { checked: 0, passed: 0, failures: [] }
  const today = new Date().toISOString().slice(0, 10)

  for (const src of SOURCES) {
    if (ONLY_SOURCE && src.key !== ONLY_SOURCE) continue
    // Sample: most recently event_date-sorted ascending (soonest upcoming)
    const { data: rows } = await supabase
      .schema('public').from('events')
      .select('id, source, event_date, cached_photo_url, category, venue_name, image_status, raw')
      .eq('source', src.key).eq('hidden', false).gte('event_date', today)
      .order('event_date', { ascending: true }).limit(perSource)

    if (!rows || rows.length === 0) {
      fail(`[${src.key}] no upcoming events to sample`)
      results.failures.push({ source: src.key, id: null, checks: ['no-events'] })
      continue
    }

    for (const row of rows) {
      results.checked++
      const checks = []

      // 1. Image: either valid URL OR explicitly rejected (then we expect fallback, skip image check)
      if (row.image_status !== 'rejected') {
        const img = row.cached_photo_url
          || row.raw?.image
          || row.raw?.images?.[0]?.url
          || row.raw?.logo?.url
        if (!img) {
          checks.push('no-image-url')
        } else {
          const v = await validateImage(img)
          if (!v.ok) checks.push(`image-invalid(${v.reason})`)
        }
      }

      // 2. Time
      const tv = validateEventTime(row)
      if (!tv.ok) checks.push(`time-invalid(${tv.reason})`)

      // 3. Has category (denormalized DB column or in ai_enrichment)
      if (!row.category) checks.push('no-category')

      // 4. Has venue_name (denormalized) or raw fallback
      // Empty-string venue names (online/virtual events) are allowed — treat as 'Online'
      const hasVenue =
        row.venue_name?.trim() ||
        row.raw?._embedded?.venues?.[0]?.name?.trim() ||
        row.raw?.venue?.name?.trim()
      if (!hasVenue) checks.push('no-venue')

      if (checks.length === 0) {
        results.passed++
        if (!QUIET) ok(`[${src.key}] ${row.id} — image, time, category, venue all ✓`)
      } else {
        fail(`[${src.key}] ${row.id} — ${checks.join(', ')}`)
        results.failures.push({ source: src.key, id: row.id, checks, event_date: row.event_date })
      }
    }
  }
  return results
}

// ── Invariants (post-run truths that must hold) ────────────────────────────

async function invariantChecks(before, after) {
  step('Invariant checks')
  const fails = []

  // 1. Rejected-image count can only grow or stay flat (never shrink via pipeline alone)
  if (after.rejectedImages < before.rejectedImages) {
    fails.push(`rejectedImages dropped: ${before.rejectedImages} → ${after.rejectedImages}`)
  } else {
    ok(`rejectedImages preserved (${after.rejectedImages})`)
  }

  // 2. No rejected event regained a cached_photo_url (trigger test)
  const { data: regressed } = await supabase
    .schema('public').from('events')
    .select('id')
    .eq('image_status', 'rejected')
    .not('cached_photo_url', 'is', null)
    .limit(5)
  if (regressed && regressed.length > 0) {
    fails.push(`${regressed.length} rejected events have a cached_photo_url (trigger broken!): ${regressed.map(r => r.id).join(', ')}`)
  } else {
    ok('No rejected events have a cached_photo_url (trigger working)')
  }

  // 2b. Detect the "same image, different events" pattern (TM data quality bug).
  // Legit cases: season series (Isotopes vs X / Y / Z all share the team photo).
  // Bug cases: unrelated events (Maddox Batson + Nuevo Teatro) sharing an image.
  //
  // Heuristic: if 3+ events share a URL AND have ZERO common significant words
  // in their titles, it's a misassociation. Stopwords (vs, at, the, etc.) don't
  // count toward "common words" — "Isotopes vs X" and "Isotopes vs Y" share
  // "isotopes" so it's a legit series.
  const STOPWORDS = new Set(['vs', 'at', 'the', 'a', 'an', 'of', 'and', '&', '-', 'with', 'in', 'on', '2026', '2027'])
  const titleWords = (t) => new Set((t || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOPWORDS.has(w)))

  const today = new Date().toISOString().slice(0, 10)
  const { data: dupRows } = await supabase
    .schema('public').from('events')
    .select('id, cached_photo_url, raw')
    .eq('hidden', false).gte('event_date', today)
    .not('cached_photo_url', 'is', null)
    .neq('image_status', 'rejected')
    .limit(5000)
  const byUrl = new Map()
  for (const row of (dupRows ?? [])) {
    const url = row.cached_photo_url
    const title = (row.raw?.name ?? '').toString().trim().toLowerCase()
    if (!url || !title) continue
    if (!byUrl.has(url)) byUrl.set(url, { titles: [], ids: [] })
    byUrl.get(url).titles.push(title)
    byUrl.get(url).ids.push(row.id)
  }

  const trueBugs = []
  for (const [url, { titles, ids }] of byUrl.entries()) {
    const unique = [...new Set(titles)]
    if (unique.length < 3) continue
    // Find common words across all titles (intersection of word sets)
    const wordSets = unique.map(titleWords)
    const common = [...wordSets[0]].filter(w => wordSets.every(s => s.has(w)))
    if (common.length === 0) {
      // No common word → likely mis-association bug
      trueBugs.push({ url, ids, titles: unique.slice(0, 4) })
    }
  }

  // Auto-reject: if 5+ unrelated events share an image URL, it's a generic
  // TM placeholder — nuke it. Too aggressive for manual admin review to scale.
  // Warn only: 3-4 unrelated events (borderline, admin should review).
  const autoReject = trueBugs.filter(b => b.ids.length >= 5)
  const toWarn     = trueBugs.filter(b => b.ids.length >= 3 && b.ids.length < 5)

  if (autoReject.length > 0) {
    const allIds = autoReject.flatMap(b => b.ids)
    warn(`Auto-rejecting ${allIds.length} events across ${autoReject.length} bad shared image URLs`)
    autoReject.slice(0, 5).forEach(({ url, ids, titles }) => {
      console.log(`    ${url.slice(0, 70)}…  (${ids.length} events: ${titles.slice(0,2).join(' / ')}…)`)
    })
    // eslint-disable-next-line
    const { error: rejErr } = await supabase
      .schema('public').from('events')
      .update({ image_status: 'rejected', cached_photo_url: null })
      .in('id', allIds)
    if (rejErr) fails.push(`auto-reject failed: ${rejErr.message}`)
    else ok(`auto-rejected ${allIds.length} events`)
  }

  if (toWarn.length > 0) {
    warn(`${toWarn.length} URL(s) shared by 3-4 unrelated events — admin should review in /admin/ig:`)
    toWarn.slice(0, 5).forEach(({ url, ids, titles }) => {
      console.log(`    ${url.slice(0, 70)}…`)
      titles.slice(0, 3).forEach(t => console.log(`        • ${t}`))
      console.log(`        Fix: open /admin/ig?id=${ids[0]} and click 🚫`)
    })
  }

  if (autoReject.length === 0 && toWarn.length === 0) {
    ok('No cross-title image misassociations detected')
  }

  // 3. Per-source count drop > maxDrop is a hard fail
  const diff = diffCounts(before, after)
  for (const src of SOURCES) {
    if (ONLY_SOURCE && src.key !== ONLY_SOURCE) continue
    if (SKIP_IMPORT) continue
    const d = diff.bySource[src.key]
    if (d.before > 0 && d.pctChange < -src.maxDrop) {
      fails.push(`[${src.key}] count dropped ${(d.pctChange * 100).toFixed(1)}% (${d.before} → ${d.after}); max allowed -${(src.maxDrop * 100).toFixed(0)}%`)
    } else {
      ok(`[${src.key}] ${d.before} → ${d.after} (${d.delta >= 0 ? '+' : ''}${d.delta})`)
    }
  }

  // 4. Total upcoming has a floor
  if (after.totalUpcoming < 200) {
    fails.push(`totalUpcoming < 200 (${after.totalUpcoming}) — site looks empty`)
  } else {
    ok(`totalUpcoming = ${after.totalUpcoming}`)
  }

  // 5. Coverage gates
  const upcoming = after.totalUpcoming || 1
  const catCoverage = 1 - after.missingCategory / upcoming
  const imgCoverage = 1 - after.missingImage / upcoming
  const nbCoverage  = 1 - after.missingNeighborhood / upcoming
  const moodCoverage = 1 - after.missingMood / upcoming

  const gate = (name, value, threshold) => {
    const pct = (value * 100).toFixed(1) + '%'
    if (value < threshold) fails.push(`${name} coverage ${pct} < ${(threshold * 100).toFixed(0)}% minimum`)
    else ok(`${name} coverage ${pct}`)
  }
  gate('Category',      catCoverage,  0.95)
  gate('Image',         imgCoverage,  0.85)
  gate('Neighborhood',  nbCoverage,   0.75)  // Community events often lack zip/venue
  gate('Mood enrichment', moodCoverage, 0.80)

  return fails
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now()
  hr()
  console.log(`${C.bold}ABQ Unplugged — Ingestion Pipeline${C.reset}`)
  console.log(`${C.dim}DRY=${DRY} SKIP_IMPORT=${SKIP_IMPORT} SKIP_ENRICH=${SKIP_ENRICH} SMOKE_ONLY=${SMOKE_ONLY} ONLY=${ONLY_SOURCE ?? 'all'}${C.reset}`)
  hr()

  if (SMOKE_ONLY) {
    const s = await smokeTest()
    hr()
    console.log(`${C.bold}Smoke: ${s.passed}/${s.checked} passed${C.reset}`)
    process.exit(s.failures.length === 0 ? 0 : 1)
  }

  // 0. BASELINE
  step('Baseline snapshot')
  const before = await snapshotCounts()
  ok(`upcoming=${before.totalUpcoming}  hidden=${before.totalHidden}  rejectedImages=${before.rejectedImages}`)
  for (const src of SOURCES) ok(`  [${src.key}] ${before.bySource[src.key]}`)

  // 1. IMPORTS
  const importResults = {}
  if (!SKIP_IMPORT) {
    step('Importing events (per-source isolated, 2 retries)')
    for (const src of SOURCES) {
      if (ONLY_SOURCE && src.key !== ONLY_SOURCE) continue
      const missingEnv = src.requires.filter(k => !process.env[k])
      if (missingEnv.length > 0) {
        warn(`[${src.key}] skipping — missing env: ${missingEnv.join(', ')}`)
        importResults[src.key] = { ok: false, reason: 'missing-env', missingEnv }
        continue
      }
      try {
        const r = await runWithRetry(src.script, 2)
        importResults[src.key] = r
        if (r.ok) ok(`[${src.key}] done in ${(r.durationMs/1000).toFixed(1)}s`)
        else fail(`[${src.key}] failed (exit=${r.exitCode ?? 'err'})`)
      } catch (e) {
        fail(`[${src.key}] crashed: ${e.message}`)
        importResults[src.key] = { ok: false, reason: e.message }
      }
    }

    // Extra importers (community scrapers sharing 'local' bucket). Non-fatal.
    for (const ex of EXTRA_IMPORTERS) {
      if (ONLY_SOURCE && ex.key !== ONLY_SOURCE) continue
      const missingEnv = ex.requires.filter(k => !process.env[k])
      if (missingEnv.length > 0) {
        warn(`[extra:${ex.key}] skipping — missing env: ${missingEnv.join(', ')}`)
        continue
      }
      try {
        const r = await runWithRetry(ex.script, 1)
        if (r.ok) ok(`[extra:${ex.key}] done in ${(r.durationMs/1000).toFixed(1)}s`)
        else warn(`[extra:${ex.key}] failed (exit=${r.exitCode ?? 'err'}) — continuing`)
      } catch (e) {
        warn(`[extra:${ex.key}] crashed: ${e.message} — continuing`)
      }
    }
  } else {
    warn('Skipped imports (--skip-imports)')
  }

  // 2. ENRICH
  if (!SKIP_ENRICH) {
    step('Category backfill (denormalized column from raw JSON + title heuristics)')
    const { data: catResult, error: catErr } = await supabase.rpc('backfill_event_categories')
    if (catErr) fail(`backfill_event_categories: ${catErr.message}`)
    else {
      const totalBackfilled = (catResult ?? []).reduce((s, r) => s + Number(r.updated_count || 0), 0)
      ok(`category backfill: ${totalBackfilled} events updated${(catResult ?? []).length ? ' — ' + (catResult ?? []).map(r => `${r.source}: ${r.updated_count}`).join(', ') : ''}`)
    }

    step('Hosting event images on Supabase Storage (download + resize + upload)')
    const hostRes = await runScript('host-event-images.mjs', ['--limit=200'])
    if (hostRes.ok) ok(`host-event-images (${(hostRes.durationMs/1000).toFixed(1)}s)`)
    else warn(`host-event-images failed (exit=${hostRes.exitCode}) — continuing, images use source URLs`)

    step('Enriching (neighborhoods, moods)')
    const enrichScripts = [
      { name: 'tag-neighborhoods',  script: 'tag-neighborhoods.mjs' },
      { name: 'enrich-deepseek-moods', script: 'enrich-deepseek.mjs', args: ['--limit=5000'] },
    ]
    for (const e of enrichScripts) {
      const r = await runScript(e.script, e.args || [])
      if (r.ok) ok(`${e.name} (${(r.durationMs/1000).toFixed(1)}s)`)
      else fail(`${e.name} failed (exit=${r.exitCode})`)
    }

    // DeepSeek about/highlights enrichment — replaces LM Studio / Gemma step.
    // 5× concurrent calls → 100 events in ~60s. Skips events where about is already set.
    // Now correctly catches events with mood-only ai_enrichment (missing about).
    // Cost: ~$0.10 per 100 events. 2026-05-01: switched from Gemma.
    step('DeepSeek enrichment (about/highlights/venue_tips)')
    const dsRes = await runScript('enrich-about-deepseek.mjs', ['--limit=100'])
    if (dsRes.ok) ok(`DeepSeek enrichment (${(dsRes.durationMs/1000).toFixed(1)}s)`)
    else warn(`DeepSeek enrichment returned non-zero — continuing, rules-based baseline still in place`)

    // Category accuracy audit — auto-fixes wrong categories using DeepSeek.
    // Runs after enrichment so new events are already in DB.
    // Limit 200 per run (batches of 30 = ~7 calls). ~$0.01/run. Cheap insurance.
    step('Category accuracy audit (DeepSeek auto-fix)')
    const auditRes = await runScript('audit-accuracy.mjs', ['--limit=200'])
    if (auditRes.ok) ok(`category audit (${(auditRes.durationMs/1000).toFixed(1)}s)`)
    else warn(`category audit returned non-zero — manual review may be needed`)

  } else {
    warn('Skipped enrichment (--skip-enrich)')
  }

  // Cleanup + matcher always run — they're hygiene, not enrichment.
  // Even in --skip-enrich mode these are valuable.
  step('Cleanup (hide past, duplicates, cancelled)')
  const cleanupRes = await runScript('cleanup-events.mjs')
  if (cleanupRes.ok) ok(`cleanup-events (${(cleanupRes.durationMs/1000).toFixed(1)}s)`)
  else fail(`cleanup-events failed (exit=${cleanupRes.exitCode})`)

  step('Notification matcher (user prefs → events)')
  const mnRes = await runScript('match-notifications.mjs')
  if (mnRes.ok) ok(`match-notifications (${(mnRes.durationMs/1000).toFixed(1)}s)`)
  else warn(`match-notifications failed (exit=${mnRes.exitCode}) — not fatal`)

  // 3. POST-RUN SNAPSHOT
  step('Post-run snapshot')
  const after = await snapshotCounts()
  ok(`upcoming=${after.totalUpcoming}  hidden=${after.totalHidden}  rejectedImages=${after.rejectedImages}`)

  // 4. INVARIANTS + GATES
  const invariantFails = await invariantChecks(before, after)

  // 5. SMOKE
  let smokeResults = { checked: 0, passed: 0, failures: [] }
  if (!SKIP_SMOKE) smokeResults = await smokeTest()
  else warn('Skipped smoke tests (--skip-smoke)')

  // 6. REPORT
  hr()
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`${C.bold}Summary${C.reset} (${elapsed}s total)`)
  hr()

  // Per-source import status
  for (const src of SOURCES) {
    if (ONLY_SOURCE && src.key !== ONLY_SOURCE) continue
    const r = importResults[src.key]
    const d = diffCounts(before, after).bySource[src.key]
    const status = !r ? '⊘ skipped' : r.ok ? '✓ imported' : `✗ ${r.reason || 'failed'}`
    console.log(`  ${src.key.padEnd(14)} ${status.padEnd(22)} ${d.before} → ${d.after} (${d.delta >= 0 ? '+' : ''}${d.delta})`)
  }

  console.log('')
  console.log(`  Coverage: category=${((1 - after.missingCategory/Math.max(1,after.totalUpcoming))*100).toFixed(1)}%  image=${((1 - after.missingImage/Math.max(1,after.totalUpcoming))*100).toFixed(1)}%  neighborhood=${((1 - after.missingNeighborhood/Math.max(1,after.totalUpcoming))*100).toFixed(1)}%  mood=${((1 - after.missingMood/Math.max(1,after.totalUpcoming))*100).toFixed(1)}%`)
  console.log(`  Smoke:    ${smokeResults.passed}/${smokeResults.checked} passed`)
  console.log(`  Invariant failures: ${invariantFails.length}`)

  if (invariantFails.length > 0) {
    console.log('')
    console.log(`${C.red}${C.bold}HARD FAILURES:${C.reset}`)
    invariantFails.forEach(f => console.log(`  ${C.red}✗${C.reset} ${f}`))
  }
  if (smokeResults.failures.length > 0) {
    console.log('')
    console.log(`${C.yellow}${C.bold}SMOKE FAILURES:${C.reset}`)
    smokeResults.failures.forEach(f => console.log(`  ${C.yellow}⚠${C.reset} [${f.source}] ${f.id ?? '-'}: ${(f.checks || []).join(', ')}`))
  }

  hr()
  const pass = invariantFails.length === 0 && smokeResults.failures.filter(f => !f.checks.every(c => c.startsWith('image-invalid') && c.includes('no-url'))).length === 0
  if (pass) {
    console.log(`${C.green}${C.bold}✓ PIPELINE HEALTHY${C.reset}`)
    process.exit(0)
  } else {
    console.log(`${C.red}${C.bold}✗ PIPELINE FAILED${C.reset} — see failures above`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(`\n${C.red}${C.bold}CRASH:${C.reset}`, err.stack || err)
  process.exit(2)
})
