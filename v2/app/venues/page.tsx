import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchTopVenues } from '@/lib/events'
import { venueToSlug } from './[slug]/page'
import { MapPin, ArrowLeft } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Venues in Albuquerque, NM, Find Events Near You',
  description:
    'Browse the top event venues in Albuquerque, NM, concert halls, comedy clubs, sports arenas, theaters, and more. Find upcoming events at each venue on ABQ Unplugged.',
  openGraph: {
    title: 'Venues in Albuquerque, NM, Find Events Near You',
    description: 'Browse top event venues in Albuquerque and find upcoming events at each location.',
    url: 'https://abqunplugged.com/venues',
  },
  alternates: { canonical: 'https://abqunplugged.com/venues' },
}

const itemListLd = (venues: { venueName: string; count: number }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Albuquerque Event Venues',
  description: 'Top event venues in Albuquerque, NM',
  itemListElement: venues.slice(0, 20).map((v, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: v.venueName,
    url: `https://abqunplugged.com/venues/${venueToSlug(v.venueName)}`,
  })),
})

export default async function VenuesPage() {
  const venues = await fetchTopVenues(80)

  return (
    <main id="main" className="min-h-dvh bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd(venues)) }}
      />

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-cream/90 backdrop-blur-md border-b border-sand-mid/60">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-ink-mid hover:text-terra transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Home</span>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ── Hero ── */}
        <AnimateIn animation="fade-up">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.2em] text-terra font-semibold mb-1">
              Albuquerque, NM
            </p>
            <h1
              className="text-3xl font-black text-ink leading-tight mb-2"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Event Venues
            </h1>
            <p className="text-sm text-ink-light">
              {venues.length} venues with upcoming events, concerts, comedy, arts, sports, and more.
            </p>
          </div>
        </AnimateIn>

        {/* ── Venue Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {venues.map((v, i) => (
            <AnimateIn key={v.venueName} animation="fade-up" delay={Math.min(i * 20, 300)}>
              <Link
                href={`/venues/${venueToSlug(v.venueName)}`}
                className="group flex items-center justify-between bg-white rounded-xl border border-sand-light px-4 py-3 shadow-sm hover:shadow-md hover:border-sand-mid transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sand-light to-sand-mid flex items-center justify-center flex-shrink-0 group-hover:from-terra-light/30 group-hover:to-terra/10 transition-all">
                    <MapPin className="w-4 h-4 text-terra" />
                  </div>
                  <span
                    className="font-semibold text-sm text-ink group-hover:text-terra transition-colors leading-tight line-clamp-2"
                    style={{ fontFamily: 'var(--font-epilogue)' }}
                  >
                    {v.venueName}
                  </span>
                </div>
                <span className="ml-3 flex-shrink-0 text-[10px] font-bold text-ink-light bg-sand-light rounded-full px-2 py-0.5 tabular-nums">
                  {v.count}
                </span>
              </Link>
            </AnimateIn>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="mt-10 text-center">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-terra text-white font-semibold text-sm hover:bg-terra-hover transition-colors shadow-sm hover:shadow-md"
          >
            Browse All Events
          </Link>
        </div>
      </div>
    </main>
  )
}
