#!/usr/bin/env node
/**
 * ABQ Unplugged — Image Self-Hosting
 * ==================================
 *
 * Downloads every event's image from its original source and uploads it to
 * Supabase Storage under a stable filename. Then rewrites `cached_photo_url`
 * to point at our Supabase URL.
 *
 * WHY:
 *   Third-party sources (Ticketmaster, SeatGeek, Eventbrite, lovenm.org, etc.)
 *   change content at URLs without notice. Our CDN caches go stale. Images
 *   silently swap for the wrong content (the Nuevo-Teatro / Maddox-Batson
 *   issue). The only permanent fix: OWN the bytes. Once the image is at
 *   supabase.co/…/{event_id}.webp, nothing external can change it.
 *
 * RULES:
 *   - image_status='rejected' events are SKIPPED (keep NULL cached_photo_url)
 *   - image_status='verified' events are SKIPPED (already confirmed good, don't
 *     re-download unless --force)
 *   - Only downloads if cached_photo_url is NOT already a supabase.co URL
 *     (i.e., only rehosts external URLs)
 *   - Validates content, dimensions, and known placeholder hashes
 *   - Never upscales a small source into a larger blurry file
 *   - Content-hashed filenames reuse unchanged images
 *   - Superseded managed objects are removed after the DB update succeeds
 *
 * USAGE:
 *   node scripts/host-event-images.mjs                   # rehost all unhosted
 *   node scripts/host-event-images.mjs --limit=50        # batch size
 *   node scripts/host-event-images.mjs --dry-run         # show plan, no writes
 *   node scripts/host-event-images.mjs --force           # re-download even verified
 *   node scripts/host-event-images.mjs --only=ticketmaster
 *
 * EXIT CODES:
 *   0 — all images processed (some may have failed validation → set to NULL)
 *   1 — at least one hard error (supabase unreachable, storage auth fail)
 */

import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import {
  imageMetadata,
  prepareEventImage,
  removeSupersededImage,
  uploadPreparedImage,
} from './lib/event-image-pipeline.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Load env ───────────────────────────────────────────────────────────────

for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env.local'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ── CLI ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag  = (n) => argv.includes(`--${n}`)
const value = (n) => { const p = argv.find(a => a.startsWith(`--${n}=`)); return p ? p.split('=')[1] : null }

const DRY   = flag('dry-run')
const FORCE = flag('force')
const LIMIT = parseInt(value('limit') || '100', 10)
const ONLY  = value('only')

const BUCKET = 'event-photos'
const STORAGE_HOST = new URL(SUPABASE_URL).host  // e.g. bsmvfutebmbkjvlrhiyq.supabase.co

// Two UA strategies. The chrome-like UA works for most sources but abqtodo's
// Cloudflare rules specifically whitelist the cache-local-images UA string
// (confirmed working in production for 167 abqtodo images on R2).
const UA_BOT_FRIENDLY = 'Mozilla/5.0 (compatible; ABQUnplugged-ImageCache/1.0)'
const UA_CHROME       = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function pickUserAgent(host) {
  // abqtodo, nhccnm, lovenm — bot UA is whitelisted
  if (/abqtodo\.com|nhccnm\.org|lovenm\.org|do505\.com/.test(host)) return UA_BOT_FRIENDLY
  // Everything else (TM, SG, EB, etc.) — chrome UA
  return UA_CHROME
}

const FETCH_HEADERS_BY_HOST = (host) => ({
  'User-Agent': pickUserAgent(host),
  'Referer': `https://${host}/`,
  'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
})

// ── Helpers ────────────────────────────────────────────────────────────────

// CAPTCHA-blocked hosts: abqtodo.com, nhccnm.org, lovenm.org, do505.com all
// return a 400×304 WordPress placeholder JPEG instead of the actual image
// when fetched without a browser session — confirmed 2026-04-19 via production
// proxy. These sources are served from our existing R2 cache (167 events
// cached previously) OR fall back to category images. DO NOT try to self-host
// — multiple events would end up pointing to the same placeholder image and
// look identical on the site, which is worse than the fallback.
const CAPTCHA_HOSTS = /abqtodo\.com|nhccnm\.org|lovenm\.org|do505\.com/

// Known placeholder/error image hashes. If the download matches one of these,
// the source served garbage — skip writing to DB. Extend when new placeholders
// are spotted (multiple distinct source URLs returning identical bytes).
const PLACEHOLDER_HASHES = new Set([
  'e9bd5d127ea719b6e5a2a1384173123c',  // abqtodo 400x304 WP error placeholder
  '336632ccecb6e1590bdebb49771d9f53',  // SG 280x210 cartoon redhead-with-guitar
                                       // placeholder. Served byte-identical for
                                       // performers lacking real art (Letdown,
                                       // Crane Wives, ADULT., Cheekface, etc.)
])

