import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEventById } from '@/lib/events'
import { MapPin, Clock, Calendar, Ticket, ArrowLeft, ExternalLink } from 'lucide-react'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const event = await fetchEventById(id)
  if (!event) return { title: 'Event Not Found' }

  const description = event.description
    ?? `${event.title} at ${event.venue ?? 'Albuquerque'} — ${formatDateLong(event.date)}`

  return {
    title: event.title,
    description: description.slice(0, 160),
    openGraph: {
      title: event.title,
      description: description.slice(0, 160),
      ...(event.imageUrl ? { images: [{ url: event.imageUrl }] } : {}),
    },
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params
  const event = await fetchEventById(id)
  if (!event) notFound()

  const dateStr = formatDateLong(event.date)
  const timeStr = event.time ?? ''

  return (
    <main className="min-h-dvh bg-[--bg]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/events"
            className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Events</span>
          </Link>
          <Link
            href="/"
            className="font-black text-lg text-[#1a1614] tracking-tight hover:text-[#9a442d] transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            ABQ Unplugged
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-6 animate-fade-up">
        {/* Hero image */}
        {event.imageUrl && (
          <div className="relative aspect-[2/1] rounded-2xl overflow-hidden mb-6 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

            {/* Category badge */}
            {event.category && (
              <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
                {event.category}
              </div>
            )}
          </div>
        )}

        {/* Title */}
        <h1
          className="text-2xl sm:text-3xl font-black text-[#1a1614] leading-tight mb-4"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          {event.title}
        </h1>

        {/* Meta info cards */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Date */}
          {dateStr && (
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#f0e4cc] shadow-sm">
              <Calendar className="w-4 h-4 text-[#9a442d]" />
              <div>
                <p className="text-xs font-semibold text-[#1a1614]">{dateStr}</p>
                {timeStr && <p className="text-[11px] text-[#8a7a74]">{timeStr}</p>}
              </div>
            </div>
          )}

          {/* Venue */}
          {event.venue && (
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#f0e4cc] shadow-sm">
              <MapPin className="w-4 h-4 text-[#006a62]" />
              <div>
                <p className="text-xs font-semibold text-[#1a1614]">{event.venue}</p>
                {event.address && <p className="text-[11px] text-[#8a7a74]">{event.address}</p>}
              </div>
            </div>
          )}

          {/* Price */}
          {event.price && (
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#f0e4cc] shadow-sm">
              <Ticket className="w-4 h-4 text-[#4f6249]" />
              <p className="text-xs font-semibold text-[#1a1614]">{event.price}</p>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="prose prose-sm max-w-none mb-6">
            <p className="text-sm text-[#4a3f3a] leading-relaxed">{event.description}</p>
          </div>
        )}

        {/* CTA button */}
        {event.ticketUrl && (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all duration-300 hover:shadow-lg hover:shadow-[#9a442d]/20 hover:scale-[1.02]"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Get Tickets
            <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
        )}

        {/* Source attribution */}
        <p className="text-[10px] text-[#8a7a74] mt-6">
          Source: {event.source.charAt(0).toUpperCase() + event.source.slice(1)}
        </p>
      </article>
    </main>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateLong(iso: string): string {
  if (!iso) return ''
  try {
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso
    const d = new Date(normalized)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Denver',
    })
  } catch {
    return ''
  }
}
