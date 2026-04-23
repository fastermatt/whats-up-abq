#!/usr/bin/env node
/**
 * match-notifications.mjs — scan user preferences → upcoming events,
 * insert notification_matches rows for anything not already matched.
 *
 * Usage:
 *   node scripts/match-notifications.mjs              # all enabled users
 *   node scripts/match-notifications.mjs --user=UUID  # just one user
 *   node scripts/match-notifications.mjs --dry-run    # print, don't insert
 *
 * Run weekly or daily. Idempotent — UNIQUE(user_id, event_id) prevents dupes.
 *
 * Scoring (0-100):
 *   +40 category match
 *   +25 venue match
 *   +20 neighborhood match
 *   +25 per subcategory tag hit (title/description)
 *   +35 per keyword hit (title/description)
 *   +10 mood match
 *   bonus: +5 if date within next 7 days
 *   capped at 100
 * Threshold to create a match: score >= 40
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const args    = new Set(process.argv.slice(2).filter(a => a.startsWith('--') && !a.includes('=')))
const argsKV  = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v]
}))
const DRY = args.has('--dry-run')
const TARGET_USER = argsKV.user || null
const MIN_SCORE = parseInt(argsKV['min-score'] || '40', 10)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── scoring helpers ────────────────────────────────────────────────────────
function lc(s) { return (s || '').toString().toLowerCase() }
function arr(x) { return Array.isArray(x) ? x : [] }

function matchesAny(hay, needles) {
  if (!hay || !needles?.length) return { hit: false, reasons: [] }
  const reasons = []
  const h = lc(hay)
  for (const n of needles) {
    const needle = lc(n)
    if (needle && h.includes(needle)) reasons.push(needle)
  }
  return { hit: reasons.length > 0, reasons }
}

function scoreEvent(event, prefs) {
  const reasons = []
  let score = 0

  // Category
  if (prefs.categories?.length && event.category && prefs.categories.includes(event.category)) {
    score += 40
    reasons.push(`category:${event.category}`)
  }

  // Venue (exact, case-insensitive)
  if (prefs.venues?.length && event.venue_name) {
    const vn = lc(event.venue_name)
    for (const v of prefs.venues) {
      if (lc(v) === vn) {
        score += 25
        reasons.push(`venue:${event.venue_name}`)
        break
      }
    }
  }

  // Neighborhood slug
  if (prefs.neighborhoods?.length && event.neighborhood_slug && prefs.neighborhoods.includes(event.neighborhood_slug)) {
    score += 20
    reasons.push(`nh:${event.neighborhood_slug}`)
  }

  // Subcategory tags (title + description + venue)
  const hay = [event.title, event.info, event.venue_name].filter(Boolean).join(' ')
  if (prefs.subcategory_tags?.length) {
    const { hit, reasons: tagHits } = matchesAny(hay, prefs.subcategory_tags)
    if (hit) {
      score += Math.min(25 * tagHits.length, 50)
      for (const t of tagHits) reasons.push(`tag:${t}`)
    }
  }

  // Free-form keywords
  if (prefs.keywords?.length) {
    const { hit, reasons: kwHits } = matchesAny(hay, prefs.keywords)
    if (hit) {
      score += Math.min(35 * kwHits.length, 70)
      for (const k of kwHits) reasons.push(`kw:${k}`)
    }
  }

  // Mood
  if (prefs.moods?.length && event.mood) {
    if (prefs.moods.includes(event.mood)) {
      score += 10
      reasons.push(`mood:${event.mood}`)
    }
  }

  // Date recency bonus
  if (event.event_date) {
    const daysOut = Math.floor((new Date(event.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysOut >= 0 && daysOut <= 7) {
      score += 5
      reasons.push('soon')
    }
  }

  // Filters
  if (prefs.family_friendly) {
    // Require event category to be Family OR title/desc to contain family signals
    const isFamily = event.category === 'Family' ||
      /\b(kids|family|storytime|lego|children|all.?ages|toddler)\b/i.test(hay)
    if (!isFamily) {
      return { score: 0, reasons: ['filtered:not_family'] }
    }
  }

  // Price filter (skip if we don't have price info — don't silently filter)
  // price_min_cents / price_max_cents aren't currently stored denormalized; skip for now.

  return { score: Math.min(score, 100), reasons }
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔔 Notification matcher starting…')
  if (DRY) console.log('  (dry-run mode)')

  // Fetch enabled prefs
  let prefsQuery = supabase.from('user_event_preferences').select('*').eq('enabled', true)
  if (TARGET_USER) prefsQuery = prefsQuery.eq('user_id', TARGET_USER)
  const { data: allPrefs, error: prefsErr } = await prefsQuery
  if (prefsErr) throw prefsErr
  if (!allPrefs?.length) {
    console.log('  No users with enabled preferences. Exiting.')
    return
  }
  console.log(`  ${allPrefs.length} user(s) with preferences`)

  // Fetch upcoming visible events (once)
  const today = new Date().toISOString().slice(0, 10)
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, category, venue_name, neighborhood_slug, event_date, ai_enrichment, raw')
    .eq('hidden', false)
    .gte('event_date', today)
    .order('event_date')
    .limit(5000)
  if (evErr) throw evErr
  console.log(`  ${events?.length ?? 0} upcoming events in pool`)

  // Normalize events once
  const norm = (events ?? []).map(e => ({
    id:                e.id,
    category:          e.category,
    venue_name:        e.venue_name,
    neighborhood_slug: e.neighborhood_slug,
    event_date:        e.event_date,
    title:             e?.raw?.name ?? e?.raw?.title ?? '',
    info:              e?.raw?.info ?? e?.raw?.description ?? '',
    mood:              e?.ai_enrichment?.mood ?? null,
  }))

  let totalMatches = 0
  for (const prefs of allPrefs) {
    const daysAhead = prefs.days_ahead ?? 14
    const horizon = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10)

    const matches = []
    for (const e of norm) {
      if (e.event_date > horizon) continue
      const { score, reasons } = scoreEvent(e, prefs)
      if (score >= MIN_SCORE) matches.push({ event_id: e.id, score, match_reasons: reasons })
    }

    matches.sort((a, b) => b.score - a.score)
    // Cap per-user matches so we don't flood
    const TOP = 30
    const slice = matches.slice(0, TOP)

    console.log(`  user=${prefs.user_id.slice(0, 8)}…  matched=${matches.length}  kept=${slice.length}`)

    if (!slice.length) continue
    totalMatches += slice.length

    if (DRY) {
      for (const m of slice.slice(0, 5)) {
        console.log(`    • ${m.score}  ${m.event_id}  reasons=${m.match_reasons.join(',')}`)
      }
      continue
    }

    // Skip events the user has already dismissed — they thumbs-downed it.
    const { data: dismissed } = await supabase
      .from('notification_matches')
      .select('event_id')
      .eq('user_id', prefs.user_id)
      .eq('dismissed', true)
    const skipSet = new Set((dismissed ?? []).map(d => d.event_id))
    const keep = slice.filter(m => !skipSet.has(m.event_id))
    if (keep.length < slice.length) {
      console.log(`    respecting ${slice.length - keep.length} dismissal(s)`)
    }

    if (!keep.length) continue

    const rows = keep.map(m => ({
      user_id:       prefs.user_id,
      event_id:      m.event_id,
      score:         m.score,
      match_reasons: m.match_reasons,
      matched_at:    new Date().toISOString(),
    }))

    // Upsert on (user_id, event_id) — refresh scores, don't duplicate.
    // Explicitly DON'T reset `dismissed` (covered above by skipping dismissed ids).
    const { error } = await supabase
      .from('notification_matches')
      .upsert(rows, { onConflict: 'user_id,event_id', ignoreDuplicates: false })
    if (error) console.error(`    ❌ upsert failed for ${prefs.user_id}:`, error.message)
  }

  console.log(`✅ Done. totalMatches=${totalMatches}`)
}

main().catch(err => { console.error(err); process.exit(1) })
