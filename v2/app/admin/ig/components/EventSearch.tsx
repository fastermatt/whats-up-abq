'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Search, Loader2, Calendar, MapPin, X, ChevronDown, Flame } from 'lucide-react'
import type { EventSearchResult } from '@/app/api/admin/ig/search/route'
import type { NormalizedEvent } from '@/lib/events'

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeFilter = 'today' | 'tonight' | 'tomorrow' | 'this-weekend' | 'this-week' | 'upcoming'
type ViewMode   = 'browse' | 'top-picks'

const TIME_PILLS: { label: string; value: TimeFilter }[] = [
  { label: 'Today',     value: 'today' },
  { label: 'Tonight',   value: 'tonight' },
  { label: 'Tomorrow',  value: 'tomorrow' },
  { label: 'Weekend',   value: 'this-weekend' },
  { label: 'This Week', value: 'this-week' },
  { label: 'All',       value: 'upcoming' },
]

const CATEGORIES = [
  'Music', 'Comedy', 'Sports', 'Arts & Theater',
  'Family', 'Film', 'Food & Drink', 'Festivals', 'Outdoor', 'Community',
]

const CAT_COLORS: Record<string, string> = {
  'Music':          'text-purple-300 bg-purple-400/10 border-purple-400/20',
  'Arts & Theater': 'text-pink-300   bg-pink-400/10   border-pink-400/20',
  'Comedy':         'text-yellow-300 bg-yellow-400/10 border-yellow-400/20',
  'Sports':         'text-blue-300   bg-blue-400/10   border-blue-400/20',
  'Food & Drink':   'text-orange-300 bg-orange-400/10 border-orange-400/20',
  'Family':         'text-green-300  bg-green-400/10  border-green-400/20',
  'Outdoor':        'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
  'Festivals':      'text-rose-300   bg-rose-400/10   border-rose-400/20',
  'Film':           'text-cyan-300   bg-cyan-400/10   border-cyan-400/20',
  'Community':      'text-amber-300  bg-amber-400/10  border-amber-400/20',
}

// Score badge: heat color based on score tier
function ScoreBadge({ score, rank }: { score: number | null | undefined; rank?: number }) {
  if (score == null) return null
  const tier = score >= 8.5 ? 'high' : score >= 6.5 ? 'mid' : 'low'
  const colors = {
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    mid:  'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
    low:  'bg-white/[0.06]  text-white/40   border-white/10',
  }
  const rankLabel = rank === 1 ? '#1' : rank === 2 ? '#2' : rank === 3 ? '#3' : null
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${colors[tier]}`}>
      {tier === 'high' && <Flame size={9} />}
      {rankLabel && <span className="opacity-60 mr-0.5">{rankLabel}</span>}
      {score.toFixed(1)}
    </div>
  )
}

function fmtDate(iso: string) {
  try {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso
    return new Date(base).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Denver',
    })
  } catch { return iso }
}

function fmtDayHeader(iso: string) {
  try {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso
    return new Date(base).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: 'America/Denver',
    })
  } catch { return iso }
}

function extractId(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const m = t.match(/\/events\/([^/?#\s]+)/)
  if (m) return m[1]
  if (!t.includes('/') && !t.includes(' ') && t.length > 6) return t
  return null
}

function categoryEmoji(cat: string | null) {
  const map: Record<string, string> = {
    'Music': '🎵', 'Comedy': '😂', 'Sports': '🏟️', 'Arts & Theater': '🎭',
    'Food & Drink': '🍻', 'Family': '🎡', 'Film': '🎬', 'Outdoor': '🌄',
    'Festivals': '🎪', 'Community': '🌵',
  }
  return map[cat ?? ''] ?? '📍'
}

// Group flat top-picks results by date
function groupByDay(results: EventSearchResult[]): Map<string, EventSearchResult[]> {
  const map = new Map<string, EventSearchResult[]>()
  for (const r of results) {
    const day = r.date.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(r)
  }
  return map
}

// ─── Event row (shared between browse and top-picks) ─────────────────────────

function EventRow({
  evt, onClick, showScore = false,
}: {
  evt: EventSearchResult
  onClick: () => void
  showScore?: boolean
}) {
  const catStyle = CAT_COLORS[evt.category ?? ''] ?? 'text-white/50 bg-white/[0.06] border-white/10'
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.04] active:bg-terra/10 transition-colors group"
    >
      {/* Rank badge for top-picks */}
      {showScore && evt.rank && (
        <div className="shrink-0 w-5 text-center text-[11px] font-bold text-white/55">
          {evt.rank}
        </div>
      )}

      {/* Thumbnail */}
      <div className="shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-white/[0.06] flex items-center justify-center">
        {evt.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={evt.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <span className="text-lg">{categoryEmoji(evt.category)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-semibold truncate leading-tight group-hover:text-terra-light transition-colors">
          {evt.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {evt.category && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${catStyle}`}>
              {evt.category}
            </span>
          )}
          {!showScore && (
            <span className="flex items-center gap-1 text-[11px] text-white/35">
              <Calendar size={9} />{fmtDate(evt.date)}
            </span>
          )}
          {evt.venue && (
            <span className="flex items-center gap-1 text-[11px] text-white/25 truncate max-w-[160px]">
              <MapPin size={9} />{evt.venue}
            </span>
          )}
        </div>
      </div>

      {/* Score badge */}
      {showScore && (
        <ScoreBadge score={evt.popularityScore} rank={evt.rank} />
      )}

      <ArrowRight size={13} className="shrink-0 text-white/45 group-hover:text-white/50 transition-colors" />
    </button>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface EventSearchProps {
  event?: NormalizedEvent | null
}

