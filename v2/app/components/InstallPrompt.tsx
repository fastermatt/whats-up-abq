'use client'

/**
 * InstallPrompt — fixed-position PWA install nudge.
 *
 * Handles two platforms:
 *
 *   Android / Chrome:  waits for `beforeinstallprompt`, shows a dark toast
 *                      at the bottom of the screen. Fires the native prompt on tap.
 *
 *   iOS Safari:        `beforeinstallprompt` never fires. Instead, after the user
 *                      has scrolled 500px (genuine interest signal), a cream card
 *                      slides up with step-by-step "Share → Add to Home Screen"
 *                      instructions.
 *
 * Suppression: 30 days after any dismiss. Stored in localStorage so it
 * persists across tabs and reloads.
 */

import { useEffect, useRef, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const RE_PROMPT_AFTER_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function InstallPrompt() {
  const [androidPrompt, setAndroidPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOS, setShowIOS]             = useState(false)
  const [suppressed, setSuppressed]       = useState(true) // start suppressed, unlock after checks

  const iosTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iosShownRef = useRef(false)

  useEffect(() => {
    // Already dismissed recently
    const dismissedAt = parseInt(localStorage.getItem('pwa-dismissed-at') ?? '0', 10)
    if (dismissedAt && Date.now() - dismissedAt < RE_PROMPT_AFTER_MS) return

    // Already installed as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    const nav = window.navigator as { standalone?: boolean }
    if (nav.standalone === true) return

    setSuppressed(false)

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !('MSStream' in window)

    if (isIOS) {
      // Show after scrolling 500px (engagement signal) OR 20s fallback
      const showOnce = () => {
        if (iosShownRef.current) return
        iosShownRef.current = true
        if (iosTimerRef.current) clearTimeout(iosTimerRef.current)
        setShowIOS(true)
      }

      iosTimerRef.current = setTimeout(showOnce, 20_000)

      const onScroll = () => { if (window.scrollY >= 500) showOnce() }
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => {
        window.removeEventListener('scroll', onScroll)
        if (iosTimerRef.current) clearTimeout(iosTimerRef.current)
      }
    }

    // Android / Chrome: wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setAndroidPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa-dismissed-at', String(Date.now()))
    setSuppressed(true)
    setShowIOS(false)
    setAndroidPrompt(null)
  }

  async function handleAndroidInstall() {
    if (!androidPrompt) return
    await androidPrompt.prompt()
    await androidPrompt.userChoice
    dismiss()
  }

  if (suppressed) return null

  // ── iOS: step-by-step sheet ──────────────────────────────────────────────
  if (showIOS) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-[340px] z-50 animate-fade-up">
        <div className="bg-cream border border-sand-mid rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/apple-touch-icon.png"
              alt=""
              aria-hidden="true"
              className="w-9 h-9 rounded-[10px] shadow-sm flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-black text-ink leading-tight"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                Save ABQ Unplugged
              </p>
              <p className="text-[11px] text-ink-light">One tap to tonight&apos;s picks</p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="p-1.5 -mr-1 text-ink-light hover:text-ink-mid transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Steps */}
          <div className="border-t border-sand-light px-4 py-3 space-y-2.5">
            {[
              {
                n: '1',
                content: (
                  <>
                    Tap the{' '}
                    <Share className="w-3.5 h-3.5 inline mb-0.5 text-[#007AFF]" aria-label="Share" />{' '}
                    <strong>Share</strong> button in Safari
                  </>
                ),
              },
              {
                n: '2',
                content: <>Scroll down, tap <strong>&ldquo;Add to Home Screen&rdquo;</strong></>,
              },
              {
                n: '3',
                content: <>Tap <strong>Add</strong> — done.</>,
              },
            ].map(({ n, content }) => (
              <div key={n} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-terra text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  {n}
                </div>
                <p className="text-[12px] text-ink-mid leading-relaxed">{content}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-sand-light px-4 py-2 text-center">
            <p className="text-[10px] text-ink-light">
              ↓ Share is in Safari&apos;s bottom toolbar
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Android: native install toast ────────────────────────────────────────
  if (androidPrompt) {
    return (
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-fade-up">
        <div className="bg-ink text-white rounded-2xl shadow-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-terra flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-black leading-tight"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Save for tonight
            </p>
            <p className="text-xs text-white/60">New ABQ events, one tap away.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleAndroidInstall}
              className="px-3 py-1.5 rounded-lg bg-terra text-white text-xs font-bold hover:bg-terra-hover transition-colors"
            >
              Add
            </button>
            <button
              onClick={dismiss}
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

  return null
}
