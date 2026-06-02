#!/usr/bin/env node
/**
 * submit-indexnow.mjs
 *
 * Bulk-submit all visible event + static pages to IndexNow (Bing/Yandex).
 * Run this after a pipeline refresh or anytime you want Google/Bing to re-crawl.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs             # all URLs
 *   node scripts/submit-indexnow.mjs --dry-run   # print URLs, no submission
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const isDryRun = process.argv.includes('--dry-run')

// ── Env ───────────────────────────────────────────────────────────────────────
for (const f of [join(__dir, '.env'), join(__dir, '../.env.local')]) {
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
    break
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const BASE       = 'https://abqunplugged.com'
const INDEXNOW_KEY  = 'a8f4c2b1d7e5f3a9b4c8d2e6f1a5b9c3'
const INDEXNOW_HOST = 'www.bing.com'

// ── Static URLs ───────────────────────────────────────────────────────────────
const STATIC_URLS = [
  '/', '/events', '/tonight', '/weekend', '/this-week',
  '/free', '/family-friendly', '/date-night', '/things-to-do',
  '/live-music', '/comedy', '/arts', '/sports-events', '/nightlife',
  '/concerts', '/outdoor-activities', '/food-drink-events', '/festivals',
  '/kids-activities', '/things-to-do-this-weekend', '/live-music-tonight',
  '/things-to-do-today', '/free-events-albuquerque', '/venues', '/neighborhoods',
  '/categories/music', '/categories/sports', '/categories/arts-theater',
  '/categories/comedy', '/categories/family', '/categories/food-drink',
  '/categories/film', '/categories/community', '/categories/festivals',
  '/categories/outdoor',
].map(p => BASE + p)

// ── Fetch all visible event IDs ────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)
const { data: events, error } = await supabase
  .schema('public')
  .from('events')
  .select('id')
  .eq('hidden', false)
  .gte('event_date', today)
  .order('event_date', { ascending: true })

if (error) { console.error('Supabase error:', error.message); process.exit(1) }

const eventUrls = (events ?? []).map(e => `${BASE}/events/${e.id}`)

const allUrls = [...STATIC_URLS, ...eventUrls]

console.log(`\n📡  IndexNow bulk submission`)
console.log(`    Static pages : ${STATIC_URLS.length}`)
console.log(`    Event pages  : ${eventUrls.length}`)
console.log(`    Total        : ${allUrls.length} URLs`)
if (isDryRun) { console.log('\n[dry-run] No submission made.'); process.exit(0) }

// ── Submit in 500-URL chunks ──────────────────────────────────────────────────
const CHUNK = 500
let submitted = 0

for (let i = 0; i < allUrls.length; i += CHUNK) {
  const chunk = allUrls.slice(i, i + CHUNK)
  const res = await fetch(`https://${INDEXNOW_HOST}/indexnow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'abqunplugged.com',
      key:  INDEXNOW_KEY,
      keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
      urlList: chunk,
    }),
  })
  submitted += chunk.length
  const ok = res.ok || res.status === 202
  console.log(`  Batch ${Math.ceil((i + 1) / CHUNK)}/${Math.ceil(allUrls.length / CHUNK)}: ${chunk.length} URLs → HTTP ${res.status} ${ok ? '✅' : '⚠️'}`)
  if (!ok) console.log(`    Body: ${await res.text()}`)
}

console.log(`\n✅  Submitted ${submitted} URLs to IndexNow (${INDEXNOW_HOST})`)
console.log(`    Bing + Yandex will crawl these within hours.`)
console.log(`    Google picks up Bing's crawl signals within days.\n`)
