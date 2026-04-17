import { createServiceClient } from '@/lib/supabase/server'
import { decodeHtml } from '@/lib/events'
import Link from 'next/link'
import { QuickHideButton } from './QuickHideButton'
import { QuickFeaturedButton } from './QuickFeaturedButton'
import { EventsFilterForm } from './EventsFilterForm'
import { BulkActions } from './BulkActions'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ q?: string; hidden?: string; featured?: string; source?: string; cat?: string; page?: string }>
}

export default async function AdminEventsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.q?.trim() || ''
  const showHidden = params.hidden === '1'
  const showFeatured = params.featured === '1'
  const source = params.source || ''
  const catFilter = params.cat || ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const limit = 50
  const offset = (page - 1) * limit

  const supabase = await createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .schema('public').from('events')
    .select('id, source, event_date, hidden, featured, ai_enrichment, raw', { count: 'exact' })
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .range(offset, offset + limit - 1)

  if (showHidden) {
    q = q.eq('hidden', true)
  } else if (showFeatured) {
    q = q.eq('featured', true).eq('hidden', false)
  } else {
    q = q.eq('hidden', false)
  }

  if (source) q = q.eq('source', source)

  // Server-side text search using ilike on raw JSONB text representation
  if (search) {
    // We'll filter post-fetch since title extraction depends on source
  }

  if (catFilter) {
    q = q.eq('ai_enrichment->>category', catFilter)
  }

  const { data: rows, count } = await q

  interface AdminEvent {
    id: string
    source: string
    event_date: string
    hidden: boolean
    featured: boolean
    title: string
    category: string | null
  }

  // Extract title + metadata
  const allEvents: AdminEvent[] = (rows ?? []).map((r: Record<string, unknown>) => {
    const raw = r.raw as Record<string, unknown>
    const ai = r.ai_enrichment as Record<string, unknown> | null
    let title = ''
    if (r.source === 'eventbrite') {
      const nameField = raw.name as Record<string, unknown> | string | undefined
      title = typeof nameField === 'object' && nameField ? (nameField.text as string) : (nameField as string) ?? ''
    } else {
      title = (raw.name as string) ?? (raw.title as string) ?? ''
    }
    if (ai?.title_override) title = ai.title_override as string
    title = decodeHtml(title)
    const category = (ai?.category ?? null) as string | null
    return {
      id: r.id as string,
      source: r.source as string,
      event_date: r.event_date as string,
      hidden: r.hidden as boolean,
      featured: r.featured as boolean,
      title,
      category,
    }
  })

  // Client-side title search filter (since title is derived)
  const events = search
    ? allEvents.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
    : allEvents

  const totalPages = Math.ceil((count ?? 0) / limit)

  const SOURCES = ['', 'ticketmaster', 'seatgeek', 'eventbrite', 'local', 'volunteer', 'bandsintown']
  const CATEGORIES = [
    '', 'Music', 'Comedy', 'Sports', 'Arts & Theater', 'Family',
    'Film', 'Food & Drink', 'Festivals', 'Outdoor', 'Community',
  ]

  // Build base URL params for pagination links
  const paginationBase = [
    source ? `source=${source}` : '',
    showHidden ? 'hidden=1' : '',
    showFeatured ? 'featured=1' : '',
    catFilter ? `cat=${encodeURIComponent(catFilter)}` : '',
    search ? `q=${encodeURIComponent(search)}` : '',
  ].filter(Boolean).join('&')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>Events</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <Link
            href={showHidden ? '/admin/events' : '/admin/events?hidden=1'}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${showHidden ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/60 hover:text-white'}`}
          >
            {showHidden ? '✓ Showing hidden' : 'Show hidden'}
          </Link>
          <Link
            href={showFeatured ? '/admin/events' : '/admin/events?featured=1'}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${showFeatured ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/60 hover:text-white'}`}
          >
            {showFeatured ? '★ Featured only' : 'Featured only'}
          </Link>
        </div>
      </div>

      {/* Filters — client component handles form submit navigation */}
      <EventsFilterForm
        search={search}
        source={source}
        catFilter={catFilter}
        showHidden={showHidden}
        showFeatured={showFeatured}
        sources={SOURCES}
        categories={CATEGORIES}
      />

      <p className="text-white/40 text-xs">
        {count?.toLocaleString()} events · showing {Math.min(offset + 1, count ?? 0)}–{Math.min(offset + limit, count ?? 0)}
        {search && ` · filtered to ${events.length} matching "${search}"`}
      </p>

      {/* Bulk actions */}
      <BulkActions eventIds={events.map(e => e.id)} />

      {/* Events table */}
      <div className="space-y-1" id="events-list">
        {events.map(event => (
          <div key={event.id} className="flex items-center gap-3 bg-white/5 hover:bg-white/[0.08] rounded-xl px-4 py-2.5 group">
            {/* Bulk checkbox */}
            <input
              type="checkbox"
              data-event-id={event.id}
              className="event-bulk-check w-4 h-4 accent-[#9a442d] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label={`Select ${event.title}`}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-medium truncate">{event.title || '(no title)'}</p>
                {event.featured && (
                  <span className="text-xs text-yellow-400 flex-shrink-0">★</span>
                )}
              </div>
              <p className="text-xs text-white/40">
                {event.event_date} · {event.source}
                {event.category && ` · ${event.category}`}
              </p>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <QuickFeaturedButton eventId={event.id} featured={event.featured} />
              <QuickHideButton eventId={event.id} hidden={event.hidden} />
              <Link
                href={`/admin/events/${event.id}`}
                className="text-xs px-3 py-1 bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
              >
                Edit
              </Link>
              <Link
                href={`/events/${event.id}`}
                className="text-xs text-white/40 hover:text-white transition-colors"
                target="_blank"
              >
                View →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <p className="text-white/40 text-sm text-center py-12">No events found.</p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-3 items-center justify-center pt-4">
          {page > 1 && (
            <Link
              href={`/admin/events?page=${page - 1}${paginationBase ? `&${paginationBase}` : ''}`}
              className="text-sm px-4 py-1.5 bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
            >
              ← Prev
            </Link>
          )}
          <span className="text-sm text-white/40">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/admin/events?page=${page + 1}${paginationBase ? `&${paginationBase}` : ''}`}
              className="text-sm px-4 py-1.5 bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
