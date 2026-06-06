'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, MessageCircle, Loader2 } from 'lucide-react'

export function SubmissionActions({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const [notes, setNotes]     = useState('')
  const [action, setAction]   = useState<null | 'approve' | 'reject' | 'needs_info'>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function submit(status: 'approve' | 'reject' | 'needs_info') {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: submissionId, action: status, notes }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
      setLoading(false)
    }
  }

  if (action === null) {
    return (
      <div className="flex gap-2 flex-wrap pt-2">
        <button
          onClick={() => setAction('approve')}
          className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Approve &amp; publish
        </button>
        <button
          onClick={() => setAction('needs_info')}
          className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Needs info
        </button>
        <button
          onClick={() => setAction('reject')}
          className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Reject
        </button>
      </div>
    )
  }

  const verb = action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Request info'
  const color = action === 'approve' ? 'green' : action === 'reject' ? 'red' : 'blue'

  return (
    <div className="bg-white/5 rounded-lg p-3 space-y-2 mt-2">
      <textarea
        placeholder={action === 'approve' ? 'Optional note for the submitter…' : action === 'needs_info' ? 'What info is missing?' : 'Why rejected? (optional)'}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white/90 placeholder:text-white/55 resize-none focus-visible:outline-none focus:border-white/30"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => submit(action)}
          disabled={loading}
          className={`px-3 py-1.5 rounded-lg bg-${color}-500/20 text-${color}-400 hover:bg-${color}-500/30 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors`}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Confirm {verb}
        </button>
        <button
          onClick={() => { setAction(null); setNotes(''); setError('') }}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 text-xs font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
