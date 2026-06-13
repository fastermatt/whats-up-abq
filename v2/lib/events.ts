/**
 * Event data layer — reads from public.events (v1 ingestion table)
 * which has 1428+ real events from Ticketmaster, Eventbrite, SeatGeek, Volunteer, etc.
 *
 * v2.events is intentionally empty until Phase 2 ingestion is wired up.
 */
import { TZDate } from '@date-fns/tz'
import { createStaticClient } from '@/lib/supabase/static'
import { getTimeRange, TimeFilter, ABQ_TZ } from '@/lib/utils/dates'

// ─── Types ────────────────────────────────────────────────────────────────────

export type { TimeFilter }

export interface NormalizedEvent {
  id: string
  title: string
  date: string
  time: string | null
  venue: string | null
  address: string | null
  city: string | null
  category: string | null
  subcategory: string | null
  description: string | null
  price: string | null
  imageUrl: string | null
  ticketUrl: string | null
  source: string
  isFeatured: boolean
  // Location tags (from neighborhood + venue_slug DB columns)
  neighborhood: string | null
  venueSlug: string | null
  // LLM enrichment fields (from ai_enrichment column)
  about: string | null
  highlights: string[]
  venueTips: string | null
  localTips: string | null
  /** Real ABQ restaurants near the venue, with short descriptors. Verified during enrichment. */
  nearbyDining: { name: string; note?: string }[]
  /** A single sentence pairing the event with a real nearby thing (related venue / shop / bar). */
  localRec: string | null
  // Community submissions
  submitterHandle: string | null
}

export type CategoryFilter = string | null

export interface FetchEventsOptions {
  timeFilter?: TimeFilter
  category?: CategoryFilter
  mood?: string       // e.g. 'live-music' | 'date-night' | 'family-fun' etc.
  neighborhood?: string // neighborhood_slug e.g. 'downtown', 'unm-campus'
  search?: string
  freeOnly?: boolean
  maxPrice?: number   // 0 = free only; 25 = under $25; 50 = under $50
  date?: string       // YYYY-MM-DD — overrides timeFilter when set
  daypart?: Daypart   // morning | afternoon | evening — filters by start time
  christianMusic?: boolean // filter to events tagged christian_music: true in ai_enrichment
  limit?: number
  offset?: number
}

// ─── Calendar counts ──────────────────────────────────────────────────────────

export interface DateCount {
  date: string  // YYYY-MM-DD
  count: number
}

/** Returns event counts per day between startDate and endDate (inclusive).
 *  Only reads event_date — no raw JSONB fetched, so egress is minimal. */
