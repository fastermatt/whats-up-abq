import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { QuickHideButton } from './QuickHideButton'

export const revalidate = 0

interface PageProps {
  searchParams: Promise<{ q?: string; hidden?: string; source?: string; page?: string }>
}

export default async function AdminEventsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.q?.trim() || ''
  const showHidden = params.hidden === '1'
  const source = params.source || ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const limit = 50
  const offset = (page - 1) * limit

  const supabase = await createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .schema('public').from('events')
    .select('id, source, event_date, hidden, ai_enrichment, raw', { count: 'exact' })
    .eq('hidden', showHidden)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .range(offset, offset + limit - 1)

  if (source) q = q.eq('source', source)

  const { data: rows, count } = await q
  const totalPages = Math.ceil((count ?? 0) / limit)

  // Extract title from raw JSON per source
  const events = (rows ?? []).map((r: Record<string, unknown>) => {
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
    const category = (ai?.category ?? null) as string | null
    return { id: r.id, source: r.source, event_date: r.event_date, hidden: r.hidden, title, category }
  }).filter((e: { title: string }) => !search || e.title.toLowerCase().includes(search.toLowerCase()))

  const SOURCES = ['', 'ticketmaster', 'seatgeek', 'eventbrite', 'local', 'volunteer', 'bandsintown']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>Events</h1>
        <div className="flex gap-2 items-center">
          <Link
            href={showHidden ? '/admin/events' : '/admin/events?hidden=1'}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${showHidden ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/60 hover:text-white'}`}
          >
            {showHidden ? 'Showing hidden' : 'Show hidden'}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search events…"
          defaultValue={search}
          className="bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#9a442d] w-64"
          onChange={() => {/* handled server-side on submit */}}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value
              window.location.href = `/admin/events?q=${encodeURIComponent(val)}${showHidden ? '&hidden=1' : ''}`
            }
          }}
        />
        <select
          defaultValue={source}
          className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#9a442d]"
          onChange={(e) => {
            window.location.href = `/admin/events?source=${e.target.value}${showHidden ? '&hidden=1' : ''}`
          }}
        >
          {SOURCES.map(s => <option key={s} value={s} className="bg-[#1a1614]">{s || 'All sources'}</option>)}
        </select>
      </div>

      <p className="text-white/40 text-xs">{count?.toLocaleString()} events · showing {offset + 1}–{Math.min(offset + limit, count ?? 0)}</p>

      {/* Events table */}
      <div className="space-y-1">
        {events.map((event: Record<string, string | boolean | null>) => (
          <div key={String(event.id)} className="flex items-center gap-3 bg-white/5 hover:bg-white/8 rounded-xl px-4 py-2.5 group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{String(event.title) || '(no title)'}</p>
              <p className="text-xs text-white/40">
                {String(event.event_date)} · {String(event.source)}
                {event.category && ` · ${String(event.category)}`}
              </p>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <QuickHideButton eventId={String(event.id)} hidden={Boolean(event.hidden)} />
              <Link
                href={`/admin/events/${String(event.id)}`}
                className="text-xs px-3 py-1 bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
              >
                Edit
              </Link>
              <Link
                href={`/events/${String(event.id)}`}
                className="text-xs text-white/40 hover:text-white transition-colors"
                target="_blank"
              >
                View →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-3 items-center justify-center pt-4">
          {page > 1 && (
            <Link href={`/admin/events?page=${page - 1}${source ? `&source=${source}` : ''}${showHidden ? '&hidden=1' : ''}`}
              className="text-sm px-4 py-1.5 bg-white/10 rounded-lg hover:bg-white/15 transition-colors">← Prev</Link>
          )}
          <span className="text-sm text-white/40">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={`/admin/events?page=${page + 1}${source ? `&source=${source}` : ''}${showHidden ? '&hidden=1' : ''}`}
              className="text-sm px-4 py-1.5 bg-white/10 rounded-lg hover:bg-white/15 transition-colors">Next →</Link>
          )}
        </div>
      )}
    </div>
  )
}
