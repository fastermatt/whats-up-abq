import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents, fetchRecentlyAdded, fetchFeaturedEvents, fetchNeighborhoodCounts, NormalizedEvent } from '@/lib/events'
import { getCategoryFallback, OG_IMAGE } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { MapPin, ArrowRight, ExternalLink } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'
import MoodChips from '@/app/components/MoodChips'
import SurpriseButton from '@/app/components/SurpriseButton'
import { ConnectionQuote } from '@/app/components/ConnectionQuote'
import { getFeaturedPlaces, PLACE_CATEGORIES, type Place } from '@/data/places'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'ABQ Unplugged — Things to Do in Albuquerque, NM',
  description:
    'Discover the best events in Albuquerque, NM — concerts, comedy, arts, sports, food & drink festivals. ' +
    'Find things to do in ABQ tonight, this weekend, and beyond. Every ticket source in one place.',
  openGraph: {
    title: 'ABQ Unplugged — Things to Do in Albuquerque, NM',
    description:
      'Discover the best events in Albuquerque, NM — concerts, comedy, arts, sports, food & drink festivals. ' +
      'Find things to do in ABQ tonight, this weekend, and beyond.',
    url: 'https://abqunplugged.com',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Albuquerque events — ABQ Unplugged',
      },
    ],
  },
  alternates: {
    canonical: 'https://abqunplugged.com',
  },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ABQ Unplugged',
  url: 'https://abqunplugged.com',
  description:
    'Discover the best events in Albuquerque, NM — concerts, comedy, arts, sports, food & drink festivals.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://abqunplugged.com/events?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

