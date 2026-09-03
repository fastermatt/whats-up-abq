import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents, fetchNeighborhoodCounts, rankByCategoryDemand, NormalizedEvent } from '@/lib/events'
import { getCategoryFallback, OG_IMAGE } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { eventImageSrc, netlifyImageUrl } from '@/lib/image-url'
import { MapPin, ArrowRight, ExternalLink, Star } from 'lucide-react'
import { InstagramIcon } from '@/app/components/InstagramIcon'
import { AnimateIn } from '@/app/components/AnimateIn'
import MoodChips from '@/app/components/MoodChips'
import HomepageNightPlanner, { type PlannerEvent } from '@/app/components/HomepageNightPlanner'
import { fetchNowPlayingMovies, type Movie } from '@/lib/movies'
import { cachedFetch } from '@/lib/cache/redis'
import homepageStyles from '@/app/HomepageRedesign.module.css'

import { ScrollHintManager } from '@/app/components/ScrollHintManager'
import { getFeaturedPlaces, PLACE_CATEGORIES, type Place } from '@/data/places'
import { getActiveHoliday } from '@/data/holidays'
import { fetchHolidayEventsCached } from '@/lib/holidays'
import { HomepageStickyHook } from '@/app/components/HomepageStickyHook'

// ISR: regenerate every 5 min — keeps tonight/weekend lists fresh while
// letting Netlify CDN serve cached HTML for most requests (fast TTFB).
// force-static: @upstash/redis uses fetch({cache:'no-store'}) internally,
// which Next.js misreads as "dynamic". Override so the route is prerendered
// and ISR-cached. No cookies()/headers() calls in this import chain.
export const revalidate = 300
export const dynamic = 'force-static'

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
    canonical: 'https://abqunplugged.com/',
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

const HOMEPAGE_FAQS = [
  {
    q: 'What is happening in Albuquerque tonight?',
    a: 'ABQ Unplugged shows you everything happening in Albuquerque tonight — from live music at Sister Bar to comedy at Laffs Comedy Caffe and sports at Isotopes Park. Filter by Tonight to see the full list across every category and neighborhood.',
  },
  {
    q: 'What are free things to do in Albuquerque this weekend?',
    a: 'Albuquerque has dozens of free events most weekends including outdoor concerts, gallery walks, farmers markets, and community festivals. ABQ Unplugged aggregates free events from Ticketmaster, Eventbrite, SeatGeek, and local sources so you can filter by price.',
  },
  {
    q: 'What is ABQ Unplugged?',
    a: "ABQ Unplugged is Albuquerque's event aggregator, pulling together concerts, sports, arts, comedy, family events, and more from Ticketmaster, Eventbrite, SeatGeek, and dozens of local sources into one place. It is free to use and updated daily.",
  },
  {
    q: 'How do I find events in Albuquerque?',
    a: 'ABQ Unplugged makes it easy to discover events by category, neighborhood, mood, price, and time. Browse by Tonight, This Weekend, or search for something specific across all ticket sources and local calendars in one place.',
  },
  {
    q: 'What are the best things to do in Albuquerque?',
    a: 'Albuquerque offers world-class events year-round — from the International Balloon Fiesta and the New Mexico State Fair to live music at KiMo Theatre and outdoor adventures in the Sandia Mountains. ABQ Unplugged tracks over 1,000 upcoming events so there is always something worth doing.',
  },
  {
    q: 'What is there to do in Nob Hill Albuquerque?',
    a: 'Nob Hill is Albuquerque\'s most walkable entertainment district along Central Avenue. It hosts live music at bars and clubs, gallery walks, indie restaurants, and pop-up events most weekends. ABQ Unplugged lists every upcoming event in Nob Hill so you can plan your night.',
  },
  {
    q: 'What events are happening in Downtown Albuquerque?',
    a: 'Downtown Albuquerque is the cultural heart of the city, home to KiMo Theatre, Kiva Auditorium, Civic Plaza concerts, and dozens of bars and restaurants. ABQ Unplugged tracks all Downtown events including concerts, comedy, arts performances, and community gatherings.',
  },
  {
    q: 'What are fun things to do in Albuquerque with kids?',
    a: 'Albuquerque has great family-friendly options including Explora Science Center, the Rio Grande Nature Center, the New Mexico Museum of Natural History, and the ABQ BioPark. ABQ Unplugged lists kid-friendly events and family activities updated daily across the city.',
  },
  {
    q: 'Where can I find live music in Albuquerque?',
    a: "Albuquerque's live music scene spans Sister Bar, Launchpad, Sunshine Theater, Historic El Rey Theater, Popejoy Hall, and KiMo Theatre. ABQ Unplugged aggregates shows from all local venues and national ticket platforms so you never miss a show.",
  },
  {
    q: 'What concerts are coming to Albuquerque?',
    a: 'ABQ Unplugged pulls concert listings from Ticketmaster, SeatGeek, Eventbrite, and local venues — updated daily. You can browse upcoming shows by date, genre, or venue on the Music category page.',
  },
  {
    q: 'Are there things to do in Albuquerque at night?',
    a: "Albuquerque's nightlife includes live music at Nob Hill bars and Central Avenue clubs, comedy at Laffs Comedy Caffe, late-night food tours, and seasonal outdoor events. ABQ Unplugged shows tonight's events filtered by time so you can plan your evening.",
  },
  {
    q: 'What is the International Balloon Fiesta?',
    a: 'The Albuquerque International Balloon Fiesta is the world\'s largest hot-air balloon festival, held every October at Balloon Fiesta Park. It draws over 800 balloons and 900,000 attendees. ABQ Unplugged lists Balloon Fiesta events and related activities during the festival week.',
  },
  {
    q: 'What are the best outdoor activities in Albuquerque?',
    a: 'Albuquerque offers exceptional outdoor activities year-round: hiking in the Sandia Mountains, biking along the Rio Grande Bosque trail, the Sandia Peak Tramway, and numerous road races and cycling events. ABQ Unplugged tracks all outdoor events and activities in the greater Albuquerque area.',
  },
  {
    q: 'Is there a comedy club in Albuquerque?',
    a: "Yes — Laffs Comedy Caffe on Menaul is Albuquerque's dedicated stand-up comedy club, hosting touring national acts and local open-mic nights weekly. The Box Performance Space also hosts improv and sketch comedy. ABQ Unplugged lists all upcoming comedy shows in the city.",
  },
]

const homepageFaqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOMEPAGE_FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

// Organization + LocalBusiness schema — co-typing signals to Google that this
// is both an organization and a local business serving Albuquerque.
// The address and areaServed help with local pack rankings.
const organizationLd = {
  '@context': 'https://schema.org',
  '@type': ['Organization', 'LocalBusiness'],
  name: 'ABQ Unplugged',
  url: 'https://abqunplugged.com',
  logo: {
    '@type': 'ImageObject',
    url: 'https://abqunplugged.com/icon-512.png',
    width: 512,
    height: 512,
  },
  image: 'https://abqunplugged.com/og-image.jpg',
  description: 'Albuquerque\'s event aggregator — concerts, comedy, arts, sports, food and drink festivals in one place. Updated daily from Ticketmaster, Eventbrite, SeatGeek, and local sources.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Albuquerque',
    addressRegion: 'NM',
    addressCountry: 'US',
    postalCode: '87102',
  },
  areaServed: {
    '@type': 'City',
    name: 'Albuquerque',
    sameAs: 'https://www.wikidata.org/wiki/Q34804',
  },
  knowsAbout: [
    'Events in Albuquerque',
    'Live music in Albuquerque',
    'Comedy shows in Albuquerque',
    'Sports events in Albuquerque',
    'Arts and theater in Albuquerque',
    'Things to do in Albuquerque',
  ],
  foundingDate: '2024',
  sameAs: [
    'https://www.instagram.com/abqunplugged/',
    'https://www.facebook.com/abqunplugged',
  ],
}

/** Redis-cache wrapper with Supabase fallback. Silently degrades if Redis is down. */
async function rc<T>(key: string, fn: () => Promise<T>, ttl = 300): Promise<T> {
  try { return await cachedFetch(key, fn, ttl) }
  catch { return fn() }
}

