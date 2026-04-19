#!/usr/bin/env node
/**
 * Fetch curated Pixabay photos as event fallback images.
 *
 * For each event category, this script:
 *   1. Searches Pixabay for real photographs (not AI illustrations)
 *   2. Downloads the best 5–8 results per category
 *   3. Uploads them to R2 at fallbacks/pixabay/{category}/{n}.jpg
 *   4. Prints a TypeScript snippet for fallback-images.ts
 *
 * Pixabay API parameters used to avoid AI slop:
 *   image_type=photo      — real photographs only (not illustrations/vectors)
 *   order=popular         — community-validated quality, not newest junk
 *   orientation=horizontal — landscape, better for event cards
 *   min_width=1000        — minimum quality width
 *   safesearch=true       — family-safe content
 *
 * Usage:
 *   PIXABAY_API_KEY=your_key node scripts/fetch-pixabay-fallbacks.mjs
 *   PIXABAY_API_KEY=your_key node scripts/fetch-pixabay-fallbacks.mjs --dry-run
 *   PIXABAY_API_KEY=your_key node scripts/fetch-pixabay-fallbacks.mjs --category=music
 *
 * Get your API key at: https://pixabay.com/api/docs/
 *
 * Requires in scripts/.env (or environment):
 *   PIXABAY_API_KEY
 *   CLOUDFLARE_R2_ACCESS_KEY_ID
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *   CLOUDFLARE_ACCOUNT_ID
 */

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

const PIXABAY_KEY   = process.env.PIXABAY_API_KEY
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID
const R2_BUCKET     = 'abq-unplugged-images'
const CDN_BASE      = 'https://cdn.abqunplugged.com'

const isDryRun   = process.argv.includes('--dry-run')
const catFilter  = process.argv.find(a => a.startsWith('--category='))?.split('=')[1]

if (!PIXABAY_KEY) {
  console.error(`
❌ PIXABAY_API_KEY not set.

Get your API key at: https://pixabay.com/api/docs/

Then add it to scripts/.env:
  PIXABAY_API_KEY=your_key_here

Or pass it directly:
  PIXABAY_API_KEY=your_key node scripts/fetch-pixabay-fallbacks.mjs
`.trim())
  process.exit(1)
}

if (!isDryRun && (!R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_ACCOUNT_ID)) {
  console.error(`
❌ R2 credentials missing. Add to scripts/.env:
  R2_ACCESS_KEY_ID=...
  R2_SECRET_ACCESS_KEY=...
  R2_ACCOUNT_ID=...
  `.trim())
  process.exit(1)
}

// ── Category → Pixabay search queries ─────────────────────────────────────────
// Multiple queries per category — we pick the best non-overlapping photos.
// Queries are ordered from most specific to broadest fallback.
// All queries target real-world photography, not graphic design or AI art.
const CATEGORIES = {
  music: [
    'live music concert crowd venue',
    'rock band on stage performance',
    'concert hall audience stage lights',
  ],
  comedy: [
    'stand up comedy show microphone stage',
    'comedy club performance audience laughing',
    'improv theater stage performers',
  ],
  sports: [
    'sports stadium crowd event',
    'athletic competition outdoor venue',
    'baseball stadium game crowd',
  ],
  'arts & theater': [
    'theater stage performance actors',
    'art gallery opening exhibition crowd',
    'ballet dance performance stage',
  ],
  family: [
    'family fun festival outdoor activities',
    'children carnival fair rides',
    'outdoor family event park',
  ],
  'food & drink': [
    'food festival outdoor market vendors',
    'craft beer brewery tasting room',
    'farmers market outdoor food',
  ],
  film: [
    'outdoor cinema movie screening crowd',
    'movie theater marquee night',
    'film festival audience screening',
  ],
  outdoor: [
    'hot air balloon festival crowd',
    'hiking trail desert southwest nature',
    'outdoor festival park nature',
  ],
  community: [
    'community outdoor event gathering crowd',
    'neighborhood street festival local',
    'cultural festival outdoor community',
  ],
  festivals: [
    'outdoor festival crowd celebration',
    'street fair festival vendors',
    'music festival outdoor crowd summer',
  ],
}

// ── R2 client ─────────────────────────────────────────────────────────────────
const r2 = isDryRun ? null : new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
})

