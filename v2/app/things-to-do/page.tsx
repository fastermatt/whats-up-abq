import Link from 'next/link'
import type { Metadata } from 'next'
import { ExternalLink, MapPin, ArrowLeft, ArrowRight } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'
import {
  PLACES,
  PLACE_CATEGORIES,
  getPlaces,
  type Place,
  type PlaceCategory,
} from '@/data/places'

export const metadata: Metadata = {
  title: 'Things To Do in Albuquerque | ABQ Unplugged',
  description:
    'Explore the best things to do in Albuquerque — outdoor adventures, skate parks, public pools, arts & culture, local food & drink, and historic sites. Direct links to every venue.',
  openGraph: {
    title: 'Things To Do in Albuquerque',
    description:
      'The best outdoor adventures, arts, breweries, museums, skate parks, pools, and experiences in ABQ — all linking straight to the source.',
    url: 'https://abqunplugged.com/things-to-do',
  },
  alternates: { canonical: 'https://abqunplugged.com/things-to-do' },
}

// searchParams is a Promise in Next.js 15 — must be awaited
export default async function ThingsToDoPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const activeCategory = (category as PlaceCategory) || null
  const places = getPlaces(activeCategory)
  const freeCount = places.filter(p => p.free).length

  return (
    <main id="main" className="min-h-dvh bg-[#fbf7f1]">

      {/* ── Header ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#3d1a0e] via-[#7d3725] to-[#a0522d] text-white">
        <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41IiBmaWxsPSIjZmZmIi8+PC9zdmc+')]" />
        <div className="max-w-6xl mx-auto px-4 pt-5 pb-6 relative">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs mb-4 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back
          </Link>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#f5c9a0] mb-1.5 font-semibold">
            Albuquerque
          </p>
          <h1
            className="text-2xl sm:text-3xl font-black leading-tight mb-1.5"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Things To Do
          </h1>
          <p className="text-xs text-white/60 max-w-lg">
            The best of ABQ — outdoor adventures, arts, local breweries, family activities,
            skate parks, pools, and historic sites. Every link goes straight to the venue.
          </p>
          <div className="flex gap-4 mt-4 text-xs">
            <span className="text-white/50"><span className="text-white font-bold">{PLACES.length}</span> places</span>
            <span className="text-white/50"><span className="text-white font-bold">{PLACE_CATEGORIES.filter(c => PLACES.some(p => p.category === c.slug)).length}</span> categories</span>
            <span className="text-white/50"><span className="text-white font-bold">{PLACES.filter(p => p.free).length}</span> free</span>
          </div>
        </div>
      </section>

      {/* ── Sticky category filter ── */}
      <div className="sticky top-0 md:top-14 z-30 bg-[#fbf7f1]/95 backdrop-blur-sm border-b border-[#f0e4cc]">
        <div
          className="flex gap-1.5 overflow-x-auto px-4 py-2.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* All */}
          <Link
            href="/things-to-do"
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
              !activeCategory
                ? 'bg-[#006a62] text-white shadow-sm'
                : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
            }`}
          >
            All
            <span className={`text-[10px] ${!activeCategory ? 'opacity-70' : 'opacity-50'}`}>
              {PLACES.length}
            </span>
          </Link>

          {PLACE_CATEGORIES.filter(cat => PLACES.some(p => p.category === cat.slug)).map(cat => {
            const count = PLACES.filter(p => p.category === cat.slug).length
            const isActive = activeCategory === cat.slug
            return (
              <Link
                key={cat.slug}
                href={isActive ? '/things-to-do' : `/things-to-do?category=${cat.slug}`}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#006a62] text-white shadow-sm'
                    : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
                }`}
              >
                <span>{cat.emoji}</span>
                {cat.label}
                <span className={`text-[10px] ${isActive ? 'opacity-70' : 'opacity-50'}`}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Grid ── */}
      <section className="max-w-6xl mx-auto px-4 py-6">
        {activeCategory && (
          <p className="text-xs text-[#8a7a74] mb-4">
            {PLACE_CATEGORIES.find(c => c.slug === activeCategory)?.emoji}{' '}
            <span className="font-semibold text-[#1a1614]">
              {PLACE_CATEGORIES.find(c => c.slug === activeCategory)?.label}
            </span>
            {' '}·{' '}{places.length} place{places.length !== 1 ? 's' : ''}
            {freeCount > 0 && (
              <span className="text-[#006a62] ml-1">· {freeCount} free</span>
            )}
          </p>
        )}

        {/* Smaller cards: 2→3→4→5 columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {places.map((place, i) => (
            <AnimateIn key={place.id} animation="fade-up" delay={Math.min(i * 30, 240)}>
              <PlaceCard place={place} />
            </AnimateIn>
          ))}
        </div>

        {places.length === 0 && (
          <div className="text-center py-16 text-[#8a7a74]">
            <p className="text-base font-semibold mb-1">Nothing here yet</p>
            <Link href="/things-to-do" className="text-sm text-[#006a62] hover:underline">
              View all places
            </Link>
          </div>
        )}
      </section>

      {/* ── Events CTA ── */}
      <section className="max-w-6xl mx-auto px-4 pb-10">
        <div className="rounded-2xl bg-gradient-to-r from-[#f5ece3] to-[#fbf7f1] border border-[#e8d5c0] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#9a442d] mb-0.5 font-semibold">
              Looking for something tonight?
            </p>
            <p className="text-base font-black text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Check the event calendar
            </p>
            <p className="text-xs text-[#8a7a74] mt-0.5">
              Concerts, shows, sports — updated daily
            </p>
          </div>
          <Link
            href="/events"
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#9a442d] text-white text-sm font-semibold hover:bg-[#7d3725] transition-colors"
          >
            Browse Events
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </main>
  )
}

