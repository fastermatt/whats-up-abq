#!/usr/bin/env node
/**
 * ABQ Unplugged — Place Photo Fetcher
 * =====================================
 *
 * For each curated "Things To Do" place that doesn't already have a real photo,
 * this script:
 *   1. Fetches the place's own website
 *   2. Extracts the og:image (the venue's own best photo)
 *   3. Downloads, validates, and resizes to 1080px webp
 *   4. Uploads to Supabase Storage at place-photos/{id}.webp
 *   5. Prints the image: URL to copy-paste into data/places.ts
 *
 * WHY og:image?
 *   It's the photo the venue chose to represent themselves on social media.
 *   Completely free, no API key, no billing risk — uses their own content.
 *
 * RULES:
 *   - ONLY uses the venue's own og:image — never Pixabay, never stock photos
 *   - Places with an existing Wikimedia image are SKIPPED (use --force to override)
 *   - If og:image is missing or the download fails: prints "no photo" — gradient stays
 *   - Validates: is an image, width ≥ 400px, size > 5KB
 *
 * USAGE:
 *   node scripts/fetch-place-photos.mjs              # fetch all without a photo
 *   node scripts/fetch-place-photos.mjs --dry-run    # show plan, no writes
 *   node scripts/fetch-place-photos.mjs --force      # re-fetch even places with images
 *   node scripts/fetch-place-photos.mjs --id=marble-brewery  # single place
 */

import { createClient } from '@supabase/supabase-js'
import { load as cheerioLoad } from 'cheerio'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

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
const STORAGE_HOST = new URL(SUPABASE_URL).host

// ── CLI ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag  = n => argv.includes(`--${n}`)
const value = n => { const p = argv.find(a => a.startsWith(`--${n}=`)); return p ? p.split('=')[1] : null }

const DRY   = flag('dry-run')
const FORCE = flag('force')
const ONLY  = value('id')

// ── Config ─────────────────────────────────────────────────────────────────

const BUCKET       = 'place-photos'
const TARGET_WIDTH = 1080
const WEBP_QUALITY = 85
const MIN_WIDTH    = 400   // reject anything smaller — would look bad on cards
const MIN_BYTES    = 5_000 // reject tiny placeholder images

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// ── Places data ────────────────────────────────────────────────────────────
// Inline copy of id + website + hasExistingImage so we don't need to compile TS.
// UPDATE THIS when you add new places to data/places.ts.

