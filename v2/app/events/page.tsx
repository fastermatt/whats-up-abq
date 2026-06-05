import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents, fetchCategoryCounts, fetchEventCountsByDate, NormalizedEvent, CATEGORY_SLUG_MAP, venueToSlug } from '@/lib/events'
import { OG_IMAGE } from '@/lib/fallback-images'
import { TimeFilter } from '@/lib/utils/dates'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { FilterBar } from './FilterBar'
import { SearchBar } from './SearchBar'
import { CalendarPicker } from './CalendarPicker'
import { CalendarToggle } from './CalendarToggle'
import { MapPin, Clock } from 'lucide-react'
import { QuickSaveButton } from '@/app/components/QuickSaveButton'
import { createClient } from '@/lib/supabase/server'
import type { UserPreferences } from '@/app/components/PreferencesPicker'
import { buildBreadcrumbs } from '@/lib/seo'

// Note: reading cookies for user preferences makes this route dynamic for
// logged-in users. The revalidate hint is still used as a fallback for
// unauthenticated requests.
export const revalidate = 60

// Maps preference label → canonical DB category
const PREF_TO_DB_CAT: Record<string, string> = {
  'music':           'Music',
  'comedy':          'Comedy',
  'food & drink':    'Food & Drink',
  'arts & theater':  'Arts & Theater',
  'outdoors & sports': 'Outdoor',
  'family / kids':   'Family',
  'film':            'Film',
  'nightlife':       'Community',
  'volunteering':    'Community',
}

const FAMILY_RE = /\bkids?\b|\bchildren\b|\bfamily\b|\bstory.?time\b|\bplaydate\b/i

interface PageProps {
  searchParams: Promise<{ time?: string; category?: string; mood?: string; neighborhood?: string; page?: string; q?: string; free?: string; price?: string; date?: string; cal?: string }>
}

const CATEGORY_TITLES: Record<string, string> = {
  Music:      'Music Events',
  Comedy:     'Comedy Shows',
  Sports:     'Sports Events',
  Arts:       'Arts & Culture Events',
  Food:       'Food & Drink Events',
  Family:     'Family Events',
  Nightlife:  'Nightlife Events',
  Community:  'Community Events',
  Film:       'Film & Cinema Events',
}

const TIME_TITLE_MAP: Record<string, string> = {
  tonight:        'Tonight',
  tomorrow:       'Tomorrow',
  'this-weekend': 'This Weekend',
  'this-week':    'This Week',
  upcoming:       'Upcoming',
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  // Normalize slug-form category params to canonical DB names before building title/description
  const rawCategory = params.category
  const category = rawCategory ? (CATEGORY_SLUG_MAP[rawCategory.toLowerCase()] ?? rawCategory) : undefined
  const time = params.time
  const q = params.q?.trim()

  const categoryLabel = category ? (CATEGORY_TITLES[category] ?? `${category} Events`) : null
  const timeLabel = time ? TIME_TITLE_MAP[time] : null

  let title: string
  let description: string

  if (q) {
    title = `"${q}" Events in Albuquerque, NM`
    description = `Search results for "${q}" — find upcoming events in Albuquerque, NM on ABQ Unplugged.`
  } else if (categoryLabel && timeLabel) {
    title = `${timeLabel} ${categoryLabel} in Albuquerque, NM`
    description = `${timeLabel} ${categoryLabel.toLowerCase()} in Albuquerque, NM. Find tickets and event details on ABQ Unplugged.`
  } else if (categoryLabel) {
    title = `${categoryLabel} in Albuquerque, NM`
    description = `Upcoming ${categoryLabel.toLowerCase()} in Albuquerque, NM. Concerts, shows, and more — find tickets on ABQ Unplugged.`
  } else if (timeLabel) {
    title = `${timeLabel}'s Events in Albuquerque, NM`
    description = `${timeLabel}'s events in Albuquerque, NM — concerts, comedy, sports, arts, food & drink. Find tickets on ABQ Unplugged.`
  } else {
    title = 'Events in Albuquerque, NM — Things to Do in ABQ'
    description =
      'Browse all upcoming events in Albuquerque, NM — concerts, comedy shows, sports, arts, food festivals, and more. Find tickets from Ticketmaster, Eventbrite, SeatGeek and more, all in one place.'
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: 'https://abqunplugged.com/events',
      images: [
        {
          url: OG_IMAGE,
          width: 1200,
          height: 630,
          alt: 'Events in Albuquerque, NM — ABQ Unplugged',
        },
      ],
    },
    alternates: {
      canonical: `https://abqunplugged.com/events${
        category ? `?category=${encodeURIComponent(category)}` : ''
      }`,
    },
  }
}

