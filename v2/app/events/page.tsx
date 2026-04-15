import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { fetchEvents, NormalizedEvent } from '@/lib/events'
import { TimeFilter } from '@/lib/utils/dates'
import { FilterBar } from './FilterBar'
import { MapPin, Clock, Ticket, ExternalLink } from 'lucide-react'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ time?: string; category?: string; page?: string }>
}

export default async function EventsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const timeFilter = (params.time as TimeFilter) || 'upcoming'
  const category = params.category || null
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const limit = 24
  const offset = (page - 1) * limit

  const { events, total } = await fetchEvents({
    timeFilter,
    category,
    limit,
    offset,
  })

  const totalPages = Math.ceil(total / limit)
  const timeLabel = TIME_LABELS[timeFilter] ?? 'Events'

  return (
    <main className="min-h-dvh bg-[--bg]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur border-b border-[#ddc9a3]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="font-black text-xl text-[#1a1614] tracking-tight"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            ABQ Unplugged
          </Link>
          <span className="text-sm text-[#8a7a74]">{total.toLocaleString()} events</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── Page title ── */}
        <div>
          <h1
            className="text-3xl font-black text-[#1a1614] mb-1"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {timeLabel}
          </h1>
          <p className="text-[#8a7a74] text-sm">Albuquerque, NM</p>
        </div>

        {/* ── Filters ── */}
        <Suspense>
          <FilterBar
            currentTime={params.time ?? ''}
            currentCategory={params.category ?? ''}
          />
        </Suspense>

        {/* ── Results count ── */}
        {total > 0 && (
          <p className="text-sm text-[#8a7a74]">
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()} events
          </p>
        )}

        {/* ── Grid ── */}
        {events.length === 0 ? (
          <EmptyState timeLabel={timeLabel} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            time={params.time}
            category={params.category}
          />
        )}
      </div>
    </main>
  )
}

// ─── Event Card ────────────────────────────────────────────────────────────────

function EventCard({ event }: { event: NormalizedEvent }) {
  const dateStr = formatDate(event.date)
  const hasImage = !!event.imageUrl

  return (
    <article className="group bg-white rounded-2xl overflow-hidden border border-[#f0e4cc] shadow-[0_2px_8px_rgba(26,22,20,0.06)] hover:shadow-[0_4px_20px_rgba(26,22,20,0.12)] transition-shadow flex flex-col">
      {/* Image */}
      <div className="relative aspect-video bg-[#f0e4cc] overflow-hidden flex-shrink-0">
        {hasImage ? (
          <Image
            src={event.imageUrl!}
            alt={event.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl opacity-30">🎉</span>
          </div>
        )}
        {/* Featured badge */}
        {event.isFeatured && (
          <div className="absolute top-2 left-2 bg-[#9a442d] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            Featured
          </div>
        )}
        {/* Category badge */}
        {event.category && (
          <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
            {event.category}
          </div>
        )}
        {/* Price badge */}
        {event.price && (
          <div className="absolute bottom-2 right-2 bg-[#006a62] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            {event.price}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1 space-y-1.5">
          <h2
            className="font-bold text-[#1a1614] text-sm leading-snug line-clamp-2"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {event.title}
          </h2>

          <div className="flex items-center gap-1.5 text-xs text-[#8a7a74]">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>{dateStr}{event.time ? ` · ${event.time}` : ''}</span>
          </div>

          {event.venue && (
            <div className="flex items-start gap-1.5 text-xs text-[#8a7a74]">
              <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-1">{event.venue}</span>
            </div>
          )}
        </div>

        {/* Ticket button */}
        {event.ticketUrl ? (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[#9a442d] text-white text-xs font-semibold hover:bg-[#7d3725] transition-colors"
          >
            <Ticket className="w-3 h-3" />
            Get Tickets
            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
          </a>
        ) : (
          <div className="flex items-center justify-center w-full py-2 rounded-xl bg-[#f0e4cc] text-[#8a7a74] text-xs">
            No tickets available
          </div>
        )}
      </div>
    </article>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ timeLabel }: { timeLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4">🌵</div>
      <h2
        className="text-xl font-bold text-[#1a1614] mb-2"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        No events found
      </h2>
      <p className="text-[#8a7a74] text-sm max-w-xs">
        No {timeLabel.toLowerCase()} events right now. Try a different time range or check back later.
      </p>
      <Link
        href="/events"
        className="mt-6 px-5 py-2 rounded-full bg-[#9a442d] text-white text-sm font-medium hover:bg-[#7d3725] transition-colors"
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
}: {
  page: number
  totalPages: number
  time?: string
  category?: string
}) {
  const buildUrl = (p: number) => {
    const params = new URLSearchParams()
    if (time) params.set('time', time)
    if (category) params.set('category', category)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return `/events${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="flex items-center justify-center gap-3 py-8">
      {page > 1 && (
        <Link
          href={buildUrl(page - 1)}
          className="px-5 py-2 rounded-full border border-[#ddc9a3] text-sm text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
        >
          ← Previous
        </Link>
      )}
      <span className="text-sm text-[#8a7a74]">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={buildUrl(page + 1)}
          className="px-5 py-2 rounded-full border border-[#ddc9a3] text-sm text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
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
  tonight:        'Tonight\'s Events',
  tomorrow:       'Tomorrow\'s Events',
  'this-weekend': 'This Weekend',
  'this-week':    'This Week',
  upcoming:       'All Upcoming Events',
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
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
