#!/usr/bin/env node
/**
 * Event verification pipeline.
 *
 * For each visible event:
 *   1. Pull a source-specific "canonical" record out of raw JSON + URL.
 *   2. Fetch the source page (best-effort HTTP GET).
 *   3. Strip to clean text (cheerio).
 *   4. Ask local LM Studio (Gemma/Qwen/etc) to compare our DB record to the
 *      page contents and output a structured verdict.
 *   5. Write result into ai_enrichment.verification.
 *   6. Auto-hide events marked "wrong" with confidence >= 0.9.
 *
 * Usage:
 *   node scripts/verify-events.mjs                       # verify all unseen events
 *   node scripts/verify-events.mjs --limit=50            # cap batch
 *   node scripts/verify-events.mjs --source=eventbrite   # only one source
 *   node scripts/verify-events.mjs --force               # re-verify already verified
 *   node scripts/verify-events.mjs --dry-run             # no DB writes
 *   LM_MODEL=openai/gpt-oss-20b node scripts/verify-events.mjs
 */
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load .env (only for keys not already set on the process — CLI wins) ──────
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '..', 'scripts', '.env'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) {
        const k = m[1].trim()
        if (process.env[k] === undefined) process.env[k] = m[2].trim()
      }
    })
    break
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const LM_URL       = process.env.LM_URL   || 'http://localhost:1234/v1/chat/completions'
const LM_MODEL     = process.env.LM_MODEL || 'openai/gpt-oss-20b'

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Args ──────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const isDryRun  = !!args['dry-run']
const force     = !!args.force
const limit     = parseInt(args.limit || '0', 10) || 0
const onlySource = args.source || null
const AUTO_HIDE_CONFIDENCE = parseFloat(args['hide-threshold'] || '0.9')

// ── Rule-based pre-filter ─────────────────────────────────────────────────────
// Some patterns are so clearly spam we can flag them before spending LLM tokens.

const SPAM_VENUE_PATTERNS = [
  /\binfo@/i,
  /\bfor\s+venue\s+details\b/i,
  /\bcontact\s+us\b/i,
  /\bto\s+be\s+announced\b/i,
]

const SPAM_TITLE_PATTERNS = [
  /\b1[\s-]?day\s+workshop\b/i,
  /\b(rio rancho|santa fe|albuquerque),?\s*n\.?m\.?\s*$/i,  // spam workshops with city in title
]

function ruleBasedCheck(rec) {
  const issues = []

  // Generic "workshop" spam — run by training-pipeline spam farms on Eventbrite
  const titleSpam = SPAM_TITLE_PATTERNS.some(p => p.test(rec.title || ''))
  const venueSpam = SPAM_VENUE_PATTERNS.some(p => p.test(rec.venue || ''))
  if (titleSpam && venueSpam) issues.push('spam_workshop')
  else if (venueSpam && (rec.title || '').match(/\bworkshop\b/i)) issues.push('spam_workshop')

  // Venue not set at all
  if (!rec.venue) issues.push('no_venue')

  // URL host doesn't match source (e.g. TM event with holdmyticket.com URL)
  if (rec.url) {
    try {
      const host = new URL(rec.url).hostname.toLowerCase()
      if (rec.source === 'ticketmaster' && !host.includes('ticketmaster')) issues.push('tm_non_tm_url')
      if (rec.source === 'seatgeek'     && !host.includes('seatgeek'))      issues.push('sg_non_sg_url')
      if (rec.source === 'eventbrite'   && !host.includes('eventbrite'))    issues.push('eb_non_eb_url')
    } catch { /* bad URL */ }
  }

  return issues
}

// ── Event → canonical record + URL ────────────────────────────────────────────

