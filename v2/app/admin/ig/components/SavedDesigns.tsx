'use client'

import { useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { listSaved, deleteSaved, duplicateSaved } from '../lib/storage'
import { useEditor } from '../store'
import type { Design } from '../types'

export function SavedDesigns() {
  const { loadDesign } = useEditor()
  // Loaded once on mount — refreshed only on explicit save via the refresh() prop pattern.
  // We do NOT watch design.updatedAt because updateLayer fires on every keystroke,
  // which would call listSaved() 30-60×/second during text editing.
  const [items, setItems] = useState<Design[]>(() => listSaved())
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const refresh = () => setItems(listSaved())

  const handleDelete = (id: string) => {
    if (pendingDelete === id) {
      deleteSaved(id)
      setPendingDelete(null)
      refresh()
    } else {
      setPendingDelete(id)
      // Auto-cancel after 3 seconds if no second click
      setTimeout(() => setPendingDelete(p => p === id ? null : p), 3000)
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-[#0d0d0d] border border-white/[0.07] rounded-xl p-5 text-center">
        <p className="text-white/40 text-sm">
          No saved designs yet. Use{' '}
          <span className="text-white/70 font-semibold">Save</span>
          {' '}above to store the current design and reuse it later.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.07] rounded-xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/60 mb-3">
        Saved designs ({items.length})
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {items.map(d => (
          <div
            key={d.id}
            className="group relative bg-black/40 rounded-lg overflow-hidden border border-white/[0.06] hover:border-terra/60 transition-colors"
          >
            <button onClick={() => loadDesign(d)} className="block w-full">
              <div className="aspect-[4/5] bg-black">
                {d.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumbnail} alt={d.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/55 text-xs">No preview</div>
                )}
              </div>
              <div className="p-2 text-left">
                <p className="text-xs font-semibold text-white truncate">{d.name || 'Untitled'}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{d.slides.length} slide{d.slides.length > 1 ? 's' : ''} · {d.format}</p>
              </div>
            </button>

            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { duplicateSaved(d.id); refresh() }}
                title="Duplicate"
                className="w-7 h-7 flex items-center justify-center rounded bg-black/70 text-white/80 hover:text-white"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={() => handleDelete(d.id)}
                title={pendingDelete === d.id ? 'Click again to confirm' : 'Delete'}
                className={`w-7 h-7 flex items-center justify-center rounded bg-black/70 transition-colors ${
                  pendingDelete === d.id
                    ? 'bg-red-500/80 text-white'
                    : 'text-red-400/90 hover:text-red-300'
                }`}
              >
                {pendingDelete === d.id ? (
                  <span className="text-[9px] font-bold">Sure?</span>
                ) : (
                  <Trash2 size={12} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
