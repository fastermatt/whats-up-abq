import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEventsByVenue } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { MapPin, Calendar, ArrowLeft, ExternalLink } from 'lucide-react'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string }>
}

/** Convert URL slug back to a displayable venue name. */
function slugToVenue(slug: string): string {
  return decodeURIComponent(slug).replace(/-/g, ' ')
}

/** Convert a venue name to a URL-safe slug. */
export function venueToSlug(name: string): string {
  return encodeURIComponent(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const venueName = slugToVenue(slug)
  const events = await fetchEventsByVenue(venueName, 1)
  if (events.length === 0) return { title: 'Venue Not Found' }

  const venue = events[0].venue ?? venueName
  return {
    title: `${venue} Events | ABQ Unplugged`,
    description: `Upcoming events at ${venue} in Albuquerque, NM. Find tickets and details on ABQ Unplugged.`,
    alternates: { canonical: `https://abqunplugged.com/venues/${slug}` },
  }
}

export default async function VenuePage({ params }: PageProps) {
  const { slug } = await params
  const venueName = slugToVenue(slug)
  const events = await fetchEventsByVenue(venueName, 30)

  if (events.length === 0) notFound()

  // Use the actual venue name from the first event (to get proper casing)
  const venue = events[0].venue ?? venueName
  const address = events[0].address ?? null
  const city = events[0].city ?? 'Albuquerque'

  // Detect category distribution for the venue
  const catCounts: Record<string, number> = {}
  for (const e of events) {
    if (e.category) catCounts[e.category] = (catCounts[e.category] ?? 0) + 1
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return (
    <main className="min-h-dvh bg-[--bg]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/events"
            className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Events</span>
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* ── Venue Hero ── */}
        <div className="bg-white rounded-2xl border border-[#f0e4cc] shadow-sm p-6 mb-6">
          {topCategory && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-[#f0e4cc] text-[#9a442d] px-2.5 py-1 rounded-full mb-3">
              {topCategory} Venue
            </span>
          )}
          <h1
            className="text-2xl sm:text-3xl font-black text-[#1a1614] leading-tight mb-2"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {venue}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-[#8a7a74]">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#9a442d]" />
              {address ? `${address}, ${city}` : city}
            </span>
            <span className="text-[#ddc9a3]">·</span>
            <span className="font-medium text-[#1a1614]">
              {events.length} upcoming event{events.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── Category chips ── */}
        {Object.keys(catCounts).length > 1 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {Object.entries(catCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, cnt]) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-[#ddc9a3] text-[#4a3f3a] px-3 py-1.5 rounded-full"
                >
                  {cat}
                  <span className="text-[#9a442d] font-bold">{cnt}</span>
                </span>
              ))}
          </div>
        )}

        {/* ── Events list ── */}
        <h2
          className="text-sm font-bold text-[#1a1614] uppercase tracking-wider mb-3"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Upcoming Events
        </h2>

        <div className="space-y-3">
          {events.map((event) => {
            const dateStr = event.date
              ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })
              : null

            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group flex gap-3 bg-white rounded-xl border border-[#f0e4cc] p-3 shadow-sm hover:shadow-md transition-all"
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#f0e4cc]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    {event.category && (
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-[#9a442d] mb-0.5">
                        {event.category}
                      </span>
                    )}
                    <h3
                      className="text-sm font-bold text-[#1a1614] leading-tight line-clamp-2 group-hover:text-[#9a442d] transition-colors"
                      style={{ fontFamily: 'var(--font-epilogue)' }}
                    >
                      {event.title}
                    </h3>
                    {dateStr && (
                      <p className="text-[10px] text-[#9a442d] font-medium flex items-center gap-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {dateStr}
                        {event.time && ` · ${event.time}`}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1">
                    {event.price && (
                      <span className="text-[10px] font-semibold text-[#4f6249]">
                        {event.price}
                      </span>
                    )}
                    {event.ticketUrl && (
                      <span className="flex items-center gap-0.5 text-[10px] text-[#006a62]">
                        Tickets <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
