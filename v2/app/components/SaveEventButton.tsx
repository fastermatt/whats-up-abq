'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Heart, HeartOff, Check, Calendar } from 'lucide-react'

interface Props {
  eventId: string
  eventName: string
  eventDate: string | null
  venueName: string | null
  category: string | null
  imageUrl: string | null
  ticketUrl: string | null
  goingCount: number
}

export function SaveEventButton({ eventId, eventName, eventDate, venueName, category, imageUrl, ticketUrl, goingCount }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser]         = useState<{ id: string } | null>(null)
  const [state, setState]       = useState<'saved' | 'going' | 'attended' | 'dismissed' | null>(null)
  const [loading, setLoading]   = useState(false)
  const [count, setCount]       = useState(goingCount)

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      if (!u) return

      const { data } = await supabase
        .from('user_events')
        .select('state')
        .eq('user_id', u.id)
        .eq('event_id', eventId)
        .single()

      if (data) setState(data.state as 'saved' | 'going')
    }
    init()
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!user) { router.push(`/login?next=/events/${eventId}`); return }
    setLoading(true)

    if (state === 'saved') {
      // Toggle off
      await supabase.from('user_events').delete().eq('user_id', user.id).eq('event_id', eventId)
      setState(null)
    } else {
      // Save
      await supabase.from('user_events').upsert({
        user_id: user.id, event_id: eventId, state: 'saved',
        event_name: eventName, event_date: eventDate,
        venue_name: venueName, category, image_url: imageUrl, ticket_url: ticketUrl,
      }, { onConflict: 'user_id,event_id' })
      setState('saved')
    }
    setLoading(false)
  }

  async function handleGoing() {
    if (!user) { router.push(`/login?next=/events/${eventId}`); return }
    setLoading(true)

    if (state === 'going') {
      await supabase.from('user_events').delete().eq('user_id', user.id).eq('event_id', eventId)
      setState(null)
      setCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('user_events').upsert({
        user_id: user.id, event_id: eventId, state: 'going',
        event_name: eventName, event_date: eventDate,
        venue_name: venueName, category, image_url: imageUrl, ticket_url: ticketUrl,
      }, { onConflict: 'user_id,event_id' })
      setCount(c => c + 1)
      setState('going')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Save */}
      <button
        onClick={handleSave}
        disabled={loading}
        className={`group flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
          state === 'saved'
            ? 'bg-[#9a442d]/10 border-[#9a442d]/30 text-[#9a442d]'
            : 'bg-white border-[#ddc9a3] text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d]'
        } disabled:opacity-50`}
      >
        {state === 'saved'
          ? <HeartOff className="w-3.5 h-3.5" />
          : <Heart className="w-3.5 h-3.5" />}
        {state === 'saved' ? 'Saved' : 'Save'}
      </button>

      {/* Going */}
      <button
        onClick={handleGoing}
        disabled={loading}
        className={`group flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
          state === 'going'
            ? 'bg-[#4f6249] border-[#4f6249] text-white'
            : 'bg-white border-[#ddc9a3] text-[#4a3f3a] hover:border-[#4f6249] hover:text-[#4f6249]'
        } disabled:opacity-50`}
      >
        {state === 'going'
          ? <Check className="w-3.5 h-3.5" />
          : <Calendar className="w-3.5 h-3.5" />}
        {state === 'going' ? "I'm going" : "I'm going"}
      </button>

      {/* Going count */}
      {count > 0 && (
        <span className="text-[10px] text-[#6b5d57]">
          {count} {count === 1 ? 'person' : 'people'} going
        </span>
      )}
    </div>
  )
}
