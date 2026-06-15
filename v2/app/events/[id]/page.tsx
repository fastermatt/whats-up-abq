import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEventById, fetchEvents, neighborhoodToSlug } from '@/lib/events'
import { buildBreadcrumbs } from '@/lib/seo'
import { venueToSlug } from '@/app/venues/[slug]/page'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { InstagramIcon } from '@/app/components/InstagramIcon'
import { venueInstagram } from '@/data/venue-instagram'
import { createClient } from '@/lib/supabase/server'
import {
  MapPin, Clock, Calendar, Ticket, ArrowLeft, ExternalLink,
  Users, Flag, Share2,
} from 'lucide-react'
import ShareButton from './ShareButton'
import AddToCalendar from './AddToCalendar'
import { denverOffsetForDate } from '@/lib/utils/dates'
import { AnimateIn } from '@/app/components/AnimateIn'
import { SaveEventButton } from '@/app/components/SaveEventButton'
import { ReviewSection } from '@/app/components/ReviewSection'
import { CheckInButton } from '@/app/components/CheckInButton'
import { InviteCard } from '@/app/components/InviteCard'
import { affiliateUrl } from '@/lib/affiliate'
import { StickyTicketCTA } from './StickyTicketCTA'

export const revalidate = 60

// Human-readable source labels — avoids leaking raw DB enums like "Local-venue" / "Nhcc"
const SOURCE_LABELS: Record<string, string> = {
  'ticketmaster':  'Ticketmaster',
  'seatgeek':      'SeatGeek',
  'eventbrite':    'Eventbrite',
  'local-venue':   'Local venue',
  'local':         'Local listing',
  'nhcc':          'National Hispanic Cultural Center',
  'volunteer':     'Volunteer org',
  'community':     'Community submission',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const event = await fetchEventById(id)
  if (!event) return { title: 'Event Not Found' }

  const dateStr = formatDateLong(event.date)
  const venueStr = event.venue ?? 'Albuquerque, NM'
  // Prefer AI-generated about (clean, local voice) over raw description (may contain HTML entities).
  // Fall back to a useful generic if neither exists.
  const description = (
    event.about
    ?? event.description
    ?? `${event.title} at ${venueStr} on ${dateStr}. Find tickets and full event details on ABQ Unplugged.`
  ).slice(0, 160)

  const canonicalUrl = `https://abqunplugged.com/events/${id}`

  // SEO title: include venue for specificity on tail searches like "Hamilton Popejoy Hall"
  const seoTitle = event.venue
    ? `${event.title} at ${event.venue} — ${dateStr}`
    : `${event.title} — ${dateStr} — Albuquerque`

  const ogImage = event.imageUrl || getCategoryFallback(event.category ?? undefined, id)

  return {
    title: seoTitle,
    description,
    openGraph: {
      title: seoTitle,
      description,
      url: canonicalUrl,
      type: 'article',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: event.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params
  const [event, supabase] = await Promise.all([fetchEventById(id), createClient()])
  if (!event) notFound()

  // Going count
  const { count: goingCount } = await supabase
    .from('user_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('state', 'going')

  // Saved count
  const { count: savedCount } = await supabase
    .from('user_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('state', 'saved')

  // Attendees for "Who's Going"
  const { data: goingUserIds } = await supabase
    .from('user_events')
    .select('user_id')
    .eq('event_id', id)
    .eq('state', 'going')
    .limit(20)

  const attendeeIds = (goingUserIds ?? []).map((u: { user_id: string }) => u.user_id)
  let attendees: { handle: string | null; display_name: string | null; avatar_url: string | null }[] = []
  if (attendeeIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('handle, display_name, avatar_url')
      .in('id', attendeeIds)
      .eq('is_public', true)
      .limit(12)
    attendees = profileRows ?? []
  }

  const dateStr = formatDateLong(event.date)
  const timeStr = event.time ?? ''

  const timesVary = !timeStr && (event.source === 'volunteer'
    || /shift|shifts|multiple sessions|various times|drop.?in|walk.?in|sign up/i.test(event.description || ''))

  const startDate = (() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
      // Convert display time (e.g. "7:30 PM") to 24-hour "HH:MM" for valid ISO 8601
      let time24 = '12:00'
      if (event.time) {
        const h12 = event.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i)
        const h24 = event.time.match(/^(\d{2}):(\d{2})/)
        if (h12) {
          let h = parseInt(h12[1])
          const m = h12[2]
          const pm = h12[3].toUpperCase() === 'PM'
          if (pm && h !== 12) h += 12
          if (!pm && h === 12) h = 0
          time24 = `${String(h).padStart(2, '0')}:${m}`
        } else if (h24) {
          time24 = `${h24[1]}:${h24[2]}`
        }
      }
      return `${event.date}T${time24}:00${denverOffsetForDate(event.date)}`
    }
    return event.date
  })()

  const endDate = (() => {
    // Add 3h to the wall-clock time, preserving the offset. Parse the components
    // and do the math via Date.UTC so the result is independent of the SERVER's
    // timezone (on Netlify TZ=UTC, getHours() would otherwise read UTC and skew
    // the end time by ~6h).
    const m = startDate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})$/)
    if (!m) return undefined
    const [, y, mo, d, hh, mm, , off] = m
    const t = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, 0))
    t.setUTCHours(t.getUTCHours() + 3)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth()+1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00${off}`
  })()

  const eventImage = event.imageUrl || getCategoryFallback(event.category ?? undefined, event.title ?? event.id)

  const rawPrice = event.price
  let offerPrice: string | undefined
  let isFree = false
  if (rawPrice) {
    if (rawPrice.toLowerCase() === 'free' || rawPrice === '$0') {
      isFree = true
      offerPrice = '0'
    } else {
      const match = rawPrice.replace(/,/g, '').match(/[\d]+(?:\.\d+)?/)
      if (match) offerPrice = match[0]
    }
  }

  const ctaLabel = getCtaLabel(event.source, event.price, event.ticketUrl, isFree)
  const ticketHref = event.ticketUrl
    ? (affiliateUrl(event.ticketUrl) ?? event.ticketUrl)
    : null

  // Map category to the most specific schema.org Event subtype — helps carousel matching
  const eventType = (() => {
    switch (event.category) {
      case 'Music': return 'MusicEvent'
      case 'Comedy': return 'ComedyEvent'
      case 'Arts & Theater': return 'TheaterEvent'
      case 'Sports': return 'SportsEvent'
      default: return 'Event'
    }
  })()

  // Only emit performer for events where there is an actual performer (music/comedy/theater).
  // Using event.title as performer name is incorrect and confuses Google's entity extraction.
  const performerCategories = new Set(['Music', 'Comedy', 'Arts & Theater'])
  const hasPerformer = performerCategories.has(event.category ?? '') &&
    event.source !== 'volunteer' && event.source !== 'nhcc' && event.source !== 'local'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': eventType,
    name: event.title,
    startDate,
    ...(endDate ? { endDate } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(event.description ? { description: event.description } : {}),
    image: eventImage,
    url: `https://abqunplugged.com/events/${event.id}`,
    location: {
      '@type': 'Place',
      name: event.venue ?? 'Albuquerque, NM',
      address: {
        '@type': 'PostalAddress',
        ...(event.address ? { streetAddress: event.address } : {}),
        addressLocality: event.city ?? 'Albuquerque',
        addressRegion: 'NM',
        addressCountry: 'US',
      },
    },
    offers: {
      '@type': 'Offer',
      url: event.ticketUrl ?? `https://abqunplugged.com/events/${event.id}`,
      availability: 'https://schema.org/InStock',
      // Full ISO datetime with timezone (not date-only) — required for correct carousel parsing
      validFrom: new Date().toISOString(),
      ...(offerPrice !== undefined ? { price: offerPrice, priceCurrency: 'USD' } : {}),
    },
    organizer: {
      '@type': 'Organization',
      name: 'ABQ Unplugged',
      url: 'https://abqunplugged.com',
    },
    // Only set performer for events with actual performing artists, not community/food/outdoor events
    ...(hasPerformer ? {
      performer: { '@type': 'PerformingGroup', name: event.title }
    } : {}),
  }

  const breadcrumbLd = buildBreadcrumbs([
    { name: 'Home', url: 'https://abqunplugged.com' },
    { name: 'Events', url: 'https://abqunplugged.com/events' },
    ...(event.category ? [{ name: event.category, url: `https://abqunplugged.com/categories/${event.category.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-')}` }] : []),
    { name: event.title, url: `https://abqunplugged.com/events/${event.id}` },
  ])

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent([event.venue, event.address, event.city ?? 'Albuquerque NM'].filter(Boolean).join(', '))}`

  return (
    <main id="main" className="min-h-dvh bg-[--bg] pb-24 md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* ── Nav — cream bar above image on all sizes ── */}
      <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur-md border-b border-sand-mid/60">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link
            href="/events"
            className="flex items-center gap-1.5 text-sm font-medium text-ink-mid hover:text-terra transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Events</span>
          </Link>
          <Link
            href="/"
            className="font-black text-lg tracking-tight text-ink hover:text-terra transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            ABQ Unplugged
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto animate-fade-up">
        {/* ── Poster hero — full-width on mobile, sits below cream nav (no pull-up) ── */}
        <div className="relative h-[420px] sm:h-auto sm:aspect-[2/1]
          sm:mt-4 sm:mx-4 sm:rounded-2xl overflow-hidden">
          <EventImage
            src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
            fallback={getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          {/* Faint warm vignette — the title sits below the image on cream, so this
              just grounds the photo bottom edge instead of crushing it to black. */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/35 to-transparent" />

          {/* Film grain — softens low-res images, mobile only */}
          <div
            className="absolute inset-0 pointer-events-none sm:hidden"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E")`,
              opacity: 0.75,
              mixBlendMode: 'overlay',
            }}
          />
        </div>

        {/* ── Content ── */}
        <div className="px-4 pt-6">

          <div>
            {event.category && (
              <p className="text-[11px] uppercase tracking-[0.15em] text-terra font-bold mb-2">
                {event.subcategory ? `${event.category} · ${event.subcategory}` : event.category}
              </p>
            )}
            <h1
              className="text-3xl sm:text-4xl font-black text-ink leading-[1.1] mb-5"
              style={{ fontFamily: 'var(--font-epilogue)', letterSpacing: '-0.5px' }}
            >
              {event.title}
            </h1>
          </div>

          {/* Mobile: graphic date/venue block — larger type, poster-weight hierarchy */}
          <div className="sm:hidden pt-5 mb-6">
            {/* Date — display size */}
            {dateStr && (
              <div className="mb-2">
                <p
                  className="text-[1.35rem] font-black text-ink leading-tight"
                  style={{ fontFamily: 'var(--font-epilogue)', letterSpacing: '-0.3px' }}
                >
                  {dateStr}
                </p>
                {timeStr && (
                  <p className="text-base font-semibold text-terra mt-0.5">{timeStr}</p>
                )}
                {!timeStr && timesVary && <p className="text-sm text-sage font-medium mt-0.5">Times vary — see host site</p>}
                {!timeStr && !timesVary && <p className="text-sm text-ink-light italic mt-0.5">Time TBA</p>}
              </div>
            )}

            {/* Divider */}
            <div className="w-8 h-[2px] bg-sand-mid my-3" />

            {/* Venue (mobile-specific block) */}
            {event.venue && (() => {
              const venueIg = venueInstagram(event.venue)
              return (
              <div className="mb-3">
                <Link
                  href={`/venues/${venueToSlug(event.venue)}`}
                  className="text-[1.1rem] font-bold text-ink-mid hover:text-terra transition-colors block leading-tight"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  {event.venue}
                </Link>
                {event.address && <p className="text-xs text-ink-light mt-1">{event.address}</p>}
                {event.neighborhood && (
                  <Link href={`/neighborhoods/${neighborhoodToSlug(event.neighborhood)}`} className="block text-xs text-turq hover:text-terra transition-colors mt-0.5">
                    {event.neighborhood}
                  </Link>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-turq hover:text-terra hover:bg-turq/5 transition-colors px-2.5 py-2 -mx-1 rounded min-h-[32px]">
                    <MapPin className="w-2.5 h-2.5" /> Open in Maps
                  </a>
                  {venueIg && (
                    <a
                      href={`https://instagram.com/${venueIg.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-umami-event="venue-instagram"
                      data-umami-event-handle={venueIg.handle}
                      data-umami-event-venue={event.venue}
                      className="inline-flex items-center gap-1 text-[11px] text-terra hover:underline transition-colors"
                    >
                      <InstagramIcon size={11} />
                      @{venueIg.display ?? venueIg.handle}
                    </a>
                  )}
                </div>
              </div>
              )
            })()}
            {!event.venue && event.address && (
              <div className="mb-3">
                <p className="text-[1.1rem] font-bold text-ink-mid" style={{ fontFamily: 'var(--font-epilogue)' }}>{event.address}</p>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-turq hover:text-terra hover:bg-turq/5 transition-colors px-2.5 py-2 -mx-1 rounded min-h-[32px] mt-1">
                  <MapPin className="w-2.5 h-2.5" /> Open in Maps
                </a>
              </div>
            )}

            {/* Price badge */}
            {event.price && (
              <span className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${
                isFree ? 'bg-sage/12 text-sage' : 'bg-terra/10 text-terra'
              }`}>
                {isFree ? '✓ Free' : event.price}
              </span>
            )}
          </div>

          {/* Desktop: full meta block */}
          {/* ── Meta info — clean icon list ── */}
          <div className="hidden sm:block space-y-3 mb-7 text-sm">

            {/* Date + time */}
            {dateStr && (
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-terra mt-0.5 flex-shrink-0" />
                <div className="leading-snug">
                  <span className="font-semibold text-ink">{dateStr}</span>
                  {timeStr && (
                    <span className="text-ink-mid"> · {timeStr}</span>
                  )}
                  {!timeStr && timesVary && (
                    <span className="text-sage font-medium"> · Times vary — see host site</span>
                  )}
                  {!timeStr && !timesVary && (
                    <span className="text-ink-light italic"> · Time TBA</span>
                  )}
                </div>
              </div>
            )}

            {/* Venue + address + neighborhood + maps link + venue Instagram */}
            {event.venue && (() => {
              const venueIg = venueInstagram(event.venue)
              return (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-turq mt-0.5 flex-shrink-0" />
                <div className="leading-snug space-y-0.5">
                  <Link
                    href={`/venues/${venueToSlug(event.venue)}`}
                    className="font-semibold text-ink hover:text-terra transition-colors"
                  >
                    {event.venue}
                  </Link>
                  {event.address && (
                    <p className="text-xs text-ink-mid">{event.address}</p>
                  )}
                  {event.neighborhood && (
                    <Link
                      href={`/neighborhoods/${neighborhoodToSlug(event.neighborhood)}`}
                      className="block text-xs text-turq hover:text-terra transition-colors"
                    >
                      {event.neighborhood}
                    </Link>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-turq hover:text-terra hover:bg-turq/5 transition-colors px-2.5 py-2 -mx-1 rounded min-h-[32px]"
                    >
                      <MapPin className="w-2.5 h-2.5" />
                      Open in Maps
                    </a>
                    {/* Venue's Instagram — only when curated handle exists.
                        Builds community by sending users to the venue's own
                        IG, and (if they tag us back) creates reciprocal
                        discovery. Curated map lives in data/venue-instagram.ts. */}
                    {venueIg && (
                      <a
                        href={`https://instagram.com/${venueIg.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-umami-event="venue-instagram"
                        data-umami-event-handle={venueIg.handle}
                        data-umami-event-venue={event.venue}
                        className="inline-flex items-center gap-1 text-[11px] text-terra hover:underline transition-colors"
                      >
                        <InstagramIcon size={11} />
                        @{venueIg.display ?? venueIg.handle}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              )
            })()}

            {/* Address-only (no venue name) */}
            {!event.venue && event.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-turq mt-0.5 flex-shrink-0" />
                <div className="leading-snug space-y-0.5">
                  <p className="font-semibold text-ink">{event.address}</p>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-turq hover:text-terra hover:bg-turq/5 transition-colors px-2.5 py-2 -mx-1 rounded min-h-[32px]"
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    Open in Maps
                  </a>
                </div>
              </div>
            )}

            {/* Price */}
            <div className="flex items-start gap-3">
              <Ticket className="w-4 h-4 text-sage mt-0.5 flex-shrink-0" />
              <div className="leading-snug">
                {event.price ? (
                  <span className="font-semibold text-ink">
                    {event.price}
                    {isFree && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-sage bg-sage/10 px-1.5 py-0.5 rounded-full align-middle">
                        Free
                      </span>
                    )}
                  </span>
                ) : event.ticketUrl ? (
                  <span className="text-ink-mid">
                    Price on{' '}
                    <a
                      href={event.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-terra underline-offset-2 hover:underline"
                    >
                      ticket page
                    </a>
                  </span>
                ) : (
                  <span className="text-ink-light">Price not listed</span>
                )}
              </div>
            </div>

          </div>{/* end desktop meta block */}

          {/* ── Primary CTA — anchor for sticky bar IntersectionObserver ── */}
          <div id="main-cta" className="flex flex-wrap gap-3 mb-8">
            {ticketHref && (
              <a
                href={ticketHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-terra text-white font-bold text-[15px] hover:bg-terra-hover transition-all duration-200 hover:shadow-lg hover:shadow-terra/25 hover:scale-[1.01] active:scale-[0.99]"
                style={{ fontFamily: 'var(--font-epilogue)' }}
                data-umami-event="ticket-click"
                data-umami-event-event-id={event.id}
                data-umami-event-source={event.source}
                data-umami-event-label={ctaLabel}
              >
                {ctaLabel}
                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            )}
            <ShareButton title={event.title} />
          </div>

          {/* ── Description ── */}
          {event.description && (
            <div className="mb-7">
              <p className="text-[15px] text-ink-mid leading-relaxed">{event.description}</p>
            </div>
          )}

          {/* ── AI Enrichment ──
              Order matches user-utility, not random/historical:
              1. About — what is this thing?
              2. Plan your night — most-actionable: where do I go after?
              3. What to Expect — expectation set
              4. Venue + Local Tips — only-if-going specifics */}
          {(event.about || event.highlights.length > 0 || event.venueTips || event.localTips || event.nearbyDining.length > 0 || event.localRec) && (
            <div className="space-y-3 mb-7">
              {event.about && (
                <div className="rounded-xl px-4 py-3.5 border border-[#e8d9bf] bg-cream-raised">
                  <p className="text-[11px] font-bold text-terra uppercase tracking-wider mb-1.5">About</p>
                  <p className="text-sm text-ink-mid leading-relaxed">{event.about}</p>
                </div>
              )}

              {/* Plan your night — verified nearby restaurants + paired local rec.
                  Warm sandstone tint differentiates from the cream About/Highlights
                  block above and the sage Venue/Local Tips block below — all
                  inside the brand palette (no purple/lavender outliers). */}
              {(event.nearbyDining.length > 0 || event.localRec) && (
                <div className="rounded-xl px-4 py-3.5 border border-[#e8d0b5] bg-[#fdf3e9] space-y-3">
                  <p className="text-[11px] font-bold text-terra-hover uppercase tracking-wider">Plan your night</p>
                  {event.nearbyDining.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-terra uppercase tracking-wider mb-1.5">Eat nearby</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {event.nearbyDining.map((spot, i) => (
                          <li
                            key={i}
                            className="text-xs text-ink-mid bg-white border border-[#e8d0b5] rounded-full px-2.5 py-1 inline-flex items-baseline gap-1"
                            title={spot.note}
                          >
                            <span className="font-semibold">{spot.name}</span>
                            {spot.note && <span className="text-ink-light">· {spot.note}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {event.localRec && (
                    <div>
                      <p className="text-[10px] font-semibold text-terra uppercase tracking-wider mb-1">Make a night of it</p>
                      <p className="text-sm text-ink-mid leading-relaxed">{event.localRec}</p>
                    </div>
                  )}
                </div>
              )}

              {event.highlights.length > 0 && (
                <div className="rounded-xl px-4 py-3.5 border border-[#e8d9bf] bg-cream-raised">
                  <p className="text-[11px] font-bold text-terra uppercase tracking-wider mb-2">What to Expect</p>
                  <ul className="space-y-1.5">
                    {event.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-mid">
                        <span className="text-terra font-bold mt-0.5 leading-none">·</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(event.venueTips || event.localTips) && (
                <div className="rounded-xl px-4 py-3.5 border border-[#d6e8d6] bg-[#f6fbf5] space-y-3">
                  {event.venueTips && (
                    <div>
                      <p className="text-[11px] font-bold text-sage uppercase tracking-wider mb-1">Venue Tips</p>
                      <p className="text-sm text-ink-mid leading-relaxed">{event.venueTips}</p>
                    </div>
                  )}
                  {event.localTips && (
                    <div>
                      <p className="text-[11px] font-bold text-turq uppercase tracking-wider mb-1">Local Tips</p>
                      <p className="text-sm text-ink-mid leading-relaxed">{event.localTips}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Divider ── */}
          <div className="border-t border-[#eee0cc] mb-7" />

          {/* ── Social actions ── */}
          <div className="mb-5">
            <SaveEventButton
              eventId={event.id}
              eventName={event.title}
              eventDate={event.date}
              venueName={event.venue ?? null}
              category={event.category ?? null}
              imageUrl={event.imageUrl ?? null}
              ticketUrl={event.ticketUrl ?? null}
              goingCount={goingCount ?? 0}
            />
          </div>

          <div className="mb-5">
            <CheckInButton
              eventId={event.id}
              eventName={event.title}
              eventDate={event.date}
              venueName={event.venue ?? null}
              venueAddress={event.address ?? null}
            />
          </div>

          {/* Add to calendar */}
          <div className="mb-7">
            <AddToCalendar
              id={event.id}
              title={event.title}
              date={event.date}
              time={event.time}
              venue={event.venue}
              address={event.address}
              description={event.description}
            />
          </div>

          {/* ── Belonging proof ── */}
          {(savedCount ?? 0) > 0 && (goingCount ?? 0) === 0 && (
            <p className="text-[11px] text-ink-light mb-5 italic">
              {savedCount} {savedCount === 1 ? 'person has' : 'people have'} saved this
            </p>
          )}

          {/* Who's going */}
          {(goingCount ?? 0) > 0 && (
            <div className="mb-6 bg-cream-raised rounded-xl border border-[#e8d9bf] px-4 py-3.5">
              <p className="text-xs font-bold text-ink-mid uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-terra" />
                {goingCount} {goingCount === 1 ? 'person' : 'people'} going
                {(savedCount ?? 0) > 0 && (
                  <span className="font-normal text-ink-light normal-case tracking-normal">
                    · {savedCount} saved
                  </span>
                )}
              </p>
              {attendees.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attendees.map((a, i) => {
                    const name = a.handle ?? a.display_name ?? 'Burqueño'
                    const initials = name.slice(0, 2).toUpperCase()
                    return (
                      <div key={i} className="flex items-center gap-1.5 bg-white rounded-full px-2.5 py-1 border border-[#eee0cc]">
                        {a.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-terra flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                            {initials}
                          </div>
                        )}
                        <span className="text-[11px] text-ink-mid font-medium">@{name}</span>
                      </div>
                    )
                  })}
                  {(goingCount ?? 0) > attendees.length && (
                    <div className="flex items-center px-2.5 py-1">
                      <span className="text-[11px] text-ink-light">
                        +{(goingCount ?? 0) - attendees.length} more
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Invite card */}
          <InviteCard
            eventId={event.id}
            eventTitle={event.title}
            eventDate={event.date}
            venue={event.venue}
          />

          {/* Community attribution */}
          {event.source === 'community' && (
            <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl bg-turq/8 border border-turq/20">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-turq/15 text-sm">
                👥
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-turq uppercase tracking-wider">Community event</p>
                <p className="text-[11px] text-ink-mid">
                  {event.submitterHandle
                    ? <>Submitted by <span className="font-semibold text-turq">@{event.submitterHandle}</span></>
                    : 'Submitted by a member of the ABQ Unplugged community'}
                </p>
              </div>
            </div>
          )}

          {/* Source + report */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-[10px] text-ink-light">
              Source: {SOURCE_LABELS[event.source] ?? (event.source.charAt(0).toUpperCase() + event.source.slice(1))}
            </p>
            <Link
              href={`/feedback?category=event_report&event_id=${event.id}`}
              className="inline-flex items-center gap-1.5 text-[11px] text-ink-light hover:text-terra transition-colors py-1"
            >
              <Flag className="w-3 h-3" />
              Report an issue
            </Link>
          </div>

          {/* ── Reviews ── */}
          <ReviewSection eventId={event.id} />

          {/* ── Instagram share — round-2 critique #5: one CTA, then a
              thin row of size shortcuts. Most users want "share this event"
              not "pick a Konva canvas aspect ratio". The default leads to
              the Feed-format (4:5) view; the small chips let power users
              jump straight to Story or Square. */}
          <div className="mt-8 pt-6 border-t border-[#eee0cc]">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <p className="text-[11px] font-semibold text-ink-light uppercase tracking-wide">Share to Instagram</p>
              <div className="flex gap-1 text-[11px]">
                {[
                  { href: `/events/${event.id}/ig3`, label: 'Story' },
                  { href: `/events/${event.id}/ig`,  label: 'Square' },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="px-2 py-1 rounded-md text-terra hover:bg-terra/10 transition-colors font-semibold"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href={`/events/${event.id}/ig2`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-terra text-white font-bold text-sm hover:bg-terra-hover transition-all active:scale-[0.98]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              <span className="text-base leading-none">📸</span>
              Share to Instagram
            </Link>
            <p className="text-[10px] text-ink-light mt-2">Opens a feed-ready 4:5 graphic. Use Story or Square above for other formats.</p>
          </div>

          <div className="h-8" />
        </div>
      </article>

      {/* ── Similar Events ── */}
      <SimilarEvents eventId={event.id} category={event.category} />

      {/* ── Sticky mobile ticket CTA ── appears when main CTA scrolls off */}
      {ticketHref && (
        <StickyTicketCTA href={ticketHref} label={ctaLabel} />
      )}
    </main>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

async function SimilarEvents({ eventId, category }: { eventId: string; category: string | null }) {
  if (!category) return null

  const { events } = await fetchEvents({
    timeFilter: 'upcoming',
    category,
    limit: 5,
  })

  const similar = events.filter((e) => e.id !== eventId).slice(0, 4)
  if (similar.length === 0) return null

  return (
    <AnimateIn animation="fade-up">
      <section className="max-w-3xl mx-auto px-4 pb-10">
        <div className="border-t border-[#eee0cc] pt-7">
          <h2
            className="text-lg font-black text-ink mb-5"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            More {category}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {similar.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="group">
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-sand-light mb-2 shadow-sm group-hover:shadow-md transition-shadow">
                  <EventImage
                    src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
                    fallback={getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
                    alt={event.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <h3
                  className="font-bold text-[11px] text-ink line-clamp-2 group-hover:text-terra transition-colors"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  {event.title}
                </h3>
                {event.venue && (
                  <p className="text-[10px] text-ink-light line-clamp-1 mt-0.5">{event.venue}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </AnimateIn>
  )
}

function getCtaLabel(source: string, price: string | null, ticketUrl: string | null, isFree: boolean): string {
  if (['nhcc', 'volunteer', 'local'].includes(source)) return 'More Info'
  if (price?.toLowerCase() === 'free' || isFree) return 'RSVP Free'
  const ticketPlatforms = ['ticketmaster.com', 'seatgeek.com', 'eventbrite.com', 'axs.com', 'stubhub.com', 'livenation.com']
  if (ticketUrl && ticketPlatforms.some((domain) => ticketUrl.includes(domain))) return 'Get Tickets'
  return 'Visit Event Site'
}

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