function canonical(row) {
  const r = row.raw || {}
  const source = row.source
  let url = null
  let title = null
  let localTime = null

  switch (source) {
    case 'ticketmaster': {
      url = r.url || null
      title = r.name || null
      localTime = r.dates?.start?.localTime || null
      break
    }
    case 'seatgeek': {
      url = r.url || null
      title = r.name || null
      localTime = r.dates?.start?.localTime || null
      break
    }
    case 'eventbrite': {
      url = r.url || null
      title = typeof r.name === 'object' ? r.name?.text : r.name
      localTime = r.start?.local ? r.start.local.slice(11, 16) : null
      break
    }
    case 'local':
    case 'volunteer':
    case 'nhcc': {
      url = r.url || r.ticket_url || null
      title = r.title || r.name || null
      localTime = r.time || null
      break
    }
    default:
      url = r.url || null
      title = r.name || r.title || null
  }

  return {
    id: row.id,
    source,
    title,
    venue: row.venue_name,
    event_date: row.event_date, // YYYY-MM-DD
    local_time: localTime,      // HH:MM[:SS] or null
    url,
  }
}

// ── Fetch source page ─────────────────────────────────────────────────────────

async function fetchPage(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Most ticketing sites (SeatGeek, Eventbrite, TM) return 403 for anything that
        // isn't a recognizable browser UA. We're not evading rate limits — just getting
        // the public page our users would see — so pose as Chrome.
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
      },
      redirect: 'follow',
    })
    if (!res.ok) {
      return { ok: false, status: res.status, text: null }
    }
    const html = await res.text()
    return { ok: true, status: res.status, html }
  } catch (err) {
    return { ok: false, error: err.message }
  } finally {
    clearTimeout(timeout)
  }
}

function htmlToText(html) {
  try {
    const $ = cheerio.load(html)
    // Rip out noise
    $('script, style, noscript, svg, iframe, header nav, footer, .cookie, .newsletter').remove()

    // Try to pull structured JSON-LD first — most ticketing sites embed Event schema.
    const ldjson = []
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).contents().text())
        ldjson.push(parsed)
      } catch { /* skip */ }
    })

    // Extract description-worthy blocks
    const meta = {
      title: $('meta[property="og:title"]').attr('content') || $('title').text() || '',
      description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '',
    }

    // Strip tags for the body fallback
    const body = $('body').text().replace(/\s+/g, ' ').trim()

    return { ldjson, meta, body: body.slice(0, 5000) }
  } catch {
    return { ldjson: [], meta: {}, body: '' }
  }
}

// ── LM Studio call ────────────────────────────────────────────────────────────