export default async function EventsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const timeFilter = (params.time as TimeFilter) || 'upcoming'
  // Normalize slug-form category params (food-drink → Food & Drink, arts → Arts & Theater)
  const rawCat = params.category || null
  const category = rawCat ? (CATEGORY_SLUG_MAP[rawCat.toLowerCase()] ?? rawCat) : null
  const categoryLabel = category ? (CATEGORY_TITLES[category] ?? `${category} Events`) : null
  const mood = params.mood || undefined
  const neighborhood = params.neighborhood || undefined
  const search = params.q?.trim() || undefined
  const selectedDate = params.date || null  // YYYY-MM-DD from calendar
  const showCal = params.cal === '1' || !!selectedDate
  // Support both legacy `free=1` and new `price=free|25|50`
  const priceParam = params.price || (params.free === '1' ? 'free' : undefined)
  const freeOnly = priceParam === 'free'
  const maxPrice = priceParam && priceParam !== 'free' ? parseInt(priceParam, 10) : undefined
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const limit = 36
  const offset = (page - 1) * limit

  // Calendar counts: fetch ~3 months around today so navigation works client-side
  const today = new Date()
  const calStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString().slice(0, 10)
  const calEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0)
    .toISOString().slice(0, 10)

  // Fetch user taste preferences (best-effort — does not block if auth fails)
  let tastePrefs: UserPreferences = {}
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('preferences').eq('id', user.id).single()
      tastePrefs = (profile?.preferences ?? {}) as UserPreferences
    }
  } catch {
    // Preference lookup is strictly best-effort — gracefully degrade to default order
  }

  const [{ events: rawEvents, total }, categoryCounts, calendarCounts] = await Promise.all([
    fetchEvents({ timeFilter, category, mood, neighborhood, search, freeOnly, maxPrice, date: selectedDate ?? undefined, limit, offset }),
    fetchCategoryCounts(),
    showCal ? fetchEventCountsByDate(calStart, calEnd) : Promise.resolve([]),
  ])

  // ── Preference-aware filter + soft sort ─────────────────────────────────────
  // Only applies when the user has set at least one taste preference.
  // Note: this post-processes a single page of results, so pagination counts may
  // be slightly off for logged-in users — acceptable trade-off for now.
  let events: NormalizedEvent[] = rawEvents
  const hasPrefs = !!(tastePrefs.who || tastePrefs.categories?.length)
  if (hasPrefs) {
    const isNonFamily = tastePrefs.who === 'solo' || tastePrefs.who === 'couple'

    // Hard filter: hide family / kids events for solo & couple users
    if (isNonFamily) {
      events = events.filter(e =>
        e.category !== 'Family' && !FAMILY_RE.test(e.title)
      )
    }

    // Soft sort: events in preferred categories bubble to the top
    if (tastePrefs.categories?.length) {
      const preferredCats = new Set(
        tastePrefs.categories
          .map(p => PREF_TO_DB_CAT[p.toLowerCase()])
          .filter((c): c is string => Boolean(c))
      )
      events = [...events].sort((a, b) => {
        const aScore = preferredCats.has(a.category ?? '') ? 1 : 0
        const bScore = preferredCats.has(b.category ?? '') ? 1 : 0
        return bScore - aScore // preferred first; stable sort preserves date order within each tier
      })
    }
  }

  const totalPages = Math.ceil(total / limit)

  // Title: date filter overrides time label
  let timeLabel: string
  if (selectedDate) {
    const d = new Date(selectedDate + 'T12:00:00')
    timeLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  } else {
    timeLabel = TIME_LABELS[timeFilter] ?? 'Events'
  }

  // Only emit rich schema on the unfiltered default view (no search/category/mood params)
  const isDefaultView = !category && !mood && !neighborhood && !search && page === 1 && !selectedDate
  const breadcrumbsLd = buildBreadcrumbs([
    { name: 'Home', url: 'https://abqunplugged.com' },
    { name: 'Events', url: 'https://abqunplugged.com/events' },
  ])
  const collectionLd = isDefaultView ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Events in Albuquerque, NM',
    description: 'Browse all upcoming events in Albuquerque, NM — concerts, comedy, sports, arts, food festivals, and more.',
    url: 'https://abqunplugged.com/events',
    hasPart: events.slice(0, 20).map(e => ({
      '@type': 'Event',
      name: e.title,
      url: `https://abqunplugged.com/events/${e.id}`,
      startDate: e.date,
      ...(e.venue ? { location: { '@type': 'Place', name: e.venue } } : {}),
    })),
  } : null

  return (
    <main id="main" className="min-h-dvh bg-[--bg]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsLd) }} />
      {collectionLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      )}
      <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* ── Title row + Calendar toggle ── */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1
              className="text-2xl font-black text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {category && categoryLabel ? `${categoryLabel} in Albuquerque` : timeLabel}
            </h1>
            <p className="text-[#6b5d57] text-xs mt-0.5">Albuquerque, NM</p>
          </div>
          {/* Calendar toggle button — client component so it can read/set URL param */}
          <Suspense>
            <CalendarToggle isOpen={showCal} />
          </Suspense>
        </div>

        {/* ── Calendar (shown when cal=1 or date is set) ── */}
        {showCal && (
          <Suspense>
            <CalendarPicker counts={calendarCounts} selectedDate={selectedDate} />
          </Suspense>
        )}

        {/* ── Search ── */}
        <Suspense>
          <SearchBar />
        </Suspense>

        {/* ── Filters ── */}
        <Suspense>
          <FilterBar
            currentTime={params.time ?? ''}
            currentCategory={params.category ?? ''}
            currentNeighborhood={neighborhood ?? ''}
            priceFilter={priceParam}
            categoryCounts={categoryCounts}
          />
        </Suspense>

        {/* ── Grid ── */}
        {events.length === 0 ? (
          <EmptyState timeLabel={timeLabel} />
        ) : (
          <>
            <p className="text-xs text-[#6b5d57] tabular-nums">
              {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {events.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </>
        )}

        {/* ── Submit CTA ── round-2 critique #12: integrated into the
            cream/terra system instead of a full-bleed gradient that read
            as an ad. Cream bg + terra accent + dashed terra border keeps
            the "you can contribute" energy without the banner-ad feel. */}
        <div className="mt-2 rounded-2xl border border-dashed border-[#9a442d]/35 bg-[#fdf9f4] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#9a442d] font-semibold mb-0.5">
              Know something we don&apos;t?
            </p>
            <p className="text-base font-black text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Submit your event
            </p>
            <p className="text-xs text-[#6b5d57] mt-0.5">
              Community events reviewed within 24 hours · free to list
            </p>
          </div>
          <Link
            href="/submit"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9a442d] text-white text-sm font-bold hover:bg-[#7d3725] transition-colors"
          >
            Add your event →
          </Link>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            time={params.time}
            category={params.category}
            q={params.q}
            price={priceParam}
          />
        )}
      </div>
    </main>
  )
}

