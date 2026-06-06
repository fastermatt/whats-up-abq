import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getCategoryFallback } from '@/lib/fallback-images'
import { Bookmark, MapPin, Calendar, ExternalLink, ArrowLeft, User, Users } from 'lucide-react'
import { ConnectionQuote } from '@/app/components/ConnectionQuote'
import { affiliateUrl } from '@/lib/affiliate'

export const metadata: Metadata = {
  title: 'Saved Events | ABQ Unplugged',
}

export const revalidate = 0

type TabKey = 'saved' | 'going' | 'past' | 'friends'

const BASE_TABS: { key: TabKey; label: string }[] = [
  { key: 'going',  label: 'Going' },
  { key: 'saved',  label: 'Saved' },
  { key: 'past',   label: 'Past' },
]

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

interface FriendEvent {
  id: string
  event_id: string
  event_name: string | null
  event_date: string | null
  venue_name: string | null
  category: string | null
  image_url: string | null
  ticket_url: string | null
  state: string
  user_id: string
}

interface FriendProfile {
  id: string
  display_name: string | null
  handle: string | null
}

export default async function SavedPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams
  const activeTab: TabKey = (tabParam === 'going' || tabParam === 'saved' || tabParam === 'past' || tabParam === 'friends')
    ? tabParam as TabKey : 'going'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main id="main" className="min-h-dvh bg-[--bg] flex flex-col items-center justify-center px-4 py-12 text-center">
        <Bookmark className="w-12 h-12 text-sand-mid mx-auto mb-4" />
        <h1 className="text-2xl font-black text-ink mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Saved Events
        </h1>
        <p className="text-sm text-ink-light mb-6">Sign in to save events and track where you&apos;re going. The best ones come with a plan and a person.</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terra text-white font-semibold text-sm hover:bg-terra-hover transition-all"
        >
          <User className="w-4 h-4" />
          Sign in free
        </Link>
        <Link href="/events" className="mt-4 text-xs text-terra hover:underline">
          Browse events first →
        </Link>
        <div className="mt-10 max-w-xs mx-auto">
          <ConnectionQuote size="sm" />
        </div>
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

  // Friends tab data
  let friendEvents: FriendEvent[] = []
  let friendProfiles: Map<string, FriendProfile> = new Map()
  let followingIds: string[] = []

  if (activeTab === 'friends') {
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    followingIds = follows?.map(f => f.following_id) ?? []

    if (followingIds.length > 0) {
      const [{ data: fEvents }, { data: fProfiles }] = await Promise.all([
        supabase
          .from('user_events')
          .select('id, event_id, event_name, event_date, venue_name, category, image_url, ticket_url, state, user_id')
          .in('user_id', followingIds)
          .eq('state', 'going')
          .gte('event_date', today)
          .order('event_date', { ascending: true })
          .limit(20),
        supabase
          .from('profiles')
          .select('id, display_name, handle')
          .in('id', followingIds),
      ])

      friendEvents = (fEvents ?? []) as FriendEvent[]
      friendProfiles = new Map((fProfiles ?? []).map(p => [p.id, p as FriendProfile]))
    }
  }

  const eventsByTab: Record<TabKey, UserEvent[]> = {
    going: goingEvents,
    saved: savedEvents,
    past:  pastEvents,
    friends: [], // rendered separately
  }

  const events = eventsByTab[activeTab]

  // All tabs including Friends (only for logged-in)
  const TABS = [...BASE_TABS, { key: 'friends' as TabKey, label: 'Friends' }]

  return (
    <main id="main" className="min-h-dvh bg-[--bg]">
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-sand-mid/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-ink-mid hover:text-terra transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-black text-lg text-ink" style={{ fontFamily: 'var(--font-epilogue)' }}>
            My Events
          </h1>
          <Link href="/profile" className="text-xs text-ink-light hover:text-terra transition-colors">
            <User className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Tab row */}
        <div className="flex gap-2 mb-5 overflow-x-auto">
          {TABS.map(({ key, label }) => {
            const count = key !== 'friends' ? eventsByTab[key].length : friendEvents.length
            return (
              <Link
                key={key}
                href={`/saved?tab=${key}`}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all whitespace-nowrap ${
                  activeTab === key
                    ? 'bg-terra text-white border-terra'
                    : 'bg-white text-ink-mid border-sand-mid hover:border-terra'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === key
                      ? 'bg-white text-terra'  // active: solid white pill, terra text — passes WCAG on terra bg
                      : 'bg-sand-light text-terra'
                  }`}>{count}</span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Friends tab content */}
        {activeTab === 'friends' ? (
          followingIds.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Users className="w-10 h-10 text-sand-mid mx-auto mb-3" />
              <h2 className="text-base font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
                Follow people to see their plans
              </h2>
              <p className="text-xs text-ink-light mb-4">
                When you follow someone, their upcoming events will appear here.
              </p>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-terra text-white text-xs font-semibold hover:bg-terra-hover transition-colors"
              >
                Find people to follow →
              </Link>
            </div>
          ) : friendEvents.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Calendar className="w-10 h-10 text-sand-mid mx-auto mb-3" />
              <h2 className="text-base font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
                Nothing coming up yet
              </h2>
              <p className="text-xs text-ink-light mb-4">
                The people you follow haven&apos;t marked any upcoming events.
              </p>
              <Link href="/events" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-terra text-white text-xs font-semibold hover:bg-terra-hover transition-colors">
                Browse events
              </Link>
            </div>
          ) : (
            <div className="space-y-3 animate-fade-up">
              {friendEvents.map(ev => {
                const friend = friendProfiles.get(ev.user_id)
                const friendHandle = friend?.handle
                  ? (friend.handle.startsWith('@') ? friend.handle : `@${friend.handle}`)
                  : `@${ev.user_id.slice(0, 8)}`
                return (
                  <FriendEventCard key={ev.id} event={ev} friendHandle={friendHandle} />
                )
              })}
            </div>
          )
        ) : events.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <Bookmark className="w-10 h-10 text-sand-mid mx-auto mb-3" />
            <h2 className="text-base font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
              {activeTab === 'going'  ? 'Nothing on your calendar yet' :
               activeTab === 'saved'  ? 'No saved events' :
               'No past events'}
            </h2>
            <p className="text-xs text-ink-light mb-4">
              {activeTab === 'past'
                ? 'Events you attend will appear here.'
                : 'Save events from any event page to track them here. The best ones come with a plan and a person.'}
            </p>
            <Link href="/events" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-terra text-white text-xs font-semibold hover:bg-terra-hover transition-colors">
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

function FriendEventCard({ event, friendHandle }: { event: FriendEvent; friendHandle: string }) {
  const dateStr = event.event_date
    ? new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : null
  const imageUrl = event.image_url || getCategoryFallback(event.category ?? undefined, event.event_id)

  return (
    <div className="flex gap-3 bg-white rounded-xl border border-sand-light p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-sand-light">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-ink leading-tight line-clamp-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            {event.event_name || 'Untitled Event'}
          </h3>
          {dateStr && (
            <p className="text-[10px] text-terra font-medium flex items-center gap-1 mt-0.5">
              <Calendar className="w-2.5 h-2.5" />
              {dateStr}
            </p>
          )}
          {event.venue_name && (
            <p className="text-[10px] text-ink-light flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              {event.venue_name}
            </p>
          )}
          <p className="text-[10px] text-turq font-medium mt-0.5">
            via {friendHandle}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <Link
            href={`/events/${event.event_id}`}
            className="text-[10px] font-semibold text-terra hover:underline"
          >
            View event →
          </Link>
          {event.ticket_url && (
            <a
              href={affiliateUrl(event.ticket_url) ?? event.ticket_url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-[10px] text-turq hover:underline"
            >
              Tickets <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function SavedEventCard({ event, activeTab }: { event: UserEvent; activeTab: TabKey }) {
  const dateStr = event.event_date
    ? new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : null
  const imageUrl = event.image_url || getCategoryFallback(event.category ?? undefined, event.event_id)

  return (
    <div className="flex gap-3 bg-white rounded-xl border border-sand-light p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-sand-light">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {activeTab === 'going' && (
            <span className="inline-block text-[9px] font-bold bg-sage/10 text-sage rounded-full px-2 py-0.5 mb-1 uppercase tracking-wide">
              You&apos;re going
            </span>
          )}
          <h3 className="text-sm font-bold text-ink leading-tight line-clamp-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            {event.event_name || 'Untitled Event'}
          </h3>
          {dateStr && (
            <p className="text-[10px] text-terra font-medium flex items-center gap-1 mt-0.5">
              <Calendar className="w-2.5 h-2.5" />
              {dateStr}
            </p>
          )}
          {event.venue_name && (
            <p className="text-[10px] text-ink-light flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              {event.venue_name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <Link
            href={`/events/${event.event_id}`}
            className="text-[10px] font-semibold text-terra hover:underline"
          >
            View event →
          </Link>
          {event.ticket_url && (
            <a
              href={affiliateUrl(event.ticket_url) ?? event.ticket_url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-[10px] text-turq hover:underline"
            >
              Tickets <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
