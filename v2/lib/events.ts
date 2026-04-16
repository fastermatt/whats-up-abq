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
  description: string | null
  price: string | null
  imageUrl: string | null
  ticketUrl: string | null
  source: string
  isFeatured: boolean
}

export type CategoryFilter = string | null

export interface FetchEventsOptions {
  timeFilter?: TimeFilter
  category?: CategoryFilter
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
}

// ─── Main fetch function ──────────────────────────────────────────────────────

export async function fetchEvents({
  timeFilter = 'upcoming',
  category,
  limit = 24,
  offset = 0,
}: FetchEventsOptions = {}): Promise<FetchEventsResult> {
  const supabase = await createClient()
  const { gte, lte } = getTimeRange(timeFilter)

  const COLS = 'id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden'

  // When filtering by category we must normalize first (category is inside raw JSON,
  // different field per source), so fetch all rows for the time range then filter/paginate.
  if (category) {
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
    const allNormalized = ((data ?? []) as RawEventRow[])
      .map(normalizeRow)
      .filter((e): e is NormalizedEvent => e !== null)
      .filter((e) => e.category?.toLowerCase() === category.toLowerCase())
    return {
      events: allNormalized.slice(offset, offset + limit),
      total: allNormalized.length,
    }
  }

  // No category filter — use DB-level pagination with count for efficiency
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

export async function fetchEventById(id: string): Promise<NormalizedEvent | null> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return normalizeRow(data as RawEventRow)
}

// ─── Row → NormalizedEvent ────────────────────────────────────────────────────

function normalizeRow(row: RawEventRow): NormalizedEvent | null {
  try {
    switch (row.source) {
      case 'ticketmaster': return normalizeTM(row)
      case 'eventbrite':   return normalizeEB(row)
      case 'seatgeek':     return normalizeSG(row)
      case 'bandsintown':  return normalizeBIT(row)
      case 'local':        return normalizeLocal(row)
      default:             return normalizeGeneric(row)
    }
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
    category: mapCategory(segment, genre),
    description: null,
    price: priceStr,
    imageUrl: (image as string | null) ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'ticketmaster',
    isFeatured: row.featured ?? false,
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

  return {
    id: row.id,
    title,
    date: row.event_date ?? (r.start as Record<string, unknown> | undefined)?.utc as string ?? '',
    time: row.event_date ? formatTime(row.event_date) : null,
    venue: (venue?.name as string | undefined) ?? null,
    address: venue ? buildEBAddress(venue) : null,
    city: (venue?.address as Record<string, unknown> | undefined)?.city as string | null ?? null,
    category: (r.category as Record<string, unknown> | undefined)?.name as string | null ?? null,
    description: ((r.description as Record<string, unknown> | undefined)?.text as string | undefined)?.slice(0, 300) ?? null,
    price: cost,
    imageUrl: row.cached_photo_url ?? (r.logo as Record<string, unknown> | undefined)?.url as string | null ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'eventbrite',
    isFeatured: row.featured ?? false,
  }
}

function normalizeSG(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  const venue = r.venue as Record<string, unknown> | undefined
  const performers = r.performers as Array<Record<string, unknown>> | undefined
  const stats = r.stats as Record<string, unknown> | undefined

  const minPrice = stats?.lowest_price as number | undefined
  const avgPrice = stats?.average_price as number | undefined
  let priceStr: string | null = null
  if (minPrice != null) priceStr = `From $${Math.round(minPrice)}`
  else if (avgPrice != null) priceStr = `~$${Math.round(avgPrice)}`

  const dtLocal = r.datetime_local as string | undefined

  return {
    id: row.id,
    title: (r.title as string) ?? (r.short_title as string) ?? 'Untitled Event',
    date: row.event_date ?? dtLocal ?? '',
    time: dtLocal ? formatTime(dtLocal) : null,
    venue: (venue?.name as string | undefined) ?? null,
    address: venue
      ? [venue.address, venue.city].filter(Boolean).join(', ') || null
      : null,
    city: (venue?.city as string | undefined) ?? null,
    category: (r.type as string | undefined) ?? null,
    description: null,
    price: priceStr,
    imageUrl: row.cached_photo_url
      ?? (performers?.[0]?.image as string | undefined)
      ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'seatgeek',
    isFeatured: row.featured ?? false,
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
    description: (r.description as string | undefined)?.slice(0, 300) ?? null,
    price: null,
    imageUrl: row.cached_photo_url
      ?? (r.artist as Record<string, unknown> | undefined)?.image_url as string | undefined
      ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: 'bandsintown',
    isFeatured: row.featured ?? false,
  }
}

function normalizeLocal(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  return {
    id: row.id,
    title: (r.title as string) ?? (r.name as string) ?? 'Local Event',
    date: row.event_date ?? (r.date as string) ?? (r.start_date as string) ?? '',
    time: row.event_date ? formatTime(row.event_date) : null,
    venue: typeof r.venue === 'string' ? r.venue : (r.venue_name as string | undefined) ?? null,
    address: (r.address as string | undefined) ?? null,
    city: (r.city as string | undefined) ?? 'Albuquerque',
    category: (r.category as string | undefined) ?? null,
    description: (r.description as string | undefined)?.slice(0, 300) ?? null,
    price: (r.price as string | undefined) ?? (r.cost as string | undefined) ?? null,
    imageUrl: row.cached_photo_url ?? (r.image as string | undefined) ?? null,
    ticketUrl: (r.url as string | undefined) ?? (r.ticket_url as string | undefined) ?? null,
    source: 'local',
    isFeatured: row.featured ?? false,
  }
}

function normalizeGeneric(row: RawEventRow): NormalizedEvent {
  const r = row.raw as Record<string, unknown>
  return {
    id: row.id,
    title: (r.name as string) ?? (r.title as string) ?? 'Event',
    date: row.event_date ?? '',
    time: row.event_date ? formatTime(row.event_date) : null,
    venue: null,
    address: null,
    city: null,
    category: null,
    description: null,
    price: null,
    imageUrl: row.cached_photo_url ?? null,
    ticketUrl: (r.url as string | undefined) ?? null,
    source: row.source,
    isFeatured: row.featured ?? false,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function mapCategory(segment?: string, genre?: string): string | null {
  const s = (segment ?? '').toLowerCase()
  const g = (genre ?? '').toLowerCase()
  if (s.includes('music') || g.includes('rock') || g.includes('pop') || g.includes('country') || g.includes('jazz') || g.includes('hip-hop') || g.includes('r&b')) return 'Music'
  if (s.includes('sport')) return 'Sports'
  if (s.includes('art') || s.includes('theatre') || s.includes('theater') || g.includes('comedy') || g.includes('classical')) return 'Arts & Theater'
  if (s.includes('family') || g.includes('family')) return 'Family'
  if (g.includes('film') || g.includes('movie')) return 'Film'
  if (g.includes('food') || g.includes('festival') || g.includes('fair')) return 'Food & Drink'
  return segment ?? genre ?? null
}
