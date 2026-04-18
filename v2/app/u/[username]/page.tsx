import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FollowButton } from '@/app/components/FollowButton'
import { getCategoryFallback } from '@/lib/fallback-images'
import { ArrowLeft, MapPin, Calendar, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Badge definitions (read-only, same as profile page)
const BADGE_DEFS = [
  { id: 'first_checkin',    label: 'First Check-in', icon: '/badges/first-checkin.svg', desc: 'Checked into your first event' },
  { id: 'five_checkins',    label: 'Regular',         icon: '/badges/regular.svg',       desc: '5 check-ins' },
  { id: 'ten_checkins',     label: 'Super Fan',        icon: '/badges/super-fan.svg',     desc: '10 check-ins' },
  { id: 'first_friday',     label: 'First Friday',     icon: '/badges/first-friday.svg',  desc: 'Attended a First Friday' },
  { id: 'streak_3',         label: '3-Week Streak',    icon: '/badges/streak.svg',        desc: 'Out 3 weeks in a row' },
  { id: 'green_chile',      label: 'Green Chile',      icon: '/badges/green-chile.svg',   desc: 'Checked in at a local spot' },
  { id: 'burqueno',         label: 'Burqueño',         icon: '/badges/burqueno.svg',      desc: 'Visited 5+ venues' },
  { id: 'music_lover',      label: 'Music Lover',      icon: '/badges/music-lover.svg',   desc: '5 music events' },
  { id: 'comedy_buff',      label: 'Comedy Buff',      icon: '/badges/comedy-buff.svg',   desc: '3 comedy shows' },
  { id: 'outdoor_explorer', label: 'Explorer',         icon: '/badges/explorer.svg',      desc: '3 outdoor events' },
]

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, handle')
    .or(`handle.eq.${username},handle.eq.@${username}`)
    .eq('is_public', true)
    .single()

  if (!profile) {
    return { title: 'Profile not found | ABQ Unplugged' }
  }

  const displayName = profile.display_name || username
  const handle = profile.handle?.startsWith('@') ? profile.handle : `@${profile.handle ?? username}`

  return {
    title: `${displayName} (${handle}) — ABQ Unplugged`,
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params
  const supabase = await createClient()

  // Look up profile by handle (with or without @)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .or(`handle.eq.${username},handle.eq.@${username}`)
    .single()

  if (!profile || profile.is_public === false) {
    notFound()
  }

  const today = new Date().toISOString().split('T')[0]

  // Parallel fetches: follower count, following count, current user, going events
  const [
    { count: followerCount },
    { count: followingCount },
    { data: { user } },
    { data: goingEvents },
  ] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    supabase.auth.getUser(),
    supabase
      .from('user_events')
      .select('id, event_id, event_name, event_date, venue_name, category, image_url')
      .eq('user_id', profile.id)
      .eq('state', 'going')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(8),
  ])

  // Check if current user follows this profile
  let currentUserFollows = false
  if (user && user.id !== profile.id) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profile.id)
      .single()
    currentUserFollows = !!followRow
  }

  const displayName = profile.display_name || username
  const handle = profile.handle?.startsWith('@') ? profile.handle : `@${profile.handle ?? username}`
  const earnedBadges: string[] = profile.badges ?? []
  const totalCheckIns = profile.total_check_ins ?? 0

  return (
    <main className="min-h-dvh bg-[#fbf7f1]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#fbf7f1]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-black text-lg text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Profile
          </h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-up">

        {/* Profile card */}
        <div className="bg-gradient-to-br from-[#9a442d] to-[#7d3725] rounded-2xl p-5 text-white">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-black flex-shrink-0"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="text-xl font-black truncate" style={{ fontFamily: 'var(--font-epilogue)' }}>
                    {displayName}
                  </h1>
                  <p className="text-white/70 text-sm">{handle}</p>
                  {profile.neighborhood && (
                    <p className="text-white/60 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {profile.neighborhood}
                    </p>
                  )}
                </div>
                {/* Follow button — only if logged in and not own profile */}
                {user && user.id !== profile.id && (
                  <div className="flex-shrink-0 mt-1">
                    <FollowButton handle={username} initialFollowing={currentUserFollows} />
                  </div>
                )}
              </div>
              {profile.bio && (
                <p className="text-white/70 text-xs mt-2 leading-relaxed">{profile.bio}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { n: totalCheckIns, label: 'Check-ins' },
              { n: followerCount ?? 0, label: 'Followers' },
              { n: followingCount ?? 0, label: 'Following' },
            ].map(({ n, label }) => (
              <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>{n}</p>
                <p className="text-[10px] text-white/60 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Going to */}
        <section>
          <h2 className="text-base font-black text-[#1a1614] mb-3" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Going to
          </h2>
          {(goingEvents?.length ?? 0) === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-[#f0e4cc]">
              <Calendar className="w-8 h-8 text-[#ddc9a3] mx-auto mb-2" />
              <p className="text-sm text-[#8a7a74]">No upcoming events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {goingEvents!.map(ev => {
                const dateStr = ev.event_date
                  ? new Date(ev.event_date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    })
                  : null
                const imageUrl = ev.image_url || getCategoryFallback(ev.category ?? undefined, ev.event_id)

                return (
                  <Link
                    key={ev.id}
                    href={`/events/${ev.event_id}`}
                    className="flex gap-3 bg-white rounded-xl border border-[#f0e4cc] p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#f0e4cc]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[#1a1614] leading-tight line-clamp-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
                        {ev.event_name || 'Untitled Event'}
                      </h3>
                      {dateStr && (
                        <p className="text-[10px] text-[#9a442d] font-medium flex items-center gap-1 mt-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {dateStr}
                        </p>
                      )}
                      {ev.venue_name && (
                        <p className="text-[10px] text-[#8a7a74] flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {ev.venue_name}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Badges */}
        {earnedBadges.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
                Badges
              </h2>
              <span className="text-xs text-[#8a7a74]">{earnedBadges.length}/{BADGE_DEFS.length}</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {BADGE_DEFS.map(badge => {
                const earned = earnedBadges.includes(badge.id)
                return (
                  <div
                    key={badge.id}
                    title={badge.desc}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all ${
                      earned
                        ? 'bg-white border-[#f0e4cc] shadow-sm'
                        : 'bg-[#f7f2ec] border-[#e8d9bf] opacity-40'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={badge.icon} alt={badge.label} className="w-8 h-8 mb-1" style={earned ? {} : { filter: 'grayscale(1)' }} />
                    <span className="text-[9px] font-semibold text-[#4a3f3a] leading-tight">{badge.label}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Login prompt to follow */}
        {!user && (
          <div className="bg-white rounded-2xl border border-[#f0e4cc] p-5 text-center">
            <Users className="w-8 h-8 text-[#ddc9a3] mx-auto mb-2" />
            <p className="text-sm font-bold text-[#1a1614] mb-1">Follow {displayName}</p>
            <p className="text-xs text-[#8a7a74] mb-3">Sign in to follow and see where your friends are going.</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#9a442d] text-white text-xs font-semibold hover:bg-[#7d3725] transition-colors"
            >
              Sign in free
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
