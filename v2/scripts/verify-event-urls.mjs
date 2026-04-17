#!/usr/bin/env node
/**
 * verify-event-urls.mjs
 *
 * For every upcoming, visible event:
 *   1. Fetches the source URL (from raw JSON) in parallel batches
 *   2. Pulls the page title + OG description via native fetch
 *   3. Simple string match first (fast, no LLM) — covers ~80% of cases
 *   4. Sends ambiguous cases to LM Studio (Gemma) for a verdict
 *   5. Outputs a Markdown table + problems list
 *
 * Usage:
 *   node verify-event-urls.mjs               # all events
 *   node verify-event-urls.mjs --limit=50    # first 50
 *   node verify-event-urls.mjs --source=local
 *   node verify-event-urls.mjs --no-llm      # skip Gemma, string match only
 *
 * Output files (in scripts/):
 *   verify-report.md      — full table
 *   verify-problems.md    — only mismatches / errors
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env files
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LM_ENDPOINT  = process.env.LM_STUDIO_URL
  ? `${process.env.LM_STUDIO_URL}/v1/chat/completions`
  : 'http://localhost:1234/v1/chat/completions'
const LM_MODEL     = process.env.LM_MODEL || 'google/gemma-4-e4b'

const PARALLEL     = 12   // concurrent URL fetches
const FETCH_TIMEOUT = 10000 // 10s per URL

if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not set. Add to scripts/.env or v2/.env.local')
  process.exit(1)
}

// Parse args
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? 'true']
    })
)
const LIMIT  = args.limit  ? parseInt(args.limit) : 9999
const SOURCE = args.source || null
const NO_LLM = args['no-llm'] === 'true'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const today = new Date().toISOString().slice(0, 10)

// ── Extract title from raw JSONB ──────────────────────────────────────────────

function extractTitle(row) {
  const r = row.raw ?? {}
  return (r.name || r.title || r.short_title || r._embedded?.attractions?.[0]?.name || '').slice(0, 80)
}

function extractSourceUrl(row) {
  const r = row.raw ?? {}
  return r.url || r.links?.event?.href || r.vanity_url || r.link || r.source_url || null
}

// ── Fetch page metadata via native fetch (parallel-friendly) ──────────────────

async function fetchPageMeta(url) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    clearTimeout(timer)

    const html = await res.text()

    const titleMatch   = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
    const ogTitleMatch = html.match(/property=["']og:title["'][^>]*content=["']([^"']{1,200})["']/i)
                      || html.match(/content=["']([^"']{1,200})["'][^>]*property=["']og:title["']/i)
    const ogDescMatch  = html.match(/property=["']og:description["'][^>]*content=["']([^"']{1,300})["']/i)
                      || html.match(/content=["']([^"']{1,300})["'][^>]*property=["']og:description["']/i)

    return {
      pageTitle:   (ogTitleMatch?.[1] || titleMatch?.[1] || '').replace(/&#\d+;/g, '').replace(/&amp;/g, '&').trim().slice(0, 150),
      description: (ogDescMatch?.[1] || '').replace(/&#\d+;/g, '').replace(/&amp;/g, '&').trim().slice(0, 300),
      httpStatus:  res.status,
      error:       null,
    }
  } catch (e) {
    return { pageTitle: '', description: '', httpStatus: 0, error: String(e.message).slice(0, 60) }
  }
}

// ── Simple string-match verdict (fast, no LLM) ────────────────────────────────

// Known bot-protected domains (can't scrape, but that's expected — not a data problem)
const BOT_PROTECTED = ['seatgeek.com', 'ticketmaster.com', 'axs.com', 'livenation.com']
const BOT_PAGE_SIGNALS = ['403', 'forbidden', 'verify your identity', 'access denied', 'robot', 'captcha', 'cloudflare']

function simpleVerdict(eventTitle, pageTitle, description, httpStatus, url, error) {
  // Dead link
  if (httpStatus === 404) return { verdict: '❌ DEAD-LINK', note: '404 Not Found' }

  // Timeout
  if (error?.includes('abort') || error?.includes('timeout')) return { verdict: '⚠️ TIMEOUT', note: 'page timed out' }

  // Known bot-protected domains — can't scrape but that's expected
  if (BOT_PROTECTED.some(d => url?.includes(d))) {
    return { verdict: '🔒 SCRAPE-BLOCKED', note: 'bot-protected site — cannot verify without real browser' }
  }

  // Bot protection signal in page title
  const ptLow = pageTitle.toLowerCase()
  if (BOT_PAGE_SIGNALS.some(s => ptLow.includes(s))) {
    return { verdict: '🔒 SCRAPE-BLOCKED', note: `page returned: "${pageTitle.slice(0, 60)}"` }
  }

  // No title at all
  if (!pageTitle) {
    return { verdict: '❓ NO-CONTENT', note: error || 'page returned no title' }
  }

  // If pageTitle is just the domain/site name (too short to match)
  const et = eventTitle.toLowerCase()
  const pt = (pageTitle + ' ' + description).toLowerCase()

  // Extract significant words (3+ chars, not stopwords)
  const stopwords = new Set(['the','and','for','with','from','this','that','are','was','will','our','not','all','more','event'])
  const etWords = et.split(/\W+/).filter(w => w.length >= 3 && !stopwords.has(w))

  if (etWords.length === 0) return { verdict: '❓ UNKNOWN', note: 'event title too short to match' }
  if (pageTitle.length < 8) return { verdict: '❓ NO-CONTENT', note: 'page title too short' }

  const matched = etWords.filter(w => pt.includes(w))
  const ratio   = matched.length / etWords.length

  if (ratio >= 0.6) return { verdict: '✅ MATCH', note: `${matched.length}/${etWords.length} words match` }
  if (ratio >= 0.3) return { verdict: '🟡 PARTIAL', note: `only ${matched.length}/${etWords.length} words match` }
  return null // send to LLM for disambiguation
}

// ── LM Studio verdict for ambiguous cases ─────────────────────────────────────

async function gemmaVerify(eventTitle, pageTitle, description) {
  if (!pageTitle && !description) return { verdict: '❓ NO-CONTENT', note: '' }

  const prompt = `You are verifying event listings. Given an event title and the web page it links to, decide if they match.

Event title: "${eventTitle}"
Page title: "${pageTitle}"
Page description: "${description.slice(0, 200)}"

Reply with EXACTLY one of these words first, then a dash, then one short sentence:
MATCH — the page is clearly about this event
MISMATCH — the page is about something else
PARTIAL — related but not exactly right
UNKNOWN — can't tell

Example: MATCH — Page confirms the same event at the same venue.`

  try {
    const res = await fetch(LM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LM_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(20000),
    })
    const json = await res.json()
    const msg  = json.choices?.[0]?.message ?? {}
    const text = (msg.content || msg.reasoning_content || '').trim()
    const upper = text.toUpperCase()

    const label = upper.startsWith('MATCH')    ? 'MATCH' :
                  upper.startsWith('MISMATCH') ? 'MISMATCH' :
                  upper.startsWith('PARTIAL')  ? 'PARTIAL' : 'UNKNOWN'
    const emoji = label === 'MATCH' ? '✅' : label === 'MISMATCH' ? '❌' : label === 'PARTIAL' ? '🟡' : '❓'
    const note  = text.replace(/^(MATCH|MISMATCH|PARTIAL|UNKNOWN)\s*[—\-\n]\s*/i, '').slice(0, 120).replace(/\|/g, '∣')
    return { verdict: `${emoji} ${label}`, note }
  } catch {
    return { verdict: '⚠️ LM-ERROR', note: 'LM Studio timeout' }
  }
}

