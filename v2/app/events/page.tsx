import { Suspense } from 'react'
import Link from 'next/link'
import { fetchEvents, NormalizedEvent } from '@/lib/events'
import { TimeFilter } from '@/lib/utils/dates'
import { FilterBar } from './FilterBar'
import { MapPin, Clock, ExternalLink } from 'lucide-react'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ time?: string; category?: string; page?: string }>
}

export default async function EventsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const timeFilter = (params.time as TimeFilter) || 'upcoming'
  const category = params.category || null
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const limit = 36
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
          <span className="text-xs text-[#8a7a74]">{total.toLocaleString()} events</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* ── Title row ── */}
        <div className="flex items-end justify-between">
          <div>
            <h1
              className="text-2xl font-black text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {timeLabel}
            </h1>
            <p className="text-[#8a7a74] text-xs mt-0.5">Albuquerque, NM</p>
          </div>
        </div>

        {/* ── Filters ── */}
        <Suspense>
          <FilterBar
            currentTime={params.time ?? ''}
            currentCategory={params.category ?? ''}
          />
        </Suspense>

        {/* ── Grid ── */}
        {events.length === 0 ? (
          <EmptyState timeLabel={timeLabel} />
        ) : (
          <>
            <p className="text-xs text-[#8a7a74]">
              {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
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
          />
        )}
      </div>
    </main>
  )
}

// ─── Compact Event Card ─────────────────────────────────────────────────────

function EventCard({ event }: { event: NormalizedEvent }) {
  const dateStr = formatDate(event.date)
  const timeStr = event.time ? `${event.time}` : ''
  const Wrapper = event.ticketUrl ? 'a' : 'div'
  const linkProps = event.ticketUrl
    ? { href: event.ticketUrl, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {}

  return (
    <Wrapper
      {...linkProps}
      className="group flex flex-col bg-white rounded-xl overflow-hidden border border-[#f0e4cc] shadow-[0_1px_4px_rgba(26,22,20,0.04)] hover:shadow-[0_4px_16px_rgba(26,22,20,0.12)] transition-all hover:-translate-y-0.5"
    >
      {/* Square image */}
      <div className="relative aspect-square bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3] overflow-hidden">
        {event.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={event.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl opacity-20">🎶</span>
          </div>
        )}

        {/* Time badge (top-left, like mockup) */}
        {(dateStr || timeStr) && (
          <div className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur-sm text-[#1a1614] text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {timeStr ? `${dateStr} · ${timeStr}` : dateStr}
          </div>
        )}

        {/* Category badge */}
        {event.category && (
          <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {event.category}
          </div>
        )}

        {/* Price badge */}
        {event.price && (
          <div className="absolute bottom-1.5 right-1.5 bg-[#006a62] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            {event.price}
          </div>
        )}

        {/* Ticket link indicator */}
        {event.ticketUrl && (
          <div className="absolute bottom-1.5 left-1.5 bg-[#9a442d] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="w-2.5 h-2.5" />
            Tickets
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1 flex-1 flex flex-col">
        <h3
          className="font-semibold text-[#1a1614] text-xs leading-tight line-clamp-2"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          {event.title}
        </h3>
        {event.venue && (
          <p className="text-[10px] text-[#8a7a74] line-clamp-1 flex items-center gap-1">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            {event.venue}
          </p>
        )}
      </div>
    </Wrapper>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ timeLabel }: { timeLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
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
    <div className="flex items-center justify-center gap-3 py-6">
      {page > 1 && (
        <Link
          href={buildUrl(page - 1)}
          className="px-4 py-1.5 rounded-full border border-[#ddc9a3] text-xs text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
        >
          ← Prev
        </Link>
      )}
      <span className="text-xs text-[#8a7a74]">
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