async function sha256First(buffer) {
  // Return MD5 of first 1KB — fast dedup signature
  const crypto = await import('crypto')
  return crypto.default.createHash('md5').update(buffer.slice(0, 1024)).digest('hex')
}

async function downloadImage(url, timeoutMs = 20000) {
  const host = new URL(url).host

  if (CAPTCHA_HOSTS.test(host)) {
    return { ok: false, reason: 'captcha-host-skipped' }
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS_BY_HOST(host),
      signal: ctrl.signal,
      redirect: 'follow',
    })
    clearTimeout(t)

    if (!res.ok) return { ok: false, reason: `http-${res.status}` }
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) return { ok: false, reason: `not-image: ${ct}` }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 2000)     return { ok: false, reason: `too-small: ${buf.length}B` }
    if (buf.length > 20_000_000) return { ok: false, reason: `too-large: ${buf.length}B` }

    // Placeholder detection: hash the first 1KB and compare against known bad
    const hash = await sha256First(buf)
    if (PLACEHOLDER_HASHES.has(hash)) {
      return { ok: false, reason: `placeholder-match: ${hash.slice(0, 8)}` }
    }

    return { ok: true, buffer: buf, contentType: ct }
  } catch (e) {
    clearTimeout(t)
    return { ok: false, reason: e.message.slice(0, 100) }
  }
}