// ── Process one event ─────────────────────────────────────────────────────────

async function processEvent(row) {
  const eventTitle = extractTitle(row)
  const url = extractSourceUrl(row)

  if (!url) return { row, eventTitle, url: '', meta: { pageTitle: '', description: '', httpStatus: 0, error: 'no URL' }, verdict: '⚠️ NO-URL', note: '' }

  const meta = await fetchPageMeta(url)
  const simple = simpleVerdict(eventTitle, meta.pageTitle, meta.description, meta.httpStatus, url, meta.error)

  if (simple || NO_LLM) {
    return { row, eventTitle, url, meta, ...(simple ?? { verdict: '❓ UNKNOWN', note: 'string match inconclusive' }) }
  }

  // Ambiguous — ask Gemma
  const lm = await gemmaVerify(eventTitle, meta.pageTitle, meta.description)
  return { row, eventTitle, url, meta, ...lm }
}

// ── Main ──────────────────────────────────────────────────────────────────────

let query = supabase
  .schema('public')
  .from('events')
  .select('id, source, event_date, venue_name, raw')
  .eq('hidden', false)
  .gte('event_date', today)
  .order('event_date', { ascending: true })
  .limit(LIMIT)

if (SOURCE) query = query.eq('source', SOURCE)

const { data: events, error: dbError } = await query
if (dbError) { console.error('DB error:', dbError); process.exit(1) }

