'use client'

/**
 * QuickPostInput — paste an event URL or ID, jump straight into the card designer.
 *
 * Accepts:
 *   • Full URL:  https://abqunplugged.com/events/ticketmaster_G5vzZ_eJiK65t
 *   • Bare ID:   ticketmaster_G5vzZ_eJiK65t
 *   • Partial:   /events/abqtodo-522369
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'

function extractEventId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Full URL or path: /events/{id}
  const m = trimmed.match(/\/events\/([^/?#\s]+)/)
  if (m) return m[1]

  // Bare ID — no slashes
  if (!trimmed.includes('/')) return trimmed

  return null
}

export function QuickPostInput() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const handleGo = () => {
    const id = extractEventId(value)
    if (!id) {
      setError('Paste an event URL or bare event ID (e.g. ticketmaster_G5vzZ_eJiK65t)')
      return
    }
    setError('')
    router.push(`/admin/ig?id=${id}`)
  }

  return (
    <div className="bg-[#201c1a] border border-[#9a442d]/40 rounded-2xl p-5 space-y-3">
      <div>
        <p className="text-xs font-bold text-[#e8a898] uppercase tracking-[0.14em] mb-1">
          ⚡ Quick Post
        </p>
        <p className="text-xs text-white/35">
          Paste an event URL or ID → opens the card designer instantly
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleGo()}
          placeholder="https://abqunplugged.com/events/... or bare event ID"
          className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-xl px-3 py-2.5
            text-white text-sm placeholder:text-white/45 focus:outline-none
            focus:border-[#9a442d]/60 focus:bg-white/[0.08] transition-all"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={handleGo}
          disabled={!value.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#9a442d] text-white
            text-sm font-semibold hover:bg-[#b5502f] active:scale-95 transition-all
            disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <ArrowRight size={15} />
          <span className="hidden sm:inline">Open</span>
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <p className="text-[10px] text-white/45">
        Opens the 4:5 portrait card designer · toggle to 9:16 story or 1:1 square in the tool
      </p>
    </div>
  )
}
