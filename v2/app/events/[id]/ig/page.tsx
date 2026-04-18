/**
 * Instagram Card Generator — /events/[id]/ig
 *
 * Renders a clean, fullscreen Instagram-ready card.
 * Open on your phone → screenshot → crop → post.
 *
 * Square (1:1) card for feed posts. Shows:
 *  - Full-bleed event image with gradient overlay
 *  - Event title, date, time, venue
 *  - Category badge + ABQ Unplugged logo
 *  - Ticket CTA at bottom
 */

import { notFound } from 'next/navigation'
import { fetchEventById } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { MapPin, Clock } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDateLong(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date((/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso))
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: 'America/Denver',
    })
  } catch { return '' }
}

function formatTime(t: string | null): string {
  if (!t) return ''
  try {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  } catch { return t }
}

export default async function IGCardPage({ params }: PageProps) {
  const { id } = await params
  const event = await fetchEventById(id)
  if (!event) notFound()

  const image     = event.imageUrl || getCategoryFallback(event.category ?? undefined, id)
  const dateStr   = formatDateLong(event.date)
  const timeStr   = formatTime(event.time)
  const category  = event.category ?? ''
  const venue     = event.venue ?? 'Albuquerque, NM'
  const siteUrl   = 'abqunplugged.com'
  const eventUrl  = `${siteUrl}/events/${id}`

  return (
    <>
      {/* Full-screen overlay — covers nav/footer so the screenshot is clean */}
      <div
        className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {/* ── The Card ── 1:1 square, max 480px so desktop looks good too */}
        <div
          id="ig-card"
          className="relative bg-black overflow-hidden shadow-2xl"
          style={{
            width:  'min(100vw, 480px)',
            height: 'min(100vw, 480px)',
            flexShrink: 0,
          }}
        >
          {/* Background image — full bleed */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'brightness(0.7)' }}
          />

          {/* Gradient — bottom heavy for text legibility */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.85) 100%)',
            }}
          />

          {/* Top bar — logo + category */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-5">
            {/* ABQ Unplugged logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.svg" alt="ABQ Unplugged" className="h-6 w-auto" />

            {/* Category badge */}
            {category && (
              <div className="bg-[#9a442d] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                {category}
              </div>
            )}
          </div>

          {/* Bottom content — title, date, venue, CTA */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 space-y-2">
            {/* Title */}
            <h1
              className="text-white font-black leading-tight"
              style={{
                fontSize: event.title.length > 40 ? '1.4rem' : event.title.length > 25 ? '1.7rem' : '2rem',
                lineHeight: 1.1,
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {event.title}
            </h1>

            {/* Date + time */}
            <div className="flex items-center gap-1.5 text-white/90">
              <Clock className="w-3.5 h-3.5 text-[#e8a898] flex-shrink-0" />
              <span className="text-sm font-semibold">
                {timeStr ? `${dateStr} · ${timeStr}` : dateStr}
              </span>
            </div>

            {/* Venue */}
            <div className="flex items-center gap-1.5 text-white/80">
              <MapPin className="w-3.5 h-3.5 text-[#e8a898] flex-shrink-0" />
              <span className="text-sm">{venue}</span>
            </div>

            {/* CTA strip */}
            <div
              className="flex items-center justify-between mt-1 pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}
            >
              <span className="text-white/60 text-[11px] font-medium tracking-wide">
                Tickets & info
              </span>
              <span className="text-white text-[12px] font-bold tracking-wide">
                {eventUrl}
              </span>
            </div>
          </div>
        </div>

        {/* ── Hint below card (won't appear in crop) ── */}
        <div className="mt-4 text-center space-y-1 px-6">
          <p className="text-white/50 text-xs">
            📸 Screenshot → crop to the card → post to Instagram
          </p>
          <p className="text-white/30 text-[10px]">
            Square 1:1 · optimized for Instagram feed
          </p>
          <a
            href={`/events/${id}`}
            className="inline-block mt-2 text-[#9a442d] text-xs hover:text-[#c4603f] transition-colors"
          >
            ← Back to event
          </a>
        </div>
      </div>
    </>
  )
}
