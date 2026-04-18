'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ChevronDown, ChevronUp, X, MapPin } from 'lucide-react'
import Link from 'next/link'
import type { CategoryCount } from '@/lib/events'

const TIME_FILTERS = [
  { value: 'today',        label: 'Today' },
  { value: 'tonight',      label: 'Tonight' },
  { value: 'tomorrow',     label: 'Tomorrow' },
  { value: 'this-weekend', label: 'Weekend' },
  { value: 'this-week',    label: 'This Week' },
  { value: 'upcoming',     label: 'All' },
] as const

/** Top-level categories. Sports has expandable subcategories. */
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

/** Sports subcategories per the strategy doc taxonomy */
const SPORTS_SUBS = [
  'Baseball',
  'Soccer',
  'Football',
  'Basketball',
  'Hockey',
  'Combat',
  'Motorsports',
  'College',
  'Running',
  'Rodeo',
]

/** Music subcategories (from Gemma enrichment + TM genre data) */
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

interface FilterBarProps {
  currentTime: string
  currentCategory: string
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
      <div className="pointer-events-none absolute right-0 top-0 bottom-0.5 w-8 bg-gradient-to-l from-[#fbf7f1] to-transparent" />
    </div>
  )
}

export function FilterBar({ currentTime, currentCategory, priceFilter, categoryCounts = [] }: FilterBarProps) {
  const countMap = Object.fromEntries(categoryCounts.map((c) => [c.category, c.count]))
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sportsExpanded, setSportsExpanded] = useState(currentCategory.startsWith('Sports'))
  const [musicExpanded, setMusicExpanded] = useState(currentCategory.startsWith('Music'))

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === '' || (key === 'time' && value === 'upcoming')) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      params.delete('page')
      router.push(`/events?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const setPrice = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (priceFilter === value) {
      params.delete('price')
    } else {
      params.set('price', value)
    }
    params.delete('free')
    params.delete('page')
    router.push(`/events?${params.toString()}`, { scroll: false })
  }, [router, searchParams, priceFilter])

  const handleSportsClick = () => {
    if (currentCategory === 'Sports' || currentCategory.startsWith('Sports > ')) {
      setSportsExpanded(!sportsExpanded)
    } else {
      setFilter('category', 'Sports')
      setSportsExpanded(true)
    }
  }

  // Pill style helpers
  const timePill = (isActive: boolean) =>
    `flex-none px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-[#9a442d] text-white'
        : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d]'
    }`

  const pricePill = (isActive: boolean) =>
    `flex-none px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-[#4f6249] text-white'
        : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#4f6249] hover:text-[#4f6249]'
    }`

  const catPill = (isActive: boolean) =>
    `flex-none px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
      isActive
        ? 'bg-[#006a62] text-white'
        : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
    }`

  const subPill = (isActive: boolean) =>
    `flex-none px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-[#006a62]/80 text-white'
        : 'bg-[#f0e4cc]/60 border border-[#ddc9a3]/60 text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
    }`

  // Derive active labels for the pinned badge row
  const activeTimeFilter = TIME_FILTERS.find(f => f.value === currentTime && currentTime && currentTime !== 'upcoming')
  const activePriceFilter = PRICE_FILTERS.find(f => f.value === priceFilter)
  const hasActiveFilters = !!(activeTimeFilter || currentCategory || activePriceFilter)

  const clearCategory = () => { setFilter('category', ''); setSportsExpanded(false); setMusicExpanded(false) }
  const clearPrice = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('price'); params.delete('free'); params.delete('page')
    router.push(`/events?${params.toString()}`, { scroll: false })
  }
  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('time'); params.delete('category'); params.delete('price'); params.delete('free'); params.delete('page')
    setSportsExpanded(false); setMusicExpanded(false)
    router.push(`/events?${params.toString()}`, { scroll: false })
  }

  const activeCount = [activeTimeFilter, currentCategory, activePriceFilter].filter(Boolean).length

  return (
    <div className="space-y-2">

      {/* ── Active filter badges — always visible above scroll rows ── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 animate-fade-in">
          {activeTimeFilter && (
            <button
              onClick={() => setFilter('time', 'upcoming')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#9a442d] text-white shadow-sm hover:bg-[#7d3725] transition-colors"
            >
              {activeTimeFilter.label}
              <X className="w-3 h-3 opacity-80" />
            </button>
          )}
          {currentCategory && (
            <button
              onClick={clearCategory}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#006a62] text-white shadow-sm hover:bg-[#004d47] transition-colors"
            >
              {currentCategory.replace(' > ', ' › ')}
              <X className="w-3 h-3 opacity-80" />
            </button>
          )}
          {activePriceFilter && (
            <button
              onClick={clearPrice}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#4f6249] text-white shadow-sm hover:bg-[#3d4d39] transition-colors"
            >
              {activePriceFilter.label}
              <X className="w-3 h-3 opacity-80" />
            </button>
          )}
          {activeCount > 1 && (
            <button
              onClick={clearAll}
              className="px-2.5 py-1 rounded-full text-xs font-medium text-[#8a7a74] border border-[#ddc9a3] hover:text-[#9a442d] hover:border-[#9a442d] transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Row 1: Time + Price — single scrollable strip */}
      <ScrollRow>
        {TIME_FILTERS.map(({ value, label }) => {
          const isActive = currentTime === value || (value === 'upcoming' && !currentTime)
          return (
            <button key={value} onClick={() => setFilter('time', value)} className={timePill(isActive)}>
              {label}
            </button>
          )
        })}

        {/* Divider */}
        <div className="flex-none self-center w-px h-4 bg-[#ddc9a3] mx-0.5" />

        {PRICE_FILTERS.map(({ value, label }) => (
          <button key={value} onClick={() => setPrice(value)} className={pricePill(priceFilter === value)}>
            {label}
          </button>
        ))}

        {/* Spacer so last item clears the fade */}
        <div className="flex-none w-6" />
      </ScrollRow>

      {/* Row 2: Categories — single scrollable strip */}
      <ScrollRow>
        <button
          onClick={() => { setFilter('category', ''); setSportsExpanded(false); setMusicExpanded(false) }}
          className={catPill(!currentCategory)}
        >
          All
        </button>

        {CATEGORIES.map((cat) => {
          const isSports = cat === 'Sports'
          const isMusic  = cat === 'Music'
          const isActive = isSports
            ? currentCategory === 'Sports' || currentCategory.startsWith('Sports > ')
            : isMusic
            ? currentCategory === 'Music' || currentCategory.startsWith('Music > ')
            : currentCategory === cat
          const count = countMap[cat]

          const handleClick = () => {
            if (isSports) return handleSportsClick()
            if (isMusic) {
              if (currentCategory === 'Music' || currentCategory.startsWith('Music > ')) {
                setMusicExpanded(!musicExpanded)
              } else {
                setFilter('category', 'Music')
                setMusicExpanded(true)
              }
              return
            }
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

        {/* Neighborhood link — opens /neighborhoods directory */}
        <Link
          href="/neighborhoods"
          className="flex-none px-3 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1 bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d]"
        >
          <MapPin className="w-3 h-3" />
          By Neighborhood
        </Link>

        <div className="flex-none w-6" />
      </ScrollRow>

      {/* Row 3 (conditional): Music subcategories */}
      {musicExpanded && (
        <ScrollRow className="animate-fade-in">
          <button onClick={() => setFilter('category', 'Music')} className={subPill(currentCategory === 'Music')}>
            All Music
          </button>
          {MUSIC_SUBS.map((sub) => (
            <button
              key={sub}
              onClick={() => setFilter('category', `Music > ${sub}`)}
              className={subPill(currentCategory === `Music > ${sub}`)}
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
          <button onClick={() => setFilter('category', 'Sports')} className={subPill(currentCategory === 'Sports')}>
            All Sports
          </button>
          {SPORTS_SUBS.map((sub) => (
            <button
              key={sub}
              onClick={() => setFilter('category', `Sports > ${sub}`)}
              className={subPill(currentCategory === `Sports > ${sub}`)}
            >
              {sub}
            </button>
          ))}
          <div className="flex-none w-6" />
        </ScrollRow>
      )}
    </div>
  )
}
