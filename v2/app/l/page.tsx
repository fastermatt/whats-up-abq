/**
 * /l — Growth landing page
 *
 * Short URL for IG bio + story links. Converts cold visitors (especially from
 * Instagram) into bookmarked repeat users. Shows real events, real photos,
 * real count. Two exit actions: browse events or subscribe to Friday picks.
 *
 * Distinct from /welcome (feature pitch) — this page leads with live data.
 */

import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, MapPin, Calendar } from 'lucide-react'
import { fetchEvents, fetchFeaturedEvents } from '@/lib/events'
import { eventImageSrc } from '@/lib/image-url'
import { getCategoryFallback } from '@/lib/fallback-images'
import { LandingEmailForm } from './LandingEmailForm'
import { InstagramIcon } from '@/app/components/InstagramIcon'

export const revalidate = 300
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'ABQ Unplugged — What\'s Happening in Albuquerque',
  description:
    'Concerts, comedy, art openings, food festivals, free events — everything happening in ' +
    'Albuquerque, updated daily. Find things to do tonight and this weekend.',
  openGraph: {
    title: 'ABQ Unplugged — What\'s Happening in Albuquerque',
    description: 'Concerts, comedy, art, food, free events — everything in ABQ, updated daily.',
    url: 'https://abqunplugged.com/l',
  },
  alternates: { canonical: 'https://abqunplugged.com/l' },
}

// Category label → short display label for event cards
const CATEGORY_LABELS: Record<string, string> = {
  'Music': 'Music',
  'Comedy': 'Comedy',
  'Arts & Theater': 'Arts',
  'Food & Drink': 'Food',
  'Sports': 'Sports',
  'Family': 'Family',
  'Festivals': 'Festival',
  'Film': 'Film',
  'Outdoor': 'Outdoor',
  'Community': 'Community',
}

// Terra palette variants by category for card chips
const CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  'Music':         { bg: '#9a442d1a', text: '#9a442d' },
  'Comedy':        { bg: '#4f62491a', text: '#4f6249' },
  'Arts & Theater':{ bg: '#006a621a', text: '#006a62' },
  'Food & Drink':  { bg: '#7d37251a', text: '#7d3725' },
  'Sports':        { bg: '#9a442d1a', text: '#9a442d' },
  'Family':        { bg: '#4f62491a', text: '#4f6249' },
  'Festivals':     { bg: '#006a621a', text: '#006a62' },
}

function categoryChip(category: string | null) {
  const label = CATEGORY_LABELS[category ?? ''] ?? category ?? 'Event'
  const colors = CHIP_COLORS[category ?? ''] ?? { bg: '#9a442d1a', text: '#9a442d' }
  return { label, ...colors }
}

function formatEventDate(date: string, time: string | null): string {
  try {
    const d = new Date(date.length <= 10 ? `${date}T12:00:00` : date)
    const dayStr = d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Denver',
    })
    if (!time) return dayStr
    // Parse time (e.g. "7:00 PM")
    return `${dayStr} · ${time}`
  } catch {
    return date
  }
}