// ─── Compact Event Card — Landscape Rectangle ────────────────────────────────

function EventCard({ event, index }: { event: NormalizedEvent; index: number }) {
  const dateStr = formatDate(event.date)
  const timeStr = event.time ?? ''

  return (
    // Outer wrapper holds spring animation + group hover. QuickSaveButton sits
    // outside the <Link> so we avoid nested-interactive-element issues.
    <div
      className="group relative spring-card rounded-xl overflow-hidden border border-[#f0e4cc]/80 bg-white shadow-[0_1px_3px_rgba(26,22,20,0.04)] hover:shadow-[0_8px_24px_rgba(26,22,20,0.12)] transition-all duration-300 hover:-translate-y-1"
      style={{ '--card-i': Math.min(index, 14) } as React.CSSProperties}
    >
      <Link href={`/events/${event.id}`} className="flex flex-col h-full">
        {/* Landscape image — 16:10 ratio */}
        <div className="relative aspect-[16/10] bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3] overflow-hidden">
          <EventImage
            src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
            fallback={getCategoryFallback(event.category ?? undefined, event.id)}
            alt={event.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />

          {/* Category badge — top right */}
          {event.category && (
            <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {event.subcategory ? `${event.category} · ${event.subcategory}` : event.category}
            </div>
          )}

          {/* Local venue — warm amber tint + bottom gradient so the badge reads clearly */}
          {event.source === 'local-venue' && (
            <>
              {/* Always-visible warm tint: signals "intimate local show", not a ticketed big venue */}
              <div className="absolute inset-0 bg-[#9a442d]/20 mix-blend-multiply pointer-events-none" />
              {/* Bottom gradient for badge legibility */}
              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#6b2e1a]/70 to-transparent pointer-events-none" />
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 text-white text-[10px] font-semibold">
                🎸 <span>Local Live</span>
              </div>
            </>
          )}

          {/* Community badge — bottom left */}
          {event.source === 'community' && (
            <div className="absolute bottom-1.5 left-1.5 bg-[#006a62]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              👥 Community
            </div>
          )}

          {/* Price badge — bottom right */}
          {event.price && (
            <div className="absolute bottom-1.5 right-1.5 bg-[#006a62]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              {event.price}
            </div>
          )}

          {/* Hover overlay (non-local-venue cards only — local-venue has its own permanent tint) */}
          {event.source !== 'local-venue' && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          )}
        </div>

        {/* Info section — title + date only (venue is rendered as separate link below) */}
        <div className="px-2 pt-2 pb-0.5 space-y-0.5 flex-1 flex flex-col">
          <h3
            className="font-bold text-[#1a1614] text-xs leading-tight line-clamp-2 group-hover:text-[#9a442d] transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {event.title}
          </h3>

          {(dateStr || timeStr) && (
            <p className="text-[10px] text-[#9a442d] font-medium flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 flex-shrink-0" />
              <span>{timeStr ? `${dateStr} · ${timeStr}` : dateStr}</span>
            </p>
          )}
        </div>
      </Link>

      {/* Venue link — OUTSIDE the main <Link> to avoid nested-anchor.
          Independently clickable so users can browse all events at the venue. */}
      {event.venue && (
        <Link
          href={`/venues/${venueToSlug(event.venue)}`}
          className="block px-2 pb-2 text-[10px] text-[#6b5d57] hover:text-[#9a442d] hover:underline line-clamp-1 flex items-center gap-1 transition-colors"
          aria-label={`See all events at ${event.venue}`}
        >
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          {event.venue}
        </Link>
      )}

      {/* Heart save button — lives OUTSIDE the Link to avoid nested anchor */}
      <QuickSaveButton
        eventId={event.id}
        eventName={event.title}
        eventDate={event.date}
        venueName={event.venue ?? null}
        category={event.category ?? null}
        imageUrl={event.imageUrl ?? null}
        ticketUrl={event.ticketUrl ?? null}
        className="absolute top-2 left-2 z-10"
      />
    </div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ timeLabel }: { timeLabel: string }) {
  const SUGGESTION_PILLS = [
    { label: 'Music',         href: '/events?category=Music' },
    { label: 'Comedy',        href: '/events?category=Comedy' },
    { label: 'Arts & Theater',href: '/events?category=Arts+%26+Theater' },
    { label: 'Free events',   href: '/events?price=free' },
    { label: 'Sports',        href: '/events?category=Sports' },
    { label: 'Food & Drink',  href: '/events?category=Food+%26+Drink' },
  ]

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="text-5xl mb-3">🌵</div>
      <h2
        className="text-lg font-bold text-[#1a1614] mb-1"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        No events found
      </h2>
      <p className="text-[#6b5d57] text-xs max-w-xs mb-5">
        No {timeLabel.toLowerCase()} events right now. Try a different time range or browse by category.
      </p>

      {/* Smart suggestion pills */}
      <div className="flex flex-wrap justify-center gap-2 max-w-sm mb-5">
        {SUGGESTION_PILLS.map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            className="px-3 py-1.5 rounded-full bg-white border border-[#ddc9a3] text-xs font-semibold text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d] transition-all"
          >
            {label}
          </Link>
        ))}
      </div>

      <Link
        href="/events"
        className="px-4 py-1.5 rounded-full bg-[#9a442d] text-white text-xs font-medium hover:bg-[#7d3725] transition-colors"
      >
        View All Upcoming
      </Link>
    </div>
  )
}

