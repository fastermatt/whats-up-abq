import Link from 'next/link'
import { Fragment } from 'react'
import type { Metadata } from 'next'
import { fetchEvents, fetchRecentlyAdded, fetchFeaturedEvents, fetchNeighborhoodCounts, NormalizedEvent } from '@/lib/events'
import { getCategoryFallback, OG_IMAGE, CAROUSEL_IMAGES } from '@/lib/fallback-images'
import { HeroCarousel } from '@/app/components/HeroCarousel'
import { getHeroCopy } from '@/lib/hero-copy'
import { EventImage } from '@/app/components/EventImage'
import { MapPin, ArrowRight } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'
import MoodChips from '@/app/components/MoodChips'
import SurpriseButton from '@/app/components/SurpriseButton'
import { ConnectionQuote } from '@/app/components/ConnectionQuote'

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
  const dayStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Denver',
  })

  const heroCopy = getHeroCopy(allUpcoming.total)

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
        {/* Hero carousel — 7 WebP images, crossfade every 5.5s, time-of-day start */}
        <HeroCarousel serverIndex={Math.floor(Date.now() / 86400000) % CAROUSEL_IMAGES.length} />
        {/* Dark overlay — directional so the photo shows through at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#5a2416]/85 via-[#7d3725]/70 to-[#5a2416]/65" />
        {/* Subtle dot texture */}
        <div className="absolute inset-0 opacity-[0.06] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41IiBmaWxsPSIjZmZmIi8+PC9zdmc+')] animate-fade-in" />

        <div className="max-w-6xl mx-auto px-4 pt-5 pb-5 relative">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-5 animate-slide-down">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="" className="w-9 h-9 rounded-xl shadow-md" />
              <div>
                <p
                  className="text-xl font-black tracking-tight"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  ABQ Unplugged
                </p>
                <p className="text-[10px] text-white/50 tracking-wide uppercase">Greater Albuquerque</p>
              </div>
            </div>
            <Link
              href="/events"
              className="text-xs font-medium bg-white/15 backdrop-blur-sm px-3.5 py-1.5 rounded-full hover:bg-white/25 transition-all duration-300 hover:scale-105"
            >
              All Events
            </Link>
          </div>

          {/* Hero text */}
          <div className="animate-hero-text">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#e8a898] mb-2">
              {heroCopy.eyebrow}
            </p>
            <h2
              className="text-[28px] sm:text-4xl font-black leading-[1.05] mb-2"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {heroCopy.lines.map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </h2>
            <p className="text-xs text-white/60 mb-3">{dayStr}</p>
            {/* Surprise Me CTA — inline with hero */}
            <div className="mb-4">
              <SurpriseButton />
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2 animate-fade-up-delay">
            <QuickStat label="Tonight" count={tonight.total} href="/events?time=tonight" />
            <QuickStat label="Tomorrow" count={tomorrow.total} href="/events?time=tomorrow" />
            <QuickStat label="Weekend" count={weekend.total} href="/events?time=this-weekend" />
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
            { label: 'Music',       emoji: '🎵', cat: 'Music' },
            { label: 'Comedy',      emoji: '😂', cat: 'Comedy' },
            { label: 'Arts',        emoji: '🎭', cat: 'Arts & Theater' },
            { label: 'Sports',      emoji: '🏟️', cat: 'Sports' },
            { label: 'Food & Drink',emoji: '🍽️', cat: 'Food & Drink' },
            { label: 'Family',      emoji: '👨‍👩‍👧', cat: 'Family' },
            { label: 'Festivals',   emoji: '🎪', cat: 'Festivals' },
            { label: 'Film',        emoji: '🎬', cat: 'Film' },
            { label: 'Outdoor',     emoji: '🌵', cat: 'Outdoor' },
            { label: 'Free',        emoji: '✨', cat: null, price: 'free' },
          ].map(({ label, emoji, cat, price }) => (
            <Link
              key={label}
              href={cat ? `/events?category=${encodeURIComponent(cat)}` : `/events?price=${price}`}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-[#ddc9a3] text-xs font-semibold text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d] transition-all whitespace-nowrap"
            >
              <span>{emoji}</span>
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

      {/* ── Explore by Neighborhood ── */}
      {neighborhoodCounts.length > 0 && (
        <AnimateIn animation="fade-up" delay={200}>
          <section className="py-6 border-t border-[#f0e4cc]/60">
            <div className="max-w-6xl mx-auto px-4 mb-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a7a74] mb-0.5">Browse by area</p>
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
                    <span className="text-[10px] text-[#8a7a74] tabular-nums">
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
          <p className="text-xs text-[#8a7a74] mb-1">Every event in Albuquerque, one place</p>
          <div className="mb-4 max-w-md mx-auto">
            <ConnectionQuote size="sm" />
          </div>
          <nav className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { href: '/events',               label: 'All Events' },
              { href: '/events?time=tonight',  label: 'Tonight' },
              { href: '/events?time=this-weekend', label: 'This Weekend' },
              { href: '/neighborhoods',        label: 'Neighborhoods' },
              { href: '/submit',               label: 'Share an event' },
              { href: '/feedback',             label: 'Feedback' },
              { href: '/why',                  label: 'Why we built this' },
              { href: '/about',                label: 'About' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-[#8a7a74] hover:text-[#9a442d] transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="text-[10px] text-[#8a7a74]/60 mt-5">© {new Date().getFullYear()} ABQ Unplugged · Albuquerque, NM</p>
        </div>
      </footer>
    </main>
  )
}

// ─── Quick Stat Card ────────────────────────────────────────────────────────

function QuickStat({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 hover:bg-white/20 transition-all duration-300 hover:scale-[1.02] group"
    >
      <p className="text-[9px] uppercase tracking-widest text-white/50 mb-0.5">{label}</p>
      <p
        className="text-2xl font-black tabular-nums"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {count}
      </p>
      <p className="text-[10px] text-white/40 group-hover:text-white/60 transition-colors">events</p>
    </Link>
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
      <h4
        className="font-bold text-[#1a1614] text-xs leading-tight line-clamp-2 mb-0.5 group-hover:text-[#9a442d] transition-colors"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {event.title}
      </h4>
      {event.venue && (
        <p className="text-[10px] text-[#8a7a74] line-clamp-1 flex items-center gap-0.5">
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
      <h4
        className="font-bold text-[#1a1614] text-sm leading-tight line-clamp-2 mb-0.5 group-hover:text-[#9a442d] transition-colors"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {event.title}
      </h4>
      {event.venue && (
        <p className="text-[10px] text-[#8a7a74] line-clamp-1 flex items-center gap-0.5">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          {event.venue}
        </p>
      )}
    </Link>
  )
}