export default async function DiscoverPage() {
  const featuredPlaces = getFeaturedPlaces(8)

  const [tonight, tomorrow, weekend, allUpcoming, featured, justAdded, neighborhoodCounts] = await Promise.all([
    fetchEvents({ timeFilter: 'tonight', limit: 10 }),
    fetchEvents({ timeFilter: 'tomorrow', limit: 10 }),
    fetchEvents({ timeFilter: 'this-weekend', limit: 10 }),
    fetchEvents({ timeFilter: 'upcoming', limit: 1 }),
    fetchFeaturedEvents(6),
    fetchRecentlyAdded(10),
    fetchNeighborhoodCounts(),
  ])

  const now = new Date()

  const abqHour = parseInt(
    now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Denver' })
  )
  const greeting =
    abqHour < 12 ? 'Good morning' : abqHour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <main id="main" className="min-h-dvh bg-[--bg]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {/* SEO h1 — visually hidden, provides primary keyword signal */}
      <h1 className="sr-only">Events in Albuquerque, NM — Things to Do in ABQ</h1>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden text-white">
        {/* Dark atmospheric base */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(165deg, #0f0b09 0%, #1a1008 45%, #1f1208 100%)' }} />
        {/* Terra glow from bottom */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 130% 55% at 50% 130%, rgba(154,68,45,.52) 0%, transparent 68%)' }} />
        {/* Sage accent top-right */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 85% 20%, rgba(79,98,73,.22) 0%, transparent 60%)' }} />
        {/* Subtle grid lines */}
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-12 sm:pt-16 pb-0">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-5 animate-slide-down">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f5a623] animate-pulse" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50 font-semibold">
              {greeting}, Albuquerque
            </p>
          </div>

          {/* Headline */}
          <h2
            className="font-black leading-[1.05] mb-5 animate-hero-text"
            style={{ fontFamily: 'var(--font-epilogue)', fontSize: 'clamp(34px, 7vw, 58px)', letterSpacing: '-1.5px' }}
          >
            Your city.<br />
            <span style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,.42)' }}>
              Wide open.
            </span>
          </h2>

          <p className="text-sm text-white/55 mb-7 max-w-[420px] leading-[1.6] animate-fade-up">
            Music, food, sports, art — {allUpcoming.total.toLocaleString()} things happening around ABQ.
          </p>

          {/* Search bar */}
          <form
            action="/events"
            method="get"
            className="flex max-w-[520px] mb-5 rounded-xl overflow-hidden animate-fade-up"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}
          >
            <input
              name="q"
              type="text"
              placeholder="Search events, venues, neighborhoods…"
              className="flex-1 bg-white text-[#1a1614] text-sm px-4 py-3.5 outline-none placeholder:text-[#8a7a74]"
              aria-label="Search events"
            />
            <button
              type="submit"
              className="bg-[#9a442d] text-white font-bold text-sm px-5 hover:bg-[#7d3725] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <i className="fi fi-rr-search text-[13px]" aria-hidden="true" />
              Search
            </button>
          </form>

          {/* Vibe quick-filter pills */}
          <div className="flex gap-2 flex-wrap mb-2 animate-fade-up-delay">
            {[
              { label: 'Live Music',   icon: 'fi-rr-music-note', href: '/events?category=Music' },
              { label: 'Free Tonight', icon: 'fi-rr-ticket',     href: '/free' },
              { label: 'Date Night',   icon: 'fi-rr-heart',      href: '/date-night' },
              { label: 'With Kids',    icon: 'fi-rr-baby',       href: '/family-friendly' },
              { label: 'Out Late',     icon: 'fi-rr-moon',       href: '/events?time=tonight' },
              { label: 'Outdoors',     icon: 'fi-rr-leaf',       href: '/events?category=Outdoor' },
            ].map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all hover:bg-white/10 hover:border-white/40 hover:text-white"
                style={{ border: '1.5px solid rgba(255,255,255,.18)', color: 'rgba(255,255,255,.75)', background: 'rgba(255,255,255,.06)', backdropFilter: 'blur(6px)' }}
              >
                <i className={`fi ${pill.icon} text-[11px]`} aria-hidden="true" />
                {pill.label}
              </Link>
            ))}
          </div>

          {/* Surprise Me — secondary CTA */}
          <div className="mb-0 mt-3">
            <SurpriseButton />
          </div>
        </div>

        {/* Stat tabs strip */}
        <div className="relative z-10 mt-8" style={{ background: 'rgba(255,255,255,.06)', borderTop: '1px solid rgba(255,255,255,.08)', backdropFilter: 'blur(8px)' }}>
          <div className="max-w-6xl mx-auto grid grid-cols-4">
            {[
              { label: 'Tonight',      count: tonight.total,            href: '/events?time=tonight',      accent: true },
              { label: 'This Weekend', count: weekend.total,            href: '/events?time=this-weekend', accent: false },
              { label: 'Tomorrow',     count: tomorrow.total,           href: '/events?time=tomorrow',     accent: false },
              { label: 'All Upcoming', count: allUpcoming.total,        href: '/events',                   accent: false },
            ].map((tab, i) => (
              <Link
                key={tab.label}
                href={tab.href}
                className="py-3.5 flex flex-col items-center transition-colors hover:bg-white/5"
                style={i < 3 ? { borderRight: '1px solid rgba(255,255,255,.08)' } : {}}
              >
                <span
                  className="font-black text-xl sm:text-2xl leading-none"
                  style={{ fontFamily: 'var(--font-epilogue)', color: tab.accent ? '#f5c842' : 'white' }}
                >
                  {tab.count.toLocaleString()}
                </span>
                <span className="text-[10px] sm:text-[11px] text-white/45 mt-0.5">{tab.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ambient daily quote — soft, unpressured ── */}
      <div className="max-w-6xl mx-auto px-4 py-3 text-center">
        <ConnectionQuote size="sm" />
      </div>

      {/* ── Category quick links ── */}
      <section className="py-4 border-b border-[#f0e4cc]/60 animate-fade-in">
        <div className="overflow-x-auto scrollbar-hide">
          <div
            className="flex gap-2 px-4 pb-1 scroll-hint-inner"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {[
              { label: 'Music',        icon: 'fi-rr-music-note', cat: 'Music' },
              { label: 'Comedy',       icon: 'fi-rr-smile',      cat: 'Comedy' },
              { label: 'Arts',         icon: 'fi-rr-palette',    cat: 'Arts & Theater' },
              { label: 'Sports',       icon: 'fi-rr-ball',       cat: 'Sports' },
              { label: 'Food & Drink', icon: 'fi-rr-utensils',   cat: 'Food & Drink' },
              { label: 'Family',       icon: 'fi-rr-users',      cat: 'Family' },
              { label: 'Festivals',    icon: 'fi-rr-star',       cat: 'Festivals' },
              { label: 'Film',         icon: 'fi-rr-film',       cat: 'Film' },
              { label: 'Outdoor',      icon: 'fi-rr-leaf',       cat: 'Outdoor' },
              { label: 'Free',         icon: 'fi-rr-ticket',     cat: null, price: 'free' },
            ].map(({ label, icon, cat, price }) => (
              <Link
                key={label}
                href={cat ? `/events?category=${encodeURIComponent(cat)}` : `/events?price=${price}`}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-[#ddc9a3] text-xs font-semibold text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d] transition-all whitespace-nowrap group"
              >
                <i className={`fi ${icon} text-[13px] text-[#9a442d] group-hover:text-[#9a442d]`} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mood chips ── */}
      <MoodChips />

      {/* ── Find Your Vibe ── */}
      <AnimateIn animation="fade-up">
        <section className="py-6 border-t border-[#f0e4cc]/60">
          <div className="max-w-6xl mx-auto px-4 flex items-end justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#9a442d] mb-0.5 font-semibold">Discover</p>
              <h2 className="text-xl font-black text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
                Find your vibe
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 max-w-6xl mx-auto">
            {[
              {
                label: 'Date Night',
                icon: 'fi-rr-heart',
                sub: 'Arts, dining, live music',
                href: '/date-night',
                from: '#2d0f3d',
                to: '#7a2d5a',
              },
              {
                label: 'Live Music',
                icon: 'fi-rr-music-note',
                sub: 'Concerts & shows this week',
                href: '/events?category=Music',
                from: '#0f1a2d',
                to: '#1a4d7a',
              },
              {
                label: 'Free Tonight',
                icon: 'fi-rr-ticket',
                sub: 'Zero cost, all fun',
                href: '/free',
                from: '#1a2d0f',
                to: '#2d6b1a',
              },
              {
                label: 'With Kids',
                icon: 'fi-rr-baby',
                sub: 'Family-friendly picks',
                href: '/family-friendly',
                from: '#0f2a2d',
                to: '#0d5a5a',
              },
            ].map((vibe) => (
              <Link
                key={vibe.label}
                href={vibe.href}
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden"
              >
                {/* Gradient background */}
                <div
                  className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]"
                  style={{ background: `linear-gradient(160deg, ${vibe.from} 0%, ${vibe.to} 100%)` }}
                />
                {/* Bottom shadow for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                {/* Arrow chip */}
                <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <i className="fi fi-rr-arrow-right text-[11px] text-white" aria-hidden="true" />
                </div>
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-3.5">
                  <i className={`fi ${vibe.icon} text-[22px] text-white/90 block mb-1.5`} aria-hidden="true" />
                  <p className="font-black text-[15px] text-white leading-tight" style={{ fontFamily: 'var(--font-epilogue)' }}>
                    {vibe.label}
                  </p>
                  <p className="text-[11px] text-white/60 mt-0.5">{vibe.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </AnimateIn>

      {/* ── Editor's Picks — Featured Events ── */}
      {featured.length > 0 && (
        <AnimateIn animation="fade-up">
          {/* Warm section bg differentiates this from the standard horizontal rows */}
          <section className="py-6 bg-gradient-to-b from-[#f5ece3] to-[#fbf7f1] border-y border-[#e8d5c0]/70">
            <div className="max-w-6xl mx-auto px-4 flex items-end justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#9a442d] mb-0.5 font-semibold flex items-center gap-1">
                  <span>★</span> Editor&apos;s picks
                </p>
                <h2
                  className="text-xl font-black text-[#1a1614]"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  Not to miss
                </h2>
              </div>
              <Link
                href="/events?featured=1"
                className="text-xs font-semibold text-[#9a442d] hover:underline flex-shrink-0 flex items-center gap-1 group"
              >
                See all
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="overflow-x-auto scrollbar-hide">
              <div
                className="flex gap-4 px-4 pb-2 snap-x snap-mandatory scroll-hint-inner"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {featured.map((event) => (
                  <FeaturedCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          </section>
        </AnimateIn>
      )}

      {/* ── Happening Now ── */}
      {tonight.events.length > 0 && (
        <AnimateIn animation="fade-up">
          <EventSection
            title="Doors are open"
            subtitle="Happening right now"
            events={tonight.events}
            seeAllHref="/events?time=tonight"
            sectionLabel="Tonight"
          />
        </AnimateIn>
      )}

      {/* ── Tomorrow ── */}
      {tomorrow.events.length > 0 && (
        <AnimateIn animation="fade-up" delay={50}>
          <EventSection
            title="Coming up tomorrow"
            subtitle="Plan ahead"
            events={tomorrow.events}
            seeAllHref="/events?time=tomorrow"
            sectionLabel="Tomorrow"
          />
        </AnimateIn>
      )}

      {/* ── This Weekend ── */}
      {weekend.events.length > 0 && (
        <AnimateIn animation="fade-up" delay={100}>
          <EventSection
            title="This weekend"
            subtitle="Don't miss out"
            events={weekend.events.slice(0, 10)}
            seeAllHref="/events?time=this-weekend"
            sectionLabel="This Weekend"
          />
        </AnimateIn>
      )}

      {/* ── Just Added ── */}
      {justAdded.length > 0 && (
        <AnimateIn animation="fade-up" delay={150}>
          <EventSection
            title="Just added"
            subtitle="Fresh on the calendar"
            events={justAdded}
            seeAllHref="/events"
            sectionLabel="New"
          />
        </AnimateIn>
      )}

      {/* ── Things To Do ── */}
      <AnimateIn animation="fade-up" delay={175}>
        <section className="py-6 border-t border-[#f0e4cc]/60">
          <div className="max-w-6xl mx-auto px-4 flex items-end justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#006a62] mb-0.5 font-semibold">
                Anytime
              </p>
              <h2
                className="text-xl font-black text-[#1a1614]"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                Things To Do in ABQ
              </h2>
            </div>
            <Link
              href="/things-to-do"
              className="text-xs font-semibold text-[#006a62] hover:underline flex-shrink-0 flex items-center gap-1 group"
            >
              See all
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Category chips — only show categories that have places */}
          <div
            className="flex gap-2 overflow-x-auto px-4 pb-3 mb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {PLACE_CATEGORIES.filter(cat => featuredPlaces.some(p => p.category === cat.slug)).map(cat => (
              <Link
                key={cat.slug}
                href={`/things-to-do?category=${cat.slug}`}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#006a62]/10 text-[#006a62] text-[11px] font-semibold hover:bg-[#006a62] hover:text-white transition-all whitespace-nowrap"
              >
                <span>{cat.emoji}</span>
                {cat.label}
              </Link>
            ))}
          </div>

          {/* Horizontal scroll cards */}
          <div className="overflow-x-auto scrollbar-hide">
            <div
              className="flex gap-3 px-4 pb-2 snap-x"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {featuredPlaces.map((place, i) => (
                <PlaceTeaseCard key={place.id} place={place} index={i} />
              ))}
              {/* See-all card */}
              <Link
                href="/things-to-do"
                className="flex-shrink-0 w-[160px] snap-start flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#006a62]/30 text-[#006a62] hover:border-[#006a62] hover:bg-[#006a62]/5 transition-all gap-2 aspect-[4/3]"
              >
                <ArrowRight className="w-5 h-5" />
                <span className="text-xs font-semibold">See all places</span>
              </Link>
            </div>
          </div>
        </section>
      </AnimateIn>

      {/* ── Explore by Neighborhood ── */}
      {neighborhoodCounts.length > 0 && (
        <AnimateIn animation="fade-up" delay={200}>
          <section className="py-6 border-t border-[#f0e4cc]/60">
            <div className="max-w-6xl mx-auto px-4 mb-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#6b5d57] mb-0.5">Browse by area</p>
              <h2
                className="text-xl font-black text-[#1a1614]"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                Explore by Neighborhood
              </h2>
            </div>
            <div
              className="flex gap-2 overflow-x-auto px-4 pb-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {neighborhoodCounts.slice(0, 14).map(({ neighborhood, count, slug }, i) => (
                <AnimateIn key={slug} animation="fade-up" delay={Math.min(i * 50, 300)} className="flex-shrink-0">
                  <Link
                    href={`/neighborhoods/${slug}`}
                    className="flex flex-col items-start px-3.5 py-2.5 rounded-xl bg-white border border-[#ddc9a3] hover:border-[#006a62] hover:shadow-sm transition-all group"
                  >
                    <span className="text-xs font-bold text-[#1a1614] group-hover:text-[#006a62] transition-colors whitespace-nowrap">
                      {neighborhood}
                    </span>
                    <span className="text-[10px] text-[#6b5d57] tabular-nums">
                      {count} event{count !== 1 ? 's' : ''}
                    </span>
                  </Link>
                </AnimateIn>
              ))}
            </div>
          </section>
        </AnimateIn>
      )}

      {/* ── Browse All CTA ── */}
      <AnimateIn animation="scale" delay={50}>
        <section className="max-w-6xl mx-auto px-4 py-8">
          <Link
            href="/events"
            className="group flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#9a442d] text-white font-semibold hover:bg-[#7d3725] transition-all duration-300 text-sm hover:shadow-lg hover:shadow-[#9a442d]/20"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Browse All {allUpcoming.total.toLocaleString()} Events
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>
      </AnimateIn>

      {/* ── Footer ── */}
      <footer className="border-t border-[#f0e4cc] py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p
            className="text-sm font-bold text-[#1a1614] mb-1"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            ABQ Unplugged
          </p>
          <p className="text-xs text-[#6b5d57] mb-1">Every event in Albuquerque, one place</p>
          <div className="mb-4 max-w-md mx-auto">
            <ConnectionQuote size="sm" />
          </div>
          {/* Submit CTA — stands out above the footer nav */}
          <Link
            href="/submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9a442d] text-white text-sm font-bold hover:bg-[#7d3725] transition-colors mb-5 shadow-md shadow-[#9a442d]/20"
          >
            ✦ Submit your event
          </Link>

          <nav className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { href: '/events',               label: 'All Events' },
              { href: '/events?time=tonight',  label: 'Tonight' },
              { href: '/events?time=this-weekend', label: 'This Weekend' },
              { href: '/things-to-do',         label: 'Things To Do' },
              { href: '/neighborhoods',        label: 'Neighborhoods' },
              { href: '/feedback',             label: 'Feedback' },
              { href: '/why',                  label: 'Why we built this' },
              { href: '/about',                label: 'About' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-[#6b5d57] hover:text-[#9a442d] transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="text-[10px] text-[#6b5d57]/60 mt-5">© {new Date().getFullYear()} ABQ Unplugged · Albuquerque, NM</p>
        </div>
      </footer>
    </main>
  )
}

// ─── Place Tease Card — compact card for homepage horizontal scroll ─────────

function PlaceTeaseCard({ place, index }: { place: Place; index: number }) {
  const catMeta = PLACE_CATEGORIES.find(c => c.slug === place.category)

  return (
    <a
      href={place.website}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex-shrink-0 w-[180px] snap-start"
      style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
    >
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-1.5 shadow-sm group-hover:shadow-md transition-shadow duration-300">
        {place.image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={place.image}
              alt={place.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300" />
          </>
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${catMeta?.gradientFrom} ${catMeta?.gradientTo} flex items-center justify-center group-hover:brightness-110 transition-all duration-300`}
          >
            <span className="text-3xl opacity-80 group-hover:scale-110 transition-transform duration-300">
              {catMeta?.emoji}
            </span>
          </div>
        )}
        {/* Category chip */}
        <div className="absolute top-1.5 left-1.5 text-[10px] font-semibold bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[#4a3f3a]">
          {catMeta?.emoji} {catMeta?.label}
        </div>
        {place.free && (
          <div className="absolute top-1.5 right-1.5 text-[10px] font-bold bg-[#006a62]/90 text-white px-1.5 py-0.5 rounded-full">
            Free
          </div>
        )}
        {/* Hover: external link hint */}
        <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-white/95 rounded-full p-1 shadow-sm">
            <ExternalLink className="w-2.5 h-2.5 text-[#006a62]" />
          </div>
        </div>
      </div>
      <h3
        className="font-bold text-[#1a1614] text-xs leading-tight line-clamp-2 mb-0.5 group-hover:text-[#006a62] transition-colors"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {place.name}
      </h3>
      <p className="text-[10px] text-[#6b5d57] line-clamp-1">{place.tagline}</p>
    </a>
  )
}

// ─── Horizontal Scrolling Event Section ─────────────────────────────────────

// Section accent colors — each section gets a distinct accent to break monotony
const SECTION_ACCENTS: Record<string, string> = {
  Tonight:    '#006a62', // turquoise
  Tomorrow:   '#4f6249', // sage
  'This Weekend': '#9a442d', // terra
  New:        '#8a7a74', // ink-light
}

function EventSection({
  title,
  subtitle,
  events,
  seeAllHref,
  sectionLabel,
}: {
  title: string
  subtitle: string
  events: NormalizedEvent[]
  seeAllHref: string
  sectionLabel: string
}) {
  const accentColor = SECTION_ACCENTS[sectionLabel] ?? '#8a7a74'

  return (
    <section className="py-6">
      <div className="max-w-6xl mx-auto px-4 flex items-end justify-between mb-3">
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.15em] mb-0.5 font-semibold"
            style={{ color: accentColor }}
          >
            {subtitle}
          </p>
          <h2
            className="text-xl font-black text-[#1a1614]"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {title}
          </h2>
        </div>
        <Link
          href={seeAllHref}
          className="text-xs font-semibold text-[#9a442d] hover:underline flex-shrink-0 flex items-center gap-1 group"
        >
          See all
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <div
          className="flex gap-3 px-4 pb-2 snap-x snap-mandatory scroll-hint-inner"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {events.map((event) => (
            <HorizontalCard key={event.id} event={event} sectionLabel={sectionLabel} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Horizontal Scroll Card — Landscape Rectangle ──────────────────────────

function HorizontalCard({
  event,
  sectionLabel,
}: {
  event: NormalizedEvent
  sectionLabel: string
}) {
  const timeStr = event.time ?? ''

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex-shrink-0 w-[220px] snap-start scroll-reveal-slide"
    >
      {/* Landscape image */}
      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3] mb-1.5 shadow-sm group-hover:shadow-md transition-shadow duration-300">
        <EventImage
          src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
          fallback={getCategoryFallback(event.category ?? undefined, event.id)}
          alt={event.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Time badge */}
        {timeStr && (
          <div className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur-sm text-[#1a1614] text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {sectionLabel} · {timeStr}
          </div>
        )}

        {/* Category */}
        {event.category && (
          <div className="absolute top-1.5 right-1.5 bg-black/40 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {event.category}
          </div>
        )}

        {/* Price */}
        {event.price && (
          <div className="absolute bottom-1.5 right-1.5 bg-[#006a62]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            {event.price}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Info */}
      <h3
        className="font-bold text-[#1a1614] text-xs leading-tight line-clamp-2 mb-0.5 group-hover:text-[#9a442d] transition-colors"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {event.title}
      </h3>
      {event.venue && (
        <p className="text-[10px] text-[#6b5d57] line-clamp-1 flex items-center gap-0.5">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          {event.venue}
        </p>
      )}
    </Link>
  )
}

// ─── Featured Card — Wide landscape card, larger than standard HorizontalCard ─

function FeaturedCard({ event }: { event: NormalizedEvent }) {
  const dateStr = event.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : null

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex-shrink-0 w-[270px] snap-start"
    >
      {/* Landscape 16:10 — matches every other card on the site */}
      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3] mb-2 shadow-md group-hover:shadow-lg transition-shadow duration-300">
        <EventImage
          src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
          fallback={getCategoryFallback(event.category ?? undefined, event.id)}
          alt={event.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        {/* ★ Featured badge */}
        <div className="absolute top-2 left-2 bg-[#9a442d] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          ★ Featured
        </div>
        {/* Price */}
        {event.price && (
          <div className="absolute top-2 right-2 bg-[#006a62]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            {event.price}
          </div>
        )}
        {/* Bottom gradient + date */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        {dateStr && (
          <div className="absolute bottom-2 left-2.5 text-white text-[11px] font-semibold drop-shadow">
            {dateStr}
          </div>
        )}
      </div>
      <h3
        className="font-bold text-[#1a1614] text-sm leading-tight line-clamp-2 mb-0.5 group-hover:text-[#9a442d] transition-colors"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {event.title}
      </h3>
      {event.venue && (
        <p className="text-[10px] text-[#6b5d57] line-clamp-1 flex items-center gap-0.5">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          {event.venue}
        </p>
      )}
    </Link>
  )
}
