/**
 * /nightlife — Albuquerque Nightlife Discovery Page
 *
 * Custom layout (not CuratedListPage) for variety and scannability:
 *   A: Header + venue chips
 *   B: Tonight / This Weekend featured picks (client toggle)
 *   C: Local Intel — 3 hardcoded tip cards surfaced early
 *   D: Category rows — Live Music, Comedy, Brewery Nights
 *   E: FAQ accordion (SEO — FAQPage schema)
 *   F: Related links (trust signals)
 *
 * Targets: "albuquerque nightlife", "bars in albuquerque nm", "albuquerque bars tonight"
 * GSC: 557 impressions / position 38 — rewritten for CTR + depth.
 */
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Clock, MapPin, ChevronRight } from 'lucide-react'
import {
  fetchTonightRanked,
  fetchWeekendRanked,
  fetchEvents,
  normalizeRow,
  NormalizedEvent,
} from '@/lib/events'
import { createStaticClient } from '@/lib/supabase/static'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { buildBreadcrumbs } from '@/lib/seo'
import { FeaturedToggle, FeaturedEvent } from './FeaturedToggle'

export const revalidate = 3600

// ── SEO ────────────────────────────────────────────────────────────────────────

const SEO_TITLE = 'Albuquerque Nightlife: Bars, Live Music & What\'s On Tonight | ABQ Unplugged'
const SEO_DESC  = 'Sister Bar, Nob Hill, Marble Brewery, Downtown — find what\'s happening in Albuquerque tonight. Live music, comedy, taproom nights and late-night spots, all in one place.'
const OG_IMAGE  = 'https://abqunplugged.com/hero/nightlife-concert.jpg'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/nightlife',
    images: [{ url: OG_IMAGE, width: 1232, height: 928, alt: 'Live music in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/nightlife' },
}

// ── Local Intel cards (hardcoded editorial — SEO depth near the top) ──────────

const INTEL = [
  {
    q: 'Best area for bars',
    a: 'Nob Hill on Central Avenue between Girard and Carlisle. Sister Bar for dancing, Anodyne for dives, O\'Neill\'s for something quieter. Downtown works if you want variety but it\'s more spread out.',
    icon: '📍',
  },
  {
    q: 'Where to find live music',
    a: 'Launchpad on Central for rock and indie. El Rey Theater for mid-size touring acts. Canteen Brewhouse for taproom bands most weekends. Sister Bar does live DJs and the occasional band.',
    icon: '🎸',
  },
  {
    q: 'What time do things close',
    a: 'Most bars close at 2am. Breweries wrap at 10 or 11pm. Start early — around 8pm — do a brewery first, then a bar, then music. You don\'t need a 4am closing time for a good night.',
    icon: '🕙',
  },
]

// ── FAQs (schema + visible accordion at bottom) ───────────────────────────────

const FAQS = [
  {
    q: 'What\'s the best area for nightlife in Albuquerque?',
    a: 'Nob Hill on Central between Girard and Carlisle. Sister Bar (rooftop + dance floor), Anodyne (dive, pool table, good jukebox), O\'Neill\'s Pub, Nob Hill Bar & Grill. Downtown has the Library Bar and the Kosmos if you want variety but it\'s more spread out.',
  },
  {
    q: 'Which Albuquerque bars have live music?',
    a: 'Sister Bar has live DJs and bands on weekends. The Launchpad on Central is the main rock/indie venue. El Rey Theater does bigger touring acts. Canteen Brewhouse has regular live music in a great taproom setting. Marble Brewery and JUNO do acoustic sets.',
  },
  {
    q: 'What time do bars close in Albuquerque?',
    a: 'Most bars close at 2am. Breweries typically close around 10 or 11pm. Start earlier — around 8pm — do a brewery, then a bar, then live music if there\'s something worth seeing.',
  },
  {
    q: 'Is there a good craft beer scene in Albuquerque?',
    a: 'Yes. Canteen Brewhouse on Jefferson has the biggest taproom with regular live events. Marble Brewery has two locations. La Cumbre, Tractor Brewing, JUNO brewery + cafe + art. Most have regular music nights.',
  },
  {
    q: 'Are there comedy clubs in Albuquerque?',
    a: 'Hyena\'s Comedy Nightclub is the main one — national touring acts on weekends, open mic on Thursdays. The Kiva Auditorium hosts bigger touring comedians.',
  },
]

