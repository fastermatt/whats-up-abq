import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'

export const metadata: Metadata = {
  title: 'About ABQ Unplugged — Albuquerque Event Discovery',
  description:
    'ABQ Unplugged aggregates every event in the greater Albuquerque, NM area — concerts, comedy, sports, arts, and food festivals — from Ticketmaster, Eventbrite, SeatGeek, and local listings.',
  openGraph: {
    title: 'About ABQ Unplugged — Albuquerque Event Discovery',
    description:
      'ABQ Unplugged aggregates every event in the greater Albuquerque, NM area — concerts, comedy, sports, arts, and food festivals — from Ticketmaster, Eventbrite, SeatGeek, and local listings.',
    url: 'https://abqunplugged.com/about',
  },
  alternates: {
    canonical: 'https://abqunplugged.com/about',
  },
}

export const revalidate = false

export default function AboutPage() {
  return (
    <main className="min-h-dvh bg-[#fbf7f1] text-[#1a1614]">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#9a442d] hover:text-[#7d3725] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* H1 */}
        <AnimateIn animation="fade-up" onScroll={false} delay={50}>
          <h1
            className="text-4xl md:text-5xl font-black leading-tight mb-6 text-[#1a1614]"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            About ABQ Unplugged
          </h1>
        </AnimateIn>

        {/* Main description */}
        <AnimateIn animation="fade-up" onScroll={false} delay={150}>
          <p className="text-base md:text-lg leading-relaxed mb-8 text-[#1a1614]">
            ABQ Unplugged brings together every event in the greater Albuquerque area — concerts,
            comedy, sports, arts, food festivals, and more — into one beautiful, easy-to-browse app.
          </p>
        </AnimateIn>

        {/* Sources section */}
        <AnimateIn animation="fade-up" delay={50}>
          <section className="mb-10">
            <h2
              className="text-2xl font-bold mb-4 text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Where our events come from
            </h2>
            <p className="text-sm text-[#8a7a74] mb-3">
              We aggregate events from multiple trusted sources, updated daily:
            </p>
            <ul className="space-y-2">
              {['Ticketmaster', 'Eventbrite', 'SeatGeek', 'Local community listings'].map(
                (source) => (
                  <li
                    key={source}
                    className="flex items-center gap-3 text-[#1a1614]"
                  >
                    <span
                      className="w-2 h-2 rounded-full bg-[#9a442d] flex-shrink-0"
                    />
                    {source}
                  </li>
                )
              )}
            </ul>
          </section>
        </AnimateIn>

        {/* Built by section */}
        <AnimateIn animation="fade-up" delay={100}>
          <section className="mb-10 pb-8 border-b border-[#f0e4cc]">
            <h2
              className="text-2xl font-bold mb-3 text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Built by
            </h2>
            <p className="text-base text-[#1a1614]">
              Matt Carlson, Albuquerque, NM
            </p>
          </section>
        </AnimateIn>

        {/* CTA section */}
        <AnimateIn animation="scale" delay={150}>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link
              href="/events"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all duration-300 hover:shadow-lg hover:shadow-[#9a442d]/20"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Browse Events
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-[#f0e4cc] text-[#1a1614] font-semibold text-sm hover:bg-[#f5f0e8] transition-all duration-300"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Back to Home
            </Link>
          </div>
        </AnimateIn>
      </div>
    </main>
  )
}
