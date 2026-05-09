import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './SignOutButton'
import { EditProfileForm } from './EditProfileForm'
import { MapPin, Trophy, Zap, Star, CheckSquare, Calendar, ArrowLeft, Heart, Users, Bell, Search, UserPlus, HelpCircle, Sparkles } from 'lucide-react'
import { PushBell } from '@/app/components/PushBell'
import type { UserPreferences } from '@/app/components/PreferencesPicker'

export const metadata: Metadata = {
  title: 'My Profile | ABQ Unplugged',
}

export const revalidate = 0

// Badge definitions
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

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile + stats
  const [{ data: profile }, { data: checkIns }, { data: userEvents }, { data: reviews }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('check_ins').select('id, event_name, event_date, venue_name, category, checked_in_at').eq('user_id', user.id).order('checked_in_at', { ascending: false }),
    supabase.from('user_events').select('id, state, event_name, event_date').eq('user_id', user.id),
    supabase.from('reviews').select('id').eq('user_id', user.id),
  ])

  const totalCheckins  = checkIns?.length ?? 0
  const savedCount     = userEvents?.filter(e => e.state === 'saved').length ?? 0
  const goingCount     = userEvents?.filter(e => e.state === 'going').length ?? 0
  const reviewCount    = reviews?.length ?? 0
  const uniqueVenues   = new Set(checkIns?.map(c => c.venue_name).filter(Boolean)).size
  const earnedBadges: string[] = profile?.badges ?? []

  // Leaderboard position
  const { data: leaderboard } = await supabase
    .from('leaderboard_view')
    .select('id, handle, display_name, total_checkins, weekly_checkins')
    .order('total_checkins', { ascending: false })
    .limit(10)

  const myRank = leaderboard?.findIndex(l => l.id === user.id) ?? -1

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'ABQ Fan'
  const handle      = profile?.handle || `@${user.email?.split('@')[0]}`

  return (
    <main id="main" className="min-h-dvh bg-[--bg]">
      {/* Nav */}
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="font-black text-lg text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
            My Profile
          </span>
          <SignOutButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-up">

        {/* Hero card — flat cream + terra avatar (round-4 #9). DESIGN.md
            Flat-By-Default Rule says decorative gradient backgrounds on
            internal product surfaces are SaaS reflexes. The avatar stays
            terra-filled to carry brand presence without a hero gradient. */}
        <div className="bg-white border border-[#f0e4cc] rounded-2xl p-5">
          <div className="flex items-start gap-4">
            {/* Avatar — terra-filled, the single brand moment in the block */}
            <div
              className="w-16 h-16 rounded-full bg-[#9a442d] text-white flex items-center justify-center text-2xl font-black flex-shrink-0"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-[#1a1614] truncate" style={{ fontFamily: 'var(--font-epilogue)' }}>
                {displayName}
              </h1>
              <p className="text-[#6b5d57] text-sm">{handle}</p>
              {profile?.neighborhood && (
                <p className="text-[#6b5d57] text-xs flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {profile.neighborhood}
                </p>
              )}
              <p className="text-[#8a7a74] text-xs mt-1">
                Member since {new Date(profile?.joined_at ?? user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Stats row — sandstone tiles for warmth without a gradient */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { n: totalCheckins, label: 'Check-ins' },
              { n: uniqueVenues,  label: 'Venues' },
              { n: profile?.streak_weeks ?? 0, label: 'Streak' },
              { n: reviewCount,   label: 'Reviews' },
            ].map(({ n, label }) => (
              <div key={label} className="bg-[#fbf7f1] border border-[#f0e4cc] rounded-xl p-2.5 text-center">
                <p className="text-xl font-black text-[#9a442d]" style={{ fontFamily: 'var(--font-epilogue)' }}>{n}</p>
                <p className="text-[10px] text-[#6b5d57] uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Edit profile + preferences — combined accordion */}
        <EditProfileForm
          userId={user.id}
          currentDisplayName={profile?.display_name ?? ''}
          currentHandle={profile?.handle ?? ''}
          currentNeighborhood={profile?.neighborhood ?? ''}
          currentBio={profile?.bio ?? ''}
          currentPreferences={(profile?.preferences as UserPreferences) ?? {}}
        />

        {/* Badges */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Badges
            </h2>
            <span className="text-xs text-[#6b5d57]">{earnedBadges.length}/{BADGE_DEFS.length}</span>
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
                  <img src={badge.icon} alt={badge.label} className="w-8 h-8 mb-1" style={earned ? {} : { filter: 'grayscale(1)' }} />
                  <span className="text-[9px] font-semibold text-[#4a3f3a] leading-tight">{badge.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/for-you"
            className="flex items-center gap-3 bg-[#fdf9f4] rounded-xl p-4 border border-[#e8d9bf] hover:border-[#9a442d]/40 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#9a442d]/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#9a442d]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1a1614]">For You</p>
              <p className="text-[10px] text-[#6b5d57]">Your matched feed</p>
            </div>
          </Link>
          <Link
            href="/saved"
            className="flex items-center gap-3 bg-white rounded-xl p-4 border border-[#f0e4cc] hover:border-[#9a442d]/30 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#4f6249]/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-[#4f6249]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1a1614]">{savedCount + goingCount}</p>
              <p className="text-[10px] text-[#6b5d57]">Saved</p>
            </div>
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center gap-3 bg-white rounded-xl p-4 border border-[#f0e4cc] hover:border-[#9a442d]/30 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#006a62]/10 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-[#006a62]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1a1614]">
                {myRank >= 0 ? `#${myRank + 1}` : 'Unranked'}
              </p>
              <p className="text-[10px] text-[#6b5d57]">Leaderboard</p>
            </div>
          </Link>
        </div>

        {/* Recent check-ins */}
        {(checkIns?.length ?? 0) > 0 && (
          <section>
            <h2 className="text-base font-black text-[#1a1614] mb-3" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Recent Check-ins
            </h2>
            <div className="space-y-2">
              {checkIns!.slice(0, 5).map(ci => (
                <div key={ci.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#f0e4cc]">
                  <CheckSquare className="w-4 h-4 text-[#4f6249] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1614] truncate">{ci.event_name}</p>
                    <p className="text-[10px] text-[#6b5d57]">{ci.venue_name}</p>
                  </div>
                  <p className="text-[10px] text-[#6b5d57] flex-shrink-0">
                    {ci.event_date ? new Date(ci.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {totalCheckins === 0 && (
          <div className="text-center py-8 bg-white rounded-2xl border border-[#f0e4cc]">
            <Zap className="w-10 h-10 text-[#9a442d] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Time to get out there
            </h3>
            <p className="text-xs text-[#6b5d57] mb-4 max-w-xs mx-auto">
              Attend events, check in, earn badges, and climb the leaderboard.
            </p>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#9a442d] text-white text-xs font-semibold hover:bg-[#7d3725] transition-colors"
            >
              <Calendar className="w-3 h-3" />
              Find events tonight
            </Link>
          </div>
        )}

        {/* Notifications */}
        <section>
          <h2 className="text-base font-black text-[#1a1614] mb-3" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Notifications
          </h2>
          <div className="bg-white rounded-xl border border-[#f0e4cc] divide-y divide-[#f0e4cc]">
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Bell className="w-4 h-4 text-[#9a442d] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#1a1614]">Event reminders</p>
                  <p className="text-[10px] text-[#6b5d57] mt-0.5">Push notifications for events you&apos;re going to</p>
                </div>
              </div>
              <PushBell />
            </div>
            <Link
              href="/profile/notifications"
              className="p-4 flex items-center justify-between gap-3 hover:bg-[#fbf7f1]/60 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Bell className="w-4 h-4 text-[#4f6249] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#1a1614]">What to hear about</p>
                  <p className="text-[10px] text-[#6b5d57] mt-0.5">Categories, venues, artists, neighborhoods — only get notified about stuff you care about</p>
                </div>
              </div>
              <span className="text-[#9a442d] text-lg">›</span>
            </Link>
          </div>
        </section>

        {/* How to Use guide */}
        <section>
          <h2 className="text-base font-black text-[#1a1614] mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            <HelpCircle className="w-4 h-4 text-[#9a442d]" />
            Tips & Tricks
          </h2>
          <div className="bg-white rounded-xl border border-[#f0e4cc] divide-y divide-[#f0e4cc]">
            {[
              {
                icon: <Heart className="w-4 h-4 text-[#9a442d]" />,
                title: 'Save events instantly',
                desc: 'Tap the heart ♥ on any event card to save it without opening the full page. Hearts on card listings, hearts on detail pages: both work.',
              },
              {
                icon: <Search className="w-4 h-4 text-[#006a62]" />,
                title: 'Find friends',
                desc: 'Go to the Leaderboard page to see active users. Check someone\'s rank, then tap their name to visit their public profile. From there you can follow them.',
              },
              {
                icon: <UserPlus className="w-4 h-4 text-[#4f6249]" />,
                title: 'Follow people',
                desc: 'Visit a user\'s profile at abqunplugged.com/u/their-handle and tap Follow. Their going events will show up in your Saved → Friends tab.',
              },
              {
                icon: <Users className="w-4 h-4 text-[#9a442d]" />,
                title: 'See what friends are doing',
                desc: 'In the Saved tab, switch to the Friends tab to see every event the people you follow have marked as "Going." No FOMO.',
              },
              {
                icon: <CheckSquare className="w-4 h-4 text-[#4f6249]" />,
                title: 'Check in at events',
                desc: 'Open an event page while you\'re there and tap "Check In." Earn badges, build your streak, and climb the leaderboard.',
              },
              {
                icon: <Trophy className="w-4 h-4 text-[#006a62]" />,
                title: 'Earn badges',
                desc: 'Badges unlock automatically: first check-in, 5 check-ins, music events, comedy shows, outdoor events. See them on your profile and others\' profiles.',
              },
              {
                icon: <Zap className="w-4 h-4 text-[#9a442d]" />,
                title: 'Surprise Me',
                desc: 'Hit the ⚡ Surprise Me button on the homepage to get sent to a random upcoming event. Great for beating decision paralysis.',
              },
              {
                icon: <Bell className="w-4 h-4 text-[#4f6249]" />,
                title: 'Pull to refresh (on mobile)',
                desc: 'If you\'ve added ABQ Unplugged to your home screen, pull down from the top of any page to refresh the event feed.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 flex-shrink-0">{icon}</div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1614]">{title}</p>
                  <p className="text-[11px] text-[#6b5d57] mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  )
}
