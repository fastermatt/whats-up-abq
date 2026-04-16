'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CategoryCount } from '@/lib/events'

const TIME_FILTERS = [
  { value: 'today',        label: 'Today' },
  { value: 'tonight',      label: 'Tonight' },
  { value: 'tomorrow',     label: 'Tomorrow' },
  { value: 'this-weekend', label: 'This Weekend' },
  { value: 'this-week',    label: 'This Week' },
  { value: 'upcoming',     label: 'All Upcoming' },
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

interface FilterBarProps {
  currentTime: string
  currentCategory: string
  priceFilter?: string   // 'free' | '25' | '50' | undefined
  categoryCounts?: CategoryCount[]
}

const PRICE_FILTERS = [
  { value: 'free', label: 'Free' },
  { value: '25',   label: 'Under $25' },
  { value: '50',   label: 'Under $50' },
] as const

export function FilterBar({ currentTime, currentCategory, priceFilter, categoryCounts = [] }: FilterBarProps) {
  const countMap = Object.fromEntries(categoryCounts.map((c) => [c.category, c.count]))
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sportsExpanded, setSportsExpanded] = useState(
    currentCategory.startsWith('Sports')
  )
  const [musicExpanded, setMusicExpanded] = useState(
    currentCategory.startsWith('Music')
  )

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === '' || (key === 'time' && value === 'upcoming')) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      params.delete('page') // reset pagination
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
    params.delete('free') // remove legacy free param
    params.delete('page')
    router.push(`/events?${params.toString()}`, { scroll: false })
  }, [router, searchParams, priceFilter])

  const handleSportsClick = () => {
    if (currentCategory === 'Sports' || currentCategory.startsWith('Sports > ')) {
      // Already on Sports — toggle subcategories or clear
      setSportsExpanded(!sportsExpanded)
    } else {
      // Switch to Sports category
      setFilter('category', 'Sports')
      setSportsExpanded(true)
    }
  }

  return (
    <div className="space-y-3">
      {/* Time filter pills */}
      <div className="flex flex-wrap gap-2">
        {TIME_FILTERS.map(({ value, label }) => {
          const isActive = currentTime === value || (value === 'upcoming' && !currentTime)
          return (
            <button
              key={value}
              onClick={() => setFilter('time', value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#9a442d] text-white'
                  : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d]'
              }`}
            >
              {label}
            </button>
          )
        })}
        {/* Price filter chips */}
        {PRICE_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPrice(value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              priceFilter === value
                ? 'bg-[#4f6249] text-white'
                : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#4f6249] hover:text-[#4f6249]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setFilter('category', ''); setSportsExpanded(false) }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !currentCategory
              ? 'bg-[#006a62] text-white'
              : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => {
          const isSports = cat === 'Sports'
          const isMusic = cat === 'Music'
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
            <button
              key={cat}
              onClick={handleClick}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1 ${
                isActive
                  ? 'bg-[#006a62] text-white'
                  : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
              }`}
            >
              {cat}
              {count != null && (
                <span className={`text-[10px] tabular-nums ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                  {count}
                </span>
              )}
              {isSports && (sportsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              {isMusic && (musicExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
          )
        })}
      </div>

      {/* Music subcategory chips — expandable */}
      {musicExpanded && (
        <div className="flex flex-wrap gap-1.5 pl-2 animate-fade-in">
          <button
            onClick={() => setFilter('category', 'Music')}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              currentCategory === 'Music'
                ? 'bg-[#006a62]/80 text-white'
                : 'bg-[#f0e4cc]/60 border border-[#ddc9a3]/60 text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
            }`}
          >
            All Music
          </button>
          {MUSIC_SUBS.map((sub) => {
            const filterValue = `Music > ${sub}`
            const isActive = currentCategory === filterValue
            return (
              <button
                key={sub}
                onClick={() => setFilter('category', filterValue)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'bg-[#006a62]/80 text-white'
                    : 'bg-[#f0e4cc]/60 border border-[#ddc9a3]/60 text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
                }`}
              >
                {sub}
              </button>
            )
          })}
        </div>
      )}

      {/* Sports subcategory chips — expandable */}
      {sportsExpanded && (
        <div className="flex flex-wrap gap-1.5 pl-2 animate-fade-in">
          <button
            onClick={() => setFilter('category', 'Sports')}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              currentCategory === 'Sports'
                ? 'bg-[#006a62]/80 text-white'
                : 'bg-[#f0e4cc]/60 border border-[#ddc9a3]/60 text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
            }`}
          >
            All Sports
          </button>
          {SPORTS_SUBS.map((sub) => {
            const filterValue = `Sports > ${sub}`
            const isActive = currentCategory === filterValue
            return (
              <button
                key={sub}
                onClick={() => setFilter('category', filterValue)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'bg-[#006a62]/80 text-white'
                    : 'bg-[#f0e4cc]/60 border border-[#ddc9a3]/60 text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
                }`}
              >
                {sub}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
