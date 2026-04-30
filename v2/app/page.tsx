import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents, fetchFeaturedEvents, fetchNeighborhoodCounts, NormalizedEvent } from '@/lib/events'
import { getCategoryFallback, OG_IMAGE } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { MapPin, ArrowRight, ExternalLink } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'
import MoodChips from '@/app/components/MoodChips'
import SurpriseButton from '@/app/components/SurpriseButton'
import { ConnectionQuote } from '@/app/components/ConnectionQuote'

import { ScrollHintManager } from '@/app/components/ScrollHintManager'
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
  const greeting =
    abqHour < 12 ? 'Good morning' : abqHour < 17 ? 'Good afternoon' : 'Good evening'

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
      <section className="relative overflow-hidden" style={{ background: '#fbf7f1' }}>

        {/* Sandstone floor: warm tint rises from the bottom, grounding the hero */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent 45%, rgba(232,214,183,.38) 100%)' }}
        />

        {/* Light map — ink strokes on cream, reveals right-to-left, Central Ave in terra */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0%, rgba(0,0,0,.22) 22%, rgba(0,0,0,.62) 50%, black 70%), ' +
              'linear-gradient(to bottom, transparent 0%, black 8%, black 90%, transparent 100%)',
            maskComposite: 'intersect',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, rgba(0,0,0,.22) 22%, rgba(0,0,0,.62) 50%, black 70%), ' +
              'linear-gradient(to bottom, transparent 0%, black 8%, black 90%, transparent 100%)',
            WebkitMaskComposite: 'source-in',
          }}
        >
          <div className="absolute animate-map-pan" style={{ top: '-15%', bottom: '-15%', left: '-6%', right: '-6%' }}>
            <svg
              viewBox="-900 -420 3000 1800"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
              className="absolute inset-0 w-full h-full"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Sandia silhouette — warm mesa tone on cream */}
              <path
                d="M 1080,900 L 1108,792 L 1130,682 L 1152,572 L 1170,468 L 1188,372
                   L 1206,288 L 1222,218 L 1240,160 L 1258,112 L 1276,78 L 1292,58
                   L 1308,52 L 1326,62 L 1344,86 L 1362,124 L 1382,174 L 1402,240
                   L 1422,322 L 1440,412 L 1456,506 L 1468,604 L 1478,704
                   L 1486,802 L 1492,900 Z"
                fill="rgba(107,58,34,0.07)"
              />
              <path
                d="M 1080,900 L 1108,792 L 1130,682 L 1152,572 L 1170,468 L 1188,372
                   L 1206,288 L 1222,218 L 1240,160"
                fill="none" stroke="#6b3a22" strokeWidth="1.8" strokeOpacity="0.20"
              />
              <text
                x="1295" y="420" fill="#6b3a22" fillOpacity="0.25"
                fontSize="13" letterSpacing="3" textAnchor="middle"
                transform="rotate(-78 1295 420)"
                style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
              >
                SANDIA MOUNTAINS
              </text>

              {/* Rio Grande — turquoise on cream */}
              <path
                d="M 162,0 C 158,80 168,155 160,235 C 153,308 165,380 158,458
                   C 151,528 163,608 157,685 C 151,755 162,830 158,900"
                fill="none" stroke="#006a62" strokeWidth="4.5" strokeOpacity="0.26"
              />
              <path
                d="M 158,0 C 154,80 164,155 156,235 C 149,308 161,380 154,458
                   C 147,528 159,608 153,685 C 147,755 158,830 154,900
                   L 176,900 C 176,830 168,755 172,685 C 178,608 164,528 172,458
                   C 179,380 167,308 174,235 C 180,155 170,80 174,0 Z"
                fill="rgba(0,106,98,0.07)"
              />
              <text
                x="148" y="465" fill="#006a62" fillOpacity="0.26"
                fontSize="7" letterSpacing="1.8" textAnchor="middle"
                transform="rotate(-90 148 465)"
                style={{ fontFamily: 'ui-monospace, monospace' }}
              >
                RIO GRANDE
              </text>

              {/* I-25 */}
              <path
                d="M 322,0 L 334,180 L 352,340 L 370,450 L 388,620 L 405,800 L 415,900"
                fill="none" stroke="#1a1614" strokeWidth="2.5" strokeOpacity="0.16"
              />
              {/* I-40 */}
              <path
                d="M 0,452 L 370,450 L 1040,452"
                fill="none" stroke="#1a1614" strokeWidth="2.5" strokeOpacity="0.16"
              />

              {/* Central Avenue — terra, the city's spine */}
              <path
                d="M 55,491 L 1068,491"
                fill="none" stroke="#9a442d" strokeWidth="2.8" strokeOpacity="0.52"
              />
              <text
                x="620" y="482" fill="#9a442d" fillOpacity="0.55"
                fontSize="7" letterSpacing="2.2" textAnchor="middle"
                style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}
              >
                CENTRAL AVE  ·  ROUTE 66
              </text>

              {/* E-W secondary streets */}
              <line x1="80" y1="142" x2="1048" y2="142" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <line x1="80" y1="218" x2="1048" y2="218" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <line x1="80" y1="298" x2="1048" y2="298" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <line x1="80" y1="355" x2="1048" y2="355" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.08" />
              <line x1="80" y1="404" x2="1048" y2="404" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.07" />
              <line x1="80" y1="430" x2="1048" y2="430" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.07" />
              <line x1="80" y1="515" x2="900"  y2="515" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.07" />
              <line x1="80" y1="560" x2="920"  y2="560" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <line x1="80" y1="628" x2="800"  y2="628" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.07" />

              {/* N-S secondary streets */}
              <line x1="96"  y1="0"  x2="96"  y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.08" />
              <line x1="200" y1="50" x2="200" y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.07" />
              <line x1="232" y1="0"  x2="232" y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <line x1="264" y1="60" x2="264" y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.07" />
              <line x1="295" y1="80" x2="295" y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.07" />
              <line x1="432" y1="0"  x2="432" y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <line x1="480" y1="0"  x2="480" y2="750" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.07" />
              <line x1="560" y1="0"  x2="560" y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <line x1="648" y1="0"  x2="648" y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <line x1="728" y1="0"  x2="728" y2="850" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.07" />
              <line x1="802" y1="0"  x2="802" y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <line x1="880" y1="0"  x2="880" y2="900" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />

              {/* Landmark dots */}
              <circle cx="370" cy="450" r="5"   fill="#1a1614" fillOpacity="0.20" />
              <circle cx="370" cy="450" r="9"   fill="none" stroke="#1a1614" strokeWidth="1" strokeOpacity="0.09" />
              <circle cx="232" cy="464" r="3.5" fill="#1a1614" fillOpacity="0.14" />
              <circle cx="332" cy="468" r="3.5" fill="#1a1614" fillOpacity="0.14" />
              <circle cx="455" cy="502" r="3"   fill="#1a1614" fillOpacity="0.11" />
              <circle cx="538" cy="491" r="3"   fill="#9a442d" fillOpacity="0.42" />

              {/* Map labels */}
              <text
                x="370" y="438" fill="#1a1614" fillOpacity="0.22"
                fontSize="7" letterSpacing="0.8" textAnchor="middle"
                style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
              >
                THE BIG I
              </text>
              <text
                x="232" y="479" fill="#1a1614" fillOpacity="0.18"
                fontSize="6" letterSpacing="0.5" textAnchor="middle"
                style={{ fontFamily: 'ui-monospace, monospace' }}
              >
                OLD TOWN
              </text>
              <text
                x="343" y="214" fill="#1a1614" fillOpacity="0.15"
                fontSize="5.5" letterSpacing="0.4" textAnchor="middle"
                style={{ fontFamily: 'ui-monospace, monospace' }}
              >
                BALLOON FIESTA
              </text>
            </svg>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-7 pb-5">
          {/* Geographic identifier */}
          <p
            className="text-[10px] font-semibold tracking-[0.25em] uppercase mb-3"
            style={{ color: 'rgba(26,22,20,.38)' }}
          >
            Albuquerque, New Mexico
          </p>

          {/* The identity mark */}
          <h2
            className="font-black leading-[0.88] mb-2 animate-hero-kern"
            style={{
              fontFamily: 'var(--font-epilogue)',
              fontSize: 'clamp(52px, 8vw, 96px)',
              color: '#1a1614',
              letterSpacing: '-1.5px',
            }}
          >
            The 505.
          </h2>

          {/* The self-description — a Burqueño's honest line */}
          <p
            className="font-bold mb-5 animate-hero-text"
            style={{
              fontFamily: 'var(--font-epilogue)',
              fontSize: 'clamp(15px, 2.3vw, 26px)',
              color: '#9a442d',
              letterSpacing: '-0.2px',
            }}
          >
            A small town pretending to be a city.
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

      {/* ── Community CTA ── */}
      <AnimateIn animation="fade-up" delay={160}>
        <section className="py-12 border-t border-[#f0e4cc]/60">
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
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-[#9a442d] text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-[#7d3725] transition-colors"
              >
                Join the community
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 text-[#4a3f3a] font-semibold text-sm px-5 py-2.5 rounded-full border border-[#ddc9a3] hover:border-[#9a442d] hover:text-[#9a442d] transition-all"
              >
                See leaderboard
              </Link>
            </div>
          </div>
        </section>
      </AnimateIn>

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
                    className="flex flex-col items-start px-4 py-3 rounded-xl bg-white border-[1.5px] border-[#ede4d3] hover:border-[#9a442d] hover:shadow-md transition-all group"
                    style={{ minWidth: '140px' }}
                  >
                    <span className="font-black text-[13.5px] text-[#1a1614] group-hover:text-[#9a442d] transition-colors whitespace-nowrap mb-0.5" style={{ fontFamily: 'var(--font-epilogue)' }}>
                      {neighborhood}
                    </span>
                    <span className="text-[11px] text-[#6b5d57]">{NEIGHBORHOOD_TAGLINES[slug] ?? 'Events & local spots'}</span>
                    <span className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#9a442d]">
                      <span className="w-[5px] h-[5px] rounded-full bg-[#9a442d] flex-shrink-0" />
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
