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

/** Parse a display/clock time ("7:30 PM", "19:30") to {hour, minute}, or null if unparseable. */
export function parseClockTime(time: string | null | undefined): { hour: number; minute: number } | null {
  const t = time?.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const minute = parseInt(m[2], 10)
  const mer = m[3]?.toUpperCase()
  if (mer === 'PM' && hour < 12) hour += 12
  if (mer === 'AM' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

/** The America/Denver UTC offset in effect on a given date ("-06:00" MDT / "-07:00" MST).
 *  DST-aware via Intl — replaces hardcoded -06:00 that was wrong all winter (MST). */
export function denverOffsetForDate(dateStr: string): string {
  const probe = new Date(`${dateStr.slice(0, 10)}T12:00:00Z`)
  if (isNaN(probe.getTime())) return '-07:00'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ABQ_TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(probe)
  const o = Object.fromEntries(parts.map(p => [p.type, p.value])) as Record<string, string>
  const asUTC = Date.UTC(+o.year, +o.month - 1, +o.day, +(o.hour === '24' ? '0' : o.hour), +o.minute, +o.second)
  const diffMin = Math.round((asUTC - probe.getTime()) / 60000)
  const sign = diffMin >= 0 ? '+' : '-'
  const abs = Math.abs(diffMin)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
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
