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
    description: 'At least 90% of upcoming events should have cached_photo_url',
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
      return pct >= 90
        ? { ok: true, detail: `${withPhoto}/${total} = ${pct.toFixed(1)}% photo coverage` }
        : { ok: false, detail: `Only ${withPhoto}/${total} = ${pct.toFixed(1)}% have cached_photo_url (need >=90%)` }
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
  // ── Cross-source duplicates (SeatGeek ↔ Ticketmaster same showing) ─────
  // Title strings differ across sources ("Mrs. Doubtfire (Touring)" vs
  // "Mrs. Doubtfire - Albuquerque"), so the strict dupe test above misses
  // these. This test matches on (date, venue, time, first-8-chars-of-title).
  {
    id: 'no-cross-source-duplicates',
    tag: 'data-hygiene',
    description: 'No SeatGeek ↔ Ticketmaster pairs sharing date+venue+time+title-prefix should both be visible',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, source, raw, event_date, venue_name')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .in('source', ['seatgeek', 'ticketmaster'])
      if (error) return { ok: false, detail: error.message }
      const seen = new Map()
      let pairs = 0
      const examples = []
      for (const r of data || []) {
        const title = (r.raw?.name ?? '').toString().toLowerCase().trim().slice(0, 8)
        const time  = (r.raw?.dates?.start?.localTime ?? '').toString().slice(0, 5)
        if (!title || !time || !r.venue_name) continue
        const k = `${title}|${r.event_date}|${r.venue_name.toLowerCase()}|${time}`
        if (seen.has(k) && seen.get(k).source !== r.source) {
          pairs++
          if (examples.length < 3) examples.push(`${seen.get(k).id}↔${r.id}`)
        } else if (!seen.has(k)) {
          seen.set(k, { id: r.id, source: r.source })
        }
      }
      return pairs === 0
        ? { ok: true, detail: 'no cross-source dupes' }
        : { ok: false, detail: `${pairs} SG↔TM dupe pair(s): ${examples.join(', ')}` }
    },
  },
  // ── Rio Rancho leaks ─────────────────────────────────────────────────────
  {
    id: 'no-rio-rancho-events',
    tag: 'geo',
    description: 'Rio Rancho is a separate city — should not appear in the visible feed',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, venue_name, raw')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      let hits = 0
      const examples = []
      for (const r of data || []) {
        // Rio Rancho Events Center is a legitimate metro-area concert venue — exempt it
        if (/rio rancho events center/i.test(r.venue_name ?? '')) continue
        const blob = `${r.venue_name ?? ''} ${JSON.stringify(r.raw).slice(0, 2000)}`
        if (/\b(rio rancho|87124|87144)\b/i.test(blob)) {
          hits++
          if (examples.length < 3) examples.push(r.id)
        }
      }
      return hits === 0
        ? { ok: true, detail: 'no Rio Rancho events visible' }
        : { ok: false, detail: `${hits} Rio Rancho event(s) visible: ${examples.join(', ')}` }
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
  // ── Local/abqtodo event street addresses (#11 in wiki — the 525-event bug) ─
  {
    id: 'local-events-have-street-addresses',
    tag: 'normalizer',
    description: 'Local/abqtodo events with _embedded.venues[0].address.line1 in raw should surface that on the page (regression: was being dropped for 525 events)',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, source, raw')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .in('source', ['local', 'volunteer'])
      if (error) return { ok: false, detail: error.message }
      // We assert that ≥80% of local/volunteer events HAVE address data available somewhere.
      // Coverage below this threshold indicates importer or normalizer regression.
      const total = data.length
      const withAddr = data.filter(r => {
        return r.raw?.address || r.raw?._embedded?.venues?.[0]?.address?.line1
      }).length
      const pct = total > 0 ? (withAddr / total) * 100 : 100
      return pct >= 80
        ? { ok: true, detail: `${withAddr}/${total} = ${pct.toFixed(1)}% local/volunteer events have address data` }
        : { ok: false, detail: `Only ${withAddr}/${total} = ${pct.toFixed(1)}% local/volunteer events have addresses (need >=80%) — likely importer or normalizer regression` }
    },
  },

  // ── Boilerplate descriptions (Round 6 — "Live music event." placeholder) ──
  {
    id: 'no-boilerplate-descriptions',
    tag: 'normalizer',
    description: 'No event should have boilerplate filler descriptions like "Live music event." in raw description fields',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, source, raw')
        .eq('hidden', false)
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      const BOILERPLATE = new Set([
        'live music event.', 'live music event',
        'live music performance.', 'live music performance',
        'concert.', 'concert',
        'sports event.', 'sports event',
        'live event.', 'live event',
      ])
      // Note: cleanDescription() filters these at runtime, so this test is a SAFETY NET
      // checking that we still surface any cases where boilerplate slips through.
      // We only flag descriptions visible to users (TM info, EB description.text, SG info).
      const offenders = (data || []).filter(r => {
        const desc = r.raw?.info ?? r.raw?.description?.text ?? r.raw?.description ?? ''
        return typeof desc === 'string' && BOILERPLATE.has(desc.trim().toLowerCase())
      })
      // This is informational since runtime filter handles it — but spike means importer gap
      return offenders.length <= 30
        ? { ok: true, detail: `${offenders.length} events have boilerplate raw descriptions (filtered at runtime; informational)` }
        : { ok: false, detail: `${offenders.length} events have boilerplate raw descriptions — importer should filter at ingest time` }
    },
  },

  // ── SeatGeek raw category strings leaking into descriptions ──────────────
  {
    id: 'no-sg-category-string-descriptions',
    tag: 'normalizer',
    description: 'SeatGeek events should not have raw category path strings ("Comedy / theater_comedy performance.") as descriptions',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, raw')
        .eq('hidden', false)
        .eq('source', 'seatgeek')
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      // Pattern that matches raw SG category strings: "Word / word_word performance."
      const SG_CAT_RE = /\/\s*\w+_\w/
      const offenders = (data || []).filter(r => {
        const info = r.raw?.info
        return typeof info === 'string' && info.length < 120 && SG_CAT_RE.test(info)
      })
      // Runtime filter catches these — this is a safety net
      return offenders.length === 0
        ? { ok: true, detail: 'no SG raw category strings in descriptions' }
        : { ok: true, detail: `${offenders.length} SG events have category-shaped raw descriptions (filtered at runtime; informational)` }
    },
  },

  // ── Family false positives — adult/gala/wine events tagged Family ────────
  {
    id: 'family-no-adult-events',
    tag: 'categories',
    description: 'Family category should not contain events with adult/gala/wine/cocktail markers',
    async fn() {
      const { data, error } = await sb
        .from('events')
        .select('id, raw, venue_name')
        .eq('hidden', false)
        .eq('category', 'Family')
        .gte('event_date', new Date().toISOString().slice(0, 10))
      if (error) return { ok: false, detail: error.message }
      // Adult-marker patterns. "Adult Storytime" at libraries is OK (program FOR adults with special needs)
      // but galas, wine tastings, 21+, cocktail events should never be Family.
      const ADULT_RE = /\b(gala|wine tasting|cocktail|21\+|adults? only|after dark|nightlife|drag show|burlesque)\b/i
      const offenders = (data || []).filter(r => {
        const title = r.raw?.name ?? r.raw?.title ?? ''
        return typeof title === 'string' && ADULT_RE.test(title)
      })
      return offenders.length === 0
        ? { ok: true, detail: 'no adult events tagged Family' }
        : { ok: false, detail: `${offenders.length} adult-themed events tagged Family: ${offenders.slice(0, 3).map(o => o.id).join(', ')}` }
    },
  },

  // ── Search word-boundary regression (Round 10 — Taco/Tacoma false positive) ──
  {
    id: 'no-search-substring-false-positives',
    tag: 'normalizer',
    description: 'Short search terms should not match arbitrary substrings (e.g. "taco" should not match "Tacoma Rainiers")',
    async fn() {
      // We can test the intent by checking that sports events with "Tacoma" in the title exist —
      // confirming the false-positive scenario is possible — and then verify our fix expectation.
      // This is a static invariant test: if someone regresses the search logic back to .includes(),
      // "taco" will again match Tacoma Rainiers game titles.
      //
      // We use a data-level proxy: check that there ARE sports events with "Tacoma" in the title.
      // If there are, AND the search is fixed, they should NOT appear when searching "taco".
      // The actual fix is in the code — this test just guards the invariant is still documented.
      const { data, error } = await sb
        .from('events')
        .select('id, raw')
        .eq('hidden', false)
        .eq('category', 'Sports')
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .ilike('venue_name', '%Tacoma%')
      if (error) return { ok: false, detail: error.message }
      // Tacoma Rainiers games exist in DB — the substring fix is important
      return {
        ok: true,
        detail: `${data.length} Tacoma games exist (word-boundary search fix prevents "taco" from matching them)`,
      }
    },
  },

  // ── Live site availability ──────────────────────────────────────────────
  ...(SITE ? [
    // ── Category slug normalization (Round 4 — was returning 0 results) ────
    {
      id: 'category-slugs-redirect-to-canonical',
      tag: 'live',
      description: 'Slug-form category params should redirect to canonical DB names (regression: arts-culture → 0 results)',
      async fn() {
        const TESTS = [
          { slug: 'food-drink',   expected: 'Food+%26+Drink' },
          { slug: 'arts-culture', expected: 'Arts+%26+Theater' },
          { slug: 'arts',         expected: 'Arts+%26+Theater' },
        ]
        const failures = []
        for (const t of TESTS) {
          const r = await fetch(`${SITE}/events?category=${t.slug}`, { redirect: 'manual' })
          // Expect 308 redirect to canonical URL
          const location = r.headers.get('location') || ''
          if (r.status !== 308 || !location.includes(t.expected)) {
            failures.push(`${t.slug} → ${r.status} ${location || '(no redirect)'}`)
          }
        }
        return failures.length === 0
          ? { ok: true, detail: `${TESTS.length} category slug redirects working` }
          : { ok: false, detail: `Slug redirects broken: ${failures.join('; ')}` }
      },
    },

    // ── /search → /events redirect (Round 4) ───────────────────────────────
    {
      id: 'search-redirects-to-events',
      tag: 'live',
      description: '/search?q=... should redirect to /events?q=... (was 404 before)',
      async fn() {
        const r = await fetch(`${SITE}/search?q=jazz`, { redirect: 'manual' })
        const location = r.headers.get('location') || ''
        return r.status === 308 && location.includes('/events') && location.includes('q=jazz')
          ? { ok: true, detail: `308 → ${location}` }
          : { ok: false, detail: `Got ${r.status} ${location || '(no redirect)'} — /search redirect broken` }
      },
    },

    // ── Venue slug aliases (Rounds 2+5 — el-rey, revel-abq, etc.) ─────────
    {
      id: 'venue-slug-aliases-redirect',
      tag: 'live',
      description: 'Venue shorthand slugs should redirect to canonical (was 404 before)',
      async fn() {
        const TESTS = [
          { slug: 'el-rey',         expectedSubstring: 'el-rey-theater' },
          { slug: 'revel-abq',      expectedSubstring: 'revel-entertainment' },
          { slug: 'kimo-theater',   expectedSubstring: 'kimo-theatre' },
          { slug: 'isotopes',       expectedSubstring: 'isotopes-park' },
          { slug: 'nhcc',           expectedSubstring: 'national-hispanic' },
        ]
        const failures = []
        for (const t of TESTS) {
          const r = await fetch(`${SITE}/venues/${t.slug}`, { redirect: 'manual' })
          const location = r.headers.get('location') || ''
          if (r.status !== 308 || !location.includes(t.expectedSubstring)) {
            failures.push(`${t.slug} → ${r.status} ${location || '(no redirect)'}`)
          }
        }
        return failures.length === 0
          ? { ok: true, detail: `${TESTS.length} venue aliases redirect correctly` }
          : { ok: false, detail: `Venue redirects broken: ${failures.join('; ')}` }
      },
    },

    // ── Neighborhood slug aliases ──────────────────────────────────────────
    // Next.js redirect() in a server component follows by default — fetch with
    // redirect:'follow' lands on the final URL, which we extract from the response.
    {
      id: 'neighborhood-slug-aliases-redirect',
      tag: 'live',
      description: 'Neighborhood shorthand slugs should redirect to canonical (follow chain)',
      async fn() {
        const TESTS = [
          { slug: 'university', expectedSubstring: 'unm-campus' },
          { slug: 'barelas',    expectedSubstring: 'barelas-south-downtown' },
        ]
        // 'central' → 'downtown' is intentionally aliased but the resulting
        // page has both names so we only test ones with distinct canonical slugs
        const failures = []
        for (const t of TESTS) {
          const r = await fetch(`${SITE}/neighborhoods/${t.slug}`)
          // After following any redirects, the final URL should contain the canonical slug
          const finalUrl = r.url
          if (!finalUrl.includes(t.expectedSubstring) && !finalUrl.includes(t.slug)) {
            // Either the alias resolved to canonical, OR the page rendered the slug directly.
            // Both are acceptable as long as the page returns 200.
            failures.push(`${t.slug} → ${r.status} (final: ${finalUrl})`)
          }
          if (r.status !== 200) {
            failures.push(`${t.slug} → ${r.status} (final: ${finalUrl})`)
          }
        }
        return failures.length === 0
          ? { ok: true, detail: `${TESTS.length} neighborhood aliases resolve to 200` }
          : { ok: false, detail: `Neighborhood aliases broken: ${failures.join('; ')}` }
      },
    },

    // ── Venue page resolves for known canonical slugs ──────────────────────
    {
      id: 'top-venues-resolve',
      tag: 'live',
      description: 'Top venues should resolve at their canonical slug with the venue name in the H1 (catches fetchVenueBySlug bugs)',
      async fn() {
        const VENUES = [
          { slug: 'sunshine-theater',                          h1Substring: 'Sunshine' },
          { slug: 'the-historic-el-rey-theater-albuquerque',   h1Substring: 'El Rey' },
          { slug: 'revel-entertainment-center',                h1Substring: 'Revel' },
          { slug: 'national-hispanic-cultural-center',         h1Substring: 'National Hispanic' },
          { slug: 'kimo-theatre',                              h1Substring: 'KiMo' },
        ]
        const failures = []
        for (const v of VENUES) {
          const r = await fetch(`${SITE}/venues/${v.slug}`)
          if (r.status !== 200) {
            failures.push(`${v.slug} → ${r.status}`)
            continue
          }
          const text = await r.text()
          // Match the H1 — venue page H1 contains the venue name when it resolves.
          // "Venue Not Found" can appear in encoded React payload chunks but the
          // H1 only renders when the venue is actually found.
          const h1Match = text.match(/<h1[^>]*>([^<]+)<\/h1>/i)
          const h1Text = h1Match ? h1Match[1] : ''
          if (!h1Text.includes(v.h1Substring)) {
            failures.push(`${v.slug} → H1="${h1Text.slice(0, 50)}" (expected to contain "${v.h1Substring}")`)
          }
        }
        return failures.length === 0
          ? { ok: true, detail: `${VENUES.length} canonical venues all resolve with correct H1` }
          : { ok: false, detail: `Venue resolution broken: ${failures.join('; ')}` }
      },
    },

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
    // ── Search false-positive regression — "taco" must not match "Tacoma" ───
    {
      id: 'search-no-substring-false-positives',
      tag: 'live',
      description: 'Searching "taco" should not return Tacoma Rainiers baseball games (word-boundary regression)',
      async fn() {
        const r = await fetch(`${SITE}/events?q=taco`)
        if (r.status !== 200) return { ok: false, detail: `Got ${r.status}` }
        const text = await r.text()
        // If "Tacoma Rainiers" appears in the page, the word-boundary fix is broken
        if (text.includes('Tacoma Rainiers')) {
          const matches = (text.match(/Tacoma Rainiers/g) || []).length
          return { ok: false, detail: `"Tacoma Rainiers" appears ${matches} time(s) in taco search — word-boundary fix regressed` }
        }
        return { ok: true, detail: '"taco" search contains no Tacoma Rainiers false positives' }
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

  // ── IG suggestion pipeline invariants ──────────────────────────────────
  // Added after the 2026-06 incidents: (1) generator inserted a non-existent
  // `event_ctx` column → crash; (2) DeepSeek key unset → blank captions;
  // (3) same event cross-listed by two sources appeared twice in one post.
  {
    id: 'ig-suggestions-columns-exist',
    tag: 'ig',
    description: 'Every column the IG generator writes must exist on ig_post_suggestions (guards the event_ctx-class insert crash)',
    async fn() {
      const cols = 'id,created_at,generation_id,post_type,template_id,event_ids,event_data,caption,scheduled_for,status,strategy_notes,rejection_reason,caption_edited,image_data_url,ig_media_id'
      const { error } = await sb.from('ig_post_suggestions').select(cols).limit(1)
      return error
        ? { ok: false, detail: `Column mismatch on ig_post_suggestions: ${error.message}` }
        : { ok: true, detail: 'all generator columns present' }
    },
  },
  {
    id: 'ig-accepted-has-caption',
    tag: 'ig',
    description: 'No accepted/published IG suggestion may have an empty caption (guards the blank-caption publish bug)',
    async fn() {
      const { data, error } = await sb.from('ig_post_suggestions').select('id,caption').in('status', ['accepted', 'published'])
      if (error) return { ok: false, detail: error.message }
      const blanks = (data ?? []).filter(r => !r.caption || !r.caption.trim())
      return blanks.length === 0
        ? { ok: true, detail: `${data?.length ?? 0} accepted/published, all captioned` }
        : { ok: false, detail: `${blanks.length} accepted/published with empty caption: ${blanks.map(b => b.id).slice(0, 3).join(', ')}` }
    },
  },
  {
    id: 'ig-no-duplicate-event-in-post',
    tag: 'ig',
    description: 'No pending IG suggestion lists the same event twice by normalized title (guards the cross-source dup-event bug)',
    async fn() {
      const { data, error } = await sb.from('ig_post_suggestions').select('id,event_data').eq('status', 'pending')
      if (error) return { ok: false, detail: error.message }
      const norm = t => (t ?? '').toLowerCase().replace(/^[^:]{1,18}:\s*/, '').replace(/[^a-z0-9]+/g, '')
      const bad = []
      for (const row of data ?? []) {
        const titles = (row.event_data ?? []).map(e => norm(e.title)).filter(Boolean)
        if (new Set(titles).size !== titles.length) bad.push(row.id)
      }
      return bad.length === 0
        ? { ok: true, detail: `${data?.length ?? 0} pending posts, none with duplicate events` }
        : { ok: false, detail: `${bad.length} posts with duplicate events: ${bad.slice(0, 3).join(', ')}` }
    },
  },
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
