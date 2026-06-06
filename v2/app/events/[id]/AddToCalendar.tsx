'use client'

import { CalendarPlus } from 'lucide-react'

interface AddToCalendarProps {
  id: string
  title: string
  /** YYYY-MM-DD or full ISO string from NormalizedEvent.date */
  date: string
  venue: string | null
  address: string | null
  description: string | null
}

// ─── Google Calendar UTC date helpers ────────────────────────────────────────

/**
 * Build a UTC datetime string in Google Calendar format: YYYYMMDDTHHMMSSZ
 * Google Calendar needs UTC for the `dates` param.
 * Since our events are in America/Denver (UTC-6 standard / UTC-7 MDT),
 * we offset by 6 hours as a reasonable approximation for date-only events.
 * For full ISO timestamps, we parse them directly.
 */
function toGcalUtc(isoDate: string): string {
  let d: Date

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    // Date-only: treat noon Denver (UTC-6) as 6 PM UTC
    d = new Date(`${isoDate}T18:00:00Z`)
  } else if (isoDate.endsWith('Z') || isoDate.includes('+')) {
    d = new Date(isoDate)
  } else {
    // Local time string — treat as America/Denver (~UTC-6 MST)
    d = new Date(isoDate + '-06:00')
  }

  if (isNaN(d.getTime())) {
    // Fallback: parse date portion only
    const datePart = isoDate.slice(0, 10)
    d = new Date(`${datePart}T18:00:00Z`)
  }

  const pad2 = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  )
}

function toGcalUtcPlusTwoHours(isoDate: string): string {
  const start = toGcalUtc(isoDate)
  // Parse back and add 2 hours
  const d = new Date(
    parseInt(start.slice(0, 4)),
    parseInt(start.slice(4, 6)) - 1,
    parseInt(start.slice(6, 8)),
    parseInt(start.slice(9, 11)) + 2,
    parseInt(start.slice(11, 13)),
    parseInt(start.slice(13, 15)),
  )
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddToCalendar({
  id,
  title,
  date,
  venue,
  address,
  description,
}: AddToCalendarProps) {
  const canonicalUrl = `https://abqunplugged.com/events/${id}`

  // Google Calendar URL
  const startUtc = toGcalUtc(date)
  const endUtc   = toGcalUtcPlusTwoHours(date)

  const locationParts: string[] = []
  if (venue) locationParts.push(venue)
  if (address) locationParts.push(address)
  const locationStr = locationParts.join(', ')

  const descStr = [description ?? '', canonicalUrl].filter(Boolean).join('\n\n')

  const gcalUrl = new URL('https://calendar.google.com/calendar/render')
  gcalUrl.searchParams.set('action', 'TEMPLATE')
  gcalUrl.searchParams.set('text', title)
  gcalUrl.searchParams.set('dates', `${startUtc}/${endUtc}`)
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
