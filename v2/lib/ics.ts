/**
 * ICS / VCALENDAR builder — RFC 5545 compliant
 * Produces floating local-time events in America/Denver timezone.
 * No external dependencies.
 */

import type { NormalizedEvent } from '@/lib/events'
import { parseClockTime } from '@/lib/utils/dates'

// ─── RFC 5545 escaping ────────────────────────────────────────────────────────

/** Escape text values per RFC 5545 §3.3.11 */
function escapeText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Strip HTML tags and collapse whitespace */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Date/time formatting ─────────────────────────────────────────────────────

/**
 * Format a date string to ICS floating local-time: YYYYMMDDTHHMMSS
 * Input may be:
 *   - YYYY-MM-DD            → midnight (000000) — date-only events
 *   - YYYY-MM-DDTHH:MM:SS   → local time
 *   - YYYY-MM-DDTHH:MM:SSZ  → UTC — convert to Denver time
 */
function toIcsDateTime(isoDate: string, isoTime: string | null): string {
  // Build a full ISO string to parse
  let fullIso: string

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    // event_date is date-only; the real start time (if known) lives in the
    // display `isoTime` string ("7:00 PM"). Parse it instead of always defaulting
    // to noon — that was putting every timed-but-date-only event at 12:00.
    const clock = parseClockTime(isoTime)
    const hh = clock ? String(clock.hour).padStart(2, '0') : '12'
    const mm = clock ? String(clock.minute).padStart(2, '0') : '00'
    // Floating local time; DTSTART carries TZID=America/Denver, which is DST-safe.
    fullIso = `${isoDate}T${hh}:${mm}:00`
  } else {
    // isoDate is already a full ISO timestamp (e.g. from start_at or dateTime fields)
    fullIso = isoDate
  }

  try {
    const d = new Date(fullIso)
    if (isNaN(d.getTime())) return toIcsDateTimeFromStr(isoDate)

    // If the input was UTC (ends with Z or +00:00), convert to Denver local time
    const isUtc = fullIso.endsWith('Z') || fullIso.includes('+')
    if (isUtc) {
      // Format in Denver timezone
      const denverStr = d.toLocaleString('en-CA', {
        timeZone: 'America/Denver',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      // en-CA gives: "YYYY-MM-DD, HH:MM:SS"
      const [datePart, timePart] = denverStr.split(', ')
      return (datePart.replace(/-/g, '') + 'T' + timePart.replace(/:/g, '')).slice(0, 15)
    }

    // Local time — just format directly
    return toIcsDateTimeFromStr(fullIso)
  } catch {
    return toIcsDateTimeFromStr(isoDate)
  }
}

/** Convert YYYY-MM-DDTHH:MM:SS (local) to YYYYMMDDTHHMMSS */
function toIcsDateTimeFromStr(iso: string): string {
  // Strip timezone suffix if present
  const clean = iso.replace(/[Z+].*$/, '').replace(/[-:]/g, '')
  if (clean.length >= 15) return clean.slice(0, 15)
  // Date-only YYYYMMDD → YYYYMMDDT120000
  if (clean.length === 8) return `${clean}T120000`
  return clean.padEnd(15, '0')
}

/** Add 2 hours to an ICS datetime string YYYYMMDDTHHMMSS */
function addTwoHours(icsTs: string): string {
  // Parse: YYYYMMDDTHHMMSS
  const year  = parseInt(icsTs.slice(0, 4), 10)
  const month = parseInt(icsTs.slice(4, 6), 10) - 1
  const day   = parseInt(icsTs.slice(6, 8), 10)
  const hour  = parseInt(icsTs.slice(9, 11), 10)
  const min   = parseInt(icsTs.slice(11, 13), 10)
  const sec   = parseInt(icsTs.slice(13, 15), 10)
  const d = new Date(year, month, day, hour + 2, min, sec)
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  )
}

// ─── DTSTAMP (current UTC time) ───────────────────────────────────────────────

function dtstampNow(): string {
  const d = new Date()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  )
}

// ─── Line folding ─────────────────────────────────────────────────────────────

/**
 * RFC 5545 §3.1 — fold lines longer than 75 octets.
 * Continuation lines begin with a single space.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let pos = 0
  // First chunk: 75 chars
  chunks.push(line.slice(0, 75))
  pos = 75
  // Subsequent chunks: 74 chars (one space prefix will be added)
  while (pos < line.length) {
    chunks.push(' ' + line.slice(pos, pos + 74))
    pos += 74
  }
  return chunks.join('\r\n')
}

// ─── Public builder ───────────────────────────────────────────────────────────

export function buildIcs(event: NormalizedEvent): string {
  const CRLF = '\r\n'

  const uid = `${event.id}@abqunplugged.com`
  const dtstamp = dtstampNow()
  const dtstart = toIcsDateTime(event.date, event.time)
  const dtend = addTwoHours(dtstart)

  const summary = escapeText(event.title)

  // Description: stripped description + URL
  const canonicalUrl = `https://abqunplugged.com/events/${event.id}`
  const descParts: string[] = []
  if (event.description) descParts.push(stripHtml(event.description))
  descParts.push(canonicalUrl)
  const description = escapeText(descParts.join('\\n'))

  // Location: venue name + address
  const locationParts: string[] = []
  if (event.venue) locationParts.push(event.venue)
  if (event.address) locationParts.push(event.address)
  const location = locationParts.length > 0 ? escapeText(locationParts.join(', ')) : null

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ABQ Unplugged//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=America/Denver:${dtstart}`,
    `DTEND;TZID=America/Denver:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    ...(location ? [`LOCATION:${location}`] : []),
    `URL:${canonicalUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.map(foldLine).join(CRLF) + CRLF
}
