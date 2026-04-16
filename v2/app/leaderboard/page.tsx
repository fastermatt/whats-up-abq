import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Trophy, MapPin, ArrowLeft, Medal } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Leaderboard | ABQ Unplugged',
}

export const revalidate = 300

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { period: periodParam } = await searchParams
  const isWeekly = periodParam === 'week'

  // Fetch leaderboard — weekly uses weekly_checkins, all-time uses total_checkins
  const { data: board } = await supabase
    .from('leaderboard_view')
    .select('*')
    .order(isWeekly ? 'weekly_checkins' : 'total_checkins', { ascending: false })
    .limit(25)

  // Filter for weekly: only show users with at least 1 weekly check-in
  const displayBoard = isWeekly
    ? (board ?? []).filter(l => (l.weekly_checkins ?? 0) > 0)
    : (board ?? [])

  const myRank = displayBoard.findIndex(l => l.id === user?.id)

  const tabs = [
    { label: 'All Time', href: '/leaderboard' },
    { label: 'This Week', href: '/leaderboard?period=week' },
  ]

  return (
    <main className="min-h-dvh bg-[--bg]">
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/profile" className="text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-black text-lg text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Leaderboard
          </h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 animate-fade-up">

        {/* Hero */}
        <div className="bg-gradient-to-br from-[#006a62] to-[#004f49] rounded-2xl p-5 text-white text-center">
          <Trophy className="w-10 h-10 mx-auto mb-2 text-[#7cc4bf]" />
          <h2 className="text-xl font-black" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Top ABQ Event-Goers
          </h2>
          <p className="text-white/60 text-sm mt-1">Who&apos;s actually out there living it up</p>
          {user && myRank >= 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-sm">
              <Medal className="w-4 h-4" />
              You&apos;re ranked #{myRank + 1} {isWeekly ? 'this week' : 'overall'}
            </div>
          )}
          {user && myRank < 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5 text-sm text-white/60">
              Check in at events to get on the board
            </div>
          )}
        </div>

        {/* Period tabs */}
        <div className="flex gap-2">
          {tabs.map(tab => {
            const active = (tab.href === '/leaderboard' && !isWeekly) || (tab.href.includes('week') && isWeekly)
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? 'bg-[#9a442d] text-white border-[#9a442d]'
                    : 'bg-white text-[#4a3f3a] border-[#ddc9a3] hover:border-[#9a442d]'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        {/* Leaderboard list */}
        {displayBoard.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#f0e4cc]">
            <Trophy className="w-10 h-10 text-[#ddc9a3] mx-auto mb-3" />
            <h3 className="font-bold text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
              {isWeekly ? 'No check-ins this week yet' : 'No one here yet'}
            </h3>
            <p className="text-xs text-[#8a7a74] mb-4">
              {isWeekly
                ? 'Check into an event this week to appear on the board!'
                : 'Be the first to check in and claim the #1 spot!'}
            </p>
            <Link href="/events" className="text-xs font-semibold text-[#9a442d] hover:underline">
              Find an event →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {displayBoard.map((person, idx) => {
              const isMe = person.id === user?.id
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
              const score = isWeekly ? (person.weekly_checkins ?? 0) : (person.total_checkins ?? 0)

              return (
                <div
                  key={person.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                    isMe
                      ? 'bg-[#9a442d]/5 border-[#9a442d]/30 shadow-sm'
                      : 'bg-white border-[#f0e4cc]'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {medal ? (
                      <span className="text-xl">{medal}</span>
                    ) : (
                      <span className="text-sm font-bold text-[#8a7a74]">#{idx + 1}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
                    isMe ? 'bg-[#9a442d] text-white' : 'bg-[#f0e4cc] text-[#9a442d]'
                  }`} style={{ fontFamily: 'var(--font-epilogue)' }}>
                    {(person.display_name || person.handle || '?').charAt(0).toUpperCase()}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1a1614] truncate">
                      {person.display_name || person.handle || 'ABQ Fan'}
                      {isMe && <span className="ml-1.5 text-[10px] text-[#9a442d] font-normal">you</span>}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[#8a7a74]">
                      {person.neighborhood && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {person.neighborhood}
                        </span>
                      )}
                      {(person.unique_venues ?? 0) > 0 && (
                        <span>{person.unique_venues} venues</span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
                      {score}
                    </p>
                    <p className="text-[10px] text-[#8a7a74]">
                      {isWeekly ? 'this week' : 'total'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* How it works */}
        <div className="bg-white rounded-2xl border border-[#f0e4cc] p-4">
          <p className="text-xs font-bold text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            How to climb the ranks
          </p>
          <ul className="space-y-1.5 text-xs text-[#8a7a74]">
            <li className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#9a442d]/10 flex items-center justify-center text-[9px]">1</span>
              Browse events and tap &quot;I&apos;m going&quot;
            </li>
            <li className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#9a442d]/10 flex items-center justify-center text-[9px]">2</span>
              Show up and tap &quot;Check in&quot; on the event page
            </li>
            <li className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#9a442d]/10 flex items-center justify-center text-[9px]">3</span>
              Earn points, badges, and weekly ranking glory
            </li>
          </ul>
        </div>

        {/* CTA for unauthed */}
        {!user && (
          <div className="bg-white rounded-2xl border border-[#f0e4cc] p-5 text-center">
            <p className="text-sm font-bold text-[#1a1614] mb-1">Want to compete?</p>
            <p className="text-xs text-[#8a7a74] mb-3">Create a free account to track your check-ins and climb the rankings.</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#9a442d] text-white text-xs font-semibold hover:bg-[#7d3725] transition-colors"
            >
              Join free →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
