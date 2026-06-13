'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, X, MapPin } from 'lucide-react'
import type { CategoryCount } from '@/lib/events'
import { MOODS } from '@/lib/moods'

const TIME_FILTERS = [
  { value: 'today',        label: 'Today' },
  { value: 'tonight',      label: 'Tonight' },
  { value: 'tomorrow',     label: 'Tomorrow' },
  { value: 'this-weekend', label: 'Weekend' },
  { value: 'this-week',    label: 'This Week' },
  { value: 'upcoming',     label: 'All' },
] as const

/** Top-level categories. Sports/Music have expandable subcategories. */
const CATEGORIES = [
  'Music',
  'Comedy',
  'Sports',
  'Arts & Theater',
  'Family',
  'Film',
  'Food & Drink',
  'Festivals',
  'Outdoor',
  'Community',
]

/** Sports subcategories */
const SPORTS_SUBS = [
  'Baseball', 'Soccer', 'Football', 'Basketball', 'Hockey',
  'Combat', 'Motorsports', 'College', 'Running', 'Rodeo',
]

/** Music subcategories */
const MUSIC_SUBS = [
  'Rock', 'Pop', 'Country', 'Hip-Hop', 'Electronic', 'Metal',
  'R&B', 'Jazz', 'Folk', 'Soul', 'Blues', 'Latin', 'Classical',
  'Alternative', 'Indie',
]

const PRICE_FILTERS = [
  { value: 'free', label: '🎟 Free' },
  { value: '25',   label: '< $25' },
  { value: '50',   label: '< $50' },
] as const

/** Time-of-day filters — match the daypart windows in fetchEvents (lib/events.ts):
 *  morning < 12 PM · afternoon 12–5 PM · evening 5 PM+ */
const DAYPARTS = [
  { value: 'morning',   label: '☀️ Morning' },
  { value: 'afternoon', label: '🌤️ Afternoon' },
  { value: 'evening',   label: '🌙 Evening' },
] as const

/** Top neighborhoods by event count (slug must match neighborhood_slug column) */
const NEIGHBORHOODS = [
  { label: 'State Fairgrounds', slug: 'state-fairgrounds-midtown' },
  { label: 'Downtown',           slug: 'downtown' },
  { label: 'Far NE / Sandias',   slug: 'far-northeast-sandia-foothills' },
  { label: 'UNM Campus',         slug: 'unm-campus' },
  { label: 'Uptown / Midtown',   slug: 'uptown-midtown' },
  { label: 'South / University', slug: 'south-i-25-university-se' },
  { label: 'North Valley',       slug: 'north-valley' },
  { label: 'Barelas',            slug: 'barelas-south-downtown' },
  { label: 'West Side',          slug: 'west-side' },
  { label: 'Old Town',           slug: 'old-town' },
]

/**
 * Vibe shortcuts — derived from the shared MOODS table in lib/moods.ts so
 * the homepage MoodChips and the FilterBar pills stay in lockstep. Round-2
 * critique #7: previously had a copy-pasted VIBES table here that drifted
 * from MOODS, leading to "Date Night" appearing in two places with
 * different filter params.
 */
const VIBES = MOODS.map(m => ({
  slug: m.slug,
  label: `${m.emoji} ${m.label}`,
  params: m.query as Record<string, string>,
}))

interface FilterBarProps {
  currentTime: string
  currentCategory: string
  currentNeighborhood: string
  currentDaypart?: string
  priceFilter?: string
  categoryCounts?: CategoryCount[]
}

/** Horizontal-scrolling row with a right-side fade hint */
function ScrollRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-hint-inner">
        {children}
      </div>
      {/* fade hint — signals more content to the right */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0.5 w-8 bg-gradient-to-l from-cream to-transparent" />
    </div>
  )
}