export default async function DiscoverPage() {
  const featuredPlaces = getFeaturedPlaces(8)

  // Holiday window check — if active, fetch holiday-tagged events too.
  // Resolves to null outside any window, so the rail just doesn't render.
  const activeHoliday = getActiveHoliday()

  // Redis caches each data source globally (Upstash is multi-region) so even
  // Lighthouse/PSI cold-start requests get fast data after the first warm-up.
  const [tonight, weekend, allUpcoming, neighborhoodCounts, movies, holidayEvents] = await Promise.all([
    rc('hp:tonight',     () => fetchEvents({ timeFilter: 'tonight', limit: 10 }),     300),
    rc('hp:weekend',     () => fetchEvents({ timeFilter: 'this-weekend', limit: 10 }), 900),
    rc('hp:upcoming',    () => fetchEvents({ timeFilter: 'upcoming', limit: 1 }),      600),
    rc('hp:hoods',       () => fetchNeighborhoodCounts(),                              3600),
    rc('hp:movies',      () => fetchNowPlayingMovies(10),                              3600),
    activeHoliday
      ? fetchHolidayEventsCached(activeHoliday.holiday, activeHoliday.date, 8)
      : Promise.resolve([]),
  ])

  // Rebalance homepage rails by category demand. Click analytics show users
  // overwhelmingly tap Music / Comedy / Sports while the upcoming pool is
  // 37% Community — so without this, low-demand categories fill the rails.
  // We don't HIDE anything; rankByCategoryDemand() just bubbles high-demand
  // categories to the top within each rail. Applied to homepage rails only;
  // /events listing keeps its native sort so user filters work as expected.
  tonight.events = rankByCategoryDemand(tonight.events)
  weekend.events = rankByCategoryDemand(weekend.events)
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

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Denver',
  })

  // The homepage has very little room to earn trust. Collapse exact-title
  // duplicates, plus sports listings that describe the same matchup in
  // home/away order (Ticketmaster and SeatGeek commonly reverse the title).
  const uniqueTonightEvents = Array.from(
    new Map(tonight.events.map((event) => {
      const titleKey = event.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
      const sportsKey = event.category === 'Sports' && event.venue
        ? `sports:${event.venue.trim().toLowerCase()}:${event.time || ''}`
        : titleKey
      return [sportsKey, event] as const
    })).values()
  )

  const plannerEvents: PlannerEvent[] = uniqueTonightEvents.map((event) => {
    const fallback = getCategoryFallback(event.category ?? undefined, event.title)
    return {
      id: event.id,
      title: event.title,
      time: event.time,
      venue: event.venue,
      category: event.category,
      price: event.price,
      imageUrl: event.imageUrl || fallback,
      fallback,
    }
  })

  const homepagePicks = uniqueTonightEvents.slice(0, 3)

  // LCP preload — Lighthouse identified the first event card image as the LCP
  // element (NOT the hero h2). The <img> already carries fetchPriority="high"
  // + loading="eager", but the browser's preload scanner only discovers the
  // tag once HTML parsing reaches <body>. Emitting a manual <link rel="preload">
  // here (Next.js App Router hoists <link> tags to <head>) gives the browser
  // the URL ~30–100ms sooner. The href is computed via eventImageSrc() so it
  // matches the rendered <img src> byte-for-byte and the browser can de-dupe.
  // Width matches the first real-photo row in the client-side planner.
  const lcpEvent = homepagePicks[0] ?? null
  const lcpWidth = 240
  const lcpPreloadHref = lcpEvent?.imageUrl
    ? eventImageSrc(lcpEvent.imageUrl, lcpWidth)
    : null

  return (
    <main id="main" className="min-h-dvh bg-[--bg]">
      {/* Same-origin preconnect — cheap belt-and-braces hint. The image is
          served from /.netlify/images on the same origin so the document's
          existing connection is reused, but emitting this hint is harmless
          and protects against any future origin split for the image CDN. */}
      <link rel="preconnect" href="https://abqunplugged.com" crossOrigin="anonymous" />
      {/* LCP image preload — fetchPriority high so it ranks above other
          render-blocking resources. as="image" + type="image/avif" lets the
          browser narrow eligible candidates without parsing the response. */}
      {lcpPreloadHref && (
        <link
          rel="preload"
          as="image"
          href={lcpPreloadHref}
          type="image/avif"
          fetchPriority="high"
        />
      )}
      <ScrollHintManager />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageFaqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />

      {/* SEO h1 — visually hidden, provides primary keyword signal */}
      <h1 className="sr-only">Events in Albuquerque, NM — Things to Do in ABQ</h1>

      <HomepageNightPlanner dateLabel={dateLabel} events={plannerEvents} />

      <nav className={homepageStyles.quickStart} aria-label="Quick event views">
        <div className={homepageStyles.quickStartInner}>
          {[
            { label: 'Tonight', context: `${tonight.total.toLocaleString()} things`, href: '/tonight' },
            { label: 'Weekend', context: `${weekend.total.toLocaleString()} things`, href: '/weekend' },
            { label: 'Free', context: 'in ABQ', href: '/free' },
          ].map(({ label, context, href }) => (
            <Link key={label} href={href} className={homepageStyles.quickLink} aria-label={`${label} · ${context}`} data-umami-event="homepage-quick-view" data-umami-event-target={href}>
              <span className={homepageStyles.quickLabel}>
                <span>{label}</span>
                <span className={homepageStyles.quickContext}>{context}</span>
              </span>
              <span className={homepageStyles.quickArrow} aria-hidden="true"><ArrowRight /></span>
            </Link>
          ))}
        </div>
      </nav>

      {homepagePicks.length > 0 && (
        <section className={homepageStyles.picks} aria-labelledby="homepage-picks-title">
          <div className={homepageStyles.picksHead}>
            <h2 id="homepage-picks-title">Worth leaving the house for</h2>
            <Link href="/tonight">See all tonight <ArrowRight aria-hidden="true" /></Link>
          </div>
          <div className={homepageStyles.eventList}>
            {homepagePicks.map((event) => {
              const fallback = getCategoryFallback(event.category ?? undefined, event.title)
              return (
                <Link key={event.id} href={`/events/${event.id}`} className={homepageStyles.eventRow} data-umami-event="homepage-editorial-pick" data-umami-event-id={event.id}>
                  <span className={homepageStyles.eventTime}>{event.time || 'Time TBA'}</span>
                  <span className={homepageStyles.eventCategory}>{event.category || 'Local event'}</span>
                  <span className={homepageStyles.eventName}>{event.title}</span>
                  <span className={homepageStyles.eventVenue}>{event.venue || 'Albuquerque'}</span>
                  <EventImage
                    src={event.imageUrl || fallback}
                    fallback={fallback}
                    alt={`Photo for ${event.title}`}
                    className={homepageStyles.eventImage}
                    width={300}
                  />
                  <span className={homepageStyles.eventArrow}><ArrowRight aria-hidden="true" /></span>
                </Link>
              )
            })}
          </div>
          <p className={homepageStyles.photoNote}>Photos come from the event organizers when available; category art only fills gaps.</p>
        </section>
      )}

      {/* ── Inline stickiness hook — email + install, shown once ─────────────
          Renders between featured events and category chips, at the exact
          moment engagement is highest. Client component (localStorage check). */}
      <div className="hidden md:block"><HomepageStickyHook /></div>

      {/* ── Category quick links ── */}
      <section className="hidden md:block py-5 border-b border-sand-light/60 animate-fade-in">
        <div className="overflow-x-auto scrollbar-hide">
          <div
            className="flex gap-2 px-4 pb-1 scroll-hint-inner"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {[
              { label: 'Live Music',   icon: 'fi-rr-music-note', href: '/live-music' },
              { label: 'Comedy',       icon: 'fi-rr-smile',      href: '/comedy' },
              { label: 'Arts',         icon: 'fi-rr-palette',    href: '/arts' },
              { label: 'Sports',       icon: 'fi-rr-ball',       href: '/sports-events' },
              { label: 'Nightlife',    icon: 'fi-rr-cocktail',   href: '/nightlife' },
              { label: 'Food & Drink', icon: 'fi-rr-utensils',   href: '/food-drink-events' },
              { label: 'Family',       icon: 'fi-rr-users',      href: '/events?category=Family' },
              { label: 'Outdoor',      icon: 'fi-rr-leaf',       href: '/outdoor-activities' },
              { label: 'Movies',       icon: 'fi-rr-film',       href: '/movies' },
              { label: 'Film Events',  icon: 'fi-rr-clapperboard', href: '/events?category=Film' },
              { label: 'Free',         icon: 'fi-rr-ticket',     href: '/free' },
            ].map(({ label, icon, href }) => (
              <Link
                key={label}
                href={href}
                data-umami-event="category-chip"
                data-umami-event-category={label}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-card border border-sand-mid text-xs font-bold text-ink-mid shadow-[0_1px_0_rgba(26,22,20,.04)] hover:border-terra hover:bg-cream-raised hover:text-terra hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-turq/40 transition-all whitespace-nowrap group"
              >
                <i className={`fi ${icon} text-[13px] text-terra group-hover:text-terra`} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mood chips ── */}
      <MoodChips />

      {/* ── Holiday rail (only renders within an active holiday window) ──
          Picks events whose title or description matches the holiday's
          keywords AND whose date is within ±eventWindow days. Anchored at
          #holiday-rail so the banner's "scroll to events" link lands here.
          When holiday.heroImage is set, renders a 16:10 image card next
          to the title for editorial weight. Falls back to text-only when
          no image yet. */}
      {activeHoliday && holidayEvents.length > 0 && (
        <AnimateIn animation="fade-up">
          <section
            id="holiday-rail"
            className="py-8 bg-gradient-to-b from-[#fbf2ec] to-cream border-y border-terra/15"
          >
            <div className="max-w-6xl mx-auto px-4 flex items-end gap-4 mb-4">
              {activeHoliday.holiday.heroImage && (
                <div className="hidden sm:block flex-shrink-0 w-[200px] h-[125px] rounded-xl overflow-hidden shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={eventImageSrc(activeHoliday.holiday.heroImage, 400)}
                    alt={`${activeHoliday.holiday.name} hero illustration`}
                    width={400}
                    height={250}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-[0.15em] text-terra mb-0.5 font-semibold flex items-center gap-1.5">
                  <span aria-hidden="true">{activeHoliday.holiday.emoji}</span>
                  <span>{activeHoliday.holiday.name}</span>
                </p>
                <h2
                  className="text-xl font-black text-ink leading-tight"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  {activeHoliday.daysUntil === 0
                    ? `Today, ${activeHoliday.holiday.name}`
                    : activeHoliday.daysUntil === 1
                    ? `Tomorrow, ${activeHoliday.holiday.name}`
                    : `${activeHoliday.holiday.name} picks`}
                </h2>
                {activeHoliday.holiday.subtitle && (
                  <p className="text-xs text-ink-mid mt-1">{activeHoliday.holiday.subtitle}</p>
                )}
              </div>
            </div>
            <div className="max-w-6xl mx-auto px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
              {holidayEvents.map((event, i) => (
                <HorizontalCard
                  key={event.id}
                  event={event}
                  sectionLabel={activeHoliday.holiday.name}
                  index={i}
                  prioritizeFirst={false}
                />
              ))}
            </div>
          </section>
        </AnimateIn>
      )}

      {/* ── Happening Now ── */}
      {tonight.events.length > 0 && (
        <div className="hidden md:block">
          <AnimateIn animation="fade-up">
            <EventSection
              title="Doors are open"
              subtitle="Opening today"
              events={tonight.events}
              seeAllHref="/tonight"
              sectionLabel="Tonight"
            />
          </AnimateIn>
        </div>
      )}

      {/* ── This Weekend ── */}
      {weekend.events.length > 0 && (
        <AnimateIn animation="fade-up" delay={100}>
          <EventSection
            title="This weekend"
            subtitle="This Sat + Sun"
            events={weekend.events.slice(0, 10)}
            seeAllHref="/weekend"
            sectionLabel="This Weekend"
            sectionBg="#f0e8dc"
          />
        </AnimateIn>
      )}

      {/* ── Explore ABQ — places + neighborhoods unified ── */}
      <AnimateIn animation="fade-up" delay={130}>
        <section className="py-12 md:py-14 bg-gradient-to-b from-[#f5ece3] to-cream border-y border-[#e8d5c0]/70">

          {/* Section header */}
          <div className="max-w-6xl mx-auto px-4 mb-7">
            <p className="text-[10px] uppercase tracking-[0.16em] text-terra mb-1 font-bold">Beyond tonight</p>
            <h2
              className="text-2xl md:text-[28px] font-black text-ink leading-none"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Explore Albuquerque
            </h2>
          </div>

          {/* Places row */}
          <div className="mb-9">
            <div className="max-w-6xl mx-auto px-4 flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-terra">Places &amp; things to do</p>
              <Link
                href="/things-to-do"
                data-umami-event="things-to-do-cta"
                data-umami-event-position="section-header"
                className="min-h-11 text-xs font-bold text-terra hover:text-terra-hover flex-shrink-0 flex items-center gap-1 group focus-visible:ring-2 focus-visible:ring-turq/50 rounded-full px-2 py-1"
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
                  data-umami-event="things-to-do-cta"
                  data-umami-event-position="row-end-card"
                  className="flex-shrink-0 w-[160px] snap-start flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-terra/30 text-terra hover:border-terra hover:bg-terra/5 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-turq/50 transition-all gap-2 aspect-[4/3]"
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
              <div className="max-w-6xl mx-auto px-4 flex items-center justify-between mb-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink-light font-bold">By neighborhood</p>
                <Link
                  href="/neighborhoods"
                  data-umami-event="nav-see-all-neighborhoods"
                  className="min-h-11 text-xs font-bold text-terra hover:text-terra-hover flex-shrink-0 flex items-center gap-1 group focus-visible:ring-2 focus-visible:ring-turq/50 rounded-full px-2 py-1"
                >
                  See all
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              <div className="max-w-6xl mx-auto px-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {neighborhoodCounts.slice(0, 12).map(({ neighborhood, count, slug }, index) => (
                    <Link
                      key={slug}
                      href={`/neighborhoods/${slug}`}
                      data-umami-event="neighborhood-click"
                      data-umami-event-neighborhood={slug}
                      className={`${index >= 6 ? 'hidden sm:flex' : 'flex'} flex-col items-start px-3 py-3 rounded-xl bg-card border border-[#ede4d3] shadow-[0_1px_0_rgba(26,22,20,.04)] hover:border-terra hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-turq/40 transition-all group`}
                    >
                      <span
                        className="font-black text-[13px] text-ink group-hover:text-terra transition-colors leading-tight mb-0.5"
                        style={{ fontFamily: 'var(--font-epilogue)' }}
                      >
                        {neighborhood}
                      </span>
                      <span className="text-[10px] text-ink-light leading-snug line-clamp-1">
                        {NEIGHBORHOOD_TAGLINES[slug] ?? 'Events & local spots'}
                      </span>
                      <span className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-terra">
                        <span className="w-[4px] h-[4px] rounded-full bg-terra flex-shrink-0" />
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

      {/* ── Now at the movies ── */}
      {movies.length > 0 && (
        <AnimateIn animation="fade-up" delay={160}>
          <section className="py-8 md:py-10" style={{ background: '#1a1614' }}>
            <div className="max-w-6xl mx-auto px-4 flex items-end justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] mb-1 font-bold text-[#c8aa8c]">
                  In theaters now
                </p>
                <h2
                  className="text-2xl md:text-[28px] font-black text-white leading-none"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  Now at the movies
                </h2>
              </div>
              <Link
                href="/movies"
                data-umami-event="nav-see-all-movies"
                className="min-h-11 text-xs font-bold text-[#c8aa8c] hover:text-white flex-shrink-0 flex items-center gap-1 group transition-colors focus-visible:ring-2 focus-visible:ring-turq/50 rounded-full px-2 py-1"
              >
                See all
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="overflow-x-auto scrollbar-hide">
              <div
                className="flex gap-3 px-4 pb-2 snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {movies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
                {/* See all card */}
                <Link
                  href="/movies"
                  className="flex-shrink-0 w-[120px] snap-start flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/40 text-white/70 hover:border-white/60 hover:text-white focus-visible:ring-2 focus-visible:ring-turq/50 transition-all gap-2"
                  style={{ aspectRatio: '2/3' }}
                >
                  <ArrowRight className="w-5 h-5" />
                  <span className="text-[11px] font-semibold text-center px-2">All movies</span>
                </Link>
              </div>
            </div>

            <p className="text-center text-[10px] text-white/60 mt-3">
              Movie data from{' '}
              <a
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white/60 transition-colors"
              >
                TMDb
              </a>
              {' '}· Showtimes via Fandango
            </p>
          </section>
        </AnimateIn>
      )}

      {/* ── FAQ section — targets AI search / voice queries ── */}
      <AnimateIn animation="fade-up" delay={190}>
        <section className="py-5 border-t border-sand-light/60">
          <div className="max-w-3xl mx-auto px-4">
            <div className="divide-y divide-sand-light">
              {HOMEPAGE_FAQS.map(({ q, a }, i) => (
                <details key={i} className={`${i >= 5 ? 'hidden md:block ' : ''}group py-3 first:pt-0 last:pb-0`}>
                  <summary className="min-h-11 flex items-center justify-between gap-3 cursor-pointer list-none select-none">
                    <h3
                      className="text-sm font-bold text-ink group-open:text-terra transition-colors"
                      style={{ fontFamily: 'var(--font-epilogue)' }}
                    >
                      {q}
                    </h3>
                    <span className="flex-shrink-0 text-terra/60 group-open:rotate-180 transition-transform duration-200 text-[10px]">
                      ▾
                    </span>
                  </summary>
                  <p className="text-xs text-ink-light leading-relaxed mt-2 pr-6">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </AnimateIn>

      {/* ── Page close: community invitation + browse all ── */}
      <AnimateIn animation="fade-up" delay={200}>
        <section
          className="py-14"
          style={{ background: '#eedcd0', borderTop: '1px solid rgba(200,170,140,.35)' }}
        >
          <div className="max-w-xl mx-auto px-4 text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-terra mb-3 font-semibold">
              ABQ Unplugged community
            </p>
            <h2
              className="font-black text-2xl sm:text-3xl text-ink mb-3 leading-tight"
              style={{ fontFamily: 'var(--font-epilogue)', letterSpacing: '-0.4px' }}
            >
              Albuquerque showing<br />up for itself
            </h2>
            <p className="text-sm text-ink-mid mb-6 leading-relaxed">
              Track events, save favorites, and find what ABQ locals are actually doing. Free.
            </p>
            {/* Instagram follow pill — visually quieter than the primary CTAs
                so it doesn't compete with "Join the community" but still gets
                a discoverable spot in the highest-attention block on the page.
                Outbound to instagram.com so target=_blank + rel set per a11y. */}
            <a
              href="https://instagram.com/abqunplugged"
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="instagram-follow"
              data-umami-event-position="community-section"
              className="group inline-flex items-center gap-2 mb-5 px-5 py-3 min-h-[44px] rounded-full bg-white/60 hover:bg-white text-ink-mid hover:text-terra text-sm font-semibold border border-[#c8aa8c]/60 hover:border-terra transition-all"
            >
              <InstagramIcon className="w-4 h-4" />
              Follow <span className="text-terra group-hover:underline">@abqunplugged</span>
              <span className="text-[11px] text-ink-light group-hover:text-terra/80 font-normal hidden sm:inline">
                · daily picks
              </span>
            </a>
            <div className="flex flex-wrap gap-3 justify-center mb-7">
              <Link
                href="/login"
                data-umami-event="join-community-cta"
                className="min-h-11 inline-flex items-center gap-2 bg-terra text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-terra-hover transition-colors"
              >
                Join the community
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/leaderboard"
                data-umami-event="see-leaderboard-cta"
                className="min-h-11 inline-flex items-center gap-2 text-ink-mid font-semibold text-sm px-5 py-2.5 rounded-full border border-[#c8aa8c] hover:border-terra hover:text-terra transition-all"
              >
                See leaderboard
              </Link>
            </div>
            {/* Browse all — quiet contextual link, not a domineering button */}
            <Link
              href="/events"
              data-umami-event="browse-all-events-cta"
              className="min-h-11 inline-flex items-center gap-1.5 text-xs text-ink-light hover:text-terra transition-colors group"
            >
              Browse all {allUpcoming.total.toLocaleString()} events
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </section>
      </AnimateIn>

    </main>
  )
}

// ─── Movie Poster Card — portrait 2:3 card for the dark movies rail ─────────

function MovieCard({ movie }: { movie: Movie }) {
  const ratingDisplay = movie.voteAverage > 0 ? movie.voteAverage.toFixed(1) : null

  return (
    <a
      href={movie.fandangoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex-shrink-0 w-[120px] snap-start rounded-xl focus-visible:ring-2 focus-visible:ring-turq/50"
      aria-label={`${movie.title} — showtimes near Albuquerque`}
    >
      {/* Poster — 2:3 */}
      <div
        className="relative rounded-xl overflow-hidden mb-2 shadow-md ring-1 ring-white/10 group-hover:shadow-xl group-hover:-translate-y-0.5 transition-all duration-300 bg-[#2d201c]"
        style={{ aspectRatio: '2/3' }}
      >
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.posterUrl}
            alt={`${movie.title} poster`}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-40">
            <span className="text-3xl">🎬</span>
          </div>
        )}

        {/* Rating */}
        {ratingDisplay && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-ink/85 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            <Star className="w-2 h-2 fill-[#f5c518] text-[#f5c518] flex-shrink-0" />
            {ratingDisplay}
          </div>
        )}

        {/* Hover: CTA strip */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-terra to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-1.5">
          <span className="text-[9px] font-bold text-white flex items-center gap-0.5">
            <ExternalLink className="w-2.5 h-2.5" />
            Showtimes
          </span>
        </div>
      </div>

      <h3
        className="font-bold text-white text-[11px] leading-tight line-clamp-2 group-hover:text-[#c8aa8c] transition-colors"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {movie.title}
      </h3>
    </a>
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
      className="group flex-shrink-0 w-[180px] snap-start rounded-xl focus-visible:ring-2 focus-visible:ring-turq/50"
      style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
    >
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-2 shadow-sm ring-1 ring-ink/5 group-hover:shadow-lg group-hover:-translate-y-0.5 group-hover:ring-terra/25 transition-all duration-300">
        {place.image ? (
          <>
            {/* Routed through the Netlify Image CDN (place-photos live in Supabase
                Storage; serving them raw was the dominant egress source — this
                edge-caches + converts to AVIF so Storage is hit ~once per image). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={netlifyImageUrl(place.image, 360)}
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
        <div className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-cream px-1.5 py-0.5 rounded-full text-ink-mid shadow-sm ring-1 ring-ink/10">
          {catMeta?.emoji} {catMeta?.label}
        </div>
        {place.free && (
          <div className="absolute top-1.5 right-1.5 text-[10px] font-bold bg-terra text-white px-1.5 py-0.5 rounded-full shadow-sm">
            Free
          </div>
        )}
        {/* Hover: external link hint */}
        <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-white/95 rounded-full p-1 shadow-sm">
            <ExternalLink className="w-2.5 h-2.5 text-terra" />
          </div>
        </div>
      </div>
      <h3
        className="font-black text-ink text-xs leading-tight line-clamp-2 mb-0.5 group-hover:text-terra transition-colors"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {place.name}
      </h3>
      <p className="text-[10px] text-ink-light line-clamp-1">{place.tagline}</p>
    </a>
  )
}

// ─── Horizontal Scrolling Event Section ─────────────────────────────────────

// Section accent colors — each section gets a distinct accent to break monotony
const SECTION_ACCENTS: Record<string, string> = {
  Tonight:        '#006a62', // turquoise
  'This Weekend': '#9a442d', // terra
  New:            '#4a3f3a', // ink-mid — was #6b5d57 which fails WCAG AA at 10px
}

function EventSection({
  title,
  subtitle,
  events,
  seeAllHref,
  sectionLabel,
  sectionBg,
  prioritizeFirst = false,
}: {
  title: string
  subtitle: string
  events: NormalizedEvent[]
  seeAllHref: string
  sectionLabel: string
  sectionBg?: string
  prioritizeFirst?: boolean
}) {
  const accentColor = SECTION_ACCENTS[sectionLabel] ?? '#6b5d57'

  return (
    <section className="py-8 md:py-10" style={sectionBg ? { background: sectionBg } : undefined}>
      <div className="max-w-6xl mx-auto px-4 flex items-end justify-between mb-4">
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.16em] mb-1 font-bold"
            style={{ color: accentColor }}
          >
            {subtitle}
          </p>
          <h2
            className="text-2xl md:text-[28px] font-black text-ink leading-none"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {title}
          </h2>
        </div>
        <Link
          href={seeAllHref}
          data-umami-event="nav-see-all"
          data-umami-event-section={sectionLabel}
          className="min-h-11 text-xs font-bold text-terra hover:text-terra-hover flex-shrink-0 flex items-center gap-1 group focus-visible:ring-2 focus-visible:ring-turq/50 rounded-full px-2 py-1"
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
          {events.map((event, i) => (
            <HorizontalCard key={event.id} event={event} sectionLabel={sectionLabel} index={i} prioritizeFirst={prioritizeFirst} />
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
  index = 0,
  prioritizeFirst = false,
}: {
  event: NormalizedEvent
  sectionLabel: string
  index?: number
  prioritizeFirst?: boolean
}) {
  const timeStr = event.time ?? ''
  const isLCPCandidate = prioritizeFirst && index === 0

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex-shrink-0 w-[220px] snap-start scroll-reveal-slide rounded-xl focus-visible:ring-2 focus-visible:ring-turq/50"
    >
      {/* Landscape image */}
      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-sand-light mb-2 shadow-sm ring-1 ring-ink/5 group-hover:shadow-lg group-hover:-translate-y-0.5 group-hover:ring-terra/25 transition-all duration-300">
        {/* fetchPriority="high" restored on the LCP candidate (2026-05-09).
            Lighthouse caught the LCP element as this card's <img>, NOT the
            hero h2 (which renders fast from text + cached font). Without the
            priority hint the browser deprioritizes the image and LCP slips
            from ~4s to ~10s. The earlier "auto-injected preload steals from
            the h2 LCP" assumption was based on a different LCP element. */}
        <EventImage
          src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
          fallback={getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
          alt={event.title}
          loading={isLCPCandidate ? 'eager' : 'lazy'}
          fetchPriority={isLCPCandidate ? 'high' : undefined}
          width={440}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Time badge */}
        {timeStr && (
          <div className="absolute top-1.5 left-1.5 bg-cream text-ink text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ring-1 ring-ink/10">
            {sectionLabel} · {timeStr}
          </div>
        )}

        {/* Category */}
        {event.category && (
          <div className="absolute top-1.5 right-1.5 bg-ink/75 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            {event.category}
          </div>
        )}

        {/* Price */}
        {event.price && (
          <div className="absolute bottom-1.5 right-1.5 bg-turq text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
            {event.price}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Info */}
      <h3
        className="font-black text-ink text-sm leading-tight line-clamp-2 mb-0.5 group-hover:text-terra transition-colors"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {event.title}
      </h3>
      {event.venue && (
        <p className="text-[10px] text-ink-light line-clamp-1 flex items-center gap-0.5">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          {event.venue}
        </p>
      )}
    </Link>
  )
}
