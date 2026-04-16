import Link from 'next/link'
import { fetchEvents, NormalizedEvent } from '@/lib/events'
import { MapPin, ExternalLink } from 'lucide-react'

export const revalidate = 60

export default async function DiscoverPage() {
  // Fetch multiple sections in parallel
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
      <section className="relative overflow-hidden bg-gradient-to-br from-[#9a442d] to-[#6b2a19] text-white">
        {/* Desert texture overlay */}
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIxIiBmaWxsPSIjZmZmIi8+PC9zdmc+')]" />

        <div className="max-w-6xl mx-auto px-4 pt-8 pb-6 relative">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1
                className="text-2xl font-black tracking-tight"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                ABQ Unplugged
              </h1>
              <p className="text-xs text-white/60 tracking-wide uppercase">Greater Albuquerque</p>
            </div>
            <Link
              href="/events"
              className="text-xs font-medium bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-white/25 transition-colors"
            >
              All Events
            </Link>
          </div>

          {/* Hero text */}
          <p className="text-xs uppercase tracking-[0.2em] text-[#e8a898] mb-2">
            Tonight in the 505
          </p>
          <h2
            className="text-4xl sm:text-5xl font-black leading-[1.05] mb-3"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            What&apos;s<br />Happening<br />Tonight
          </h2>
          <p className="text-sm text-white/70 mb-6">{dayStr}</p>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <QuickStat label="Tonight" count={tonight.total} href="/events?time=tonight" />
            <QuickStat label="Tomorrow" count={tomorrow.total} href="/events?time=tomorrow" />
            <QuickStat label="Weekend" count={weekend.total} href="/events?time=this-weekend" />
          </div>
        </div>
      </section>

      {/* ── Happening Now ── */}
      {tonight.events.length > 0 && (
        <EventSection
          title="Doors are open"
          subtitle="Happening right now"
          events={tonight.events}
          seeAllHref="/events?time=tonight"
        />
      )}

      {/* ── Tomorrow ── */}
      {tomorrow.events.length > 0 && (
        <EventSection
          title="Coming up tomorrow"
          subtitle="Plan ahead"
          events={tomorrow.events}
          seeAllHref="/events?time=tomorrow"
        />
      )}

      {/* ── This Weekend ── */}
      {weekend.events.length > 0 && (
        <EventSection
          title="This weekend"
          subtitle="Don&apos;t miss out"
          events={weekend.events.slice(0, 10)}
          seeAllHref="/events?time=this-weekend"
        />
      )}

      {/* ── Browse All CTA ── */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <Link
          href="/events"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#9a442d] text-white font-semibold hover:bg-[#7d3725] transition-colors text-sm"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Browse All {featured.total.toLocaleString()} Events →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#f0e4cc] py-6 text-center text-xs text-[#8a7a74]">
        <p>ABQ Unplugged · Every event in Albuquerque, one place</p>
      </footer>
    </main>
  )
}

// ─── Quick Stat Card ────────────────────────────────────────────────────────

function QuickStat({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="bg-white/10 backdrop-blur-sm rounded-xl p-3 hover:bg-white/20 transition-colors"
    >
      <p className="text-[10px] uppercase tracking-widest text-white/60 mb-0.5">{label}</p>
      <p
        className="text-3xl font-black"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {count}
      </p>
      <p className="text-xs text-white/50">events</p>
    </Link>
  )
}

// ─── Horizontal Scrolling Event Section ─────────────────────────────────────

function EventSection({
  title,
  subtitle,
  events,
  seeAllHref,
}: {
  title: string
  subtitle: string
  events: NormalizedEvent[]
  seeAllHref: string
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
          className="text-xs font-semibold text-[#9a442d] hover:underline flex-shrink-0"
        >
          See all →
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scrollbar-hide"
           style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {events.map((event) => (
          <HorizontalCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  )
}

// ─── Horizontal Scroll Card ─────────────────────────────────────────────────

function HorizontalCard({ event }: { event: NormalizedEvent }) {
  const timeStr = event.time ? `${event.time}` : ''
  const Wrapper = event.ticketUrl ? 'a' : 'div'
  const linkProps = event.ticketUrl
    ? { href: event.ticketUrl, target: '_blank' as const, rel: 'noopener noreferrer' }
    : {}

  return (
    <Wrapper
      {...linkProps}
      className="group flex-shrink-0 w-[200px] snap-start"
    >
      {/* Square image */}
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-gradient-to-br from-[#f0e4cc] to-[#ddc9a3] mb-2">
        {event.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={event.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl opacity-20">🎶</span>
          </div>
        )}

        {/* Time badge */}
        {timeStr && (
          <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-[#1a1614] text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Tonight · {timeStr}
          </div>
        )}

        {/* Category */}
        {event.category && (
          <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {event.category}
          </div>
        )}

        {/* Price */}
        {event.price && (
          <div className="absolute bottom-2 right-2 bg-[#006a62] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            {event.price}
          </div>
        )}

        {/* Ticket hover */}
        {event.ticketUrl && (
          <div className="absolute bottom-2 left-2 bg-[#9a442d] text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="w-2.5 h-2.5" />
            Tickets
          </div>
        )}
      </div>

      {/* Info */}
      <h4
        className="font-semibold text-[#1a1614] text-xs leading-tight line-clamp-2 mb-0.5"
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
    </Wrapper>
  )
}
