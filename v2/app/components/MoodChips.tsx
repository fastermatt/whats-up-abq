/**
 * MoodChips — horizontal-scroll row of mood-based browse shortcuts.
 * Server component (pure links, no client state needed).
 */
import Link from 'next/link'
import {
  Heart,
  Baby,
  Music,
  Sparkles,
  Coffee,
  Moon,
  UtensilsCrossed,
  TreePine,
  type LucideIcon,
} from 'lucide-react'
import { MOODS } from '@/lib/moods'

const ICON_MAP: Record<string, LucideIcon> = {
  Heart,
  Baby,
  Music,
  Sparkles,
  Coffee,
  Moon,
  UtensilsCrossed,
  TreePine,
}

function buildHref(query: { category?: string; free?: string; time?: string }): string {
  const params = new URLSearchParams()
  if (query.category) params.set('category', query.category)
  if (query.free) params.set('price', 'free')
  if (query.time) params.set('time', query.time)
  return `/events?${params.toString()}`
}

export default function MoodChips() {
  return (
    <section aria-label="Browse by mood" className="py-4 border-b border-[#f0e4cc]/60">
      <div className="px-4 mb-2">
        <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a7a74] font-semibold">
          What&apos;s your vibe?
        </p>
      </div>
      <div
        className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {MOODS.map((mood) => {
          const Icon = ICON_MAP[mood.icon]
          return (
            <Link
              key={mood.slug}
              href={buildHref(mood.query)}
              className={[
                'flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full',
                'bg-[#9a442d]/10 border border-[#9a442d]/20 text-[#9a442d]',
                'text-xs font-semibold whitespace-nowrap',
                'hover:bg-[#9a442d] hover:text-white hover:border-[#9a442d]',
                'transition-all duration-200',
                'motion-reduce:transition-none',
              ].join(' ')}
            >
              {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />}
              {mood.label}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
