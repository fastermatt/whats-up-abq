#!/usr/bin/env node
/**
 * Backfill OG images for abqtodo/do505 events that have generic placeholder images.
 *
 * The WordPress Events API often returns a generic "banner.jpg" or site-level
 * thumbnail as the "featured image" for events that don't have their own photo.
 * This script fetches the actual event page URL (stored in raw.url) and extracts
 * the og:image meta tag — which is always the most visually appropriate image
 * since it's what appears when the event is shared on social media.
 *
 * Usage:
 *   node scripts/backfill-og-images.mjs [--dry-run] [--source=local] [--limit=50] [--all]
 *
 * --all : re-fetch OG images even for events that already have a non-generic image
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in scripts/.env
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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set'); process.exit(1) }

const isDryRun  = process.argv.includes('--dry-run')
const doAll     = process.argv.includes('--all')
const sourceArg = process.argv.find(a => a.startsWith('--source='))
const sources   = sourceArg ? [sourceArg.split('=')[1]] : ['local']
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const limit     = limitArg ? parseInt(limitArg.split('=')[1], 10) : 200

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Generic filenames that come from WP API as site-level assets, not event photos
const GENERIC_PATTERNS = [
  'banner', 'default', 'placeholder', 'logo', 'header', 'thumbnail',
  'featured-image', 'no-image', 'noimage', 'event-default',
]
function isGeneric(url) {
  if (!url) return true
  const filename = url.toLowerCase().split('?')[0].split('/').pop() ?? ''
  return GENERIC_PATTERNS.some(p => filename.includes(p))
}

async function fetchOgImage(pageUrl) {
  try {
    const resp = await fetch(pageUrl, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })
    if (!resp.ok) return null
    const body = await resp.text()
    // Try og:image in both attribute orderings, then twitter:image fallback
    const m = body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
           || body.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
           || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)
    const imgUrl = m?.[1] ?? null
    if (!imgUrl || imgUrl.includes('1x1') || imgUrl.includes('placeholder')) return null
    return imgUrl
  } catch {
    return null
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  console.log(`🖼️  Backfilling OG images for ${sources.join(', ')} events`)
  console.log(`   Limit: ${limit} | All: ${doAll} | Dry run: ${isDryRun}\n`)

  const today = new Date().toISOString().slice(0, 10)

  const { data: events, error } = await supabase
    .schema('public')
    .from('events')
    .select('id, cached_photo_url, raw')
    .in('source', sources)
    .gte('event_date', today)
    .not('raw->url', 'is', null)
    .order('event_date', { ascending: true })

  if (error) { console.error('DB error:', error.message); process.exit(1) }

  // Filter to events that need OG image: missing photo OR generic placeholder
  const toProcess = (events ?? [])
    .filter(e => {
      if (doAll) return true
      return !e.cached_photo_url || isGeneric(e.cached_photo_url)
    })
    .slice(0, limit)

  const totalEvents = events?.length ?? 0
  console.log(`Found ${totalEvents} events | ${toProcess.length} need OG image fetch\n`)

  let updated = 0, skipped = 0, failed = 0

  for (let i = 0; i < toProcess.length; i++) {
    const { id, cached_photo_url, raw } = toProcess[i]
    const pageUrl = raw?.url
    if (!pageUrl) { skipped++; continue }

    const short = id.length > 35 ? id.slice(0, 35) + '…' : id
    process.stdout.write(`  [${i + 1}/${toProcess.length}] ${short} … `)

    const ogImg = await fetchOgImage(pageUrl)

    if (!ogImg) {
      console.log(`⚠️  no OG image (kept: ${cached_photo_url?.split('/').pop()?.slice(0, 30) ?? 'null'})`)
      failed++
    } else if (ogImg === cached_photo_url) {
      console.log(`⏭  same as current`)
      skipped++
    } else {
      console.log(`✅ ${ogImg.split('/').pop()?.slice(0, 60)}`)
      if (!isDryRun) {
        const { error: upErr } = await supabase
          .schema('public').from('events')
          .update({ cached_photo_url: ogImg })
          .eq('id', id)
        if (upErr) console.error(`     ❌ update failed: ${upErr.message}`)
        else updated++
      } else {
        updated++
      }
    }

    // Polite delay — event pages have anti-bot protection
    await new Promise(r => setTimeout(r, i % 5 === 4 ? 800 : 200))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ OG image backfill complete
   Updated : ${updated}
   Skipped : ${skipped}
   No OG   : ${failed}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
