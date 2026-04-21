#!/usr/bin/env node
/**
 * Process and upload Matt's submitted place photos to Supabase Storage.
 * Maps human-readable filenames → place IDs → resizes → uploads → prints image: URLs.
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load .env.local so this works without setting env vars manually
const __dirname2 = path.dirname(fileURLToPath(import.meta.url))
for (const f of [path.join(__dirname2, '../.env.local'), path.join(__dirname2, '.env')]) {
  if (fs.existsSync(f)) fs.readFileSync(f, 'utf8').split('\n').forEach(l => {
    const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] ??= m[2].trim()
  })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing SUPABASE env vars'); process.exit(1) }

const BUCKET = 'place-photos'
const INPUT_DIR = '/tmp/place-photos-incoming'
const TARGET_WIDTH = 1080
const WEBP_QUALITY = 85

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// Filename → place ID mapping
const FILE_MAP = {
  'North Domingo Baca.jpg':               'north-domingo-baca-skate-park',
  'Alamosa Skate.jpg':                    'alamosa-skate-park',
  'Los Altos Skate.jpg':                  'los-altos-skate-park',
  'Tower Skate.jpg':                      'tower-skate-park',
  'Rio Grande Pool.jpg':                  'rio-grande-pool',
  'Los Altos Pool.jpg':                   'los-altos-pool',
  'West Mesa Aquatic Center.jpg':         'west-mesa-aquatic-center',
  'Highland Pool.jpg':                    'highland-pool',
  'Valley Pool.jpg':                      'valley-pool',
  'arroyo del oso.jpg':                   'arroyo-del-oso-golf',
  'Ladera golf.jpg':                      'ladera-golf',
  'Los Altos Golf.jpg':                   'los-altos-golf',
  'Golf Center at balloon fiesta park.jpg': 'balloon-fiesta-golf',
}

// Places that need portrait→landscape cropping
const PORTRAIT_CROP = new Set(['rio-grande-pool'])

async function processAndUpload(filename, id) {
  const filePath = path.join(INPUT_DIR, filename)
  const raw = fs.readFileSync(filePath)

  const meta = await sharp(raw).metadata()
  process.stdout.write(`  ${id}: ${meta.width}×${meta.height}`)

  let pipeline = sharp(raw)

  // Portrait crop: extract center landscape region (3:2 ratio)
  if (PORTRAIT_CROP.has(id) && meta.height > meta.width) {
    const cropH = Math.round(meta.width * (2/3))
    const top = Math.round((meta.height - cropH) / 2)
    pipeline = pipeline.extract({ left: 0, top, width: meta.width, height: cropH })
    process.stdout.write(` → cropped landscape`)
  }

  const webpBuf = await pipeline
    .resize(TARGET_WIDTH, null, { withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  process.stdout.write(` → ${(webpBuf.length / 1024).toFixed(0)}KB webp`)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${id}.webp`, webpBuf, { contentType: 'image/webp', upsert: true })

  if (error) throw new Error(error.message)

  const cdnUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${id}.webp`
  console.log(` → ✅`)
  return { id, cdnUrl }
}

async function main() {
  console.log('\n🏙️  Place Photo Uploader')
  console.log('========================\n')

  const results = []
  const failed = []

  for (const [filename, id] of Object.entries(FILE_MAP)) {
    try {
      const r = await processAndUpload(filename, id)
      results.push(r)
    } catch (err) {
      console.log(` → ❌ ${err.message}`)
      failed.push({ id, err: err.message })
    }
  }

  console.log(`\n✅ ${results.length} uploaded  ❌ ${failed.length} failed\n`)
  console.log('── Paste into data/places.ts ──────────────────────────\n')
  for (const { id, cdnUrl } of results) {
    console.log(`  // ${id}`)
    console.log(`  image: '${cdnUrl}',`)
    console.log()
  }
  if (failed.length) {
    console.log('── Failed ─────────────────────────────────────────────')
    failed.forEach(f => console.log(`  ${f.id}: ${f.err}`))
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
