'use client'

import { ExternalLink } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/track'

interface Props {
  href: string
  eventId: string
  source: string
  label: string
}

export function TrackedTicketLink({ href, eventId, source, label }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('ticket_click', { event_id: eventId, source, label })}
      className="flex-1 sm:flex-none group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-terra text-white font-bold text-[15px] hover:bg-terra-hover transition-all duration-200 hover:shadow-lg hover:shadow-terra/25 hover:scale-[1.01] active:scale-[0.99]"
      style={{ fontFamily: 'var(--font-epilogue)' }}
      data-umami-event="ticket-click"
      data-umami-event-event-id={eventId}
      data-umami-event-source={source}
      data-umami-event-label={label}
    >
      {label}
      <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
    </a>
  )
}
