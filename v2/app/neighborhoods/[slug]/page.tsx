import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEventsByNeighborhood, neighborhoodToSlug } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { MapPin, Calendar, ArrowLeft, ExternalLink, Map } from 'lucide-react'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const events = await fetchEventsByNeighborhood(slug, 1)
  if (events.length === 0) return { title: 'Neighborhood Not Found' }

  const neighborhood = events[0].neighborhood ?? slug
  return {
    title: `Things to Do in ${neighborhood}, Albuquerque`,
    description: `Upcoming events in ${neighborhood}, Albuquerque NM. Find concerts, comedy, arts, sports, and more on ABQ Unplugged.`,
    alternates: { canonical: `https://abqunplugged.com/neighborhoods/${slug}` },
    openGraph: {
      title: `Events in ${neighborhood}`,
      description: `Discover upcoming events in ${neighborhood}, Albuquerque NM.`,
      url: `https://abqunplugged.com/neighborhoods/${slug}`,
    },
  }
}

export default async function NeighborhoodPage({ params }: PageProps) {
  const { slug } = await params
  const events = await fetchEventsByNeighborhood(slug, 40)

  if (events.length === 0) notFound()

  // Use the actual neighborhood name from the first event
  const neighborhood = events[0].neighborhood ?? slug

  // Category distribution for the neighborhood
  const catCounts: Record<string, number> = {}
  for (const e of events) {
    if (e.category) catCounts[e.category] = (catCounts[e.category] ?? 0) + 1
  }

  // Top venues in this neighborhood
  const venueCounts: Record<string, number> = {}
  for (const e of events) {
    if (e.venue) venueCounts[e.venue] = (venueCounts[e.venue] ?? 0) + 1
  }
  const topVenues = Object.entries(venueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Structured data for local business/neighborhood
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Events in ${neighborhood}, Albuquerque`,
    description: `Upcoming events in the ${neighborhood} neighborhood of Albuquerque, NM`,
    url: `https://abqunplugged.com/neighborhoods/${slug}`,
    numberOfItems: events.length,
  }

  return (
    <main className="min-h-dvh bg-[--bg]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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
        {/* ── Neighborhood Hero ── */}
        <div className="bg-white rounded-2xl border border-[#f0e4cc] shadow-sm p-6 mb-6">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#f0e4cc] text-[#9a442d] px-2.5 py-1 rounded-full mb-3">
            <Map className="w-3 h-3" />
            Albuquerque Neighborhood
          </span>

          <h1
            className="text-2xl sm:text-3xl font-black text-[#1a1614] leading-tight mb-2"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Things to Do in {neighborhood}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-[#8a7a74]">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#9a442d]" />
              Albuquerque, NM
            </span>
            <span className="text-[#ddc9a3]">·</span>
            <span className="font-medium text-[#1a1614]">
              {events.length} upcoming event{events.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── Category chips ── */}
        {Object.keys(catCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {Object.entries(catCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, cnt]) => (
                <Link
                  key={cat}
                  href={`/events?category=${encodeURIComponent(cat)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-[#ddc9a3] text-[#4a3f3a] px-3 py-1.5 rounded-full hover:border-[#006a62] hover:text-[#006a62] transition-colors"
                >
                  {cat}
                  <span className="text-[#9a442d] font-bold">{cnt}</span>
                </Link>
              ))}
          </div>
        )}

        {/* ── Top venues in this neighborhood ── */}
        {topVenues.length > 0 && (
          <div className="mb-5">
            <h2
              className="text-xs font-bold text-[#8a7a74] uppercase tracking-wider mb-2"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Venues in this area
            </h2>
            <div className="flex flex-wrap gap-2">
              {topVenues.map(([venue, cnt]) => (
                <Link
                  key={venue}
                  href={`/venues/${encodeURIComponent(
                    venue.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
                  )}`}
                  className="inline-flex items-center gap-1.5 text-xs bg-white border border-[#ddc9a3] text-[#4a3f3a] px-2.5 py-1 rounded-full hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
                >
                  <MapPin className="w-2.5 h-2.5 text-[#9a442d]" />
                  {venue}
                  <span className="text-[#8a7a74] font-semibold">{cnt}</span>
                </Link>
              ))}
            </div>
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
                    {event.venue && (
                      <p className="text-[10px] text-[#8a7a74] flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        {event.venue}
                      </p>
                    )}
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

        {/* ── SEO footer ── */}
        <div className="mt-8 pt-6 border-t border-[#f0e4cc]">
          <p className="text-xs text-[#8a7a74] leading-relaxed">
            Find upcoming concerts, comedy shows, arts events, sports, food &amp; drink festivals,
            and more in the {neighborhood} area of Albuquerque, NM.
            ABQ Unplugged aggregates events from Ticketmaster, Eventbrite, SeatGeek, and local sources.
          </p>
          <Link
            href="/events"
            className="mt-3 inline-flex items-center text-xs font-semibold text-[#9a442d] hover:underline"
          >
            Browse all Albuquerque events →
          </Link>
        </div>
      </div>
    </main>
  )
}

/** Generate static params for the top neighborhoods at build time */
export async function generateStaticParams() {
  // Neighborhoods that actually have events in the DB (from tag-neighborhoods-venues.cjs backfill).
  // ISR (revalidate=3600) handles any new neighborhoods that appear after deploy.
  const top = [
    'unm-south-campus',
    'downtown',
    'unm-campus',
    'south-i-25-university-se',
    'uptown-midtown',
    'downtown-edo',
    'northeast-heights',          // merged from Far Northeast Heights
    'state-fairgrounds-midtown',
    'rio-rancho',
    'unm-nob-hill',
    'far-northeast-sandia-foothills',
    'nob-hill',
    'barelas-south-downtown',
  ]
  return top.map((slug) => ({ slug }))
}
