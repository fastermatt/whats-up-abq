import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents, fetchFeaturedEvents } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { Camera, Calendar, Sparkles, MapPin, Bookmark, Mail, Info, ArrowRight } from 'lucide-react'
import { ConnectionQuote } from '@/app/components/ConnectionQuote'

// Short cache — this page is the bio link on Camera, so it should stay fresh
// but not thrash the DB if the account takes off.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'ABQ Unplugged — Camera Link',
  description: 'Every event in Albuquerque, in one place. Pick one. Show up.',
  // noindex this so it doesn't compete with the homepage in search results
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://abqunplugged.com/ig' },
}

export default async function IgLandingPage() {
  // Pull live counts + featured events in parallel
  const [tonight, tomorrow, weekend, featured] = await Promise.all([
    fetchEvents({ timeFilter: 'tonight', limit: 1 }),
    fetchEvents({ timeFilter: 'tomorrow', limit: 1 }),
    fetchEvents({ timeFilter: 'this-weekend', limit: 1 }),
    fetchFeaturedEvents(3),
  ])

  const now = new Date()
  const dayStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Denver',
  })

  // UTM-tag every outbound link so Camera traffic shows up distinctly in analytics
  const utm = '?utm_source=instagram&utm_medium=bio&utm_campaign=link_in_bio'

  return (
    <main className="min-h-dvh bg-[--bg]">
      {/* ── Hero — cream bg, big brand ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#fbf7f1] via-[#f5ece3] to-[#f0e4cc]">
        <div className="max-w-md mx-auto px-5 pt-8 pb-6 text-center">
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[#9a442d] font-semibold mb-3">
            <Camera className="w-3 h-3" />
            From the gram
          </div>
          <h1
            className="text-3xl font-black leading-[1.05] text-[#1a1614]"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            ABQ Unplugged
          </h1>
          <p className="text-sm text-[#4a3f3a] mt-2 leading-relaxed">
            Every event in Albuquerque.<br />
            Every ticket source. One place.
          </p>
          <p className="text-[11px] text-[#8a7a74] mt-2">{dayStr}</p>
        </div>
      </section>

      {/* ── Primary link stack ── */}
      <section className="max-w-md mx-auto px-5 py-5 space-y-3">
        {/* Tonight — the biggest CTA */}
        <Link
          href={`/events?time=tonight${utm.replace('?', '&')}`}
          className="flex items-center gap-4 bg-[#9a442d] text-white rounded-2xl p-4 shadow-md active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/60 font-semibold">Tonight</p>
            <p className="text-base font-black leading-tight" style={{ fontFamily: 'var(--font-epilogue)' }}>
              {tonight.total} {tonight.total === 1 ? 'thing' : 'things'} happening
            </p>
            <p className="text-[11px] text-white/70">See what&apos;s on →</p>
          </div>
          <ArrowRight className="w-5 h-5 flex-shrink-0" />
        </Link>

        {/* Surprise Me — the Camera-user hook */}
        <Link
          href={`/api/surprise${utm}`}
          className="flex items-center gap-4 bg-[#006a62] text-white rounded-2xl p-4 shadow-md active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/60 font-semibold">Surprise</p>
            <p className="text-base font-black leading-tight" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Send me somewhere
            </p>
            <p className="text-[11px] text-white/70">Random event from our calendar →</p>
          </div>
          <ArrowRight className="w-5 h-5 flex-shrink-0" />
        </Link>

        {/* This Weekend */}
        <Link
          href={`/events?time=this-weekend${utm.replace('?', '&')}`}
          className="flex items-center gap-4 bg-white border border-[#ddc9a3] rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl bg-[#f0e4cc] flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-[#4f6249]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#4f6249] font-semibold">This weekend</p>
            <p className="text-base font-bold text-[#1a1614] leading-tight" style={{ fontFamily: 'var(--font-epilogue)' }}>
              {weekend.total} events Fri–Sun
            </p>
            <p className="text-[11px] text-[#8a7a74]">Plan ahead →</p>
          </div>
          <ArrowRight className="w-5 h-5 text-[#9a442d] flex-shrink-0" />
        </Link>

        {/* Tomorrow */}
        {tomorrow.total > 0 && (
          <Link
            href={`/events?time=tomorrow${utm.replace('?', '&')}`}
            className="flex items-center gap-4 bg-white border border-[#ddc9a3] rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
          >
            <div className="w-11 h-11 rounded-xl bg-[#f0e4cc] flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-[#8a7a74]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a7a74] font-semibold">Tomorrow</p>
              <p className="text-base font-bold text-[#1a1614] leading-tight" style={{ fontFamily: 'var(--font-epilogue)' }}>
                {tomorrow.total} events
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-[#9a442d] flex-shrink-0" />
          </Link>
        )}
      </section>

      {/* ── Featured events carousel (vertical stack on mobile) ── */}
      {featured.length > 0 && (
        <section className="max-w-md mx-auto px-5 pb-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a442d] mb-3 font-semibold flex items-center gap-1">
            <span>★</span> Editor&apos;s picks
          </p>
          <div className="space-y-2">
            {featured.map((event) => {
              const imageUrl = event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)
              const dateStr = event.date
                ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Denver',
                  })
                : null
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}${utm}`}
                  className="flex gap-3 bg-white rounded-2xl border border-[#f0e4cc] p-2.5 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#f0e4cc]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    {event.category && (
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#9a442d] mb-0.5">
                        {event.category}
                      </p>
                    )}
                    <h3 className="text-sm font-bold text-[#1a1614] leading-tight line-clamp-2"
                        style={{ fontFamily: 'var(--font-epilogue)' }}>
                      {event.title}
                    </h3>
                    {dateStr && (
                      <p className="text-[10px] text-[#8a7a74] mt-0.5">
                        {dateStr}{event.venue ? ` · ${event.venue}` : ''}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Secondary link stack ── */}
      <section className="max-w-md mx-auto px-5 pb-5 space-y-2">
        <Link
          href={`/saved${utm}`}
          className="flex items-center gap-3 bg-white border border-[#ddc9a3] rounded-xl p-3 text-sm text-[#4a3f3a] active:scale-[0.98] transition-transform"
        >
          <Bookmark className="w-4 h-4 text-[#9a442d]" />
          <span className="flex-1 font-medium">Save your events</span>
          <ArrowRight className="w-4 h-4 text-[#9a442d]" />
        </Link>
        <Link
          href={`/neighborhoods${utm}`}
          className="flex items-center gap-3 bg-white border border-[#ddc9a3] rounded-xl p-3 text-sm text-[#4a3f3a] active:scale-[0.98] transition-transform"
        >
          <MapPin className="w-4 h-4 text-[#006a62]" />
          <span className="flex-1 font-medium">Browse by neighborhood</span>
          <ArrowRight className="w-4 h-4 text-[#9a442d]" />
        </Link>
        <Link
          href={`/submit${utm}`}
          className="flex items-center gap-3 bg-white border border-[#ddc9a3] rounded-xl p-3 text-sm text-[#4a3f3a] active:scale-[0.98] transition-transform"
        >
          <Mail className="w-4 h-4 text-[#4f6249]" />
          <span className="flex-1 font-medium">Share an event we missed</span>
          <ArrowRight className="w-4 h-4 text-[#9a442d]" />
        </Link>
        <Link
          href={`/why${utm}`}
          className="flex items-center gap-3 bg-white border border-[#ddc9a3] rounded-xl p-3 text-sm text-[#4a3f3a] active:scale-[0.98] transition-transform"
        >
          <Info className="w-4 h-4 text-[#8a7a74]" />
          <span className="flex-1 font-medium">Why we built this</span>
          <ArrowRight className="w-4 h-4 text-[#9a442d]" />
        </Link>
      </section>

      {/* ── Daily quote + footer ── */}
      <section className="max-w-md mx-auto px-5 pb-10 text-center">
        <div className="py-3 border-t border-[#ddc9a3]/60">
          <ConnectionQuote size="sm" />
        </div>
        <p className="text-[10px] text-[#8a7a74] mt-5">
          abqunplugged.com · Greater Albuquerque
        </p>
        <p className="text-[10px] text-[#ddc9a3] mt-1">
          Built by one person with a spreadsheet and too much coffee.
        </p>
      </section>
    </main>
  )
}
