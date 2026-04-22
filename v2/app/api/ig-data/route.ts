/**
 * GET /api/ig-data?url=/events/[id]   (or full https://abqunplugged.com/events/[id])
 *
 * Returns structured event data shaped for the IG Post Generator:
 *   category, title, tagline, date, time, venue, address, about, bullets, tip, imageUrl
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchEventById } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing ?url param' }, { status: 400 })
  }

  // Extract event ID from paths like /events/123 or full URLs
  const match = rawUrl.match(/\/events\/([^/?#]+)/)
  if (!match) {
    return NextResponse.json({ error: 'Not a valid /events/[id] URL' }, { status: 400 })
  }

  const id = match[1]
  const event = await fetchEventById(id)
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // ── Category string ───────────────────────────────────────────────────────
  const parts: string[] = []
  if (event.category)    parts.push(capitalise(event.category))
  if (event.subcategory) parts.push(capitalise(event.subcategory))
  const category = parts.join(' · ') || 'Albuquerque'

  // ── Date / time ───────────────────────────────────────────────────────────
  const dateStr = formatDate(event.date)
  const timeStr = event.time ?? ''

  // ── About / tagline ───────────────────────────────────────────────────────
  const about = event.about ?? event.description ?? ''
  // Tagline: first sentence of about (capped at 90 chars), else description prefix
  const tagline = firstSentence(about, 90) ||
    (event.description ? event.description.slice(0, 80).trim() : category)

  // ── Bullets from highlights array ─────────────────────────────────────────
  let bullets: string[] = event.highlights.slice(0, 4)
  if (bullets.length === 0 && about) {
    // Generate 2-3 bullets from sentences in the about text
    bullets = about
      .split(/[.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 120)
      .slice(0, 3)
  }

  // ── Tip ───────────────────────────────────────────────────────────────────
  const tip = event.localTips ?? event.venueTips ?? ''

  // ── Address ───────────────────────────────────────────────────────────────
  const address = [event.address, event.neighborhood ?? event.city]
    .filter(Boolean)
    .join(', ')

  return NextResponse.json({
    category,
    title:    event.title,
    tagline,
    date:     dateStr,
    time:     timeStr,
    venue:    event.venue ?? '',
    address,
    about,
    bullets,
    tip,
    // Use the event's own image, or fall back to the same category image
    // the IG card pages show — so the editor always matches what the user sees
    // on the event page. getCategoryFallback returns a same-origin /fallbacks/ path.
    imageUrl: event.imageUrl
      ?? getCategoryFallback(event.category ?? undefined, event.id)
      ?? '',
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    // dateStr may be YYYY-MM-DD or ISO datetime with TZ offset
    const iso = dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month:   'long',
      day:     'numeric',
      year:    'numeric',
      timeZone: 'America/Denver',
    })
  } catch {
    return dateStr
  }
}

function firstSentence(text: string, max: number): string {
  if (!text) return ''
  const m = text.match(/^([^.!?]{10,}[.!?])/)
  const s = m ? m[1].trim() : text.split(/[.!?]/)[0].trim()
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
