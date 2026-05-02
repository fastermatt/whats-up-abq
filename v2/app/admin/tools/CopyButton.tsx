'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title={`Copy: ${text}`}
      className={`
        shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold
        transition-all active:scale-95 select-none
        ${copied
          ? 'bg-green-900/40 text-green-400 border border-green-800/60'
          : 'bg-white/[0.07] text-white/40 hover:bg-white/[0.12] hover:text-white border border-transparent'
        }
      `}
    >
      {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}
