'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MapPin } from 'lucide-react'

/** Award badges based on check-in milestones. Idempotent — safe to call multiple times. */
async function awardBadges(supabase: SupabaseClient, userId: string) {
  try {
    const [{ data: profile }, { data: checkIns }] = await Promise.all([
      supabase.from('profiles').select('badges, events_attended').eq('id', userId).single(),
      supabase.from('check_ins').select('event_id, category, event_date').eq('user_id', userId),
    ])

    const earned: string[] = (profile?.badges as string[]) ?? []
    const totalCheckins = checkIns?.length ?? 0
    const uniqueVenues = new Set(checkIns?.map(c => c.event_id)).size
    const musicEvents = checkIns?.filter(c => c.category === 'Music').length ?? 0
    const comedyEvents = checkIns?.filter(c => c.category === 'Comedy').length ?? 0
    const outdoorEvents = checkIns?.filter(c => c.category === 'Outdoor').length ?? 0

    const toAdd: string[] = []

    if (totalCheckins >= 1  && !earned.includes('first_checkin'))   toAdd.push('first_checkin')
    if (totalCheckins >= 5  && !earned.includes('five_checkins'))   toAdd.push('five_checkins')
    if (totalCheckins >= 10 && !earned.includes('ten_checkins'))    toAdd.push('ten_checkins')
    if (uniqueVenues >= 5   && !earned.includes('burqueno'))        toAdd.push('burqueno')
    if (musicEvents >= 5    && !earned.includes('music_lover'))     toAdd.push('music_lover')
    if (comedyEvents >= 3   && !earned.includes('comedy_buff'))     toAdd.push('comedy_buff')
    if (outdoorEvents >= 3  && !earned.includes('outdoor_explorer')) toAdd.push('outdoor_explorer')

    if (toAdd.length > 0) {
      await supabase
        .from('profiles')
        .update({
          badges: [...earned, ...toAdd],
          events_attended: totalCheckins,
        })
        .eq('id', userId)
    }
  } catch {
    // Non-critical — don't fail the check-in
  }
}

interface Props {
  eventId: string
  eventName: string
  eventDate: string | null
}

export function CheckInButton({ eventId, eventName, eventDate }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      if (!u) { setLoaded(true); return }

      const { data } = await supabase
        .from('check_ins')
        .select('id')
        .eq('user_id', u.id)
        .eq('event_id', eventId)
        .maybeSingle()

      setCheckedIn(!!data)
      setLoaded(true)
    }
    init()
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return null

  // Only show if event is today or in the past (within 2 days)
  const today = new Date().toISOString().slice(0, 10)
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
  if (eventDate && eventDate > today) return null // future event — no check-in yet
  if (eventDate && eventDate < twoDaysAgo) return null // too old

  if (checkedIn) {
    return (
      <div className="flex items-center gap-2 text-[#4f6249]">
        <CheckCircle2 className="w-4 h-4 fill-[#4f6249] text-white" />
        <span className="text-xs font-semibold">Checked in!</span>
      </div>
    )
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            if (!user) { router.push(`/login?next=/events/${eventId}`); return }
            setLoading(true)

            await supabase.from('check_ins').upsert({
              user_id: user.id,
              event_id: eventId,
              event_name: eventName,
              event_date: eventDate,
            }, { onConflict: 'user_id,event_id' })

            // Award badges after check-in
            await awardBadges(supabase, user.id)

            setCheckedIn(true)
            setShowConfirm(false)
            setLoading(false)
          }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4f6249] text-white text-xs font-semibold hover:bg-[#3d4e38] transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {loading ? 'Checking in…' : 'Yes, I\'m here!'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="text-xs text-[#8a7a74] hover:text-[#4a3f3a]"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => {
        if (!user) { router.push(`/login?next=/events/${eventId}`); return }
        setShowConfirm(true)
      }}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#ddc9a3] bg-white text-xs font-semibold text-[#4a3f3a] hover:border-[#4f6249] hover:text-[#4f6249] transition-all"
    >
      <MapPin className="w-3.5 h-3.5" />
      Check in
    </button>
  )
}
