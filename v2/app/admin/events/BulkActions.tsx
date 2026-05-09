'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  eventIds: string[]
}

export function BulkActions({ eventIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Wire up checkboxes rendered server-side in the parent
  useEffect(() => {
    const boxes = document.querySelectorAll<HTMLInputElement>('.event-bulk-check')

    const handlers = new Map<HTMLInputElement, () => void>()

    boxes.forEach(box => {
      const id = box.dataset.eventId
      if (!id) return
      const handler = () => {
        setSelected(prev => {
          const next = new Set(prev)
          if (box.checked) next.add(id)
          else next.delete(id)
          return next
        })
      }
      handlers.set(box, handler)
      box.addEventListener('change', handler)
    })

    return () => {
      handlers.forEach((handler, box) => box.removeEventListener('change', handler))
    }
  }, [eventIds])

  // Keep checkboxes in sync when selected changes (e.g., after select all / deselect all)
  useEffect(() => {
    const boxes = document.querySelectorAll<HTMLInputElement>('.event-bulk-check')
    boxes.forEach(box => {
      const id = box.dataset.eventId
      if (id) box.checked = selected.has(id)
    })
  }, [selected])

  async function bulkUpdate(patch: Record<string, unknown>) {
    if (selected.size === 0) return
    setLoading(true)
    await Promise.all(
      Array.from(selected).map(id =>
        fetch('/api/admin/events', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...patch }),
        })
      )
    )
    setSelected(new Set())
    router.refresh()
    setLoading(false)
  }

  const count = selected.size

  return (
    <div className={`flex items-center gap-3 flex-wrap transition-all ${count > 0 ? 'opacity-100' : 'opacity-40'}`}>
      <button
        type="button"
        onClick={() => setSelected(count === eventIds.length ? new Set() : new Set(eventIds))}
        className="text-xs px-3 py-1.5 bg-white/10 rounded-lg hover:bg-white/15 transition-colors"
      >
        {count === eventIds.length ? 'Deselect all' : 'Select all'}
      </button>

      {count > 0 && (
        <>
          <span className="text-xs text-white/40">{count} selected</span>

          <button
            type="button"
            disabled={loading}
            onClick={() => bulkUpdate({ hidden: true })}
            className="text-xs px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors disabled:opacity-50"
          >
            Hide {count}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => bulkUpdate({ hidden: false })}
            className="text-xs px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors disabled:opacity-50"
          >
            Unhide {count}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => bulkUpdate({ featured: true })}
            className="text-xs px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
          >
            ★ Feature {count}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => bulkUpdate({ featured: false })}
            className="text-xs px-3 py-1.5 bg-white/10 text-white/50 rounded-lg hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            Unfeature {count}
          </button>

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-white/55 hover:text-white/60 transition-colors ml-1"
          >
            Clear
          </button>
        </>
      )}
    </div>
  )
}
