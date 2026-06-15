'use client'

import { CalendarPlus } from 'lucide-react'

interface AddToCalendarProps {
  id: string
  title: string
  /** YYYY-MM-DD or full ISO string from NormalizedEvent.date */
  date: string
  /** Display time string ("7:00 PM") from NormalizedEvent.time, when date is date-only */
  time: string | null
  venue: string | null
  address: string | null
  description: string | null
}

// ─── Google Calendar local-time helpers ───────────────────────────────────────
// We pass LOCAL wall-clock times + ctz=America/Denver so Google applies the
// correct offset (MST vs MDT) itself — no manual, DST-unaware -06:00 math, and
// the real event time is used instead of a noon approximation.

function parseTimeParts(time: string | null): { h: number; m: number } {
  const match = time?.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/)
  if (!match) return { h: 12, m: 0 } // noon fallback when time unknown
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const mer = match[3]?.toUpperCase()
  if (mer === 'PM' && h < 12) h += 12
  if (mer === 'AM' && h === 12) h = 0
  return { h: h > 23 ? 12 : h, m: m > 59 ? 0 : m }
}

/** Format a UTC-keyed Date (whose UTC fields hold local digits) as floating
 *  "YYYYMMDDTHHMMSS" for Google Calendar's `dates` param (paired with ctz). */
function fmtLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`
}

/** The event's Denver wall-clock start as a UTC-keyed Date (UTC fields = local
 *  digits), so fmtLocal emits the wall clock regardless of the runtime TZ. */
function denverWallClock(date: string, time: string | null): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const { h, m } = parseTimeParts(time)
    return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m, 0))
  }
  // Full ISO timestamp → read its Denver wall clock via Intl
  const o = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Denver', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(date)).map(p => [p.type, p.value])
  ) as Record<string, string>
  return new Date(Date.UTC(+o.year, +o.month - 1, +o.day, +(o.hour === '24' ? '0' : o.hour), +o.minute, 0))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddToCalendar({
  id,
  title,
  date,
  time,
  venue,
  address,
  description,
}: AddToCalendarProps) {
  const canonicalUrl = `https://abqunplugged.com/events/${id}`

  // Google Calendar URL — local wall-clock + ctz (DST-safe, uses the real time)
  const startWall = denverWallClock(date, time)
  const start = fmtLocal(startWall)
  const end   = fmtLocal(new Date(startWall.getTime() + 2 * 3600 * 1000))

  const locationParts: string[] = []
  if (venue) locationParts.push(venue)
  if (address) locationParts.push(address)
  const locationStr = locationParts.join(', ')

  const descStr = [description ?? '', canonicalUrl].filter(Boolean).join('\n\n')

  const gcalUrl = new URL('https://calendar.google.com/calendar/render')
  gcalUrl.searchParams.set('action', 'TEMPLATE')
  gcalUrl.searchParams.set('text', title)
  gcalUrl.searchParams.set('dates', `${start}/${end}`)
  gcalUrl.searchParams.set('ctz', 'America/Denver')
  gcalUrl.searchParams.set('details', descStr)
  if (locationStr) gcalUrl.searchParams.set('location', locationStr)

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <a
        href={`/api/events/${id}/ics`}
        download
        data-umami-event="add-to-calendar"
        data-umami-event-format="ics"
        data-umami-event-event-id={id}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-terra text-terra text-xs font-semibold hover:bg-terra/8 transition-colors"
        aria-label="Download ICS file for Apple Calendar or Outlook"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        Apple / Outlook
      </a>
      <a
        href={gcalUrl.toString()}
        target="_blank"
        rel="noopener noreferrer"
        data-umami-event="add-to-calendar"
        data-umami-event-format="google"
        data-umami-event-event-id={id}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-terra text-terra text-xs font-semibold hover:bg-terra/8 transition-colors"
        aria-label="Add to Google Calendar"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        Google Calendar
      </a>
    </div>
  )
}
