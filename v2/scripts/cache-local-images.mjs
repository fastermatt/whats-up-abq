#!/usr/bin/env node
/**
 * Cache third-party event images to Cloudflare R2.
 *
 * Many local/volunteer events have `cached_photo_url` pointing at abqtodo.com,
 * nhccnm.org, lovenm.org, etc. Those URLs can 404 as hosts archive old posts.
 * This script:
 *   1. Fetches each third-party image URL (with timeout)
 *   2. Uploads the bytes to our R2 bucket `abq-unplugged-images`
 *   3. Updates `cached_photo_url` → `https://cdn.abqunplugged.com/{id}.{ext}`
 *
 * Skips events already pointing at cdn.abqunplugged.com or img.evbuc.com.
 * Safe to re-run — already-cached events are skipped.
 *
 * Usage:
 *   node scripts/cache-local-images.mjs [--dry-run] [--source=local] [--limit=50]
 *
 * Requires in scripts/.env (or environment):
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCESS_KEY_ID      — from Cloudflare dashboard → R2 → Manage R2 API Tokens
 *   R2_SECRET_ACCESS_KEY  — same
 *   R2_ACCOUNT_ID         — Cloudflare account ID (right sidebar on dashboard)
 *
 * R2 bucket : abq-unplugged-images
 * CDN       : https://pub-9b12296957cd4149ac1833b591cdc0ff.r2.dev
 *             (r2.dev public URL — enabled 2026-04-19 via Cloudflare managed domains API)
 *             Optional vanity: add CNAME cdn.abqunplugged.com → pub-9b12296957cd4149ac1833b591cdc0ff.r2.dev in GoDaddy
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
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
const R2_ACCESS_KEY   = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
const R2_SECRET_KEY   = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
const R2_ACCOUNT_ID   = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID
const R2_BUCKET       = 'abq-unplugged-images'
const CDN_BASE        = 'https://pub-9b12296957cd4149ac1833b591cdc0ff.r2.dev'
// Note: cdn.abqunplugged.com is not yet configured in GoDaddy DNS.
// Using r2.dev public URL (enabled 2026-04-19). Optional: add CNAME in GoDaddy for vanity URL.

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set.')
  process.exit(1)
}
if (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ACCOUNT_ID) {
  console.error(`
❌ R2 credentials missing. Add to scripts/.env:

  R2_ACCESS_KEY_ID=<from Cloudflare → R2 → Manage R2 API Tokens>
  R2_SECRET_ACCESS_KEY=<same token>
  R2_ACCOUNT_ID=<Cloudflare account ID — top-right of dashboard>

Then re-run this script.
`.trim())
  process.exit(1)
}

const isDryRun  = process.argv.includes('--dry-run')
const sourceArg = process.argv.find(a => a.startsWith('--source='))
const sources   = sourceArg ? [sourceArg.split('=')[1]] : ['local', 'volunteer', 'nhcc']
const limitArg  = process.argv.find(a => a.startsWith('--limit='))
const limit     = limitArg ? parseInt(limitArg.split('=')[1], 10) : 500

const USER_AGENT = 'Mozilla/5.0 (compatible; ABQUnplugged-ImageCache/1.0)'

// ── R2 client ─────────────────────────────────────────────────────────────────
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
})

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Domains we never need to re-cache */
function isAlreadyCached(url) {
  if (!url) return false
  return (
    url.includes('cdn.abqunplugged.com') ||
    url.includes('pub-9b12296957cd4149ac1833b591cdc0ff.r2.dev') ||
    url.includes('img.evbuc.com') ||
    url.includes('cdn.evbuc.com') ||
    url.includes('s1.ticketm.net') ||
    url.includes('media.ticketmaster') ||
    url.includes('cdn.midjourney.com') ||
    url.includes('seatgeek.com') ||
    url.includes('sgassets') ||
    url.includes('supabase.co/storage') // old Supabase storage fallback
  )
}

