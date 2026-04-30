'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  caption: string
  label: string
  sublabel?: string
}

export function CaptionCard({ caption, label, sublabel }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(caption)
    } catch {
      // Fallback for browsers without clipboard API
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
    <div className="bg-[#201c1a] border border-white/[0.07] rounded-xl p-4 space-y-3 hover:border-white/[0.14] transition-colors group">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#9a442d] font-bold">{label}</p>
          {sublabel && (
            <p className="text-xs text-white/40 mt-0.5 truncate">{sublabel}</p>
          )}
        </div>
        <button
          onClick={handleCopy}
          className={`
            shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            transition-all active:scale-95
            ${copied
              ? 'bg-green-900/40 text-green-400 border border-green-800/60'
              : 'bg-white/[0.06] text-white/50 hover:bg-[#9a442d] hover:text-white border border-transparent'
            }
          `}
        >
          {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Caption text */}
      <pre className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed font-sans border-t border-white/[0.06] pt-3 group-hover:text-white/80 transition-colors">
        {caption}
      </pre>

      {/* Screen-reader announcement for copy state */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Caption copied to clipboard' : ''}
      </span>
    </div>
  )
}