// ─── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  time,
  category,
  q,
  price,
}: {
  page: number
  totalPages: number
  time?: string
  category?: string
  q?: string
  price?: string
}) {
  const buildUrl = (p: number) => {
    const params = new URLSearchParams()
    if (time) params.set('time', time)
    if (category) params.set('category', category)
    if (q) params.set('q', q)
    if (price) params.set('price', price)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/events${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="flex items-center justify-center gap-3 py-6 animate-fade-in">
      {page > 1 && (
        <Link
          href={buildUrl(page - 1)}
          className="px-4 py-1.5 rounded-full border border-[#ddc9a3] text-xs text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
        >
          ← Prev
        </Link>
      )}
      <span className="text-xs text-[#6b5d57] tabular-nums">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={buildUrl(page + 1)}
          className="px-4 py-1.5 rounded-full border border-[#ddc9a3] text-xs text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
        >
          Next →
        </Link>
      )}
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TIME_LABELS: Record<string, string> = {
  today:          'Today\'s Events',
  tonight:        'Tonight',
  tomorrow:       'Tomorrow',
  'this-weekend': 'This Weekend',
  'this-week':    'This Week',
  upcoming:       'All Upcoming',
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso
    const d = new Date(normalized)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Denver',
    })
  } catch {
    return ''
  }
}
