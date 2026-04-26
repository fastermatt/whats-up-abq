/**
 * Reusable curated list page for SEO landing pages like /free, /family-friendly,
 * /date-night, /this-week. Each page passes a config: heading, lede, filter,
 * empty state, JSON-LD itemList enrichment.
 */
import Link from 'next/link'
import { Clock, MapPin } from 'lucide-react'
import { NormalizedEvent } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from './EventImage'
import { QuickSaveButton } from './QuickSaveButton'
import { buildBreadcrumbs } from '@/lib/seo'

const CATEGORY_ORDER = [
  'Music', 'Arts & Theater', 'Comedy', 'Food & Drink', 'Family',
  'Sports', 'Film', 'Community', 'Festivals', 'Outdoor',
]

export interface CuratedListConfig {
  /** URL slug, e.g. "free" or "date-night" */
  slug: string
  /** H1 heading */
  heading: string
  /** Short tag line under H1 */
  lede: string
  /** Body intro paragraph for SEO content (150+ words is ideal) */
  intro: string
  /** Empty state heading */
  emptyHeading: string
  /** Empty state body */
  emptyBody: string
  /** Breadcrumb leaf label */
  breadcrumbLabel: string
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
  return [itemList, breadcrumbs]
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

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <div className="animate-fade-in">
          <h1
            className="text-3xl font-black text-[#1a1614] tracking-tight"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {config.heading}
          </h1>
          <p className="text-[#6b5d57] text-sm mt-1">{config.lede}</p>

          {/* SEO body copy — keeps the page above the threshold for crawlable text */}
          <p className="text-sm text-[#4a3f3a] mt-4 max-w-3xl leading-relaxed">
            {config.intro}
          </p>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="text-5xl mb-4">🌵</div>
            <h2
              className="text-lg font-bold text-[#1a1614] mb-2"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {config.emptyHeading}
            </h2>
            <p className="text-[#6b5d57] text-sm max-w-xs mb-6">
              {config.emptyBody}
            </p>
            <Link
              href="/events"
              className="px-5 py-2 rounded-full bg-[#9a442d] text-white text-sm font-medium hover:bg-[#7d3725] transition-colors"
            >
              Browse all events →
            </Link>
          </div>
        ) : (
          <div className="space-y-10 animate-fade-in">
            {sortedCats.map((cat) => (
              <section key={cat}>
                <h2
                  className="text-lg font-black text-[#1a1614] mb-3 border-b border-[#f0e4cc] pb-1"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  {cat}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {grouped[cat].map((event, i) => (
                    <CuratedCard key={event.id} event={event} index={i} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function CuratedCard({ event, index }: { event: NormalizedEvent; index: number }) {
  const timeStr = event.time ?? ''
  return (
    <div
      className="group relative spring-card rounded-xl overflow-hidden border border-[#f0e4cc]/80 bg-white shadow-[0_1px_3px_rgba(26,22,20,0.04)] hover:shadow-[0_8px_24px_rgba(26,22,20,0.12)] transition-all duration-300 hover:-translate-y-1"
      style={{ '--card-i': Math.min(index, 14) } as React.CSSProperties}
    >
      <Link href={`/events/${event.id}`} className="flex flex-col h-full">
        <div className="relative aspect-[16/10] bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3] overflow-hidden">
          <EventImage
            src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
            fallback={getCategoryFallback(event.category ?? undefined, event.id)}
            alt={event.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
          {event.category && (
            <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {event.subcategory ? `${event.category} · ${event.subcategory}` : event.category}
            </div>
          )}
          {event.price && (
            <div className="absolute bottom-1.5 right-1.5 bg-[#006a62]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              {event.price}
            </div>
          )}
        </div>
        <div className="p-2 space-y-0.5 flex-1 flex flex-col">
          <h3
            className="font-bold text-[#1a1614] text-xs leading-tight line-clamp-2 group-hover:text-[#9a442d] transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {event.title}
          </h3>
          {timeStr && (
            <p className="text-[10px] text-[#9a442d] font-medium flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 flex-shrink-0" />
              <span>{timeStr}</span>
            </p>
          )}
          {event.venue && (
            <p className="text-[10px] text-[#6b5d57] line-clamp-1 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
              {event.venue}
            </p>
          )}
        </div>
      </Link>
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
