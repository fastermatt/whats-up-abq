'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if user dismissed the prompt within the last 30 days. Stored
    // as a timestamp in localStorage so the suppression survives across
    // tabs and reloads (sessionStorage re-prompted on every new tab,
    // which got annoying fast).
    const RE_PROMPT_AFTER_MS = 30 * 24 * 60 * 60 * 1000  // 30 days
    const dismissedAt = parseInt(localStorage.getItem('pwa-dismissed-at') ?? '0', 10)
    if (dismissedAt && Date.now() - dismissedAt < RE_PROMPT_AFTER_MS) {
      setDismissed(true)
      return
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  async function handleInstall() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDismissed(true)
    }
    setPrompt(null)
  }

  function handleDismiss() {
    // Re-prompt eligible after 30 days (see useEffect above).
    localStorage.setItem('pwa-dismissed-at', String(Date.now()))
    setDismissed(true)
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-fade-up">
      <div className="bg-[#1a1614] text-white rounded-2xl shadow-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#9a442d] flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Add to Home Screen</p>
          <p className="text-xs text-white/60">Get quick access to ABQ events</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 rounded-lg bg-[#9a442d] text-white text-xs font-semibold hover:bg-[#7d3725] transition-colors"
          >
            Add
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="p-1 text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