// ── Pixabay search ────────────────────────────────────────────────────────────
async function searchPixabay(query, perPage = 10) {
  const params = new URLSearchParams({
    key:         PIXABAY_KEY,
    q:           query,
    image_type:  'photo',       // real photos only, no illustrations or vectors
    orientation: 'horizontal',  // landscape format (better for event cards)
    order:       'popular',     // quality-sorted by community
    safesearch:  'true',
    min_width:   '1000',        // minimum width for quality
    per_page:    String(perPage),
  })

  const url = `https://pixabay.com/api/?${params}`
  const res = await fetch(url)

  if (!res.ok) {
    console.error(`  ⚠ Pixabay API error: ${res.status} ${res.statusText}`)
    return []
  }

  const data = await res.json()
  return data.hits || []
}

// ── Download image ─────────────────────────────────────────────────────────────
async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'image/webp,image/jpeg,image/*',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// ── Upload to R2 ──────────────────────────────────────────────────────────────
async function uploadToR2(key, buffer, contentType = 'image/jpeg') {
  // Check if already exists
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return false // already exists
  } catch {
    // Not found — upload
  }

  await r2.send(new PutObjectCommand({
    Bucket:       R2_BUCKET,
    Key:          key,
    Body:         buffer,
    ContentType:  contentType,
    CacheControl: 'public, max-age=31536000, immutable', // 1 year — these don't change
  }))
  return true
}

// ── Main ──────────────────────────────────────────────────────────────────────
const results = {} // category → array of CDN URLs

const targetCategories = catFilter
  ? { [catFilter]: CATEGORIES[catFilter] }
  : CATEGORIES

for (const [category, queries] of Object.entries(targetCategories)) {
  console.log(`\n📂 ${category}`)

  const seen = new Set() // deduplicate across queries
  const cdnUrls = []
  const IMAGES_PER_CATEGORY = 6

  for (const query of queries) {
    if (cdnUrls.length >= IMAGES_PER_CATEGORY) break
    console.log(`  🔍 "${query}"`)

    const hits = await searchPixabay(query, 10)

    for (const hit of hits) {
      if (cdnUrls.length >= IMAGES_PER_CATEGORY) break
      if (seen.has(hit.id)) continue
      seen.add(hit.id)

      // Prefer largeImageURL (1280px), fall back to webformatURL (640px)
      const sourceUrl = hit.largeImageURL || hit.webformatURL
      if (!sourceUrl) continue

      const idx    = cdnUrls.length
      const r2Key  = `fallbacks/pixabay/${category.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}/${idx}.jpg`
      const cdnUrl = `${CDN_BASE}/${r2Key}`

      if (isDryRun) {
        console.log(`  [dry-run] Would upload: ${r2Key}`)
        console.log(`            Source: ${sourceUrl}`)
        console.log(`            Pixabay ID: ${hit.id} | Likes: ${hit.likes} | Views: ${hit.views}`)
        cdnUrls.push(cdnUrl)
        continue
      }

      try {
        const buf = await downloadImage(sourceUrl)
        const uploaded = await uploadToR2(r2Key, buf, 'image/jpeg')
        console.log(`  ${uploaded ? '✅ uploaded' : '⏭  exists'} → ${r2Key}`)
        cdnUrls.push(cdnUrl)
      } catch (err) {
        console.warn(`  ⚠ Failed to download/upload ${sourceUrl}: ${err.message}`)
      }

      // Small delay to respect Pixabay rate limits
      await new Promise(r => setTimeout(r, 200))
    }
  }

  results[category] = cdnUrls
  console.log(`  → ${cdnUrls.length} images for "${category}"`)
}

// ── Output TypeScript snippet ─────────────────────────────────────────────────
console.log('\n\n' + '─'.repeat(80))
console.log('// Copy this into v2/lib/fallback-images.ts → PIXABAY_IMAGES:\n')
console.log('const PIXABAY_IMAGES: Record<string, string[]> = {')
for (const [cat, urls] of Object.entries(results)) {
  if (urls.length === 0) continue
  console.log(`  '${cat}': [`)
  for (const url of urls) {
    console.log(`    '${url}',`)
  }
  console.log(`  ],`)
}
console.log('}')
console.log('─'.repeat(80))

if (isDryRun) {
  console.log('\n✅ Dry run complete — no uploads performed.')
} else {
  const total = Object.values(results).flat().length
  console.log(`\n✅ Done — ${total} images cached across ${Object.keys(results).length} categories.`)
}
