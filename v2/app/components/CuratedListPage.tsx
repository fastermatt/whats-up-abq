/**
 * Reusable curated list page for SEO landing pages like /free, /family-friendly,
 * /date-night, /this-week. Each page passes a config: heading, lede, filter,
 * empty state, JSON-LD itemList enrichment.
 */
import Image from 'next/image'
import Link from 'next/link'
import { Clock, MapPin } from 'lucide-react'
import { NormalizedEvent, venueToSlug } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from './EventImage'
import { QuickSaveButton } from './QuickSaveButton'
import { buildBreadcrumbs } from '@/lib/seo'

const CATEGORY_ORDER = [
  'Music', 'Arts & Theater', 'Comedy', 'Food & Drink', 'Family',
  'Sports', 'Film', 'Community', 'Festivals', 'Outdoor',
]

export interface CuratedFaq {
  q: string
  a: string
}

export interface CuratedListConfig {
  /** URL slug, e.g. "free" or "date-night" */
  slug: string
  /** H1 heading */
  heading: string
  /** Short tag line under H1 */
  lede: string
  /** Body intro paragraph for SEO content (150+ words is ideal) */
  intro: string
  /** Optional second intro paragraph for additional SEO depth */
  introExtra?: string
  /** Empty state heading */
  emptyHeading: string
  /** Empty state body */
  emptyBody: string
  /** Breadcrumb leaf label */
  breadcrumbLabel: string
  /** Optional FAQ pairs — rendered as FAQPage schema + visible accordion */
  faqs?: CuratedFaq[]
  /** External trust links — "Around Albuquerque" section at page bottom.
   *  Linking out to authoritative local sources builds topical trust with Google. */
  relatedLinks?: { name: string; url: string; description: string }[]
  /** If set, renders a "Submit an event" CTA strip linking to this URL */
  submitUrl?: string
  /** Label for the submit CTA (default: "Submit an event we're missing") */
  submitLabel?: string
  /** Optional full-bleed hero image above the content */
  heroImage?: { src: string; alt: string }
  /** Optional venue strip — named venues shown between intro and events */
  venueStrip?: { name: string; href?: string; emoji?: string }[]
}

export function curatedJsonLd(events: NormalizedEvent[], config: CuratedListConfig) {
  const url = `https://abqunplugged.com/${config.slug}`
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: config.heading,
    description: config.lede,
    url,
    itemListElement: events.slice(0, 20).map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://abqunplugged.com/events/${e.id}`,
      name: e.title,
      ...(e.imageUrl ? { image: e.imageUrl } : {}),
    })),
  }
  const breadcrumbs = buildBreadcrumbs([
    { name: 'Home', url: 'https://abqunplugged.com' },
    { name: 'Events', url: 'https://abqunplugged.com/events' },
    { name: config.breadcrumbLabel, url },
  ])
  const nodes: object[] = [itemList, breadcrumbs]

  if (config.faqs && config.faqs.length > 0) {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: config.faqs.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    })
  }

  return nodes
}

