/**
 * Clean venue_name values that have addresses or other junk embedded.
 *
 * Patterns fixed:
 *   "Roadrunner Food Bank — 5840 Office Blvd NE, Albuquerque"  → "Roadrunner Food Bank"
 *   "Three Sisters Kitchen, Gold Avenue Southwest, ABQ, NM"    → "Three Sisters Kitchen"
 *   "3214 Purdue Pl NE"                                        → (left as-is, no venue name to extract)
 *   "Roy E. Disney Center: Albuquerque Journal Theatre"        → (fine, kept as-is)
 *
 * Usage:
 *   node scripts/clean-venues.mjs            # preview changes
 *   node scripts/clean-venues.mjs --apply    # write to DB
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
    break
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const doApply      = process.argv.includes('--apply')

if (!SUPABASE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY not set.'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Street number at start = raw address, no venue name to extract
const STREET_ADDRESS_RE = /^\d+\s+[A-Za-z]/

// Patterns that indicate an address is trailing the venue name
const ADDRESS_SEPARATORS = [
  /\s+—\s+\d+/,             // " — 5840 Office Blvd"
  /\s{2,}\d{3,5}\s+[A-Za-z]/, // "Name   4600 Copper Ave"  (multiple spaces before street number)
  /,\s*\d{3,5}\s+[A-Z]/,    // ", 5840 Office Blvd"
  /,\s*[A-Z][a-z]+\s+(Avenue|Ave|Street|St|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Place|Pl|Court|Ct)\b/i,
  /,\s*(Albuquerque|ABQ|NM|New Mexico),?\s*(NM|USA)?\s*\d*/i,
]

function cleanVenueName(raw) {
  if (!raw) return null

  const original = raw.trim()

  // If it looks like a raw street address (starts with number), nothing to salvage
  if (STREET_ADDRESS_RE.test(original)) return null   // signals: no clean name available

  // Match separators against the ORIGINAL string (before space-collapsing) so
  // patterns like \s{2,}\d+ still work on "Name   4600 Address".
  let cutIndex = -1
  for (const sep of ADDRESS_SEPARATORS) {
    const m = original.match(sep)
    if (m) { cutIndex = m.index; break }
  }

  // Collapse multiple spaces after cutting
  const v = (cutIndex >= 0 ? original.slice(0, cutIndex) : original)
    .replace(/\s{2,}/g, ' ')
    .replace(/[,]+$/, '')
    .trim()

  return v || null
}

async function main() {
  console.log(`\nVenue Name Cleaner — ${doApply ? 'APPLY' : 'PREVIEW'}\n`)

  // Fetch all upcoming events with a venue_name
  const { data, error } = await supabase
    .from('events')
    .select('id, venue_name, raw')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .not('venue_name', 'is', null)
    .limit(2000)

  if (error) { console.error(error.message); process.exit(1) }
  console.log(`Checking ${data.length} venues…\n`)

  const toFix = []

  for (const row of data) {
    const original = row.venue_name
    const cleaned  = cleanVenueName(original)

    if (cleaned === null && STREET_ADDRESS_RE.test(original)) {
      // Raw street address — try to get venue from raw.venue or raw._embedded
      const raw = row.raw || {}
      const fallback = raw.venue?.name || raw._embedded?.venues?.[0]?.name || null
      if (fallback && fallback !== original) {
        toFix.push({ id: row.id, original, cleaned: fallback, reason: 'street→raw.venue fallback' })
      } else {
        console.log(`  [no fix] "${original}" — raw street address, no fallback`)
      }
      continue
    }

    if (cleaned && cleaned !== original) {
      toFix.push({ id: row.id, original, cleaned, reason: 'stripped address suffix' })
    }
  }

  if (!toFix.length) {
    console.log('All venue names look clean — nothing to do.')
    return
  }

  console.log(`Found ${toFix.length} venues to clean:\n`)
  toFix.forEach(({ original, cleaned, reason }) => {
    console.log(`  "${original}"`)
    console.log(`  → "${cleaned}"  [${reason}]`)
    console.log()
  })

  if (!doApply) {
    console.log(`Run with --apply to write ${toFix.length} changes to the database.`)
    return
  }

  console.log('Writing…')
  let ok = 0, err = 0
  for (const { id, cleaned } of toFix) {
    const { error: e } = await supabase
      .from('events')
      .update({ venue_name: cleaned })
      .eq('id', id)
    if (e) { console.error(`  error updating ${id}: ${e.message}`); err++ }
    else ok++
  }

  console.log(`\nUpdated: ${ok} | Errors: ${err}`)
  console.log('Done.')
}

main().catch(console.error)
