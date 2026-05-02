'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function QuickPinnedLastButton({ eventId, pinnedLast }: { eventId: string; pinnedLast: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const toggle = async () => {
    setLoading(true)
    await fetch('/api/admin/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, pinned_last: !pinnedLast }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={pinnedLast ? 'Remove from end — restore normal order' : 'Push to end of all listings'}
      className={`text-xs px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${
        pinnedLast
          ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
          : 'bg-white/10 text-white/30 hover:text-orange-400 hover:bg-orange-500/10'
      }`}
    >
      {pinnedLast ? '↓ Last' : '↓'}
    </button>
  )
}
