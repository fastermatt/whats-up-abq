'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
  eventId: string
  currentStatus: string
}

export function ReportActions({ reportId, currentStatus }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const update = async (status: string) => {
    setLoading(true)
    await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reportId, status }),
    })
    router.refresh()
    setLoading(false)
  }

  if (currentStatus !== 'pending') return null

  return (
    <div className="flex gap-2 pt-1 border-t border-white/10">
      <button
        onClick={() => update('resolved')}
        disabled={loading}
        className="text-xs px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors disabled:opacity-50"
      >
        ✓ Resolve
      </button>
      <button
        onClick={() => update('dismissed')}
        disabled={loading}
        className="text-xs px-3 py-1.5 bg-white/10 text-white/50 rounded-lg hover:bg-white/15 transition-colors disabled:opacity-50"
      >
        Dismiss
      </button>
    </div>
  )
}