const PLACES = [
  // OUTDOORS — public/government venues only
  { id: 'petroglyph-national-monument', website: 'https://www.nps.gov/petr',                                                           hasImage: true },
  { id: 'rio-grande-nature-center',     website: 'https://www.rgnc.org',                                                               hasImage: true },
  { id: 'paseo-del-bosque-trail',       website: 'https://www.cabq.gov/parksandrecreation/parks/paseo-del-bosque-trail',               hasImage: false, directUrl: 'https://live.staticflickr.com/3092/2590992660_a3341a78c6_b.jpg' },
  { id: 'elena-gallegos-open-space',    website: 'https://www.cabq.gov/parksandrecreation/open-space/lands/elena-gallegos-open-space', hasImage: false, directUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Kiwanis_shelter_at_Elena_Gallegos_Open_Space_2.jpg' },
  { id: 'tingley-beach',               website: 'https://www.cabq.gov/culturalservices/biopark/tingley-beach',                        hasImage: true },
  { id: 'garfield-skate-park',         website: 'https://www.cabq.gov/parksandrecreation/parks/garfield-park',                        hasImage: false },
  { id: 'alamosa-skate-park',          website: 'https://www.cabq.gov/parksandrecreation',                                            hasImage: false },
  { id: 'manzano-mesa-skate-park',     website: 'https://www.cabq.gov/parksandrecreation',                                            hasImage: false },
  { id: 'rio-grande-pool',             website: 'https://www.cabq.gov/parksandrecreation/recreation-centers/pools',                   hasImage: false },
  { id: 'los-altos-pool',              website: 'https://www.cabq.gov/parksandrecreation/recreation-centers/pools',                   hasImage: false },
  { id: 'west-mesa-aquatic-center',    website: 'https://www.cabq.gov/parksandrecreation/recreation-centers/west-mesa-community-center', hasImage: false },
  { id: 'bosque-trail',                website: 'https://www.cabq.gov/parksandrecreation/open-space',                                 hasImage: true },
  // ARTS & CULTURE
  { id: 'albuquerque-museum',          website: 'https://www.albuquerquemuseum.org',                                                  hasImage: true },
  { id: 'national-hispanic-cultural-center', website: 'https://www.nhccnm.org',                                                      hasImage: true },
  { id: 'kimo-theatre',                website: 'https://www.cabq.gov/kimo',                                                          hasImage: true },
  { id: 'popejoy-hall',                website: 'https://www.popejoypresents.com',                                                    hasImage: true },
  // FAMILY
  { id: 'albuquerque-biopark-zoo',     website: 'https://www.cabq.gov/culturalservices/biopark/zoo',                                  hasImage: true },
  { id: 'abq-aquarium',                website: 'https://www.cabq.gov/culturalservices/biopark/aquarium',                             hasImage: true },
  { id: 'abq-botanic-garden',          website: 'https://www.cabq.gov/culturalservices/biopark/botanic-garden',                      hasImage: false, directUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Albuquerque_Biological_Park_BioPark.jpg' },
  { id: 'nm-museum-natural-history',   website: 'https://nmnaturalhistory.org',                                                      hasImage: false, directUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/27/New_Mexico_Museum_of_Natural_History_front.JPG' },
  { id: 'balloon-museum',              website: 'https://www.balloonmuseum.com',                                                     hasImage: true },
  // HISTORY
  { id: 'old-town-albuquerque',        website: 'https://albuquerqueoldtown.com',                                                    hasImage: false, directUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Albuquerque_Old_Town_Plaza_in_2008.jpg' },
  { id: 'route-66',                    website: 'https://www.rt66nm.org',                                                            hasImage: false, directUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/La_Puerta_Lodge%2C_Albuquerque_NM.jpg' },
  // PARKS
  { id: 'balloon-fiesta-park',         website: 'https://www.cabq.gov/parksandrecreation/parks/balloon-fiesta-park',                      hasImage: false, directUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Albuquerque_Sunset_at_Balloon_Fiesta_Park.jpg' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchWithRedirects(url, options = {}, maxRedirects = 5) {
  let current = url
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, { ...options, redirect: 'manual' })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const loc = res.headers.get('location')
      current = loc.startsWith('http') ? loc : new URL(loc, current).href
      continue
    }
    return res
  }
  throw new Error(`Too many redirects for ${url}`)
}

async function extractOgImage(url) {
  const res = await fetchWithRedirects(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)

  const html = await res.text()
  const $ = cheerioLoad(html)

  // Priority order: og:image > twitter:image > first large img
  const ogImage     = $('meta[property="og:image"]').attr('content')
  const twitterImg  = $('meta[name="twitter:image"]').attr('content')

  let src = ogImage || twitterImg
  if (!src) return null

  // Resolve relative URLs
  if (!src.startsWith('http')) {
    src = new URL(src, url).href
  }

  return src
}

async function downloadImage(imgUrl, timeoutMs = 20_000) {
  const res = await fetchWithRedirects(imgUrl, {
    headers: {
      'User-Agent': UA,
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': new URL(imgUrl).origin + '/',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) throw new Error(`Image download HTTP ${res.status}`)

  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('image') && !ct.includes('octet')) {
    throw new Error(`Not an image: content-type=${ct}`)
  }

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < MIN_BYTES) throw new Error(`Too small: ${buf.length} bytes (min ${MIN_BYTES})`)
  return buf
}

async function processImage(buf) {
  const meta = await sharp(buf).metadata()
  if ((meta.width || 0) < MIN_WIDTH) {
    throw new Error(`Too narrow: ${meta.width}px (min ${MIN_WIDTH})`)
  }

  // Resize to 1080px wide (upscale small images, downscale large ones)
  const resized = await sharp(buf)
    .resize(TARGET_WIDTH, null, {
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  return resized
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some(b => b.name === BUCKET)
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (error) throw new Error(`Failed to create bucket: ${error.message}`)
    console.log(`  📦 Created storage bucket "${BUCKET}"`)
  }
}

async function uploadToStorage(id, webpBuf) {
  const filename = `${id}.webp`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, webpBuf, {
      contentType: 'image/webp',
      upsert: true,
    })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return `https://${STORAGE_HOST}/storage/v1/object/public/${BUCKET}/${filename}`
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏙️  ABQ Unplugged — Place Photo Fetcher')
  console.log('========================================')
  if (DRY) console.log('  (dry run — no writes)')
  console.log()

  // Filter to places we should process
  let queue = PLACES.filter(p => {
    if (ONLY) return p.id === ONLY
    if (FORCE) return true
    // Places with a directUrl (Wikimedia) need migrating to our storage
    if (p.directUrl) return true
    // Skip places already hosted (og:image was already fetched)
    if (p.hasImage) return false
    return true
  })

  if (queue.length === 0) {
    console.log('Nothing to do — all places already have images.')
    console.log('Use --force to re-fetch existing images.')
    return
  }

  console.log(`Processing ${queue.length} place(s)...\n`)

  if (!DRY) await ensureBucket()

  const results = { ok: [], failed: [], skipped: [] }

  for (const place of queue) {
    process.stdout.write(`  🔍 ${place.id}`)

    try {
      // Step 1: Get image URL — use directUrl if provided, else scrape og:image
      let imgUrl = place.directUrl || null
      if (imgUrl) {
        process.stdout.write(` → using direct URL`)
      } else {
        imgUrl = await extractOgImage(place.website)
        if (!imgUrl) {
          results.skipped.push({ id: place.id, reason: 'no og:image found' })
          console.log(` → ⬜ no og:image`)
          continue
        }
        process.stdout.write(` → found og:image`)
      }

      if (DRY) {
        results.ok.push({ id: place.id, url: '(dry run)', ogUrl: imgUrl })
        console.log(` ✓ (dry run)`)
        continue
      }

      // Step 2: Download
      const rawBuf = await downloadImage(imgUrl)
      process.stdout.write(` → downloaded ${(rawBuf.length / 1024).toFixed(0)}KB`)

      // Step 3: Process with sharp
      const webpBuf = await processImage(rawBuf)
      process.stdout.write(` → ${(webpBuf.length / 1024).toFixed(0)}KB webp`)

      // Step 4: Upload
      const cdnUrl = await uploadToStorage(place.id, webpBuf)
      results.ok.push({ id: place.id, url: cdnUrl, ogUrl: imgUrl })
      console.log(` → ✅ uploaded`)

    } catch (err) {
      results.failed.push({ id: place.id, reason: err.message })
      console.log(` → ❌ ${err.message}`)
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log('\n========================================')
  console.log(`✅ ${results.ok.length} uploaded  ⬜ ${results.skipped.length} skipped  ❌ ${results.failed.length} failed`)

  if (results.ok.length > 0 && !DRY) {
    console.log('\n── Paste these image: lines into data/places.ts ──')
    console.log('(find each place by id, add/replace the image: field)\n')
    for (const r of results.ok) {
      console.log(`  // ${r.id}`)
      console.log(`  image: '${r.url}',`)
      console.log()
    }
  }

  if (results.failed.length > 0) {
    console.log('\n── Failed (gradient fallback will be used) ──')
    for (const f of results.failed) {
      console.log(`  ${f.id}: ${f.reason}`)
    }
  }

  if (results.skipped.length > 0) {
    console.log('\n── Skipped (no og:image on their website) ──')
    for (const s of results.skipped) {
      console.log(`  ${s.id}`)
    }
  }
}

main().catch(err => {
  console.error('\n💥 Fatal:', err)
  process.exit(1)
})
