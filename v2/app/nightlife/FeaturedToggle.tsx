'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, MapPin } from 'lucide-react'
import { EventImage } from '@/app/components/EventImage'
import { getCategoryFallback } from '@/lib/fallback-images'

export interface FeaturedEvent {
  id: string
  title: string
  date: string
  time: string | null
  venue: string | null
  category: string | null
  imageUrl: string | null
}

interface Props {
  tonight: FeaturedEvent[]
  weekend: FeaturedEvent[]
}

export function FeaturedToggle({ tonight, weekend }: Props) {
  const [tab, setTab] = useState<'tonight' | 'weekend'>(
    tonight.length > 0 ? 'tonight' : 'weekend'
  )

  const events = tab === 'tonight' ? tonight : weekend

  return (
    <section>
      {/* Tab selector */}
      <div className="flex items-center gap-1 mb-4">
        {[
          { id: 'tonight' as const,  label: 'Tonight',     disabled: tonight.length === 0 },
          { id: 'weekend' as const,  label: 'This Weekend', disabled: weekend.length === 0 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled}
            className={[
              'px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200',
              tab === t.id
                ? 'bg-terra text-cream shadow-sm'
                : 'bg-[rgba(154,68,45,0.08)] text-terra hover:bg-[rgba(154,68,45,0.15)]',
              t.disabled ? 'opacity-30 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Scroll row */}
      {events.length === 0 ? (
        <p className="text-sm text-ink-light py-4">No events for this period yet.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="group flex-shrink-0 w-[220px] sm:w-[260px] rounded-xl overflow-hidden border border-sand-light/80 bg-white shadow-[0_1px_3px_rgba(26,22,20,0.04)] hover:shadow-[0_8px_24px_rgba(26,22,20,0.12)] hover:-translate-y-1 transition-all duration-300"
            >
              <div className="relative aspect-[4/3] bg-sand-light overflow-hidden">
                <EventImage
                  src={e.imageUrl || getCategoryFallback(e.category ?? undefined, e.title ?? e.id)}
                  fallback={getCategoryFallback(e.category ?? undefined, e.title ?? e.id)}
                  alt={e.title}
                  loading="eager"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                {e.category && (
                  <div className="absolute top-2 left-2 bg-ink/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {e.category}
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3
                  className="font-bold text-ink text-sm leading-tight line-clamp-2 group-hover:text-terra transition-colors"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  {e.title}
                </h3>
                <div className="mt-1.5 space-y-0.5">
                  {e.time ? (
                    <p className="text-[11px] text-terra font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      {e.time}
                    </p>
                  ) : (
                    <p className="text-[11px] text-ink-light italic flex items-center gap-1">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      Time TBA
                    </p>
                  )}
                  {e.venue && (
                    <p className="text-[11px] text-ink-light line-clamp-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {e.venue}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
