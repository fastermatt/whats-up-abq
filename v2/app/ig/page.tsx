import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents, fetchRecentlyAdded, fetchFeaturedEvents } from '@/lib/events'
import { getCategoryFallback, getHeroImage } from '@/lib/fallback-images'
import {
  Calendar, Sparkles, MapPin, Bookmark, Mail, Info, ArrowRight,
  Heart, Flame,
} from 'lucide-react'
import { ConnectionQuote } from '@/app/components/ConnectionQuote'
import { EventImage } from '@/app/components/EventImage'

// Short cache — this page is the bio link on Instagram, so it should stay
// fresh but not thrash the DB if the account takes off.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'ABQ Unplugged — For Instagram',
  description: 'Every event in Albuquerque, in one place. Pick one. Show up.',
  // noindex so this doesn't compete with the homepage in search results
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://abqunplugged.com/ig' },
}

export default async function IgLandingPage() {
  const [tonight, tomorrow, weekend, featured, justAdded] = await Promise.all([
    fetchEvents({ timeFilter: 'tonight', limit: 1 }),
    fetchEvents({ timeFilter: 'tomorrow', limit: 1 }),
    fetchEvents({ timeFilter: 'this-weekend', limit: 1 }),
    fetchFeaturedEvents(4),
    fetchRecentlyAdded(4),
  ])

  const now = new Date()
  const dayStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Denver',
  })

  // UTM-tag every outbound link so Instagram traffic shows up distinctly
  const utm = '?utm_source=instagram&utm_medium=bio&utm_campaign=link_in_bio'
  const utmAmp = '&utm_source=instagram&utm_medium=bio&utm_campaign=link_in_bio'

  // The hero gets a vintage-poster landscape, but short (~170px mobile)
  const heroSrc = getHeroImage()

  const categoryChips: { label: string; emoji: string; cat?: string; price?: string }[] = [
    { label: 'Tonight', emoji: '🌙', cat: undefined, price: undefined }, // handled specially
    { label: 'Music',        emoji: '🎵', cat: 'Music' },
    { label: 'Comedy',       emoji: '😂', cat: 'Comedy' },
    { label: 'Arts',         emoji: '🎭', cat: 'Arts & Theater' },
    { label: 'Sports',       emoji: '🏟️', cat: 'Sports' },
    { label: 'Food',         emoji: '🍽️', cat: 'Food & Drink' },
    { label: 'Family',       emoji: '👨‍👩‍👧', cat: 'Family' },
    { label: 'Free',         emoji: '✨', price: 'free' },
  ]

  return (
    <main className="min-h-dvh bg-[--bg]">
      {/* ── Compact hero with real landscape image ── */}
      <section className="relative overflow-hidden text-white h-[170px] sm:h-[190px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Directional overlay — darker at top, image bleeds through at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#7d3725]/80 via-[#9a442d]/60 to-[#5a2416]/40" />
        <div className="relative max-w-md mx-auto px-5 pt-5 pb-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#e8a898] font-semibold mb-1.5">
            abqunplugged.com
          </p>
          <h1
            className="text-3xl font-black leading-[1.05]"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Every event in<br />Albuquerque
          </h1>
          <p className="text-xs text-white/70 mt-1.5">{dayStr} · {tonight.total + tomorrow.total + weekend.total}+ events this week</p>
        </div>
      </section>

      {/* ── "Hey Instagram" welcome card — special for IG traffic only ── */}
      <section className="max-w-md mx-auto px-5 -mt-6 relative z-10">
        <div className="bg-white border border-[#ddc9a3] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <Heart className="w-4 h-4 text-[#9a442d] fill-[#9a442d]" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a442d] font-bold">
              Hey Instagram
            </p>
          </div>
          <p className="text-sm text-[#1a1614] leading-relaxed">
            You came from the gram 👋 — welcome. This is the whole site, compressed
            into one page. Tap anything below to jump in.
          </p>
          <Link
            href={`/why${utm}`}
            className="inline-block mt-2 text-[11px] font-semibold text-[#006a62] hover:underline"
          >
            Why we built this →
          </Link>
        </div>
      </section>

      {/* ── Primary CTA row: the "do something now" buttons ── */}
      <section className="max-w-md mx-auto px-5 pt-5 space-y-2.5">
        {/* Tonight — the biggest CTA */}
        <Link
          href={`/events?time=tonight${utmAmp}`}
          className="flex items-center gap-4 bg-[#9a442d] text-white rounded-2xl p-4 shadow-md active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Flame className="w-5 h-5" />
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

        {/* Surprise Me */}
        <Link
          href={`/api/surprise${utm}`}
          className="flex items-center gap-4 bg-[#006a62] text-white rounded-2xl p-4 shadow-md active:scale-[0.98] transition-transform"
        >
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/60 font-semibold">Surprise me</p>
            <p className="text-base font-black leading-tight" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Send me somewhere random
            </p>
            <p className="text-[11px] text-white/70">One click → one event →</p>
          </div>
          <ArrowRight className="w-5 h-5 flex-shrink-0" />
        </Link>

        {/* Weekend + Tomorrow — side by side, smaller */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href={`/events?time=this-weekend${utmAmp}`}
            className="bg-white border border-[#ddc9a3] rounded-2xl p-3 shadow-sm active:scale-[0.98] transition-transform"
          >
            <p className="text-[9px] uppercase tracking-wider text-[#4f6249] font-semibold">Weekend</p>
            <p className="text-xl font-black text-[#1a1614] leading-tight tabular-nums mt-0.5"
               style={{ fontFamily: 'var(--font-epilogue)' }}>
              {weekend.total}
            </p>
            <p className="text-[10px] text-[#6b5d57]">events Fri–Sun</p>
          </Link>
          <Link
            href={`/events?time=tomorrow${utmAmp}`}
            className="bg-white border border-[#ddc9a3] rounded-2xl p-3 shadow-sm active:scale-[0.98] transition-transform"
          >
            <p className="text-[9px] uppercase tracking-wider text-[#6b5d57] font-semibold">Tomorrow</p>
            <p className="text-xl font-black text-[#1a1614] leading-tight tabular-nums mt-0.5"
               style={{ fontFamily: 'var(--font-epilogue)' }}>
              {tomorrow.total}
            </p>
            <p className="text-[10px] text-[#6b5d57]">events</p>
          </Link>
        </div>
      </section>

      {/* ── Category chips — like the homepage, horizontal scroll ── */}
      <section className="pt-5">
        <p className="max-w-md mx-auto px-5 text-[10px] uppercase tracking-[0.2em] text-[#9a442d] mb-2.5 font-semibold">
          Pick a vibe
        </p>
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 px-5 pb-1" style={{ scrollbarWidth: 'none' }}>
            {categoryChips.map(({ label, emoji, cat, price }) => {
              const href = cat
                ? `/events?category=${encodeURIComponent(cat)}${utmAmp}`
                : price
                ? `/events?price=${price}${utmAmp}`
                : `/events?time=tonight${utmAmp}`
              return (
                <Link
                  key={label}
                  href={href}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-[#ddc9a3] text-xs font-semibold text-[#4a3f3a] whitespace-nowrap active:scale-[0.97] transition-transform"
                >
                  <span>{emoji}</span>
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Editor's picks carousel ── */}
      {featured.length > 0 && (
        <section className="max-w-md mx-auto px-5 pt-5">
          <div className="flex items-baseline justify-between mb-2.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a442d] font-semibold flex items-center gap-1">
              <span>★</span> Editor&apos;s picks
            </p>
            <Link
              href={`/events${utm}`}
              className="text-[11px] font-semibold text-[#006a62] hover:underline"
            >
              All events →
            </Link>
          </div>
          <div className="space-y-2">
            {featured.map((event) => {
              const fallback = getCategoryFallback(event.category ?? undefined, event.id)
              const primary = event.imageUrl || fallback
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
                  <div className="w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0 bg-[#f0e4cc]">
                    <EventImage
                      src={primary}
                      fallback={fallback}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
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
                    <p className="text-[10px] text-[#6b5d57] mt-0.5 line-clamp-1">
                      {dateStr}{event.venue ? ` · ${event.venue}` : ''}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Just added — IG users love "new" ── */}
      {justAdded.length > 0 && (
        <section className="max-w-md mx-auto px-5 pt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#006a62] mb-2.5 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Just added
          </p>
          <div className="overflow-x-auto scrollbar-hide -mx-5 px-5">
            <div className="flex gap-2.5" style={{ scrollbarWidth: 'none' }}>
              {justAdded.slice(0, 4).map((event) => {
                const fallback = getCategoryFallback(event.category ?? undefined, event.id)
                const primary = event.imageUrl || fallback
                const dateStr = event.date
                  ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Denver',
                    })
                  : null
                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}${utm}`}
                    className="flex-shrink-0 w-36 bg-white rounded-xl border border-[#f0e4cc] overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
                  >
                    <div className="w-full aspect-[16/10] bg-[#f0e4cc] overflow-hidden">
                      <EventImage
                        src={primary}
                        fallback={fallback}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2">
                      <h4 className="text-[11px] font-bold text-[#1a1614] leading-tight line-clamp-2"
                          style={{ fontFamily: 'var(--font-epilogue)' }}>
                        {event.title}
                      </h4>
                      {dateStr && (
                        <p className="text-[9px] text-[#9a442d] font-medium mt-0.5">{dateStr}</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Secondary links (compact grid) ── */}
      <section className="max-w-md mx-auto px-5 pt-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#6b5d57] mb-2.5 font-semibold">
          More of the site
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/saved${utm}`}
            className="flex items-center gap-2 bg-white border border-[#ddc9a3] rounded-xl p-3 text-xs font-semibold text-[#4a3f3a] active:scale-[0.98] transition-transform"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#9a442d] flex-shrink-0" />
            <span className="flex-1">Save events</span>
          </Link>
          <Link
            href={`/neighborhoods${utm}`}
            className="flex items-center gap-2 bg-white border border-[#ddc9a3] rounded-xl p-3 text-xs font-semibold text-[#4a3f3a] active:scale-[0.98] transition-transform"
          >
            <MapPin className="w-3.5 h-3.5 text-[#006a62] flex-shrink-0" />
            <span className="flex-1">By neighborhood</span>
          </Link>
          <Link
            href={`/submit${utm}`}
            className="flex items-center gap-2 bg-white border border-[#ddc9a3] rounded-xl p-3 text-xs font-semibold text-[#4a3f3a] active:scale-[0.98] transition-transform"
          >
            <Mail className="w-3.5 h-3.5 text-[#4f6249] flex-shrink-0" />
            <span className="flex-1">Share an event</span>
          </Link>
          <Link
            href={`/about${utm}`}
            className="flex items-center gap-2 bg-white border border-[#ddc9a3] rounded-xl p-3 text-xs font-semibold text-[#4a3f3a] active:scale-[0.98] transition-transform"
          >
            <Info className="w-3.5 h-3.5 text-[#6b5d57] flex-shrink-0" />
            <span className="flex-1">About the site</span>
          </Link>
        </div>
      </section>

      {/* ── Daily quote + footer ── */}
      <section className="max-w-md mx-auto px-5 pt-7 pb-10 text-center">
        <div className="py-4 border-t border-[#ddc9a3]/60">
          <ConnectionQuote size="sm" />
        </div>
        <Link
          href={`/${utm}`}
          className="inline-block mt-5 text-[11px] font-bold text-[#9a442d] hover:underline"
        >
          See the full site →
        </Link>
        <p className="text-[10px] text-[#6b5d57] mt-3">
          abqunplugged.com · Greater Albuquerque
        </p>
        <p className="text-[10px] text-[#ddc9a3] mt-0.5">
          Built by one person with a spreadsheet and too much coffee.
        </p>
      </section>
    </main>
  )
}