export async function fetchEventCountsByDate(
  startDate: string,
  endDate: string,
): Promise<DateCount[]> {
  const supabase = createStaticClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('event_date')
    .eq('hidden', false)
    .gte('event_date', startDate)
    .lte('event_date', endDate)

  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { event_date: string | null }[]) {
    if (!row.event_date) continue
    counts[row.event_date] = (counts[row.event_date] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface FetchEventsResult {
  events: NormalizedEvent[]
  total: number
}

// ─── Raw row shape from public.events ────────────────────────────────────────

interface RawEventRow {
  id: string
  source: string
  raw: Record<string, unknown>
  event_date: string | null
  cached_photo_url: string | null
  ai_enrichment: Record<string, unknown> | null
  featured: boolean | null
  hidden: boolean | null
  pinned_last: boolean | null
  neighborhood: string | null
  venue_slug: string | null
  // Denormalized columns added 2026-04-16 for egress reduction
  category?: string | null
  venue_name?: string | null
  submitted_by?: string | null
  // Admin image control (added 2026-04-19): 'rejected' forces category fallback
  image_status?: 'unverified' | 'verified' | 'rejected' | null
}

// ─── Category counts ──────────────────────────────────────────────────────────

export interface CategoryCount {
  category: string
  count: number
}

/** Returns event counts per top-level category for the upcoming time range.
 *  Uses the denormalized `category` column — no raw JSONB fetched. */
export async function fetchCategoryCounts(): Promise<CategoryCount[]> {
  const supabase = createStaticClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('category')
    .eq('hidden', false)
    .gte('event_date', today)

  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { category: string | null }[]) {
    if (!row.category) continue
    counts[row.category] = (counts[row.category] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

// ─── Main fetch function ──────────────────────────────────────────────────────

// Columns for queries that need full normalisation (includes raw JSONB)
const COLS = 'id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, pinned_last, neighborhood, venue_slug, category, venue_name, submitted_by, image_status'

/** Normalize URL-safe category slug forms to canonical DB values.
 *  DB categories: Music, Comedy, Sports, Arts & Theater, Family, Festivals,
 *                 Food & Drink, Film, Outdoor, Community
 *  Handles: food-drink → "Food & Drink", arts-culture → "Arts & Theater", etc.
 *  Also handles raw DB values passed as-is (no-op for already-canonical names). */
export const CATEGORY_SLUG_MAP: Record<string, string> = {
  // Music
  'music':                'Music',
  // Comedy
  'comedy':               'Comedy',
  // Sports
  'sports':               'Sports',
  // Arts & Theater — many natural slug variants
  'arts':                 'Arts & Theater',
  'arts-culture':         'Arts & Theater',
  'arts-theater':         'Arts & Theater',
  'arts-and-theater':     'Arts & Theater',
  'arts-theatre':         'Arts & Theater',
  'theater':              'Arts & Theater',
  'theatre':              'Arts & Theater',
  // Food & Drink
  'food':                 'Food & Drink',
  'food-drink':           'Food & Drink',
  'food-and-drink':       'Food & Drink',
  'drink':                'Food & Drink',
  // Family
  'family':               'Family',
  'kids':                 'Family',
  // Festivals
  'festivals':            'Festivals',
  'festival':             'Festivals',
  // Film
  'film':                 'Film',
  'film-cinema':          'Film',
  'cinema':               'Film',
  'movies':               'Film',
  // Outdoor
  'outdoor':              'Outdoor',
  'outdoors':             'Outdoor',
  // Community
  'community':            'Community',
  // Nightlife — no DB category exists; map to Community so it returns results
  'nightlife':            'Community',
}

export async function fetchEvents({
  timeFilter = 'upcoming',
  category,
  mood,
  neighborhood,
  search,
  freeOnly = false,
  maxPrice,
  date,
  daypart,
  christianMusic,
  limit = 24,
  offset = 0,
}: FetchEventsOptions = {}): Promise<FetchEventsResult> {
  const supabase = createStaticClient()
  const { gte, lte } = getTimeRange(timeFilter)

  // Normalize URL slug category names to canonical DB values
  // e.g. "food-drink" → "Food & Drink", "arts-culture" → "Arts"
  const resolvedCategory = category
    ? (CATEGORY_SLUG_MAP[category.toLowerCase()] ?? category)
    : null

  // Parse category filter — top-level ("Music") vs subcategory ("Sports > Baseball")
  const topLevelCat = resolvedCategory
    ? (resolvedCategory.includes(' > ') ? resolvedCategory.split(' > ')[0] : resolvedCategory)
    : null
  const subCat = resolvedCategory?.includes(' > ') ? resolvedCategory.split(' > ')[1] : null

  // In-memory filtering is needed for: subcategory, search, freeOnly, maxPrice.
  // Mood filter is handled at DB level (ai_enrichment JSONB column).
  // When only a top-level category is given, we can do pure DB pagination.
  // 'tonight' always goes through in-memory so we can apply the 5 PM time cutoff
  // after fetching all of today's events (the DB gte is a bare date string — see
  // the comment in getTimeRange('tonight') in lib/utils/dates.ts).
  const needsInMemory = !!(subCat || search || freeOnly || maxPrice !== undefined || timeFilter === 'tonight' || daypart)

  if (!needsInMemory) {
    // ── Pure DB path: category filter + pagination in DB (no raw scan) ─────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .schema('public')
      .from('events')
      .select(COLS, { count: 'exact' })
      .eq('hidden', false)
      .order('pinned_last', { ascending: true })
      .order('event_date', { ascending: true })

    // date overrides timeFilter — exact day match
    if (date) {
      query = query.eq('event_date', date)
    } else {
      query = query.gte('event_date', gte)
      if (lte) query = query.lte('event_date', lte)
    }
    if (topLevelCat) query = query.eq('category', topLevelCat)
    if (mood) query = query.eq('ai_enrichment->>mood', mood)
    if (neighborhood) query = query.eq('neighborhood_slug', neighborhood)
    if (christianMusic) query = query.eq('ai_enrichment->>christian_music', 'true')

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) {
      console.error('[fetchEvents] Supabase error:', error.message)
      return { events: [], total: 0 }
    }

    const events = ((data ?? []) as RawEventRow[])
      .map(normalizeRow)
      .filter((e): e is NormalizedEvent => e !== null)
    return { events, total: count ?? 0 }
  }

  // ── In-memory path: pre-filter by top-level category in DB, then filter in JS ─
  // This still fetches raw JSONB but only for the matching category subset,
  // dramatically reducing egress vs fetching all ~994 events.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS)
    .eq('hidden', false)
    .order('event_date', { ascending: true })

  if (date) {
    q = q.eq('event_date', date)
  } else {
    q = q.gte('event_date', gte)
    if (lte) q = q.lte('event_date', lte)
  }
  if (topLevelCat) q = q.eq('category', topLevelCat)  // Pre-filter cuts dataset!
  if (mood) q = q.eq('ai_enrichment->>mood', mood)
  if (neighborhood) q = q.eq('neighborhood_slug', neighborhood)
  if (christianMusic) q = q.eq('ai_enrichment->>christian_music', 'true')  // mirror DB path (was dropped here)

  // Search pre-filter: push each term down to DB as ilike on title + venue columns.
  // This dramatically reduces rows fetched (avoids full-table JSONB scan).
  // The JS layer below still applies the full AND+word-boundary logic — this is
  // just a fast pre-filter, not a replacement. Filters on terms ≥ 3 chars only.
  if (search) {
    const searchTerms = search.toLowerCase().split(/\s+/).filter(t => t.length >= 3)
    if (searchTerms.length > 0) {
      // OR across all terms × both columns — returns anything matching any term,
      // JS layer refines to strict AND. Acceptable: some over-fetch, zero under-fetch.
      const orParts = searchTerms.flatMap(t =>
        [`venue_name.ilike.%${t}%`, `raw->>name.ilike.%${t}%`, `raw->>title.ilike.%${t}%`]
      ).join(',')
      q = q.or(orParts)
    }
  }

  const { data, error } = await q
  if (error) {
    console.error('[fetchEvents] Supabase error:', error.message)
    return { events: [], total: 0 }
  }

  let allNormalized = ((data ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)

  if (subCat) {
    // Subcategory filter: "Sports > Baseball" → filter by subcategory within the category
    allNormalized = allNormalized.filter(
      (e) => e.subcategory?.toLowerCase() === subCat.toLowerCase()
    )
  }

  if (search) {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
    allNormalized = allNormalized.filter((e) => {
      // Exclude volunteer food-bank shifts from keyword search — they flood results
      // for "food" because the venue name "Roadrunner Food Bank" matches, not the event
      if (e.id.startsWith('rrfb_')) return false
      const haystack = `${e.title} ${e.venue ?? ''} ${e.category ?? ''} ${e.subcategory ?? ''} ${e.description ?? ''}`.toLowerCase()
      return terms.every((t) => {
        // For terms ≥ 4 chars, require whole-word match to prevent "taco" matching "Tacoma",
        // "spring" matching "Springfield", etc. Short terms (< 4) use substring for
        // abbreviations like "abq", "nm", "kmo".
        // Both leading AND trailing \b are required — leading-only would let
        // "taco" still match "Tacoma" because the leading boundary fires after
        // "T". Trailing s? allows plural matches ("concert" → "concerts").
        if (t.length >= 4) {
          const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          return new RegExp(`\\b${escaped}s?\\b`, 'i').test(haystack)
        }
        return haystack.includes(t)
      })
    })
  }

  if (freeOnly) {
    // Only include events explicitly marked free — NOT null/unknown price events,
    // which are usually paid events with missing price data.
    allNormalized = allNormalized.filter((e) => {
      const p = (e.price ?? '').toLowerCase().trim()
      return p === 'free' || p === '$0' || p === '0'
    })
  }

  if (maxPrice !== undefined) {
    allNormalized = allNormalized.filter((e) => {
      const p = parsePriceMin(e.price)
      if (maxPrice === 0) return p === 0 || e.price === null
      return p === null || p <= maxPrice
    })
  }

  // Tonight-specific: drop events whose start time is known to be before 5 PM MDT.
  // See isEvening() for the parsing logic — handles both full-ISO timestamps
  // on event.date AND date-only events whose time lives in event.time.
  // Bug fixed 2026-05-09: previously, any event with a date-only event_date
  // was kept regardless of event.time, leaking morning events (e.g. 10 AM
  // Mother's Day Tea) into the Tonight feed.
  if (timeFilter === 'tonight') {
    allNormalized = allNormalized.filter(isEvening)
  }

  // Time-of-day filter: keep only events that start in the chosen daypart.
  // Events with an unknown start time are dropped (see inDaypart) so a
  // "Morning" filter can't be padded with timeless evening shows.
  if (daypart) {
    allNormalized = allNormalized.filter((e) => inDaypart(e, daypart))
  }

  return {
    events: allNormalized.slice(offset, offset + limit),
    total: allNormalized.length,
  }
}

/** Fetch highlighted upcoming events for the homepage.
 *
 *  Priority 1 — admin-marked featured=true events (manually curated).
 *  Priority 2 — smart algorithmic selection scored by desirability:
 *    - Base: popularity_score column (with heuristic fallback when null)
 *    - "Coming weekend" bonus: Mon–Thu → upcoming Fri/Sat/Sun get +2.5
 *    - "Today" bonus: events happening today get +1.0
 *    - Title dedup: only the highest-scoring variant per event surfaces
 *      (so "Boots Friday / Boots Saturday / Boots 2-day" fills one slot)
 *
 *  Net effect: the row surfaces what people are most likely to want to attend,
 *  with weekend events taking prominence Mon–Thu before they arrive.
 */
export async function fetchFeaturedEvents(limit = 6): Promise<NormalizedEvent[]> {
  const supabase = createStaticClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const in14 = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  const dow = now.getDay() // 0=Sun 1=Mon … 6=Sat

  // ── Priority 1: manual featured ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: featData } = await (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS)
    .eq('hidden', false)
    .eq('featured', true)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(limit)

  const featured = ((featData ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)

  if (featured.length >= limit) return featured

  // ── Priority 2: smart algorithmic highlights ──
  const HIGHLIGHT_CATS = ['Music', 'Comedy', 'Sports', 'Arts & Theater', 'Festivals', 'Community', 'Food & Drink', 'Family']
  const manualIds = new Set(featured.map((e) => e.id))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: autoData } = await (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS + ', popularity_score')
    .eq('hidden', false)
    .eq('featured', false)
    .gte('event_date', today)
    .lte('event_date', in14)
    .not('cached_photo_url', 'is', null)
    .in('category', HIGHLIGHT_CATS)
    .limit(80) // large pool — we score + filter in JS

  // Build the set of "coming weekend" dates for the bonus.
  // Mon–Thu: the upcoming Fri/Sat/Sun. Fri–Sun: the current weekend day(s) remaining.
  const weekendDates = new Set<string>()
  if (dow >= 1 && dow <= 4) {
    // Days until Friday: 4 on Mon, 3 on Tue, 2 on Wed, 1 on Thu
    const daysToFri = 5 - dow
    for (let d = 0; d < 3; d++) {
      weekendDates.add(new Date(Date.now() + (daysToFri + d) * 86_400_000).toISOString().slice(0, 10))
    }
  } else {
    // Already in the weekend — bonus for remaining days including today
    const daysLeft = dow === 5 ? 2 : dow === 6 ? 1 : 0
    for (let d = 0; d <= daysLeft; d++) {
      weekendDates.add(new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10))
    }
  }
  const preWeekend = dow >= 1 && dow <= 4 // Mon–Thu: pre-weekend context

  type ScoredRow = RawEventRow & { popularity_score?: number | null }

  function eventDesirabilityScore(row: ScoredRow): number {
    // Base: DB popularity_score or heuristic fallback
    let s = typeof row.popularity_score === 'number' ? row.popularity_score : _heuristicScore(row)
    const dateStr = String(row.event_date ?? '').slice(0, 10)
    // Coming-weekend bonus (stronger pre-weekend, weaker on the day)
    if (weekendDates.has(dateStr)) s += preWeekend ? 2.5 : 1.0
    // Today bonus — something happening right now is worth surfacing
    if (dateStr === today) s += 1.0
    return s
  }

  // Normalize title for dedup — strip ticket-tier qualifiers so variants
  // of the same event collapse to the highest-scoring one.
  function titleKey(title: string): string {
    return title
      .toLowerCase()
      .replace(/\s*\([^)]*\)/g, '')          // "(Friday Only)" etc.
      .replace(/\b(friday|saturday|sunday|2[\s-]?day\s+pass|day\s+pass|vip|general\s+admission)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const seenTitles = new Set<string>()
  const pool = ((autoData ?? []) as ScoredRow[])
    .filter((row) => !manualIds.has(String(row.id ?? '')))
    .sort((a, b) => eventDesirabilityScore(b) - eventDesirabilityScore(a))
    .reduce<NormalizedEvent[]>((acc, row) => {
      const evt = normalizeRow(row)
      if (!evt) return acc
      const key = titleKey(evt.title ?? '')
      if (seenTitles.has(key)) return acc  // keep first (highest-scoring) variant only
      seenTitles.add(key)
      acc.push(evt)
      return acc
    }, [])
    .slice(0, limit - featured.length)

  return [...featured, ...pool]
}

/** Heuristic desirability score when popularity_score is NULL.
 *  Mirrors the SQL expression in app/api/admin/ig/search/route.ts. */
function _heuristicScore(row: RawEventRow): number {
  const catScore: Record<string, number> = {
    Festivals: 7.5, Music: 7.0, 'Arts & Theater': 6.5, Comedy: 6.5,
    'Food & Drink': 6.0, Outdoor: 5.5, Sports: 5.5, Family: 5.0, Film: 4.5,
  }
  let s = catScore[row.category ?? ''] ?? 4.0

  const date = new Date(String(row.event_date ?? '') + 'T12:00:00')
  const d = date.getDay()
  if (d === 5 || d === 6) s += 1.5
  else if (d === 4) s += 0.8
  else if (d === 0) s += 0.5

  const raw = row.raw as Record<string, unknown>
  const time = String(
    (raw?.dates as Record<string, Record<string, unknown>>)?.start?.localTime ??
    raw?.time ?? ''
  )
  if (time && time >= '17:00') s += 0.5
  if (row.cached_photo_url) s += 0.3
  if (row.featured === true) s += 1.5
  const src = row.source ?? ''
  if (src === 'ticketmaster' || src === 'seatgeek') s += 0.5

  return Math.min(10, Math.max(1, s))
}

// ─── Neighborhood helpers ─────────────────────────────────────────────────────

export interface NeighborhoodCount {
  neighborhood: string
  count: number
  slug: string
}

/** Convert a neighborhood name to a URL-safe slug */
export function neighborhoodToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Convert a venue name to a URL-safe slug. Idempotent. Must match the
 *  venueToSlug() in venues/[slug]/page.tsx exactly:
 *  1. Strip apostrophes/quotes first ("Hyena's" → "hyenas")
 *  2. Collapse non-alphanum runs to single hyphens
 *  3. Strip leading/trailing hyphens */
export function venueToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Fetch upcoming events in a specific neighborhood by slug.
 *  Uses the generated `neighborhood_slug` DB column — no in-memory filter needed. */
export async function fetchEventsByNeighborhood(slug: string, limit = 30): Promise<NormalizedEvent[]> {
  const supabase = createStaticClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS)
    .eq('hidden', false)
    .gte('event_date', today)
    .eq('neighborhood_slug', slug)   // DB-level filter — no in-memory scan
    .order('event_date', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[fetchEventsByNeighborhood] Supabase error:', error.message)
    return []
  }

  return ((data ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
}

/** Fetch neighborhood event counts — used for the homepage neighborhood section */
export async function fetchNeighborhoodCounts(): Promise<NeighborhoodCount[]> {
  const supabase = createStaticClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('neighborhood, neighborhood_slug')
    .eq('hidden', false)
    .gte('event_date', today)
    .not('neighborhood', 'is', null)

  if (error) return []

  // Aggregate by SLUG, not by raw name. Two name variants that resolve to the
  // same slug ("Downtown" vs "Downtown Albuquerque") otherwise produced two
  // separate cards with the same React key AND split one neighborhood's events
  // across both — so the homepage undercounted and React logged duplicate-key
  // errors. Grouping on the DB-generated `neighborhood_slug` (with a derived
  // fallback) also guarantees the card's link matches exactly what the
  // neighborhood page filters on (.eq('neighborhood_slug', slug)).
  const agg: Record<string, { count: number; labels: Record<string, number> }> = {}
  for (const row of (data ?? []) as { neighborhood: string; neighborhood_slug: string | null }[]) {
    const name = row.neighborhood
    if (!name) continue
    const slug = row.neighborhood_slug || neighborhoodToSlug(name)
    if (!slug) continue
    const bucket = (agg[slug] ??= { count: 0, labels: {} })
    bucket.count += 1
    bucket.labels[name] = (bucket.labels[name] ?? 0) + 1
  }

  return Object.entries(agg)
    .map(([slug, { count, labels }]) => ({
      // Display the most common raw-name variant for this slug.
      neighborhood: Object.entries(labels).sort((a, b) => b[1] - a[1])[0][0],
      count,
      slug,
    }))
    .sort((a, b) => b.count - a.count)
}

/** Fetch upcoming events at a specific venue (case-insensitive partial match on venue name).
 *  Uses the denormalized `venue_name` DB column — no in-memory scan needed. */
export async function fetchEventsByVenue(venueName: string, limit = 20): Promise<NormalizedEvent[]> {
  const supabase = createStaticClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS)
    .eq('hidden', false)
    .gte('event_date', today)
    .eq('venue_name', venueName)  // exact match — see fetchVenueBySlug for slug → name resolution
    .order('event_date', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[fetchEventsByVenue] Supabase error:', error.message)
    return []
  }

  return ((data ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
}

/** Resolve a URL slug back to its canonical venue_name (with apostrophes,
 *  hyphens, and casing intact). Uses fetchTopVenues internally so it covers
 *  the same ~80 venues we pre-render. Returns null if no venue matches.
 *
 *  norm() must match venueToSlug() in venues/[slug]/page.tsx exactly:
 *  strip apostrophes/quotes first so "Hyena's" → "hyenas" (not "hyena-s"). */
export async function fetchVenueBySlug(slug: string): Promise<string | null> {
  const norm = (s: string) =>
    s.toLowerCase()
      .replace(/[''`"]/g, '')        // strip apostrophes/quotes before hyphenating
      .replace(/[^a-z0-9]+/g, '-')  // non-alphanum runs → single hyphen
      .replace(/^-|-$/g, '')
  const target = norm(decodeURIComponent(slug))
  const venues = await fetchTopVenues(200)
  const hit = venues.find(v => norm(v.venueName) === target)
  return hit?.venueName ?? null
}

/** Return top venues by upcoming event count — used for generateStaticParams pre-rendering.
 *  Uses a cookie-free Supabase client so it works at build time. */
export async function fetchTopVenues(limit = 60): Promise<{ venueName: string; count: number }[]> {
  // Use a simple fetch-based client to avoid cookies() which is unavailable at build time
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://bsmvfutebmbkjvlrhiyq.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const today = new Date().toISOString().slice(0, 10)

  const endpoint =
    `${url}/rest/v1/events?select=venue_name&hidden=eq.false&event_date=gte.${today}&venue_name=not.is.null&limit=5000`

  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 3600 },
  })

  if (!res.ok) return []

  const data = (await res.json()) as { venue_name: string }[]

  // Count by venue name in-memory
  const counts: Record<string, number> = {}
  for (const row of data) {
    if (row.venue_name) counts[row.venue_name] = (counts[row.venue_name] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([venueName, count]) => ({ venueName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** Fetch recently added upcoming events (newest ingestion first). */
export async function fetchRecentlyAdded(limit = 10): Promise<NormalizedEvent[]> {
  const supabase = createStaticClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS + ', created_at')
    .eq('hidden', false)
    .gte('event_date', today)
    .order('created_at', { ascending: false })
    .limit(limit * 3) // fetch extra to account for normalization failures

  if (error) {
    console.error('[fetchRecentlyAdded] Supabase error:', error.message)
    return []
  }

  return ((data ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
    .slice(0, limit)
}

// ─── Source priority scoring ──────────────────────────────────────────────────

/** Higher = shown first in ranked editorial feeds */
function sourcePriority(source: string): number {
  switch (source) {
    case 'nhcc':         return 5
    case 'seatgeek':     return 4
    case 'ticketmaster': return 3
    case 'eventbrite':   return 2
    case 'local':        return 1
    case 'volunteer':    return 0
    default:             return 0
  }
}

// ─── Category demand scoring (homepage rails only) ────────────────────────────

/**
 * Category demand-score map — derived from internal click analytics.
 *
 * Demand signal: top-clicked categories on the homepage are Music (Concerts),
 * Comedy, Sports, and Free events. Top searches are music acts and the
 * Isotopes (sports). Meanwhile the upcoming-30-day supply is 37% Community,
 * 22% Music — i.e. Community is heavily over-represented vs what users
 * actually click on.
 *
 * Lower score = surfaced earlier. We deprioritize Community without hiding
 * it (it stays in the pool, just ranks below the high-demand categories).
 *
 * Apply via `rankByCategoryDemand()` on homepage rails ONLY (Tonight,
 * Weekend, Featured). The /events listing must keep its native sort so
 * the user-facing filter UI works as expected.
 */
const CATEGORY_DEMAND_SCORE: Record<string, number> = {
  'Music':          0,
  'Comedy':         0,
  'Sports':         0,
  'Arts & Theater': 1,
  'Festivals':      1,
  'Food & Drink':   2,
  'Family':         2,
  'Community':      3,
}

function categoryDemandRank(category: string | null): number {
  if (!category) return 3
  return CATEGORY_DEMAND_SCORE[category] ?? 2
}

/**
 * Re-rank an event list by category demand, then preserve the input order
 * as a stable tiebreaker (so date/featured/photo ordering from the caller
 * survives within each demand tier).
 *
 * Pure function — returns a new array, does not mutate input.
 *
 * Use ONLY on homepage editorial rails (Tonight, Weekend, Featured). Do not
 * apply to the /events listing page — users expect their filters to drive
 * sort there, not opaque demand weighting.
 */
export function rankByCategoryDemand<T extends { category: string | null }>(events: T[]): T[] {
  return events
    .map((event, idx) => ({ event, idx }))
    .sort((a, b) => {
      const ra = categoryDemandRank(a.event.category)
      const rb = categoryDemandRank(b.event.category)
      if (ra !== rb) return ra - rb
      return a.idx - b.idx
    })
    .map(({ event }) => event)
}

/** Tonight's events (today in Denver time, evening only), ranked:
 *  featured DESC → has_photo DESC → source_priority DESC → event_date ASC.
 *  Returns up to 60.
 *
 *  "Evening" = start time at or after 5 PM MDT. Events with truly unknown
 *  times are kept (might be evening shows). Morning/afternoon events with a
 *  known start time are dropped. */
export async function fetchTonightRanked(limit = 60): Promise<NormalizedEvent[]> {
  const supabase = createStaticClient()
  // Compute today's date in Denver timezone
  const todayDenver = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' }) // YYYY-MM-DD

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS)
    .eq('hidden', false)
    .eq('event_date', todayDenver)
    .order('featured',    { ascending: false })
    .order('pinned_last', { ascending: true })
    .order('event_date',  { ascending: true })
    .limit(limit * 4) // fetch extra to sort in JS for photo + priority

  if (error) {
    console.error('[fetchTonightRanked] Supabase error:', error.message)
    return []
  }

  return ((data ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
    .filter(isEvening)
    .sort((a, b) => {
      // featured DESC
      if ((b.isFeatured ? 1 : 0) !== (a.isFeatured ? 1 : 0))
        return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)
      // has_photo DESC
      const aPhoto = a.imageUrl ? 1 : 0
      const bPhoto = b.imageUrl ? 1 : 0
      if (bPhoto !== aPhoto) return bPhoto - aPhoto
      // source_priority DESC
      const aPri = sourcePriority(a.source)
      const bPri = sourcePriority(b.source)
      if (bPri !== aPri) return bPri - aPri
      // event_date ASC
      return a.date.localeCompare(b.date)
    })
    .slice(0, limit)
}

/**
 * Predicate: is this event happening in the evening (≥5 PM MDT)?
 * Used by the Tonight ranked feed and the Tonight time filter to keep
 * morning events out of "tonight" sections. Events with an unknown time
 * are kept since they might be evening shows.
 */
/** Parse an event's start hour (0-23) in ABQ time, or null if unknown.
 *  Handles both full-ISO timestamps on event.date AND date-only events whose
 *  time lives in the separate event.time string ("10:00 AM" / "19:30"). */
function eventStartHour(event: NormalizedEvent): number | null {
  // Full ISO timestamp on event.date — read the hour directly
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
    try {
      return new TZDate(new Date(event.date), ABQ_TZ).getHours()
    } catch { return null }
  }
  // Date-only: parse the separate event.time string
  const t = event.time?.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/)
  if (!m) return null
  let hr = parseInt(m[1], 10)
  const meridian = m[3]?.toUpperCase()
  if (meridian === 'PM' && hr < 12) hr += 12
  if (meridian === 'AM' && hr === 12) hr = 0
  return hr
}

function isEvening(event: NormalizedEvent): boolean {
  const hr = eventStartHour(event)
  return hr === null ? true : hr >= 17 // unknown time kept — might be an evening show
}

export type Daypart = 'morning' | 'afternoon' | 'evening'

/** Does this event start within the given daypart? Events with an UNKNOWN start
 *  time return false — a daypart filter should only surface events we can
 *  actually confirm fall in that window, not pad results with timeless events. */
function inDaypart(event: NormalizedEvent, daypart: Daypart): boolean {
  const hr = eventStartHour(event)
  if (hr === null) return false
  if (daypart === 'morning')   return hr < 12
  if (daypart === 'afternoon') return hr >= 12 && hr < 17
  return hr >= 17 // evening
}

/** Weekend events (Fri/Sat/Sun), ranked same as tonight.
 *  If today is Mon–Thu: uses the coming Fri–Sun.
 *  If today is Fri/Sat/Sun: uses the current weekend.
 *  Returns up to 100. */
export async function fetchWeekendRanked(limit = 100): Promise<NormalizedEvent[]> {
  const supabase = createStaticClient()

  // Compute day-of-week in Denver timezone (0=Sun … 6=Sat)
  const nowDenver = new Date().toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'short' })
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayIndex = dayNames.indexOf(nowDenver)
  const todayDenver = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' })

  // Compute Fri/Sat/Sun as YYYY-MM-DD strings
  let fridayOffset: number
  if (dayIndex === 0) fridayOffset = -2       // Sunday: Fri was 2 days ago
  else if (dayIndex === 6) fridayOffset = -1  // Saturday: Fri was yesterday
  else if (dayIndex === 5) fridayOffset = 0   // Friday: today is Friday
  else fridayOffset = 5 - dayIndex            // Mon–Thu: days until Friday

  const fridayDate = new Date(
    new Date(todayDenver + 'T12:00:00').getTime() + fridayOffset * 86400_000
  ).toLocaleDateString('en-CA', { timeZone: 'UTC' })
  const satDate = new Date(
    new Date(fridayDate + 'T12:00:00').getTime() + 1 * 86400_000
  ).toLocaleDateString('en-CA', { timeZone: 'UTC' })
  const sunDate = new Date(
    new Date(fridayDate + 'T12:00:00').getTime() + 2 * 86400_000
  ).toLocaleDateString('en-CA', { timeZone: 'UTC' })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS)
    .eq('hidden', false)
    .in('event_date', [fridayDate, satDate, sunDate])
    .order('featured',   { ascending: false })
    .order('event_date', { ascending: true })
    .limit(limit * 4)

  if (error) {
    console.error('[fetchWeekendRanked] Supabase error:', error.message)
    return []
  }

  return ((data ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
    .sort((a, b) => {
      if ((b.isFeatured ? 1 : 0) !== (a.isFeatured ? 1 : 0))
        return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)
      const aPhoto = a.imageUrl ? 1 : 0
      const bPhoto = b.imageUrl ? 1 : 0
      if (bPhoto !== aPhoto) return bPhoto - aPhoto
      const aPri = sourcePriority(a.source)
      const bPri = sourcePriority(b.source)
      if (bPri !== aPri) return bPri - aPri
      return a.date.localeCompare(b.date)
    })
    .slice(0, limit)
}

/** Compute the Fri/Sat/Sun dates for the weekend display heading. */
export function getWeekendDates(): { fri: string; sat: string; sun: string } {
  const nowDenver = new Date().toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'short' })
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayIndex = dayNames.indexOf(nowDenver)
  const todayDenver = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' })

  let fridayOffset: number
  if (dayIndex === 0) fridayOffset = -2
  else if (dayIndex === 6) fridayOffset = -1
  else if (dayIndex === 5) fridayOffset = 0
  else fridayOffset = 5 - dayIndex

  const toDate = (offset: number) =>
    new Date(
      new Date(todayDenver + 'T12:00:00').getTime() + offset * 86400_000
    ).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    })

  return {
    fri: toDate(fridayOffset),
    sat: toDate(fridayOffset + 1),
    sun: toDate(fridayOffset + 2),
  }
}

export async function fetchEventById(id: string): Promise<NormalizedEvent | null> {
  const supabase = createStaticClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS)
    .eq('id', id)
    .single()

  if (error || !data) return null
  const row = data as RawEventRow
  const evt = normalizeRow(row)
  if (!evt) return null

  // Fetch submitter handle for community events
  if (row.source === 'community' && row.submitted_by) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('handle')
      .eq('id', row.submitted_by)
      .single()
    if (profile?.handle) evt.submitterHandle = profile.handle
  }

  return evt
}

// ─── Row → NormalizedEvent ────────────────────────────────────────────────────

export function normalizeRow(row: RawEventRow): NormalizedEvent | null {
  try {
    let evt: NormalizedEvent | null
    switch (row.source) {
      case 'ticketmaster': evt = normalizeTM(row); break
      case 'eventbrite':   evt = normalizeEB(row); break
      case 'seatgeek':     evt = normalizeSG(row); break
      case 'bandsintown':  evt = normalizeBIT(row); break
      case 'local':        evt = normalizeLocal(row); break
      case 'volunteer':    evt = normalizeLocal(row); break  // volunteer events are always free
      case 'nhcc':         evt = normalizeLocal(row); break  // NHCC community events
      case 'submitted':    evt = normalizeLocal(row); break  // community-submitted, admin-approved
      case 'local-venue':  evt = normalizeLocalVenue(row); break  // brewery/bar direct scrapes
      default:             evt = normalizeGeneric(row)
    }
    // Pass through DB columns
    if (evt) {
      evt.neighborhood    = row.neighborhood  ?? null
      evt.venueSlug       = row.venue_slug    ?? null
      evt.submitterHandle = null  // populated in fetchEventById for community events
      // Use denormalized DB category when available (consistent with DB filtering).
      // The backfill in migration add_denormalized_category_venue_columns already
      // incorporates both the code classifier and AI enrichment overrides.
      if (row.category != null) evt.category = row.category
      // Fall back to DB venue_name for sources whose normalizer couldn't extract it
      if (evt.venue === null && row.venue_name != null) evt.venue = decodeHtml(row.venue_name) || null
      // ADMIN IMAGE CONTROL: image_status='rejected' kills the image across ALL sources.
      // Consumers fall back to getCategoryFallback(). This is the single chokepoint
      // so a wrong image (TM/SG/EB/R2 cache/any future mess) gets neutralized with
      // one DB flag. Added 2026-04-19 to stop the whack-a-mole wrong-image bug.
      if (row.image_status === 'rejected') evt.imageUrl = null
    }
    // Apply ai_enrichment overrides (from LLM enrichment pass)
    if (evt && row.ai_enrichment) {
      const ai = row.ai_enrichment as Record<string, unknown>
      // Only let AI override category when DB column is also null (new events not yet backfilled)
      if (typeof ai.category === 'string' && evt.category === null) evt.category = ai.category
      if (typeof ai.subcategory === 'string' && evt.subcategory === null) evt.subcategory = ai.subcategory
      if (typeof ai.about === 'string')       evt.about      = ai.about
      if (Array.isArray(ai.highlights)) {
        // Filter out boilerplate highlights like "Live music event." that add
        // no value vs showing nothing. They're a known Gemma autogen failure mode.
        evt.highlights = (ai.highlights as unknown[])
          .map(h => String(h))
          .filter(h => !BOILERPLATE_DESCRIPTIONS.has(h.toLowerCase().trim()))
      }
      if (typeof ai.venue_tips === 'string')  evt.venueTips  = ai.venue_tips
      if (typeof ai.local_tips === 'string')  evt.localTips  = ai.local_tips
      if (typeof ai.local_rec === 'string')   evt.localRec   = ai.local_rec
      if (Array.isArray(ai.nearby_dining)) {
        // Accept either string entries or {name, note} objects
        evt.nearbyDining = (ai.nearby_dining as unknown[])
          .map(item => {
            if (typeof item === 'string') return { name: item }
            if (item && typeof item === 'object') {
              const obj = item as Record<string, unknown>
              const name = typeof obj.name === 'string' ? obj.name : null
              if (!name) return null
              const note = typeof obj.note === 'string' ? obj.note : undefined
              return { name, note }
            }
            return null
          })
          .filter((x): x is { name: string; note?: string } => x !== null)
          .slice(0, 4)
      }
    }
    return evt
  } catch {
    return null
  }
}

// ─── Source-specific normalizers ──────────────────────────────────────────────

function normalizeTM(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  const embedded = r._embedded as Record<string, unknown> | undefined
  const venues = embedded?.venues as Array<Record<string, unknown>> | undefined
  const v = venues?.[0] ?? null
  const priceRanges = r.priceRanges as Array<Record<string, unknown>> | undefined
  const classifications = r.classifications as Array<Record<string, unknown>> | undefined
  const images = r.images as Array<Record<string, unknown>> | undefined

  const minPrice = priceRanges?.[0]?.min as number | undefined
  const maxPrice = priceRanges?.[0]?.max as number | undefined
  let priceStr: string | null = null
  if (minPrice != null && maxPrice != null) {
    priceStr = minPrice === maxPrice
      ? `$${Math.round(minPrice)}`
      : `$${Math.round(minPrice)}–$${Math.round(maxPrice)}`
  } else if (minPrice != null) {
    priceStr = `From $${Math.round(minPrice)}`
  }

  const segment = (classifications?.[0]?.segment as Record<string, unknown> | undefined)?.name as string | undefined
  const genre = (classifications?.[0]?.genre as Record<string, unknown> | undefined)?.name as string | undefined

  // Prefer non-fallback images — TM marks generic venue/stadium placeholders as fallback:true
  const realImages = images?.filter(i => !i.fallback)
  const image = row.cached_photo_url
    ?? realImages?.find(i => i.ratio === '16_9' && (i.width as number) >= 640)?.url as string | undefined
    ?? realImages?.[0]?.url as string | undefined
    ?? images?.find(i => i.ratio === '16_9' && (i.width as number) >= 640)?.url as string | undefined
    ?? images?.[0]?.url as string | undefined
    ?? null

  const startObj = (r.dates as Record<string, unknown> | undefined)?.start as Record<string, unknown> | undefined
  const startTime = startObj?.dateTime as string | undefined
  const startLocalDate = startObj?.localDate as string | undefined
  const startLocalTime = startObj?.localTime as string | undefined

  return {
    id: row.id,
    title: (r.name as string) ?? 'Untitled Event',
    date: row.event_date ?? startLocalDate ?? startTime ?? '',
    // Prefer localTime (venue-local, no UTC shift). dateTime is UTC and causes wrong display.
    // Require BOTH date and time — formatTime returns '' for a bare 'T19:30' string.
    time: (startLocalDate && startLocalTime)
      ? formatTime(`${startLocalDate}T${startLocalTime}`)
      : startTime
      ? formatTime(startTime)
      : null,
    venue: (v?.name as string | undefined) ?? null,
    address: v ? buildTMAddress(v) : null,
    city: (v?.city as Record<string, unknown> | undefined)?.name as string | null ?? null,
    ...mapCategory(segment, genre),
    description: null,
    price: priceStr,
    imageUrl: (image as string | null) ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'ticketmaster',
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null, submitterHandle: null,
    about: null, highlights: [], venueTips: null, localTips: null, nearbyDining: [], localRec: null,
  }
}

function normalizeEB(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  // EB events are stored in TM-compatible format — venue lives in _embedded.venues[0].
  // r.venue (native EB format) is always null for our ingested rows; kept as fallback for any edge cases.
  const embedded = r._embedded as Record<string, unknown> | undefined
  const embeddedVenues = embedded?.venues as Array<Record<string, unknown>> | undefined
  const embeddedVenue = embeddedVenues?.[0] ?? null
  const nativeVenue = r.venue as Record<string, unknown> | undefined
  const venue = embeddedVenue ?? nativeVenue ?? null
  const isTMFormat = embeddedVenue != null   // TM format uses city.name; native EB uses address.city
  // Data is stored in TM-compatible camelCase (isFree) not native EB snake_case (is_free)
  const isFree = (r.isFree ?? r.is_free) as boolean | undefined
  const tickets = r.ticket_availability as Record<string, unknown> | undefined
  const minTicket = tickets?.minimum_ticket_price as Record<string, unknown> | undefined
  const cost = isFree
    ? 'Free'
    : minTicket?.major_value != null
      ? `From $${Math.round(minTicket.major_value as number)}`
      : null

  const nameField = r.name as Record<string, unknown> | string | undefined
  const title = typeof nameField === 'object' && nameField
    ? (nameField.text as string)
    : (nameField as string) ?? 'Untitled Event'

  // EB events are stored in TM-compatible format (dates.start.localDate/localTime)
  // Native EB paths (r.start.local / r.start.utc) are null in our DB
  const ebStartObj = (r.dates as Record<string, unknown> | undefined)?.start as Record<string, unknown> | undefined
  const ebLocalDate = ebStartObj?.localDate as string | undefined
  const ebLocalTime = ebStartObj?.localTime as string | undefined
  // Also check native EB paths as fallback (in case some rows use original EB format)
  const ebNativeStart = r.start as Record<string, unknown> | undefined
  const ebNativeLocal = ebNativeStart?.local as string | undefined
  const ebNativeUtc   = ebNativeStart?.utc   as string | undefined

  return {
    id: row.id,
    title,
    date: row.event_date ?? ebLocalDate ?? ebNativeLocal ?? ebNativeUtc ?? '',
    // TM-compat localDate+localTime is the primary signal; native EB paths as fallback
    time: (ebLocalDate && ebLocalTime)
      ? formatTime(`${ebLocalDate}T${ebLocalTime}`)
      : ebNativeLocal ? formatTime(ebNativeLocal)
      : ebNativeUtc   ? formatTime(ebNativeUtc)
      : null,
    // If venue.name looks like a street address (starts with digits), skip it as a name —
    // the actual address is already captured via buildTMAddress(). Use row.venue_name only
    // if it doesn't also look like a street address.
    venue: (() => {
      const raw = (venue?.name as string | undefined)?.trim() ?? row.venue_name ?? null
      return raw && /^\d+\s/.test(raw) ? null : raw
    })(),
    address: (() => {
      const built = venue ? (isTMFormat ? buildTMAddress(venue) : buildEBAddress(venue)) : null
      // If venue.name was a street address, promote it to the address field if nothing better exists
      const nameAsAddr = (venue?.name as string | undefined)?.trim()
      return built ?? (nameAsAddr && /^\d+\s/.test(nameAsAddr) ? nameAsAddr : null)
    })(),
    city: isTMFormat
      ? (venue?.city as Record<string, unknown> | undefined)?.name as string | null ?? null
      : (venue?.address as Record<string, unknown> | undefined)?.city as string | null ?? null,
    ...mapCategory(
      (r.category as Record<string, unknown> | undefined)?.name as string | undefined,
      title
    ),
    description: cleanDescription((r.description as Record<string, unknown> | undefined)?.text as string | undefined),
    price: cost,
    imageUrl: row.cached_photo_url ?? (r.logo as Record<string, unknown> | undefined)?.url as string | null ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'eventbrite',
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null, submitterHandle: null,
    about: null, highlights: [], venueTips: null, localTips: null, nearbyDining: [], localRec: null,
  }
}

function normalizeSG(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>

  // SeatGeek events were ingested in TM-compatible format (name, _embedded, classifications)
  const embedded = r._embedded as Record<string, unknown> | undefined
  const venues = embedded?.venues as Array<Record<string, unknown>> | undefined
  const v = venues?.[0] ?? null
  const classifications = r.classifications as Array<Record<string, unknown>> | undefined
  const priceRanges = r.priceRanges as Array<Record<string, unknown>> | undefined
  const images = r.images as Array<Record<string, unknown>> | undefined

  const minPrice = priceRanges?.[0]?.min as number | undefined
  const maxPrice = priceRanges?.[0]?.max as number | undefined
  let priceStr: string | null = null
  if (minPrice != null && maxPrice != null) {
    priceStr = minPrice === maxPrice
      ? `$${Math.round(minPrice)}`
      : `$${Math.round(minPrice)}–$${Math.round(maxPrice)}`
  } else if (minPrice != null) {
    priceStr = `From $${Math.round(minPrice)}`
  }

  const segment = (classifications?.[0]?.segment as Record<string, unknown> | undefined)?.name as string | undefined
  const genre = (classifications?.[0]?.genre as Record<string, unknown> | undefined)?.name as string | undefined
  const title = (r.name as string | undefined) ?? 'Untitled Event'

  const startObj = (r.dates as Record<string, unknown> | undefined)?.start as Record<string, unknown> | undefined
  const startTime = startObj?.dateTime as string | undefined
  const startDate = startObj?.localDate as string | undefined
  const startLocal = startObj?.localTime as string | undefined

  const image = row.cached_photo_url
    ?? images?.find(i => i.ratio === '16_9' && (i.width as number) >= 640)?.url as string | undefined
    ?? images?.[0]?.url as string | undefined
    ?? null

  return {
    id: row.id,
    title,
    date: row.event_date ?? startDate ?? startTime ?? '',
    time: (startDate && startLocal) ? formatTime(`${startDate}T${startLocal}`) : startTime ? formatTime(startTime) : null,
    venue: (v?.name as string | undefined) ?? null,
    address: v ? buildTMAddress(v) : null,
    city: (v?.city as Record<string, unknown> | undefined)?.name as string | null ?? null,
    ...mapCategory(segment, genre ?? title),
    description: (() => {
      const rawInfo = r.info as string | undefined
      // Filter out raw SeatGeek category path strings like "Comedy / theater_comedy performance."
      // These leak in when perf.description is a SG internal category descriptor, not a real description.
      const isSGCategoryStr = rawInfo != null && /\/\s*\w+_\w/.test(rawInfo) && rawInfo.length < 120
      return isSGCategoryStr ? null : cleanDescription(rawInfo)
    })(),
    price: priceStr,
    imageUrl: (image as string | null) ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'seatgeek',
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null, submitterHandle: null,
    about: null, highlights: [], venueTips: null, localTips: null, nearbyDining: [], localRec: null,
  }
}

function normalizeBIT(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  const venue = r.venue as Record<string, unknown> | undefined
  const lineup = r.lineup as string[] | undefined
  const dt = r.datetime as string | undefined

  return {
    id: row.id,
    title: (r.title as string) ?? lineup?.[0] ?? 'Concert',
    date: row.event_date ?? dt ?? '',
    time: dt ? formatTime(dt) : null,
    venue: (venue?.name as string | undefined) ?? null,
    address: (venue?.location as string | undefined) ?? null,
    city: (venue?.city as string | undefined) ?? null,
    category: 'Music',
    subcategory: null,
    description: cleanDescription(r.description as string | undefined),
    price: null,
    imageUrl: row.cached_photo_url
      ?? (r.artist as Record<string, unknown> | undefined)?.image_url as string | undefined
      ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'bandsintown',
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null, submitterHandle: null,
    about: null, highlights: [], venueTips: null, localTips: null, nearbyDining: [], localRec: null,
  }
}

function normalizeLocal(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  // All volunteer events are free; local events may carry an isFree flag
  const isFree = row.source === 'volunteer' || r.isFree === true
  // Time stored in TM-compat format (dates.start.localDate/localTime) for imported events
  const localStartObj = (r.dates as Record<string, unknown> | undefined)?.start as Record<string, unknown> | undefined
  const localStartDate = localStartObj?.localDate as string | undefined
  const localStartTime = localStartObj?.localTime as string | undefined
  // abqtodo importer uses TM-compat format: address lives at _embedded.venues[0].address.line1
  const embedded = r._embedded as Record<string, unknown> | undefined
  const tmVenues = embedded?.venues as Array<Record<string, unknown>> | undefined
  const tmVenue = tmVenues?.[0]
  return {
    id: row.id,
    title: decodeHtml((r.title as string) ?? (r.name as string)) || 'Local Event',
    date: row.event_date ?? localStartDate ?? (r.date as string) ?? (r.start_date as string) ?? '',
    time: (localStartDate && localStartTime)
      ? formatTime(`${localStartDate}T${localStartTime}`)
      : (() => {
          // r.time may be a plain human-readable string (e.g. "4:00 PM – 9:00 PM") set by manual importers
          const rawTime = r.time as string | undefined
          if (rawTime) return rawTime
          return row.event_date ? (formatTime(row.event_date) || null) : null
        })(),
    venue: decodeHtml(
      typeof r.venue === 'string' ? r.venue
      : (r.venue_name as string | undefined)
      ?? (tmVenue?.name as string | undefined)
      ?? null
    ) || null,
    // Address fallback chain: explicit `address` string → TM-format _embedded.venues[0].address.line1
    address: decodeHtml((r.address as string | undefined) ?? null)
      || (tmVenue ? buildTMAddress(tmVenue) : null)
      || null,
    city: (r.city as string | undefined)
      ?? ((tmVenue?.city as Record<string, unknown> | undefined)?.name as string | undefined)
      ?? 'Albuquerque',
    ...mapCategory(
      (r.category as string | undefined),
      (r.title as string | undefined) ?? (r.name as string | undefined)
    ),
    description: cleanDescription(r.description as string | undefined),
    price: (() => {
      if (isFree) return 'Free'
      // Explicit string fields (legacy local/volunteer format)
      const strPrice = (r.price as string | undefined) ?? (r.cost as string | undefined)
      if (strPrice) return strPrice
      // priceRanges array (same TM-compat format used by abqtodo/do505 importers)
      const ranges = r.priceRanges as Array<Record<string, unknown>> | undefined
      const minP = ranges?.[0]?.min as number | undefined
      const maxP = ranges?.[0]?.max as number | undefined
      if (minP !== undefined && maxP !== undefined && minP > 0) {
        return minP === maxP ? `$${Math.round(minP)}` : `$${Math.round(minP)}–$${Math.round(maxP)}`
      }
      return null
    })(),
    imageUrl: row.cached_photo_url
      ?? (r.image as string | undefined)
      ?? ((r.images as Array<Record<string, unknown>> | undefined)?.[0]?.url as string | undefined)
      ?? null,
    ticketUrl: (r.url as string | undefined) ?? (r.ticket_url as string | undefined) ?? null,
    source: row.source,
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null, submitterHandle: null,
    about: null, highlights: [], venueTips: null, localTips: null, nearbyDining: [], localRec: null,
  }
}

function normalizeLocalVenue(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  const localStartObj = (r.dates as Record<string, unknown> | undefined)?.start as Record<string, unknown> | undefined
  const localStartDate = localStartObj?.localDate as string | undefined
  const localStartTime = localStartObj?.localTime as string | undefined
  const title = decodeHtml((r.title as string) ?? (r.name as string)) || 'Live Music'
  return {
    id: row.id,
    title,
    date: row.event_date ?? localStartDate ?? '',
    time: (localStartDate && localStartTime)
      ? formatTime(`${localStartDate}T${localStartTime}`)
      : row.event_date ? (formatTime(row.event_date) || null) : null,
    venue: decodeHtml((r.venue_name as string) ?? (r.venue as string) ?? null) || null,
    address: decodeHtml((r.address as string | undefined) ?? null) || null,
    city: (r.city as string | undefined) ?? 'Albuquerque',
    ...mapCategory((r.category as string | undefined), title),
    description: (r.notes as string | undefined) ?? null,
    price: null,  // local venue events scraped from website — no ticket price
    imageUrl: null,  // no image for direct venue scrapes; EventCard uses venue fallback
    ticketUrl: (r.source_url as string | undefined) ?? null,
    source: row.source,
    isFeatured: false,
    neighborhood: null, venueSlug: null, submitterHandle: null,
    about: null, highlights: [], venueTips: null, localTips: null, nearbyDining: [], localRec: null,
  }
}

function normalizeGeneric(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  const title = decodeHtml((r.name as string) ?? (r.title as string)) || 'Event'
  return {
    id: row.id,
    title,
    date: row.event_date ?? '',
    time: row.event_date ? (formatTime(row.event_date) || null) : null,
    venue: null,
    address: null,
    city: null,
    ...mapCategory((r.category as string | undefined), title),
    description: null,
    price: null,
    imageUrl: row.cached_photo_url ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: row.source,
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null, submitterHandle: null,
    about: null, highlights: [], venueTips: null, localTips: null, nearbyDining: [], localRec: null,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse the minimum dollar amount from a price string. Returns 0 for Free, null if unknown. */
function parsePriceMin(price: string | null): number | null {
  if (!price) return null
  if (price.toLowerCase() === 'free') return 0
  const m = price.match(/\$(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : null
}

/**
 * Decode HTML entities in strings (e.g. &#8211; → —, &amp; → &).
 * Exported so admin views (which read `raw` directly without going through
 * the normalizer dispatch) can decode too — otherwise things like `&#038;`
 * and `&#8211;` leak into the admin UI.
 */
/** Trim a description to ~maxLen chars at a word boundary, decode HTML
 *  entities (curly apostrophe etc.) and append ellipsis. Used by every
 *  normalizer so descriptions never render as `&#8217;` or cut mid-word. */
/** Boilerplate placeholder descriptions to filter out — these come from
 *  source-side autogeneration and add no value vs showing nothing. */
const BOILERPLATE_DESCRIPTIONS = new Set([
  'live music event',
  'live music event.',
  'live music performance',
  'live music performance.',
  'concert',
  'concert.',
  'live event',
  'live event.',
  'sports event',
  'sports event.',
  'event',
  'event.',
])

export function cleanDescription(input: string | null | undefined, maxLen = 320): string | null {
  if (!input) return null
  // Strip simple HTML tags (NHCC + abqtodo descriptions sometimes include <p>)
  const stripped = input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const decoded = decodeHtml(stripped)
  // Filter out boilerplate placeholders — better to show no description than
  // useless filler like "Live music event."
  if (BOILERPLATE_DESCRIPTIONS.has(decoded.toLowerCase())) return null
  if (decoded.length <= maxLen) return decoded
  // Cut at last whitespace before the limit so we never end mid-word
  const slice = decoded.slice(0, maxLen)
  const lastSpace = slice.lastIndexOf(' ')
  const cleanCut = lastSpace > maxLen - 80 ? slice.slice(0, lastSpace) : slice
  return cleanCut.replace(/[.,;:!?\-—–]+$/g, '') + '…'
}

export function decodeHtml(str: string | undefined | null): string {
  if (!str) return ''
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
}

function formatTime(iso: string): string {
  // Date-only strings (YYYY-MM-DD) have no meaningful time — skip them
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''

  // Bare datetime without timezone offset (e.g. "2026-04-17T21:30" or "2026-04-17T21:30:00")
  // Sources (SeatGeek localTime, Eventbrite .local) provide venue-local time. On server runtimes
  // where TZ=UTC (Netlify), new Date() would parse these as UTC and shift them by 6–7 hours.
  // Extract HH:MM directly to preserve the intended local time.
  const bareMatch = iso.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::\d{2})?$/)
  if (bareMatch) {
    return formatHHMM(bareMatch[1], bareMatch[2])
  }

  // Bare time only: "HH:MM" or "HH:MM:SS"
  const timeOnly = iso.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
  if (timeOnly) {
    return formatHHMM(timeOnly[1], timeOnly[2])
  }

  // Treat midnight (00:00) with offset as "time unknown" placeholder — many feeds default
  // to midnight when the real time isn't published. We'd rather show no time than a wrong one.
  if (/T00:00:00([-+]\d{2}:?\d{2}|Z)?$/.test(iso)) return ''

  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Denver',
    })
  } catch {
    return ''
  }
}

function formatHHMM(hh: string, mm: string): string {
  const hour = parseInt(hh, 10)
  if (isNaN(hour)) return ''
  // Midnight placeholder — most sources use 00:00 to mean "time unknown"
  if (hour === 0 && mm === '00') return ''
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${mm} ${period}`
}

function buildTMAddress(venue: Record<string, unknown>): string | null {
  const addr = (venue.address as Record<string, unknown> | undefined)?.line1 as string | undefined
  const city = (venue.city as Record<string, unknown> | undefined)?.name as string | undefined
  const state = (venue.state as Record<string, unknown> | undefined)?.stateCode as string | undefined
  return [addr, city, state].filter(Boolean).join(', ') || null
}

function buildEBAddress(venue: Record<string, unknown>): string | null {
  const addr = venue.address as Record<string, unknown> | undefined
  return (addr?.localized_address_display as string | undefined)
    ?? (addr?.city as string | undefined)
    ?? null
}

/**
 * Result of category mapping — includes optional subcategory for drill-down filtering.
 */
interface CategoryResult {
  category: string | null
  subcategory: string | null
}

/**
 * Word-boundary-aware keyword matching.
 * Uses regex \b (word boundary) so "fair" does NOT match "fairy" or "affair",
 * but DOES match "career fair", "state fair", etc.
 *
 * For multi-word phrases (e.g. "block party"), uses simple includes() since
 * the phrase itself provides sufficient context.
 */
function wordMatch(text: string, word: string): boolean {
  if (word.includes(' ')) {
    // Multi-word phrase: includes() is fine — "block party" won't false-match
    return text.includes(word)
  }
  // Single word: use word-boundary regex to avoid substring false positives
  // e.g. \bfair\b matches "career fair" but NOT "fairy" or "fairytale"
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)
}

/** Check if ANY of the given words/phrases match in the text */
function anyWord(text: string, words: string[]): boolean {
  return words.some(w => wordMatch(text, w))
}

/**
 * Map any source's category/segment/genre/type string to our display categories
 * with optional subcategory (e.g., Sports > Baseball).
 *
 * Uses word-boundary matching to prevent false positives like:
 *   - "fairy tale" → Festivals (was matching on "fair" inside "fairy")
 *   - "career fair" → Festivals (now correctly → Community via "job fair"/"career fair")
 *
 * For Eventbrite, the category name is passed as `segment` (1st arg).
 * For local/SG events, the event title is passed as `genre` (2nd arg).
 */
function mapCategory(segment?: string, genre?: string): CategoryResult {
  const s = (segment ?? '').toLowerCase()
  const g = (genre ?? '').toLowerCase()
  const both = `${s} ${g}`

  // ── Community-specific fairs — check BEFORE Festivals so "career fair", ──
  // ── "job fair", "health fair" go to Community, not Festivals             ──
  if (anyWord(both, ['career fair', 'job fair', 'health fair', 'resource fair']))
    return { category: 'Community', subcategory: null }

  // ── Family ──────────────────────────────────────────────────────────────
  if (anyWord(both, [
    'family', 'kids', 'children', 'storytime', 'story time', 'story hour',
    'toddler', 'baby', 'puppet', 'duplo', 'lego', 'read to the dog',
    'kids clay', 'kid concert', 'easter', 'trunk or treat',
    'music & movement',
  ])) return { category: 'Family', subcategory: null }

  // ── Comedy — before Arts so comedians don't land in "Arts & Theater" ────
  if (anyWord(both, [
    'comedy', 'stand-up', 'standup', 'improv', 'open mic', 'comedian',
  ])) return { category: 'Comedy', subcategory: null }

  // ── Dance classes & lessons → Community (check BEFORE Music) ────────────
  // Prevents "Salsa Dance Class" or "Line Dancing Workshop" from matching music keywords
  if (anyWord(both, [
    'dance class', 'dance classes', 'dance lesson', 'dance lessons',
    'dance workshop', 'dance instruction', 'learn to dance',
    'swing dance', 'line dance', 'line dancing', 'ballroom',
    'tango lesson', 'tango class', 'salsa lesson', 'salsa class',
    'salsa dance class', 'salsa dancing', 'latin dance class', 'latin dance lesson',
    'barre class', 'barre fit', 'zumba', 'cumbia class',
  ])) return { category: 'Community', subcategory: null }

  // ── Dance performance → Arts & Theater ──────────────────────────────────
  if (anyWord(both, [
    'dance performance', 'dance recital', 'dance show', 'dance company', 'dance concert',
  ])) return { category: 'Arts & Theater', subcategory: null }

  // ── Music ───────────────────────────────────────────────────────────────
  const musicSubcategoryMap: Record<string, string> = {
    'rock': 'Rock', 'alternative': 'Alternative', 'indie': 'Indie',
    'pop': 'Pop', 'country': 'Country', 'jazz': 'Jazz',
    'hip-hop': 'Hip-Hop', 'rap': 'Hip-Hop', 'r&b': 'R&B', 'soul': 'Soul',
    'edm': 'Electronic', 'electronic': 'Electronic', 'electronica': 'Electronic',
    'latin': 'Latin', 'reggae': 'Reggae', 'folk': 'Folk', 'bluegrass': 'Folk',
    'metal': 'Metal', 'punk': 'Rock', 'blues': 'Blues', 'classical': 'Classical',
    'symphony': 'Classical',
  }
  const musicSub = Object.entries(musicSubcategoryMap).find(([k]) => g.includes(k))?.[1] ?? null
  if (anyWord(s, ['music'])
    || anyWord(both, ['concert', 'live music', 'dj set'])
    || anyWord(g, [
      'rock', 'pop', 'country', 'jazz', 'hip-hop', 'r&b', 'edm', 'electronic',
      'latin', 'reggae', 'soul', 'folk', 'bluegrass', 'metal', 'punk',
      'singer', 'songwriter', 'mariachi', 'cumbia', 'salsa', 'norteño',
      'reggaeton', 'classical', 'symphony', 'blues', 'alternative', 'indie',
    ])
  ) return { category: 'Music', subcategory: musicSub }

  // ── Outdoor races & participatory events ─────────────────────────────────
  // Events people DO outside (runs, walks, hikes, rides) — not spectator sports.
  // Must come BEFORE the Sports block so "5K" doesn't land in Sports > Running.
  if (anyWord(both, [
    '5k', '10k', '1m', '13.1', '26.2',
    'marathon', 'half marathon', 'triathlon', 'duathlon',
    'fun run', 'road race', 'trail run', 'color run', 'mud run',
    'obstacle course', 'obstacle race', 'charity walk', 'fun walk',
    'walk/run', 'run/walk',
    'group hike', 'guided hike', 'nature hike', 'led hike',
    'bike ride', 'cycling tour', 'kayak tour', 'paddleboard tour',
  ])) return { category: 'Outdoor', subcategory: null }

  // ── Sports — with subcategories per strategy doc taxonomy ───────────────
  // Check specific teams/sports first for subcategory, then generic "sports"
  if (anyWord(both, ['isotopes']))
    return { category: 'Sports', subcategory: 'Baseball' }
  if (anyWord(both, ['nm united', 'new mexico united']))
    return { category: 'Sports', subcategory: 'Soccer' }
  if (anyWord(both, ['lobos']))
    return { category: 'Sports', subcategory: 'College' }
  if (anyWord(both, ['aggies']))
    return { category: 'Sports', subcategory: 'College' }
  if (anyWord(both, ['baseball', 'softball']))
    return { category: 'Sports', subcategory: 'Baseball' }
  if (anyWord(both, ['soccer', 'futbol', 'fútbol']))
    return { category: 'Sports', subcategory: 'Soccer' }
  if (anyWord(both, ['football']))
    return { category: 'Sports', subcategory: 'Football' }
  if (anyWord(both, ['basketball']))
    return { category: 'Sports', subcategory: 'Basketball' }
  if (anyWord(both, ['hockey']))
    return { category: 'Sports', subcategory: 'Hockey' }
  if (anyWord(both, ['mma', 'boxing', 'wrestling', 'ufc']))
    return { category: 'Sports', subcategory: 'Combat' }
  if (anyWord(both, ['racing', 'drag racing', 'stock car', 'motorsport']))
    return { category: 'Sports', subcategory: 'Motorsports' }
  if (anyWord(both, ['rodeo']))
    return { category: 'Sports', subcategory: 'Rodeo' }
  if (anyWord(both, ['bodybuilding']))
    return { category: 'Sports', subcategory: null }
  if (anyWord(s, ['sport', 'sports']))
    return { category: 'Sports', subcategory: null }

  // ── Film ────────────────────────────────────────────────────────────────
  if (anyWord(both, [
    'film', 'movie', 'screening', 'cinema', 'documentary', 'short film', 'drive-in',
  ]) || anyWord(s, ['tv']))
    return { category: 'Film', subcategory: null }

  // ── Food & Drink ───────────────────────────────────────────────────────
  if (anyWord(both, [
    'food', 'drink', 'tasting', 'brewery', 'wine', 'culinary', 'chef',
    'farmers market', 'growers market', 'cocktail', 'distillery', 'cooking',
    'beer', 'brunch', 'food truck', 'sips', 'suds', 'beverage', 'taproom',
    'winery', 'margarita', 'mezcal', 'hops', 'homebrew', 'cider',
  ])) return { category: 'Food & Drink', subcategory: null }

  // ── Arts & Theater ─────────────────────────────────────────────────────
  if (anyWord(s, ['art', 'arts', 'theatre', 'theater'])
    || anyWord(both, [
      'ballet', 'opera', 'gallery', 'museum', 'exhibit',
      'literary', 'performing art', 'broadway',
      'philharmonic', 'art studio', 'painting', 'pottery',
      'sculpture', 'printmaking', 'fairy tale', 'fairy tales',
    ])
  ) return { category: 'Arts & Theater', subcategory: null }

  // ── Festivals & Fairs — uses word-boundary so "fairy" won't match "fair" ─
  if (anyWord(both, [
    'festival', 'fair', 'carnival', 'expo', 'fiesta', 'celebration',
    'block party',
  ])) return { category: 'Festivals', subcategory: null }

  // ── Outdoor & Adventure (secondary catch) ─────────────────────────────
  // Primary run/walk/race keywords are caught BEFORE Sports above.
  // This block catches outdoor-adjacent titles that don't match earlier blocks.
  if (anyWord(both, [
    'outdoor', 'hiking', 'hike', 'cycling', 'balloon fiesta', 'camping',
    'adventure', 'trail', 'nature walk', 'birding', 'stargazing',
    'garden tour', 'kayaking', 'paddling', 'rafting', 'rock climbing',
    'backpacking', 'wilderness',
  ])) return { category: 'Outdoor', subcategory: null }

  // ── Community — broadest bucket, check last ────────────────────────────
  if (anyWord(both, [
    'community', 'charity', 'fundraiser', 'civic', 'volunteer', 'workshop',
    'seminar', 'networking', 'support group', 'book club',
    'meditation', 'yoga', 'tai chi', 'open house', 'town hall',
    'creative writing', 'makerspace',
  ])) return { category: 'Community', subcategory: null }

  // If nothing matched, return null — event shows up in "All" but not in any filter
  return { category: null, subcategory: null }
}
