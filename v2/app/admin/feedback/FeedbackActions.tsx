'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const STATUSES = [
  { value: 'new',         label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'wontfix',     label: 'Won\'t fix' },
  { value: 'spam',        label: 'Spam' },
] as const

export function FeedbackActions({
  feedbackId,
  currentStatus,
  initialNotes,
}: {
  feedbackId: string
  currentStatus: string
  initialNotes: string
}) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function update(newStatus: string) {
    setLoading(newStatus); setError('')
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: feedbackId, status: newStatus, notes }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed')
        setLoading(null)
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
      setLoading(null)
    }
  }

  return (
    <div className="space-y-2 border-t border-white/5 pt-3">
      <textarea
        placeholder="Admin notes (saved with any status change)…"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-white/30"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-1.5 flex-wrap">
        {STATUSES.filter(s => s.value !== currentStatus).map(s => (
          <button
            key={s.value}
            onClick={() => update(s.value)}
            disabled={loading !== null}
            className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-xs font-medium text-white/70 inline-flex items-center gap-1 disabled:opacity-50 transition-colors"
          >
            {loading === s.value && <Loader2 className="w-3 h-3 animate-spin" />}
            → {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
