'use client'

/**
 * AICaptionGenerator — generates 3 on-brand IG caption variants via DeepSeek.
 *
 * Lazy: does nothing until the button is clicked. Results are cached in state
 * so they persist while the event block stays in view. "Regenerate" fetches fresh.
 */

import { useState } from 'react'
import { Sparkles, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react'

interface EventData {
  id: string
  title: string
  category: string | null
  dateLabel: string | null
  time: string | null
  venue: string | null
  price: string | null
  description: string | null
  emoji: string
}

interface CaptionVariants {
  hook: string
  local: string
  informational: string
}

const VARIANTS: { key: keyof CaptionVariants; label: string; sub: string }[] = [
  {
    key:   'hook',
    label: 'Hook',
    sub:   'Opens with a specific attention-grabber',
  },
  {
    key:   'local',
    label: 'Local',
    sub:   'Burque-native perspective on the event',
  },
  {
    key:   'informational',
    label: 'Informational',
    sub:   'Clean facts — what, where, when, how much',
  },
]

function AICaptionCard({ label, sub, caption }: { label: string; sub: string; caption: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(caption)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = caption
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="bg-[#1a1620] border border-[#6c42c0]/25 rounded-xl p-4 space-y-3
      hover:border-[#6c42c0]/50 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#a07ae0] font-bold">{label}</p>
          <p className="text-xs text-white/40 mt-0.5 truncate">{sub}</p>
        </div>
        <button
          onClick={handleCopy}
          className={`
            shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            transition-all active:scale-95
            ${copied
              ? 'bg-green-900/40 text-green-400 border border-green-800/60'
              : 'bg-[#6c42c0]/15 text-[#a07ae0] hover:bg-[#6c42c0] hover:text-white border border-[#6c42c0]/30'
            }
          `}
        >
          {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <pre className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed font-sans
        border-t border-[#6c42c0]/15 pt-3 group-hover:text-white/80 transition-colors">
        {caption}
      </pre>

      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Caption copied to clipboard' : ''}
      </span>
    </div>
  )
}

export function AICaptionGenerator({ event }: { event: EventData }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [variants, setVariants] = useState<CaptionVariants | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setState('loading')
    setError(null)

    try {
      const res = await fetch('/api/admin/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       event.title,
          category:    event.category,
          dateLabel:   event.dateLabel,
          time:        event.time,
          venue:       event.venue,
          price:       event.price,
          description: event.description,
          emoji:       event.emoji,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      setVariants(data)
      setState('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setState('error')
    }
  }

  // ── Idle — just a button ────────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div className="pt-1">
        <button
          onClick={generate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
            bg-[#6c42c0]/12 text-[#a07ae0] border border-[#6c42c0]/25
            hover:bg-[#6c42c0]/22 hover:border-[#6c42c0]/50 hover:text-white
            transition-all active:scale-95"
        >
          <Sparkles size={14} />
          Generate with AI
        </button>
      </div>
    )
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="rounded-2xl border border-[#6c42c0]/20 bg-[#1a1620]/60 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 rounded-full border-2 border-[#a07ae0] border-t-transparent animate-spin" />
          <span className="text-sm text-[#a07ae0] font-medium">Writing captions…</span>
        </div>
        <div className="space-y-2">
          {[80, 60, 90].map((w, i) => (
            <div key={i} className={`h-3 bg-[#6c42c0]/15 rounded-full animate-pulse`}
              style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-5">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-300">Caption generation failed</p>
            {error && <p className="text-xs text-red-400/70 mt-1 break-words">{error}</p>}
          </div>
        </div>
        <button
          onClick={generate}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
            bg-red-900/30 text-red-300 border border-red-800/40
            hover:bg-red-900/50 transition-all active:scale-95"
        >
          <RefreshCw size={12} />
          Try again
        </button>
      </div>
    )
  }

  // ── Done — show all 3 variants ──────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#a07ae0]" />
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#a07ae0] font-bold">
            AI Captions
          </p>
        </div>
        <button
          onClick={generate}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
            text-white/55 hover:text-[#a07ae0] hover:bg-[#6c42c0]/10 transition-all"
        >
          <RefreshCw size={11} />
          Regenerate
        </button>
      </div>

      {/* Caption cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {VARIANTS.map(({ key, label, sub }) => (
          <AICaptionCard
            key={key}
            label={label}
            sub={sub}
            caption={variants![key]}
          />
        ))}
      </div>
    </div>
  )
}
