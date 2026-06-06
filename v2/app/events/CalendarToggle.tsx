'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays } from 'lucide-react'

interface CalendarToggleProps {
  isOpen: boolean
}

export function CalendarToggle({ isOpen }: CalendarToggleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function toggle() {
    const params = new URLSearchParams(searchParams.toString())
    if (isOpen) {
      params.delete('cal')
      params.delete('date')
    } else {
      params.set('cal', '1')
    }
    params.delete('page')
    router.push(`/events?${params.toString()}`, { scroll: false })
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
        isOpen
          ? 'bg-terra text-white'
          : 'bg-white border border-sand-mid text-ink-mid hover:border-terra hover:text-terra'
      }`}
      aria-label={isOpen ? 'Hide calendar' : 'Show calendar'}
    >
      <CalendarDays className="w-3.5 h-3.5" />
      Calendar
    </button>
  )
}
