import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEventById, fetchEvents, neighborhoodToSlug } from '@/lib/events'
import { buildBreadcrumbs } from '@/lib/seo'
import { venueToSlug } from '@/app/venues/[slug]/page'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { createClient } from '@/lib/supabase/server'
import { MapPin, Clock, Calendar, Ticket, ArrowLeft, ExternalLink, Users, Flag } from 'lucide-react'
import ShareButton from './ShareButton'
import AddToCalendar from './AddToCalendar'
import { AnimateIn } from '@/app/components/AnimateIn'
import { SaveEventButton } from '@/app/components/SaveEventButton'
import { ReviewSection } from '@/app/components/ReviewSection'
import { CheckInButton } from '@/app/components/CheckInButton'
import { InviteCard } from '@/app/components/InviteCard'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const event = await fetchEventById(id)
  if (!event) return { title: 'Event Not Found' }

  const dateStr = formatDateLong(event.date)
  const venueStr = event.venue ?? 'Albuquerque, NM'
  const description = (
    event.description
    ?? `${event.title} at ${venueStr} — ${dateStr}. Find tickets and event details on ABQ Unplugged.`
  ).slice(0, 160)

  const ogImage = event.imageUrl || getCategoryFallback(event.category ?? undefined, id)
  const canonicalUrl = `https://abqunplugged.com/events/${id}`

  return {
    title: `${event.title} — ${dateStr}`,
    description,
    openGraph: {
      title: `${event.title} — ${dateStr}`,
      description,
      url: canonicalUrl,
      type: 'website',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${event.title} at ${venueStr}`,
        },
      ],
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

  // Going count — how many users have state='going' for this event
  const { count: goingCount } = await supabase
    .from('user_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('state', 'going')

  // Saved count — how many users have saved this event (belonging proof, not scarcity)
  const { count: savedCount } = await supabase
    .from('user_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('state', 'saved')

  // Fetch public attendees for "Who's Going" section
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

  // Build ISO start date for JSON-LD
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(event.date)
    ? `${event.date}T12:00:00-06:00`
    : event.date

  const eventImage = event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)

  // Parse price for structured data
  const rawPrice = event.price
  let offerPrice: string | undefined
  let isFree = false
  if (rawPrice) {
    if (rawPrice.toLowerCase() === 'free' || rawPrice === '$0') {
      isFree = true
      offerPrice = '0'
    } else {
      // Extract first numeric value from strings like "$15–$40" or "From $12"
      const match = rawPrice.replace(/,/g, '').match(/[\d]+(?:\.\d+)?/)
      if (match) offerPrice = match[0]
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate,
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
      validFrom: new Date().toISOString().slice(0, 10),
      ...(offerPrice !== undefined
        ? { price: offerPrice, priceCurrency: 'USD' }
        : {}),
      ...(isFree ? { category: 'primary' } : {}),
    },
    organizer: {
      '@type': 'Organization',
      name: 'ABQ Unplugged',
      url: 'https://abqunplugged.com',
    },
    ...(event.source !== 'volunteer' && event.source !== 'nhcc' ? {
      performer: {
        '@type': 'PerformingGroup',
        name: event.title,
      }
    } : {}),
  }

  const breadcrumbLd = buildBreadcrumbs([
    { name: 'Home', url: 'https://abqunplugged.com' },
    { name: 'Events', url: 'https://abqunplugged.com/events' },
    ...(event.category ? [{ name: event.category, url: `https://abqunplugged.com/categories/${event.category.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-')}` }] : []),
    { name: event.title, url: `https://abqunplugged.com/events/${event.id}` },
  ])

  return (
    <main id="main" className="min-h-dvh bg-[--bg]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
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
        {/* Hero image — always shown (falls back to category illustration) */}
        <div className="relative aspect-[2/1] rounded-2xl overflow-hidden mb-6 shadow-lg">
          <EventImage
            src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
            fallback={getCategoryFallback(event.category ?? undefined, event.id)}
            alt={event.title}
            className="w-full h-full object-cover"
          />
            {/* Gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

            {/* Category badge */}
            {event.category && (
              <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
                {event.subcategory ? `${event.category} · ${event.subcategory}` : event.category}
              </div>
            )}
          </div>

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

          {/* Venue — links to venue page (when venue name is known) */}
          {event.venue && (
            <Link
              href={`/venues/${venueToSlug(event.venue)}`}
              className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#f0e4cc] shadow-sm hover:border-[#9a442d]/40 hover:shadow-md transition-all group"
            >
              <MapPin className="w-4 h-4 text-[#006a62] group-hover:text-[#9a442d] transition-colors flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#1a1614] group-hover:text-[#9a442d] transition-colors">{event.venue}</p>
                {event.address && <p className="text-[11px] text-[#8a7a74]">{event.address}</p>}
              </div>
            </Link>
          )}

          {/* Google Maps link — shown whenever we have any location info (venue OR address) */}
          {(event.venue || event.address) && (
            <div className="flex flex-col gap-1">
              {!event.venue && event.address && (
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#f0e4cc] shadow-sm">
                  <MapPin className="w-4 h-4 text-[#006a62] flex-shrink-0" />
                  <p className="text-xs font-semibold text-[#1a1614]">{event.address}</p>
                </div>
              )}
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent([event.venue, event.address, event.city ?? 'Albuquerque NM'].filter(Boolean).join(', '))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-[10px] text-[#006a62] hover:text-[#9a442d] transition-colors font-medium flex items-center gap-1"
              >
                <MapPin className="w-2.5 h-2.5" />
                Open in Google Maps
              </a>
            </div>
          )}

          {/* Price */}
          {event.price && (
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#f0e4cc] shadow-sm">
              <Ticket className="w-4 h-4 text-[#4f6249]" />
              <p className="text-xs font-semibold text-[#1a1614]">{event.price}</p>
            </div>
          )}

          {/* Neighborhood pill — links to neighborhood landing page */}
          {event.neighborhood && (
            <Link
              href={`/neighborhoods/${neighborhoodToSlug(event.neighborhood)}`}
              className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-[#f0e4cc] shadow-sm hover:border-[#006a62]/40 hover:shadow-md transition-all group"
            >
              <MapPin className="w-4 h-4 text-[#006a62] group-hover:text-[#9a442d] transition-colors flex-shrink-0" />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[#8a7a74] font-semibold leading-none mb-0.5">Neighborhood</p>
                <p className="text-xs font-semibold text-[#1a1614] group-hover:text-[#006a62] transition-colors">{event.neighborhood}</p>
              </div>
            </Link>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="prose prose-sm max-w-none mb-6">
            <p className="text-sm text-[#4a3f3a] leading-relaxed">{event.description}</p>
          </div>
        )}

        {/* AI Enrichment — about, highlights, venue & local tips */}
        {(event.about || event.highlights.length > 0 || event.venueTips || event.localTips) && (
          <div className="space-y-4 mb-6">
            {event.about && (
              <div className="bg-white rounded-xl px-4 py-3 border border-[#f0e4cc] shadow-sm">
                <p className="text-xs font-bold text-[#9a442d] uppercase tracking-wider mb-1">About</p>
                <p className="text-sm text-[#4a3f3a] leading-relaxed">{event.about}</p>
              </div>
            )}
            {event.highlights.length > 0 && (
              <div className="bg-white rounded-xl px-4 py-3 border border-[#f0e4cc] shadow-sm">
                <p className="text-xs font-bold text-[#9a442d] uppercase tracking-wider mb-2">What to Expect</p>
                <ul className="space-y-1">
                  {event.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#4a3f3a]">
                      <span className="text-[#9a442d] mt-0.5">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(event.venueTips || event.localTips) && (
              <div className="bg-[#f7f2ec] rounded-xl px-4 py-3 border border-[#e8d9bf] shadow-sm space-y-2">
                {event.venueTips && (
                  <div>
                    <p className="text-xs font-bold text-[#4f6249] uppercase tracking-wider mb-1">Venue Tips</p>
                    <p className="text-sm text-[#4a3f3a] leading-relaxed">{event.venueTips}</p>
                  </div>
                )}
                {event.localTips && (
                  <div>
                    <p className="text-xs font-bold text-[#006a62] uppercase tracking-wider mb-1">Local Tips</p>
                    <p className="text-sm text-[#4a3f3a] leading-relaxed">{event.localTips}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3 mb-4">
          {event.ticketUrl && (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all duration-300 hover:shadow-lg hover:shadow-[#9a442d]/20 hover:scale-[1.02]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {getCtaLabel(event.source, event.price, event.ticketUrl, isFree)}
              <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}
          <ShareButton title={event.title} />
        </div>

        {/* Instagram share strip */}
        <div className="mb-4 rounded-xl border border-[#f0e4cc] bg-[#fdf9f4] px-4 py-3">
          <p className="text-[11px] font-semibold text-[#8a7a74] uppercase tracking-wide mb-2.5">
            📸 Share to Instagram
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: `/events/${event.id}/ig`,  label: '1:1 Square',    desc: 'Feed' },
              { href: `/events/${event.id}/ig2`, label: '4:5 Portrait',  desc: 'Feed' },
              { href: `/events/${event.id}/ig3`, label: '9:16 Story',    desc: 'Story / Reel' },
            ].map(({ href, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex flex-col items-center px-4 py-2 rounded-lg border border-[#e8d9bf] bg-white text-center hover:border-[#9a442d] hover:shadow-sm transition-all"
              >
                <span className="text-xs font-semibold text-[#1a1614]">{label}</span>
                <span className="text-[10px] text-[#8a7a74]">{desc}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Add to calendar */}
        <div className="mb-4">
          <AddToCalendar
            id={event.id}
            title={event.title}
            date={event.date}
            venue={event.venue}
            address={event.address}
            description={event.description}
          />
        </div>

        {/* Social row — save/going/check-in buttons */}
        <div className="flex flex-wrap items-center gap-3 mb-6 pb-6 border-b border-[#f0e4cc]">
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
          <CheckInButton
            eventId={event.id}
            eventName={event.title}
            eventDate={event.date}
            venueName={event.venue ?? null}
            venueAddress={event.address ?? null}
          />
        </div>

        {/* Belonging proof — "N saved this" as a soft inline signal (never scarcity) */}
        {(savedCount ?? 0) > 0 && (goingCount ?? 0) === 0 && (
          <p className="text-[11px] text-[#8a7a74] mb-4 italic">
            {savedCount} {savedCount === 1 ? 'person has' : 'people have'} saved this
          </p>
        )}

        {(goingCount ?? 0) > 0 && (
          <div className="mb-6 bg-white rounded-xl border border-[#f0e4cc] px-4 py-3 shadow-sm">
            <p className="text-xs font-bold text-[#8a7a74] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {goingCount} {goingCount === 1 ? 'person' : 'people'} going
              {(savedCount ?? 0) > 0 && (
                <span className="font-normal text-[#8a7a74]/70 normal-case tracking-normal">
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
                    <div key={i} className="flex items-center gap-1.5 bg-[#f7f2ec] rounded-full px-2.5 py-1">
                      {a.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#9a442d] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                          {initials}
                        </div>
                      )}
                      <span className="text-[11px] text-[#4a3f3a] font-medium">@{name}</span>
                    </div>
                  )
                })}
                {(goingCount ?? 0) > attendees.length && (
                  <div className="flex items-center px-2.5 py-1">
                    <span className="text-[11px] text-[#8a7a74]">+{(goingCount ?? 0) - attendees.length} more</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* "Who would love this?" — plan-making friction reduction (implementation intentions) */}
        <InviteCard
          eventId={event.id}
          eventTitle={event.title}
          eventDate={event.date}
          venue={event.venue}
        />

        {/* Community attribution */}
        {event.source === 'community' && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-[#006a62]/8 border border-[#006a62]/25">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#006a62]/15 text-[#006a62] font-bold text-xs">
              👥
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#006a62] uppercase tracking-wider">Community event</p>
              <p className="text-[11px] text-[#4a3f3a]">
                {event.submitterHandle
                  ? <>Submitted by <span className="font-semibold text-[#006a62]">@{event.submitterHandle}</span></>
                  : 'Submitted by a member of the ABQ Unplugged community'}
              </p>
            </div>
          </div>
        )}

        {/* Source + report */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-[#8a7a74]">
            Source: {event.source === 'community' ? 'Community submission' : event.source.charAt(0).toUpperCase() + event.source.slice(1)}
          </p>
          <Link
            href={`/feedback?category=event_report&event_id=${event.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#8a7a74] hover:text-[#9a442d] transition-colors py-1"
          >
            <Flag className="w-3 h-3" />
            Report an issue
          </Link>
        </div>

        {/* Reviews */}
        <ReviewSection eventId={event.id} />
      </article>

      {/* ── Similar Events ── */}
      <SimilarEvents eventId={event.id} category={event.category} />
    </main>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function SimilarEvents({ eventId, category }: { eventId: string; category: string | null }) {
  if (!category) return null

  const { events } = await fetchEvents({
    timeFilter: 'upcoming',
    category,
    limit: 5,
  })

  // Filter out the current event
  const similar = events.filter((e) => e.id !== eventId).slice(0, 4)
  if (similar.length === 0) return null

  return (
    <AnimateIn animation="fade-up">
    <section className="max-w-3xl mx-auto px-4 pb-8">
      <div className="border-t border-[#f0e4cc] pt-6">
        <h2
          className="text-lg font-black text-[#1a1614] mb-4"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          More {category}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {similar.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group"
            >
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3] mb-1.5 shadow-sm group-hover:shadow-md transition-shadow">
                <EventImage
                  src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
                  fallback={getCategoryFallback(event.category ?? undefined, event.id)}
                  alt={event.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <h3
                className="font-bold text-[11px] text-[#1a1614] line-clamp-2 group-hover:text-[#9a442d] transition-colors"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                {event.title}
              </h3>
              {event.venue && (
                <p className="text-[10px] text-[#8a7a74] line-clamp-1">{event.venue}</p>
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