// ─── Place Card ──────────────────────────────────────────────────────────────

function PlaceCard({ place }: { place: Place }) {
  const catMeta = PLACE_CATEGORIES.find(c => c.slug === place.category)

  return (
    <a
      href={place.website}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl overflow-hidden bg-white border border-[#f0e4cc] hover:border-[#006a62]/40 hover:shadow-md transition-all duration-300 h-full"
    >
      {/* Image or emoji fallback */}
      <div className="relative aspect-[4/3] overflow-hidden flex-shrink-0">
        {place.image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={place.image}
              alt={place.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              loading="lazy"
            />
            {/* Subtle overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
          </>
        ) : (
          /* Emoji + category color gradient — intentional, never misleading */
          <div
            className={`w-full h-full bg-gradient-to-br ${catMeta?.gradientFrom} ${catMeta?.gradientTo} flex items-center justify-center`}
          >
            <span className="text-4xl opacity-80 group-hover:scale-110 transition-transform duration-300">
              {catMeta?.emoji}
            </span>
          </div>
        )}

        {/* Free badge */}
        {place.free && (
          <div className="absolute top-1.5 right-1.5 bg-[#006a62] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
            Free
          </div>
        )}

        {/* External link on hover */}
        <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-white/95 rounded-full p-1 shadow-sm">
            <ExternalLink className="w-2.5 h-2.5 text-[#006a62]" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-2.5 flex flex-col flex-1">
        {/* Category label */}
        <p className="text-[9px] font-bold uppercase tracking-wider text-[#8a7a74] mb-0.5">
          {catMeta?.emoji} {catMeta?.label}
        </p>

        <h3
          className="font-bold text-[#1a1614] text-xs leading-snug mb-0.5 group-hover:text-[#006a62] transition-colors line-clamp-2"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          {place.name}
        </h3>

        <p className="text-[10px] text-[#8a7a74] line-clamp-2 flex-1">
          {place.tagline}
        </p>

        {/* Neighborhood */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#f5eee4]">
          <span className="flex items-center gap-0.5 text-[9px] text-[#8a7a74] truncate">
            <MapPin className="w-2 h-2 flex-shrink-0" />
            {place.neighborhood}
          </span>
          <ExternalLink className="w-2.5 h-2.5 text-[#006a62] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      </div>
    </a>
  )
}
