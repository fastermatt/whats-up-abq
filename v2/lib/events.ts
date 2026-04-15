/**
 * Event data layer — reads from public.events (v1 Supabase schema).
 * Normalises raw JSON from TM / Eventbrite / SeatGeek / local sources
 * into a unified Event shape the UI can consume.
 */
import { createClient } from '@/lib/supabase/server'

export type EventSource = 'ticketmaster' | 'eventbrite' | 'seatgeek' | 'local' | 'bandsintown'

export interface NormalizedEvent {
  id:           string
  title:        string
  date:         string          // ISO date string YYYY-MM-DD
  time?:        string          // e.g. "8:00 PM"
  venue?:       string
  address?:     string
  city?:        string
  category?:    string
  description?: string
  price?:       string
  imageUrl?:    string
  ticketUrl?:   string
  source:       EventSource
  isFeatured:   boolean
}

export type TimeFilter = 'today' | 'tomorrow' | 'this-weekend' | 'this-week' | 'upcoming'
export type CategoryFilter = string   // matches category slug or 'all'

const ABQ_TZ = 'America/Denver'

function nowMDT(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: ABQ_TZ }))
}

function localDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: ABQ_TZ })  // YYYY-MM-DD
}

function getDateRange(filter: TimeFilter): { start: string; end?: string } {
  const now = nowMDT()
  const today = localDate(now)

  const addDays = (d: Date, n: number) => {
    const c = new Date(d); c.setDate(c.getDate() + n); return c
  }

  switch (filter) {
    case 'today':
      return { start: today, end: today }
    case 'tomorrow': {
      const tom = localDate(addDays(now, 1))
      return { start: tom, end: tom }
    }
    case 'this-weekend': {
      const day = now.getDay()  // 0=Sun
      const daysToFri = day <= 5 ? 5 - day : 6
      const fri = localDate(addDays(now, day === 6 || day === 0 ? 0 : daysToFri))
      const sun = localDate(addDays(now, day === 0 ? 0 : 7 - day))
      return { start: fri, end: sun }
    }
    case 'this-week': {
      const weekEnd = localDate(addDays(now, 7))
      return { start: today, end: weekEnd }
    }
    default:
      return { start: today }
  }
}

// Normalise Ticketmaster raw event
function normalizeTM(row: { id: string; raw: Record<string, unknown>; event_date: string; cached_photo_url?: string; featured?: boolean }): NormalizedEvent {
  const raw = row.raw
  const embedded = (raw._embedded as Record<string, unknown>) ?? {}
  const venues   = (embedded.venues as Record<string, unknown>[]) ?? []
  const venue    = venues[0] ?? {}
  const dates    = (raw.dates as Record<string, unknown>) ?? {}
  const start    = (dates.start as Record<string, unknown>) ?? {}
  const images   = (raw.images as { url: string; width: number }[]) ?? []
  const bigImg   = images.sort((a: { width: number }, b: { width: number }) => b.width - a.width)[0]

  const priceRanges = (raw.priceRanges as { min?: number; max?: number }[]) ?? []
  const priceStr = priceRanges[0]
    ? priceRanges[0].min === 0 ? 'Free' : `$${priceRanges[0].min}`
    : undefined

  const classifications = (raw.classifications as { segment?: { name: string }; genre?: { name: string } }[]) ?? []
  const seg  = classifications[0]?.segment?.name
  const genr = classifications[0]?.genre?.name

  return {
    id:          row.id,
    title:       (raw.name as string) ?? 'Event',
    date:        row.event_date,
    time:        start.localTime ? formatTime(start.localTime as string) : undefined,
    venue:       (venue.name as string) ?? undefined,
    address:     [venue.address && (venue.address as Record<string, string>).line1, (venue.city as Record<string, string>)?.name].filter(Boolean).join(', ') || undefined,
    city:        (venue.city as Record<string, string>)?.name ?? 'Albuquerque',
    category:    mapCategory(seg, genr),
    description: (raw.info as string) ?? (raw.pleaseNote as string) ?? undefined,
    price:       priceStr,
    imageUrl:    row.cached_photo_url ?? bigImg?.url,
    ticketUrl:   (raw.url as string) ?? undefined,
    source:      'ticketmaster',
    isFeatured:  row.featured ?? false,
  }
}

