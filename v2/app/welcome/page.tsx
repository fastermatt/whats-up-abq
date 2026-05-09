/**
 * Welcome / first-impression landing page. Public-facing pitch for the site
 * with prominent paths to: browse events, sign up, install PWA. Linked from
 * the FirstVisitBanner that appears once for users who've never been here.
 *
 * SEO target: "albuquerque events app" / "things to do in albuquerque" newcomers.
 */
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Sparkles, Calendar, MapPin, Heart, Bell, Users, Compass,
  Music2, Palette, Drama, UtensilsCrossed, ArrowRight, Star,
} from 'lucide-react'
import { fetchEvents } from '@/lib/events'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Welcome to ABQ Unplugged: The Best Way to Find Things to Do in Albuquerque',
  description:
    'ABQ Unplugged pulls together every concert, comedy show, art opening, sports game, ' +
    'family event, and free thing to do in Albuquerque, from Ticketmaster to local ' +
    'community calendars, into one searchable place. Join free.',
  openGraph: {
    title: 'ABQ Unplugged: Albuquerque Events, All in One Place',
    description:
      'Every concert, comedy show, art opening, and free event in Albuquerque. ' +
      'Filtered by neighborhood, mood, category, and date.',
    url: 'https://abqunplugged.com/welcome',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'ABQ Unplugged' }],
  },
  alternates: { canonical: 'https://abqunplugged.com/welcome' },
}

const benefits = [
  {
    icon: Calendar,
    title: 'Every event, one place',
    body: 'Pulled from Ticketmaster, SeatGeek, Eventbrite, NHCC, the Alibi, abqtodo.com, and 80+ local venues. Updated daily, so no more switching between five tabs.',
  },
  {
    icon: Compass,
    title: 'Filter by neighborhood',
    body: 'Browse Nob Hill, Old Town, Downtown, North Valley, Westside, Northeast Heights. See only what\'s near you, with a Google Maps link on every venue.',
  },
  {
    icon: Sparkles,
    title: 'Surprise Me',
    body: 'Don’t know what to do tonight? One tap and we’ll send you to a random event you might not have found yourself.',
  },
  {
    icon: Heart,
    title: 'Save what you love',
    body: 'Bookmark events you’re thinking about, mark yourself going, and see who else is going from your friends list.',
  },
  {
    icon: Bell,
    title: 'Smart reminders',
    body: 'Set up your taste profile (date night, family, free, music, comedy…) and get a heads-up when something matches.',
  },
  {
    icon: Users,
    title: 'See who’s going',
    body: 'Public profiles for users who opt in. Find out which events your friends are checking out and who else in ABQ is going.',
  },
]

const categoryHighlights = [
  { icon: Music2, label: 'Music', href: '/categories/music', count: '300+' },
  { icon: Drama,  label: 'Comedy', href: '/categories/comedy', count: '70+' },
  { icon: Palette,label: 'Arts & Theater', href: '/categories/arts-theater', count: '200+' },
  { icon: UtensilsCrossed, label: 'Food & Drink', href: '/categories/food-drink', count: '100+' },
]

const quickPaths = [
  { href: '/tonight',         label: 'Tonight' },
  { href: '/weekend',         label: 'This Weekend' },
  { href: '/this-week',       label: 'This Week' },
  { href: '/free',            label: 'Free Events' },
  { href: '/family-friendly', label: 'With Kids' },
  { href: '/date-night',      label: 'Date Night' },
]

