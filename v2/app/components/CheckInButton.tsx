'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MapPin } from 'lucide-react'

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
