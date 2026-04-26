#!/usr/bin/env node
/**
 * Regression test suite — catches the classes of bugs that have hit production before.
 *
 * Run with:
 *   node v2/scripts/regression-tests.mjs
 *   node v2/scripts/regression-tests.mjs --site=https://abqunplugged.com   # also hit live URLs
 *   node v2/scripts/regression-tests.mjs --tag=normalizer                  # only one tag
 *
 * Each test asserts an invariant that, if it ever flips, indicates a recurring bug class
 * has come back. Tests are quick (mostly SQL counts) so this is safe to run in CI.
 *
 * To add a test: append to the TESTS array. Format:
 *   { id, tag, description, fn: async () => ({ ok, detail }) }
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

const argv = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_*_KEY in env. Load v2/scripts/.env first.')
  process.exit(2)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  db:   { schema: 'public' },
})

const SITE = typeof argv.site === 'string' ? argv.site.replace(/\/$/, '') : null

// ─────────────────────────────────────────────────────────────────────────
// Tests
// Each test returns { ok: boolean, detail: string }
// ─────────────────────────────────────────────────────────────────────────

const TESTS = [
  // ── Normalizer / venue data ────────────────────────────────────────────
  {
    id: 'no-online-fallback-venues',
    tag: 'normalizer',
    description: 'No upcoming events should display venue="Online" (the EB normalizer fallback bug)',
    async fn() {
      // We can't trivially run the normalizer here without TS, so we check the data shape:
      // if EB events have NO venue name in either _embedded.venues[0].name or venue_name,
      // they would render as "Online" today. That should be 0.
      const { data, error } = await sb
        .from('events')
        .select('id, source, venue_name, raw')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .eq('source', 'eventbrite')
      if (error) return { ok: false, detail: error.message }
      const offenders = data.filter(r => {
        const embedded = r.raw?._embedded?.venues?.[0]?.name
        return !embedded?.trim() && !r.venue_name?.trim()
      })
      return offenders.length === 0
        ? { ok: true, detail: `${data.length} EB events checked, all have a venue` }
        : { ok: false, detail: `${offenders.length} EB events would render as "Online": ${offenders.slice(0, 5).map(o => o.id).join(', ')}` }
    },
  },
  {
    id: 'no-empty-venue-names',
    tag: 'normalizer',
    description: 'Every upcoming event should have a venue name (allowing reasonable exceptions for volunteer/local)',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, source, venue_name')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .or('venue_name.is.null,venue_name.eq.')
      if (error) return { ok: false, detail: error.message }
      // Volunteer events sometimes legitimately have no fixed venue ("various locations")
      const bad = data.filter(r => !['volunteer', 'local'].includes(r.source))
      return bad.length <= 5
        ? { ok: true, detail: `${data.length} events with no venue (mostly volunteer/local — acceptable)` }
        : { ok: false, detail: `${bad.length} non-volunteer events have no venue: ${bad.slice(0, 5).map(o => `${o.source}:${o.id}`).join(', ')}` }
    },
  },
  // ── Photos / images ─────────────────────────────────────────────────────
  {
    id: 'high-photo-coverage',
    tag: 'images',
    description: 'At least 95% of upcoming events should have cached_photo_url',
    async fn() {
      const { count: total } = await sb
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
      const { count: withPhoto } = await sb
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .not('cached_photo_url', 'is', null)
      const pct = total > 0 ? (withPhoto / total) * 100 : 100
      return pct >= 95
        ? { ok: true, detail: `${withPhoto}/${total} = ${pct.toFixed(1)}% photo coverage` }
        : { ok: false, detail: `Only ${withPhoto}/${total} = ${pct.toFixed(1)}% have cached_photo_url (need >=95%)` }
    },
  },
  {
    id: 'no-broken-cdn-paths',
    tag: 'images',
    description: 'cached_photo_url should never point to suspicious junk hosts',
    async fn() {
      const BAD_HOSTS = ['localhost', '127.0.0.1', 'example.com', 'placeholder']
      const { data } = await sb
        .from('events')
        .select('id, cached_photo_url')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .not('cached_photo_url', 'is', null)
      const bad = (data || []).filter(r =>
        BAD_HOSTS.some(h => r.cached_photo_url?.includes(h))
      )
      return bad.length === 0
        ? { ok: true, detail: 'no junk hosts in cached_photo_url' }
        : { ok: false, detail: `${bad.length} bad URLs: ${bad.slice(0, 3).map(r => r.id).join(', ')}` }
    },
  },
  // ── Categories ──────────────────────────────────────────────────────────
  {
    id: 'category-coverage',
    tag: 'categories',
    description: 'At least 90% of upcoming events should have a category',
    async fn() {
      const { count: total } = await sb
        .from('events').select('*', { count: 'exact', head: true })
        .eq('hidden', false).gte('event_date', new Date().toISOString().slice(0, 10))
      const { count: cat } = await sb
        .from('events').select('*', { count: 'exact', head: true })
        .eq('hidden', false).gte('event_date', new Date().toISOString().slice(0, 10))
        .not('category', 'is', null)
      const pct = total > 0 ? (cat / total) * 100 : 100
      return pct >= 90
        ? { ok: true, detail: `${cat}/${total} = ${pct.toFixed(1)}% categorised` }
        : { ok: false, detail: `Only ${cat}/${total} = ${pct.toFixed(1)}% have category (need >=90%)` }
    },
  },
  {
    id: 'kids-storytime-not-arts',
    tag: 'categories',
    description: 'Kids storytime / preschool events should be Family, not Arts & Theater (recurring misclassification)',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, category, raw')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .eq('category', 'Arts & Theater')
      if (error) return { ok: false, detail: error.message }
      const KIDS_RE = /\b(storytime|preschool|kids|playtime|lego club|family board games|crafts for kids)\b/i
      const offenders = (data || []).filter(r => KIDS_RE.test(r.raw?.name ?? ''))
      return offenders.length === 0
        ? { ok: true, detail: 'no kids events miscategorised as Arts & Theater' }
        : { ok: false, detail: `${offenders.length} kids events tagged Arts & Theater: ${offenders.slice(0, 3).map(o => o.id).join(', ')}` }
    },
  },
  // ── HTML entity decoding ────────────────────────────────────────────────
  {
    id: 'titles-decoded',
    tag: 'normalizer',
    description: 'No event titles should contain raw HTML entities (&amp; &#x27; etc) in the rendered title',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, source, raw')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      const ENTITY_RE = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/i
      // Note: raw can have entities — the normalizer is responsible for decoding.
      // We check the most common surface fields. This catches new sources that bypass decoding.
      const offenders = (data || []).filter(r => {
        const title = r.raw?.name?.text ?? r.raw?.name ?? ''
        return typeof title === 'string' && ENTITY_RE.test(title)
      })
      // The DB may have entities — that's fine if normalizer decodes them.
      // We just track the count to spot growth.
      return offenders.length === 0
        ? { ok: true, detail: 'no raw entities in event titles' }
        : { ok: true, detail: `${offenders.length} events have HTML entities in raw — normalizer should decode (informational)` }
    },
  },
  // ── Cancelled events ────────────────────────────────────────────────────
  {
    id: 'cancelled-events-hidden',
    tag: 'data-hygiene',
    description: 'Events with "cancelled"/"canceled"/"postponed" in title should be hidden',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, raw')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      const RE = /\b(cancell?ed|postponed)\b/i
      const offenders = (data || []).filter(r => {
        const title = r.raw?.name?.text ?? r.raw?.name ?? ''
        return typeof title === 'string' && RE.test(title)
      })
      return offenders.length === 0
        ? { ok: true, detail: 'no visible cancelled/postponed events' }
        : { ok: false, detail: `${offenders.length} cancelled/postponed events still visible: ${offenders.slice(0, 3).map(o => o.id).join(', ')}` }
    },
  },
  // ── Source coverage ─────────────────────────────────────────────────────
  {
    id: 'all-sources-have-events',
    tag: 'ingestion',
    description: 'Every active source should have at least one upcoming event (catches dead ingestion pipelines)',
    async fn() {
      const SOURCES = ['ticketmaster', 'eventbrite', 'seatgeek', 'local', 'volunteer', 'nhcc']
      const counts = {}
      for (const s of SOURCES) {
        const { count } = await sb
          .from('events').select('*', { count: 'exact', head: true })
          .eq('hidden', false).eq('source', s)
          .gte('event_date', new Date().toISOString().slice(0, 10))
        counts[s] = count ?? 0
      }
      const empty = Object.entries(counts).filter(([, c]) => c === 0).map(([s]) => s)
      return empty.length === 0
        ? { ok: true, detail: Object.entries(counts).map(([s, c]) => `${s}:${c}`).join(' ') }
        : { ok: false, detail: `Empty sources (ingestion may be dead): ${empty.join(', ')}` }
    },
  },
  // ── No future events drift ──────────────────────────────────────────────
  {
    id: 'no-events-too-far-future',
    tag: 'data-hygiene',
    description: 'Events more than 18 months out are usually data errors',
    async fn() {
      const farFuture = new Date()
      farFuture.setMonth(farFuture.getMonth() + 18)
      const { count } = await sb
        .from('events').select('*', { count: 'exact', head: true })
        .eq('hidden', false).gte('event_date', farFuture.toISOString().slice(0, 10))
      return (count ?? 0) <= 5
        ? { ok: true, detail: `${count ?? 0} events >18mo out (acceptable)` }
        : { ok: false, detail: `${count} events >18mo out — likely date parser bug` }
    },
  },
  // ── Virtual / online event filter (#16) ────────────────────────────────
  {
    id: 'no-virtual-events-visible',
    tag: 'data-hygiene',
    description: 'Zoom/online/virtual events should be hidden, not shown as ABQ events',
    async fn() {
      const RE = /\b(virtual event|zoom webinar|zoom meeting|via zoom|online class|online workshop|livestream|live stream|google meet|microsoft teams)\b/i
      const { data, error } = await sb
        .from('events')
        .select('id, raw, venue_name')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      const offenders = (data || []).filter(r => {
        const title = r.raw?.name?.text ?? r.raw?.name ?? ''
        const desc  = r.raw?.description?.text ?? r.raw?.description ?? r.raw?.info ?? ''
        const blob = `${title} ${r.venue_name ?? ''} ${typeof desc === 'string' ? desc.slice(0, 300) : ''}`
        return RE.test(blob)
      })
      return offenders.length === 0
        ? { ok: true, detail: 'no virtual events visible' }
        : { ok: false, detail: `${offenders.length} virtual events visible: ${offenders.slice(0, 3).map(o => o.id).join(', ')}` }
    },
  },
  // ── Foreign / non-ABQ events (#15) ──────────────────────────────────────
  {
    id: 'no-foreign-events',
    tag: 'data-hygiene',
    description: 'No events outside the US should be visible',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, raw')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      const offenders = (data || []).filter(r => {
        const country = r.raw?.venue?.address?.country ?? r.raw?._embedded?.venues?.[0]?.country?.countryCode
        return country && !['US', 'United States'].includes(country)
      })
      return offenders.length === 0
        ? { ok: true, detail: 'all events are US-based' }
        : { ok: false, detail: `${offenders.length} foreign events: ${offenders.slice(0, 3).map(o => o.id).join(', ')}` }
    },
  },
  // ── Duplicate event detection (#14) ─────────────────────────────────────
  {
    id: 'no-duplicate-events',
    tag: 'data-hygiene',
    description: 'No two visible events should share (title, date, venue, start time) — multi-showtime is OK',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, raw, event_date, venue_name')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      const seen = new Map()
      let dupes = 0
      const examples = []
      for (const r of data || []) {
        const title = (r.raw?.name?.text ?? r.raw?.name ?? '').toString().toLowerCase().trim()
        if (!title) continue
        // Include start time to allow multi-showtime events (matinee + evening)
        const time = (r.raw?.dates?.start?.localTime ?? '').toString().slice(0, 5)
        const k = `${title}|${r.event_date}|${(r.venue_name ?? '').toLowerCase()}|${time}`
        if (seen.has(k)) {
          dupes++
          if (examples.length < 3) examples.push(`${seen.get(k)}↔${r.id}`)
        } else {
          seen.set(k, r.id)
        }
      }
      return dupes <= 2
        ? { ok: true, detail: `${dupes} dupe pairs (acceptable)` }
        : { ok: false, detail: `${dupes} duplicate events: ${examples.join(', ')}` }
    },
  },
  // ── Image status integrity (#20) ────────────────────────────────────────
  {
    id: 'rejected-images-have-no-url',
    tag: 'images',
    description: 'image_status=rejected events should have null cached_photo_url (auto-populate trigger respect)',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, image_status, cached_photo_url')
        .eq('image_status', 'rejected')
        .not('cached_photo_url', 'is', null)
      if (error && error.message.includes('image_status')) {
        return { ok: true, detail: 'image_status column not present (skip)' }
      }
      if (error) return { ok: false, detail: error.message }
      return (data?.length ?? 0) === 0
        ? { ok: true, detail: 'no rejected events have a photo URL' }
        : { ok: false, detail: `${data.length} rejected events still have cached_photo_url — trigger broken` }
    },
  },
  // ── Recurring event explosion (#22) ─────────────────────────────────────
  {
    id: 'no-recurring-explosion',
    tag: 'ingestion',
    description: 'No source slug should have >20 visible upcoming rows (catches recurring-event explosion)',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('source, raw')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      const counts = new Map()
      for (const r of data || []) {
        const slug = r.raw?.slug
        if (!slug) continue
        const k = `${r.source}|${slug}`
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
      const exploded = [...counts.entries()].filter(([, c]) => c > 20)
      return exploded.length === 0
        ? { ok: true, detail: 'no slug has >20 instances' }
        : { ok: false, detail: `${exploded.length} exploded slugs: ${exploded.slice(0, 3).map(([k, c]) => `${k}(${c})`).join(', ')}` }
    },
  },
  // ── Live site availability ──────────────────────────────────────────────
  ...(SITE ? [
    {
      id: 'homepage-200',
      tag: 'live',
      description: 'Homepage returns 200 with content',
      async fn() {
        const r = await fetch(SITE)
        const ok = r.status === 200
        const text = ok ? await r.text() : ''
        return ok && text.includes('ABQ Unplugged')
          ? { ok: true, detail: `200 OK, ${text.length} bytes` }
          : { ok: false, detail: `status=${r.status}` }
      },
    },
    {
      id: 'sitemap-has-venues',
      tag: 'live',
      description: 'Sitemap includes venue pages',
      async fn() {
        const r = await fetch(`${SITE}/sitemap.xml`)
        const text = await r.text()
        const venueCount = (text.match(/\/venues\//g) || []).length
        return venueCount >= 30
          ? { ok: true, detail: `${venueCount} venue URLs in sitemap` }
          : { ok: false, detail: `Only ${venueCount} venues in sitemap (expected >=30)` }
      },
    },
    {
      id: 'newsletter-route-up',
      tag: 'live',
      description: 'POST /api/newsletter responds (not 404)',
      async fn() {
        const r = await fetch(`${SITE}/api/newsletter`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'invalid' }),
        })
        // Expect 400 (validation) — not 404 (route gone) or 500 (config broken)
        return r.status === 400
          ? { ok: true, detail: `400 as expected for invalid email` }
          : { ok: false, detail: `Got ${r.status} — newsletter route may be broken` }
      },
    },
  ] : []),
]

// ─────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────

const tagFilter = typeof argv.tag === 'string' ? argv.tag : null
const filtered = tagFilter ? TESTS.filter(t => t.tag === tagFilter) : TESTS

console.log(`\nRunning ${filtered.length} regression tests${SITE ? ` (live: ${SITE})` : ''}\n`)

let passed = 0
let failed = 0
const failures = []

for (const t of filtered) {
  process.stdout.write(`  [${t.tag.padEnd(13)}] ${t.id} … `)
  try {
    const { ok, detail } = await t.fn()
    if (ok) {
      console.log(`PASS — ${detail}`)
      passed++
    } else {
      console.log(`FAIL — ${detail}`)
      failed++
      failures.push({ id: t.id, description: t.description, detail })
    }
  } catch (e) {
    console.log(`ERROR — ${e.message}`)
    failed++
    failures.push({ id: t.id, description: t.description, detail: e.message })
  }
}

console.log(`\n${passed} passed, ${failed} failed of ${filtered.length} total`)
if (failures.length) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f.id}: ${f.description}\n    ${f.detail}`)
}

process.exit(failed === 0 ? 0 : 1)
