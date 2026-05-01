import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents, fetchFeaturedEvents, fetchNeighborhoodCounts, NormalizedEvent } from '@/lib/events'
import { getCategoryFallback, OG_IMAGE } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { MapPin, ArrowRight, ExternalLink } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'
import MoodChips from '@/app/components/MoodChips'
import SurpriseButton from '@/app/components/SurpriseButton'


import { ScrollHintManager } from '@/app/components/ScrollHintManager'
import { HeroMapRoute } from '@/app/components/HeroMapRoute'
import { getFeaturedPlaces, PLACE_CATEGORIES, type Place } from '@/data/places'

// Rotates hourly (server-side, ISR updates within 60s of the hour turning)
const HERO_SAYINGS = [
  "Burque’s better in person.",
  "Stop scrolling. Start showing up.",
  "ABQ is happening.",
  "Your couch can wait.",
  "Less screen. More scene.",
  "Find your people, Burque.",
  "Go make tonight happen.",
  "Red, green, or something to do?",
  "This hour looks good on ABQ.",
  "Get out there, eh.",
]

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

  const [tonight, weekend, allUpcoming, featured, neighborhoodCounts] = await Promise.all([
    fetchEvents({ timeFilter: 'tonight', limit: 10 }),
    fetchEvents({ timeFilter: 'this-weekend', limit: 10 }),
    fetchEvents({ timeFilter: 'upcoming', limit: 1 }),
    fetchFeaturedEvents(6),
    fetchNeighborhoodCounts(),
  ])

  const now = new Date()

  // Per-neighborhood character descriptions — gives cards personality instead of generic "Events & local spots"
  const NEIGHBORHOOD_TAGLINES: Record<string, string> = {
    'downtown':                    'Arts, dining & live music',
    'nob-hill':                    'Bars, galleries & boutiques',
    'unm-nob-hill':                'Campus edge & nightlife',
    'unm-campus':                  'Student life & culture',
    'uptown-midtown':              'Shopping & entertainment',
    'state-fairgrounds-midtown':   'Events, fairs & spectacles',
    'northeast-heights':           'Family picks & local favorites',
    'far-northeast-sandia-foothills': 'Outdoor adventures & views',
    'north-valley':                'Local flavor & green spaces',
    'west-side':                   'Family events & open spaces',
    'international-district':      'Diverse culture & community',
    'south-valley':                'Community roots & tradition',
    'south-i-25-university-se':    'Midtown energy & university life',
    'barelas-south-downtown':      'Historic streets & community',
    'old-town':                    'Culture, history & tourism',
    'east-mountains':              'Mountain escapes & outdoor life',
  }

  const abqHour = parseInt(
    now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Denver' })
  )
  const heroSaying = HERO_SAYINGS[abqHour % HERO_SAYINGS.length]

  return (
    <main id="main" className="min-h-dvh bg-[--bg]">
      <ScrollHintManager />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {/* SEO h1 — visually hidden, provides primary keyword signal */}
      <h1 className="sr-only">Events in Albuquerque, NM — Things to Do in ABQ</h1>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ background: '#eedcd0' }}>

        {/* Sandstone floor: deepen toward the base */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(195,155,115,.22) 100%)' }}
        />

        {/* Real ABQ street map — fades at both edges and top/bottom */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0%, rgba(0,0,0,.45) 14%, black 32%, black 70%, rgba(0,0,0,.18) 88%, transparent 100%), ' +
              'linear-gradient(to bottom, transparent 0%, black 8%, black 90%, transparent 100%)',
            maskComposite: 'intersect',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, rgba(0,0,0,.45) 14%, black 32%, black 70%, rgba(0,0,0,.18) 88%, transparent 100%), ' +
              'linear-gradient(to bottom, transparent 0%, black 8%, black 90%, transparent 100%)',
            WebkitMaskComposite: 'source-in',
          }}
        >
          {/* Panning container — map drifts slowly east→west */}
          <div className="absolute animate-map-pan" style={{ top: '-15%', bottom: '-15%', left: '-6%', right: '-6%' }}>
            {/* Real ABQ street map, CSS-filtered to warm terra tone */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/abq-map-bg.svg"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: 'grayscale(1) sepia(0.55) hue-rotate(350deg) saturate(1.4) brightness(0.78)',
                opacity: 0.32,
              }}
            />
          </div>

          {/* Animated route — draws a random A→B path on every load, aligned to the real map */}
          <HeroMapRoute />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-7 pb-5">

          {/* Brand mark — compact, terra, above the headline */}
          <p
            className="font-black mb-2 animate-fade-in"
            style={{
              fontFamily: 'var(--font-epilogue)',
              fontSize: 'clamp(13px, 1.6vw, 19px)',
              color: '#9a442d',
              letterSpacing: '0.06em',
            }}
          >
            The 505.
          </p>

          {/* Functional headline — clear user intent */}
          <h2
            className="font-black leading-[0.92] mb-3 animate-hero-kern"
            style={{
              fontFamily: 'var(--font-epilogue)',
              fontSize: 'clamp(30px, 5.5vw, 62px)',
              color: '#1a1614',
              letterSpacing: '-0.5px',
              maxWidth: '640px',
            }}
          >
            Find something to do in Albuquerque.
          </h2>

          {/* Rotating personality line — hourly, server-side */}
          <p
            className="font-semibold mb-5 animate-hero-text"
            style={{
              fontFamily: 'var(--font-epilogue)',
              fontSize: 'clamp(13px, 1.8vw, 19px)',
              color: '#9a442d',
              letterSpacing: '-0.1px',
            }}
          >
            {heroSaying}
          </p>

          {/* Search + surprise */}
          <div className="flex items-center gap-3 animate-hero-row">
            <form
              action="/events"
              method="get"
              className="flex flex-1 max-w-[460px] rounded-xl overflow-hidden border border-[#d4b896]"
              style={{ boxShadow: '0 4px 20px rgba(26,22,20,.09)' }}
            >
              <input
                name="q"
                type="text"
                placeholder="Search events, venues, neighborhoods…"
                className="flex-1 bg-white text-[#1a1614] text-sm px-4 py-3 outline-none placeholder:text-[#a8958a]"
                aria-label="Search events"
              />
              <button
                type="submit"
                className="bg-[#9a442d] text-white font-bold text-sm px-5 hover:bg-[#7d3725] transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <i className="fi fi-rr-search text-[12px]" aria-hidden="true" />
                Search
              </button>
            </form>
            <span className="text-[11px] text-[#8a7a74] hidden sm:block whitespace-nowrap">
              {allUpcoming.total.toLocaleString()} events
            </span>
            <SurpriseButton />
          </div>
        </div>

        {/* Stat strip — ink palette on cream */}
        <div
          className="relative z-10 mt-5"
          style={{ background: 'rgba(26,22,20,.04)', borderTop: '1px solid rgba(26,22,20,.08)' }}
        >
          <div className="max-w-6xl mx-auto grid grid-cols-3">
            {[
              { label: 'Tonight',      count: tonight.total,     href: '/events?time=tonight',      accent: true },
              { label: 'This Weekend', count: weekend.total,     href: '/events?time=this-weekend', accent: false },
              { label: 'All Upcoming', count: allUpcoming.total, href: '/events',                   accent: false },
            ].map((tab, i) => (
              <Link
                key={tab.label}
                href={tab.href}
                className="py-3.5 flex flex-col items-center transition-colors hover:bg-black/[0.04]"
                style={i < 2 ? { borderRight: '1px solid rgba(26,22,20,.08)' } : {}}
              >
                <span
                  className="font-black text-xl sm:text-2xl leading-none"
                  style={{ fontFamily: 'var(--font-epilogue)', color: tab.accent ? '#9a442d' : '#1a1614' }}
                >
                  {tab.count.toLocaleString()}
                </span>
                <span className="text-[10px] sm:text-[11px] mt-0.5" style={{ color: '#8a7a74' }}>
                  {tab.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>



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
            subtitle="Opening today"
            events={tonight.events}
            seeAllHref="/events?time=tonight"
            sectionLabel="Tonight"
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

      {/* ── Explore ABQ — places + neighborhoods unified ── */}
      <AnimateIn animation="fade-up" delay={160}>
        <section className="py-10 bg-gradient-to-b from-[#f5ece3] to-[#fbf7f1] border-y border-[#e8d5c0]/70">

          {/* Section header */}
          <div className="max-w-6xl mx-auto px-4 mb-6">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#9a442d] mb-0.5 font-semibold">Beyond tonight</p>
            <h2
              className="text-xl font-black text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Explore Albuquerque
            </h2>
          </div>

          {/* Places row */}
          <div className="mb-8">
            <div className="max-w-6xl mx-auto px-4 flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#006a62]">📍 Places &amp; things to do</p>
              <Link
                href="/things-to-do"
                className="text-xs font-semibold text-[#006a62] hover:underline flex-shrink-0 flex items-center gap-1 group"
              >
                See all
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <div
                className="flex gap-3 px-4 pb-2 snap-x"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {featuredPlaces.map((place, i) => (
                  <PlaceTeaseCard key={place.id} place={place} index={i} />
                ))}
                <Link
                  href="/things-to-do"
                  className="flex-shrink-0 w-[160px] snap-start flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#006a62]/30 text-[#006a62] hover:border-[#006a62] hover:bg-[#006a62]/5 transition-all gap-2 aspect-[4/3]"
                >
                  <ArrowRight className="w-5 h-5" />
                  <span className="text-xs font-semibold">See all places</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Neighborhoods — grid layout breaks the horizontal-scroll monotony */}
          {neighborhoodCounts.length > 0 && (
            <div>
              <div className="max-w-6xl mx-auto px-4 flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#6b5d57] font-semibold">By neighborhood</p>
                <Link
                  href="/neighborhoods"
                  className="text-xs font-semibold text-[#9a442d] hover:underline flex-shrink-0 flex items-center gap-1 group"
                >
                  See all
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              <div className="max-w-6xl mx-auto px-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {neighborhoodCounts.slice(0, 12).map(({ neighborhood, count, slug }) => (
                    <Link
                      key={slug}
                      href={`/neighborhoods/${slug}`}
                      className="flex flex-col items-start px-3 py-2.5 rounded-xl bg-white border border-[#ede4d3] hover:border-[#9a442d] hover:shadow-sm transition-all group"
                    >
                      <span
                        className="font-black text-[13px] text-[#1a1614] group-hover:text-[#9a442d] transition-colors leading-tight mb-0.5"
                        style={{ fontFamily: 'var(--font-epilogue)' }}
                      >
                        {neighborhood}
                      </span>
                      <span className="text-[10px] text-[#6b5d57] leading-snug line-clamp-1">
                        {NEIGHBORHOOD_TAGLINES[slug] ?? 'Events & local spots'}
                      </span>
                      <span className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[#9a442d]">
                        <span className="w-[4px] h-[4px] rounded-full bg-[#9a442d] flex-shrink-0" />
                        {count} event{count !== 1 ? 's' : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </AnimateIn>

      {/* ── Page close: community invitation + browse all ── */}
      <AnimateIn animation="fade-up" delay={200}>
        <section
          className="py-14"
          style={{ background: '#eedcd0', borderTop: '1px solid rgba(200,170,140,.35)' }}
        >
          <div className="max-w-xl mx-auto px-4 text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#9a442d] mb-3 font-semibold">
              ABQ Unplugged community
            </p>
            <h2
              className="font-black text-2xl sm:text-3xl text-[#1a1614] mb-3 leading-tight"
              style={{ fontFamily: 'var(--font-epilogue)', letterSpacing: '-0.4px' }}
            >
              Albuquerque showing<br />up for itself
            </h2>
            <p className="text-sm text-[#4a3f3a] mb-6 leading-relaxed">
              Track events, save favorites, and see what other ABQ locals are into. Free to join, no spam, no noise.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-7">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-[#9a442d] text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-[#7d3725] transition-colors"
              >
                Join the community
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 text-[#4a3f3a] font-semibold text-sm px-5 py-2.5 rounded-full border border-[#c8aa8c] hover:border-[#9a442d] hover:text-[#9a442d] transition-all"
              >
                See leaderboard
              </Link>
            </div>
            {/* Browse all — quiet contextual link, not a domineering button */}
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 text-xs text-[#6b5d57] hover:text-[#9a442d] transition-colors group"
            >
              Browse all {allUpcoming.total.toLocaleString()} events
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
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
          <p className="text-xs text-[#6b5d57] mb-4">Every event in Albuquerque, one place</p>
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
  Tonight:        '#006a62', // turquoise
  'This Weekend': '#9a442d', // terra
  New:            '#4a3f3a', // ink-mid — was #8a7a74 which fails WCAG AA at 10px
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
