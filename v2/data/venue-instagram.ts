/**
 * Curated venue → Instagram handle mapping.
 * Used to render a "Follow @handle" link next to each event's venue.
 *
 * Why a static map and not a DB column:
 *   - We don't want venue staff to have to type their handle in /submit
 *   - Verified handles only — bad handles look worse than no handle
 *   - Easy to grep/audit/expand without touching schema
 *
 * Lookup is case-insensitive substring match against the canonical
 * venue_name string. Order matters — first match wins, so list the
 * MOST SPECIFIC patterns first (e.g. "Marble Brewery NE Heights"
 * before "Marble Brewery") to avoid the wrong handle showing.
 *
 * Verified 2026-05-09 via web search. When a venue rebrands or
 * changes IG handle, update here — no DB migration needed.
 */

export interface VenueInstagram {
  /** Substring of venue_name to match (case-insensitive). First match wins. */
  match: string
  /** Instagram handle WITHOUT the @ */
  handle: string
  /** Optional friendly display name override (defaults to handle) */
  display?: string
}

// IMPORTANT: order specific → generic. "Marble Brewery NE Heights" before
// "Marble Brewery" so the right handle wins.
export const VENUE_INSTAGRAM: VenueInstagram[] = [
  // ─── Music venues ─────────────────────────────────────────────
  { match: 'sunshine theat',                      handle: 'sunshinetheaterabq' },  // matches "Theater" + "Theatre"
  { match: 'el rey theat',                        handle: 'elreyabq' },
  { match: 'launchpad',                           handle: 'launchpadabq' },
  { match: 'kimo theat',                          handle: 'kimotheatre' },
  { match: 'popejoy',                             handle: 'popejoypresents' },
  { match: 'outpost performance',                 handle: 'outpost_performance_space' },
  { match: 'sandia casino amphitheater',          handle: 'sandiacasino' },
  { match: 'sandia resort',                       handle: 'sandiacasino' },

  // ─── Sports / stadium ─────────────────────────────────────────
  { match: 'isotopes park',                       handle: 'abqtopes' },
  { match: 'rgcu field',                          handle: 'abqtopes' },
  { match: 'rio grande credit union field',       handle: 'abqtopes' },

  // ─── Comedy ───────────────────────────────────────────────────
  { match: 'hyena',                               handle: 'hyenascomedyabq' },

  // ─── Cultural / arts ──────────────────────────────────────────
  { match: 'national hispanic cultural',          handle: 'nhccnm' },
  { match: 'nhcc',                                handle: 'nhccnm' },
  { match: '516',                                 handle: '516_arts' },

  // ─── Breweries (specific location FIRST) ──────────────────────
  { match: 'marble brewery ne heights',           handle: 'marble.abq', display: 'Marble Events' },
  { match: 'marble brewery downtown',             handle: 'marblebrewery' },
  { match: 'marble brewery',                      handle: 'marblebrewery' },
  { match: 'tractor brewing',                     handle: 'tractorbrewing' },
  { match: 'tractor wells park',                  handle: 'tractorbrewing' },

  // ─── Promoter (when AMP is the listed venue/source) ───────────
  { match: 'amp concerts',                        handle: 'ampconcerts' },
]

/**
 * Find the Instagram handle for a venue.
 * Returns null if no handle is mapped — render nothing rather than guess.
 */
export function venueInstagram(venueName: string | null | undefined): VenueInstagram | null {
  if (!venueName) return null
  const lc = venueName.toLowerCase()
  for (const entry of VENUE_INSTAGRAM) {
    if (lc.includes(entry.match)) return entry
  }
  return null
}
