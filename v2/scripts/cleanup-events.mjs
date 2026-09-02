#!/usr/bin/env node
/**
 * Daily event hygiene:
 *   1. Hide past events (event_date < today, America/Denver).
 *   2. Hide V1 `seatgeek_sg-*` duplicate rows (V1's fetch-data.cjs still runs and
 *      writes these; the V2 importer uses the `seatgeek_{id}` form, so the sg-
 *      prefix rows are always duplicates).
 *   3. Hide Ticketmaster events with status.code = 'cancelled'.
 *   4. Permanently delete up to 100 events older than 30 days.
 *
 * Each hidden row is tagged in ai_enrichment.hide_reason so changes are reversible.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-events.mjs
 *   node scripts/cleanup-events.mjs --dry-run
 *   node scripts/cleanup-events.mjs --skip-purge  # cron owns retention
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load .env ─────────────────────────────────────────────────────────────────
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

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const SKIP_PURGE = process.argv.includes('--skip-purge')

// Today in America/Denver, as YYYY-MM-DD
function todayInDenver() {
  const now = new Date()
  const denver = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now) // en-CA returns YYYY-MM-DD
  return denver
}

async function hide(reason, filterFn) {
  // First fetch the ids to hide so we can report counts.
  const query = supabase.schema('public').from('events').select('id').eq('hidden', false)
  const { data: rows, error } = await filterFn(query)
  if (error) {
    console.error(`❌ [${reason}] query error:`, error.message)
    return 0
  }
  if (!rows || rows.length === 0) {
    console.log(`  [${reason}] nothing to hide`)
    return 0
  }

  if (DRY_RUN) {
    console.log(`  [${reason}] would hide ${rows.length} row(s)`)
    return rows.length
  }

  const ids = rows.map(r => r.id)
  const now = new Date().toISOString()

  // Update in batches of 200 — supabase limits row updates.
  let hidden = 0
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    // Fetch current ai_enrichment for these rows to preserve existing keys.
    const { data: existing } = await supabase
      .schema('public').from('events')
      .select('id, ai_enrichment')
      .in('id', chunk)

    await Promise.all((existing || []).map(async row => {
      const merged = {
        ...(row.ai_enrichment || {}),
        hide_reason: reason,
        hidden_at: now,
      }
      const { error: upErr } = await supabase
        .schema('public').from('events')
        .update({ hidden: true, ai_enrichment: merged })
        .eq('id', row.id)
      if (!upErr) hidden += 1
    }))
  }
  console.log(`  [${reason}] hid ${hidden} / ${ids.length} rows`)
  return hidden
}

async function main() {
  console.log(`🧹 ABQ Unplugged — daily event cleanup${DRY_RUN ? ' (DRY RUN)' : ''}\n`)
  const today = todayInDenver()
  console.log(`  Today (America/Denver): ${today}\n`)

  // 1. Past events
  await hide('past_event_cleanup_daily', q => q.lt('event_date', today))

  // 2. V1 SeatGeek sg- prefix duplicates
  await hide('v1_sg_prefix_dedup_daily', q => q.like('id', 'seatgeek_sg-%'))

  // 3. TM cancelled events
  await hide(
    'tm_cancelled_daily',
    q => q.eq('source', 'ticketmaster').filter('raw->dates->status->>code', 'eq', 'cancelled'),
  )

  // 4. Eventbrite B2B training / workshop spam farms.
  //    These listings spam every US city with generic "certification" /
  //    "1-day workshop" content. We match on venue AND title patterns —
  //    venue "For venue details reach us at info@..." is a canonical tell,
  //    and titles like "PMP Certification ... in Albuquerque, NM" are spam boilerplate.
  await hide(
    'eb_spam_bootcamp_daily',
    q => q.eq('source', 'eventbrite').or([
      'venue_name.ilike.%info@%',
      'venue_name.ilike.%for venue details%',
      'venue_name.ilike.%reach us at%',
    ].join(',')),
  )
  // Title-regex arm — PostgREST .or() can't drill into raw JSONB, so we fetch
  // the small EB set and filter client-side. Reads ~200 rows daily.
  {
    const SPAM_TITLE = /(1[\s-]?day\s+workshop|[1-9][\s-]?day\s+(bootcamp|training|certification)|(pmp|lean six sigma|lssgb|ceh|scrum master|itil|agile|data science).*(certification|training|bootcamp)|in\s+(albuquerque|rio rancho|santa fe),?\s*n\.?m\.?$)/i
    const { data } = await supabase.schema('public').from('events')
      .select('id, raw, ai_enrichment')
      .eq('source', 'eventbrite')
      .eq('hidden', false)
    let hidden = 0
    for (const row of data || []) {
      const title = typeof row.raw?.name === 'string' ? row.raw.name : row.raw?.name?.text
      if (!title || !SPAM_TITLE.test(title)) continue
      if (DRY_RUN) {
        hidden += 1
        continue
      }
      const merged = {
        ...(row.ai_enrichment || {}),
        hide_reason: 'eb_spam_title_daily',
        hidden_at: new Date().toISOString(),
      }
      const { error } = await supabase.schema('public').from('events')
        .update({ hidden: true, ai_enrichment: merged })
        .eq('id', row.id)
      if (!error) hidden += 1
    }
    console.log(`  [eb_spam_title_daily] ${DRY_RUN ? 'would hide' : 'hid'} ${hidden} rows`)
  }

  // 5. Cross-source + intra-source duplicates.
  //    Key: (title, date, venue_name, localTime5). Keep highest-scoring row per key.
  //    Scoring: TM (1000) >> has-time (100) >> TM G5vzZ prefix (+50) >> SG (10) >> EB (5) >> photo (5).
  //    TM wins over SG/EB even when TM lacks a start time — TM has better photos.
  {
    const { data: live } = await supabase.schema('public').from('events')
      .select('id, source, raw, event_date, venue_name, cached_photo_url')
      .eq('hidden', false)
      .gte('event_date', today)
    let hidden = 0
    if (live) {
      // Build scoring.
      // Source priority: TM (1000) >> time bonus (100) >> SG (10) >> EB (5) >> photo (5).
      // TM score is intentionally much higher than the time bonus so that a
      // timeless TM listing beats a timed SG/EB listing — TM has better event
      // photos and is the canonical source for major venues.
      const scored = live.map(e => {
        const title = typeof e.raw?.name === 'string' ? e.raw.name : (e.raw?.name?.text || e.raw?.title || '')
        const lt    = e.raw?.dates?.start?.localTime ?? null
        const lt5   = typeof lt === 'string' ? lt.slice(0, 5) : ''
        const score = (lt ? 100 : 0)
                    + (e.source === 'ticketmaster' ? 1000 : 0)
                    + (e.source === 'ticketmaster' && String(e.id).startsWith('ticketmaster_G5vzZ') ? 50 : 0)
                    + (e.source === 'seatgeek'     ? 10 : 0)
                    + (e.source === 'eventbrite'   ? 5 : 0)
                    + (e.cached_photo_url ? 5 : 0)
        return { id: e.id, title: String(title).trim(), date: e.event_date, venue: (e.venue_name || '').trim(), lt5, score }
      }).filter(x => x.title && x.venue)

      // Group by title+date+venue
      const groups = new Map()
      for (const s of scored) {
        const k = `${s.title}|${s.date}|${s.venue}`
        if (!groups.has(k)) groups.set(k, [])
        groups.get(k).push(s)
      }

      const toHide = new Set()
      for (const [, arr] of groups) {
        if (arr.length < 2) continue
        // Same-time dedup buckets
        const byTime = new Map()
        for (const s of arr) {
          const t = s.lt5 || '__none__'
          if (!byTime.has(t)) byTime.set(t, [])
          byTime.get(t).push(s)
        }
        // Within each time bucket (including timeless '__none__'), keep highest score.
        // Note: '__none__' is no longer skipped — TM timeless beats SG timeless here.
        for (const [, group] of byTime) {
          if (group.length < 2) continue
          group.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
          for (let i = 1; i < group.length; i++) toHide.add(group[i].id)
        }
        // Cross-bucket: timeless row(s) vs timed row(s).
        // Previously: always hide timeless when any timed sibling exists.
        // Now: compare best-scoring survivor in each camp — higher score wins.
        // This means TM-timeless (score 1000+) beats SG-timed (score 110).
        const hasTimed = [...byTime.keys()].some(k => k !== '__none__')
        if (hasTimed && byTime.has('__none__')) {
          const noneGroup = byTime.get('__none__').filter(s => !toHide.has(s.id))
          if (noneGroup.length > 0) {
            const bestNone  = noneGroup[0] // already sorted by score above
            const bestTimed = [...byTime.entries()]
              .filter(([t]) => t !== '__none__')
              .flatMap(([, g]) => g.filter(s => !toHide.has(s.id)))
              .sort((a, b) => b.score - a.score)[0]
            if (bestTimed) {
              if (bestNone.score >= bestTimed.score) {
                // Timeless winner (e.g. TM) beats the best timed row — hide all timed survivors
                for (const [t, g] of byTime) {
                  if (t !== '__none__') for (const s of g) if (!toHide.has(s.id)) toHide.add(s.id)
                }
              } else {
                // Timed winner — hide all timeless survivors
                for (const s of noneGroup) toHide.add(s.id)
              }
            }
          }
        }
      }

      if (toHide.size > 0) {
        const ids = [...toHide]
        if (DRY_RUN) {
          hidden = ids.length
        } else {
          const now = new Date().toISOString()
          for (let i = 0; i < ids.length; i += 200) {
            const chunk = ids.slice(i, i + 200)
            const { data: existing } = await supabase.schema('public').from('events')
              .select('id, ai_enrichment').in('id', chunk)
            await Promise.all((existing || []).map(async row => {
              const merged = { ...(row.ai_enrichment || {}), hide_reason: 'auto_dedup_daily', hidden_at: now }
              const { error } = await supabase.schema('public').from('events')
                .update({ hidden: true, ai_enrichment: merged }).eq('id', row.id)
              if (!error) hidden += 1
            }))
          }
        }
      }
      console.log(`  [auto_dedup_daily] ${DRY_RUN ? 'would hide' : 'hid'} ${hidden} dup row(s)`)
    }
  }

  // 6. Hard-delete only after a 30-day grace period. The RPC is intentionally
  // bounded at 100 rows so a backlog cannot create another burst-I/O incident.
  if (SKIP_PURGE) {
    console.log('  [past_event_retention_30d] skipped here; daily cron owns the bounded purge')
  } else if (DRY_RUN) {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
    const { count, error } = await supabase.schema('public').from('events')
      .select('id', { count: 'exact', head: true })
      .lt('event_date', cutoff)
    if (error) console.error('❌ [past_event_retention_30d] count error:', error.message)
    else console.log(`  [past_event_retention_30d] would delete ${Math.min(count ?? 0, 100)} / ${count ?? 0} expired row(s)`)
  } else {
    const { data: purged, error } = await supabase.rpc('purge_old_events')
    if (error) console.error('❌ [past_event_retention_30d] purge error:', error.message)
    else console.log(`  [past_event_retention_30d] deleted ${purged ?? 0} expired row(s)`)
  }

  console.log('\n✅ Cleanup complete')
}

main().catch(err => {
  console.error('❌ Fatal:', err)
  process.exit(1)
})