export function CuratedListPage({
  events,
  config,
}: {
  events: NormalizedEvent[]
  config: CuratedListConfig
}) {
  const grouped: Record<string, NormalizedEvent[]> = {}
  for (const event of events) {
    const cat = event.category ?? 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(event)
  }
  const sortedCats = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const jsonLdNodes = curatedJsonLd(events, config)

  return (
    <main id="main" className="min-h-dvh bg-[--bg] pb-24 md:pb-8">
      {jsonLdNodes.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}

      {/* ── Optional full-bleed hero image ── */}
      {config.heroImage && (
        <div className="relative w-full h-44 sm:h-60 md:h-72 overflow-hidden">
          <Image
            src={config.heroImage.src}
            alt={config.heroImage.alt}
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-cream" />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <div className="animate-fade-in">
          <h1
            className="text-3xl font-black text-ink tracking-tight"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {config.heading}
          </h1>
          <p className="text-ink-light text-sm mt-1">{config.lede}</p>

          {/* SEO body copy keeps the page above the threshold for crawlable text.
              Split on \n\n so authors can break long intros into real paragraphs
              without HTML in the data; each chunk renders as its own <p>. */}
          <div className="mt-4 max-w-3xl space-y-3">
            {config.intro.split(/\n\n+/).map((para, i) => (
              <p key={i} className="text-sm text-ink-mid leading-relaxed">{para}</p>
            ))}
          </div>
          {config.introExtra && (
            <div className="mt-3 max-w-3xl space-y-3">
              {config.introExtra.split(/\n\n+/).map((para, i) => (
                <p key={i} className="text-sm text-ink-mid leading-relaxed">{para}</p>
              ))}
            </div>
          )}

          {/* ── Optional venue strip ── */}
          {config.venueStrip && config.venueStrip.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {config.venueStrip.map(({ name, href, emoji }) => {
                const inner = (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-terra">
                    {emoji && <span aria-hidden="true">{emoji}</span>}
                    {name}
                    {href && <span className="text-terra-mid text-[10px]">↗</span>}
                  </span>
                )
                return href ? (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-full bg-[rgba(154,68,45,0.08)] border border-[rgba(154,68,45,0.18)] hover:bg-[rgba(154,68,45,0.15)] transition-colors"
                  >
                    {inner}
                  </a>
                ) : (
                  <span
                    key={name}
                    className="px-3 py-1.5 rounded-full bg-[rgba(154,68,45,0.08)] border border-[rgba(154,68,45,0.18)]"
                  >
                    {inner}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="text-5xl mb-4">🌵</div>
            <h2
              className="text-lg font-bold text-ink mb-2"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {config.emptyHeading}
            </h2>
            <p className="text-ink-light text-sm max-w-xs mb-6">
              {config.emptyBody}
            </p>
            <Link
              href="/events"
              className="px-5 py-2 rounded-full bg-terra text-white text-sm font-medium hover:bg-terra-hover transition-colors"
            >
              Browse all events →
            </Link>
          </div>
        ) : (
          <div className="space-y-10 animate-fade-in">
            {sortedCats.map((cat) => (
              <section key={cat}>
                {/* Only render the category heading when multiple categories exist — avoids redundant
                    "Music" heading on pages that are already scoped to a single category */}
                {sortedCats.length > 1 && (
                  <h2
                    className="text-lg font-black text-ink mb-3 border-b border-sand-light pb-1"
                    style={{ fontFamily: 'var(--font-epilogue)' }}
                  >
                    {cat}
                  </h2>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {grouped[cat].map((event, i) => (
                    <CuratedCard key={event.id} event={event} index={i} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── Submit CTA ── */}
        {config.submitUrl && (
          <div className="mt-10 pt-8 border-t border-sand-light">
            <div className="bg-[#fdf5ec] border border-sand-light rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-3xl">
              <div className="flex-1">
                <p
                  className="text-sm font-bold text-ink"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  Know of an event we&apos;re missing?
                </p>
                <p className="text-xs text-ink-light mt-0.5">
                  {config.submitLabel ?? "We update daily, but we don't catch everything. Submit it and we'll add it."}
                </p>
              </div>
              <Link
                href={config.submitUrl}
                className="shrink-0 px-5 py-2.5 rounded-full bg-terra text-white text-sm font-semibold hover:bg-terra-hover transition-colors whitespace-nowrap"
              >
                Submit an event →
              </Link>
            </div>
          </div>
        )}

        {/* ── FAQ section — FAQPage schema is already emitted; this is the visible counterpart ── */}
        {config.faqs && config.faqs.length > 0 && (
          <div className="mt-10 pt-8 border-t border-sand-light">
            <h2
              className="text-base font-black text-ink mb-4 uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Frequently Asked Questions
            </h2>
            <div className="space-y-3 max-w-3xl">
              {config.faqs.map(({ q, a }, i) => (
                <div key={i} className="bg-white rounded-xl border border-sand-light p-4 shadow-sm">
                  <h3
                    className="text-sm font-bold text-ink mb-1.5"
                    style={{ fontFamily: 'var(--font-epilogue)' }}
                  >
                    {q}
                  </h3>
                  <p className="text-xs text-ink-light leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Around Albuquerque — external trust links ── */}
        {config.relatedLinks && config.relatedLinks.length > 0 && (
          <div className="mt-10 pt-8 border-t border-sand-light">
            <h2
              className="text-base font-black text-ink mb-1 uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Around Albuquerque
            </h2>
            <p className="text-xs text-ink-light mb-4">Other places to look.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
              {config.relatedLinks.map(({ name, url, description }) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-0.5 bg-white rounded-xl border border-sand-light p-3.5 shadow-sm hover:border-terra hover:shadow-md transition-all group"
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
          </div>
        )}
      </div>
    </main>
  )
}

function CuratedCard({ event, index }: { event: NormalizedEvent; index: number }) {
  const timeStr = event.time ?? ''
  // Build a short day label ("Sat Apr 26") so a parent skimming the page on
  // Friday night can tell at a glance whether each event is THIS weekend or
  // a random Tuesday three weeks out. Persona testing flagged missing dates
  // as the #1 trust signal gap on /family-friendly.
  const dayLabel = (() => {
    if (!event.date) return ''
    const ymd = /^\d{4}-\d{2}-\d{2}$/.test(event.date) ? `${event.date}T12:00:00` : event.date
    const d = new Date(ymd)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Denver',
    })
  })()
  return (
    <div
      className="group relative spring-card rounded-xl overflow-hidden border border-sand-light/80 bg-white shadow-[0_1px_3px_rgba(26,22,20,0.04)] hover:shadow-[0_8px_24px_rgba(26,22,20,0.12)] transition-all duration-300 hover:-translate-y-1"
      style={{ '--card-i': Math.min(index, 14) } as React.CSSProperties}
    >
      <Link href={`/events/${event.id}`} className="flex flex-col h-full">
        <div className="relative aspect-[16/10] bg-gradient-to-br from-sand-light to-sand-mid overflow-hidden">
          <EventImage
            src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
            fallback={getCategoryFallback(event.category ?? undefined, event.title ?? event.id)}
            alt={event.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
          {event.category && (
            <div className="absolute top-1.5 right-1.5 bg-ink/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {event.subcategory ? `${event.category} · ${event.subcategory}` : event.category}
            </div>
          )}
          {event.price && (
            <div className="absolute bottom-1.5 right-1.5 bg-turq/90 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              {event.price}
            </div>
          )}
        </div>
        <div className="px-2 pt-2 pb-0.5 space-y-0.5 flex-1 flex flex-col">
          <h3
            className="font-bold text-ink text-xs leading-tight line-clamp-2 group-hover:text-terra transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {event.title}
          </h3>
          {(dayLabel || timeStr) && (
            <p className="text-[11px] text-terra font-medium flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 flex-shrink-0" />
              <span>
                {dayLabel}{dayLabel && timeStr ? ' · ' : ''}{timeStr}
              </span>
            </p>
          )}
        </div>
      </Link>
      {/* Venue link — outside main <Link> to avoid nested anchors */}
      {event.venue && (
        <Link
          href={`/venues/${venueToSlug(event.venue)}`}
          className="flex items-center gap-1 px-2 pb-2 text-[11px] text-ink-mid hover:text-terra hover:underline line-clamp-1 transition-colors"
          aria-label={`See all events at ${event.venue}`}
        >
          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
          {event.venue}
        </Link>
      )}
      <QuickSaveButton
        eventId={event.id}
        eventName={event.title}
        eventDate={event.date}
        venueName={event.venue ?? null}
        category={event.category ?? null}
        imageUrl={event.imageUrl ?? null}
        ticketUrl={event.ticketUrl ?? null}
        className="absolute top-2 left-2 z-10"
      />
    </div>
  )
}
