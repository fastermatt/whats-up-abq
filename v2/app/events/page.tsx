import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents, fetchCategoryCounts, fetchEventCountsByDate, NormalizedEvent } from '@/lib/events'
import { TimeFilter } from '@/lib/utils/dates'
import { getCategoryFallback } from '@/lib/fallback-images'
import { FilterBar } from './FilterBar'
import { SearchBar } from './SearchBar'
import { CalendarPicker } from './CalendarPicker'
import { CalendarToggle } from './CalendarToggle'
import { MapPin, Clock } from 'lucide-react'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ time?: string; category?: string; page?: string; q?: string; free?: string; price?: string; date?: string; cal?: string }>
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
  const category = params.category
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
          url: 'https://cdn.midjourney.com/fb77c641/0_0.jpeg',
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
  const category = params.category || null
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

  const [{ events, total }, categoryCounts, calendarCounts] = await Promise.all([
    fetchEvents({ timeFilter, category, search, freeOnly, maxPrice, date: selectedDate ?? undefined, limit, offset }),
    fetchCategoryCounts(),
    showCal ? fetchEventCountsByDate(calStart, calEnd) : Promise.resolve([]),
  ])

  const totalPages = Math.ceil(total / limit)

  // Title: date filter overrides time label
  let timeLabel: string
  if (selectedDate) {
    const d = new Date(selectedDate + 'T12:00:00')
    timeLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  } else {
    timeLabel = TIME_LABELS[timeFilter] ?? 'Events'
  }

  return (
    <main id="main" className="min-h-dvh bg-[--bg]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="font-black text-xl text-[#1a1614] tracking-tight hover:text-[#9a442d] transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            ABQ Unplugged
          </Link>
          <span className="text-xs text-[#8a7a74] tabular-nums">{total.toLocaleString()} events</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* ── Title row + Calendar toggle ── */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1
              className="text-2xl font-black text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {timeLabel}
            </h1>
            <p className="text-[#8a7a74] text-xs mt-0.5">Albuquerque, NM</p>
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
            priceFilter={priceParam}
            categoryCounts={categoryCounts}
          />
        </Suspense>

        {/* ── Grid ── */}
        {events.length === 0 ? (
          <EmptyState timeLabel={timeLabel} />
        ) : (
          <>
            <p className="text-xs text-[#8a7a74] tabular-nums">
              {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {events.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </>
        )}

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
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col bg-white rounded-xl overflow-hidden border border-[#f0e4cc]/80 shadow-[0_1px_3px_rgba(26,22,20,0.04)] hover:shadow-[0_8px_24px_rgba(26,22,20,0.12)] transition-all duration-300 hover:-translate-y-1 spring-card"
      style={{ '--card-i': Math.min(index, 14) } as React.CSSProperties}
    >
      {/* Landscape image — 16:10 ratio for a nice rectangle */}
      <div className="relative aspect-[16/10] bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Category badge — top right */}
        {event.category && (
          <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {event.subcategory ? `${event.category} · ${event.subcategory}` : event.category}
          </div>
        )}

        {/* Price badge — bottom right */}
        {event.price && (
          <div className="absolute bottom-1.5 right-1.5 bg-[#006a62]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            {event.price}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Info section — compact and clean */}
      <div className="p-2 space-y-0.5 flex-1 flex flex-col">
        <h3
          className="font-bold text-[#1a1614] text-[11px] leading-tight line-clamp-2 group-hover:text-[#9a442d] transition-colors"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          {event.title}
        </h3>

        {/* Date & time row */}
        {(dateStr || timeStr) && (
          <p className="text-[10px] text-[#9a442d] font-medium flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            <span>{timeStr ? `${dateStr} · ${timeStr}` : dateStr}</span>
          </p>
        )}

        {/* Venue */}
        {event.venue && (
          <p className="text-[10px] text-[#8a7a74] line-clamp-1 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            {event.venue}
          </p>
        )}
      </div>
    </Link>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ timeLabel }: { timeLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="text-5xl mb-3">🌵</div>
      <h2
        className="text-lg font-bold text-[#1a1614] mb-1"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        No events found
      </h2>
      <p className="text-[#8a7a74] text-xs max-w-xs">
        No {timeLabel.toLowerCase()} events right now. Try a different time range.
      </p>
      <Link
        href="/events"
        className="mt-4 px-4 py-1.5 rounded-full bg-[#9a442d] text-white text-xs font-medium hover:bg-[#7d3725] transition-colors"
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
      <span className="text-xs text-[#8a7a74] tabular-nums">
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