export function FilterBar({
  currentTime,
  currentCategory,
  currentNeighborhood,
  currentDaypart = '',
  priceFilter,
  categoryCounts = [],
}: FilterBarProps) {
  const countMap = Object.fromEntries(categoryCounts.map((c) => [c.category, c.count]))
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  // ── Optimistic filter state ─────────────────────────────────────────────────
  // These update immediately on click so buttons feel instant.
  // They're cleared when the server props catch up after navigation completes.
  const [optTime, setOptTime] = useState<string | null>(null)
  const [optCategory, setOptCategory] = useState<string | null>(null)
  const [optPrice, setOptPrice] = useState<string | null>(null)
  const [optNeighborhood, setOptNeighborhood] = useState<string | null>(null)
  const [optDaypart, setOptDaypart] = useState<string | null>(null)

  // Track previous server props so we can detect when navigation completes
  const prevTime = useRef(currentTime)
  const prevCategory = useRef(currentCategory)
  const prevPrice = useRef(priceFilter)
  const prevNeighborhood = useRef(currentNeighborhood)
  const prevDaypart = useRef(currentDaypart)

  useEffect(() => {
    if (currentTime !== prevTime.current) { prevTime.current = currentTime; setOptTime(null) }
    if (currentCategory !== prevCategory.current) { prevCategory.current = currentCategory; setOptCategory(null) }
    if (priceFilter !== prevPrice.current) { prevPrice.current = priceFilter; setOptPrice(null) }
    if (currentNeighborhood !== prevNeighborhood.current) { prevNeighborhood.current = currentNeighborhood; setOptNeighborhood(null) }
    if (currentDaypart !== prevDaypart.current) { prevDaypart.current = currentDaypart; setOptDaypart(null) }
  }, [currentTime, currentCategory, priceFilter, currentNeighborhood, currentDaypart])

  // Effective values: optimistic state takes priority while navigation is in flight
  const effectiveTime = optTime ?? currentTime
  const effectiveCategory = optCategory ?? currentCategory
  const effectivePrice = optPrice ?? priceFilter
  const effectiveNeighborhood = optNeighborhood ?? currentNeighborhood
  const effectiveDaypart = optDaypart ?? currentDaypart

  const [sportsExpanded, setSportsExpanded] = useState(currentCategory.startsWith('Sports'))
  const [musicExpanded, setMusicExpanded] = useState(currentCategory.startsWith('Music'))
  const [areaExpanded, setAreaExpanded] = useState(!!currentNeighborhood)

  const setFilter = useCallback(
    (key: string, value: string) => {
      // Optimistic update — instant visual feedback
      if (key === 'time') setOptTime(value === 'upcoming' || value === '' ? '' : value)
      if (key === 'category') setOptCategory(value)

      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (value === '' || (key === 'time' && value === 'upcoming')) {
          params.delete(key)
        } else {
          params.set(key, value)
        }
        params.delete('page')
        router.push(`/events?${params.toString()}`, { scroll: false })
      })
    },
    [router, searchParams, startTransition]
  )

  const setPrice = useCallback((value: string) => {
    // Optimistic update
    setOptPrice(effectivePrice === value ? null : value)

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (priceFilter === value) {
        params.delete('price')
      } else {
        params.set('price', value)
      }
      params.delete('free')
      params.delete('page')
      router.push(`/events?${params.toString()}`, { scroll: false })
    })
  }, [router, searchParams, priceFilter, effectivePrice, startTransition])

  const setDaypart = useCallback((value: string) => {
    // Optimistic update
    setOptDaypart(effectiveDaypart === value ? '' : value)

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (currentDaypart === value) {
        params.delete('daypart')
      } else {
        params.set('daypart', value)
      }
      params.delete('page')
      router.push(`/events?${params.toString()}`, { scroll: false })
    })
  }, [router, searchParams, currentDaypart, effectiveDaypart, startTransition])

  /** Set a vibe — replaces category/time/price with the vibe's preset */
  const setVibe = useCallback((vibeParams: Record<string, string>) => {
    // Optimistic update
    setOptCategory(vibeParams.category ?? '')
    setOptTime(vibeParams.time ?? '')
    setOptPrice(vibeParams.price ?? null)

    startTransition(() => {
      const params = new URLSearchParams()
      if (vibeParams.category) params.set('category', vibeParams.category)
      if (vibeParams.time) params.set('time', vibeParams.time)
      if (vibeParams.price) params.set('price', vibeParams.price)
      router.push(`/events?${params.toString()}`, { scroll: false })
    })
  }, [router, startTransition])

  const setNeighborhood = useCallback((slug: string) => {
    // Optimistic update
    setOptNeighborhood(slug === '' || effectiveNeighborhood === slug ? '' : slug)

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (slug === '' || currentNeighborhood === slug) {
        params.delete('neighborhood')
      } else {
        params.set('neighborhood', slug)
      }
      params.delete('page')
      router.push(`/events?${params.toString()}`, { scroll: false })
    })
  }, [router, searchParams, currentNeighborhood, effectiveNeighborhood, startTransition])

  const handleSportsClick = () => {
    if (effectiveCategory === 'Sports' || effectiveCategory.startsWith('Sports > ')) {
      setSportsExpanded(!sportsExpanded)
    } else {
      setFilter('category', 'Sports')
      setSportsExpanded(true)
    }
  }

  const handleMusicClick = () => {
    if (effectiveCategory === 'Music' || effectiveCategory.startsWith('Music > ')) {
      setMusicExpanded(!musicExpanded)
    } else {
      setFilter('category', 'Music')
      setMusicExpanded(true)
    }
  }

  // Pill style helpers
  const timePill = (isActive: boolean) =>
    `flex-none px-3.5 py-2 min-h-[36px] rounded-full text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center ${
      isActive
        ? 'bg-terra text-white'
        : 'bg-white border border-sand-mid text-ink-mid hover:border-terra hover:text-terra'
    }`

  const pricePill = (isActive: boolean) =>
    `flex-none px-3.5 py-2 min-h-[36px] rounded-full text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center ${
      isActive
        ? 'bg-sage text-white'
        : 'bg-white border border-sand-mid text-ink-mid hover:border-sage hover:text-sage'
    }`

  const daypartPill = (isActive: boolean) =>
    `flex-none px-3.5 py-2 min-h-[36px] rounded-full text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center ${
      isActive
        ? 'bg-ink text-white'
        : 'bg-white border border-sand-mid text-ink-mid hover:border-ink hover:text-ink'
    }`

  const catPill = (isActive: boolean) =>
    `flex-none px-3.5 py-2 min-h-[36px] rounded-full text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
      isActive
        ? 'bg-turq text-white'
        : 'bg-white border border-sand-mid text-ink-mid hover:border-turq hover:text-turq'
    }`

  const subPill = (isActive: boolean) =>
    `flex-none px-3 py-1.5 min-h-[34px] inline-flex items-center rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-turq/80 text-white'
        : 'bg-sand-light/60 border border-sand-mid/60 text-ink-mid hover:border-turq hover:text-turq'
    }`

  const vibePill = (isActive: boolean) =>
    `flex-none px-3 py-1.5 min-h-[34px] inline-flex items-center rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
      isActive
        ? 'bg-terra text-white border border-terra shadow-sm'
        : 'bg-white border border-sand-mid/80 text-ink-mid hover:border-terra/50 hover:text-terra hover:bg-terra/5'
    }`

  /** A vibe is "active" when ALL of its preset params currently match the URL.
   *  This gives users visual confirmation that a vibe filter is applied. */
  const isVibeActive = (vibeParams: Record<string, string>): boolean => {
    if (vibeParams.category && effectiveCategory !== vibeParams.category) return false
    if (vibeParams.time && effectiveTime !== vibeParams.time) return false
    if (vibeParams.price && effectivePrice !== vibeParams.price) return false
    // Must have at least one param matching to count as active (not just empty default)
    return !!(vibeParams.category || vibeParams.time || vibeParams.price)
  }

  // Active filter badges (use effective values for instant feedback)
  const activeTimeFilter = TIME_FILTERS.find(f => f.value === effectiveTime && effectiveTime && effectiveTime !== 'upcoming')
  const activePriceFilter = PRICE_FILTERS.find(f => f.value === effectivePrice)
  const activeNeighborhood = NEIGHBORHOODS.find(n => n.slug === effectiveNeighborhood)
  const activeDaypart = DAYPARTS.find(d => d.value === effectiveDaypart)
  const hasActiveFilters = !!(activeTimeFilter || effectiveCategory || activePriceFilter || activeNeighborhood || activeDaypart)

  const clearCategory = () => { setOptCategory(''); setFilter('category', ''); setSportsExpanded(false); setMusicExpanded(false) }
  const clearPrice = () => {
    setOptPrice(null)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('price'); params.delete('free'); params.delete('page')
      router.push(`/events?${params.toString()}`, { scroll: false })
    })
  }
  const clearNeighborhood = () => { setOptNeighborhood(''); setNeighborhood(''); setAreaExpanded(false) }
  const clearDaypart = () => {
    setOptDaypart('')
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('daypart'); params.delete('page')
      router.push(`/events?${params.toString()}`, { scroll: false })
    })
  }
  const clearAll = () => {
    setOptTime(''); setOptCategory(''); setOptPrice(null); setOptNeighborhood(''); setOptDaypart('')
    setSportsExpanded(false); setMusicExpanded(false); setAreaExpanded(false)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('time'); params.delete('category'); params.delete('price')
      params.delete('free'); params.delete('neighborhood'); params.delete('daypart'); params.delete('page')
      router.push(`/events?${params.toString()}`, { scroll: false })
    })
  }

  const activeCount = [activeTimeFilter, effectiveCategory, activePriceFilter, activeNeighborhood, activeDaypart].filter(Boolean).length

  return (
    <div className="space-y-2">

      {/* ── Active filter badges — always visible above scroll rows ── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 animate-fade-in">
          {activeTimeFilter && (
            <button
              onClick={() => { setOptTime(''); startTransition(() => setFilter('time', 'upcoming')) }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-terra text-white shadow-sm hover:bg-terra-hover transition-colors"
            >
              {activeTimeFilter.label}
              <X className="w-3 h-3 opacity-80" />
            </button>
          )}
          {effectiveCategory && (
            <button
              onClick={clearCategory}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-turq text-white shadow-sm hover:bg-[#004d47] transition-colors"
            >
              {effectiveCategory.replace(' > ', ' › ')}
              <X className="w-3 h-3 opacity-80" />
            </button>
          )}
          {activePriceFilter && (
            <button
              onClick={clearPrice}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sage text-white shadow-sm hover:bg-[#3d4d39] transition-colors"
            >
              {activePriceFilter.label}
              <X className="w-3 h-3 opacity-80" />
            </button>
          )}
          {activeNeighborhood && (
            <button
              onClick={clearNeighborhood}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-terra/70 text-white shadow-sm hover:bg-terra transition-colors"
            >
              <MapPin className="w-3 h-3" />
              {activeNeighborhood.label}
              <X className="w-3 h-3 opacity-80" />
            </button>
          )}
          {activeDaypart && (
            <button
              onClick={clearDaypart}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-ink text-white shadow-sm hover:bg-ink-mid transition-colors"
            >
              {activeDaypart.label}
              <X className="w-3 h-3 opacity-80" />
            </button>
          )}
          {activeCount > 1 && (
            <button
              onClick={clearAll}
              className="px-2.5 py-1 rounded-full text-xs font-medium text-ink-light border border-sand-mid hover:text-terra hover:border-terra transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Row 1: Time + Price */}
      <ScrollRow>
        {TIME_FILTERS.map(({ value, label }) => {
          const isActive = effectiveTime === value || (value === 'upcoming' && !effectiveTime)
          return (
            <button key={value} onClick={() => setFilter('time', value)} className={timePill(isActive)}>
              {label}
            </button>
          )
        })}

        {/* Divider */}
        <div className="flex-none self-center w-px h-4 bg-sand-mid mx-0.5" />

        {PRICE_FILTERS.map(({ value, label }) => (
          <button key={value} onClick={() => setPrice(value)} className={pricePill(effectivePrice === value)}>
            {label}
          </button>
        ))}

        {/* Divider */}
        <div className="flex-none self-center w-px h-4 bg-sand-mid mx-0.5" />

        {/* Time-of-day */}
        {DAYPARTS.map(({ value, label }) => (
          <button key={value} onClick={() => setDaypart(value)} className={daypartPill(effectiveDaypart === value)}>
            {label}
          </button>
        ))}

        <div className="flex-none w-6" />
      </ScrollRow>

      {/* Row 2: Categories + Area toggle */}
      <ScrollRow>
        <button
          onClick={() => { setOptCategory(''); setFilter('category', ''); setSportsExpanded(false); setMusicExpanded(false) }}
          className={catPill(!effectiveCategory && !effectiveNeighborhood)}
        >
          All
        </button>

        {CATEGORIES.map((cat) => {
          const isSports = cat === 'Sports'
          const isMusic  = cat === 'Music'
          const isActive = isSports
            ? effectiveCategory === 'Sports' || effectiveCategory.startsWith('Sports > ')
            : isMusic
            ? effectiveCategory === 'Music' || effectiveCategory.startsWith('Music > ')
            : effectiveCategory === cat
          const count = countMap[cat]

          const handleClick = () => {
            if (isSports) return handleSportsClick()
            if (isMusic) return handleMusicClick()
            setFilter('category', cat)
          }

          return (
            <button key={cat} onClick={handleClick} className={catPill(isActive)}>
              {cat}
              {count != null && (
                <span className={`tabular-nums text-[9px] ${isActive ? 'opacity-80' : 'opacity-40'}`}>
                  {count}
                </span>
              )}
              {isSports && (sportsExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />)}
              {isMusic  && (musicExpanded  ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />)}
            </button>
          )
        })}

        {/* Area (neighborhood) expandable chip */}
        <button
          onClick={() => setAreaExpanded(!areaExpanded)}
          className={catPill(!!effectiveNeighborhood)}
        >
          <MapPin className="w-3 h-3" />
          {effectiveNeighborhood
            ? (NEIGHBORHOODS.find(n => n.slug === effectiveNeighborhood)?.label ?? 'Area')
            : 'Area'}
          {areaExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
        </button>

        <div className="flex-none w-6" />
      </ScrollRow>

      {/* Row 3 (conditional): Music subcategories */}
      {musicExpanded && (
        <ScrollRow className="animate-fade-in">
          <button onClick={() => setFilter('category', 'Music')} className={subPill(effectiveCategory === 'Music')}>
            All Music
          </button>
          {MUSIC_SUBS.map((sub) => (
            <button
              key={sub}
              onClick={() => setFilter('category', `Music > ${sub}`)}
              className={subPill(effectiveCategory === `Music > ${sub}`)}
            >
              {sub}
            </button>
          ))}
          <div className="flex-none w-6" />
        </ScrollRow>
      )}

      {/* Row 3 (conditional): Sports subcategories */}
      {sportsExpanded && (
        <ScrollRow className="animate-fade-in">
          <button onClick={() => setFilter('category', 'Sports')} className={subPill(effectiveCategory === 'Sports')}>
            All Sports
          </button>
          {SPORTS_SUBS.map((sub) => (
            <button
              key={sub}
              onClick={() => setFilter('category', `Sports > ${sub}`)}
              className={subPill(effectiveCategory === `Sports > ${sub}`)}
            >
              {sub}
            </button>
          ))}
          <div className="flex-none w-6" />
        </ScrollRow>
      )}

      {/* Row 4 (conditional): Neighborhood chips */}
      {areaExpanded && (
        <ScrollRow className="animate-fade-in">
          {NEIGHBORHOODS.map((n) => (
            <button
              key={n.slug}
              onClick={() => setNeighborhood(n.slug)}
              className={subPill(effectiveNeighborhood === n.slug)}
            >
              {n.label}
            </button>
          ))}
          <div className="flex-none w-6" />
        </ScrollRow>
      )}

      {/* Vibe row — compact discovery shortcuts, always visible */}
      <ScrollRow>
        <span className="flex-none self-center text-[9px] uppercase tracking-[0.12em] text-ink-light font-semibold pr-0.5 pl-0.5 whitespace-nowrap">
          Vibe
        </span>
        {VIBES.map((v) => {
          const active = isVibeActive(v.params as Record<string, string>)
          return (
            <button
              key={v.slug}
              onClick={() => setVibe(v.params as Record<string, string>)}
              className={vibePill(active)}
              aria-pressed={active}
            >
              {v.label}
            </button>
          )
        })}
        <div className="flex-none w-6" />
      </ScrollRow>

    </div>
  )
}
