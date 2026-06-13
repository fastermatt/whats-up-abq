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
  // event_date is a Postgres DATE column, so EVERY bound must be a bare
  // 'yyyy-MM-dd' string. A timestamptz literal (e.g. endOfDay().toISOString())
  // is compared against the date column after a UTC cast, which shifts the
  // boundary by the Mountain offset — that silently dropped each range's first
  // day and leaked the next (verified: 'tomorrow' returned day-after-tomorrow's
  // events and hid all of tomorrow's). Bare date strings compare unambiguously.
  const todayStr = format(nowInABQ(), 'yyyy-MM-dd')

  switch (filter) {
    case 'today':
    case 'tonight':
      // Both scope to today's date. 'tonight' additionally applies a 5 PM
      // Mountain in-memory cutoff in fetchEvents (see isEvening + needsInMemory);
      // date-only events with unknown time are kept there as possible evening shows.
      return { gte: todayStr, lte: todayStr }
    case 'tomorrow': {
      const t = format(new TZDate(addDays(startOfToday(), 1), ABQ_TZ), 'yyyy-MM-dd')
      return { gte: t, lte: t }
    }
    case 'this-weekend':
      // Saturday through Sunday inclusive (startOfWeekend excludes Friday).
      return {
        gte: format(startOfWeekend(), 'yyyy-MM-dd'),
        lte: format(endOfWeekend(), 'yyyy-MM-dd'),
      }
    case 'this-week':
      // Today through 7 days out.
      return {
        gte: todayStr,
        lte: format(new TZDate(addDays(startOfToday(), 7), ABQ_TZ), 'yyyy-MM-dd'),
      }
    case 'upcoming':
    default:
      return { gte: todayStr }
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