const RELATED_LINKS = [
  { name: 'Visit Albuquerque: Music & Nightlife', url: 'https://www.visitalbuquerque.org/things-to-do/music-and-nightlife/', description: 'Official city guide to bars, clubs, and live music.' },
  { name: 'Tractor Brewing', url: 'https://www.tractorbrewing.com', description: 'Local craft brewery with two taprooms and live music.' },
  { name: 'Marble Brewery', url: 'https://www.marblebrewery.com', description: 'Original ABQ craft brewery — Downtown and main taproom.' },
  { name: 'Hyena\'s Comedy Nightclub', url: 'https://www.hyenascomedynightclub.com/albuquerque/', description: 'National touring comedians and weekly open mics.' },
]

// ── Data helpers ───────────────────────────────────────────────────────────────

const NIGHTLIFE_CATS = new Set(['Music', 'Comedy', 'Food & Drink', 'Community'])

function toFeatured(events: NormalizedEvent[]): FeaturedEvent[] {
  return events
    .filter(e => NIGHTLIFE_CATS.has(e.category ?? ''))
    .slice(0, 8)
    .map(e => ({
      id:       e.id,
      title:    e.title,
      date:     e.date,
      time:     e.time ?? null,
      venue:    e.venue ?? null,
      category: e.category ?? null,
      imageUrl: e.imageUrl ?? null,
    }))
}

async function fetchBrewEvents(limit = 10): Promise<NormalizedEvent[]> {
  const supabase = createStaticClient()
  const today = new Date().toISOString().slice(0, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, pinned_last, neighborhood, venue_slug, category, venue_name, submitted_by, image_status')
    .eq('hidden', false)
    .gte('event_date', today)
    .or('venue_name.ilike.%brew%,venue_name.ilike.%taproom%,venue_name.ilike.%distill%')
    .order('event_date', { ascending: true })
    .limit(limit)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => normalizeRow(row))
}

// ── JSON-LD ────────────────────────────────────────────────────────────────────

