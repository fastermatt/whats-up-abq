/**
 * IGCard — shared Instagram card renderer.
 *
 * format:
 *   'square'   → 1:1  (1080×1080) — standard feed post
 *   'portrait' → 4:5  (1080×1350) — tall feed post, fits more info
 *   'story'    → 9:16 (1080×1920) — full-screen story
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchEventById } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { MapPin, Clock } from 'lucide-react'

export type IGFormat = 'square' | 'portrait' | 'story'

interface Props {
  id: string
  format: IGFormat
}

function formatDateLong(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso)
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: 'America/Denver',
    })
  } catch { return '' }
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  try {
    // Handle "HH:MM:SS" local time strings
    const clean = t.includes('T') ? t.split('T')[1].slice(0, 5) : t.slice(0, 5)
    const [h, m] = clean.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  } catch { return t }
}

const ASPECT: Record<IGFormat, string> = {
  square:   '1 / 1',
  portrait: '4 / 5',
  story:    '9 / 16',
}

const FORMAT_LABEL: Record<IGFormat, string> = {
  square:   '1:1 · Square feed post',
  portrait: '4:5 · Portrait feed post',
  story:    '9:16 · Story / Reel',
}

const OTHER_FORMATS: Record<IGFormat, { label: string; suffix: string }[]> = {
  square:   [{ label: '4:5 Portrait', suffix: 'ig2' }, { label: '9:16 Story', suffix: 'ig3' }],
  portrait: [{ label: '1:1 Square',  suffix: 'ig'  }, { label: '9:16 Story', suffix: 'ig3' }],
  story:    [{ label: '1:1 Square',  suffix: 'ig'  }, { label: '4:5 Portrait', suffix: 'ig2' }],
}

export async function IGCard({ id, format }: Props) {
  const event = await fetchEventById(id)
  if (!event) notFound()

  const image    = event.imageUrl || getCategoryFallback(event.category ?? undefined, id)
  const dateStr  = formatDateLong(event.date)
  const timeStr  = fmtTime(event.time)
  const category = event.category ?? ''
  const venue    = event.venue ?? 'Albuquerque, NM'
  const eventUrl = `abqunplugged.com/events/${id}`
  const isStory  = format === 'story'

  // Title font size — smaller for long titles, bigger for short
  const titleLen = event.title.length
  const titleSize = isStory
    ? (titleLen > 50 ? '1.8rem' : titleLen > 30 ? '2.4rem' : '3rem')
    : (titleLen > 50 ? '1.2rem' : titleLen > 30 ? '1.5rem' : '1.9rem')

  return (
    <>
      {/* Full-screen overlay — covers nav so screenshot is clean */}
      <div
        className="fixed inset-0 z-[9999] bg-[#111] flex flex-col items-center justify-center gap-4 overflow-auto py-6"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {/* ── Card ── */}
        <div
          id="ig-card"
          className="relative bg-black overflow-hidden shadow-2xl flex-shrink-0"
          style={{
            aspectRatio: ASPECT[format],
            // Square/portrait: fill phone width. Story: fill phone height.
            width: isStory ? 'auto' : 'min(100vw, 480px)',
            height: isStory ? 'min(100svh, 640px)' : 'auto',
            maxWidth: isStory ? '360px' : undefined,
          }}
        >
          {/* Background image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'brightness(0.65)' }}
          />

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: isStory
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.75) 70%, rgba(0,0,0,0.95) 100%)'
                : 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.9) 100%)',
            }}
          />

          {/* Top bar — logo + category */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between"
            style={{ padding: isStory ? '1.5rem' : '0.875rem 1rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-white.svg"
              alt="ABQ Unplugged"
              style={{ height: isStory ? '2rem' : '1.25rem', width: 'auto' }}
            />
            {category && (
              <div
                className="bg-[#9a442d] text-white font-bold uppercase tracking-wide rounded-full"
                style={{ fontSize: isStory ? '0.8rem' : '0.65rem', padding: isStory ? '0.35rem 0.9rem' : '0.2rem 0.65rem' }}
              >
                {category}
              </div>
            )}
          </div>

          {/* Story middle — large decorative date pill */}
          {isStory && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-8">
                <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">
                  {new Date((/^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date + 'T12:00:00' : event.date))
                    .toLocaleDateString('en-US', { month: 'long', timeZone: 'America/Denver' }).toUpperCase()}
                </p>
                <p className="text-white font-black" style={{ fontSize: '6rem', lineHeight: 1 }}>
                  {new Date((/^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date + 'T12:00:00' : event.date))
                    .toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Denver' })}
                </p>
                <p className="text-white/60 text-sm uppercase tracking-widest mt-1">
                  {new Date((/^\d{4}-\d{2}-\d{2}$/.test(event.date) ? event.date + 'T12:00:00' : event.date))
                    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Denver' })}
                </p>
              </div>
            </div>
          )}

          {/* Bottom content */}
          <div
            className="absolute bottom-0 left-0 right-0 space-y-2"
            style={{ padding: isStory ? '1.5rem' : '0.875rem 1rem' }}
          >
            {/* Title */}
            <h1
              className="text-white font-black leading-tight"
              style={{ fontSize: titleSize, lineHeight: 1.05, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}
            >
              {event.title}
            </h1>

            {/* Date + time */}
            <div className="flex items-center gap-1.5 text-white/90">
              <Clock className="flex-shrink-0 text-[#e8a898]" style={{ width: isStory ? '1rem' : '0.8rem', height: isStory ? '1rem' : '0.8rem' }} />
              <span style={{ fontSize: isStory ? '0.95rem' : '0.78rem' }} className="font-semibold">
                {timeStr ? `${dateStr} · ${timeStr}` : dateStr}
              </span>
            </div>

            {/* Venue */}
            <div className="flex items-center gap-1.5 text-white/75">
              <MapPin className="flex-shrink-0 text-[#e8a898]" style={{ width: isStory ? '1rem' : '0.8rem', height: isStory ? '1rem' : '0.8rem' }} />
              <span style={{ fontSize: isStory ? '0.9rem' : '0.75rem' }}>{venue}</span>
            </div>

            {/* CTA strip */}
            <div
              className="flex items-center justify-between"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.18)',
                paddingTop: isStory ? '0.75rem' : '0.5rem',
                marginTop: isStory ? '0.5rem' : '0.25rem',
              }}
            >
              <span className="text-white/50 font-medium" style={{ fontSize: isStory ? '0.75rem' : '0.6rem' }}>
                Tickets &amp; info
              </span>
              <span className="text-white font-bold tracking-wide" style={{ fontSize: isStory ? '0.85rem' : '0.65rem' }}>
                {eventUrl}
              </span>
            </div>
          </div>
        </div>

        {/* ── Controls below card ── */}
        <div className="text-center space-y-2 px-4">
          <p className="text-white/40 text-xs">{FORMAT_LABEL[format]}</p>
          <p className="text-white/30 text-[11px]">📸 Screenshot → crop to card → post</p>

          {/* Switch format */}
          <div className="flex items-center gap-2 justify-center mt-2">
            {OTHER_FORMATS[format].map(({ label, suffix }) => (
              <Link
                key={suffix}
                href={`/events/${id}/${suffix}`}
                className="px-3 py-1.5 rounded-full border border-white/20 text-white/50 text-[11px] hover:border-[#9a442d] hover:text-white/80 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>

          <Link href={`/events/${id}`} className="inline-block mt-1 text-[#9a442d] text-xs hover:text-[#c4603f] transition-colors">
            ← Back to event
          </Link>
        </div>
      </div>
    </>
  )
}
