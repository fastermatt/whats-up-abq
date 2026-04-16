/**
 * Event data layer — reads from public.events (v1 ingestion table)
 * which has 1428+ real events from Ticketmaster, Eventbrite, SeatGeek, etc.
 *
 * v2.events is intentionally empty until Phase 2 ingestion is wired up.
 */
import { createClient } from '@/lib/supabase/server'
import { getTimeRange, TimeFilter } from '@/lib/utils/dates'

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
}

export type CategoryFilter = string | null

export interface FetchEventsOptions {
  timeFilter?: TimeFilter
  category?: CategoryFilter
  search?: string
  freeOnly?: boolean
  maxPrice?: number   // 0 = free only; 25 = under $25; 50 = under $50
  limit?: number
  offset?: number
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
  neighborhood: string | null
  venue_slug: string | null
}

// ─── Category counts ──────────────────────────────────────────────────────────

export interface CategoryCount {
  category: string
  count: number
}

/** Returns event counts per top-level category for the upcoming time range. */
export async function fetchCategoryCounts(): Promise<CategoryCount[]> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden')
    .eq('hidden', false)
    .gte('event_date', today)
    .order('event_date', { ascending: true })

  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as RawEventRow[]) {
    try {
      const evt = normalizeRow(row)
      if (!evt?.category) continue
      counts[evt.category] = (counts[evt.category] ?? 0) + 1
    } catch { /* skip */ }
  }

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchEvents({
  timeFilter = 'upcoming',
  category,
  search,
  freeOnly = false,
  maxPrice,
  limit = 24,
  offset = 0,
}: FetchEventsOptions = {}): Promise<FetchEventsResult> {
  const supabase = await createClient()
  const { gte, lte } = getTimeRange(timeFilter)

  const COLS = 'id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, neighborhood, venue_slug'
  const needsInMemory = !!(category || search || freeOnly || maxPrice !== undefined)

  // When filtering by category or search we must normalize first (category is inside raw JSON,
  // different field per source), so fetch all rows for the time range then filter/paginate.
  if (needsInMemory) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .schema('public')
      .from('events')
      .select(COLS)
      .eq('hidden', false)
      .gte('event_date', gte)
      .order('event_date', { ascending: true })
    if (lte) q = q.lte('event_date', lte)

    const { data, error } = await q
    if (error) {
      console.error('[fetchEvents] Supabase error:', error.message)
      return { events: [], total: 0 }
    }
    let allNormalized = ((data ?? []) as RawEventRow[])
      .map(normalizeRow)
      .filter((e): e is NormalizedEvent => e !== null)

    if (category) {
      // Support subcategory filtering: "Sports > Baseball" matches subcategory,
      // "Sports" matches all sports events regardless of subcategory
      if (category.includes(' > ')) {
        const sub = category.split(' > ')[1]
        allNormalized = allNormalized.filter(
          (e) => e.subcategory?.toLowerCase() === sub.toLowerCase()
        )
      } else {
        allNormalized = allNormalized.filter(
          (e) => e.category?.toLowerCase() === category.toLowerCase()
        )
      }
    }

    if (search) {
      const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
      allNormalized = allNormalized.filter((e) => {
        const haystack = `${e.title} ${e.venue ?? ''} ${e.category ?? ''} ${e.subcategory ?? ''} ${e.description ?? ''}`.toLowerCase()
        return terms.every((t) => haystack.includes(t))
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

    return {
      events: allNormalized.slice(offset, offset + limit),
      total: allNormalized.length,
    }
  }

  // No category/search filter — use DB-level pagination with count for efficiency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .schema('public')
    .from('events')
    .select(COLS, { count: 'exact' })
    .eq('hidden', false)
    .gte('event_date', gte)
    .order('event_date', { ascending: true })

  if (lte) {
    query = query.lte('event_date', lte)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error('[fetchEvents] Supabase error:', error.message)
    return { events: [], total: 0 }
  }

  const rows: RawEventRow[] = data ?? []
  const events = rows
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)

  return { events, total: count ?? 0 }
}

/** Fetch admin-featured upcoming events (featured=true in DB). */
export async function fetchFeaturedEvents(limit = 6): Promise<NormalizedEvent[]> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, neighborhood, venue_slug')
    .eq('hidden', false)
    .eq('featured', true)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(limit)

  if (error) return []

  return ((data ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
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

/** Fetch upcoming events in a specific neighborhood by slug */
export async function fetchEventsByNeighborhood(slug: string, limit = 30): Promise<NormalizedEvent[]> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, neighborhood, venue_slug')
    .eq('hidden', false)
    .gte('event_date', today)
    .not('neighborhood', 'is', null)
    .order('event_date', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[fetchEventsByNeighborhood] Supabase error:', error.message)
    return []
  }

  return ((data ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
    .filter((e) => e.neighborhood !== null && neighborhoodToSlug(e.neighborhood) === slug)
    .slice(0, limit)
}

/** Fetch neighborhood event counts — used for the homepage neighborhood section */
export async function fetchNeighborhoodCounts(): Promise<NeighborhoodCount[]> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('neighborhood')
    .eq('hidden', false)
    .gte('event_date', today)
    .not('neighborhood', 'is', null)

  if (error) return []

  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { neighborhood: string }[]) {
    const n = row.neighborhood
    if (n) counts[n] = (counts[n] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([neighborhood, count]) => ({
      neighborhood,
      count,
      slug: neighborhoodToSlug(neighborhood),
    }))
    .sort((a, b) => b.count - a.count)
}

/** Fetch upcoming events at a specific venue (case-insensitive partial match on venue name). */
export async function fetchEventsByVenue(venueName: string, limit = 20): Promise<NormalizedEvent[]> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, neighborhood, venue_slug')
    .eq('hidden', false)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[fetchEventsByVenue] Supabase error:', error.message)
    return []
  }

  const search = venueName.toLowerCase()
  return ((data ?? []) as RawEventRow[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
    .filter((e) => e.venue?.toLowerCase().includes(search))
    .slice(0, limit)
}

/** Fetch recently added upcoming events (newest ingestion first). */
export async function fetchRecentlyAdded(limit = 10): Promise<NormalizedEvent[]> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, created_at')
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

export async function fetchEventById(id: string): Promise<NormalizedEvent | null> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, neighborhood, venue_slug')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return normalizeRow(data as RawEventRow)
}

// ─── Row → NormalizedEvent ────────────────────────────────────────────────────

function normalizeRow(row: RawEventRow): NormalizedEvent | null {
  try {
    let evt: NormalizedEvent | null
    switch (row.source) {
      case 'ticketmaster': evt = normalizeTM(row); break
      case 'eventbrite':   evt = normalizeEB(row); break
      case 'seatgeek':     evt = normalizeSG(row); break
      case 'bandsintown':  evt = normalizeBIT(row); break
      case 'local':        evt = normalizeLocal(row); break
      default:             evt = normalizeGeneric(row)
    }
    // Pass through neighborhood + venue_slug DB columns
    if (evt) {
      evt.neighborhood = row.neighborhood ?? null
      evt.venueSlug    = row.venue_slug   ?? null
    }
    // Apply ai_enrichment overrides (from LLM enrichment pass)
    if (evt && row.ai_enrichment) {
      const ai = row.ai_enrichment as Record<string, unknown>
      // Only let AI override category when the code classifier returned null —
      // this prevents mis-labeled AI categories (e.g. rock band → Comedy) from
      // overriding a confident code-classifier result.
      if (typeof ai.category === 'string' && evt.category === null) evt.category = ai.category
      if (typeof ai.subcategory === 'string' && evt.subcategory === null) evt.subcategory = ai.subcategory
      if (typeof ai.about === 'string')       evt.about      = ai.about
      if (Array.isArray(ai.highlights))       evt.highlights = (ai.highlights as unknown[]).map(h => String(h))
      if (typeof ai.venue_tips === 'string')  evt.venueTips  = ai.venue_tips
      if (typeof ai.local_tips === 'string')  evt.localTips  = ai.local_tips
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

  const image = row.cached_photo_url
    ?? images?.find(i => i.ratio === '16_9' && (i.width as number) >= 640)?.url as string | undefined
    ?? images?.[0]?.url as string | undefined
    ?? null

  const startObj = (r.dates as Record<string, unknown> | undefined)?.start as Record<string, unknown> | undefined
  const startTime = startObj?.dateTime as string | undefined

  return {
    id: row.id,
    title: (r.name as string) ?? 'Untitled Event',
    date: row.event_date ?? startTime ?? '',
    time: startTime ? formatTime(startTime) : null,
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
    neighborhood: null, venueSlug: null,
    about: null, highlights: [], venueTips: null, localTips: null,
  }
}

function normalizeEB(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  const venue = r.venue as Record<string, unknown> | undefined
  const isFree = r.is_free as boolean | undefined
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

  const ebStart = r.start as Record<string, unknown> | undefined
  const ebLocalTime = ebStart?.local as string | undefined  // e.g. "2026-04-18T19:00:00"
  const ebUtcTime   = ebStart?.utc   as string | undefined  // e.g. "2026-04-19T01:00:00Z"

  return {
    id: row.id,
    title,
    date: row.event_date ?? ebUtcTime ?? '',
    // Prefer .local (already in venue timezone), fall back to .utc (will show UTC hours)
    time: ebLocalTime ? formatTime(ebLocalTime) : ebUtcTime ? formatTime(ebUtcTime) : null,
    venue: (venue?.name as string | undefined) ?? null,
    address: venue ? buildEBAddress(venue) : null,
    city: (venue?.address as Record<string, unknown> | undefined)?.city as string | null ?? null,
    ...mapCategory(
      (r.category as Record<string, unknown> | undefined)?.name as string | undefined,
      title
    ),
    description: ((r.description as Record<string, unknown> | undefined)?.text as string | undefined)?.slice(0, 300) ?? null,
    price: cost,
    imageUrl: row.cached_photo_url ?? (r.logo as Record<string, unknown> | undefined)?.url as string | null ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'eventbrite',
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null,
    about: null, highlights: [], venueTips: null, localTips: null,
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
    time: startLocal ? formatTime(`${startDate ?? ''}T${startLocal}`) : startTime ? formatTime(startTime) : null,
    venue: (v?.name as string | undefined) ?? null,
    address: v ? buildTMAddress(v) : null,
    city: (v?.city as Record<string, unknown> | undefined)?.name as string | null ?? null,
    ...mapCategory(segment, genre ?? title),
    description: (r.info as string | undefined)?.slice(0, 300) ?? null,
    price: priceStr,
    imageUrl: (image as string | null) ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'seatgeek',
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null,
    about: null, highlights: [], venueTips: null, localTips: null,
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
    description: (r.description as string | undefined)?.slice(0, 300) ?? null,
    price: null,
    imageUrl: row.cached_photo_url
      ?? (r.artist as Record<string, unknown> | undefined)?.image_url as string | undefined
      ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'bandsintown',
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null,
    about: null, highlights: [], venueTips: null, localTips: null,
  }
}

function normalizeLocal(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  return {
    id: row.id,
    title: decodeHtml((r.title as string) ?? (r.name as string)) || 'Local Event',
    date: row.event_date ?? (r.date as string) ?? (r.start_date as string) ?? '',
    time: row.event_date ? formatTime(row.event_date) : null,
    venue: typeof r.venue === 'string' ? r.venue : (r.venue_name as string | undefined) ?? null,
    address: (r.address as string | undefined) ?? null,
    city: (r.city as string | undefined) ?? 'Albuquerque',
    ...mapCategory(
      (r.category as string | undefined),
      (r.title as string | undefined) ?? (r.name as string | undefined)
    ),
    description: (r.description as string | undefined)?.slice(0, 300) ?? null,
    price: (r.price as string | undefined) ?? (r.cost as string | undefined) ?? null,
    imageUrl: row.cached_photo_url ?? (r.image as string | undefined) ?? null,
    ticketUrl: (r.url as string | undefined) ?? (r.ticket_url as string | undefined) ?? null,
    source: 'local',
    isFeatured: row.featured ?? false,
    neighborhood: null, venueSlug: null,
    about: null, highlights: [], venueTips: null, localTips: null,
  }
}

function normalizeGeneric(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  const title = decodeHtml((r.name as string) ?? (r.title as string)) || 'Event'
  return {
    id: row.id,
    title,
    date: row.event_date ?? '',
    time: row.event_date ? formatTime(row.event_date) : null,
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
    neighborhood: null, venueSlug: null,
    about: null, highlights: [], venueTips: null, localTips: null,
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

/** Decode HTML entities in strings (e.g. &#8211; → —, &amp; → &) */
function decodeHtml(str: string | undefined | null): string {
  if (!str) return ''
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function formatTime(iso: string): string {
  // Date-only strings (YYYY-MM-DD) have no meaningful time — skip them
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
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
  if (anyWord(both, ['marathon', '5k', '10k', 'triathlon', 'half marathon']))
    return { category: 'Sports', subcategory: 'Running' }
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
    'winery', 'margarita', 'mezcal',
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

  // ── Outdoor & Adventure ────────────────────────────────────────────────
  if (anyWord(both, [
    'outdoor', 'hiking', 'cycling', 'balloon', 'camping', 'adventure',
    'trail', 'nature walk', 'birding', 'stargazing', 'garden tour',
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
