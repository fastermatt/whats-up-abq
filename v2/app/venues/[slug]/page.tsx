import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEventsByVenue, fetchTopVenues, fetchVenueBySlug, neighborhoodToSlug } from '@/lib/events'
import { buildBreadcrumbs } from '@/lib/seo'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { MapPin, Calendar, ArrowLeft, ExternalLink, Ticket } from 'lucide-react'
import { InstagramIcon } from '@/app/components/InstagramIcon'
import { venueInstagram } from '@/data/venue-instagram'
import { AnimateIn } from '@/app/components/AnimateIn'
import venueDescriptions from '@/lib/venue-descriptions.json'

export const revalidate = 3600

/** Slug aliases for common misspellings / alternate spellings that won't
 *  resolve via the normal fetchVenueBySlug lookup.
 *  Key: what the user typed. Value: the canonical slug (must match venueToSlug(DB venue_name)). */
const VENUE_SLUG_ALIASES: Record<string, string> = {
  // "Theatre" vs "Theater" — DB uses "Theatre"
  'kimo-theater':            'kimo-theatre',
  'popejoy-theater':         'popejoy-hall',
  // Common shorthand / informal names
  'el-rey':                  'the-historic-el-rey-theater-albuquerque',
  'el-rey-theater':          'the-historic-el-rey-theater-albuquerque',
  'el-rey-theatre':          'the-historic-el-rey-theater-albuquerque',
  'revel-abq':               'revel-entertainment-center',
  'revel':                   'revel-entertainment-center',
  'sunshine':                'sunshine-theater',
  'hyenas':                  'hyenas-comedy-nightclub-albuquerque',
  'hyenas-comedy':           'hyenas-comedy-nightclub-albuquerque',
  'isotopes-park':           'rio-grande-credit-union-field-at-isotopes-park',
  'isotopes':                'rio-grande-credit-union-field-at-isotopes-park',
  'kiva-auditorium':         'kiva-auditorium-at-the-albuquerque-convention-center',
  'convention-center':       'kiva-auditorium-at-the-albuquerque-convention-center',
  'nhcc':                    'national-hispanic-cultural-center',
  'national-hispanic':       'national-hispanic-cultural-center',
  'national-hispanic-cultural-center': 'national-hispanic-cultural-center',
}

interface PageProps {
  params: Promise<{ slug: string }>
}

/** Convert a venue name to a URL-safe slug. Idempotent.
 *  "Hyena's Comedy Nightclub - Albuquerque" → "hyenas-comedy-nightclub-albuquerque"
 *  Rules:
 *  1. Strip apostrophes/quotes first so "Hyena's" → "hyenas" (not "hyena-s")
 *  2. Collapse any remaining run of non-alphanum chars to a single hyphen
 *  3. Strip leading/trailing hyphens */
export function venueToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`"]/g, '')         // strip apostrophes/quotes (Hyena's → hyenas)
    .replace(/[^a-z0-9]+/g, '-')   // any run of non-alphanum → single hyphen
    .replace(/^-|-$/g, '')          // strip leading/trailing
}

/** Symmetric slug equality — both sides go through `venueToSlug` so any
 *  historical/typed variant (single, double, triple hyphens, missing
 *  apostrophes, etc.) all resolve to the same canonical form. */
export function venueSlugMatches(slug: string, venueName: string): boolean {
  return venueToSlug(decodeURIComponent(slug)) === venueToSlug(venueName)
}

/**
 * Third-place framing line (Oldenburg, 1989).
 * A small italic nudge that reframes the venue as a room that belongs
 * to its regulars — not just a transaction location.
 */
function thirdPlaceLine(topCategory: string | null, eventCount: number): string {
  if (eventCount >= 20) return 'A room the regulars know by heart.'
  if (topCategory === 'Music')         return 'The kind of place you remember by the show you saw there.'
  if (topCategory === 'Comedy')        return 'Laughter is a room you share.'
  if (topCategory === 'Sports')        return 'A place to shout with strangers and leave as friends.'
  if (topCategory === 'Food & Drink')  return 'Shared meals, shared hours.'
  if (topCategory === 'Arts & Theater' || topCategory === 'Arts')
                                        return 'A room that holds the quiet and the wonder.'
  if (topCategory === 'Family')        return 'A place where the small people get to belong too.'
  if (topCategory === 'Community')     return 'A room that makes neighbors out of strangers.'
  if (topCategory === 'Film')          return 'The lights go down. The room becomes a room.'
  if (topCategory === 'Outdoor')       return 'The best rooms don\u2019t have ceilings.'
  if (eventCount <= 3)                  return 'Small calendar. Big potential.'
  return 'A place Albuquerque shows up for.'
}

/** Pre-render top 60 venues at build time. */
export async function generateStaticParams() {
  const topVenues = await fetchTopVenues(60)
  return topVenues.map(({ venueName }) => ({ slug: venueToSlug(venueName) }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params
  const slug = VENUE_SLUG_ALIASES[rawSlug] ?? rawSlug
  const venueName = await fetchVenueBySlug(slug)
  if (!venueName) return { title: 'Venue Not Found' }
  const events = await fetchEventsByVenue(venueName, 1)
  if (events.length === 0) return { title: 'Venue Not Found' }

  const venue = events[0].venue ?? venueName
  const canonicalUrl = `https://abqunplugged.com/venues/${slug}`
  const ogImage = events[0].imageUrl || getCategoryFallback(events[0].category ?? undefined, events[0].id)

  const venueData = (venueDescriptions as Record<string, { meta?: string; tagline?: string }>)[slug]
  const metaDesc = venueData?.meta
    ?? `Upcoming events at ${venue} in Albuquerque, NM. Find tickets, dates, and details on ABQ Unplugged — every ticket source in one place.`

  return {
    title: `Events at ${venue} — Albuquerque, NM`,
    description: metaDesc,
    openGraph: {
      title: `Events at ${venue} — Albuquerque, NM`,
      description: metaDesc,
      url: canonicalUrl,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `Events at ${venue}` }],
    },
    alternates: { canonical: canonicalUrl },
  }
}

