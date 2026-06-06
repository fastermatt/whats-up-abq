/**
 * Venue → official Instagram handle map, for auto-tagging venues in IG posts.
 *
 * Handles were individually verified via web search (bio/name confirmed to match
 * the specific venue). Tagging a WRONG handle tags a stranger and reads as spam,
 * so this map is exact-match-first and only contains high-confidence handles.
 * When in doubt, a venue is omitted (no tag) rather than guessed.
 *
 * Keys are the exact `venue_name` strings as they appear in public.events
 * (including the address/sub-room variants that occur in the data). A normalized
 * fallback catches minor future variants without risking false positives.
 *
 * Last verified: 2026-06-06.
 */

// Handle WITHOUT the leading @.
export const VENUE_IG: Record<string, string> = {
  // Sports / stadiums
  'Rio Grande Credit Union Field at Isotopes Park': 'abqtopes',
  'University Stadium': 'unmloboathletics',
  'University Stadium (NM)': 'unmloboathletics',

  // Performing arts / theaters
  'Popejoy Hall': 'popejoypresents',
  'Outpost Performance Space': 'outpost_performance_space',
  'KiMo Theatre': 'kimotheatre',
  'The Historic El Rey Theater - Albuquerque': 'elreyabq',
  'Roy E. Disney Center for Performing Arts: Albuquerque Journal Theatre': 'nifnm',
  'FUSION | 708': 'fusiontheatrecompany',

  // Music / nightlife
  'Launchpad': 'launchpadabq',
  'Sunshine Theater': 'sunshinetheaterabq',
  'Revel Entertainment Center': 'revelabq',
  "Babydoll's House of Jazz & Blues": 'babydollshouseofjazzandblues',
  'Hyena\'s Comedy Nightclub - Albuquerque': 'hyenascomedyabq',

  // Amphitheaters / arenas
  'First Financial Credit Union Amphitheater': 'firstfinancialamp',
  'Rio Rancho Events Center': 'rioranchoeventscenter',

  // Convention center
  'Kiva Auditorium at the Albuquerque Convention Center': 'abqconvctr',
  'Albuquerque Convention Center': 'abqconvctr',

  // Casinos / resorts
  'Route 66 Casino': 'rt66casino',
  'Sandia Casino Amphitheater': 'sandiacasino',
  'Sandia Resort & Casino': 'sandiacasino',
  'Isleta Casino & Resort - Showroom': 'isletaresortandcasino',

  // Fairgrounds
  'New Mexico State Fair': 'nmstatefair',
  'Tingley Coliseum - New Mexico State Fair': 'nmstatefair',

  // Breweries
  'Canteen Brewhouse': 'canteenbrewhouse',
  'Marble Brewery Downtown': 'marblebrewery',
  'JUNO brewery + cafe + art': 'juno_abq',

  // Arts / culture
  'National Hispanic Cultural Center': 'nhccnm',
  'NHCC Torreón': 'nhccnm',
  'NHCC | Education Building: Grand Hall': 'nhccnm',
  'Harwood Art Center': 'harwoodartcenter',

  // Community
  'Roadrunner Food Bank': 'roadrunnerfoodbank',
  'Roadrunner Food Bank — 5840 Office Blvd NE, Albuquerque': 'roadrunnerfoodbank',

  // Special events
  'Balloon Fiesta Park': 'balloonfiesta',
}

/** Normalize a venue name to a base form for fallback matching. Strips the
 *  common trailing qualifiers ("- Albuquerque", " — <address>", " | <room>",
 *  ": <subroom>") and collapses whitespace/case. Conservative on purpose. */
function normalizeVenue(name: string): string {
  return name
    .split(/\s+[—|:]\s+|\s+-\s+/)[0] // cut at first " - ", " — ", " | ", " : "
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Precomputed normalized index (base name → handle). Only populated when a base
// name maps unambiguously to a single handle, so the fallback can't mis-tag.
const NORMALIZED_INDEX: Record<string, string> = (() => {
  const counts: Record<string, Set<string>> = {}
  for (const [venue, handle] of Object.entries(VENUE_IG)) {
    const base = normalizeVenue(venue)
    ;(counts[base] ??= new Set()).add(handle)
  }
  const idx: Record<string, string> = {}
  for (const [base, handles] of Object.entries(counts)) {
    if (handles.size === 1) idx[base] = [...handles][0]
  }
  return idx
})()

/** Return the official IG handle (without @) for a venue, or null if unknown. */
export function venueHandle(venueName: string | null | undefined): string | null {
  if (!venueName) return null
  const exact = VENUE_IG[venueName]
  if (exact) return exact
  return NORMALIZED_INDEX[normalizeVenue(venueName)] ?? null
}

/** Distinct @handles for a set of venue names, order-preserving, deduped. */
export function venueHandles(venueNames: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of venueNames) {
    const h = venueHandle(v)
    if (h && !seen.has(h)) { seen.add(h); out.push(h) }
  }
  return out
}
