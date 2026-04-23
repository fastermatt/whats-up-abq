import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Sparkles, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchEventById } from '@/lib/events'
import { EventImage } from '@/app/components/EventImage'
import { getCategoryFallback } from '@/lib/fallback-images'

export const metadata: Metadata = {
  title: 'For You | ABQ Unplugged',
  description: 'Events that match your picks — handpicked for what you love.',
}

export const revalidate = 0

type MatchRow = { event_id: string; score: number; match_reasons: string[] }

export default async function ForYouPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/for-you')

  const { data: prefs } = await supabase
    .from('user_event_preferences')
    .select('enabled, categories, subcategory_tags, keywords, venues, neighborhoods')
    .eq('user_id', user.id)
    .maybeSingle()

  const hasPrefs = !!(
    prefs && prefs.enabled && (
      (prefs.categories?.length ?? 0) > 0 ||
      (prefs.venues?.length ?? 0) > 0 ||
      (prefs.keywords?.length ?? 0) > 0 ||
      (prefs.subcategory_tags?.length ?? 0) > 0 ||
      (prefs.neighborhoods?.length ?? 0) > 0
    )
  )

  const { data: matches } = await supabase
    .from('notification_matches')
    .select('event_id, score, match_reasons')
    .eq('user_id', user.id)
    .eq('dismissed', false)
    .order('score', { ascending: false })
    .limit(40)

  const matchRows: MatchRow[] = (matches ?? []) as MatchRow[]

  // Fetch normalized events (parallel, up to 40)
  const results = await Promise.all(matchRows.map(async (m) => {
    const e = await fetchEventById(m.event_id)
    if (!e) return null
    return { event: e, score: m.score, reasons: m.match_reasons || [] }
  }))
  const items = results.filter(Boolean) as Array<{
    event: NonNullable<Awaited<ReturnType<typeof fetchEventById>>>
    score: number
    reasons: string[]
  }>

  return (
    <main className="min-h-dvh bg-[#fbf7f1]">
      <header className="border-b border-[#ddc9a3]/60 bg-[#fbf7f1]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#9a442d]" />
            <h1 className="font-black text-lg text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
              For You
            </h1>
          </div>
          <Link
            href="/profile/notifications"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#4a3f3a] hover:text-[#9a442d]"
          >
            <Settings className="w-3.5 h-3.5" /> Adjust
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6" id="main">
        {!hasPrefs && (
          <div className="bg-white rounded-2xl p-6 border border-[#f0e4cc] text-center">
            <Sparkles className="w-10 h-10 text-[#9a442d] mx-auto mb-3" />
            <h2 className="text-lg font-black text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Tell us what you love
            </h2>
            <p className="text-sm text-[#4a3f3a] mb-4 max-w-md mx-auto">
              Pick the categories, artists, venues, or neighborhoods you care about. We&apos;ll only surface events that match — and we&apos;ll quietly notify you when new ones show up.
            </p>
            <Link
              href="/profile/notifications"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#9a442d] text-white text-sm font-black hover:bg-[#7d3725] transition-colors"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Set your preferences
            </Link>
          </div>
        )}

        {hasPrefs && items.length === 0 && (
          <div className="bg-white rounded-2xl p-6 border border-[#f0e4cc] text-center">
            <p className="text-sm text-[#4a3f3a] mb-2">
              No matches yet for your current preferences.
            </p>
            <p className="text-xs text-[#8a7a74] mb-4">
              The matcher runs daily. Come back tomorrow, or broaden your picks.
            </p>
            <Link
              href="/profile/notifications"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a1614] text-white text-xs font-semibold hover:bg-[#4a3f3a] transition-colors"
            >
              Adjust preferences
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <>
            <p className="text-sm text-[#4a3f3a] mb-4">
              <strong>{items.length}</strong> events we think you&apos;ll love
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {items.map(({ event, score, reasons }) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="relative block rounded-xl overflow-hidden bg-white border border-[#f0e4cc] shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div className="aspect-[16/10] relative bg-[#f7f2ec] overflow-hidden">
                    <EventImage
                      src={event.imageUrl || getCategoryFallback(event.category ?? undefined, event.id)}
                      fallback={getCategoryFallback(event.category ?? undefined, event.id)}
                      alt={event.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-[#9a442d] text-white text-[10px] font-black shadow">
                      {score}%
                    </div>
                    {event.category && (
                      <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-semibold">
                        {event.category}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-black text-[#1a1614] line-clamp-2 leading-tight group-hover:text-[#9a442d] transition-colors"
                        style={{ fontFamily: 'var(--font-epilogue)' }}>
                      {event.title}
                    </h3>
                    {event.venue && (
                      <p className="text-[10px] text-[#8a7a74] mt-1 line-clamp-1">{event.venue}</p>
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
