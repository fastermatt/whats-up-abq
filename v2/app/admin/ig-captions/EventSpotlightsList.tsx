'use client'

/**
 * EventSpotlightsList — searchable list of event spotlight cards.
 * Client component so the search input can filter without a server round-trip.
 * Caption data is pre-computed server-side and passed as props.
 */

import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { EventSpotlightCard } from './EventSpotlightCard'
import { CaptionCard } from './CaptionCard'

export interface SpotlightItem {
  id: string
  title: string
  category: string | null
  dateLabel: string | null
  time: string | null
  venue: string | null
  price: string | null
  imageUrl: string | null
  emoji: string
  metaLine: string
  captions: {
    standard: string
    hype: string
    spotlight: string
    minimal: string
  }
}

const CAPTION_STYLES = [
  { key: 'standard'  as const, label: 'Standard',  sub: 'Clear & informative' },
  { key: 'hype'      as const, label: 'Hype',      sub: 'High energy, FOMO-driven' },
  { key: 'spotlight' as const, label: 'Spotlight', sub: 'Editorial, descriptive' },
  { key: 'minimal'   as const, label: 'Minimal',   sub: 'Short & punchy' },
]

export function EventSpotlightsList({ events }: { events: SpotlightItem[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return events
    return events.filter(e =>
      e.title.toLowerCase().includes(q) ||
      (e.venue?.toLowerCase().includes(q) ?? false) ||
      (e.dateLabel?.toLowerCase().includes(q) ?? false) ||
      (e.category?.toLowerCase().includes(q) ?? false)
    )
  }, [events, search])

  return (
    <div className="space-y-5">
      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, venue, category, date…"
          className="w-full pl-9 pr-9 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-xl
            text-white text-sm placeholder:text-white/20 focus:outline-none
            focus:border-[#9a442d]/60 focus:bg-white/[0.08] transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-white/25">
        {search.trim()
          ? `${filtered.length} of ${events.length} events`
          : `${events.length} events`}
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <p className="text-white/30 text-sm text-center py-10">
          No events match &ldquo;{search}&rdquo;
        </p>
      )}

      {/* Event blocks */}
      <div className="space-y-8">
        {filtered.map((event, i) => (
          <div
            key={event.id}
            className="bg-[#201c1a] border border-white/[0.07] rounded-2xl p-5 space-y-5"
          >
            {/* Event header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg leading-none" aria-hidden="true">{event.emoji}</span>
                  <p className="text-base font-bold text-white truncate">{event.title}</p>
                </div>
                {event.metaLine && (
                  <p className="text-xs text-white/40">{event.metaLine}</p>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-white/15 mt-1 tabular-nums">#{i + 1}</span>
            </div>

            {/* Image card + captions side by side */}
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="shrink-0">
                <EventSpotlightCard
                  title={event.title}
                  category={event.category}
                  dateLabel={event.dateLabel}
                  time={event.time}
                  venue={event.venue}
                  price={event.price}
                  imageUrl={event.imageUrl}
                  eventId={event.id}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/25 font-semibold mb-3">
                  Caption Options
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {CAPTION_STYLES.map(({ key, label, sub }) => (
                    <CaptionCard
                      key={key}
                      label={label}
                      sublabel={sub}
                      caption={event.captions[key]}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
