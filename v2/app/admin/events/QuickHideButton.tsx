'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function QuickHideButton({ eventId, hidden }: { eventId: string; hidden: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const toggle = async () => {
    setLoading(true)
    await fetch('/api/admin/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, hidden: !hidden }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${
        hidden
          ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
          : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
      }`}
    >
      {hidden ? 'Unhide' : 'Hide'}
    </button>
  )
}
