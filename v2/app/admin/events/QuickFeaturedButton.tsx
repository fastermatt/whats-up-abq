'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function QuickFeaturedButton({ eventId, featured }: { eventId: string; featured: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const toggle = async () => {
    setLoading(true)
    await fetch('/api/admin/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, featured: !featured }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={featured ? 'Remove from featured' : 'Mark as featured'}
      className={`text-xs px-3 py-1 rounded-lg transition-colors disabled:opacity-50 ${
        featured
          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
          : 'bg-white/10 text-white/40 hover:text-yellow-400 hover:bg-yellow-500/10'
      }`}
    >
      {featured ? '★ Featured' : '☆'}
    </button>
  )
}