// Normalise Eventbrite raw event
function normalizeEB(row: { id: string; raw: Record<string, unknown>; event_date: string; cached_photo_url?: string; featured?: boolean }): NormalizedEvent {
  const raw = row.raw
  const logo = raw.logo as Record<string, unknown> | undefined
  const imgUrl = (logo?.url as string) ?? undefined

  const cost = raw.ticket_availability as Record<string, unknown> | undefined
  const priceStr = cost?.is_free ? 'Free' : cost?.minimum_ticket_price
    ? `$${(cost.minimum_ticket_price as Record<string, number>).major_value}`
    : undefined

  const cats = (raw.category as Record<string, string>) ?? {}

  return {
    id:          row.id,
    title:       (raw.name as Record<string, string>)?.text ?? (raw.title as string) ?? 'Event',
    date:        row.event_date,
    time:        raw.start ? formatTime(((raw.start as Record<string, string>).local ?? '').split('T')[1]) : undefined,
    venue:       (raw.venue as Record<string, string>)?.name ?? undefined,
    category:    mapCategory(cats.name, undefined),
    description: (raw.description as Record<string, string>)?.text?.slice(0, 200) ?? undefined,
    price:       priceStr,
    imageUrl:    row.cached_photo_url ?? imgUrl,
    ticketUrl:   (raw.url as string) ?? undefined,
    source:      'eventbrite',
    isFeatured:  row.featured ?? false,
  }
}

// Normalise SeatGeek
function normalizeSG(row: { id: string; raw: Record<string, unknown>; event_date: string; cached_photo_url?: string; featured?: boolean }): NormalizedEvent {
  const raw = row.raw
  const performers = (raw.performers as { name: string; image: string }[]) ?? []
  const venue = (raw.venue as Record<string, unknown>) ?? {}

  return {
    id:         row.id,
    title:      (raw.title as string) ?? (raw.short_title as string) ?? 'Event',
    date:       row.event_date,
    time:       raw.datetime_local ? formatTime(((raw.datetime_local as string).split('T')[1])) : undefined,
    venue:      (venue.name as string) ?? undefined,
    city:       (venue.city as string) ?? 'Albuquerque',
    category:   (raw.type as string) ?? undefined,
    price:      raw.stats ? `$${(raw.stats as Record<string, number>).lowest_price ?? 0}` : undefined,
    imageUrl:   row.cached_photo_url ?? performers[0]?.image,
    ticketUrl:  (raw.url as string) ?? undefined,
    source:     'seatgeek',
    isFeatured: row.featured ?? false,
  }
}

// Normalise local/iCal events
function normalizeLocal(row: { id: string; raw: Record<string, unknown>; event_date: string; cached_photo_url?: string; featured?: boolean }): NormalizedEvent {
  const raw = row.raw
  const images = (raw.images as { url: string }[]) ?? []
  return {
    id:          row.id,
    title:       (raw.title as string) ?? (raw.name as string) ?? 'Event',
    date:        row.event_date,
    time:        raw.time as string ?? undefined,
    venue:       (raw.location as string) ?? (raw.venue as string) ?? undefined,
    category:    (raw.category as string) ?? undefined,
    description: (raw.description as string)?.slice(0, 200) ?? undefined,
    price:       (raw.price as string) ?? undefined,
    imageUrl:    row.cached_photo_url ?? images[0]?.url,
    ticketUrl:   (raw.url as string) ?? (raw.ticket_url as string) ?? (raw.website as string) ?? undefined,
    source:      'local',
    isFeatured:  row.featured ?? false,
  }
}