async function verify(canonicalRec, pageText) {
  const system = `You are an event-data fact-checker. You will be shown (a) a record from our database about an event and (b) text extracted from the event's source page on the web. Return a single JSON object — no markdown fences, no prose, no explanations outside the JSON.

DECISION RULES — follow these precisely. Err on the side of "uncertain" rather than "wrong".

status = "wrong" ONLY when ALL of the following are true:
  • The source page CLEARLY shows the SAME event (same title / headliner / performer).
  • AND the source page EXPLICITLY states a date or time that DIRECTLY CONTRADICTS the DB record.
  • "Directly contradicts" means different calendar day, or start time different by ≥ 30 minutes.
  • Alternatively: the source page explicitly says the event is cancelled, postponed, or sold out / no longer listed.
  • Alternatively: the source page is a generic spam workshop listing (issue="spam").

status = "verified" when the source page clearly shows the same event AND the dates/times match (or the source page doesn't state a time).

status = "uncertain" when ANY of these apply:
  • The source page text is empty, minimal, behind a login, JS-only, or didn't render.
  • The DB record has a null/missing start time but the source page has a time.
    (Missing DB data is NOT "wrong" — it's "uncertain". Never set status="wrong" just because the DB is INCOMPLETE.)
  • The source page shows the event but DOES NOT state the date or year explicitly.
  • You can't find the event on the source page at all.
  • Ambiguous: recurring event with multiple dates listed, and you can't tell which one matches.

Extra notes:
  • The DB record's event_date is the authoritative calendar day we are displaying. Only override it if the source page shows a different explicit date.
  • Eventbrite workshops with generic titles like "PMP Certification Training in Albuquerque, NM" or venues like "info@...com" are spam (status="wrong", issue="spam").
  • A source page that only confirms the venue and title but doesn't show a date is "uncertain", not "verified" and not "wrong".

Output shape (strict JSON only, no prose, no fences):
{
  "status": "verified" | "wrong" | "uncertain",
  "confidence": 0.0 to 1.0,
  "issues": ["date_mismatch" | "time_mismatch" | "cancelled" | "spam" | "not_local" | "missing_on_source" | "minimal_content"],
  "corrections": { "title"?: string, "venue"?: string, "date"?: "YYYY-MM-DD", "local_time"?: "HH:MM" },
  "notes": "short human-readable summary under 120 chars"
}`

  const user = `DB record:
${JSON.stringify(canonicalRec, null, 2)}

Source page (JSON-LD + meta + body excerpt):
${JSON.stringify(pageText, null, 2).slice(0, 8000)}`

  const resp = await fetch(LM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LM_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'event_verification',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              status: { type: 'string', enum: ['verified', 'wrong', 'uncertain'] },
              confidence: { type: 'number' },
              issues: { type: 'array', items: { type: 'string' } },
              corrections: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: 'string' },
                  venue: { type: 'string' },
                  date: { type: 'string' },
                  local_time: { type: 'string' },
                },
              },
              notes: { type: 'string' },
            },
            required: ['status', 'confidence', 'issues', 'notes'],
          },
        },
      },
    }),
  })

  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`LM Studio HTTP ${resp.status}: ${t.slice(0, 200)}`)
  }
  const j = await resp.json()
  const content = j.choices?.[0]?.message?.content || ''
  // Strip code fences if the model added them anyway
  const cleaned = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return { status: 'uncertain', confidence: 0, issues: ['lm_parse_fail'], notes: content.slice(0, 120) }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 ABQ Unplugged — event verification via LM Studio')
  console.log(`  LM model: ${LM_MODEL}`)
  console.log(`  Auto-hide threshold: confidence >= ${AUTO_HIDE_CONFIDENCE}`)
  if (isDryRun) console.log('  🔍 DRY RUN — no DB writes')
  console.log('')

  // Pull candidate events
  let q = supabase
    .schema('public')
    .from('events')
    .select('id, source, event_date, venue_name, raw, ai_enrichment')
    .eq('hidden', false)
    .order('event_date', { ascending: true })

  if (onlySource) q = q.eq('source', onlySource)
  if (limit) q = q.limit(limit * 3) // overfetch since we skip already-verified

  const { data: rows, error } = await q
  if (error) { console.error('❌ Fetch error:', error.message); process.exit(1) }

  // Filter to ones that still need verification.
  // TM + SG "raw" payloads come from the provider's own API — that IS the source of
  // truth, and their public pages return 401/403 for anything that isn't a logged-in
  // browser anyway. abqtodo ("local") uses a captcha / JS redirect so a plain HTTP
  // fetch only sees the challenge page, not the event content. NHCC and volunteer
  // pages mostly render server-side and are safe to verify.
  // Cancelled TM events are handled in cleanup-events.mjs.
  const SKIP_SOURCES = new Set(['ticketmaster', 'seatgeek', 'local'])
  const toVerify = []
  for (const row of rows || []) {
    if (SKIP_SOURCES.has(row.source)) continue
    const v = row.ai_enrichment?.verification
    if (!force && v?.status && v?.verified_at) continue
    toVerify.push(row)
    if (limit && toVerify.length >= limit) break
  }

  console.log(`  ${toVerify.length} events to verify\n`)

  const stats = { verified: 0, wrong: 0, uncertain: 0, hidden: 0, fetch_fail: 0, errors: 0 }

  for (let i = 0; i < toVerify.length; i++) {
    const row = toVerify[i]
    const rec = canonical(row)
    const label = `[${i + 1}/${toVerify.length}] ${rec.source} ${row.id.slice(0, 40)}`

    // Rule-based pre-filter — catch obvious spam without spending LLM tokens
    const preIssues = ruleBasedCheck(rec)
    if (preIssues.includes('spam_workshop') || preIssues.includes('tm_non_tm_url')) {
      const verdict = {
        status: 'wrong',
        confidence: 0.97,
        issues: preIssues,
        notes: `rule-based: ${preIssues.join(', ')}`,
      }
      await writeVerdict(row, verdict, stats)
      console.log(`${label} ❌ rule-based (${preIssues.join(', ')}) — ${rec.title?.slice(0, 60) || ''}`)
      continue
    }

    if (!rec.url) {
      console.log(`${label} ⚠️  no URL — skipping`)
      continue
    }

    let pageText = null
    try {
      const page = await fetchPage(rec.url)
      if (!page.ok) {
        console.log(`${label} 🛑 fetch failed (${page.status || page.error})`)
        stats.fetch_fail++
        // A 404 on the source is strong signal — hide as "gone".
        if (page.status === 404) {
          await writeVerdict(row, {
            status: 'wrong',
            confidence: 0.95,
            issues: ['source_404'],
            notes: 'Source URL returned 404',
          }, stats)
        }
        continue
      }
      pageText = htmlToText(page.html)
    } catch (err) {
      console.log(`${label} 🛑 fetch exception: ${err.message}`)
      stats.fetch_fail++
      continue
    }

    let verdict
    try {
      verdict = await verify(rec, pageText)
    } catch (err) {
      console.log(`${label} 🛑 LM error: ${err.message}`)
      stats.errors++
      continue
    }

    await writeVerdict(row, verdict, stats)

    const emoji = verdict.status === 'verified' ? '✅' : verdict.status === 'wrong' ? '❌' : '❓'
    console.log(`${label} ${emoji} ${verdict.status} (${verdict.confidence ?? '?'}) — ${rec.title?.slice(0, 60) || ''}`)
    if (verdict.issues?.length) console.log(`          issues: ${verdict.issues.join(', ')}`)
    if (verdict.notes)           console.log(`          notes:  ${verdict.notes}`)
  }

  console.log('\n📊 Summary')
  console.log(`  Verified:    ${stats.verified}`)
  console.log(`  Wrong:       ${stats.wrong}  (auto-hidden: ${stats.hidden})`)
  console.log(`  Uncertain:   ${stats.uncertain}`)
  console.log(`  Fetch fails: ${stats.fetch_fail}`)
  console.log(`  LM errors:   ${stats.errors}`)
}

