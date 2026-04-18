#!/usr/bin/env node
/**
 * Daily event hygiene:
 *   1. Hide past events (event_date < today, America/Denver).
 *   2. Hide V1 `seatgeek_sg-*` duplicate rows (V1's fetch-data.cjs still runs and
 *      writes these; the V2 importer uses the `seatgeek_{id}` form, so the sg-
 *      prefix rows are always duplicates).
 *   3. Hide Ticketmaster events with status.code = 'cancelled'.
 *
 * Each hidden row is tagged in ai_enrichment.hide_reason so changes are reversible.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-events.mjs
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
  console.log('🧹 ABQ Unplugged — daily event cleanup\n')
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

  console.log('\n✅ Cleanup complete')
}

main().catch(err => {
  console.error('❌ Fatal:', err)
  process.exit(1)
})
