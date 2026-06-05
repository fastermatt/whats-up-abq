import Link from 'next/link'
import type { Metadata } from 'next'
import { Clock, MapPin } from 'lucide-react'
import { fetchTonightRanked, NormalizedEvent } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { QuickSaveButton } from '@/app/components/QuickSaveButton'
import { buildBreadcrumbs } from '@/lib/seo'

export const revalidate = 60

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Denver',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  return {
    title: 'Tonight in Albuquerque',
    description: `What's happening tonight in Albuquerque — ${today}. Music, arts, food, comedy, sports and more.`,
    openGraph: {
      title: 'Tonight in Albuquerque — ABQ Unplugged',
      description: `What's happening tonight in Albuquerque, NM.`,
      url: 'https://abqunplugged.com/tonight',
    },
    alternates: { canonical: 'https://abqunplugged.com/tonight' },
  }
}

// ─── FAQs ─────────────────────────────────────────────────────────────────────

const TONIGHT_FAQS = [
  {
    q: 'Where can I find last-minute events tonight in Albuquerque?',
    a: "Check Instagram stories from @sisterabq, @launchpadabq, @tractorbrewing. The ABQ Unplugged tonight feed updates throughout the day. But honestly? Walk to Nob Hill — Central Ave between Girard and Carlisle, ABQ's main nightlife strip — and look at the marquees. That still works.",
  },
  {
    q: "What if I don't want to go out but I'm bored?",
    a: "Go anyway. Even a walk down Central Avenue at night is interesting. Get a coffee at The Shop. Sit on a patio. The point is leaving the house. You can always come back.",
  },
  {
    q: 'Are there free things to do in Albuquerque tonight?',
    a: "Often yes. Civic Plaza hosts free concerts in summer. Some bar open mics are free with a drink. The Bosque trail is free and surprisingly nice in the evening. Check the listings above and look for events marked free.",
  },
]

// ─── Category ordering for editorial groupings ────────────────────────────────

const CATEGORY_ORDER = [
  'Music',
  'Arts & Theater',
  'Comedy',
  'Food & Drink',
  'Family',
  'Sports',
  'Film',
  'Community',
  'Festivals',
  'Outdoor',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TonightPage() {
  const events = await fetchTonightRanked(60)

  const todayLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Denver',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // Group by category
  const grouped: Record<string, NormalizedEvent[]> = {}
  for (const event of events) {
    const cat = event.category ?? 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(event)
  }

  // Sort categories by editorial order, then alphabetically for unknowns
  const sortedCats = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  const breadcrumbsLd = buildBreadcrumbs([
    { name: 'Home', url: 'https://abqunplugged.com' },
    { name: 'Events', url: 'https://abqunplugged.com/events' },
    { name: 'Tonight', url: 'https://abqunplugged.com/tonight' },
  ])
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: TONIGHT_FAQS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  return (
    <main id="main" className="min-h-dvh bg-[--bg] pb-24 md:pb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* ── Header ── */}
        <div className="animate-fade-in">
          <h1
            className="text-3xl font-black text-[#1a1614] tracking-tight"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Tonight in Albuquerque
          </h1>
          <p className="text-[#6b5d57] text-sm mt-1">{todayLabel}</p>
          {events.length > 0 && (
            <p className="text-[#4a3f3a] text-base mt-3 leading-relaxed">
              {events.length === 1
                ? 'One event happening tonight. Pick it.'
                : <>Tonight, <strong className="font-bold">{events.length}</strong> events across the 505. Pick something.</>}
            </p>
          )}
        </div>

        {/* ── Empty state ── */}
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="text-5xl mb-4">🌙</div>
            <h2
              className="text-lg font-bold text-[#1a1614] mb-2"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Quiet night.
            </h2>
            <p className="text-[#6b5d57] text-sm max-w-xs mb-6">
              Nothing listed for tonight just yet — check back later or see what&apos;s coming up this weekend.
            </p>
            <Link
              href="/things-to-do-this-weekend"
              className="px-5 py-2 rounded-full bg-[#9a442d] text-white text-sm font-medium hover:bg-[#7d3725] transition-colors"
            >
              See the weekend →
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
                    <EventCard key={event.id} event={event} index={i} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── FAQ section ── */}
        <div className="mt-10 pt-8 border-t border-[#f0e4cc]">
          <h2
            className="text-base font-black text-[#1a1614] mb-4 uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Frequently Asked Questions
          </h2>
          <div className="space-y-3 max-w-3xl">
            {TONIGHT_FAQS.map(({ q, a }, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#f0e4cc] p-4 shadow-sm">
                <h3
                  className="text-sm font-bold text-[#1a1614] mb-1.5"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  {q}
                </h3>
                <p className="text-xs text-[#6b5d57] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, index }: { event: NormalizedEvent; index: number }) {
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
            <div className="absolute top-1.5 right-1.5 bg-[#1a1614]/60 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {event.subcategory ? `${event.category} · ${event.subcategory}` : event.category}
            </div>
          )}
          {event.price && (
            <div className="absolute bottom-1.5 right-1.5 bg-[#006a62]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              {event.price}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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
