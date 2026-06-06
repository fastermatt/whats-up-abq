'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentQuery = searchParams.get('q') ?? ''
  const [value, setValue] = useState(currentQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external changes (e.g. back/forward navigation)
  useEffect(() => {
    setValue(searchParams.get('q') ?? '')
  }, [searchParams])

  const updateQuery = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (q.trim()) {
        params.set('q', q.trim())
      } else {
        params.delete('q')
      }
      params.delete('page') // reset pagination on new search
      router.push(`/events?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateQuery(newValue), 300)
  }

  const handleClear = () => {
    setValue('')
    updateQuery('')
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-light" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search events, venues, artists..."
        className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white border border-sand-border text-sm text-ink placeholder:text-ink-light focus-visible:outline-none focus:border-terra focus-visible:ring-1 focus-visible:ring-terra/30 transition-colors"
        style={{ fontFamily: 'var(--font-inter)' }}
      />
      {value && (
        <button
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-light hover:text-ink transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
