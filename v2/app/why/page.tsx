import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'
import { ConnectionQuote } from '@/app/components/ConnectionQuote'

export const metadata: Metadata = {
  title: 'Why we built this — ABQ Unplugged',
  description:
    'We built ABQ Unplugged because scrolling doesn\u2019t count. The point is to show up somewhere, with someone.',
  alternates: { canonical: 'https://abqunplugged.com/why' },
}

export const revalidate = false

export default function WhyPage() {
  return (
    <main className="min-h-dvh bg-[#fbf7f1]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#fbf7f1]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Home</span>
          </Link>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-4 py-10 prose prose-sm">
        <AnimateIn animation="fade-up">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#9a442d] font-semibold mb-2">
            Why this site exists
          </p>
          <h1
            className="text-3xl sm:text-4xl font-black text-[#1a1614] leading-[1.05] mb-6"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Scrolling doesn&rsquo;t count.
          </h1>
        </AnimateIn>

        <AnimateIn animation="fade-up" delay={80}>
          <p className="text-base text-[#4a3f3a] leading-relaxed mb-5">
            Albuquerque has a pulse. Venues, plazas, the bosque, someone&rsquo;s backyard. A
            thousand rooms a week are filling up with music and laughter and people
            you haven&rsquo;t met yet. ABQ Unplugged is a list of those rooms. But a list
            is not the point. The point is to walk into one.
          </p>

          <p className="text-base text-[#4a3f3a] leading-relaxed mb-8">
            We made this site to help push you out the door &mdash; with someone if
            you can, but out the door either way.
          </p>
        </AnimateIn>

        <AnimateIn animation="fade-up" delay={160}>
          <h2
            className="text-xl font-black text-[#1a1614] mt-8 mb-3"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            A few things we&rsquo;ve come to believe
          </h2>

          <div className="space-y-5 mb-8">
            <div>
              <p className="text-sm font-bold text-[#9a442d] mb-1">Relationships are the longest-studied thing in happiness research.</p>
              <p className="text-sm text-[#4a3f3a] leading-relaxed">
                Harvard has been tracking the same group of people for 85+ years. The
                clearest predictor of health and happiness at 80 isn&rsquo;t wealth. It isn&rsquo;t
                cholesterol. It&rsquo;s the quality of their relationships at 50.
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-[#9a442d] mb-1">Americans spend 20 minutes a day with friends.</p>
              <p className="text-sm text-[#4a3f3a] leading-relaxed">
                Two decades ago it was an hour. The US Surgeon General called
                loneliness a public-health crisis in 2023 &mdash; comparable, in mortality
                terms, to smoking 15 cigarettes a day.
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-[#9a442d] mb-1">Weak ties matter more than we think.</p>
              <p className="text-sm text-[#4a3f3a] leading-relaxed">
                The barista, the regular at the trivia night, the person you see every
                Saturday at the same coffee shop &mdash; these brief, friendly exchanges
                measurably lift mood and are how most of life&rsquo;s serendipity sneaks in.
                Most cities have fewer of these moments than they did in 1990. Third
                places &mdash; cafes, parks, plazas, bars &mdash; are where they happen.
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-[#9a442d] mb-1">Social fitness is a practice.</p>
              <p className="text-sm text-[#4a3f3a] leading-relaxed">
                Like physical fitness, relationships stay healthy when they get used.
                That takes five minutes a week, sometimes. A text. A show together.
                A beer after. An afternoon hike.
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-[#9a442d] mb-1">Showing up is half of belonging.</p>
              <p className="text-sm text-[#4a3f3a] leading-relaxed">
                You don&rsquo;t have to talk to everyone. You don&rsquo;t have to be
                the most interesting person in the room. You just have to be in
                the room. The room only becomes a room because you walked in.
              </p>
            </div>
          </div>
        </AnimateIn>

        <AnimateIn animation="fade-up" delay={240}>
          <h2
            className="text-xl font-black text-[#1a1614] mt-10 mb-3"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            How the site tries to help
          </h2>

          <ul className="space-y-2 mb-8 list-none pl-0">
            <li className="text-sm text-[#4a3f3a] leading-relaxed">
              <span className="text-[#9a442d] font-bold mr-2">&middot;</span>
              Every event. Every source. One place. If there&rsquo;s something happening
              in Albuquerque tonight, we want it listed here.
            </li>
            <li className="text-sm text-[#4a3f3a] leading-relaxed">
              <span className="text-[#9a442d] font-bold mr-2">&middot;</span>
              A &ldquo;Who would love this?&rdquo; nudge on every event page &mdash; one
              tap to send a ready-written invite to a friend.
            </li>
            <li className="text-sm text-[#4a3f3a] leading-relaxed">
              <span className="text-[#9a442d] font-bold mr-2">&middot;</span>
              Community submissions. Neighbors can add events they know about.
            </li>
            <li className="text-sm text-[#4a3f3a] leading-relaxed">
              <span className="text-[#9a442d] font-bold mr-2">&middot;</span>
              Venue pages that frame places as rooms that belong to the regulars &mdash;
              because they do.
            </li>
            <li className="text-sm text-[#4a3f3a] leading-relaxed">
              <span className="text-[#9a442d] font-bold mr-2">&middot;</span>
              A daily line of ambient wisdom at the top of the page &mdash; something small,
              the same for everyone in the city that day.
            </li>
          </ul>
        </AnimateIn>

        <AnimateIn animation="fade-up" delay={320}>
          <div className="border-t border-[#f0e4cc] pt-6 mt-10 mb-8">
            <p className="text-base text-[#4a3f3a] leading-relaxed mb-3">
              We&rsquo;re not asking anyone to call their mom. We&rsquo;re asking
              you to pick a night, pick a thing, and &mdash; ideally &mdash; pick a person.
              The city is out there. It&rsquo;s more fun when you&rsquo;re in it.
            </p>
            <p className="text-sm text-[#8a7a74] italic">
              Put the phone down. Pick up a plan.
            </p>
          </div>
        </AnimateIn>

        <AnimateIn animation="fade-up" delay={400}>
          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href="/events?time=tonight"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#9a442d] text-white text-sm font-semibold hover:bg-[#7d3725] transition-colors"
            >
              See what&rsquo;s happening tonight
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/api/surprise"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-[#ddc9a3] text-sm font-semibold text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
            >
              Surprise me
            </Link>
          </div>

          <div className="text-center">
            <ConnectionQuote size="sm" />
          </div>
        </AnimateIn>
      </article>
    </main>
  )
}
