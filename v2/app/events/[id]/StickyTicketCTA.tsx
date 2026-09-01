'use client'

/**
 * StickyTicketCTA — slides up from the bottom on mobile when the primary
 * in-page ticket button scrolls out of view. Hidden on md+ screens.
 *
 * Uses IntersectionObserver on the element with id="main-cta" to decide
 * when to appear. On mount it waits for hydration, then observes.
 */
import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { trackEvent } from '@/lib/analytics/track'

interface Props {
  /** Pre-computed (server-side) affiliate URL or original ticket URL */
  href: string
  /** CTA label: "Get Tickets" | "RSVP Free" | "More Info" */
  label: string
  eventId: string
  source: string
}

export function StickyTicketCTA({ href, label, eventId, source }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const anchor = document.getElementById('main-cta')
    if (!anchor) return

    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.5 },
    )
    obs.observe(anchor)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      aria-hidden={!visible}
      className={[
        'fixed bottom-0 inset-x-0 z-40 md:hidden',
        'bg-cream/95 backdrop-blur-sm border-t border-sand-mid/60',
        'px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        'transition-transform duration-300 ease-out',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={visible ? 0 : -1}
        onClick={() => trackEvent('ticket_click', { event_id: eventId, source, label })}
        className="flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl bg-terra text-white font-bold text-[15px] shadow-lg shadow-terra/25 hover:bg-terra-hover transition-colors active:scale-[0.98]"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        {label}
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  )
}
