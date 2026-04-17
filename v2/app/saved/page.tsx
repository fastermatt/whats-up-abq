import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getCategoryFallback } from '@/lib/fallback-images'
import { Bookmark, MapPin, Calendar, ExternalLink, ArrowLeft, User } from 'lucide-react'
import { ConnectionQuote } from '@/app/components/ConnectionQuote'

export const metadata: Metadata = {
  title: 'Saved Events | ABQ Unplugged',
}

export const revalidate = 0

type TabKey = 'saved' | 'going' | 'past'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'going',  label: 'Going' },
  { key: 'saved',  label: 'Saved' },
  { key: 'past',   label: 'Past' },
]

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function SavedPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams
  const activeTab: TabKey = (tabParam === 'going' || tabParam === 'saved' || tabParam === 'past')
    ? tabParam : 'going'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-dvh bg-[--bg] flex flex-col items-center justify-center px-4 py-12 text-center">
        <Bookmark className="w-12 h-12 text-[#ddc9a3] mx-auto mb-4" />
        <h1 className="text-2xl font-black text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Saved Events
        </h1>
        <p className="text-sm text-[#8a7a74] mb-6">Sign in to save events and track where you&apos;re going. The best ones come with a plan and a person.</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all"
        >
          <User className="w-4 h-4" />
          Sign in free
        </Link>
        <Link href="/events" className="mt-4 text-xs text-[#9a442d] hover:underline">
          Browse events first →
        </Link>
      </main>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  // Fetch user events
  const { data: userEvents } = await supabase
    .from('user_events')
    .select('*')
    .eq('user_id', user.id)
    .order('event_date', { ascending: true })

  const goingEvents = (userEvents?.filter(e => e.state === 'going' && (!e.event_date || e.event_date >= today)) ?? []) as UserEvent[]
  const savedEvents = (userEvents?.filter(e => e.state === 'saved' && (!e.event_date || e.event_date >= today)) ?? []) as UserEvent[]
  const pastEvents  = (userEvents?.filter(e => e.event_date && e.event_date < today) ?? []) as UserEvent[]

  const eventsByTab: Record<TabKey, typeof goingEvents> = {
    going: goingEvents,
    saved: savedEvents,
    past:  pastEvents,
  }

  const events = eventsByTab[activeTab]

  return (
    <main className="min-h-dvh bg-[--bg]">
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-black text-lg text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
            My Events
          </h1>
          <Link href="/profile" className="text-xs text-[#8a7a74] hover:text-[#9a442d] transition-colors">
            <User className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Tab row */}
        <div className="flex gap-2 mb-5">
          {TABS.map(({ key, label }) => {
            const count = eventsByTab[key].length
            return (
              <Link
                key={key}
                href={`/saved?tab=${key}`}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  activeTab === key
                    ? 'bg-[#9a442d] text-white border-[#9a442d]'
                    : 'bg-white text-[#4a3f3a] border-[#ddc9a3] hover:border-[#9a442d]'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === key ? 'bg-white/20 text-white' : 'bg-[#f0e4cc] text-[#9a442d]'
                  }`}>{count}</span>
                )}
              </Link>
            )
          })}
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <Bookmark className="w-10 h-10 text-[#ddc9a3] mx-auto mb-3" />
            <h2 className="text-base font-bold text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
              {activeTab === 'going'  ? 'Nothing on your calendar yet' :
               activeTab === 'saved'  ? 'No saved events' :
               'No past events'}
            </h2>
            <p className="text-xs text-[#8a7a74] mb-4">
              {activeTab === 'past'
                ? 'Events you attend will appear here.'
                : 'Save events from any event page to track them here. The best ones come with a plan and a person.'}
            </p>
            <Link href="/events" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#9a442d] text-white text-xs font-semibold hover:bg-[#7d3725] transition-colors">
              Browse events
            </Link>
            <div className="mt-8 max-w-xs mx-auto">
              <ConnectionQuote size="sm" />
            </div>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-up">
            {events.map(ev => (
              <SavedEventCard key={ev.id} event={ev} activeTab={activeTab} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

interface UserEvent {
  id: string
  event_id: string
  event_name: string | null
  event_date: string | null
  venue_name: string | null
  category: string | null
  image_url: string | null
  ticket_url: string | null
  state: string
}

function SavedEventCard({ event, activeTab }: { event: UserEvent; activeTab: TabKey }) {
  const dateStr = event.event_date
    ? new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : null
  const imageUrl = event.image_url || getCategoryFallback(event.category ?? undefined, event.event_id)

  return (
    <div className="flex gap-3 bg-white rounded-xl border border-[#f0e4cc] p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#f0e4cc]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {activeTab === 'going' && (
            <span className="inline-block text-[9px] font-bold bg-[#4f6249]/10 text-[#4f6249] rounded-full px-2 py-0.5 mb-1 uppercase tracking-wide">
              You&apos;re going
            </span>
          )}
          <h3 className="text-sm font-bold text-[#1a1614] leading-tight line-clamp-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            {event.event_name || 'Untitled Event'}
          </h3>
          {dateStr && (
            <p className="text-[10px] text-[#9a442d] font-medium flex items-center gap-1 mt-0.5">
              <Calendar className="w-2.5 h-2.5" />
              {dateStr}
            </p>
          )}
          {event.venue_name && (
            <p className="text-[10px] text-[#8a7a74] flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              {event.venue_name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <Link
            href={`/events/${event.event_id}`}
            className="text-[10px] font-semibold text-[#9a442d] hover:underline"
          >
            View event →
          </Link>
          {event.ticket_url && (
            <a
              href={event.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-[10px] text-[#006a62] hover:underline"
            >
              Tickets <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
