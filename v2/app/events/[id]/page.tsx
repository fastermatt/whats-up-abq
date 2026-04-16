import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEventById, fetchEvents } from '@/lib/events'
import { venueToSlug } from '@/app/venues/[slug]/page'
import { getCategoryFallback } from '@/lib/fallback-images'
import { createClient } from '@/lib/supabase/server'
import { MapPin, Clock, Calendar, Ticket, ArrowLeft, ExternalLink, Users } from 'lucide-react'
import ShareButton from './ShareButton'
import { AnimateIn } from '@/app/components/AnimateIn'
import { ReportForm } from '@/app/components/ReportForm'
import { SaveEventButton } from '@/app/components/SaveEventButton'
import { ReviewSection } from '@/app/components/ReviewSection'
import { CheckInButton } from '@/app/components/CheckInButton'

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
    title: `${event.title} — ${dateStr} | ABQ Unplugged`,
    description,
    openGraph: {
      title: `${event.title} — ${dateStr}`,
      description,
      url: canonicalUrl,
      type: 'article',
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
  }

  return (
    <main className="min-h-dvh bg-[--bg]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
            alt=""
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

          {/* Venue — links to venue page + Google Maps link */}
          {event.venue && (
            <div className="flex flex-col gap-1">
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
              {/* Free map link — opens Google Maps search, no API key needed */}
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
              Get Tickets
              <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          )}
          <ShareButton title={event.title} />
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
          />
          {(goingCount ?? 0) > 0 && (
            <p className="text-xs text-[#8a7a74] flex items-center gap-1 ml-auto">
              <Users className="w-3.5 h-3.5" />
              {goingCount} going
            </p>
          )}
        </div>

        {/* Source + report */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-[#8a7a74]">
            Source: {event.source.charAt(0).toUpperCase() + event.source.slice(1)}
          </p>
          <ReportForm eventId={event.id} eventTitle={event.title} />
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
                  alt=""
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
