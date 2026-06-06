import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Music2, Users, MapPin, Trophy, Star, Zap, Mail } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'

export const metadata: Metadata = {
  title: 'About ABQ Unplugged, Albuquerque Event Discovery',
  description:
    'ABQ Unplugged aggregates every event in the greater Albuquerque, NM area, concerts, comedy, sports, arts, and food festivals, from Ticketmaster, Eventbrite, SeatGeek, and local listings.',
  openGraph: {
    title: 'About ABQ Unplugged, Albuquerque Event Discovery',
    description:
      'ABQ Unplugged aggregates every event in the greater Albuquerque, NM area, concerts, comedy, sports, arts, and food festivals, from Ticketmaster, Eventbrite, SeatGeek, and local listings.',
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
    desc: 'Ticketmaster, Eventbrite, SeatGeek, Bandsintown, and local sources, aggregated and deduplicated daily so you never miss something.',
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
    desc: 'Check into events to earn badges, First Check-in, Music Lover, Burqueño, 3-Week Streak, and more.',
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
    <main id="main" className="min-h-dvh bg-cream text-ink">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-semibold text-terra hover:text-terra-hover transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* H1 */}
        <AnimateIn animation="fade-up" onScroll={false} delay={50}>
          <h1
            className="text-4xl md:text-5xl font-black leading-tight mb-3 text-ink"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            About ABQ Unplugged
          </h1>
        </AnimateIn>

        <AnimateIn animation="fade-up" onScroll={false} delay={100}>
          <p className="text-base md:text-lg leading-relaxed mb-10 text-ink-mid">
            Albuquerque has more going on than most people realize. Music at the Launchpad.
            Comedy at Hyena&apos;s. NM United at Isotopes Park. Art walks and food festivals every
            weekend. ABQ Unplugged puts all of it in one place, so getting out and meeting people
            is as easy as opening your phone.
          </p>
        </AnimateIn>

        {/* Features grid */}
        <AnimateIn animation="fade-up" delay={50}>
          <section className="mb-10">
            <h2
              className="text-2xl font-bold mb-4 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              What makes it different
            </h2>
            {/* Round-6 #10: 6 identical cards → 1 featured tile + 5
                compact tiles. Same content, varied rhythm — same fix
                applied to /welcome in round 4. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FEATURES.slice(0, 1).map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="sm:col-span-3 bg-gradient-to-br from-cream-raised to-[#f8eddf] rounded-xl p-5 border border-[#e8d9bf] flex gap-4 items-start"
                >
                  <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Icon className="w-5 h-5 text-terra" />
                  </div>
                  <div>
                    <p className="text-base font-black text-ink mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
                      {title}
                    </p>
                    <p className="text-sm text-ink-mid leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
              {FEATURES.slice(1).map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="bg-white rounded-xl p-4 border border-sand-light shadow-sm"
                >
                  <Icon className="w-5 h-5 text-terra mb-2" />
                  <p className="text-sm font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
                    {title}
                  </p>
                  <p className="text-xs text-ink-light leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        </AnimateIn>

        {/* Sources */}
        <AnimateIn animation="fade-up" delay={100}>
          <section className="mb-10">
            <h2
              className="text-2xl font-bold mb-4 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Where events come from
            </h2>
            <p className="text-sm text-ink-light mb-3">
              Updated daily from multiple trusted ticket and event sources:
            </p>
            <div className="space-y-2">
              {SOURCES.map(({ name, desc }) => (
                <div
                  key={name}
                  className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-sand-light"
                >
                  <span className="w-2 h-2 rounded-full bg-terra flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{name}</p>
                    <p className="text-xs text-ink-light">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </AnimateIn>

        {/* Built by */}
        <AnimateIn animation="fade-up" delay={100}>
          <section className="mb-10 pb-8 border-b border-sand-light">
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Built by
            </h2>
            <p className="text-base text-ink">
              Matt Carlson, Albuquerque, NM
            </p>
            <p className="text-sm text-ink-light mt-1">
              Built to make it easier for Albuquerqueans to get off the couch and experience
              what makes this city great.
            </p>
          </section>
        </AnimateIn>

        {/* Press & Media */}
        <AnimateIn animation="fade-up" delay={100}>
          <section className="mb-10" id="press">
            <h2
              className="text-2xl font-bold mb-3 text-ink"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Press &amp; Media
            </h2>
            <p className="text-sm text-ink-light mb-5">
              ABQ Unplugged is Albuquerque&apos;s independent, free event discovery platform — built and run locally.
              We&apos;re happy to talk to local press and media about Albuquerque&apos;s events scene.
            </p>

            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { stat: '1,000+', label: 'Events tracked' },
                { stat: '10+',    label: 'Event sources' },
                { stat: 'Daily',  label: 'Data refresh' },
                { stat: 'Free',   label: 'Always free' },
              ].map(({ stat, label }) => (
                <div
                  key={label}
                  className="bg-white rounded-xl p-3 border border-sand-light text-center"
                >
                  <p className="text-xl font-black text-terra" style={{ fontFamily: 'var(--font-epilogue)' }}>{stat}</p>
                  <p className="text-[11px] text-ink-light mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Contact */}
            <div className="flex items-start gap-3 bg-cream-raised border border-[#e8d9bf] rounded-xl px-4 py-4">
              <Mail className="w-4 h-4 text-terra mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ink mb-0.5">Media inquiries</p>
                <a
                  href="mailto:hello@abqunplugged.com"
                  className="text-sm text-terra hover:underline"
                >
                  hello@abqunplugged.com
                </a>
                <p className="text-xs text-ink-light mt-1">
                  For interview requests, data questions, or coverage of the Albuquerque events scene.
                </p>
              </div>
            </div>
          </section>
        </AnimateIn>

        {/* CTA */}
        <AnimateIn animation="scale" delay={150}>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link
              href="/events"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-terra text-white font-semibold text-sm hover:bg-terra-hover transition-all duration-300 hover:shadow-lg hover:shadow-terra/20"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Browse Events
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border-2 border-sand-light text-ink font-semibold text-sm hover:bg-[#f5f0e8] transition-all duration-300"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              View Leaderboard
            </Link>
          </div>

          {/* Utility links */}
          <p className="mt-6 text-xs text-ink-light">
            <Link
              href="/privacy"
              className="hover:text-terra transition-colors underline underline-offset-2"
            >
              Privacy Policy
            </Link>
          </p>
        </AnimateIn>
      </div>
    </main>
  )
}