export default async function WelcomePage() {
  const { total } = await fetchEvents({ timeFilter: 'upcoming', limit: 1 })

  return (
    <main id="main" className="min-h-dvh bg-[#fbf7f1]">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#9a442d] via-[#7d3725] to-[#5a2416] text-white">
        <div className="absolute inset-0 opacity-[0.07] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41IiBmaWxsPSIjZmZmIi8+PC9zdmc+')]" />
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-20 relative">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#ffd9c8] mb-3 font-semibold">
            Albuquerque, New Mexico
          </p>
          <h1
            className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-5"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            There’s more happening<br />in ABQ than you think.
          </h1>
          <p className="text-lg sm:text-xl text-white/90 max-w-2xl leading-relaxed mb-6">
            ABQ Unplugged is the easiest way to find things to do in Albuquerque:
            <span className="font-semibold"> {total.toLocaleString()} upcoming events</span>{' '}
            from every ticket source, gallery, brewery, library, and community calendar in town.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white text-[#9a442d] font-bold shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              Browse all events
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/15 backdrop-blur-sm text-white font-bold border border-white/30 hover:bg-white/25 transition-all"
            >
              Create free account
            </Link>
          </div>
          <p className="text-xs text-white/70 mt-4">
            Free, no credit card. Built and run by an Albuquerque local.
          </p>
        </div>
      </section>

      {/* ── Quick paths ── */}
      <section className="max-w-5xl mx-auto px-6 -mt-7 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-[#f0e4cc] p-4 sm:p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a442d] font-bold mb-3">
            Jump in
          </p>
          <div className="flex flex-wrap gap-2">
            {quickPaths.map(p => (
              <Link
                key={p.href}
                href={p.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#fbf7f1] border border-[#f0e4cc] text-sm font-semibold text-[#1a1614] hover:border-[#9a442d] hover:text-[#9a442d] transition-colors"
              >
                {p.label}
                <ArrowRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits grid ── */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <h2
          className="text-3xl font-black text-[#1a1614] tracking-tight mb-2"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Built for finding things, not selling tickets.
        </h2>
        <p className="text-[#6b5d57] mb-8 max-w-2xl">
          We aggregate. We don&apos;t take a cut. The site exists to help you find one thing
          worth doing tonight, and to help local venues fill their rooms.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="bg-white border border-[#f0e4cc] rounded-2xl p-5 hover:border-[#ddc9a3] hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#fbf7f1] flex items-center justify-center mb-3">
                <b.icon className="w-5 h-5 text-[#9a442d]" strokeWidth={2.2} />
              </div>
              <h3
                className="font-black text-[#1a1614] mb-1.5"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                {b.title}
              </h3>
              <p className="text-sm text-[#4a3f3a] leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories preview ── */}
      <section className="max-w-5xl mx-auto px-6 pb-14">
        <h2
          className="text-2xl font-black text-[#1a1614] tracking-tight mb-4"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Pick your night
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categoryHighlights.map(c => (
            <Link
              key={c.label}
              href={c.href}
              className="group flex items-center gap-3 bg-white border border-[#f0e4cc] rounded-xl p-4 hover:border-[#9a442d] hover:bg-[#fbf7f1] transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-[#9a442d]/10 group-hover:bg-[#9a442d]/20 flex items-center justify-center transition-colors">
                <c.icon className="w-5 h-5 text-[#9a442d]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1a1614]">{c.label}</p>
                <p className="text-[11px] text-[#6b5d57]">{c.count} events</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="bg-white border-y border-[#f0e4cc] py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <Stat label="Upcoming events"    value={total.toLocaleString()} />
            <Stat label="Venues tracked"     value="80+" />
            <Stat label="Neighborhoods"      value="14" />
            <Stat label="Refreshed"          value="Daily" />
          </div>
        </div>
      </section>

      {/* ── Final CTA — sign up ── */}
      <section className="max-w-3xl mx-auto px-6 py-14 text-center">
        <div className="inline-flex items-center gap-1.5 mb-3">
          {[0,1,2,3,4].map(i => <Star key={i} className="w-4 h-4 fill-[#9a442d] text-[#9a442d]" />)}
        </div>
        <h2
          className="text-3xl sm:text-4xl font-black text-[#1a1614] tracking-tight mb-3"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Make ABQ feel smaller.
        </h2>
        <p className="text-lg text-[#4a3f3a] mb-6 max-w-xl mx-auto leading-relaxed">
          Save your favorite events, get smart reminders, and see what your friends are going to.
          All free, no ads in your inbox.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/login?tab=signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#9a442d] text-white font-bold shadow-md hover:bg-[#7d3725] hover:shadow-lg transition-all"
          >
            Create free account
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border-2 border-[#9a442d] text-[#9a442d] font-bold hover:bg-[#9a442d] hover:text-white transition-all"
          >
            Just let me browse
          </Link>
        </div>
        <p className="text-xs text-[#6b5d57] mt-5">
          Already have an account? <Link href="/login" className="text-[#9a442d] font-semibold underline-offset-2 hover:underline">Sign in →</Link>
        </p>
      </section>

      {/* ── About strip ── */}
      <section className="bg-[#fbf7f1] py-10 border-t border-[#f0e4cc]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#9a442d] font-bold mb-3">
            About
          </p>
          <p className="text-base text-[#1a1614] leading-relaxed">
            ABQ Unplugged was built by a Burqueño tired of missing shows because the calendars
            were scattered. We aggregate from{' '}
            <Link href="/about" className="text-[#9a442d] underline underline-offset-2 hover:no-underline">
              every reliable source
            </Link>{' '}
            so you never have to.
            <br className="hidden sm:block" />
            Spotted a bug or a missing event?{' '}
            <Link href="/feedback" className="text-[#9a442d] underline underline-offset-2 hover:no-underline">
              Let us know →
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-3xl font-black text-[#9a442d]"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b5d57] font-semibold mt-1">
        {label}
      </p>
    </div>
  )
}
