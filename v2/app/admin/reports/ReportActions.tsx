'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
  eventId: string
  currentStatus: string
  initialNotes?: string
}

export function ReportActions({ reportId, currentStatus, initialNotes }: Props) {
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [showNotes, setShowNotes] = useState(false)
  const router = useRouter()

  const update = async (status: string) => {
    setLoading(true)
    await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reportId, status, admin_notes: notes || undefined }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="space-y-2 pt-1 border-t border-white/10">
      {showNotes && (
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Admin notes (optional)"
          rows={2}
          className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#9a442d] resize-none"
        />
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {currentStatus === 'pending' && (
          <>
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
          </>
        )}

        {currentStatus === 'resolved' && (
          <button
            onClick={() => update('pending')}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
          >
            Reopen
          </button>
        )}

        {currentStatus === 'dismissed' && (
          <button
            onClick={() => update('pending')}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
          >
            Reopen
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowNotes(v => !v)}
          className="text-xs px-3 py-1.5 bg-white/5 text-white/55 rounded-lg hover:bg-white/10 hover:text-white/60 transition-colors ml-auto"
        >
          {showNotes ? 'Hide notes' : (notes ? 'Edit notes' : '+ Note')}
        </button>
      </div>
    </div>
  )
}