// Extract the "best" (= highest-resolution non-fallback) source image URL.
// Critical: TM returns ~10 variants per event; picking the first 16:9 gets us
// a 640×360 thumbnail when 2048×1152 is available. We want the biggest one we
// can find so sharp has something to downscale (not upscale) to 1080px.
function extractSourceImageUrl(row) {
  const r = row.raw || {}

  // TM / SG / BIT: raw.images[] array with multiple sizes
  if (Array.isArray(r.images) && r.images.length > 0) {
    const withPixels = r.images
      .filter(i => i && typeof i.url === 'string' && i.url.startsWith('http'))
      .map(i => ({
        url: i.url,
        width: Number(i.width) || 0,
        height: Number(i.height) || 0,
        isFallback: i.fallback === true || i.fallback === 'true',
        ratio: i.ratio,
      }))

    if (withPixels.length > 0) {
      // Prefer non-fallback, prefer 16_9 aspect, prefer largest total pixels
      withPixels.sort((a, b) => {
        if (a.isFallback !== b.isFallback) return a.isFallback ? 1 : -1  // real first
        const aPx = a.width * a.height
        const bPx = b.width * b.height
        if (bPx !== aPx) return bPx - aPx  // larger first
        return 0
      })
      // If every image is a TM fallback placeholder, there's no real artwork —
      // return null so the event gets no cached_photo_url rather than a generic image.
      if (withPixels[0].isFallback) return null
      return withPixels[0].url
    }
  }

  // Eventbrite: raw.logo.url
  if (r.logo?.url && typeof r.logo.url === 'string' && r.logo.url.startsWith('http')) return r.logo.url

  // Local/volunteer/NHCC/lovenm: raw.image (string)
  if (typeof r.image === 'string' && r.image.startsWith('http')) return r.image

  // Last resort: whatever's in cached_photo_url if it's external http
  if (row.cached_photo_url && row.cached_photo_url.startsWith('http')
      && !row.cached_photo_url.includes(STORAGE_HOST)) {
    return row.cached_photo_url
  }
  return null
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`📸 host-event-images — DRY=${DRY} FORCE=${FORCE} LIMIT=${LIMIT} ONLY=${ONLY ?? 'all'}`)

  // Fetch candidates: upcoming, not hidden, not rejected, with an external URL
  let q = supabase
    .schema('public').from('events')
    .select('id, source, raw, cached_photo_url, image_status, event_date, image_hash')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true })
    .limit(LIMIT)

  if (ONLY) q = q.eq('source', ONLY)

  const { data: rows, error } = await q
  if (error) { console.error('❌ DB query:', error.message); process.exit(1) }

  console.log(`   Found ${rows.length} candidate events\n`)

  const stats = {
    skippedRejected: 0, skippedVerified: 0, skippedAlreadyHosted: 0, skippedNoSource: 0,
    downloaded: 0, uploaded: 0, failed: 0, dryrun: 0,
  }
  const failures = []

  for (const row of rows) {
    const { id, image_status, cached_photo_url } = row

    if (image_status === 'rejected') {
      stats.skippedRejected++
      continue
    }
    if (image_status === 'verified' && !FORCE) {
      stats.skippedVerified++
      continue
    }
    if (cached_photo_url && cached_photo_url.includes(STORAGE_HOST) && !FORCE) {
      stats.skippedAlreadyHosted++
      continue
    }

    const sourceUrl = extractSourceImageUrl(row)
    if (!sourceUrl) {
      stats.skippedNoSource++
      continue
    }

    console.log(`→ [${row.source}] ${id}`)
    console.log(`  source: ${sourceUrl.slice(0, 100)}`)

    if (DRY) {
      stats.dryrun++
      console.log('  (dry-run — not downloading)\n')
      continue
    }

    const dl = await downloadImage(sourceUrl)
    if (!dl.ok) {
      console.log(`  ✗ download failed: ${dl.reason}`)
      failures.push({ id, step: 'download', reason: dl.reason, sourceUrl })
      stats.failed++

      // If the source served a known-bad placeholder (blacklisted MD5),
      // reject the event's image_status so we stop trying on every re-run
      // and the event falls back to its category image sitewide.
      if (dl.reason && dl.reason.startsWith('placeholder-match')) {
        const { error: rejErr } = await supabase
          .schema('public').from('events')
          .update({ image_status: 'rejected' })
          .eq('id', id)
        if (!rejErr) console.log(`  🚫 auto-rejected (placeholder source) — fallback to category image`)
      }
      continue
    }
    stats.downloaded++

    const opt = await prepareEventImage(dl.buffer)
    if (!opt.ok) {
      console.log(`  ✗ optimize failed: ${opt.reason}`)
      failures.push({ id, step: 'optimize', reason: opt.reason })
      stats.failed++
      if (opt.quality === 'rejected') {
        const { error: rejectError } = await supabase
          .schema('public').from('events')
          .update({
            cached_photo_url: null,
            image_status: 'rejected',
            image_width: opt.width ?? null,
            image_height: opt.height ?? null,
            image_quality: 'rejected',
          })
          .eq('id', id)
        if (!rejectError) console.log('  🚫 source is too small for the site — using category fallback')
      }
      continue
    }
    const compressionRatio = (dl.buffer.length / opt.outSize).toFixed(1)
    const sizeChange = `${opt.srcW}×${opt.srcH} → ${opt.outW}×${opt.outH}, ${compressionRatio}× smaller, ${opt.quality}`
    console.log(`  ↓ ${dl.buffer.length}B → ${opt.outSize}B (${sizeChange})`)

    const up = await uploadPreparedImage(supabase, id, opt, BUCKET)
    if (!up.ok) {
      console.log(`  ✗ upload failed: ${up.reason}`)
      failures.push({ id, step: 'upload', reason: up.reason })
      stats.failed++
      continue
    }
    stats.uploaded++
    console.log(`  ↑ ${up.url.replace(SUPABASE_URL, '…')}`)

    // ONLY update cached_photo_url — leave raw alone. If the hosted image is
    // ever deleted or Supabase goes down, normalizeRow can still fall back to
    // raw.image or raw.images[0].url (the original source URL).
    // Hosting proves availability and resolution, not that the photo matches.
    // Preserve a human verification on --force; automatic images stay unverified.
    const { error: updErr } = await supabase
      .schema('public').from('events')
      .update({
        cached_photo_url: up.url,
        image_status: image_status === 'verified' ? 'verified' : 'unverified',
        ...imageMetadata(opt),
      })
      .eq('id', id)

    if (updErr) {
      console.log(`  ✗ DB update failed: ${updErr.message}`)
      failures.push({ id, step: 'db-update', reason: updErr.message })
      stats.failed++
    } else {
      console.log(`  ✓ hosted and linked`)
      const cleanup = await removeSupersededImage({
        supabase,
        previousUrl: cached_photo_url,
        nextUrl: up.url,
        supabaseUrl: SUPABASE_URL,
        bucket: BUCKET,
      })
      if (cleanup.removed) console.log(`  🧹 removed superseded object: ${cleanup.key}`)
    }
    console.log('')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ host-event-images complete')
  console.log(`   Already-hosted skipped : ${stats.skippedAlreadyHosted}`)
  console.log(`   Rejected skipped       : ${stats.skippedRejected}`)
  console.log(`   Verified skipped       : ${stats.skippedVerified}`)
  console.log(`   No source URL          : ${stats.skippedNoSource}`)
  console.log(`   Downloaded             : ${stats.downloaded}`)
  console.log(`   Uploaded               : ${stats.uploaded}`)
  console.log(`   Failed                 : ${stats.failed}`)
  console.log(`   Dry-run plans          : ${stats.dryrun}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (failures.length > 0) {
    console.log('\nFailures (download or upload):')
    failures.slice(0, 20).forEach(f => console.log(`  [${f.step}] ${f.id} — ${f.reason}`))
  }

  process.exit(0)
}

main().catch(err => { console.error('CRASH:', err.stack || err); process.exit(1) })
