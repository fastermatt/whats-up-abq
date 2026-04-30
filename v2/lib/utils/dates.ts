/**
 * Date utilities — always use TZDate(America/Denver), never bare new Date().
 * This is how we fix the v1 "Tonight" filter returning UTC events.
 */
import { TZDate } from '@date-fns/tz'
import { startOfDay, endOfDay, addDays, format, isAfter, isBefore } from 'date-fns'

export const ABQ_TZ = 'America/Denver'

/** Current time in ABQ timezone */
export function nowInABQ(): TZDate {
  return new TZDate(new Date(), ABQ_TZ)
}

/** Start of today in ABQ (midnight Mountain Time) */
export function startOfToday(): TZDate {
  return new TZDate(startOfDay(nowInABQ()), ABQ_TZ)
}

/** End of today in ABQ (23:59:59.999 Mountain Time) */
export function endOfToday(): TZDate {
  return new TZDate(endOfDay(nowInABQ()), ABQ_TZ)
}

/** Start of this weekend (Saturday midnight through Sunday midnight).
 *  Deliberately excludes Friday to avoid overlap with "Tomorrow". */
export function startOfWeekend(): TZDate {
  const now = nowInABQ()
  const day = now.getDay() // 0=Sun, 1=Mon … 6=Sat
  if (day === 0 || day === 6) {
    // Already the weekend — start from beginning of today
    return new TZDate(startOfDay(now), ABQ_TZ)
  }
  // Weekday (Mon–Fri): next Saturday = 6 - day days away
  const daysToSat = 6 - day
  return new TZDate(startOfDay(addDays(now, daysToSat)), ABQ_TZ)
}

export function endOfWeekend(): TZDate {
  const now = nowInABQ()
  const day = now.getDay()
  let daysToSunday = 7 - day
  if (day === 0) daysToSunday = 0
  return new TZDate(endOfDay(addDays(now, daysToSunday)), ABQ_TZ)
}

/** Returns ISO strings suitable for Supabase `.gte` / `.lte` filters */
export type TimeFilter = 'today' | 'tonight' | 'tomorrow' | 'this-weekend' | 'this-week' | 'upcoming'

export function getTimeRange(filter: TimeFilter): { gte: string; lte?: string } {
  const now = nowInABQ()

  switch (filter) {
    case 'today':
      return {
        // Use a bare YYYY-MM-DD string so both date-only ('2026-04-29') and
        // full-timestamp ('2026-04-29T10:00:00-06:00') event_date rows pass the
        // gte filter. In PostgreSQL text comparison a plain date string sorts
        // BEFORE any same-day timestamp, so an ISO timestamp gte was silently
        // dropping all date-only events.
        gte: format(nowInABQ(), 'yyyy-MM-dd'),
        lte: endOfToday().toISOString(),
      }
    case 'tonight': {
      // Same date-only gte trick — grabs all of today's events from the DB.
      // fetchEvents then applies a 5 PM Mountain-time in-memory cutoff to drop
      // morning events whose timestamps are known (see needsInMemory logic there).
      // Date-only events (time unknown) are always kept — they might be evening shows.
      return {
        gte: format(nowInABQ(), 'yyyy-MM-dd'),
        lte: endOfToday().toISOString(),
      }
    }
    case 'tomorrow': {
      const tomorrow = new TZDate(addDays(startOfToday(), 1), ABQ_TZ)
      return {
        gte: tomorrow.toISOString(),
        lte: endOfDay(tomorrow).toISOString(),
      }
    }
    case 'this-weekend':
      return {
        gte: startOfWeekend().toISOString(),
        lte: endOfWeekend().toISOString(),
      }
    case 'this-week': {
      const weekEnd = new TZDate(addDays(startOfToday(), 7), ABQ_TZ)
      return {
        gte: now.toISOString(),
        lte: endOfDay(weekEnd).toISOString(),
      }
    }
    case 'upcoming':
    default:
      return { gte: now.toISOString() }
  }
}

/** Pretty display format: "Fri, Apr 18 · 8:00 PM" */
export function formatEventTime(isoString: string): string {
  const d = new TZDate(new Date(isoString), ABQ_TZ)
  return format(d, "EEE, MMM d · h:mm a")
}

/** Short date only: "Apr 18" */
export function formatShortDate(isoString: string): string {
  const d = new TZDate(new Date(isoString), ABQ_TZ)
  return format(d, "MMM d")
}

/** Returns "Today", "Tomorrow", or the formatted date */
export function friendlyDate(isoString: string): string {
  const d = new TZDate(new Date(isoString), ABQ_TZ)
  const todayStart  = startOfToday()
  const tomorrowStart = new TZDate(addDays(todayStart, 1), ABQ_TZ)
  const dayAfter    = new TZDate(addDays(todayStart, 2), ABQ_TZ)

  if (!isBefore(d, tomorrowStart) === false) return 'Today'
  if (isAfter(d, tomorrowStart) && isBefore(d, dayAfter)) return 'Tomorrow'
  return format(d, "EEE, MMM d")
}
