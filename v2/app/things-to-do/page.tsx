import Link from 'next/link'
import type { Metadata } from 'next'
import { ExternalLink, MapPin, ArrowLeft } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'
import { getCategoryFallback } from '@/lib/fallback-images'
import {
  PLACES,
  PLACE_CATEGORIES,
  getPlaces,
  placeFallbackCategory,
  type Place,
  type PlaceCategory,
} from '@/data/places'

export const metadata: Metadata = {
  title: 'Things To Do in Albuquerque | ABQ Unplugged',
  description:
    'Explore the best things to do in Albuquerque — outdoor adventures, arts & culture, local food & drink, family activities, and historic sites. Direct links to every venue.',
  openGraph: {
    title: 'Things To Do in Albuquerque',
    description:
      'The best outdoor adventures, arts, breweries, museums, and experiences in ABQ — all linking straight to the source.',
    url: 'https://abqunplugged.com/things-to-do',
  },
  alternates: { canonical: 'https://abqunplugged.com/things-to-do' },
}

export default function ThingsToDoPage({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const activeCategory = (searchParams.category as PlaceCategory) || null
  const places = getPlaces(activeCategory)

  return (
    <main id="main" className="min-h-dvh bg-[#fbf7f1]">

      {/* ── Header ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#006a62] via-[#004d47] to-[#003a35] text-white">
        {/* Dot texture */}
        <div className="absolute inset-0 opacity-[0.06] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41IiBmaWxsPSIjZmZmIi8+PC9zdmc+')]" />

        <div className="max-w-6xl mx-auto px-4 pt-6 pb-8 relative">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs mb-5 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Discover
          </Link>

          <p className="text-[11px] uppercase tracking-[0.2em] text-[#7ecfc9] mb-2 font-semibold">
            Albuquerque
          </p>
          <h1
            className="text-3xl sm:text-4xl font-black leading-tight mb-2"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Things To Do
          </h1>
          <p className="text-sm text-white/60 max-w-lg">
            The best of ABQ — outdoor adventures, arts, local breweries, family activities,
            and historic sites. Every link goes straight to the venue.
          </p>

          {/* Stats */}
          <div className="flex gap-4 mt-5 text-sm">
            <span className="text-white/50">
              <span className="text-white font-bold">{PLACES.length}</span> places
            </span>
            <span className="text-white/50">
              <span className="text-white font-bold">{PLACE_CATEGORIES.length}</span> categories
            </span>
            <span className="text-white/50">
              <span className="text-white font-bold">{PLACES.filter(p => p.free).length}</span> free
            </span>
          </div>
        </div>
      </section>

      {/* ── Category filter chips ── */}
      <div className="sticky top-0 md:top-14 z-30 bg-[#fbf7f1]/95 backdrop-blur-sm border-b border-[#f0e4cc]">
        <div
          className="flex gap-2 overflow-x-auto px-4 py-3"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <Link
            href="/things-to-do"
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              !activeCategory
                ? 'bg-[#006a62] text-white shadow-sm'
                : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
            }`}
          >
            All
            <span className="text-[10px] opacity-60">{PLACES.length}</span>
          </Link>

          {PLACE_CATEGORIES.map(cat => {
            const count = PLACES.filter(p => p.category === cat.slug).length
            const isActive = activeCategory === cat.slug
            return (
              <Link
                key={cat.slug}
                href={isActive ? '/things-to-do' : `/things-to-do?category=${cat.slug}`}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#006a62] text-white shadow-sm'
                    : 'bg-white border border-[#ddc9a3] text-[#4a3f3a] hover:border-[#006a62] hover:text-[#006a62]'
                }`}
              >
                <span>{cat.emoji}</span>
                {cat.label}
                <span className="text-[10px] opacity-60">{count}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Grid ── */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        {activeCategory && (
          <div className="mb-6">
            <p className="text-sm text-[#8a7a74]">
              Showing{' '}
              <span className="font-semibold text-[#1a1614]">
                {PLACE_CATEGORIES.find(c => c.slug === activeCategory)?.emoji}{' '}
                {PLACE_CATEGORIES.find(c => c.slug === activeCategory)?.label}
              </span>
              {' '}· {places.length} place{places.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {places.map((place, i) => (
            <AnimateIn
              key={place.id}
              animation="fade-up"
              delay={Math.min(i * 40, 300)}
            >
              <PlaceCard place={place} />
            </AnimateIn>
          ))}
        </div>

        {places.length === 0 && (
          <div className="text-center py-16 text-[#8a7a74]">
            <p className="text-lg font-semibold mb-1">No places in this category yet</p>
            <p className="text-sm">Try another category or{' '}
              <Link href="/things-to-do" className="text-[#006a62] hover:underline">
                view all
              </Link>
            </p>
          </div>
        )}
      </section>

      {/* ── Browse events CTA ── */}
      <section className="max-w-6xl mx-auto px-4 pb-10">
        <div className="rounded-2xl bg-gradient-to-r from-[#f5ece3] to-[#fbf7f1] border border-[#e8d5c0] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.15em] text-[#9a442d] mb-0.5 font-semibold"
            >
              Looking for something tonight?
            </p>
            <p
              className="text-lg font-black text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Check the event calendar
            </p>
            <p className="text-xs text-[#8a7a74] mt-0.5">
              Live events, concerts, shows, sports — all in one place
            </p>
          </div>
          <Link
            href="/events"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9a442d] text-white text-sm font-semibold hover:bg-[#7d3725] transition-colors"
          >
            Browse Events
          </Link>
        </div>
      </section>
    </main>
  )
}

// ─── Place Card ──────────────────────────────────────────────────────────────

function PlaceCard({ place }: { place: Place }) {
  const imgSrc =
    place.image || getCategoryFallback(placeFallbackCategory(place.category), place.id)

  const catMeta = PLACE_CATEGORIES.find(c => c.slug === place.category)

  return (
    <a
      href={place.website}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl overflow-hidden bg-white border border-[#f0e4cc] hover:border-[#006a62]/40 hover:shadow-lg transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={place.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />

        {/* Category badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <span className="text-[11px]">{catMeta?.emoji}</span>
          <span className="text-[10px] font-semibold text-[#4a3f3a]">{catMeta?.label}</span>
        </div>

        {/* Free badge */}
        {place.free && (
          <div className="absolute top-2 right-2 bg-[#006a62]/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            Free
          </div>
        )}

        {/* Dark gradient on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* External link icon */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-white/90 rounded-full p-1">
            <ExternalLink className="w-3 h-3 text-[#006a62]" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1">
        <h3
          className="font-bold text-[#1a1614] text-sm leading-tight mb-0.5 group-hover:text-[#006a62] transition-colors line-clamp-2"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          {place.name}
        </h3>
        <p className="text-[11px] text-[#9a442d] font-medium mb-1.5 line-clamp-1">
          {place.tagline}
        </p>
        <p className="text-[11px] text-[#8a7a74] line-clamp-2 flex-1">
          {place.description}
        </p>

        {/* Footer: neighborhood + visit */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#f0e4cc]">
          <span className="flex items-center gap-0.5 text-[10px] text-[#8a7a74]">
            <MapPin className="w-2.5 h-2.5" />
            {place.neighborhood}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#006a62] group-hover:underline">
            Visit
            <ExternalLink className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>
    </a>
  )
}
