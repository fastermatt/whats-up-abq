import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Sparkles, SlidersHorizontal, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchEventById } from '@/lib/events'
import { EventImage } from '@/app/components/EventImage'
import { getCategoryFallback } from '@/lib/fallback-images'
import { DismissButton } from './DismissButton'
import type { UserPreferences } from '@/app/components/PreferencesPicker'

export const metadata: Metadata = {
  title: 'For You | ABQ Unplugged',
  description: 'Events matched to what you love in Albuquerque.',
}

export const revalidate = 0

type MatchRow = { event_id: string; score: number; match_reasons: string[] }
type EventItem = {
  event: NonNullable<Awaited<ReturnType<typeof fetchEventById>>>
  score: number
  reasons: string[]
}

// ─── Category mapping ────────────────────────────────────────────────────────
// Maps PreferencesPicker category labels → event category column values.
// Partial match is fine — we lowercase both sides.

const CAT_MAP: Record<string, string[]> = {
  'music':             ['music', 'concerts', 'concert'],
  'comedy':            ['comedy', 'comedy & humor', 'humor'],
  'food & drink':      ['food & drink', 'food', 'dining', 'drink', 'bar'],
  'arts & theater':    ['arts', 'theater', 'arts & theater', 'art', 'gallery', 'dance', 'visual arts'],
  'outdoors & sports': ['outdoors', 'sports', 'outdoor', 'nature', 'recreation', 'fitness'],
  'family / kids':     ['family', 'kids', 'children', 'family-friendly', 'family friendly'],
  'film':              ['film', 'movies', 'cinema', 'movie'],
  'nightlife':         ['nightlife', 'club', 'dj', 'bar', 'lounge'],
  'volunteering':      ['volunteer', 'volunteering', 'community'],
  'free events':       [], // handled via price, not category
}

// Categories that contain family/kids content — hidden for non-family users
const FAMILY_CATEGORIES = ['family', 'kids', 'children', 'family-friendly', 'family friendly']

function categoryMatchesPref(eventCat: string | null, prefCats: string[]): boolean {
  if (!eventCat || prefCats.length === 0) return true // no filter when prefs not set
  const lower = eventCat.toLowerCase()
  return prefCats.some(pref => {
    const variants = CAT_MAP[pref.toLowerCase()] ?? [pref.toLowerCase()]
    return variants.some(v => lower.includes(v))
  })
}

function isFamilyEvent(eventCat: string | null, eventTitle: string): boolean {
  const lower = (eventCat ?? '').toLowerCase()
  const titleLower = eventTitle.toLowerCase()
  return (
    FAMILY_CATEGORIES.some(k => lower.includes(k)) ||
    /\bkids?\b|\bchildren\b|\bfamily\b|\bstory.?time\b|\bkindergarten\b|\bplaydate\b/i.test(titleLower)
  )
}

