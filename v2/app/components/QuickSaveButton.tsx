'use client'

/**
 * QuickSaveButton — compact heart button for event cards on listing pages.
 *
 * Design philosophy: starts neutral on mount (no DB pre-check on every card —
 * that would be 36 Supabase queries per page). Once the user interacts it's
 * optimistic-update from that point. Full saved-state is on /saved.
 *
 * Animation: fill + pop + ring-ping on first save, deflate on unsave.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'

interface Props {
  eventId: string
  eventName: string
  eventDate: string | null
  venueName: string | null
  category: string | null
  imageUrl: string | null
  ticketUrl: string | null
  className?: string
}

export function QuickSaveButton({
  eventId, eventName, eventDate, venueName, category, imageUrl, ticketUrl, className = '',
}: Props) {
  const router  = useRouter()
  const supabase = createClient()

  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [burst,   setBurst]   = useState(false)   // controls the ring animation

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?next=/events/${eventId}`)
      setLoading(false)
      return
    }

    if (saved) {
      // Unsave
      await supabase.from('user_events')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', eventId)
      setSaved(false)
    } else {
      // Save
      await supabase.from('user_events').upsert({
        user_id: user.id, event_id: eventId, state: 'saved',
        event_name: eventName, event_date: eventDate,
        venue_name: venueName, category, image_url: imageUrl, ticket_url: ticketUrl,
      }, { onConflict: 'user_id,event_id' })
      setSaved(true)
      setBurst(true)
      // Reset burst after animation completes
      setTimeout(() => setBurst(false), 700)
    }

    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      aria-label={saved ? 'Remove from saved' : 'Save event'}
      data-umami-event="save-event"
      data-umami-event-event-id={eventId}
      data-umami-event-source="quick-save"
      data-umami-event-action={saved ? 'unsave' : 'save'}
      className={`relative flex items-center justify-center w-8 h-8 rounded-full
        transition-all duration-200 select-none
        ${saved
          ? 'bg-[#9a442d] shadow-md shadow-[#9a442d]/40'
          : 'bg-black/40 backdrop-blur-sm hover:bg-[#9a442d]/80'}
        disabled:opacity-60 active:scale-90
        ${className}`}
    >
      {/* The heart — scales up on save, down on unsave */}
      <Heart
        className={`w-4 h-4 text-white transition-transform
          ${saved ? 'fill-white scale-110' : 'scale-100'}
          ${burst ? 'animate-heart-pop' : ''}`}
      />

      {/* Ring ping — expands outward when saving */}
      {burst && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[#9a442d] animate-heart-ring"
        />
      )}
    </button>
  )
}
