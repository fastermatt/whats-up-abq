#!/usr/bin/env node
/**
 * browser-audit.mjs
 *
 * Uses a real headless Chromium browser + Gemma (LM Studio) to audit every
 * upcoming event's external URL for:
 *   - Cancellations / removed listings (hidden automatically)
 *   - Name / venue mismatches vs our DB
 *   - Wrong category
 *   - Any other red flags Gemma spots
 *
 * Why a real browser? Ticketmaster and SeatGeek block curl/fetch with 401/403.
 * Playwright renders JS and sends real browser fingerprints, so they respond
 * with actual page content.
 *
 * Usage:
 *   npx playwright install chromium --with-deps   # once
 *   node scripts/browser-audit.mjs                # all sources
 *   node scripts/browser-audit.mjs --source=ticketmaster
 *   node scripts/browser-audit.mjs --source=seatgeek
 *   node scripts/browser-audit.mjs --dry-run      # report only, no DB writes
 *   node scripts/browser-audit.mjs --limit=50     # spot-check
 *   node scripts/browser-audit.mjs --our-pages    # audit abqunplugged.com/events/[id] instead
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Env ───────────────────────────────────────────────────────────────────────
for (const f of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env.local')]) {
  if (fs.existsSync(f)) {
    fs.readFileSync(f, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
      if (m) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
    })
  }
}

// ── Args ──────────────────────────────────────────────────────────────────────
const DRY_RUN   = process.argv.includes('--dry-run')
const OUR_PAGES = process.argv.includes('--our-pages')
const SRC       = (process.argv.find(a => a.startsWith('--source=')) || '').replace('--source=', '') || null
const LIMIT     = parseInt((process.argv.find(a => a.startsWith('--limit=')) || '').replace('--limit=', '') || '0') || 0

const CONCURRENCY  = 3   // browser tabs open at once
const PAGE_TIMEOUT = 20_000
// Use whichever model LM Studio has loaded — first one returned from /v1/models
async function getActiveModel() {
  try {
    const r = await fetch('http://localhost:1234/v1/models')
    const j = await r.json()
    const id = j?.data?.[0]?.id
    if (id) { console.log(`LM Studio model: ${id}`); return id }
  } catch {}
  return 'gemma-4-e4b-uncensored-hauhaucs-aggressive'
}
const GEMMA_MODEL  = await getActiveModel()
const GEMMA_URL    = 'http://localhost:1234/v1/chat/completions'
const SITE         = 'https://abqunplugged.com'

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ── Load events ───────────────────────────────────────────────────────────────
async function loadEvents() {
  let q = supabase
    .schema('public')
    .from('events')
    .select('id, source, event_date, category, venue_name, raw')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true })
    .range(0, 9999)

  if (SRC) q = q.eq('source', SRC)

  const { data, error } = await q
  if (error) throw error

  return data.filter(e => {
    const url = OUR_PAGES ? `${SITE}/events/${e.id}` : e.raw?.url
    return !!url
  })
}

// ── Page extraction ───────────────────────────────────────────────────────────
async function extractPage(page, url) {
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT })
    const status = res?.status() ?? 0

    // Short wait for any dynamic content
    await page.waitForTimeout(1500)

    const content = await page.evaluate(() => {
      // Remove scripts/styles/nav/footer for cleaner signal
      const unwanted = document.querySelectorAll('script,style,nav,footer,header,[aria-hidden="true"]')
      unwanted.forEach(el => el.remove())

      const title  = document.title?.slice(0, 200) ?? ''
      const h1s    = [...document.querySelectorAll('h1')].map(el => el.innerText?.trim()).filter(Boolean).slice(0, 3)
      const h2s    = [...document.querySelectorAll('h2')].map(el => el.innerText?.trim()).filter(Boolean).slice(0, 4)
      // Grab visible body text (first 2000 chars)
      const body   = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000)

      return { title, h1s, h2s, body }
    })

    return { status, url, ...content, error: null }
  } catch (err) {
    return { status: 0, url, title: '', h1s: [], h2s: [], body: '', error: err.message?.slice(0, 120) }
  }
}

// ── Gemma analysis ────────────────────────────────────────────────────────────
async function askGemma(event, pageData) {
  const dbName    = event.raw?.name ?? event.raw?.title ?? event.raw?.['short_title'] ?? '(unknown)'
  const dbVenue   = event.venue_name ?? event.raw?.venue?.name ?? event.raw?._embedded?.venues?.[0]?.name ?? ''
  const dbDate    = event.event_date
  const dbCat     = event.category ?? ''
  const urlType   = OUR_PAGES ? 'ABQ Unplugged event page' : 'external ticket/event page'

  const prompt = `You are auditing an event listing for abqunplugged.com.

OUR DATABASE RECORD:
- Name: ${dbName}
- Venue: ${dbVenue}
- Date: ${dbDate}
- Category: ${dbCat}
- Source: ${event.source}

${urlType.toUpperCase()} CONTENT (HTTP ${pageData.status}):
Title: ${pageData.title}
H1: ${pageData.h1s.join(' | ')}
H2: ${pageData.h2s.join(' | ')}
Body excerpt:
${pageData.body}

Analyze this and return ONLY valid JSON (no markdown, no explanation):
{
  "event_exists": true/false,
  "is_cancelled": true/false,
  "name_matches": true/false/null,
  "venue_matches": true/false/null,
  "category_correct": true/false/null,
  "issues": ["list","of","specific","problems"],
  "confidence": "high"/"medium"/"low",
  "verdict": "ok" / "hide" / "review"
}

Rules:
- "event_exists": false if 404, "event not found", "page doesn't exist", or the page is generic/unrelated
- "is_cancelled": true if you see "cancelled", "postponed", "no longer available", "this event has ended" etc.
- verdict "hide": only if clearly cancelled, removed, or 404
- verdict "review": if something seems off but you're not certain
- verdict "ok": event appears real and matches our data reasonably well
- If HTTP status is 404, set event_exists=false, verdict=hide regardless of content`

  try {
    const res = await fetch(GEMMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    })
    const raw = await res.text()
    let text = ''
    try {
      const json = JSON.parse(raw)
      text = json.choices?.[0]?.message?.content?.trim() ?? ''
    } catch {
      // LM Studio returned HTML error page or malformed JSON
      return { verdict: 'review', issues: [`LM Studio error (HTTP ${res.status})`], confidence: 'low' }
    }
    if (!text) return { verdict: 'review', issues: ['gemma returned empty response'], confidence: 'low' }
    // Strip thinking tokens (<think>...</think>) from reasoning models
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return { verdict: 'review', issues: [`gemma non-JSON: ${text.slice(0, 80)}`], confidence: 'low' }
    return JSON.parse(match[0])
  } catch (err) {
    return { verdict: 'review', issues: [`gemma error: ${err.message?.slice(0, 60)}`], confidence: 'low' }
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

// ── Short-circuit decisions before calling Gemma ──────────────────────────────
function quickVerdict(pageData) {
  const { status, body, title } = pageData
  const text = (title + ' ' + body).toLowerCase()

  if (status === 404) return { verdict: 'hide', issues: ['HTTP 404 — page not found'], confidence: 'high' }

  // Common cancellation phrases
  const cancelPhrases = [
    'event cancelled', 'event has been cancelled', 'no longer available',
    'this event has ended', 'event not found', 'page not found',
    'postponed', 'event is no longer', 'sold out and cancelled',
  ]
  for (const phrase of cancelPhrases) {
    if (text.includes(phrase)) {
      return { verdict: 'hide', issues: [`Cancellation detected: "${phrase}"`], confidence: 'high' }
    }
  }

  if (status === 401 || status === 403) {
    return { verdict: 'blocked', issues: [`HTTP ${status} — bot-blocked, cannot verify`], confidence: 'low' }
  }

  if (status === 0 || pageData.error) {
    return { verdict: 'review', issues: [`Load error: ${pageData.error ?? 'unknown'}`], confidence: 'low' }
  }

  return null // needs Gemma
}

// ── Main ──────────────────────────────────────────────────────────────────────
const allEvents = await loadEvents()
const events = LIMIT ? allEvents.slice(0, LIMIT) : allEvents

console.log(`\n🔍 Browser audit: ${events.length} events${SRC ? ` (${SRC})` : ''}${OUR_PAGES ? ' [our pages]' : ' [external URLs]'}${DRY_RUN ? ' [DRY RUN]' : ''}\n`)
console.log('Launching Playwright browser…')

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security',
  ],
})

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'en-US',
  viewport: { width: 1280, height: 800 },
})

// Stealth: hide webdriver flag
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
})

const toHide   = []
const toReview = []
const issues   = []
let checked    = 0

await pool(events, async (event) => {
  const url = OUR_PAGES ? `${SITE}/events/${event.id}` : event.raw?.url
  if (!url) return

  const page = await context.newPage()
  let result
  try {
    const pageData = await extractPage(page, url)

    // Fast-path: 404, cancellation phrases, bot-blocking — no Gemma call needed
    const quick = quickVerdict(pageData)
    if (quick?.verdict === 'blocked') {
      checked++
      process.stdout.write(`[${checked}/${events.length}] 🤖 ${String(event.raw?.name ?? event.id).slice(0,50).padEnd(52)} ${pageData.status} bot-blocked\n`)
      await page.close()
      return
    }

    const analysis = quick ?? await askGemma(event, pageData)

    checked++
    const name = (event.raw?.name ?? event.raw?.title ?? event.id).slice(0, 50)
    const icon =
      analysis.verdict === 'ok'     ? '✅' :
      analysis.verdict === 'hide'   ? '💀' :
      analysis.verdict === 'review' ? '⚠️ ' : '❓'

    console.log(`[${checked}/${events.length}] ${icon} ${name.padEnd(52)} ${pageData.status} ${analysis.confidence ?? ''}`)
    if (analysis.issues?.length) {
      analysis.issues.forEach(iss => console.log(`        ↳ ${iss}`))
    }

    result = { event, url, pageData, analysis }

    if (analysis.verdict === 'hide') toHide.push({ event, url, analysis })
    if (analysis.verdict === 'review') toReview.push({ event, url, analysis })
    if (analysis.issues?.length) issues.push({ event, url, analysis })
  } finally {
    await page.close()
  }
  return result
}, CONCURRENCY)

await browser.close()

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(70))
console.log(`RESULTS: ${checked} checked | ${toHide.length} to hide | ${toReview.length} need review`)
console.log('═'.repeat(70))

if (toHide.length) {
  console.log('\n💀 HIDING (cancelled/removed/404):')
  toHide.forEach(({ event, analysis }) => {
    console.log(`  ${event.id.padEnd(50)} ${(analysis.issues ?? []).join('; ')}`)
  })
}

if (toReview.length) {
  console.log('\n⚠️  NEEDS REVIEW:')
  toReview.forEach(({ event, url, analysis }) => {
    console.log(`  ${event.id}`)
    console.log(`    URL: ${url}`)
    ;(analysis.issues ?? []).forEach(iss => console.log(`    • ${iss}`))
  })
}

// ── Auto-hide ─────────────────────────────────────────────────────────────────
if (toHide.length && !DRY_RUN) {
  const hiddenAt = new Date().toISOString()
  for (const { event, analysis } of toHide) {
    const { data: row } = await supabase.schema('public').from('events').select('ai_enrichment').eq('id', event.id).single()
    const merged = {
      ...(row?.ai_enrichment ?? {}),
      hide_reason: 'browser_audit',
      hidden_at: hiddenAt,
      browser_audit_issues: analysis?.issues ?? [],
    }
    const { error } = await supabase.schema('public').from('events').update({ hidden: true, ai_enrichment: merged }).eq('id', event.id)
    if (error) console.error(`  ✗ ${event.id}: ${error.message}`)
    else console.log(`  ✅ ${event.id}`)
  }
  console.log(`\nHid ${toHide.length} events in DB.`)
} else if (toHide.length && DRY_RUN) {
  console.log(`\n[DRY RUN] Would hide ${toHide.length} events.`)
}

// ── Write report ──────────────────────────────────────────────────────────────
const tag = [SRC ?? 'all', OUR_PAGES ? 'our-pages' : 'external'].join('-')
const reportPath = path.join(__dirname, `browser-audit-${tag}-${new Date().toISOString().slice(0, 10)}.csv`)
const allResultRows = [...toHide, ...toReview, ...issues].map(({ event, url, analysis }) =>
  [event.id, event.source, event.event_date, analysis.verdict, analysis.confidence,
   `"${(analysis.issues ?? []).join('; ')}"`, url].join(',')
)
const uniqueRows = [...new Set(allResultRows)]
fs.writeFileSync(reportPath, ['id,source,date,verdict,confidence,issues,url', ...uniqueRows].join('\n'))
console.log(`\nReport: ${reportPath}`)
