import Link from 'next/link'
import type { Metadata } from 'next'
import { Clock, MapPin } from 'lucide-react'
import { fetchWeekendRanked, getWeekendDates, NormalizedEvent } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { EventImage } from '@/app/components/EventImage'
import { QuickSaveButton } from '@/app/components/QuickSaveButton'

export const revalidate = 60

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const { fri, sun } = getWeekendDates()
  const desc = `Things to do in Albuquerque this weekend (${fri} – ${sun}) — music, arts, food, sports and more.`
  return {
    title: 'This Weekend in Albuquerque',
    description: desc,
    openGraph: {
      title: 'This Weekend in Albuquerque — ABQ Unplugged',
      description: desc,
      url: 'https://abqunplugged.com/weekend',
    },
    alternates: { canonical: 'https://abqunplugged.com/weekend' },
  }
}

// ─── Category ordering ────────────────────────────────────────────────────────

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

// Map YYYY-MM-DD → friendly day label
function dayLabel(isoDate: string): string {
  // Parse as local date to avoid UTC-shift issues
  const d = new Date(isoDate + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WeekendPage() {
  const events = await fetchWeekendRanked(100)
  const { fri, sat, sun } = getWeekendDates()

  // Group by event_date (day), then by category within each day
  const byDay: Record<string, NormalizedEvent[]> = {}
  for (const event of events) {
    const day = event.date.slice(0, 10) // YYYY-MM-DD
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(event)
  }

  const sortedDays = Object.keys(byDay).sort()

  return (
    <main id="main" className="min-h-dvh bg-[--bg] pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* ── Header ── */}
        <div className="animate-fade-in">
          <h1
            className="text-3xl font-black text-[#1a1614] tracking-tight"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            This Weekend in Albuquerque
          </h1>
          <p className="text-[#8a7a74] text-sm mt-1">{fri} – {sun}</p>
        </div>

        {/* ── Empty state ── */}
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="text-5xl mb-4">🌵</div>
            <h2
              className="text-lg font-bold text-[#1a1614] mb-2"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Nothing listed yet.
            </h2>
            <p className="text-[#8a7a74] text-sm max-w-xs mb-6">
              Weekend events haven&apos;t been added yet — check back closer to the weekend or browse all upcoming events.
            </p>
            <Link
              href="/events"
              className="px-5 py-2 rounded-full bg-[#9a442d] text-white text-sm font-medium hover:bg-[#7d3725] transition-colors"
            >
              Browse All Events →
            </Link>
          </div>
        ) : (
          <div className="space-y-12 animate-fade-in">
            {sortedDays.map((day) => {
              const dayEvents = byDay[day]
              const label = dayLabel(day)

              // Group within this day by category
              const byCat: Record<string, NormalizedEvent[]> = {}
              for (const event of dayEvents) {
                const cat = event.category ?? 'Other'
                if (!byCat[cat]) byCat[cat] = []
                byCat[cat].push(event)
              }

              const sortedCats = Object.keys(byCat).sort((a, b) => {
                const ai = CATEGORY_ORDER.indexOf(a)
                const bi = CATEGORY_ORDER.indexOf(b)
                if (ai === -1 && bi === -1) return a.localeCompare(b)
                if (ai === -1) return 1
                if (bi === -1) return -1
                return ai - bi
              })

              return (
                <section key={day}>
                  {/* Day header */}
                  <h2
                    className="text-2xl font-black text-[#9a442d] mb-5 border-b-2 border-[#9a442d]/20 pb-2"
                    style={{ fontFamily: 'var(--font-epilogue)' }}
                  >
                    {label}
                  </h2>

                  <div className="space-y-8">
                    {sortedCats.map((cat) => (
                      <div key={cat}>
                        <h3
                          className="text-base font-bold text-[#1a1614] mb-3 border-b border-[#f0e4cc] pb-1"
                          style={{ fontFamily: 'var(--font-epilogue)' }}
                        >
                          {cat}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                          {byCat[cat].map((event, i) => (
                            <EventCard key={event.id} event={event} index={i} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {/* ── View all link ── */}
        {events.length > 0 && (
          <div className="text-center pt-4">
            <Link
              href="/events"
              className="text-sm text-[#9a442d] font-medium hover:underline"
            >
              Browse all upcoming events →
            </Link>
          </div>
        )}
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
            <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
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
            <p className="text-[10px] text-[#8a7a74] line-clamp-1 flex items-center gap-1">
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
