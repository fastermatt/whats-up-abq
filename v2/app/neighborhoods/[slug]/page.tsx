import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEventsByNeighborhood, neighborhoodToSlug } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { MapPin, Calendar, ArrowLeft, ExternalLink, Map } from 'lucide-react'
import neighborhoodDescriptions from '@/lib/neighborhood-descriptions.json'
import { buildBreadcrumbs } from '@/lib/seo'

export const revalidate = 3600

/** Common alternate slugs users type → canonical slug we use in the DB.
 *  Avoids 404s for natural-language neighborhood names. */
const NEIGHBORHOOD_ALIASES: Record<string, string> = {
  'university':      'unm-campus',
  'unm':             'unm-campus',
  'nob-hill':        'nob-hill',          // already canonical but guards against future rename
  'old-town':        'old-town',
  'downtown-abq':    'downtown',
  'central':         'downtown',
  'east-mountains':  'east-mountains',
  'barelas':         'barelas-south-downtown',
  'south-downtown':  'barelas-south-downtown',
  'barelas-south':   'barelas-south-downtown',
  'rio-rancho':      null as unknown as string,  // hard block — we don't cover RR
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params
  const slug = NEIGHBORHOOD_ALIASES[rawSlug] ?? rawSlug
  if (!slug) return { title: 'Neighborhood Not Found' }
  const events = await fetchEventsByNeighborhood(slug, 1)
  if (events.length === 0) return { title: 'Neighborhood Not Found' }

  const hoodData = (neighborhoodDescriptions as Record<string, { meta?: string; name?: string }>)[slug]
  const prettifySlug = (s: string) =>
    s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const neighborhood = hoodData?.name ?? events[0].neighborhood ?? prettifySlug(slug)
  const metaDesc = hoodData?.meta
    ?? `Upcoming events in ${neighborhood}, Albuquerque NM. Find concerts, comedy, arts, sports, and more on ABQ Unplugged.`
  return {
    title: `Things to Do in ${neighborhood}, Albuquerque NM | Events & Activities`,
    description: metaDesc,
    alternates: { canonical: `https://abqunplugged.com/neighborhoods/${slug}` },
    openGraph: {
      title: `Things to Do in ${neighborhood}, Albuquerque`,
      description: metaDesc,
      url: `https://abqunplugged.com/neighborhoods/${slug}`,
    },
  }
}

