'use client'

import { useState, useTransition } from 'react'
import { ThumbsDown, Undo2 } from 'lucide-react'

// Thumbs-down button on a For You card. Dismisses the match so the user
// doesn't see this specific event again and the matcher stops re-surfacing it.
// Auto-offers Undo for 10 seconds after click.
export function DismissButton({ eventId }: { eventId: string }) {
  const [state, setState] = useState<'idle' | 'dismissed' | 'undone'>('idle')
  const [pending, startTransition] = useTransition()
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  function dismiss() {
    if (pending) return
    setState('dismissed')
    startTransition(async () => {
      try {
        await fetch('/api/notifications/matches/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId }),
        })
      } catch {
        // Revert on error
        setState('idle')
      }
    })
    // Auto-clear after 10s
    if (undoTimer) clearTimeout(undoTimer)
    const t = setTimeout(() => setState(s => (s === 'dismissed' ? 'dismissed' : s)), 10000)
    setUndoTimer(t)
  }

  function undo() {
    if (pending) return
    setState('undone')
    startTransition(async () => {
      try {
        await fetch('/api/notifications/matches/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: eventId, undo: true }),
        })
      } catch {
        // leave as undone — matcher will resurface next run
      }
    })
    if (undoTimer) clearTimeout(undoTimer)
  }

  if (state === 'undone') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#4f6249] px-2 py-1">
        restored
      </span>
    )
  }

  if (state === 'dismissed') {
    return (
      <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center rounded-xl">
        <div className="text-center">
          <p className="text-white text-xs font-semibold mb-2">We won&apos;t show this again</p>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); undo() }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#1a1614] text-[11px] font-semibold hover:bg-[#f0e4cc] transition-colors"
          >
            <Undo2 className="w-3 h-3" /> Undo
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      aria-label="Not for me"
      title="Not for me"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss() }}
      className="absolute top-2 left-2 z-20 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
    >
      <ThumbsDown className="w-3.5 h-3.5" />
    </button>
  )
}