console.log(`\n🔍 Verifying ${events.length} events (parallel=${PARALLEL}, LLM=${!NO_LLM})...\n`)

const allResults = []
let done = 0
for (let i = 0; i < events.length; i += PARALLEL) {
  const chunk = events.slice(i, i + PARALLEL)
  const results = await Promise.all(chunk.map(processEvent))
  allResults.push(...results)
  done += results.length
  const pct = Math.round(done / events.length * 100)
  process.stdout.write(`\r  ${done}/${events.length} (${pct}%)  `)
}

console.log(`\n\n✅ Done. Building report...\n`)

// ── Build reports ─────────────────────────────────────────────────────────────

const tableRows = allResults.map(({ row, eventTitle, url, meta, verdict, note }) => {
  const name    = eventTitle.slice(0, 45).replace(/\|/g, '∣')
  const date    = row.event_date?.slice(0, 10) ?? ''
  const src     = row.source ?? ''
  const urlShort = url ? url.slice(0, 55) : '—'
  const pageT   = (meta.pageTitle || '—').slice(0, 50).replace(/\|/g, '∣')
  const noteStr = (note ?? '').slice(0, 70).replace(/\|/g, '∣')
  return `| ${name} | ${date} | ${src} | ${urlShort} | ${pageT} | ${verdict} | ${noteStr} |`
})

const header = `| Event | Date | Source | URL | Page Title | Verdict | Note |
|-------|------|--------|-----|-----------|---------|------|`

const counts = { '✅': 0, '❌': 0, '🟡': 0, '❓': 0, '⚠️': 0 }
for (const { verdict } of allResults) {
  const key = Object.keys(counts).find(k => verdict.includes(k)) ?? '⚠️'
  counts[key]++
}

const fullReport = `# ABQ Unplugged — Event URL Verification Report
Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })}
Events checked: ${allResults.length}

## Summary
- ✅ Match: ${counts['✅']}
- ❌ Mismatch: ${counts['❌']}
- 🟡 Partial: ${counts['🟡']}
- ❓ Unknown: ${counts['❓']}
- ⚠️ Error: ${counts['⚠️']}

${header}
${tableRows.join('\n')}
`

const problems = allResults.filter(r => !r.verdict.startsWith('✅'))
const problemRows = problems.map(({ row, eventTitle, url, meta, verdict, note }) => {
  const date = row.event_date?.slice(0, 10) ?? ''
  return [
    `### ${verdict} — ${eventTitle}`,
    `- **Date:** ${date}  |  **Source:** ${row.source ?? ''}`,
    `- **Event URL:** ${url || '—'}`,
    `- **Page found:** ${meta.pageTitle || '—'}`,
    `- **Note:** ${note || meta.error || '—'}`,
    '',
  ].join('\n')
})

const problemReport = `# ABQ Unplugged — URL Problems
Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })}
Events with issues: ${problems.length} / ${allResults.length}

---

${problemRows.join('\n')}
`

fs.writeFileSync(path.join(__dirname, 'verify-report.md'),   fullReport,   'utf8')
fs.writeFileSync(path.join(__dirname, 'verify-problems.md'), problemReport, 'utf8')

console.log('─'.repeat(50))
console.log(`✅ MATCH     : ${counts['✅']}`)
console.log(`❌ MISMATCH  : ${counts['❌']}`)
console.log(`🟡 PARTIAL   : ${counts['🟡']}`)
console.log(`❓ UNKNOWN   : ${counts['❓']}`)
console.log(`⚠️  ERROR/WARN: ${counts['⚠️']}`)
console.log('─'.repeat(50))
console.log(`📄 Full report  → scripts/verify-report.md`)
console.log(`🚨 Problems     → scripts/verify-problems.md`)
