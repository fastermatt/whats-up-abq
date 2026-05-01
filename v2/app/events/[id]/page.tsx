import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEventById, fetchEvents, neighborhoodToSlug } from '@/lib/events'
import { buildBreadcrumbs } from '@/lib/seo'
import { venueToSlug } from '@/app/venues/[slug]/page'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { createClient } from '@/lib/supabase/server'
import {
  MapPin, Clock, Calendar, Ticket, ArrowLeft, ExternalLink,
  Users, Flag, Share2, ChevronDown,
} from 'lucide-react'
import ShareButton from './ShareButton'
import AddToCalendar from './AddToCalendar'
import { AnimateIn } from '@/app/components/AnimateIn'
import { SaveEventButton } from '@/app/components/SaveEventButton'
import { ReviewSection } from '@/app/components/ReviewSection'
import { CheckInButton } from '@/app/components/CheckInButton'
import { InviteCard } from '@/app/components/InviteCard'
import { affiliateUrl } from '@/lib/affiliate'
import { StickyTicketCTA } from './StickyTicketCTA'

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

  return {
    title: seoTitle,
    description,
    openGraph: {
      title: seoTitle,
      description,
      url: canonicalUrl,
      type: 'website',
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
      const time = event.time && /^\d{1,2}:\d{2}/.test(event.time) ? event.time.padStart(5, '0') : '12:00'
      return `${event.date}T${time}:00-06:00`
    }
    return event.date
  })()

  const endDate = (() => {
    const start = new Date(startDate)
    if (isNaN(start.getTime())) return undefined
    start.setHours(start.getHours() + 3)
    return start.toISOString()
  })()

  const eventImage = event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)

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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
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
      validFrom: new Date().toISOString().slice(0, 10),
      ...(offerPrice !== undefined ? { price: offerPrice, priceCurrency: 'USD' } : {}),
      ...(isFree ? { category: 'primary' } : {}),
    },
    organizer: {
      '@type': 'Organization',
      name: 'ABQ Unplugged',
      url: 'https://abqunplugged.com',
    },
    ...(event.source !== 'volunteer' && event.source !== 'nhcc' ? {
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

      {/* ── Sticky nav ── */}
      <header className="sticky top-0 z-20 bg-[#fbf7f1]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
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

      <article className="max-w-3xl mx-auto animate-fade-up">
        {/* ── Hero image ── full-bleed on mobile, padded + rounded on desktop */}
        <div className="relative aspect-[16/9] sm:aspect-[2/1] sm:mx-4 sm:mt-4 sm:rounded-2xl overflow-hidden shadow-md">
          <EventImage
            src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
            fallback={getCategoryFallback(event.category ?? undefined, event.id)}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        </div>

        {/* ── Content ── */}
        <div className="px-4 pt-6">

          {/* Category label */}
          {event.category && (
            <p className="text-[11px] uppercase tracking-[0.15em] text-[#9a442d] font-bold mb-2">
              {event.subcategory ? `${event.category} · ${event.subcategory}` : event.category}
            </p>
          )}

          {/* Title — dominant */}
          <h1
            className="text-3xl sm:text-4xl font-black text-[#1a1614] leading-[1.1] mb-5"
            style={{ fontFamily: 'var(--font-epilogue)', letterSpacing: '-0.5px' }}
          >
            {event.title}
          </h1>

          {/* ── Meta info — clean icon list ── */}
          <div className="space-y-3 mb-7 text-sm">

            {/* Date + time */}
            {dateStr && (
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-[#9a442d] mt-0.5 flex-shrink-0" />
                <div className="leading-snug">
                  <span className="font-semibold text-[#1a1614]">{dateStr}</span>
                  {timeStr && (
                    <span className="text-[#4a3f3a]"> · {timeStr}</span>
                  )}
                  {!timeStr && timesVary && (
                    <span className="text-[#4f6249] font-medium"> · Times vary — see host site</span>
                  )}
                  {!timeStr && !timesVary && (
                    <span className="text-[#6b5d57] italic"> · Time TBA</span>
                  )}
                </div>
              </div>
            )}

            {/* Venue + address + neighborhood + maps link */}
            {event.venue && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#006a62] mt-0.5 flex-shrink-0" />
                <div className="leading-snug space-y-0.5">
                  <Link
                    href={`/venues/${venueToSlug(event.venue)}`}
                    className="font-semibold text-[#1a1614] hover:text-[#9a442d] transition-colors"
                  >
                    {event.venue}
                  </Link>
                  {event.address && (
                    <p className="text-xs text-[#4a3f3a]">{event.address}</p>
                  )}
                  {event.neighborhood && (
                    <Link
                      href={`/neighborhoods/${neighborhoodToSlug(event.neighborhood)}`}
                      className="block text-xs text-[#006a62] hover:text-[#9a442d] transition-colors"
                    >
                      {event.neighborhood}
                    </Link>
                  )}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#006a62] hover:text-[#9a442d] transition-colors mt-0.5"
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    Open in Maps
                  </a>
                </div>
              </div>
            )}

            {/* Address-only (no venue name) */}
            {!event.venue && event.address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#006a62] mt-0.5 flex-shrink-0" />
                <div className="leading-snug space-y-0.5">
                  <p className="font-semibold text-[#1a1614]">{event.address}</p>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#006a62] hover:text-[#9a442d] transition-colors"
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    Open in Maps
                  </a>
                </div>
              </div>
            )}

            {/* Price */}
            <div className="flex items-start gap-3">
              <Ticket className="w-4 h-4 text-[#4f6249] mt-0.5 flex-shrink-0" />
              <div className="leading-snug">
                {event.price ? (
                  <span className="font-semibold text-[#1a1614]">
                    {event.price}
                    {isFree && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-[#4f6249] bg-[#4f6249]/10 px-1.5 py-0.5 rounded-full align-middle">
                        Free
                      </span>
                    )}
                  </span>
                ) : event.ticketUrl ? (
                  <span className="text-[#4a3f3a]">
                    Price on{' '}
                    <a
                      href={event.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#9a442d] underline-offset-2 hover:underline"
                    >
                      ticket page
                    </a>
                  </span>
                ) : (
                  <span className="text-[#6b5d57]">Price not listed</span>
                )}
              </div>
            </div>

          </div>

          {/* ── Primary CTA — anchor for sticky bar IntersectionObserver ── */}
          <div id="main-cta" className="flex flex-wrap gap-3 mb-8">
            {ticketHref && (
              <a
                href={ticketHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#9a442d] text-white font-bold text-[15px] hover:bg-[#7d3725] transition-all duration-200 hover:shadow-lg hover:shadow-[#9a442d]/25 hover:scale-[1.01] active:scale-[0.99]"
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
              <p className="text-[15px] text-[#4a3f3a] leading-relaxed">{event.description}</p>
            </div>
          )}

          {/* ── AI Enrichment ── */}
          {(event.about || event.highlights.length > 0 || event.venueTips || event.localTips) && (
            <div className="space-y-3 mb-7">
              {event.about && (
                <div className="rounded-xl px-4 py-3.5 border border-[#e8d9bf] bg-[#fdf9f4]">
                  <p className="text-[11px] font-bold text-[#9a442d] uppercase tracking-wider mb-1.5">About</p>
                  <p className="text-sm text-[#4a3f3a] leading-relaxed">{event.about}</p>
                </div>
              )}
              {event.highlights.length > 0 && (
                <div className="rounded-xl px-4 py-3.5 border border-[#e8d9bf] bg-[#fdf9f4]">
                  <p className="text-[11px] font-bold text-[#9a442d] uppercase tracking-wider mb-2">What to Expect</p>
                  <ul className="space-y-1.5">
                    {event.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#4a3f3a]">
                        <span className="text-[#9a442d] font-bold mt-0.5 leading-none">·</span>
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
                      <p className="text-[11px] font-bold text-[#4f6249] uppercase tracking-wider mb-1">Venue Tips</p>
                      <p className="text-sm text-[#4a3f3a] leading-relaxed">{event.venueTips}</p>
                    </div>
                  )}
                  {event.localTips && (
                    <div>
                      <p className="text-[11px] font-bold text-[#006a62] uppercase tracking-wider mb-1">Local Tips</p>
                      <p className="text-sm text-[#4a3f3a] leading-relaxed">{event.localTips}</p>
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
              venue={event.venue}
              address={event.address}
              description={event.description}
            />
          </div>

          {/* ── Belonging proof ── */}
          {(savedCount ?? 0) > 0 && (goingCount ?? 0) === 0 && (
            <p className="text-[11px] text-[#6b5d57] mb-5 italic">
              {savedCount} {savedCount === 1 ? 'person has' : 'people have'} saved this
            </p>
          )}

          {/* Who's going */}
          {(goingCount ?? 0) > 0 && (
            <div className="mb-6 bg-[#fdf9f4] rounded-xl border border-[#e8d9bf] px-4 py-3.5">
              <p className="text-xs font-bold text-[#4a3f3a] uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-[#9a442d]" />
                {goingCount} {goingCount === 1 ? 'person' : 'people'} going
                {(savedCount ?? 0) > 0 && (
                  <span className="font-normal text-[#8a7a74] normal-case tracking-normal">
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
                      <span className="text-[11px] text-[#6b5d57]">
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
            <div className="mb-5 flex items-center gap-2.5 p-3.5 rounded-xl bg-[#006a62]/8 border border-[#006a62]/20">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#006a62]/15 text-sm">
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
          <div className="flex items-center justify-between mb-6">
            <p className="text-[10px] text-[#8a7a74]">
              Source: {event.source === 'community'
                ? 'Community submission'
                : event.source.charAt(0).toUpperCase() + event.source.slice(1)}
            </p>
            <Link
              href={`/feedback?category=event_report&event_id=${event.id}`}
              className="inline-flex items-center gap-1.5 text-[11px] text-[#8a7a74] hover:text-[#9a442d] transition-colors py-1"
            >
              <Flag className="w-3 h-3" />
              Report an issue
            </Link>
          </div>

          {/* ── Reviews ── */}
          <ReviewSection eventId={event.id} />

          {/* ── Instagram share graphics — collapsible, for power users ── */}
          <details className="group mt-8 pt-6 border-t border-[#eee0cc]">
            <summary className="flex items-center gap-2 text-[11px] font-semibold text-[#6b5d57] uppercase tracking-wide cursor-pointer select-none hover:text-[#4a3f3a] transition-colors list-none">
              <span className="text-base leading-none">📸</span>
              Create share graphic
              <ChevronDown className="w-3.5 h-3.5 ml-auto transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { href: `/events/${event.id}/ig`,  label: '1:1 Square',   desc: 'Feed' },
                { href: `/events/${event.id}/ig2`, label: '4:5 Portrait', desc: 'Feed' },
                { href: `/events/${event.id}/ig3`, label: '9:16 Story',   desc: 'Story / Reel' },
              ].map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex flex-col items-center px-4 py-2 rounded-lg border border-[#e8d9bf] bg-[#fdf9f4] text-center hover:border-[#9a442d]/50 hover:shadow-sm transition-all"
                >
                  <span className="text-xs font-semibold text-[#1a1614]">{label}</span>
                  <span className="text-[10px] text-[#6b5d57]">{desc}</span>
                </Link>
              ))}
              <a
                href={`/ig-editor.html?url=/events/${event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-col items-center px-4 py-2 rounded-lg border border-[#9a442d]/30 bg-[#9a442d]/5 text-center hover:border-[#9a442d] hover:bg-[#9a442d]/10 transition-all"
              >
                <span className="text-xs font-semibold text-[#9a442d]">✦ IG Editor</span>
                <span className="text-[10px] text-[#6b5d57]">6 templates</span>
              </a>
            </div>
          </details>

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
            className="text-lg font-black text-[#1a1614] mb-5"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            More {category}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {similar.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="group">
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-[#f0e4cc] mb-2 shadow-sm group-hover:shadow-md transition-shadow">
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
                  <p className="text-[10px] text-[#6b5d57] line-clamp-1 mt-0.5">{event.venue}</p>
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
