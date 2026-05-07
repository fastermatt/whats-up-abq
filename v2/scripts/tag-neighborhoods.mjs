/**
 * Neighborhood tagging — zip-code primary, keyword fallback.
 *
 * Strategy (in order):
 *  1. Extract zip code from raw address data (most reliable signal)
 *  2. Map unambiguous zips directly to a neighborhood
 *  3. For ambiguous zips (87106 covers Nob Hill + Isotopes + far south), use keyword rules
 *  4. For events with no zip, fall back to venue-name keyword rules
 *
 * Usage:
 *   node scripts/tag-neighborhoods.mjs [--dry-run] [--force]
 *   --dry-run  : report without writing
 *   --force    : re-tag ALL events, not just untagged ones
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
const isForce  = process.argv.includes('--force')
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const today = new Date().toISOString().slice(0, 10)

// ─── Zip-code → Neighborhood map ─────────────────────────────────────────────
// ABQ zip codes are far more reliable than keyword matching on venue names.
// Source: USPS + ABQ GIS / city boundary data.
const ZIP_MAP = {
  // Downtown / Central
  '87101': 'Downtown',
  '87102': 'Downtown',
  '87103': 'Downtown',
  // Old Town / BioPark
  '87104': 'Old Town',
  // South Valley / Barelas / Isleta
  '87105': 'South Valley',
  // UNM / Nob Hill / Cesar Chavez (ambiguous — use keywords below)
  // '87106': ambiguous — handled by ZIP_AMBIGUOUS
  // North Valley / Los Ranchos / Los Griegos
  '87107': 'North Valley',
  // International District / SE Heights
  '87108': 'International District',
  // Uptown / San Mateo / Louisiana
  '87109': 'Uptown / Midtown',
  '87110': 'Uptown / Midtown',
  // Northeast Heights (Juan Tabo, Montgomery, Academy)
  '87111': 'Northeast Heights',
  '87112': 'Northeast Heights',
  // Far NE / Sandia Foothills / Balloon Fiesta area
  '87113': 'Far Northeast / Sandia Foothills',
  // West Side / Corrales / Coors north
  '87114': 'West Side',
  // Kirtland AFB / Far East
  '87115': 'Far Northeast / Sandia Foothills',
  '87117': 'Far Northeast / Sandia Foothills',
  // UNM South Campus / Yale / Gibson / Airport
  '87116': 'UNM / South Campus',
  // West Side (Taylor Ranch, Ladera)
  '87120': 'West Side',
  // Far West / Route 66 Casino / Laguna area
  '87121': 'West Side',
  // Far NE / Sandia Mountains
  '87122': 'Far Northeast / Sandia Foothills',
  '87123': 'Far Northeast / Sandia Foothills',
  // Rio Rancho
  '87124': 'Rio Rancho',
  '87144': 'Rio Rancho',
  // UNM Campus (main campus zip — Popejoy, Johnson Center, Lobo Stadium)
  '87131': 'UNM Campus',
  // Barelas / South Downtown
  '87102': 'Downtown',  // overlaps — Barelas gets keyword rule below
}

// Zips where we need keywords to disambiguate sub-areas
const ZIP_AMBIGUOUS = new Set(['87106'])

// ─── Keyword rules (first match wins) ────────────────────────────────────────
// Used when: (a) no zip, (b) zip is in ZIP_AMBIGUOUS
const RULES = [
  // Downtown (includes Harwood ~7th St NW, close to downtown)
  [/\b(sunshine theater|launchpad|el rey|kimo|century downtown|civic plaza|albuquerque civic|convention center|hotel andaluz|strand|downtown|(main library.*downtown)|special collections library|black cat cultural|african american performing arts|casa de benavidez|the grove|harwood art center|harwood|juno brewery|juno.*cafe|cathedral.*john|st.*john.*cathedral|african american performing|albuquerque social club.*central|robinson park|marquette ave|the block|groove artspace|red door bar|500 marquette|hla conference)\b/i, 'Downtown'],

  // Downtown / EDo
  [/\b(edo|east downtown|sister.*bar|the jam spot)\b/i, 'Downtown / EDo'],

  // Barelas / South Downtown
  [/\b(barelas|barela|national hispanic cultural|nhcc|south downtown|second chance|lobo rainforest|wesst.*broadway|rainforest innovation|roy.*disney|disney.*performing|salon ortega|sal.n ortega|disney center)\b/i, 'Barelas / South Downtown'],

  // UNM Campus (before nob-hill so "lobo" → UNM not nob-hill)
  [/\b(popejoy|keller hall|university arena|johnson center|domenici|unm north campus|unm continuing ed|stanford dr|yale blvd|cornell drive|university of new mexico campus|loma linda community center|kiva lecture hall|1920 yale|university stadium|visual art museum|unm art)\b/i, 'UNM Campus'],

  // UNM / Nob Hill (87106 sub-area: Central Ave between Girard and San Mateo)
  [/\b(nob hill|lobo theater|historic lobo|effex|anodyne|tractor brewery|flying star|ernie pyle library|erna fergusson|girard blvd)\b/i, 'UNM / Nob Hill'],

  // State Fairgrounds / Midtown (Isotopes, Tingley, State Fair)
  [/\b(state fairground|expo new mexico|the pit|midtown.*arena|isotopes|rgcu field|rio grande credit union field|4801 lang|2448 menaul|menaul blvd|urban 360|tingley coliseum|chupacabras)\b/i, 'State Fairgrounds / Midtown'],

  // South I-25 / University SE (87106 far south — amphitheater area)
  [/\b(albuquerque school of healing arts|copper ave|outpost performance|4600 copper|albuquerque social club|first financial.*amphitheater|journal pavilion|hard rock amphitheater|university blvd.*south|5601 university)\b/i, 'South I-25 / University SE'],

  // Uptown / Midtown (San Mateo, Louisiana, Wyoming, Pan American Freeway NE corridors)
  // Horn YMCA is 7840 Pan American Freeway NE (zip 87109) — NOT Northeast Heights
  [/\b(uptown|louisiana blvd|coronado center|san mateo blvd|albuquerque marriott|wyoming.*menaul|san mateo pl|san mateo place|pan american freeway|horn ymca|hb.*ymca|hb &amp;.*ymca|americas pkwy|americas parkway|babydoll)\b/i, 'Uptown / Midtown'],

  // Far Northeast / Sandia Foothills
  [/\b(sandia foothills|tramway blvd|elena gallegos|balloon fiesta|fiesta pkwy|foothills|far northeast|high desert|tony hillerman library|roadrunner food bank|office blvd|sandia casino|sandia amphitheater)\b/i, 'Far Northeast / Sandia Foothills'],

  // Northeast Heights (Juan Tabo, Eubank, Academy, Comanche corridor — NE quadrant only)
  // REMOVED from here: taylor ranch (West Side 87120), overtime sports (Coors Bypass = West Side),
  // horn ymca / hb ymca (Pan American Freeway = Uptown/Midtown 87109)
  [/\b(juan tabo|lomas tramway|cherry hills.*library|montgomery blvd|sandia labs|kirtland|eubank blvd|academy blvd|comanche|adobe theater|creativity warehouse|story quest|unity spiritual|nexus brewery|heartstrings|holiday park|san pedro.*library|csp dance|ymca.*comanche)\b/i, 'Northeast Heights'],

  // North Valley / Los Ranchos
  [/\b(north valley|los ranchos|rudolfo anaya|los griegos|alameda blvd|los duranes|corrales|rio grande.*north|revel entertainment)\b/i, 'North Valley'],

  // Old Town
  [/\b(old town|biopark|aquarium|botanic garden|tingley beach|rio grande nature|museum of natural history|albuquerque museum|indian pueblo cultural|rio grande blvd|mountain road|mountain rd|raindrop foundation|4920 rio grande|arrive albuquerque|arrive hotel)\b/i, 'Old Town'],

  // Rio Rancho
  [/\b(rio rancho|sandoval|santa ana star|hyatt regency.*tamaya|rust medical|hilton.*rio rancho|cafe.*rio rancho boulevard|castle coffee.*rio rancho)\b/i, 'Rio Rancho'],

  // West Side (Coors, Unser, Taylor Ranch, Ladera, Paradise Hills, Westgate)
  // Taylor Ranch is NW ABQ (zip 87120) — NOT Northeast Heights
  // Overtime Sports Bar is on Coors Bypass NW (zip 87114) — NOT Northeast Heights
  [/\b(west side|westgate|ladera|coors blvd|coors bypass|paseo del norte.*west|universe blvd|unser.*central|central.*unser|route 66 casino|central.*unser public library|westgate library|taylor ranch|paradise hills|paradise ridge|overtime sports)\b/i, 'West Side'],

  // South Valley / Isleta
  [/\b(south valley|isleta casino|isleta resort|isleta.*showroom|rio bravo brewing|atrisco|woodmont|three sisters kitchen|gold avenue southwest|gutierrez.hubbell|cnm south valley|south valley library|isleta blvd)\b/i, 'South Valley'],

  // International District
  [/\b(international district library|international district)\b/i, 'International District'],
]

// ─── Zip extraction ───────────────────────────────────────────────────────────
function extractZip(raw) {
  if (!raw) return null
  // TM: _embedded.venues[0].postalCode
  const tmZip = raw?._embedded?.venues?.[0]?.postalCode
  if (tmZip && /^\d{5}/.test(String(tmZip))) return String(tmZip).slice(0, 5)
  // EB: venue.address.zip or venue.address.postal_code
  const ebVenue = raw?.venue
  if (ebVenue) {
    const addr = ebVenue.address || {}
    const zip = addr.zip || addr.postal_code || addr.postalCode
    if (zip && /^\d{5}/.test(String(zip))) return String(zip).slice(0, 5)
  }
  // Fallback: scan the full raw JSON string for a 5-digit zip in an NM address
  const str = JSON.stringify(raw)
  // Look for patterns like "87102" or "NM 87102" etc.
  const m = str.match(/"(?:postal[Cc]ode|zip[Cc]ode?|zip)"\s*:\s*"(\d{5})/)
  if (m) return m[1]
  return null
}

// ─── Venue String Extraction ──────────────────────────────────────────────────
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

// ─── High-confidence venue overrides (bypass zip lookup) ─────────────────────
// Use these when TM/SeatGeek has a wrong postalCode for a well-known venue.
// Key: lowercase partial venue name match. Value: correct neighborhood.
const VENUE_OVERRIDES = {
  'new mexico state fair':          'State Fairgrounds / Midtown',
  'expo new mexico':                'State Fairgrounds / Midtown',
  'tingley coliseum':               'State Fairgrounds / Midtown',
  'isotopes park':                  'State Fairgrounds / Midtown',
  'rgcu field':                     'State Fairgrounds / Midtown',
  'rio grande credit union field':  'State Fairgrounds / Midtown',
  'popejoy':                        'UNM Campus',
  'university stadium':             'UNM Campus',
  'johnson center':                 'UNM Campus',
  'keller hall':                    'UNM Campus',
  'balloon fiesta park':            'Far Northeast / Sandia Foothills',
  'sandia resort':                  'Far Northeast / Sandia Foothills',
  'sandia casino':                  'Far Northeast / Sandia Foothills',
  'route 66 casino':                'West Side',
  'isleta casino':                  'South Valley',
  'isleta resort':                  'South Valley',
  'rio rancho events center':       'Rio Rancho',
}

// ─── Tag Logic ────────────────────────────────────────────────────────────────
function tagNeighborhood(venueStr, zip) {
  const venueStrLower = venueStr.toLowerCase()

  // 0. High-confidence venue overrides — trump zip (handles bad source zips)
  for (const [key, neighborhood] of Object.entries(VENUE_OVERRIDES)) {
    if (venueStrLower.includes(key)) return neighborhood
  }

  // 1. Unambiguous zip → direct mapping
  if (zip && ZIP_MAP[zip] && !ZIP_AMBIGUOUS.has(zip)) {
    return ZIP_MAP[zip]
  }

  // 2. Ambiguous zip (87106) — use keywords to pick sub-area
  if (zip && ZIP_AMBIGUOUS.has(zip)) {
    for (const [regex, neighborhood] of RULES) {
      if (regex.test(venueStr)) return neighborhood
    }
    // Default for 87106 if no keyword matches: UNM / Nob Hill (most common in that zip)
    return 'UNM / Nob Hill'
  }

  // 3. No zip — pure keyword rules
  for (const [regex, neighborhood] of RULES) {
    if (regex.test(venueStr)) return neighborhood
  }
  return null
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nNeighborhood Tagger — ${isDryRun ? 'DRY RUN' : 'LIVE'} ${isForce ? '(--force: re-tagging all)' : ''}`)
  console.log(`Today: ${today}\n`)

  // Use venue_zip generated column (no raw JSON parsing needed in script anymore)
  let query = supabase
    .schema('public')
    .from('events')
    .select('id, venue_name, raw, neighborhood, venue_zip')
    .gte('event_date', today)
    .eq('hidden', false)
    .order('event_date', { ascending: true })

  if (!isForce) {
    query = query.or('neighborhood.is.null,neighborhood.eq.')
  }

  let allRows = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error) { console.error('Fetch error:', error.message); break }
    if (!data?.length) break
    allRows = allRows.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  console.log(`Loaded ${allRows.length} events to process`)

  let tagged = 0, skipped = 0, errors = 0, zipHits = 0, keywordHits = 0
  const neighborhoodCounts = {}
  const wrongTags = []

  for (const row of allRows) {
    // Prefer DB venue_zip (generated column, already extracted) over raw JSON parsing
    const zip = row.venue_zip || extractZip(row.raw)
    const venueStr = getVenueString(row)
    const neighborhood = tagNeighborhood(venueStr, zip)

    if (!neighborhood) {
      skipped++
      continue
    }

    // Track which method was used
    if (zip && ZIP_MAP[zip] && !ZIP_AMBIGUOUS.has(zip)) zipHits++
    else keywordHits++

    // Detect re-tagging changes (for --force mode)
    if (isForce && row.neighborhood && row.neighborhood !== neighborhood) {
      wrongTags.push({ id: row.id, venue: row.venue_name, was: row.neighborhood, now: neighborhood, zip })
    }

    neighborhoodCounts[neighborhood] = (neighborhoodCounts[neighborhood] || 0) + 1

    if (isDryRun) {
      const method = (zip && ZIP_MAP[zip] && !ZIP_AMBIGUOUS.has(zip)) ? `zip:${zip}` : 'keyword'
      console.log(`[DRY] [${method}] ${neighborhood.padEnd(35)} <- "${venueStr.slice(0, 60)}"`)
      tagged++
      continue
    }

    const { error } = await supabase
      .schema('public')
      .from('events')
      .update({ neighborhood })
      .eq('id', row.id)

    if (error) {
      console.error(`  Update error for id ${row.id}:`, error.message)
      errors++
    } else {
      tagged++
      if (tagged % 50 === 0) console.log(`  Progress: ${tagged} tagged...`)
    }
  }

  console.log('\n─── Results ───────────────────────────────────')
  console.log(`Tagged:   ${tagged} (zip: ${zipHits}, keyword: ${keywordHits})`)
  console.log(`Skipped:  ${skipped} (no rule matched)`)
  console.log(`Errors:   ${errors}`)
  if (wrongTags.length > 0) {
    console.log(`\nCorrected tags (${wrongTags.length}):`)
    wrongTags.forEach(w => console.log(`  [${w.zip || 'no-zip'}] ${w.venue}: ${w.was} → ${w.now}`))
  }
  console.log('\nNeighborhood distribution:')
  Object.entries(neighborhoodCounts).sort((a, b) => b[1] - a[1]).forEach(([n, c]) => {
    console.log(`  ${c.toString().padStart(4)}x  ${n}`)
  })
  console.log('\nDone.')
}

main().catch(console.error)