export default async function LandingPage() {
  const [weekendResult, featuredEvents, tonightResult] = await Promise.all([
    fetchEvents({ timeFilter: 'this-weekend', limit: 1 }),
    fetchFeaturedEvents(8),
    fetchEvents({ timeFilter: 'tonight', limit: 1 }),
  ])

  const weekendCount = weekendResult.total
  const tonightCount = tonightResult.total

  // Pick the most compelling count to show
  const heroCount  = tonightCount >= 10 ? tonightCount : weekendCount
  const heroLabel  = tonightCount >= 10 ? 'events happening tonight' : 'events this weekend'
  const heroSub    = tonightCount >= 10 ? 'in ABQ' : 'in Albuquerque'

  // Use featured events with photos first, fall back to any
  const cards = featuredEvents.filter(e => e.imageUrl).slice(0, 6)

  return (
    <main id="main" className="min-h-dvh bg-cream">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="px-5 pt-10 pb-8 max-w-2xl mx-auto">

        {/* Brand mark */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2 h-2 rounded-full bg-terra" />
          <span
            className="text-sm font-black text-ink tracking-tight"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            ABQ Unplugged
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-terra font-semibold ml-1">
            Albuquerque, NM
          </span>
        </div>

        {/* Count + headline */}
        <div className="mb-6">
          <div className="flex items-end gap-2 mb-1">
            <span
              className="text-7xl sm:text-8xl font-black text-terra leading-none tabular-nums"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {heroCount > 0 ? heroCount.toLocaleString() : '900+'}
            </span>
          </div>
          <p
            className="text-2xl sm:text-3xl font-black text-ink leading-tight -mt-1"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {heroLabel}
            <br />
            <span className="text-terra">{heroSub}</span>
          </p>
        </div>

        <p className="text-ink-mid text-base leading-relaxed mb-7 max-w-md">
          Concerts, comedy shows, art openings, food festivals, free events — every ticket
          source in Albuquerque in one place, updated daily.
        </p>

        {/* Primary CTA */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/events"
            data-umami-event="landing-browse-events"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-terra text-white font-bold shadow-md hover:bg-terra-hover hover:shadow-lg transition-all"
          >
            Browse events
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/tonight"
            data-umami-event="landing-tonight"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border-2 border-terra/30 text-terra font-bold hover:border-terra transition-colors"
          >
            Tonight
          </Link>
        </div>

      </section>

      {/* ── Event cards (horizontal scroll) ─────────────────────────────────── */}
      {cards.length > 0 && (
        <section className="pb-10">
          <div className="px-5 mb-4 flex items-center justify-between">
            <p
              className="text-[10px] uppercase tracking-[0.2em] text-terra font-bold"
            >
              Happening soon
            </p>
            <Link
              href="/events"
              className="text-xs text-terra font-semibold flex items-center gap-1 hover:underline underline-offset-2"
            >
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Horizontal scroll container */}
          <div
            className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {cards.map(event => {
              const chip = categoryChip(event.category)
              const imgSrc = event.imageUrl ? eventImageSrc(event.imageUrl, 320) : getCategoryFallback(event.category ?? undefined)

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`} target="_blank" rel="noopener noreferrer"
                  data-umami-event="landing-event-card"
                  className="flex-shrink-0 snap-start w-[200px] sm:w-[220px] rounded-2xl overflow-hidden bg-white border border-sand-light hover:border-sand-mid hover:shadow-md transition-all block"
                >
                  {/* Photo */}
                  <div className="relative w-full aspect-[4/3] overflow-hidden bg-sand-light">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgSrc}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    {/* Category chip overlay */}
                    <div
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: chip.bg, color: chip.text, backdropFilter: 'blur(4px)' }}
                    >
                      {chip.label}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-ink text-xs font-black leading-snug line-clamp-2 mb-1.5"
                       style={{ fontFamily: 'var(--font-epilogue)' }}>
                      {event.title}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-ink-light">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{formatEventDate(event.date, event.time)}</span>
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-ink-light">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}

            {/* Terminal "see more" card */}
            <Link
              href="/events"
              className="flex-shrink-0 snap-start w-[160px] rounded-2xl bg-terra flex flex-col items-center justify-center gap-2 px-4 text-center hover:bg-terra-hover transition-colors"
            >
              <ArrowRight className="w-6 h-6 text-white" />
              <p className="text-white text-xs font-bold leading-tight">See all events</p>
            </Link>
          </div>
        </section>
      )}

      {/* ── What you get strip ──────────────────────────────────────────────── */}
      <section className="px-5 pb-10 max-w-2xl mx-auto">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { value: '1,000+', label: 'events tracked' },
            { value: '80+',    label: 'local venues' },
            { value: 'Daily',  label: 'updates' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-sand-light py-4 px-2">
              <p
                className="text-xl font-black text-terra"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                {stat.value}
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-light font-semibold mt-0.5">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Email subscribe ──────────────────────────────────────────────────── */}
      <section className="px-5 pb-10 max-w-2xl mx-auto">
        <LandingEmailForm />
      </section>

      {/* ── Category quick links ─────────────────────────────────────────────── */}
      <section className="px-5 pb-10 max-w-2xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-terra font-bold mb-3">
          Pick your night
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Tonight',       href: '/tonight' },
            { label: 'Free events',   href: '/free' },
            { label: 'Live music',    href: '/categories/music' },
            { label: 'Comedy',        href: '/categories/comedy' },
            { label: 'Arts',          href: '/categories/arts-theater' },
            { label: 'Food & drink',  href: '/categories/food-drink' },
            { label: 'With kids',     href: '/family-friendly' },
            { label: 'Date night',    href: '/date-night' },
          ].map(c => (
            <Link
              key={c.href}
              href={c.href}
              className="px-3.5 py-2 rounded-full bg-white border border-[#e8d5c0] text-sm font-semibold text-ink-mid hover:border-terra hover:text-terra transition-colors"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── IG follow + about ────────────────────────────────────────────────── */}
      <section className="border-t border-sand-light bg-white px-5 py-8">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <p
              className="text-base font-black text-ink mb-1"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Built by a Burqueño, for Burqueños.
            </p>
            <p className="text-xs text-ink-light max-w-xs leading-relaxed">
              Free, no ads, no tickets fees. We aggregate so you don&apos;t
              have to check five different sites.
            </p>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <a
              href="https://instagram.com/abqunplugged"
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="instagram-follow"
              data-umami-event-position="landing-footer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 border-terra/30 text-terra text-sm font-bold hover:border-terra hover:bg-terra hover:text-white transition-all"
            >
              <InstagramIcon size={15} />
              @abqunplugged
            </a>
            <Link
              href="/events"
              className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-full bg-terra text-white text-sm font-bold hover:bg-terra-hover transition-colors"
            >
              Browse all events <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
