import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Music2, Users, MapPin, Trophy, Star, Zap } from 'lucide-react'
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

const FEATURES = [
  {
    icon: Zap,
    title: 'Every event, one place',
    desc: 'Ticketmaster, Eventbrite, SeatGeek, Bandsintown, and local sources — aggregated and deduplicated daily so you never miss something.',
  },
  {
    icon: Star,
    title: 'Smart enrichment',
    desc: 'AI-powered descriptions, venue tips, and local recommendations help you decide what\'s worth going to.',
  },
  {
    icon: Users,
    title: 'Social & competitive',
    desc: 'See who\'s going, save events, check in when you arrive, and climb the leaderboard against your friends.',
  },
  {
    icon: MapPin,
    title: 'Venue discovery',
    desc: 'Every venue has its own page showing all upcoming events, making it easy to follow your favorite spots.',
  },
  {
    icon: Trophy,
    title: 'Earn badges',
    desc: 'Check into events to earn badges — First Check-in, Music Lover, Burqueño, 3-Week Streak, and more.',
  },
  {
    icon: Music2,
    title: 'Built for ABQ',
    desc: 'Built by a local Albuquerquean who wanted one place to find out what\'s happening in the 505.',
  },
]

const SOURCES = [
  { name: 'Ticketmaster', desc: 'National & major local events' },
  { name: 'SeatGeek',     desc: 'Sports, concerts, theater' },
  { name: 'Eventbrite',   desc: 'Community & indie events' },
  { name: 'Bandsintown',  desc: 'Music & live performances' },
  { name: 'Local sources','desc': 'Hyena\'s, Explora, JCC, local venues' },
]

export default function AboutPage() {
  return (
    <main id="main" className="min-h-dvh bg-[#fbf7f1] text-[#1a1614]">
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
            className="text-4xl md:text-5xl font-black leading-tight mb-3 text-[#1a1614]"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            About ABQ Unplugged
          </h1>
        </AnimateIn>

        <AnimateIn animation="fade-up" onScroll={false} delay={100}>
          <p className="text-base md:text-lg leading-relaxed mb-10 text-[#4a3f3a]">
            Albuquerque has more going on than most people realize. Music at the Launchpad.
            Comedy at Hyena&apos;s. NM United at Isotopes Park. Art walks and food festivals every
            weekend. ABQ Unplugged puts all of it in one place — so getting out and meeting people
            is as easy as opening your phone.
          </p>
        </AnimateIn>

        {/* Features grid */}
        <AnimateIn animation="fade-up" delay={50}>
          <section className="mb-10">
            <h2
              className="text-2xl font-bold mb-4 text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              What makes it different
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="bg-white rounded-xl p-4 border border-[#f0e4cc] shadow-sm"
                >
                  <Icon className="w-5 h-5 text-[#9a442d] mb-2" />
                  <p className="text-sm font-bold text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
                    {title}
                  </p>
                  <p className="text-xs text-[#6b5d57] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        </AnimateIn>

        {/* Sources */}
        <AnimateIn animation="fade-up" delay={100}>
          <section className="mb-10">
            <h2
              className="text-2xl font-bold mb-4 text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Where events come from
            </h2>
            <p className="text-sm text-[#6b5d57] mb-3">
              Updated daily from multiple trusted ticket and event sources:
            </p>
            <div className="space-y-2">
              {SOURCES.map(({ name, desc }) => (
                <div
                  key={name}
                  className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#f0e4cc]"
                >
                  <span className="w-2 h-2 rounded-full bg-[#9a442d] flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[#1a1614]">{name}</p>
                    <p className="text-xs text-[#6b5d57]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </AnimateIn>

        {/* Built by */}
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
            <p className="text-sm text-[#6b5d57] mt-1">
              Built to make it easier for Albuquerqueans to get off the couch and experience
              what makes this city great.
            </p>
          </section>
        </AnimateIn>

        {/* CTA */}
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
              href="/leaderboard"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-[#f0e4cc] text-[#1a1614] font-semibold text-sm hover:bg-[#f5f0e8] transition-all duration-300"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              View Leaderboard
            </Link>
          </div>

          {/* Utility links */}
          <p className="mt-6 text-xs text-[#6b5d57]">
            <Link
              href="/privacy"
              className="hover:text-[#9a442d] transition-colors underline underline-offset-2"
            >
              Privacy Policy
            </Link>
          </p>
        </AnimateIn>
      </div>
    </main>
  )
}
