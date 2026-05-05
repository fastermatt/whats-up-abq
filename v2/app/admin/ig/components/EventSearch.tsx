'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Search, Loader2, Calendar, MapPin } from 'lucide-react'
import type { EventSearchResult } from '@/app/api/admin/ig/search/route'

const CAT_COLORS: Record<string, string> = {
  'Music':         'text-purple-300 bg-purple-400/10',
  'Arts & Theater':'text-pink-300   bg-pink-400/10',
  'Comedy':        'text-yellow-300 bg-yellow-400/10',
  'Sports':        'text-blue-300   bg-blue-400/10',
  'Food & Drink':  'text-orange-300 bg-orange-400/10',
  'Family':        'text-green-300  bg-green-400/10',
  'Outdoor':       'text-emerald-300 bg-emerald-400/10',
  'Festivals':     'text-rose-300   bg-rose-400/10',
  'Film':          'text-cyan-300   bg-cyan-400/10',
  'Community':     'text-amber-300  bg-amber-400/10',
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Denver' })
  } catch { return iso }
}

function extractId(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const m = t.match(/\/events\/([^/?#\s]+)/)
  if (m) return m[1]
  if (!t.includes('/') && !t.includes(' ')) return t
  return null
}

export function EventSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EventSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check if input looks like a URL/ID — skip search, go directly
  const looksLikeId = Boolean(query.trim() && extractId(query))

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim() || looksLikeId) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/ig/search?q=${encodeURIComponent(q)}&limit=10`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
      setOpen(true)
      setActiveIdx(-1)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [looksLikeId])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim() || looksLikeId) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    setLoading(true)
    timerRef.current = setTimeout(() => runSearch(query), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, looksLikeId, runSearch])

  const navigate = (id: string) => {
    setOpen(false)
    setQuery('')
    router.push(`/admin/ig?id=${id}`)
  }

  const handleGo = () => {
    const id = extractId(query)
    if (id) { navigate(id); return }
    if (results.length > 0) {
      const idx = activeIdx >= 0 ? activeIdx : 0
      navigate(results[idx]?.id ?? results[0].id)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter') handleGo()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIdx >= 0 ? activeIdx : 0
      navigate(results[idx].id)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!inputRef.current?.closest('.event-search-root')?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx >= 0 && listRef.current) {
      listRef.current.children[activeIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx])

  return (
    <div className="event-search-root bg-[#201c1a] border border-[#9a442d]/40 rounded-2xl p-5 space-y-3">
      <div>
        <p className="text-xs font-bold text-[#e8a898] uppercase tracking-[0.14em] mb-1">
          ⚡ Quick Post
        </p>
        <p className="text-xs text-white/35">
          Search by event name, or paste a URL / event ID
        </p>
      </div>

      {/* Search input row */}
      <div className="relative">
        <div className="flex gap-2">
          {/* Icon */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
            {loading
              ? <Loader2 size={15} className="animate-spin" />
              : <Search size={15} />
            }
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true) }}
            onKeyDown={handleKey}
            placeholder="Search events… or paste URL / ID"
            className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-xl pl-9 pr-3 py-2.5
              text-white text-sm placeholder:text-white/20 focus:outline-none
              focus:border-[#9a442d]/60 focus:bg-white/[0.08] transition-all"
            autoComplete="off"
            spellCheck={false}
          />

          <button
            onClick={handleGo}
            disabled={!query.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#9a442d] text-white
              text-sm font-semibold hover:bg-[#b5502f] active:scale-95 transition-all
              disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <ArrowRight size={15} />
            <span className="hidden sm:inline">Open</span>
          </button>
        </div>

        {/* Results dropdown */}
        {open && results.length > 0 && (
          <ul
            ref={listRef}
            className="absolute z-50 top-full left-0 right-12 mt-1.5 bg-[#1a1614] border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl max-h-[340px] overflow-y-auto"
          >
            {results.map((evt, i) => {
              const catStyle = CAT_COLORS[evt.category ?? ''] ?? 'text-white/50 bg-white/[0.06]'
              const isActive = i === activeIdx
              return (
                <li key={evt.id}>
                  <button
                    onMouseDown={e => { e.preventDefault(); navigate(evt.id) }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-[#9a442d]/30' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-white/[0.06] flex items-center justify-center">
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
                      <p className="text-sm text-white font-semibold truncate leading-tight">{evt.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {evt.category && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${catStyle}`}>
                            {evt.category}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-white/40">
                          <Calendar size={10} />{fmtDate(evt.date)}
                        </span>
                        {evt.venue && (
                          <span className="flex items-center gap-1 text-[11px] text-white/30 truncate max-w-[180px]">
                            <MapPin size={10} />{evt.venue}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight size={13} className="shrink-0 text-white/20" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* No results */}
        {open && !loading && query.trim() && !looksLikeId && results.length === 0 && (
          <div className="absolute z-50 top-full left-0 right-12 mt-1.5 bg-[#1a1614] border border-white/[0.1] rounded-xl px-4 py-3">
            <p className="text-sm text-white/40">No upcoming events matching &ldquo;{query}&rdquo;</p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-white/20">
        Opens the Poster template pre-filled with event data · swap template in the toolbar
      </p>
    </div>
  )
}

function categoryEmoji(cat: string | null) {
  const map: Record<string, string> = {
    'Music': '🎵', 'Comedy': '😂', 'Sports': '🏟️', 'Arts & Theater': '🎭',
    'Food & Drink': '🍻', 'Family': '🎡', 'Film': '🎬', 'Outdoor': '🌄',
    'Festivals': '🎪', 'Community': '🌵',
  }
  return map[cat ?? ''] ?? '📍'
}
