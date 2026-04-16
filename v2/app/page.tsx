import Link from 'next/link'
import { fetchEvents, NormalizedEvent } from '@/lib/events'
import { getHeroImage, getCategoryFallback } from '@/lib/fallback-images'
import { MapPin, ArrowRight } from 'lucide-react'
import { AnimateIn } from '@/app/components/AnimateIn'

export const revalidate = 60

export default async function DiscoverPage() {
  const [tonight, tomorrow, weekend, featured] = await Promise.all([
    fetchEvents({ timeFilter: 'tonight', limit: 10 }),
    fetchEvents({ timeFilter: 'tomorrow', limit: 10 }),
    fetchEvents({ timeFilter: 'this-weekend', limit: 10 }),
    fetchEvents({ timeFilter: 'upcoming', limit: 20 }),
  ])

  const now = new Date()
  const dayStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Denver',
  })

  return (
    <main className="min-h-dvh bg-[--bg]">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden text-white">
        {/* Hero background image (rotates daily) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getHeroImage()}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#9a442d]/85 via-[#7d3725]/80 to-[#5a2416]/85" />
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41IiBmaWxsPSIjZmZmIi8+PC9zdmc+')] animate-fade-in" />

        <div className="max-w-6xl mx-auto px-4 pt-8 pb-7 relative">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8 animate-slide-down">
            <div>
              <h1
                className="text-2xl font-black tracking-tight"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                ABQ Unplugged
              </h1>
              <p className="text-[11px] text-white/50 tracking-wide uppercase">Greater Albuquerque</p>
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
              Tonight in the 505
            </p>
            <h2
              className="text-4xl sm:text-5xl font-black leading-[1.05] mb-3"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              What&apos;s<br />Happening<br />Tonight
            </h2>
            <p className="text-sm text-white/60 mb-6">{dayStr}</p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 animate-fade-up-delay">
            <QuickStat label="Tonight" count={tonight.total} href="/events?time=tonight" />
            <QuickStat label="Tomorrow" count={tomorrow.total} href="/events?time=tomorrow" />
            <QuickStat label="Weekend" count={weekend.total} href="/events?time=this-weekend" />
          </div>
        </div>
      </section>

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

      {/* ── Browse All CTA ── */}
      <AnimateIn animation="scale" delay={50}>
        <section className="max-w-6xl mx-auto px-4 py-8">
          <Link
            href="/events"
            className="group flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#9a442d] text-white font-semibold hover:bg-[#7d3725] transition-all duration-300 text-sm hover:shadow-lg hover:shadow-[#9a442d]/20"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Browse All {featured.total.toLocaleString()} Events
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>
      </AnimateIn>

      {/* ── Footer ── */}
      <footer className="border-t border-[#f0e4cc] py-8 text-center">
        <p
          className="text-sm font-bold text-[#1a1614] mb-1"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          ABQ Unplugged
        </p>
        <p className="text-xs text-[#8a7a74]">Every event in Albuquerque, one place</p>
      </footer>
    </main>
  )
}

// ─── Quick Stat Card ────────────────────────────────────────────────────────

function QuickStat({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="bg-white/10 backdrop-blur-sm rounded-xl p-3 hover:bg-white/20 transition-all duration-300 hover:scale-[1.02] group"
    >
      <p className="text-[10px] uppercase tracking-widest text-white/50 mb-0.5">{label}</p>
      <p
        className="text-3xl font-black tabular-nums"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {count}
      </p>
      <p className="text-xs text-white/40 group-hover:text-white/60 transition-colors">events</p>
    </Link>
  )
}

// ─── Horizontal Scrolling Event Section ─────────────────────────────────────

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
  return (
    <section className="py-6">
      <div className="max-w-6xl mx-auto px-4 flex items-end justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a7a74] mb-0.5">{subtitle}</p>
          <h3
            className="text-xl font-black text-[#1a1614]"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {title}
          </h3>
        </div>
        <Link
          href={seeAllHref}
          className="text-xs font-semibold text-[#9a442d] hover:underline flex-shrink-0 flex items-center gap-1 group"
        >
          See all
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div
        className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {events.map((event) => (
          <HorizontalCard key={event.id} event={event} sectionLabel={sectionLabel} />
        ))}
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
      className="group flex-shrink-0 w-[220px] snap-start"
    >
      {/* Landscape image */}
      <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3] mb-1.5 shadow-sm group-hover:shadow-md transition-shadow duration-300">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
          alt=""
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
        className="font-bold text-[#1a1614] text-[11px] leading-tight line-clamp-2 mb-0.5 group-hover:text-[#9a442d] transition-colors"
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
