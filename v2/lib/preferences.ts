/**
 * Single source of truth for mapping PreferencesPicker labels → DB `category`
 * column values. Previously duplicated across app/events/page.tsx (single-value),
 * app/for-you/page.tsx (multi-value), and scripts/match-notifications.mjs — which
 * drifted (e.g. "outdoors & sports" mapped to only Outdoor in one place, Outdoor
 * + Sports in another). Import from here so they stay in lockstep.
 */

/** PreferencesPicker label → canonical DB `category` value(s). One label can
 *  span multiple DB categories (e.g. "outdoors & sports" → Outdoor + Sports). */
export const PREF_TO_DB_CATEGORIES: Record<string, string[]> = {
  'music':             ['Music'],
  'comedy':            ['Comedy'],
  'food & drink':      ['Food & Drink'],
  'arts & theater':    ['Arts & Theater'],
  'outdoors & sports': ['Outdoor', 'Sports'],
  'family / kids':     ['Family'],
  'film':              ['Film'],
  'nightlife':         ['Community'],
  'volunteering':      ['Community'],
}

/** Resolve preference labels to the de-duped set of DB categories they map to.
 *  Drops "free events" (that's a price filter, handled separately by callers). */
export function prefLabelsToDbCategories(labels: string[]): string[] {
  return Array.from(new Set(
    labels
      .map(l => l.toLowerCase())
      .filter(l => l !== 'free events')
      .flatMap(l => PREF_TO_DB_CATEGORIES[l] ?? [])
  ))
}