function buildJsonLd() {
  const base = 'https://abqunplugged.com'
  return [
    buildBreadcrumbs([
      { name: 'Home',   url: base },
      { name: 'Events', url: `${base}/events` },
      { name: 'Nightlife', url: `${base}/nightlife` },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Albuquerque Nightlife',
      url: `${base}/nightlife`,
      description: SEO_DESC,
    },
  ]
}

// ── Row card (compact, for category scroll rows) ───────────────────────────────

function RowCard({ event, index }: { event: NormalizedEvent; index: number }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex-shrink-0 w-[155px] sm:w-[175px] rounded-xl overflow-hidden border border-sand-light/80 bg-white shadow-[0_1px_3px_rgba(26,22,20,0.04)] hover:shadow-[0_6px_20px_rgba(26,22,20,0.1)] hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="relative aspect-[3/2] bg-sand-light overflow-hidden">
        <EventImage
          src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
          fallback={getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
          alt={event.title}
          loading={index < 4 ? 'eager' : 'lazy'}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />
      </div>
      <div className="p-2">
        <h3
          className="font-bold text-ink text-[11px] sm:text-xs leading-snug line-clamp-2 group-hover:text-terra transition-colors"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          {event.title}
        </h3>
        {event.time ? (
          <p className="mt-1 text-[10px] text-terra font-medium flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            {event.time}
          </p>
        ) : null}
        {event.venue && (
          <p className="text-[10px] text-ink-light line-clamp-1 flex items-center gap-0.5 mt-0.5">
            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
            {event.venue}
          </p>
        )}
      </div>
    </Link>
  )
}

// ── Category row ──────────────────────────────────────────────────────────────

function CategoryRow({
  label,
  events,
  seeAllHref,
}: {
  label: string
  events: NormalizedEvent[]
  seeAllHref: string
}) {
  if (events.length === 0) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.20em] text-terra"
          style={{ fontFamily: 'var(--font-inter)' }}
        >
          {label}
        </h2>
        <Link
          href={seeAllHref}
          className="text-[11px] text-ink-light hover:text-terra flex items-center gap-0.5 transition-colors"
        >
          See all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
        {events.map((e, i) => <RowCard key={e.id} event={e} index={i} />)}
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function NightlifePage() {
  const [
    tonightAll,
    weekendAll,
    musicResult,
    comedyResult,
    brewEvents,
  ] = await Promise.all([
    fetchTonightRanked(20),
    fetchWeekendRanked(20),
    fetchEvents({ category: 'Music',   limit: 12 }),
    fetchEvents({ category: 'Comedy',  limit: 8  }),
    fetchBrewEvents(10),
  ])

  const tonightPicks  = toFeatured(tonightAll)
  const weekendPicks  = toFeatured(weekendAll)
  const musicEvents   = musicResult.events.slice(0, 10)
  const comedyEvents  = comedyResult.events.slice(0, 6)

  // Dedup brewery events against music events already shown
  const shownIds = new Set([...musicEvents, ...comedyEvents].map(e => e.id))
  const brewFiltered = brewEvents.filter(e => !shownIds.has(e.id)).slice(0, 8)

  const totalEvents = musicEvents.length + comedyEvents.length + brewFiltered.length
  const jsonLd = buildJsonLd()

  return (
    <main id="main" className="min-h-dvh bg-cream pb-24 md:pb-10">

      {/* JSON-LD */}
      {jsonLd.map((node, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }} />
      ))}

      {/* ── Hero image ── */}
      <div className="relative w-full h-44 sm:h-60 md:h-72 overflow-hidden">
        <Image
          src="/hero/nightlife-concert.jpg"
          alt="Live music in Albuquerque"
          fill priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-cream" />
      </div>

      <div className="max-w-5xl mx-auto px-4 space-y-8 pt-5">

        {/* ── A: Header ── */}
        <div>
          <h1
            className="text-3xl sm:text-4xl font-black text-ink tracking-tight leading-none"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Albuquerque Nightlife
          </h1>
          <p className="text-ink-light text-sm mt-1">
            {totalEvents > 0
              ? `${musicEvents.length} live music, ${comedyEvents.length} comedy, ${brewFiltered.length} brewery nights — updated daily.`
              : 'Bars, live music, comedy and brewery nights — updated daily.'}
          </p>
          {/* Venue chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[
              { name: 'Sister Bar',       href: 'https://www.sisterabq.com' },
              { name: 'Canteen Brewhouse', href: 'https://canteenbrewhouse.com' },
              { name: 'Launchpad',        href: 'https://launchpadrocks.com' },
              { name: "Hyena's Comedy",   href: 'https://www.hyenascomedynightclub.com/albuquerque/' },
              { name: 'Marble Brewery',   href: 'https://www.marblebrewery.com' },
              { name: 'El Rey Theater',   href: undefined },
            ].map(({ name, href }) => {
              const cls = 'flex items-center text-[11px] font-semibold text-terra px-2.5 py-1 rounded-full bg-[rgba(154,68,45,0.08)] border border-[rgba(154,68,45,0.16)] hover:bg-[rgba(154,68,45,0.15)] transition-colors'
              return href ? (
                <a key={name} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
                  {name}
                </a>
              ) : (
                <span key={name} className={cls}>{name}</span>
              )
            })}
          </div>
        </div>

        {/* ── B: Featured picks (Tonight / This Weekend toggle) ── */}
        <FeaturedToggle tonight={tonightPicks} weekend={weekendPicks} />

        {/* ── C: Local Intel — 3 quick-answer tips ── */}
        <section>
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.20em] text-terra mb-3"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            Local Intel
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {INTEL.map(({ q, a, icon }) => (
              <div
                key={q}
                className="bg-[#fdf5ec] border border-sand-light rounded-xl p-4"
              >
                <p className="text-base mb-1.5" aria-hidden="true">{icon}</p>
                <h3
                  className="text-sm font-black text-ink mb-1 leading-tight"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  {q}
                </h3>
                <p className="text-xs text-ink-mid leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── D: Category rows ── */}
        <div className="space-y-7">
          <CategoryRow
            label="Live Music"
            events={musicEvents}
            seeAllHref="/events?category=music"
          />
          <CategoryRow
            label="Comedy"
            events={comedyEvents}
            seeAllHref="/events?category=comedy"
          />
          <CategoryRow
            label="Brewery Nights"
            events={brewFiltered}
            seeAllHref="/brewery-concerts"
          />
        </div>

        {/* ── E: About Albuquerque nightlife (SEO prose) ── */}
        <section className="max-w-prose">
          <h2
            className="text-lg font-black text-ink mb-3"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            About Albuquerque Nightlife
          </h2>
          <div className="space-y-3 text-sm text-ink-mid leading-relaxed">
            <p>
              Albuquerque nightlife doesn&rsquo;t need velvet ropes or a 4am last call to be worth your evening.
              The main drag is Nob Hill — Central Avenue from Girard to Carlisle — where Sister Bar anchors
              the strip with a rooftop, a dance floor, and a crowd that actually shows up. Anodyne is a few
              blocks away: darker, a pool table, a jukebox that plays The Cure.
            </p>
            <p>
              The craft brewery scene has quietly become the backbone of Albuquerque&rsquo;s social life.
              Canteen Brewhouse on Jefferson is the biggest taproom in the city, with regular live music most
              weekends. Marble Brewery runs two locations and pulls a loyal crowd. La Cumbre, Tractor, JUNO
              brewery + cafe + art — they all close earlier than bars, but the crowds are real.
            </p>
            <p>
              Start around 8pm. Hit a brewery first. Move to a bar by 9:30. Catch live music at 10 if
              there&rsquo;s something worth seeing. By midnight, most things are winding down. That&rsquo;s fine.
              You don&rsquo;t need to burn until 3am to have had a good night.
            </p>
          </div>
        </section>

        {/* ── F: FAQ accordion ── */}
        <section>
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.20em] text-terra mb-3"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            Frequently Asked
          </h2>
          <div className="space-y-2 max-w-prose">
            {FAQS.map(({ q, a }) => (
              <details
                key={q}
                className="group bg-white border border-sand-light rounded-xl overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none text-sm font-bold text-ink hover:text-terra transition-colors select-none" style={{ fontFamily: 'var(--font-epilogue)' }}>
                  {q}
                  <ChevronRight className="w-4 h-4 flex-shrink-0 text-terra rotate-90 group-open:rotate-[270deg] transition-transform duration-200" />
                </summary>
                <p className="px-4 pb-3.5 text-xs text-ink-mid leading-relaxed border-t border-sand-light pt-3">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── G: Submit CTA ── */}
        <div className="bg-[#fdf5ec] border border-sand-light rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-prose">
          <div className="flex-1">
            <p className="text-sm font-bold text-ink" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Know a bar or show we&rsquo;re missing?
            </p>
            <p className="text-xs text-ink-light mt-0.5">We update daily but we don&rsquo;t catch everything.</p>
          </div>
          <Link
            href="/submit"
            className="shrink-0 px-5 py-2.5 rounded-full bg-terra text-white text-sm font-semibold hover:bg-terra-hover transition-colors whitespace-nowrap"
          >
            Submit an event →
          </Link>
        </div>

        {/* ── H: Related links ── */}
        <section>
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.20em] text-terra mb-3"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            Around Albuquerque
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-prose">
            {RELATED_LINKS.map(({ name, url, description }) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-0.5 bg-white rounded-xl border border-sand-light p-3.5 hover:border-terra hover:shadow-md transition-all group"
              >
                <span
                  className="text-sm font-bold text-terra group-hover:underline leading-tight"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  {name} ↗
                </span>
                <span className="text-[11px] text-ink-light leading-snug">{description}</span>
              </a>
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}