export default async function VenuePage({ params }: PageProps) {
  const { slug: rawSlug } = await params
  // Resolve alias → canonical slug, then resolve slug → canonical venue name
  const slug = VENUE_SLUG_ALIASES[rawSlug] ?? rawSlug
  const venueName = await fetchVenueBySlug(slug)
  if (!venueName) notFound()
  const events = await fetchEventsByVenue(venueName, 40)
  if (events.length === 0) notFound()

  // Use proper casing from the first event's venue field
  const venue = events[0].venue ?? venueName
  const address = events[0].address ?? null
  const city = events[0].city ?? 'Albuquerque'
  const neighborhood = events[0].neighborhood ?? null
  const neighborhoodSlug = neighborhood ? neighborhoodToSlug(neighborhood) : null

  // AI-generated venue copy (tagline + description)
  const venueInfo = (venueDescriptions as Record<string, { tagline?: string; description?: string }>)[slug] ?? null

  // Best venue image — first event photo, else category fallback
  const venueImage = events[0].imageUrl || getCategoryFallback(events[0].category ?? undefined, events[0].id)

  // Category distribution
  const catCounts: Record<string, number> = {}
  for (const e of events) {
    if (e.category) catCounts[e.category] = (catCounts[e.category] ?? 0) + 1
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const categoryList = Object.entries(catCounts).sort((a, b) => b[1] - a[1])

  // Build full address string
  const fullAddress = address
    ? (city && address.toLowerCase().includes(city.toLowerCase()) ? address : `${address}, ${city}, NM`)
    : `${city}, NM`

  // Schema.org Place + BreadcrumbList JSON-LD
  const placeLd = {
    '@context': 'https://schema.org',
    '@type': 'EntertainmentBusiness',
    name: venue,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address ?? undefined,
      addressLocality: city,
      addressRegion: 'NM',
      addressCountry: 'US',
    },
    url: `https://abqunplugged.com/venues/${slug}`,
    event: events.slice(0, 10).map((e) => ({
      '@type': 'Event',
      name: e.title,
      startDate: e.date,
      location: { '@type': 'Place', name: venue, address: fullAddress },
      url: `https://abqunplugged.com/events/${e.id}`,
      ...(e.imageUrl ? { image: e.imageUrl } : {}),
    })),
  }

  const breadcrumbLd = buildBreadcrumbs([
    { name: 'Home',   url: 'https://abqunplugged.com' },
    { name: 'Events', url: 'https://abqunplugged.com/events' },
    { name: venue,    url: `https://abqunplugged.com/venues/${slug}` },
  ])

  return (
    <main className="min-h-dvh bg-[--bg]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-20 bg-[#fbf7f1]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
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

      {/* ── Venue Hero ── */}
      <div className="relative h-52 sm:h-64 overflow-hidden bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={venueImage}
          alt={venue}
          className="w-full h-full object-cover animate-reveal-scale"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Category pill */}
        {topCategory && (
          <div className="absolute top-4 left-4 bg-[#9a442d] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
            {topCategory} Venue
          </div>
        )}
        {/* Venue name over image */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <h1
            className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-sm"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {venue}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-white/80">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {fullAddress}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Third-place framing — venues are rooms that belong to the people in them */}
        <p className="text-xs italic text-[#6b5d57] leading-relaxed">
          {thirdPlaceLine(topCategory, events.length)}
        </p>

        {/* ── Stats + Neighborhood + Venue Instagram ── */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-[#1a1614]">
            {events.length} upcoming event{events.length !== 1 ? 's' : ''}
          </span>
          {neighborhood && neighborhoodSlug && (
            <>
              <span className="text-[#ddc9a3]">·</span>
              <Link
                href={`/neighborhoods/${neighborhoodSlug}`}
                className="text-xs font-semibold text-[#006a62] hover:underline flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" />
                {neighborhood}
              </Link>
            </>
          )}
          {(() => {
            const venueIg = venueInstagram(venue)
            return venueIg ? (
              <>
                <span className="text-[#ddc9a3]">·</span>
                <a
                  href={`https://instagram.com/${venueIg.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-umami-event="venue-instagram"
                  data-umami-event-handle={venueIg.handle}
                  data-umami-event-venue={venue}
                  data-umami-event-position="venue-page-hero"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#9a442d] hover:underline px-2 py-2 -my-1 rounded"
                >
                  <InstagramIcon size={12} />
                  @{venueIg.display ?? venueIg.handle}
                </a>
              </>
            ) : null
          })()}
        </div>

        {/* ── Venue description ── */}
        {venueInfo?.description && (
          <p className="text-sm text-[#3d2e28] leading-relaxed">
            {venueInfo.description}
          </p>
        )}

        {/* ── Category distribution ── */}
        {categoryList.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categoryList.map(([cat, cnt]) => (
              <Link
                key={cat}
                href={`/events?category=${encodeURIComponent(cat)}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-[#ddc9a3] text-[#4a3f3a] px-3 py-1.5 rounded-full hover:border-[#9a442d] hover:text-[#9a442d] transition-all"
              >
                {cat}
                <span className="bg-[#9a442d] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {cnt}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* ── Google Maps link ── */}
        {address && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(`${venue} ${fullAddress}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#006a62] font-semibold hover:underline"
          >
            <MapPin className="w-3.5 h-3.5" />
            View on Google Maps
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* ── Upcoming Events ── */}
        <div>
          <h2
            className="text-sm font-bold text-[#1a1614] uppercase tracking-wider mb-3"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Upcoming Events at {venue}
          </h2>

          <div className="space-y-2.5">
            {events.map((event, i) => {
              const dateStr = event.date
                ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric',
                    timeZone: 'America/Denver',
                  })
                : null

              return (
                <AnimateIn key={event.id} animation="fade-up" delay={Math.min(i * 25, 200)}>
                  <Link
                    href={`/events/${event.id}`}
                    className="group flex gap-3 bg-white rounded-xl border border-[#f0e4cc] p-3 shadow-sm hover:shadow-md hover:border-[#ddc9a3] transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="w-[72px] h-[72px] rounded-lg overflow-hidden flex-shrink-0 bg-[#f0e4cc]">
                      <EventImage
                        src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
                        fallback={getCategoryFallback(event.category ?? undefined, event.id)}
                        alt={event.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
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
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                        {dateStr && (
                          <p className="text-[10px] text-[#9a442d] font-medium flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {dateStr}{event.time && ` · ${event.time}`}
                          </p>
                        )}
                        {event.price && (
                          <span className="text-[10px] font-semibold text-[#4f6249]">{event.price}</span>
                        )}
                        {event.ticketUrl && (
                          <span className="flex items-center gap-0.5 text-[10px] text-[#006a62]">
                            <Ticket className="w-2.5 h-2.5" />
                            Tickets
                          </span>
                        )}
                      </div>
                    </div>

                    <ExternalLink className="w-3.5 h-3.5 text-[#6b5d57] flex-shrink-0 mt-0.5 group-hover:text-[#9a442d] transition-colors" />
                  </Link>
                </AnimateIn>
              )
            })}
          </div>
        </div>

        {/* ── Browse more ── */}
        <div className="pt-2 pb-4">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#9a442d] hover:underline"
          >
            ← Browse all Albuquerque events
          </Link>
        </div>
      </div>
    </main>
  )
}
