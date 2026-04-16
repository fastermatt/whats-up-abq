/**
 * Neighborhood tagging via venue-name keyword rules (no LLM needed).
 * Updates the `neighborhood` column; `neighborhood_slug` is a generated column
 * that auto-derives from it.
 *
 * Usage: node scripts/tag-neighborhoods.mjs [--dry-run]
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in scripts/.env or repo/scripts/.env
 *
 * Neighborhood → slug mapping (generated column logic: lower + replace non-alnum with -):
 *   "Downtown"                      → downtown
 *   "Downtown / EDo"                → downtown-edo
 *   "Barelas / South Downtown"      → barelas-south-downtown
 *   "UNM Campus"                    → unm-campus
 *   "UNM / Nob Hill"                → unm-nob-hill
 *   "UNM / South Campus"            → unm-south-campus
 *   "South I-25 / University SE"    → south-i-25-university-se
 *   "State Fairgrounds / Midtown"   → state-fairgrounds-midtown
 *   "Uptown / Midtown"              → uptown-midtown
 *   "Northeast Heights"             → northeast-heights
 *   "Far Northeast / Sandia Foothills" → far-northeast-sandia-foothills
 *   "North Valley"                  → north-valley
 *   "Old Town"                      → old-town
 *   "Rio Rancho"                    → rio-rancho
 *   "West Side"                     → west-side
 *   "South Valley"                  → south-valley
 *   "International District"        → international-district
 *   "Nob Hill"                      → nob-hill
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env
for (const envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', 'scripts', '.env'),
  path.join(__dirname, '..', '..', 'scripts', '.env'),
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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not set. Add it to scripts/.env')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const today = new Date().toISOString().slice(0, 10)

// ─── Rules ───────────────────────────────────────────────────────────────────
// Each entry: [regex tested against venue string, neighborhood label]
// neighborhood_slug is auto-generated: lower(neighborhood), non-alnum → '-'
// Applied in order; first match wins.
const RULES = [
  // Downtown (includes Harwood which is 7th St NW, very close to downtown)
  [/\b(sunshine theater|launchpad|el rey|kimo|century downtown|civic plaza|albuquerque civic|convention center|hotel andaluz|strand|downtown|(main library.*downtown)|special collections library|black cat cultural|african american performing arts|casa de benavidez|the grove|harwood art center|harwood|juno brewery|juno.*cafe|cathedral.*john|st.*john.*cathedral|african american performing|albuquerque social club.*central|robinson park)\b/i, 'Downtown'],

  // Downtown / EDo
  [/\b(edo|east downtown)\b/i, 'Downtown / EDo'],

  // Barelas / South Downtown
  [/\b(barelas|barela|national hispanic cultural|nhcc|south downtown|second chance|lobo rainforest|wesst.*broadway|rainforest innovation)\b/i, 'Barelas / South Downtown'],

  // UNM Campus (before nob-hill so "lobo" → UNM not nob-hill)
  [/\b(popejoy|keller hall|university arena|johnson center|domenici auditorium|unm north campus|unm continuing ed|stanford dr|yale blvd|cornell drive|university of new mexico campus|loma linda community center|kiva lecture hall|1920 yale)\b/i, 'UNM Campus'],

  // UNM / Nob Hill
  [/\b(nob hill|lobo theater|historic lobo|effex|anodyne|tractor brewery|flying star|ernie pyle library|erna fergusson|girard blvd)\b/i, 'UNM / Nob Hill'],

  // UNM / South Campus
  [/\b(unm south|south campus|yale park|gibson blvd.*unm)\b/i, 'UNM / South Campus'],

  // South I-25 / University SE (Copper/Yale/Gibson area)
  [/\b(albuquerque school of healing arts|copper ave|outpost performance|4600 copper|albuquerque social club)\b/i, 'South I-25 / University SE'],

  // State Fairgrounds / Midtown
  [/\b(state fairground|expo new mexico|the pit|midtown.*arena|isotopes|4801 lang|2448 menaul|menaul blvd|urban 360)\b/i, 'State Fairgrounds / Midtown'],

  // Uptown / Midtown (San Mateo, Louisiana, Wyoming corridors)
  [/\b(uptown|louisiana blvd|coronado center|san mateo blvd|albuquerque marriott|wyoming.*menaul)\b/i, 'Uptown / Midtown'],

  // Far Northeast / Sandia Foothills
  [/\b(sandia foothills|tramway blvd|elena gallegos|balloon fiesta|fiesta pkwy|foothills|far northeast|high desert|tony hillerman library|roadrunner food bank|office blvd)\b/i, 'Far Northeast / Sandia Foothills'],

  // Northeast Heights (Juan Tabo, Eubank, Academy, Comanche corridor)
  [/\b(juan tabo|lomas tramway|cherry hills.*library|taylor ranch|montgomery blvd|sandia labs|kirtland|eubank blvd|academy blvd|comanche|adobe theater|creativity warehouse|story quest|overtime sports|unity spiritual|nexus brewery|heartstrings|holiday park|san pedro.*library|csp dance|ymca.*comanche)\b/i, 'Northeast Heights'],

  // North Valley / Los Ranchos
  [/\b(north valley|los ranchos|rudolfo anaya|los griegos|alameda blvd|los duranes|corrales|rio grande.*north)\b/i, 'North Valley'],

  // Old Town (Mountain Rd, Rio Grande Blvd NW, museums)
  [/\b(old town|biopark|aquarium|botanic garden|tingley beach|rio grande nature|museum of natural history|albuquerque museum|indian pueblo cultural|rio grande blvd|mountain road|mountain rd|raindrop foundation|4920 rio grande)\b/i, 'Old Town'],

  // Rio Rancho / Sandoval County
  [/\b(rio rancho|sandoval|santa ana star|hyatt regency.*tamaya|rust medical|hilton.*rio rancho|cafe.*rio rancho boulevard|castle coffee.*rio rancho)\b/i, 'Rio Rancho'],

  // West Side (Coors, Unser, universe blvd, westgate)
  [/\b(west side|westgate|ladera|coors blvd|paseo del norte.*west|universe blvd|unser.*central|central.*unser|revel entertainment|first financial.*amphitheater|journal pavilion|hard rock amphitheater|central.*unser public library|westgate library)\b/i, 'West Side'],

  // South Valley / Isleta (Isleta Blvd south of city, Rio Bravo)
  [/\b(south valley|isleta casino|isleta resort|isleta.*showroom|rio bravo brewing|atrisco|woodmont|three sisters kitchen|gold avenue southwest|gutierrez.hubbell|cnm south valley|south valley library|isleta blvd)\b/i, 'South Valley'],

  // International District
  [/\b(international district library|international district)\b/i, 'International District'],
]

// ─── Venue String Extraction ─────────────────────────────────────────────────
function getVenueString(row) {
  const vn = row.venue_name || ''
  const raw = row.raw || {}
  const fromRaw =
    raw.venue?.name ||
    raw._embedded?.venues?.[0]?.name ||
    raw.venue_name ||
    raw.location?.name ||
    ''
  const addr =
    raw.venue?.address?.localized_address_display ||
    raw._embedded?.venues?.[0]?.address?.line1 ||
    raw.address ||
    ''
  return [vn, fromRaw, addr].filter(Boolean).join(' | ')
}

// ─── Tag Logic ───────────────────────────────────────────────────────────────
function tagNeighborhood(venueStr) {
  for (const [regex, neighborhood] of RULES) {
    if (regex.test(venueStr)) return neighborhood
  }
  return null
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nNeighborhood Tagger — ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Today: ${today}\n`)

  // Fetch untagged future events (neighborhood IS NULL or empty)
  let allRows = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id, venue_name, raw, neighborhood')
      .gte('event_date', today)
      .eq('hidden', false)
      .or('neighborhood.is.null,neighborhood.eq.')
      .range(offset, offset + pageSize - 1)
      .order('event_date', { ascending: true })

    if (error) { console.error('Fetch error:', error.message); break }
    if (!data?.length) break
    allRows = allRows.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  console.log(`Loaded ${allRows.length} untagged events`)

  let tagged = 0, skipped = 0, errors = 0
  const neighborhoodCounts = {}

  for (const row of allRows) {
    const venueStr = getVenueString(row)
    const neighborhood = tagNeighborhood(venueStr)

    if (!neighborhood) {
      skipped++
      continue
    }

    neighborhoodCounts[neighborhood] = (neighborhoodCounts[neighborhood] || 0) + 1

    if (isDryRun) {
      console.log(`[DRY] ${neighborhood.padEnd(35)} <- "${venueStr.slice(0, 60)}"`)
      tagged++
      continue
    }

    const { error } = await supabase
      .from('events')
      .update({ neighborhood })
      .eq('id', row.id)

    if (error) {
      console.error(`  Update error for id ${row.id}:`, error.message)
      errors++
    } else {
      tagged++
      if (tagged % 50 === 0) {
        console.log(`  Progress: ${tagged} tagged so far...`)
      }
    }
  }

  console.log('\n─── Results ───────────────────────────────────')
  console.log(`Tagged:  ${tagged}`)
  console.log(`Skipped: ${skipped} (no rule matched)`)
  console.log(`Errors:  ${errors}`)
  console.log('\nNeighborhood distribution:')
  Object.entries(neighborhoodCounts).sort((a, b) => b[1] - a[1]).forEach(([n, c]) => {
    console.log(`  ${c.toString().padStart(4)}x  ${n}`)
  })
  console.log('\nDone.')
}

main().catch(console.error)