function extFromUrl(url, contentType) {
  // Prefer content-type header
  if (contentType?.includes('png'))  return 'png'
  if (contentType?.includes('gif'))  return 'gif'
  if (contentType?.includes('webp')) return 'webp'
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg'
  // Fallback: extract from URL path
  const m = url.split('?')[0].match(/\.(png|jpg|jpeg|webp|gif)$/i)
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
}

async function alreadyInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

async function fetchImage(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const contentType = resp.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) throw new Error(`Not an image: ${contentType}`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  return { buffer, contentType }
}

async function uploadToR2(key, buffer, contentType) {
  await r2.send(new PutObjectCommand({
    Bucket:      R2_BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🖼️  Caching third-party event images to R2`)
  console.log(`   Sources : ${sources.join(', ')}`)
  console.log(`   Limit   : ${limit}`)
  if (isDryRun) console.log('   DRY RUN — no writes\n')

  const today = new Date().toISOString().slice(0, 10)

  // Fetch events that need caching
  const { data: events, error } = await supabase
    .schema('public')
    .from('events')
    .select('id, source, category, cached_photo_url')
    .in('source', sources)
    .gte('event_date', today)
    .not('cached_photo_url', 'is', null)
    .order('event_date', { ascending: true })

  if (error) { console.error('DB error:', error.message); process.exit(1) }

  // Filter to only events that need caching
  const toCache = (events ?? [])
    .filter(e => !isAlreadyCached(e.cached_photo_url))
    .slice(0, limit)

  console.log(`Found ${events?.length ?? 0} events with photo_url, ${toCache.length} need caching\n`)

  let cached = 0, skipped = 0, failed = 0

  for (let i = 0; i < toCache.length; i++) {
    const { id, source, category, cached_photo_url } = toCache[i]
    const short = id.length > 30 ? id.slice(0, 30) + '…' : id
    process.stdout.write(`  [${i + 1}/${toCache.length}] ${short} … `)

    let buffer, contentType
    try {
      const result = await fetchImage(cached_photo_url)
      buffer = result.buffer
      contentType = result.contentType
    } catch (err) {
      // URL is dead — null out cached_photo_url so EventCard uses MJ fallback immediately
      console.log(`❌ fetch failed (${err.message.slice(0, 40)})`)
      if (!isDryRun) {
        await supabase.schema('public').from('events')
          .update({ cached_photo_url: null })
          .eq('id', id)
        console.log(`     → nulled cached_photo_url (will use ${category ?? 'default'} MJ fallback)`)
      }
      failed++
      continue
    }

    const ext = extFromUrl(cached_photo_url, contentType)
    const key = `${id}.${ext}`

    if (isDryRun) {
      console.log(`✅ [DRY] would upload ${key} (${Math.round(buffer.byteLength / 1024)}KB)`)
      cached++
      continue
    }

    // Skip if already in R2 (idempotent)
    const exists = await alreadyInR2(key)
    if (exists) {
      // Just update DB to point at CDN
      const cdnUrl = `${CDN_BASE}/${key}`
      await supabase.schema('public').from('events')
        .update({ cached_photo_url: cdnUrl })
        .eq('id', id)
      console.log(`⏭  already in R2 → updated DB`)
      skipped++
      continue
    }

    try {
      await uploadToR2(key, buffer, contentType)
      const cdnUrl = `${CDN_BASE}/${key}`
      await supabase.schema('public').from('events')
        .update({ cached_photo_url: cdnUrl })
        .eq('id', id)
      console.log(`✅ uploaded ${Math.round(buffer.byteLength / 1024)}KB → ${cdnUrl}`)
      cached++
    } catch (err) {
      console.log(`❌ R2 upload failed: ${err.message.slice(0, 60)}`)
      failed++
    }

    // Polite delay
    if ((i + 1) % 20 === 0) await new Promise(r => setTimeout(r, 500))
    else await new Promise(r => setTimeout(r, 80))
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Image cache complete
   Cached  : ${cached}
   Skipped : ${skipped} (already in R2)
   Failed  : ${failed} (URL dead — cached_photo_url nulled)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
