'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const TIME_FILTERS = [
  { value: 'today',        label: 'Today' },
  { value: 'tonight',      label: 'Tonight' },
  { value: 'tomorrow',     label: 'Tomorrow' },
  { value: 'this-weekend', label: 'This Weekend' },
  { value: 'this-week',    label: 'This Week' },
  { value: 'upcoming',     label: 'All Upcoming' },
] as const

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

interface FilterBarProps {
  currentTime: string
  currentCategory: string
}

export function FilterBar({ currentTime, currentCategory }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

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
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('category', '')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !currentCategory
              ? 'bg-[#006a62] text-white'
              : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => {
          const isActive = currentCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setFilter('category', cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#006a62] text-white'
                  : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
              }`}
            >
              {cat}
            </button>
          )
        })}
      </div>
    </div>
  )
}