export default async function NeighborhoodPage({ params }: PageProps) {
  const { slug: rawSlug } = await params

  // Resolve aliases and redirect to canonical slug
  const canonical = NEIGHBORHOOD_ALIASES[rawSlug]
  if (canonical === null) notFound()               // hard-blocked areas (e.g. Rio Rancho)
  if (canonical && canonical !== rawSlug) redirect(`/neighborhoods/${canonical}`)

  const slug = rawSlug
  const events = await fetchEventsByNeighborhood(slug, 40)

  if (events.length === 0) notFound()

  // AI-generated neighborhood copy (used for hero headline + description fallback)
  const hoodInfo = (neighborhoodDescriptions as Record<string, { description?: string; name?: string }>)[slug] ?? null

  // Pretty display name — never show the raw slug. Priority:
  //   1. Curated `name` from neighborhoodDescriptions (e.g. "Nob Hill")
  //   2. Event row's `neighborhood` field (already pretty)
  //   3. Title-cased slug fallback (e.g. "nob-hill" → "Nob Hill")
  const prettifySlug = (s: string) =>
    s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const neighborhood = hoodInfo?.name ?? events[0].neighborhood ?? prettifySlug(slug)

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

  // Structured data — Place (Neighborhood) + ItemList + BreadcrumbList + FAQ
  const placeLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `${neighborhood}, Albuquerque`,
    description: hoodInfo?.description ?? `The ${neighborhood} neighborhood of Albuquerque, NM`,
    url: `https://abqunplugged.com/neighborhoods/${slug}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Albuquerque',
      addressRegion: 'NM',
      addressCountry: 'US',
    },
    containedInPlace: {
      '@type': 'City',
      name: 'Albuquerque',
      containedInPlace: { '@type': 'State', name: 'New Mexico' },
    },
  }

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Events in ${neighborhood}, Albuquerque`,
    description: `Upcoming events in the ${neighborhood} neighborhood of Albuquerque, NM`,
    url: `https://abqunplugged.com/neighborhoods/${slug}`,
    numberOfItems: events.length,
  }

  const breadcrumbLd = buildBreadcrumbs([
    { name: 'Home', url: 'https://abqunplugged.com' },
    { name: 'Events', url: 'https://abqunplugged.com/events' },
    { name: neighborhood, url: `https://abqunplugged.com/neighborhoods/${slug}` },
  ])

  const neighborhoodFaqs = [
    {
      q: `What is ${neighborhood} known for in Albuquerque?`,
      a: hoodInfo?.description ?? `${neighborhood} is one of Albuquerque's active neighborhoods with a range of upcoming events. Browse ABQ Unplugged to see concerts, arts, community events, and more in this area.`,
    },
    {
      q: `What events are happening in ${neighborhood} this weekend?`,
      a: `ABQ Unplugged aggregates events from Ticketmaster, Eventbrite, SeatGeek, and local sources for ${neighborhood} and all Albuquerque neighborhoods. Filter by This Weekend to see every upcoming event near you.`,
    },
    {
      q: `Are there free things to do in ${neighborhood}, Albuquerque?`,
      a: `Many community events, outdoor activities, and cultural gatherings in ${neighborhood} are free to attend. ABQ Unplugged lets you filter by price to find no-cost events in this neighborhood.`,
    },
  ]

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: neighborhoodFaqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <main className="min-h-dvh bg-[--bg]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

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
        <div className="bg-[#fffdf9] rounded-2xl border border-[#f0e4cc] shadow-sm p-6 mb-6">
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

          {hoodInfo?.description && (
            <p className="text-sm text-[#4a3f3a] leading-relaxed mb-4 max-w-prose">{hoodInfo.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm text-[#6b5d57]">
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
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#fffdf9] border border-[#ddc9a3] text-[#4a3f3a] px-3 py-1.5 rounded-full hover:border-[#006a62] hover:text-[#006a62] transition-colors"
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
              className="text-xs font-bold text-[#6b5d57] uppercase tracking-wider mb-2"
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
                  className="inline-flex items-center gap-1.5 text-xs bg-[#fffdf9] border border-[#ddc9a3] text-[#4a3f3a] px-2.5 py-1 rounded-full hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
                >
                  <MapPin className="w-2.5 h-2.5 text-[#9a442d]" />
                  {venue}
                  <span className="text-[#6b5d57] font-semibold">{cnt}</span>
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
                className="group flex gap-3 bg-[#fffdf9] rounded-xl border border-[#f0e4cc] p-3 shadow-sm hover:shadow-md transition-all"
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#f0e4cc]">
                  <EventImage
                    src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
                    fallback={getCategoryFallback(event.category ?? undefined, event.id)}
                    alt={event.title}
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
                      <p className="text-[10px] text-[#6b5d57] flex items-center gap-0.5 mt-0.5">
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
          <p className="text-xs text-[#6b5d57] leading-relaxed">
            {hoodInfo?.description
              ? hoodInfo.description
              : `Find upcoming concerts, comedy shows, arts events, sports, food & drink festivals,
                and more in the ${neighborhood} area of Albuquerque, NM.
                ABQ Unplugged aggregates events from Ticketmaster, Eventbrite, SeatGeek, and local sources.`}
          </p>
          <Link
            href="/events"
            className="mt-3 inline-flex items-center text-xs font-semibold text-[#9a442d] hover:underline"
          >
            Browse all Albuquerque events →
          </Link>
        </div>

        {/* ── FAQ section ── */}
        <div className="mt-8 pt-6 border-t border-[#f0e4cc]">
          <h2 className="text-sm font-bold text-[#1a1614] uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {neighborhoodFaqs.map(({ q, a }, i) => (
              <div key={i} className="bg-[#fffdf9] rounded-xl border border-[#f0e4cc] p-4">
                <h3 className="text-sm font-bold text-[#1a1614] mb-1.5" style={{ fontFamily: 'var(--font-epilogue)' }}>{q}</h3>
                <p className="text-xs text-[#6b5d57] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
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
