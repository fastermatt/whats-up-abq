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
  search?: string
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
  search,
  limit = 24,
  offset = 0,
}: FetchEventsOptions = {}): Promise<FetchEventsResult> {
  const supabase = await createClient()
  const { gte, lte } = getTimeRange(timeFilter)

  const COLS = 'id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden'
  const needsInMemory = !!(category || search)

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
      allNormalized = allNormalized.filter(
        (e) => e.category?.toLowerCase() === category.toLowerCase()
      )
    }

    if (search) {
      const terms = search.toLowerCase().split(/\s+/).filter(Boolean)
      allNormalized = allNormalized.filter((e) => {
        const haystack = `${e.title} ${e.venue ?? ''} ${e.category ?? ''} ${e.description ?? ''}`.toLowerCase()
        return terms.every((t) => haystack.includes(t))
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
    category: mapCategory(
      (r.category as Record<string, unknown> | undefined)?.name as string | undefined,
      title
    ),
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
    category: mapCategory(
      (r.type as string | undefined),
      (r.title as string) ?? (r.short_title as string)
    ),
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
    category: mapCategory(
      (r.category as string | undefined),
      (r.title as string | undefined) ?? (r.name as string | undefined)
    ),
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
  const title = (r.name as string) ?? (r.title as string) ?? 'Event'
  return {
    id: row.id,
    title,
    date: row.event_date ?? '',
    time: row.event_date ? formatTime(row.event_date) : null,
    venue: null,
    address: null,
    city: null,
    category: mapCategory((r.category as string | undefined), title),
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

/**
 * Map any source's category/segment/genre/type string to our display categories.
 * Handles: Ticketmaster segment+genre, Eventbrite category.name, SeatGeek type,
 * and local event title-based matching (pass title as 2nd arg for local events).
 *
 * IMPORTANT: For Eventbrite, the category name is passed as `segment` (1st arg).
 * For local events, the event title is passed as `genre` (2nd arg) so title keywords
 * get matched via `both`. Always check BOTH `s` and `g` for every keyword.
 */
function mapCategory(segment?: string, genre?: string): string | null {
  const s = (segment ?? '').toLowerCase()
  const g = (genre ?? '').toLowerCase()
  const both = `${s} ${g}`

  // Family — check FIRST because "Kids" events shouldn't fall into Community
  // EB sends "Family & Education", "Kids & Family", etc. as segment
  if (both.includes('family') || both.includes('kids') || both.includes('children')
    || both.includes('storytime') || both.includes('story time') || both.includes('story hour')
    || both.includes('toddler') || both.includes('baby') || both.includes('puppet')
    || both.includes('duplo') || both.includes('lego') || both.includes('read to the dog')
    || both.includes('kids clay') || both.includes('kid concert')
    || both.includes('holiday') || both.includes('easter') || both.includes('trunk or treat')
    || both.includes('music & movement')) return 'Family'

  // Comedy — check before Arts so comedians don't land in "Arts & Theater"
  if (both.includes('comedy') || both.includes('stand-up') || both.includes('standup')
    || both.includes('improv') || both.includes('open mic') || both.includes('comedian')
    || both.includes('funny') || both.includes('laugh')) return 'Comedy'

  // Music — TM segments, SG type 'concert', EB 'Music'
  if (s.includes('music') || both.includes('concert') || both.includes(' band ')
    || g.includes('rock') || g.includes('pop') || g.includes('country') || g.includes('jazz')
    || g.includes('hip-hop') || g.includes('r&b') || g.includes('edm') || g.includes('electronic')
    || g.includes('latin') || g.includes('reggae') || g.includes('soul') || g.includes('folk')
    || g.includes('bluegrass') || g.includes('metal') || g.includes('punk')
    || g.includes('singer') || g.includes('songwriter')
    || both.includes('live music') || both.includes('dj ')) return 'Music'

  // Sports — TM segments, SG type, EB
  if (s.includes('sport') || both.includes('baseball') || both.includes('basketball')
    || both.includes('football') || both.includes('soccer') || both.includes('hockey')
    || both.includes('mma') || both.includes('boxing') || both.includes('wrestling')
    || both.includes('racing') || both.includes('rodeo') || both.includes('isotopes')
    || both.includes('lobos') || both.includes('nm united') || both.includes('new mexico united')
    || both.includes('aggies') || both.includes('bodybuilding') || both.includes('marathon')
    || both.includes('5k') || both.includes('10k') || both.includes('triathlon')) return 'Sports'

  // Film — check BOTH s and g (EB passes film category as segment, not genre)
  if (both.includes('film') || both.includes('movie') || both.includes('screening')
    || both.includes('cinema') || both.includes('documentary') || both.includes('short film')
    || s.includes('tv') || both.includes('drive-in')) return 'Film'

  // Food & Drink — EB sends "Food & Drink", also catch title keywords
  if (both.includes('food') || both.includes('drink') || both.includes('tasting')
    || both.includes('brewery') || both.includes('wine') || both.includes('culinary')
    || both.includes('chef') || both.includes('farmers market') || both.includes('growers market')
    || both.includes('cocktail') || both.includes('distillery') || both.includes('cooking')
    || both.includes('beer') || both.includes('brunch') || both.includes('dinner')
    || both.includes('food truck') || both.includes('sips') || both.includes('suds')
    || both.includes('beverage') || both.includes('taproom') || both.includes('winery')
    || both.includes('margarita') || both.includes('mezcal')) return 'Food & Drink'

  // Arts & Theater
  if (s.includes('art') || s.includes('theatre') || s.includes('theater')
    || both.includes('ballet') || both.includes('opera') || both.includes('classical')
    || both.includes('gallery') || both.includes('museum') || both.includes('exhibit')
    || both.includes('literary') || both.includes('performing art')
    || both.includes('play ') || both.includes(' play') || both.includes('broadway')
    || both.includes('symphony') || both.includes('philharmonic')
    || both.includes('art studio') || both.includes('painting') || both.includes('pottery')
    || both.includes('sculpture') || both.includes('printmaking')) return 'Arts & Theater'

  // Festivals & Fairs
  if (both.includes('festival') || both.includes(' fair') || both.includes('carnival')
    || both.includes('expo') || both.includes('fiesta') || both.includes('celebration')
    || both.includes('block party')) return 'Festivals'

  // Outdoor & Adventure
  if (both.includes('outdoor') || both.includes('hiking') || both.includes('cycling')
    || both.includes('balloon') || both.includes('camping') || both.includes('adventure')
    || both.includes('trail') || both.includes('nature walk') || both.includes('birding')
    || both.includes('stargazing') || both.includes('garden tour')) return 'Outdoor'

  // Community — check last, broadest bucket
  if (both.includes('community') || both.includes('charity') || both.includes('fundraiser')
    || both.includes('civic') || both.includes('volunteer') || both.includes('workshop')
    || both.includes('seminar') || both.includes('networking') || both.includes('meeting')
    || both.includes('support group') || both.includes('book club')
    || both.includes('meditation') || both.includes('yoga') || both.includes('tai chi')
    || both.includes('health fair') || both.includes('job fair')
    || both.includes('open house') || both.includes('town hall')
    || both.includes('creative writing') || both.includes('makerspace')) return 'Community'

  // If nothing matched, return null — event shows up in "All" but not in any filter
  return null
}
