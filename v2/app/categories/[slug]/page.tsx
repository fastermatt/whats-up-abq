import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { buildBreadcrumbs } from '@/lib/seo'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { MapPin, Calendar, ArrowLeft, ExternalLink, Tag } from 'lucide-react'
import categoryDescriptions from '@/lib/category-descriptions.json'
import categoryFaqs from '@/lib/category-faqs.json'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string }>
}

const CATEGORY_MAP: Record<string, string> = {
  'music':        'Music',
  'sports':       'Sports',
  'arts-theater': 'Arts & Theater',
  'comedy':       'Comedy',
  'family':       'Family',
  'food-drink':   'Food & Drink',
  'film':         'Film',
  'community':    'Community',
  'festivals':    'Festivals',
  'outdoor':      'Outdoor',
}

// Richer descriptions from AI enrichment — fall back to short inline strings
const CATEGORY_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(categoryDescriptions as Record<string, { description: string }>)
    .map(([slug, v]) => [slug, v.description])
)

const CATEGORY_EMOJIS: Record<string, string> = {
  'music': '🎵', 'sports': '⚽', 'arts-theater': '🎭', 'comedy': '😂',
  'family': '👨‍👩‍👧', 'food-drink': '🍺', 'film': '🎬', 'community': '🤝',
  'festivals': '🎪', 'outdoor': '🏔️',
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const category = CATEGORY_MAP[slug]
  if (!category) return { title: 'Category Not Found' }
  const catData = (categoryDescriptions as Record<string, { description: string; meta: string }>)[slug]
  const metaDesc = catData?.meta ?? `${CATEGORY_DESCRIPTIONS[slug] ?? ''} Find tickets and event details on ABQ Unplugged.`
  const titleModifier: Record<string, string> = {
    'music':        'Concerts, Shows & Live Music',
    'sports':       'Games, Races & Athletic Events',
    'arts-theater': 'Performances, Galleries & Shows',
    'comedy':       'Stand-Up, Improv & Open Mics',
    'family':       'Kid-Friendly & Family Fun',
    'food-drink':   'Tastings, Markets & Food Festivals',
    'film':         'Screenings, Festivals & Cinema',
    'community':    'Volunteering, Fairs & Local Gatherings',
    'festivals':    'Fairs, Fiestas & Cultural Events',
    'outdoor':      'Hikes, Races & Outdoor Adventures',
  }
  const modifier = titleModifier[slug] ?? `Things to Do in Albuquerque`
  const ogImagePath = getCategoryFallback(CATEGORY_MAP[slug])
  const ogImage = ogImagePath ? `https://abqunplugged.com${ogImagePath}` : 'https://abqunplugged.com/hero/hero-4.webp'
  return {
    title: `${category} Events in Albuquerque, NM | ${modifier}`,
    description: metaDesc,
    alternates: {
      // For categories that have a dedicated SEO landing page, point canonical there
      // to consolidate link equity and avoid duplicate content.
      canonical: slug === 'food-drink'
        ? 'https://abqunplugged.com/food-drink-events'
        : `https://abqunplugged.com/categories/${slug}`,
    },
    openGraph: {
      title: `${category} Events in Albuquerque, NM`,
      description: metaDesc,
      url: `https://abqunplugged.com/categories/${slug}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${category} Events in Albuquerque` }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [ogImage],
    },
  }
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params
  const category = CATEGORY_MAP[slug]
  if (!category) notFound()

  const { events, total } = await fetchEvents({ timeFilter: 'upcoming', category, limit: 40 })
  if (events.length === 0) notFound()

  const venueCounts: Record<string, number> = {}
  for (const e of events) {
    if (e.venue) venueCounts[e.venue] = (venueCounts[e.venue] ?? 0) + 1
  }
  const topVenues = Object.entries(venueCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Neighborhood cross-links: derive from the current events' neighborhood slugs
  const neighborhoodCounts: Record<string, number> = {}
  for (const e of events) {
    if (e.neighborhood) neighborhoodCounts[e.neighborhood] = (neighborhoodCounts[e.neighborhood] ?? 0) + 1
  }
  const topNeighborhoods = Object.entries(neighborhoodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([slug]) => ({
      slug,
      label: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    }))

  const subCounts: Record<string, number> = {}
  for (const e of events) {
    if (e.subcategory) subCounts[e.subcategory] = (subCounts[e.subcategory] ?? 0) + 1
  }

  const emoji = CATEGORY_EMOJIS[slug] ?? '🎉'
  const description = CATEGORY_DESCRIPTIONS[slug] ?? ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${category} Events in Albuquerque`,
    description,
    url: `https://abqunplugged.com/categories/${slug}`,
    numberOfItems: total,
  }

  const faqs = (categoryFaqs as Record<string, { q: string; a: string }[]>)[slug] ?? []
  const faqLd = faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  } : null

  const breadcrumbLd = buildBreadcrumbs([
    { name: 'Home', url: 'https://abqunplugged.com' },
    { name: 'Events', url: 'https://abqunplugged.com/events' },
    { name: `${category} Events`, url: `https://abqunplugged.com/categories/${slug}` },
  ])

  return (
    <main className="min-h-dvh bg-[--bg]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/events" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Events</span>
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-[#f0e4cc] shadow-sm p-6 mb-6">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#f0e4cc] text-[#9a442d] px-2.5 py-1 rounded-full mb-3">
            <Tag className="w-3 h-3" />
            Albuquerque Events
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1a1614] leading-tight mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            {emoji} {category} in Albuquerque
          </h1>
          <p className="text-sm text-[#6b5d57] leading-relaxed mb-3">{description}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#6b5d57]">
            <span className="font-medium text-[#1a1614]">{total.toLocaleString()} upcoming event{total !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {Object.keys(subCounts).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <Link href={`/events?category=${encodeURIComponent(category)}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#9a442d] text-white px-3 py-1.5 rounded-full">
              All {category}
            </Link>
            {Object.entries(subCounts).sort((a, b) => b[1] - a[1]).map(([sub, cnt]) => (
              <span key={sub}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-[#ddc9a3] text-[#4a3f3a] px-3 py-1.5 rounded-full">
                {sub}
                <span className="text-[#9a442d] font-bold">{cnt}</span>
              </span>
            ))}
          </div>
        )}

        {topVenues.length > 0 && (
          <div className="mb-5">
            <h2 className="text-xs font-bold text-[#6b5d57] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Top Venues
            </h2>
            <div className="flex flex-wrap gap-2">
              {topVenues.map(([venue, cnt]) => (
                <Link key={venue}
                  href={`/venues/${encodeURIComponent(venue.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-'))}`}
                  className="inline-flex items-center gap-1.5 text-xs bg-white border border-[#ddc9a3] text-[#4a3f3a] px-2.5 py-1 rounded-full hover:border-[#9a442d] hover:text-[#9a442d] transition-colors">
                  <MapPin className="w-2.5 h-2.5 text-[#9a442d]" />
                  {venue}
                  <span className="text-[#6b5d57] font-semibold">{cnt}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-sm font-bold text-[#1a1614] uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Upcoming {category} Events
        </h2>

        <div className="space-y-3">
          {events.map((event) => {
            const dateStr = event.date
              ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : null
            return (
              <Link key={event.id} href={`/events/${event.id}`}
                className="group flex gap-3 bg-white rounded-xl border border-[#f0e4cc] p-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#f0e4cc]">
                  <EventImage
                    src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
                    fallback={getCategoryFallback(event.category ?? undefined, event.id)}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    {event.subcategory && (
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-[#9a442d] mb-0.5">{event.subcategory}</span>
                    )}
                    <h3 className="text-sm font-bold text-[#1a1614] leading-tight line-clamp-2 group-hover:text-[#9a442d] transition-colors" style={{ fontFamily: 'var(--font-epilogue)' }}>
                      {event.title}
                    </h3>
                    {event.venue && (
                      <p className="text-[10px] text-[#6b5d57] flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />{event.venue}
                      </p>
                    )}
                    {dateStr && (
                      <p className="text-[10px] text-[#9a442d] font-medium flex items-center gap-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5" />{dateStr}{event.time && ` · ${event.time}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {event.price && <span className="text-[10px] font-semibold text-[#4f6249]">{event.price}</span>}
                    {event.ticketUrl && <span className="flex items-center gap-0.5 text-[10px] text-[#006a62]">Tickets <ExternalLink className="w-2.5 h-2.5" /></span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-[#f0e4cc]">
          <p className="text-xs text-[#6b5d57] leading-relaxed">
            Find upcoming {category.toLowerCase()} events in Albuquerque, NM.
            ABQ Unplugged aggregates events from Ticketmaster, Eventbrite, SeatGeek, and local sources.
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            <Link href="/events" className="text-xs font-semibold text-[#9a442d] hover:underline">Browse all events →</Link>
            {Object.entries(CATEGORY_MAP).filter(([s]) => s !== slug).slice(0, 4).map(([s, c]) => (
              <Link key={s} href={`/categories/${s}`} className="text-xs text-[#6b5d57] hover:text-[#9a442d] transition-colors">{c}</Link>
            ))}
          </div>
        </div>

        {topNeighborhoods.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[#f0e4cc]">
            <h2 className="text-xs font-bold text-[#6b5d57] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
              {category} Events by Neighborhood
            </h2>
            <div className="flex flex-wrap gap-2">
              {topNeighborhoods.map(({ slug: nSlug, label }) => (
                <Link
                  key={nSlug}
                  href={`/neighborhoods/${nSlug}`}
                  className="inline-flex items-center gap-1 text-xs bg-white border border-[#ddc9a3] text-[#4a3f3a] px-2.5 py-1 rounded-full hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
                >
                  <MapPin className="w-2.5 h-2.5 text-[#9a442d]" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {faqs.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#f0e4cc]">
            <h2 className="text-sm font-bold text-[#1a1614] uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faqs.map(({ q, a }, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#f0e4cc] p-4">
                  <h3 className="text-sm font-bold text-[#1a1614] mb-1.5" style={{ fontFamily: 'var(--font-epilogue)' }}>{q}</h3>
                  <p className="text-xs text-[#6b5d57] leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export async function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((slug) => ({ slug }))
}