function fmtDateShort(iso: string) {
  try {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso
    return new Date(base).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Denver',
    })
  } catch { return iso }
}

export function EventSearch({ event }: EventSearchProps) {
  const router  = useRouter()
  const [query, setQuery]       = useState('')
  const [time, setTime]         = useState<TimeFilter>('upcoming')
  const [category, setCategory] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('browse')
  const [results, setResults]   = useState<EventSearchResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState(!event)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-collapse when event loads
  useEffect(() => {
    if (event) setExpanded(false)
  }, [event?.id])

  const looksLikeId = Boolean(query.trim() && extractId(query) && !query.includes(' '))

  const fetchResults = useCallback(async (q: string, t: TimeFilter, cat: string, mode: ViewMode) => {
    setLoading(true)
    try {
      let url: string
      if (mode === 'top-picks') {
        url = '/api/admin/ig/search?mode=top-picks'
      } else {
        const params = new URLSearchParams({ time: t, limit: '16' })
        if (q.trim()) params.set('q', q.trim())
        if (cat)      params.set('category', cat)
        url = `/api/admin/ig/search?${params}`
      }
      const res  = await fetch(url)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (looksLikeId) return
    if (timerRef.current) clearTimeout(timerRef.current)
    const delay = query.trim() ? 300 : 0
    timerRef.current = setTimeout(() => fetchResults(query, time, category, viewMode), delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, time, category, viewMode, looksLikeId, fetchResults])

  const navigate = (id: string) => router.push(`/admin/ig?id=${id}`)

  const handleGo = () => {
    const id = extractId(query)
    if (id) { navigate(id); return }
    if (results.length > 0) navigate(results[0].id)
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleGo() }
  const clearQuery = () => setQuery('')
  const hasFilters = category !== '' || time !== 'upcoming'

  // ── Collapsed state ─────────────────────────────────────────────────────────
  if (event && !expanded) {
    return (
      <div className="flex items-center gap-3 bg-[#151210] border border-terra/25 rounded-xl px-4 py-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-terra shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate leading-tight">{event.title}</p>
          <p className="text-[11px] text-white/40 mt-0.5 truncate">
            {event.category && <span className="text-terra/80 font-semibold mr-2">{event.category}</span>}
            {event.date && fmtDateShort(event.date)}
            {event.time && ` · ${event.time}`}
            {event.venue && ` · ${event.venue}`}
          </p>
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors shrink-0 py-1 px-2 rounded hover:bg-white/[0.06]"
        >
          Change <ChevronDown size={11} />
        </button>
      </div>
    )
  }

  // ── Top Picks grouped view ──────────────────────────────────────────────────
  const topPicksContent = () => {
    if (loading && results.length === 0) {
      return (
        <div className="flex items-center justify-center py-10 gap-2 text-white/55 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Ranking events…
        </div>
      )
    }
    if (results.length === 0) {
      return (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-white/55">No upcoming events found</p>
        </div>
      )
    }

    const grouped = groupByDay(results)
    return (
      <div>
        {Array.from(grouped.entries()).map(([day, dayEvents]) => (
          <div key={day}>
            {/* Day header */}
            <div className="px-5 py-2 bg-white/[0.03] border-t border-white/[0.06] flex items-center gap-2">
              <Calendar size={10} className="text-white/55" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                {fmtDayHeader(day)}
              </p>
              <span className="text-[10px] text-white/45 ml-auto">Top {dayEvents.length}</span>
            </div>
            {dayEvents.map(evt => (
              <EventRow key={evt.id} evt={evt} onClick={() => navigate(evt.id)} showScore />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // ── Browse results ─────────────────────────────────────────────────────────
  const browseContent = () => {
    if (looksLikeId) {
      return (
        <div className="px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-white/50">Looks like an event ID or URL</p>
          <button
            onClick={() => { const id = extractId(query); if (id) navigate(id) }}
            className="flex items-center gap-1.5 text-xs text-terra-light hover:text-white font-semibold transition-colors"
          >
            Open it <ArrowRight size={12} />
          </button>
        </div>
      )
    }
    if (loading && results.length === 0) {
      return (
        <div className="flex items-center justify-center py-8 gap-2 text-white/55 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </div>
      )
    }
    if (results.length === 0) {
      return (
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-white/55">No events found</p>
          {(query || hasFilters) && (
            <p className="text-[11px] text-white/45 mt-1">Try adjusting the filters or search term</p>
          )}
        </div>
      )
    }
    return (
      <ul>
        {results.map((evt, i) => (
          <li key={evt.id} className={i > 0 ? 'border-t border-white/[0.04]' : ''}>
            <EventRow evt={evt} onClick={() => navigate(evt.id)} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="bg-[#151210] border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-terra-light uppercase tracking-[0.14em] mb-0.5">
            ⚡ Load Event
          </p>
          <p className="text-[11px] text-white/55">
            Pick an event to pre-fill the Poster template
          </p>
        </div>
        {event && (
          <button
            onClick={() => setExpanded(false)}
            className="text-[11px] text-white/55 hover:text-white/60 transition-colors flex items-center gap-1"
          >
            Collapse <X size={11} />
          </button>
        )}
      </div>

      {/* Mode tabs */}
      <div className="px-5 pb-3">
        <div className="flex gap-1 p-0.5 bg-white/[0.04] rounded-xl border border-white/[0.06]">
          <button
            onClick={() => setViewMode('browse')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              viewMode === 'browse'
                ? 'bg-white/[0.1] text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setViewMode('top-picks')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              viewMode === 'top-picks'
                ? 'bg-orange-500/20 text-orange-300'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <Flame size={11} />
            Top Picks
          </button>
        </div>
      </div>

      {/* Browse controls — hidden in top-picks mode */}
      {viewMode === 'browse' && (
        <div className="px-5 space-y-2.5 pb-3">
          {/* Time pills */}
          <div className="flex gap-1.5 flex-wrap">
            {TIME_PILLS.map(pill => (
              <button
                key={pill.value}
                onClick={() => setTime(pill.value)}
                aria-pressed={time === pill.value}
                className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold transition-all border ${
                  time === pill.value
                    ? 'bg-terra border-terra text-white'
                    : 'bg-white/[0.04] border-white/[0.08] text-white/65 hover:bg-white/[0.07] hover:text-white'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
            {CATEGORIES.map(cat => {
              const active = category === cat
              const colors = CAT_COLORS[cat] ?? 'text-white/65 bg-white/[0.06] border-white/10'
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(active ? '' : cat)}
                  aria-pressed={active}
                  className={`shrink-0 min-h-[40px] px-3 rounded-lg text-[11px] font-bold transition-all border ${
                    active
                      ? colors + ' opacity-100 ring-1 ring-white/20'
                      : 'bg-white/[0.04] border-white/[0.06] text-white/55 hover:text-white hover:bg-white/[0.07]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Search input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none">
                {loading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Search size={14} />
                }
              </div>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Search by name, or paste URL / ID…"
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2 min-h-[40px]
                  text-white text-sm placeholder:text-white/45 focus-visible:outline-none
                  focus:border-terra/50 focus:bg-white/[0.07] transition-all"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  onClick={clearQuery}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/85 transition-colors p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={handleGo}
              disabled={!query.trim() && results.length === 0}
              className="flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl bg-terra text-white
                text-sm font-semibold hover:bg-terra-hover active:scale-95 transition-all
                disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <ArrowRight size={14} />
              <span className="hidden sm:inline text-xs">Open</span>
            </button>
          </div>

          {hasFilters && (
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/55">
                {[time !== 'upcoming' && TIME_PILLS.find(p => p.value === time)?.label, category].filter(Boolean).join(' · ')}
              </p>
              <button
                onClick={() => { setCategory(''); setTime('upcoming') }}
                className="text-[10px] text-white/55 hover:text-white/60 transition-colors underline underline-offset-2"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top picks description */}
      {viewMode === 'top-picks' && (
        <div className="px-5 pb-3">
          <p className="text-[11px] text-white/55">
            Top 3 events per day for the next 2 weeks, ranked by AI popularity score.
          </p>
        </div>
      )}

      {/* Results */}
      <div className="border-t border-white/[0.06] max-h-[480px] overflow-y-auto">
        {viewMode === 'top-picks' ? topPicksContent() : browseContent()}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-white/[0.04] flex items-center justify-between">
        <p className="text-[10px] text-white/55">
          {results.length > 0 ? `${results.length} event${results.length !== 1 ? 's' : ''}` : ''}
          {results.length > 0 && viewMode === 'browse' ? ' · Click to open in Poster template' : ''}
        </p>
        {viewMode === 'top-picks' && (
          <p className="text-[10px] text-white/55">Scores update as you run the scoring script</p>
        )}
      </div>
    </div>
  )
}