function normalizeBIT(row: { id: string; raw: Record<string, unknown>; event_date: string; cached_photo_url?: string; featured?: boolean }): NormalizedEvent {
  const raw = row.raw
  return {
    id:          row.id,
    title:       (raw.title as string) ?? 'Event',
    date:        row.event_date,
    time:        raw.datetime ? formatTime(((raw.datetime as string).split('T')[1])) : undefined,
    venue:       (raw.venue as Record<string, string>)?.name ?? undefined,
    category:    'Music',
    imageUrl:    row.cached_photo_url ?? (raw.artist as Record<string, string>)?.image_url,
    ticketUrl:   (raw.url as string) ?? undefined,
    source:      'bandsintown',
    isFeatured:  row.featured ?? false,
  }
}

function formatTime(t?: string): string | undefined {
  if (!t) return undefined
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return undefined
  const period = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return m ? `${hour}:${String(m).padStart(2, '0')} ${period}` : `${hour}:00 ${period}`
}

const CAT_MAP: Record<string, string> = {
  music: 'Music', sports: 'Sports', arts: 'Arts & Culture',
  comedy: 'Comedy', film: 'Film', family: 'Family', food: 'Food & Drink',
  health: 'Health', community: 'Community', theatre: 'Theater',
  concerts: 'Music', undefined: 'Other',
}

function mapCategory(seg?: string, genre?: string): string | undefined {
  const s = (seg ?? '').toLowerCase()
  const g = (genre ?? '').toLowerCase()
  for (const [k, v] of Object.entries(CAT_MAP)) {
    if (s.includes(k) || g.includes(k)) return v
  }
  return seg ?? genre
}

function normalizeRow(row: { id: string; source: string; raw: Record<string, unknown>; event_date: string; cached_photo_url?: string; featured?: boolean }): NormalizedEvent | null {
  try {
    switch (row.source) {
      case 'ticketmaster': return normalizeTM(row as Parameters<typeof normalizeTM>[0])
      case 'eventbrite':   return normalizeEB(row as Parameters<typeof normalizeEB>[0])
      case 'seatgeek':     return normalizeSG(row as Parameters<typeof normalizeSG>[0])
      case 'bandsintown':  return normalizeBIT(row as Parameters<typeof normalizeBIT>[0])
      default:              return normalizeLocal(row as Parameters<typeof normalizeLocal>[0])
    }
  } catch {
    return null
  }
}

export async function fetchEvents({
  timeFilter = 'upcoming',
  category,
  limit = 48,
  offset = 0,
}: {
  timeFilter?: TimeFilter
  category?: string
  limit?: number
  offset?: number
} = {}): Promise<{ events: NormalizedEvent[]; total: number }> {
  const supabase = await createClient()

  const { start, end } = getDateRange(timeFilter)

  let query = (supabase as unknown as { schema: (s: string) => typeof supabase })
    .schema('public')
    .from('events')
    .select('id,source,raw,event_date,cached_photo_url,featured,ai_enrichment', { count: 'exact' })
    .gte('event_date', start)
    .eq('hidden', false)
    .order('event_date', { ascending: true })
    .range(offset, offset + limit - 1)

  if (end) {
    query = query.lte('event_date', end)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('fetchEvents error:', error.message)
    return { events: [], total: 0 }
  }

  let events = (data ?? [])
    .map((row) => normalizeRow(row as Parameters<typeof normalizeRow>[0]))
    .filter((e): e is NormalizedEvent => e !== null)

  // Client-side category filter (category is in raw JSON, not a DB column yet)
  if (category && category !== 'all') {
    events = events.filter(e =>
      e.category?.toLowerCase().includes(category.toLowerCase())
    )
  }

  return { events, total: count ?? 0 }
}

export async function fetchEventById(id: string): Promise<NormalizedEvent | null> {
  const supabase = await createClient()
  const { data, error } = await (supabase as unknown as { schema: (s: string) => typeof supabase })
    .schema('public')
    .from('events')
    .select('id,source,raw,event_date,cached_photo_url,featured,ai_enrichment')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return normalizeRow(data as Parameters<typeof normalizeRow>[0])
}
