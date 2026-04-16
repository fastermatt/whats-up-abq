'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'

interface Props {
  search: string
  source: string
  catFilter: string
  showHidden: boolean
  showFeatured: boolean
  sources: string[]
  categories: string[]
}

export function EventsFilterForm({ search, source, catFilter, showHidden, showFeatured, sources, categories }: Props) {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)

  function buildUrl(overrides: Record<string, string>) {
    const p: Record<string, string> = {
      q: search,
      source,
      cat: catFilter,
      ...(showHidden ? { hidden: '1' } : {}),
      ...(showFeatured ? { featured: '1' } : {}),
      ...overrides,
    }
    const qs = Object.entries(p)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')
    return `/admin/events${qs ? `?${qs}` : ''}`
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const val = searchRef.current?.value ?? ''
    router.push(buildUrl({ q: val, page: '' }))
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-3 flex-wrap items-center">
      <input
        ref={searchRef}
        type="text"
        placeholder="Search events…"
        defaultValue={search}
        className="bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#9a442d] w-56"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-white/10 text-white/70 rounded-xl text-sm hover:bg-white/15 transition-colors"
      >
        Search
      </button>

      <select
        value={source}
        className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#9a442d] cursor-pointer"
        onChange={e => router.push(buildUrl({ source: e.target.value, page: '' }))}
      >
        {sources.map(s => (
          <option key={s} value={s} className="bg-[#1a1614]">{s || 'All sources'}</option>
        ))}
      </select>

      <select
        value={catFilter}
        className="bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#9a442d] cursor-pointer"
        onChange={e => router.push(buildUrl({ cat: e.target.value, page: '' }))}
      >
        {categories.map(c => (
          <option key={c} value={c} className="bg-[#1a1614]">{c || 'All categories'}</option>
        ))}
      </select>

      {(search || source || catFilter) && (
        <button
          type="button"
          onClick={() => router.push('/admin/events')}
          className="text-xs text-white/40 hover:text-white transition-colors"
        >
          Clear filters ×
        </button>
      )}
    </form>
  )
}