async function writeVerdict(row, verdict, stats) {
  if (verdict.status === 'verified') stats.verified++
  else if (verdict.status === 'wrong') stats.wrong++
  else stats.uncertain++

  if (isDryRun) return

  // Only auto-hide on "real event-was-wrong" signals. Never auto-hide for missing-data
  // or page-render issues — those need human review.
  const SAFE_AUTO_HIDE_ISSUES = new Set(['date_mismatch', 'time_mismatch', 'cancelled', 'spam', 'not_local'])
  const hasHideIssue = (verdict.issues || []).some(i => SAFE_AUTO_HIDE_ISSUES.has(i))
  const shouldHide =
    verdict.status === 'wrong'
    && (verdict.confidence ?? 0) >= AUTO_HIDE_CONFIDENCE
    && hasHideIssue
  if (shouldHide) stats.hidden++

  const merged = {
    ...(row.ai_enrichment || {}),
    verification: {
      ...verdict,
      verified_at: new Date().toISOString(),
      model: LM_MODEL,
    },
  }
  if (shouldHide) {
    merged.hide_reason = 'lm_verification_' + (verdict.issues?.[0] || 'wrong')
    merged.hidden_at = new Date().toISOString()
  }

  const update = { ai_enrichment: merged }
  if (shouldHide) update.hidden = true

  await supabase.schema('public').from('events').update(update).eq('id', row.id)
}

main().catch(err => { console.error('❌ Fatal:', err); process.exit(1) })
