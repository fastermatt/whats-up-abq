import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchNeighborhoodCounts } from '@/lib/events'
import { MapPin, ArrowLeft } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Albuquerque Events by Neighborhood — ABQ Unplugged',
  description:
    'Explore upcoming events in every Albuquerque neighborhood — Downtown, Nob Hill, Old Town, UNM, Uptown, and more. Find local events near you on ABQ Unplugged.',
  openGraph: {
    title: 'Albuquerque Events by Neighborhood',
    description: 'Explore upcoming events in every neighborhood across Albuquerque, NM.',
    url: 'https://abqunplugged.com/neighborhoods',
  },
  alternates: { canonical: 'https://abqunplugged.com/neighborhoods' },
}

// Friendly descriptions for each neighborhood
const NEIGHBORHOOD_DESC: Record<string, string> = {
  'downtown':                    'The heart of ABQ — arts district, theaters, restaurants',
  'unm-campus':                  'University of New Mexico campus events — Popejoy, Keller Hall',
  'unm-south-campus':            'South of UNM — The Pit, Isotopes Park, ticketed venues',
  'state-fairgrounds-midtown':   'Expo NM, Tingley Coliseum, Isotopes Park — big shows',
  'west-side':                   'Journal Pavilion, Revel Entertainment, far west ABQ',
  'uptown-midtown':              'Shopping, restaurants, mid-city entertainment hubs',
  'far-northeast-sandia-foothills': 'Sandia Casino, Balloon Fiesta Park, foothills venues',
  'northeast-heights':           'Nexus Brewery, Adobe Theater, local favorites',
  'barelas-south-downtown':      'National Hispanic Cultural Center, Barelas arts scene',
  'south-valley':                'Isleta Casino, Rio Bravo, south Albuquerque events',
  'old-town':                    'Museums, biopark, Indian Pueblo Cultural Center',
  'rio-rancho':                  'Rio Rancho Events Center, Sandoval County shows',
  'south-i-25-university-se':    'Central Ave corridor, Outpost Performance Space',
  'downtown-edo':                'East Downtown — bars, live music, emerging arts scene',
  'unm-nob-hill':                'Nob Hill — Lobo Theater, Tractor Brewery, Anodyne',
  'north-valley':                'Los Ranchos, Corrales, Alameda — community events',
  'international-district':      'Diverse southeast community events and festivals',
  'nob-hill':                    'Nob Hill shopping, dining, and cultural events',
}

export default async function NeighborhoodsPage() {
  const neighborhoods = await fetchNeighborhoodCounts()

  return (
    <main className="min-h-dvh bg-[#fbf7f1]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-[#fbf7f1]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors"
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
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#006a62] font-semibold mb-1">
              Browse by area
            </p>
            <h1
              className="text-3xl font-black text-[#1a1614] leading-tight mb-2"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Albuquerque Neighborhoods
            </h1>
            <p className="text-sm text-[#8a7a74]">
              Find events happening near you across all of Albuquerque.
            </p>
          </div>
        </AnimateIn>

        {/* ── Neighborhood Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {neighborhoods.map((n, i) => (
            <AnimateIn key={n.slug} animation="fade-up" delay={Math.min(i * 30, 300)}>
              <Link
                href={`/neighborhoods/${n.slug}`}
                className="group bg-white rounded-xl border border-[#f0e4cc] px-4 py-3.5 shadow-sm hover:shadow-md hover:border-[#006a62]/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2
                      className="font-bold text-sm text-[#1a1614] group-hover:text-[#006a62] transition-colors leading-tight mb-0.5"
                      style={{ fontFamily: 'var(--font-epilogue)' }}
                    >
                      {n.neighborhood}
                    </h2>
                    {NEIGHBORHOOD_DESC[n.slug] && (
                      <p className="text-[10px] text-[#8a7a74] line-clamp-1">
                        {NEIGHBORHOOD_DESC[n.slug]}
                      </p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-bold text-[#8a7a74] bg-[#f0e4cc] rounded-full px-2.5 py-1 tabular-nums">
                    {n.count} events
                  </span>
                </div>
              </Link>
            </AnimateIn>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="mt-10 text-center">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-colors shadow-sm hover:shadow-md"
          >
            Browse All Events
          </Link>
        </div>
      </div>
    </main>
  )
}
