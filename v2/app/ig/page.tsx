import Link from 'next/link'
import type { Metadata } from 'next'
import { fetchEvents, fetchRecentlyAdded, fetchFeaturedEvents } from '@/lib/events'
import { getCategoryFallback, getHeroImage } from '@/lib/fallback-images'
import {
  Sparkles, MapPin, Bookmark, Mail, Info, ArrowRight,
  Flame,
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

  const heroSrc = getHeroImage()
  const weekTotal = tonight.total + tomorrow.total + weekend.total

  const categoryChips: { label: string; emoji: string; cat?: string; price?: string }[] = [
    { label: 'Tonight', emoji: '🌙' },
    { label: 'Music',   emoji: '🎵', cat: 'Music' },
    { label: 'Comedy',  emoji: '😂', cat: 'Comedy' },
    { label: 'Arts',    emoji: '🎭', cat: 'Arts & Theater' },
    { label: 'Sports',  emoji: '🏟️', cat: 'Sports' },
    { label: 'Food',    emoji: '🍽️', cat: 'Food & Drink' },
    { label: 'Family',  emoji: '👨‍👩‍👧', cat: 'Family' },
    { label: 'Free',    emoji: '✨', price: 'free' },
  ]

  return (
    <main className="min-h-dvh bg-cream">

      {/* ── Hero — full-bleed poster ── */}
      <section className="relative overflow-hidden text-white h-[280px] sm:h-[310px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Gradient: heavy at top so wordmark reads, warm at bottom to anchor headline */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-terra-hover/85" />

        <div className="relative flex flex-col justify-between h-full max-w-md mx-auto px-5 pt-6 pb-6">
          {/* Wordmark */}
          <p className="text-[10px] font-black tracking-[0.28em] uppercase text-white/65">
            ABQ UNPLUGGED
          </p>

          {/* Headline + live count badge */}
          <div>
            <h1
              className="text-[2.6rem] font-black leading-[0.92] tracking-tight"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Every event<br />in Albuquerque.
            </h1>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-white/18 text-white text-[11px] font-bold px-3 py-1.5 rounded-full border border-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e8b89a] flex-shrink-0" />
                {weekTotal}+ events this week
              </span>
              <span className="text-white/45 text-[10px]">{dayStr}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Primary CTAs ── */}
      <section className="max-w-md mx-auto px-5 pt-4 space-y-2.5">

        {/* Tonight — the hero CTA, count-led */}
        <Link
          href={`/events?time=tonight${utmAmp}`}
          className="group flex items-center gap-4 bg-terra text-white rounded-2xl px-5 py-5 shadow-md active:scale-[0.98] transition-transform"
        >
          <div className="flex-shrink-0 flex items-baseline gap-1">
            <span
              className="text-[2.8rem] font-black leading-none tabular-nums"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {tonight.total}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-bold flex items-center gap-1">
              <Flame className="w-3 h-3 inline-block" />
              Tonight
            </p>
            <p className="text-sm font-semibold text-white/85">
              {tonight.total === 1 ? 'thing' : 'things'} happening now →
            </p>
          </div>
          <ArrowRight className="w-5 h-5 flex-shrink-0 text-white/30 group-hover:text-white/70 transition-colors" />
        </Link>

        {/* Surprise Me */}
        <Link
          href={`/api/surprise${utm}`}
          className="group flex items-center gap-4 bg-turq text-white rounded-2xl px-5 py-4 shadow-md active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-bold">Feeling lucky?</p>
            <p className="text-sm font-black leading-tight" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Surprise me
            </p>
          </div>
          <ArrowRight className="w-5 h-5 flex-shrink-0 text-white/30 group-hover:text-white/70 transition-colors" />
        </Link>

        {/* Weekend + Tomorrow — count cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href={`/events?time=this-weekend${utmAmp}`}
            className="bg-white border border-[#e2ccad] rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
          >
            <p className="text-[9px] uppercase tracking-wider text-sage font-bold mb-1">Weekend</p>
            <p
              className="text-[2rem] font-black text-ink leading-none tabular-nums"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {weekend.total}
            </p>
            <p className="text-[10px] text-ink-light mt-1.5">events Fri–Sun</p>
          </Link>
          <Link
            href={`/events?time=tomorrow${utmAmp}`}
            className="bg-white border border-[#e2ccad] rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
          >
            <p className="text-[9px] uppercase tracking-wider text-ink-light font-bold mb-1">Tomorrow</p>
            <p
              className="text-[2rem] font-black text-ink leading-none tabular-nums"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {tomorrow.total}
            </p>
            <p className="text-[10px] text-ink-light mt-1.5">events</p>
          </Link>
        </div>
      </section>

      {/* ── Category chips ── */}
      <section className="pt-6">
        <p className="max-w-md mx-auto px-5 text-[10px] uppercase tracking-[0.22em] text-terra mb-3 font-bold">
          What&apos;s your vibe?
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
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-sand-mid text-xs font-semibold text-ink-mid whitespace-nowrap active:scale-[0.97] transition-transform shadow-sm"
                >
                  <span>{emoji}</span>
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Editor's picks ── */}
      {featured.length > 0 && (
        <section className="max-w-md mx-auto px-5 pt-7">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-terra font-bold">
              ★ Don&apos;t miss
            </p>
            <Link
              href={`/events${utm}`}
              className="text-[11px] font-semibold text-turq hover:underline"
            >
              All events →
            </Link>
          </div>
          <div className="space-y-2">
            {featured.map((event) => {
              const fallback = getCategoryFallback(event.category ?? undefined, event.title ?? event.id)
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
                  className="flex gap-3 bg-white rounded-2xl border border-sand-light p-3 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="w-[76px] h-[76px] rounded-xl overflow-hidden flex-shrink-0 bg-sand-light">
                    <EventImage
                      src={primary}
                      fallback={fallback}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    {event.category && (
                      <p className="text-[9px] font-bold uppercase tracking-wider text-terra mb-0.5">
                        {event.category}
                      </p>
                    )}
                    <h3
                      className="text-sm font-bold text-ink leading-tight line-clamp-2"
                      style={{ fontFamily: 'var(--font-epilogue)' }}
                    >
                      {event.title}
                    </h3>
                    <p className="text-[10px] text-ink-light mt-1 line-clamp-1">
                      {dateStr}{event.venue ? ` · ${event.venue}` : ''}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Just Added ── */}
      {justAdded.length > 0 && (
        <section className="max-w-md mx-auto px-5 pt-7">
          <p className="text-[10px] uppercase tracking-[0.22em] text-turq mb-3 font-bold flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Fresh on the calendar
          </p>
          <div className="overflow-x-auto scrollbar-hide -mx-5 px-5">
            <div className="flex gap-2.5" style={{ scrollbarWidth: 'none' }}>
              {justAdded.slice(0, 4).map((event) => {
                const fallback = getCategoryFallback(event.category ?? undefined, event.title ?? event.id)
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
                    className="flex-shrink-0 w-36 bg-white rounded-xl border border-sand-light overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
                  >
                    <div className="w-full aspect-[16/10] bg-sand-light overflow-hidden">
                      <EventImage
                        src={primary}
                        fallback={fallback}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2">
                      <h4
                        className="text-[11px] font-bold text-ink leading-tight line-clamp-2"
                        style={{ fontFamily: 'var(--font-epilogue)' }}
                      >
                        {event.title}
                      </h4>
                      {dateStr && (
                        <p className="text-[9px] text-terra font-medium mt-0.5">{dateStr}</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Secondary links ── */}
      <section className="max-w-md mx-auto px-5 pt-7">
        <p className="text-[10px] uppercase tracking-[0.22em] text-ink-light mb-2.5 font-bold">
          Explore more
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/saved${utm}`}
            className="flex items-center gap-2.5 bg-white border border-sand-mid rounded-xl p-3 text-xs font-semibold text-ink-mid active:scale-[0.98] transition-transform shadow-sm"
          >
            <Bookmark className="w-3.5 h-3.5 text-terra flex-shrink-0" />
            <span>Save events</span>
          </Link>
          <Link
            href={`/neighborhoods${utm}`}
            className="flex items-center gap-2.5 bg-white border border-sand-mid rounded-xl p-3 text-xs font-semibold text-ink-mid active:scale-[0.98] transition-transform shadow-sm"
          >
            <MapPin className="w-3.5 h-3.5 text-turq flex-shrink-0" />
            <span>By neighborhood</span>
          </Link>
          <Link
            href={`/submit${utm}`}
            className="flex items-center gap-2.5 bg-white border border-sand-mid rounded-xl p-3 text-xs font-semibold text-ink-mid active:scale-[0.98] transition-transform shadow-sm"
          >
            <Mail className="w-3.5 h-3.5 text-sage flex-shrink-0" />
            <span>Share an event</span>
          </Link>
          <Link
            href={`/about${utm}`}
            className="flex items-center gap-2.5 bg-white border border-sand-mid rounded-xl p-3 text-xs font-semibold text-ink-mid active:scale-[0.98] transition-transform shadow-sm"
          >
            <Info className="w-3.5 h-3.5 text-ink-light flex-shrink-0" />
            <span>About the site</span>
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <section className="max-w-md mx-auto px-5 pt-8 pb-10 text-center">
        <div className="pt-5 border-t border-sand-mid/60">
          <ConnectionQuote size="sm" />
        </div>
        <Link
          href={`/${utm}`}
          className="inline-block mt-6 text-[11px] font-bold text-terra hover:underline"
        >
          See the full site →
        </Link>
        <p className="text-[10px] text-ink-light mt-3">abqunplugged.com · Albuquerque, NM</p>
        <p className="text-[10px] text-[#c8b89a] mt-0.5">Built with love for one city.</p>
      </section>

    </main>
  )
}
