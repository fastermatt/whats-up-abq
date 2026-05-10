/**
 * Server-side helpers for the holiday banner + featured rail.
 *
 * Pairs with `data/holidays.ts` (calendar) and `app/components/HolidayBanner.tsx`.
 */

import { createClient } from '@/lib/supabase/server'
import { normalizeRow, type NormalizedEvent } from '@/lib/events'
import type { Holiday } from '@/data/holidays'

/**
 * Fetch events relevant to a holiday — keyword-matched and date-windowed.
 * Returns normalized events ready for rendering, ordered by:
 *   1. Featured first
 *   2. Closest to the holiday date
 *   3. Earliest start time
 *
 * Window: ±eventWindow days around the holiday date (default 3).
 * Match: title OR description ILIKE any of the holiday's keywords.
 */
export async function fetchHolidayEvents(
  holiday: Holiday,
  holidayDate: string,
  limit = 8,
): Promise<NormalizedEvent[]> {
  const sb = await createClient()
  const window = holiday.eventWindow ?? 3

  // Date window: holidayDate ± window days
  const start = new Date(holidayDate + 'T00:00:00Z')
  start.setUTCDate(start.getUTCDate() - window)
  const end = new Date(holidayDate + 'T00:00:00Z')
  end.setUTCDate(end.getUTCDate() + window)
  const startIso = start.toISOString().slice(0, 10)
  const endIso = end.toISOString().slice(0, 10)

  // Build OR clause for keyword match against title (raw->>name) and
  // description columns. Use ilike with %keyword% for substring match.
  // Note: PostgREST .or() requires comma-separated key.op.value format.
  const orParts = holiday.keywords.flatMap(k => {
    const escaped = k.replace(/[%_,()]/g, ' ').trim()
    if (!escaped) return []
    return [
      `raw->>name.ilike.%${escaped}%`,
      `description.ilike.%${escaped}%`,
    ]
  }).join(',')

  const { data, error } = await sb
    .from('events')
    .select('*')
    .eq('hidden', false)
    .gte('event_date', startIso)
    .lte('event_date', endIso)
    .or(orParts)
    .limit(limit * 4) // over-fetch, refine in JS

  if (error || !data) return []

  // Normalize, filter past events, then rank
  const today = new Date().toISOString().slice(0, 10)
  const normalized = data
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
    .filter(e => e.date >= today)

  // Rank: featured first, then closest to the holiday day, then time
  const targetMs = Date.parse(holidayDate + 'T12:00:00Z')
  normalized.sort((a, b) => {
    if ((a.isFeatured ?? false) !== (b.isFeatured ?? false)) {
      return (b.isFeatured ?? false) ? 1 : -1
    }
    const aDelta = Math.abs(Date.parse(a.date + 'T12:00:00Z') - targetMs)
    const bDelta = Math.abs(Date.parse(b.date + 'T12:00:00Z') - targetMs)
    if (aDelta !== bDelta) return aDelta - bDelta
    return (a.time ?? '23:59').localeCompare(b.time ?? '23:59')
  })

  return normalized.slice(0, limit)
}

/**
 * Cached wrapper — same signature, but result cached in Redis for 5min.
 * Holiday rails are server-rendered in ISR pages, so caching matters less,
 * but it shaves the keyword query off the cold-edge LCP path.
 */
export async function fetchHolidayEventsCached(
  holiday: Holiday,
  holidayDate: string,
  limit = 8,
): Promise<NormalizedEvent[]> {
  // Lazy import to avoid leaking Redis into the client bundle
  const { cachedFetch } = await import('@/lib/cache/redis')
  const key = `holiday:${holiday.key}:${holidayDate}:${limit}`
  try {
    return await cachedFetch(key, () => fetchHolidayEvents(holiday, holidayDate, limit), 300)
  } catch {
    return fetchHolidayEvents(holiday, holidayDate, limit)
  }
}
