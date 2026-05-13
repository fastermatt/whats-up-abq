/**
 * tag-christian-music.mjs
 *
 * Scans all upcoming events and tags any that match a known Christian artist
 * name. Sets ai_enrichment.christian_music = true on matches.
 *
 * Usage:
 *   node scripts/tag-christian-music.mjs              # upcoming events only
 *   node scripts/tag-christian-music.mjs --all        # all events in DB
 *   node scripts/tag-christian-music.mjs --dry-run    # preview without writing
 *
 * Run after ingestion to catch new events:
 *   node scripts/ingest.mjs && node scripts/tag-christian-music.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ── Load .env from scripts/ dir ───────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env.local'),
]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
    console.log('Loaded env from:', envFile)
    break
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Christian artist list (inline to avoid TS import issues in .mjs) ──────────
// Keep in sync with v2/lib/christian-artists.ts
const CHRISTIAN_ARTISTS = [
  // Contemporary Worship
  'hillsong united', 'hillsong worship', 'hillsong young & free', 'hillsong',
  'elevation worship', 'bethel music', 'bethel worship', 'jesus culture',
  'maverick city music', 'upperroom', 'gateway worship', 'north point worship',
  'planetshakers', 'housefires', 'passion', 'passion worship',
  'christ fellowship worship', 'kari jobe', 'cody carnes', 'corey asbury',
  'kristene dimarco', 'amanda cook', 'william matthews', 'steffany gretzinger',
  'josh baldwin', 'john mark mcmillan', 'sean feucht', 'kim walker-smith',
  'martin smith', 'delirious', 'tasha cobbs leonard', 'travis greene',
  'israel houghton', 'new breed',
  // CCM / Pop
  'chris tomlin', 'lauren daigle', 'mercyme', 'mercy me', 'casting crowns',
  'matthew west', 'crowder', 'david crowder band', 'zach williams',
  'brandon lake', 'tobymac', 'toby mac', 'jeremy camp', 'anne wilson',
  'katy nichole', 'we the kingdom', 'dante bowe', 'phil wickham',
  'amy grant', 'michael w. smith', 'steven curtis chapman', 'mandisa',
  'francesca battistelli', 'britt nicole', 'natalie grant', 'ellie holcomb',
  'mark schultz', 'sidewalk prophets', '10th avenue north', 'tenth avenue north',
  'big daddy weave', 'danny gokey', 'jordan feliz', 'colton dixon', 'plumb',
  'group 1 crew', 'meredith andrews', 'all sons & daughters', 'rend collective',
  'for king & country', 'for king and country', 'tauren wells', 'ben fuller',
  'caleb and john', 'cece winans', 'kirk franklin', 'tamela mann',
  'hezekiah walker', 'fred hammond', 'newsong', 'the newsboys', 'newsboys',
  'forrest frank', 'hulvey', 'emerson day', 'evan craft', 'ryan stevenson',
  'jason gray', 'mike donehey', 'andrew peterson', 'david dunn', 'unspoken',
  'blanca', 'citizens', 'citizens & saints',
  // Christian Rock / Alternative
  'skillet', 'switchfoot', 'third day', 'audio adrenaline', 'dc talk',
  'dctalk', 'jars of clay', 'relient k', 'thousand foot krutch', 'disciple',
  'kutless', 'building 429', 'flyleaf', 'lacey sturm', 'fireflight',
  'superchick', 'pillar', 'hawk nelson', 'remedy drive', 'seventh day slumber',
  'stryper', 'petra', 'white heart', 'newsboys united', 'stellar kart',
  'family force 5', 'haste the day', 'sanctus real', 'downhere', 'barlow girl',
  'krystal meyers', 'everyday sunday', 'the afters', 'addison road', 'leeland',
  'needtobreathe', 'need to breathe',
  // Christian Hip-Hop
  'lecrae', 'andy mineo', 'trip lee', 'derek minor', 'social club misfits',
  'flame', 'shai linne', 'whatuprg', 'da truth', 'beautiful eulogy',
  'sho baraka', 'eshon burgundy', 'wande', 'nobigdyl.', 'tedashii', 'hulvey',
  // Gospel
  'donnie mcclurkin', 'yolanda adams', 'bebe winans', 'marvin sapp',
  'tye tribbett', 'richard smallwood', 'shirley caesar', 'andrae crouch',
  // Latin / Spanish Christian
  'marcos witt', 'alex zurdo', 'jesus adrian romero', 'lilly goodman',
  'danilo montero', 'redimi2',
]

// Special-case artists where name is too common — require additional context
// e.g. "NF" could be Nelly Furtado; we match only if title has "christian" or venue is a church
const AMBIGUOUS_ARTISTS = new Set(['nf', 'crowder', 'flame', 'pillar', 'red'])

function normalize(str) {
  return str.toLowerCase().replace(/[+&]/g, ' ').replace(/\s+/g, ' ').trim()
}

function isChristianMatch(title, venueName) {
  const t = normalize(title)
  const v = normalize(venueName ?? '')
  const venueIsChurch = v.includes('church') || v.includes('chapel') ||
                        v.includes('ministry') || v.includes('calvary') ||
                        v.includes('sagebrush') || v.includes('iglesia')

  for (const artist of CHRISTIAN_ARTISTS) {
    const a = normalize(artist)

    // Use word-boundary regex so "wande" doesn't match "wanderhome"
    // Escape regex special chars first
    const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i')
    if (!re.test(t)) continue

    // For ambiguous names, require church venue or "christian" in title
    if (AMBIGUOUS_ARTISTS.has(a)) {
      if (!venueIsChurch && !t.includes('christian') && !t.includes('worship') && !t.includes('gospel')) {
        continue
      }
    }

    return artist  // return the matched artist name
  }
  return null
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allTime = args.includes('--all')

console.log(`\n🎵 Christian Music Tagger${dryRun ? ' (DRY RUN)' : ''}`)
console.log(`   Mode: ${allTime ? 'all events' : 'upcoming events only'}\n`)

// Fetch events
const today = new Date().toISOString().slice(0, 10)
let query = supabase
  .schema('public')
  .from('events')
  .select('id, raw, venue_name, ai_enrichment, category, event_date')
  .eq('hidden', false)

if (!allTime) {
  query = query.gte('event_date', today)
}

const { data: events, error } = await query.order('event_date')

if (error) {
  console.error('DB error:', error.message)
  process.exit(1)
}

console.log(`   Scanning ${events.length} events...\n`)

let tagged = 0
let alreadyTagged = 0
let untagged = 0

const toUpdate = []

for (const event of events) {
  const title = event.raw?.name ?? event.raw?.title ?? ''
  const venue = event.venue_name ?? ''
  const existing = event.ai_enrichment

  // Skip if already tagged
  if (existing?.christian_music === true) {
    alreadyTagged++
    continue
  }

  const matchedArtist = isChristianMatch(title, venue)

  if (matchedArtist) {
    tagged++
    console.log(`  ✅ ${title.slice(0, 60)}`)
    console.log(`      → matched: "${matchedArtist}" | venue: ${venue || '(none)'}`)
    if (!dryRun) {
      toUpdate.push({
        id: event.id,
        enrichment: { ...(existing ?? {}), christian_music: true, christian_artist: matchedArtist },
      })
    }
  } else {
    untagged++
  }
}

// Batch update in chunks of 50
if (!dryRun && toUpdate.length > 0) {
  console.log(`\n   Writing ${toUpdate.length} tags to DB...`)
  const CHUNK = 50
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const chunk = toUpdate.slice(i, i + CHUNK)
    const updates = await Promise.all(
      chunk.map(({ id, enrichment }) =>
        supabase
          .schema('public')
          .from('events')
          .update({ ai_enrichment: enrichment })
          .eq('id', id)
      )
    )
    const errors = updates.filter(r => r.error)
    if (errors.length) {
      console.error('  Update errors:', errors.map(r => r.error?.message))
    }
  }
  console.log('   Done.')
}

console.log(`\n── Summary ─────────────────────────────────────────────`)
console.log(`   Newly tagged:     ${tagged}`)
console.log(`   Already tagged:   ${alreadyTagged}`)
console.log(`   No match:         ${untagged}`)
console.log(`   Total scanned:    ${events.length}`)
if (dryRun) console.log('\n   (Dry run — no DB changes written)')
console.log()