function isFreeEvent(price: string | null): boolean {
  if (!price) return false
  return price.toLowerCase() === 'free' || price === '$0'
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ForYouPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/for-you')

  // Fetch both pref systems in parallel: taste profile (new) + notification prefs (old)
  const [{ data: profile }, { data: notifPrefs }, { data: matches }] = await Promise.all([
    supabase.from('profiles').select('preferences').eq('id', user.id).single(),
    supabase
      .from('user_event_preferences')
      .select('enabled, categories, subcategory_tags, keywords, venues, neighborhoods')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('notification_matches')
      .select('event_id, score, match_reasons')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .order('score', { ascending: false })
      .limit(60),
  ])

  const tastePrefs = (profile?.preferences ?? {}) as UserPreferences

  const hasTastePrefs = !!(
    tastePrefs.who ||
    (tastePrefs.categories?.length ?? 0) > 0 ||
    tastePrefs.when ||
    tastePrefs.budget
  )

  const hasNotifPrefs = !!(
    notifPrefs?.enabled && (
      (notifPrefs.categories?.length ?? 0) > 0 ||
      (notifPrefs.venues?.length ?? 0) > 0 ||
      (notifPrefs.keywords?.length ?? 0) > 0 ||
      (notifPrefs.subcategory_tags?.length ?? 0) > 0 ||
      (notifPrefs.neighborhoods?.length ?? 0) > 0
    )
  )

  // Fetch and filter events
  const matchRows: MatchRow[] = (matches ?? []) as MatchRow[]
  const rawResults = await Promise.all(
    matchRows.map(async (m) => {
      const e = await fetchEventById(m.event_id)
      if (!e) return null
      return { event: e, score: m.score, reasons: m.match_reasons || [] }
    })
  )
  const rawItems = rawResults.filter(Boolean) as EventItem[]

  // Apply taste preference filters
  let items = rawItems

  if (hasTastePrefs) {
    const prefCats = (tastePrefs.categories ?? []).map(c => c.toLowerCase())
    const budgetFreeOnly = tastePrefs.budget === 'free'
    const isNonFamily = tastePrefs.who === 'solo' || tastePrefs.who === 'couple'

    items = rawItems.filter(({ event }) => {
      // Budget filter: hide paid events for free-only users
      if (budgetFreeOnly && !isFreeEvent(event.price)) return false

      // Family filter: hide kids/family events for solo/couple users (this is the kindergarten fix)
      if (isNonFamily && isFamilyEvent(event.category, event.title)) return false

      // Category filter: if they selected categories, only show matching ones
      if (prefCats.length > 0 && !prefCats.includes('free events')) {
        // "Free Events" pref is budget-based, already handled above
        const nonFreePrefs = prefCats.filter(c => c !== 'free events')
        if (nonFreePrefs.length > 0 && !categoryMatchesPref(event.category, nonFreePrefs)) return false
      }

      return true
    })

    // Re-sort: bump events matching preferred categories to top
    if (prefCats.length > 0) {
      items = items.sort((a, b) => {
        const aMatch = categoryMatchesPref(a.event.category, prefCats)
        const bMatch = categoryMatchesPref(b.event.category, prefCats)
        if (aMatch && !bMatch) return -1
        if (!aMatch && bMatch) return 1
        return b.score - a.score
      })
    }
  }

  const showNudge = !hasTastePrefs

  return (
    <main className="min-h-dvh bg-[#fbf7f1]">
      {/* Nav */}
      <header className="border-b border-[#ddc9a3]/60 bg-[#fbf7f1]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#9a442d]" />
            <h1
              className="font-black text-lg text-[#1a1614]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              For You
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/profile#preferences"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4a3f3a] hover:text-[#9a442d] transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              My picks
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6" id="main">

        {/* ── Preferences nudge — shown when taste profile is empty ── */}
        {showNudge && (
          <div className="mb-6 rounded-2xl border border-[#e8d9bf] bg-[#fdf9f4] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#9a442d]/10 flex items-center justify-center flex-shrink-0">
              <SlidersHorizontal className="w-5 h-5 text-[#9a442d]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1a1614] mb-0.5">
                Personalize your feed
              </p>
              <p className="text-xs text-[#6b5d57] leading-relaxed">
                Tell us who&apos;s coming and what you&apos;re into. We&apos;ll stop showing you
                events that don&apos;t fit — and surface the ones that do.
              </p>
            </div>
            <Link
              href="/profile#preferences"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#9a442d] text-white text-xs font-bold hover:bg-[#7d3725] transition-colors flex-shrink-0 whitespace-nowrap"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Set my picks
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Active filter pills — show what's being filtered */}
        {hasTastePrefs && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="text-[11px] text-[#6b5d57] font-semibold">Filtered by:</span>
            {tastePrefs.who && (
              <span className="text-[11px] bg-[#9a442d]/10 text-[#9a442d] px-2.5 py-1 rounded-full font-semibold">
                {tastePrefs.who === 'solo' ? 'Just me' :
                 tastePrefs.who === 'couple' ? 'Me + partner' :
                 tastePrefs.who === 'family_kids' ? 'Family with kids' : 'Group'}
              </span>
            )}
            {(tastePrefs.categories ?? []).map(c => (
              <span key={c} className="text-[11px] bg-[#9a442d]/10 text-[#9a442d] px-2.5 py-1 rounded-full font-semibold">
                {c}
              </span>
            ))}
            {tastePrefs.budget === 'free' && (
              <span className="text-[11px] bg-[#4f6249]/10 text-[#4f6249] px-2.5 py-1 rounded-full font-semibold">
                Free only
              </span>
            )}
            <Link
              href="/profile#preferences"
              className="text-[11px] text-[#8a7a74] hover:text-[#9a442d] transition-colors underline underline-offset-2 ml-1"
            >
              Edit
            </Link>
          </div>
        )}

        {/* Notification prefs not set yet — secondary nudge */}
        {!hasNotifPrefs && hasTastePrefs && (
          <div className="mb-5 rounded-xl border border-[#ddc9a3]/60 bg-white px-4 py-3 flex items-center gap-3">
            <span className="text-base">🔔</span>
            <p className="text-xs text-[#4a3f3a] flex-1">
              Want alerts when new matching events drop?{' '}
              <Link href="/profile/notifications" className="font-semibold text-[#9a442d] hover:underline underline-offset-2">
                Set up notifications →
              </Link>
            </p>
          </div>
        )}

        {/* No matches */}
        {items.length === 0 && hasNotifPrefs && (
          <div className="rounded-2xl p-7 border border-[#e8d9bf] bg-[#fdf9f4] text-center">
            <p className="text-base font-bold text-[#1a1614] mb-1">Nothing matched yet</p>
            <p className="text-sm text-[#4a3f3a] mb-4 max-w-sm mx-auto">
              The matcher runs daily — check back tomorrow, or broaden your picks.
            </p>
            <Link
              href="/profile#preferences"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1614] text-white text-xs font-semibold hover:bg-[#4a3f3a] transition-colors"
            >
              Adjust my picks
            </Link>
          </div>
        )}

        {/* No matches + no notif prefs — show all-events fallback */}
        {items.length === 0 && !hasNotifPrefs && (
          <div className="rounded-2xl p-7 border border-[#e8d9bf] bg-[#fdf9f4] text-center">
            <p className="text-base font-bold text-[#1a1614] mb-1">
              {hasTastePrefs ? 'No matches for your filters yet' : 'Your feed is empty'}
            </p>
            <p className="text-sm text-[#4a3f3a] mb-5 max-w-sm mx-auto">
              {hasTastePrefs
                ? 'Try broadening your category picks, or browse everything.'
                : 'Set your picks so we know what to surface for you.'}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/profile#preferences"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9a442d] text-white text-sm font-bold hover:bg-[#7d3725] transition-colors"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Set my picks
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#ddc9a3] text-sm font-semibold text-[#4a3f3a] hover:border-[#9a442d] transition-colors"
              >
                Browse all events
              </Link>
            </div>
          </div>
        )}

        {/* Event grid */}
        {items.length > 0 && (
          <>
            <p className="text-[12px] text-[#6b5d57] mb-4">
              <strong className="text-[#1a1614]">{items.length}</strong> events matched to your picks
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {items.map(({ event, score, reasons }) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="relative block rounded-xl overflow-hidden bg-[#fdf9f4] border border-[#e8d9bf] shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div className="aspect-[16/10] relative bg-[#f0e4cc] overflow-hidden">
                    <EventImage
                      src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
                      fallback={getCategoryFallback(event.category ?? undefined, event.id)}
                      alt={event.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <DismissButton eventId={event.id} />
                    <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-[#9a442d] text-white text-[10px] font-black shadow">
                      {score}%
                    </div>
                    {event.category && (
                      <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-semibold">
                        {event.category}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3
                      className="text-xs font-black text-[#1a1614] line-clamp-2 leading-tight group-hover:text-[#9a442d] transition-colors"
                      style={{ fontFamily: 'var(--font-epilogue)' }}
                    >
                      {event.title}
                    </h3>
                    {event.venue && (
                      <p className="text-[10px] text-[#6b5d57] mt-1 line-clamp-1">{event.venue}</p>
                    )}
                    {event.price && (
                      <p className="text-[10px] text-[#4f6249] mt-0.5 font-semibold">{event.price}</p>
                    )}
                    {reasons?.length > 0 && (
                      <p className="text-[9px] text-[#4f6249] mt-1 line-clamp-1 font-semibold">
                        {reasons.slice(0, 2).map(r => r.replace(/^(category|venue|nh|tag|kw|mood):/, '')).join(' · ')}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
