'use client'

/**
 * HomepageStickyHook — inline stickiness capture, shown once per device.
 *
 * Renders directly in the page flow (between featured events and category
 * chips) so it appears at the moment of highest engagement, without competing
 * with toast overlays or bottom-sheet prompts.
 *
 * Storage key: `abqu-hook-v1`. Set on email submit, install click, or dismiss.
 * Does NOT share state with FirstVisitBanner or InstallPrompt — this is the
 * inline version, those are the overlay versions.
 *
 * Two actions offered:
 *   1. Email subscribe → /api/newsletter POST (same as NewsletterBar)
 *   2. "Save to Home Screen" → triggers the install prompt event if available,
 *      otherwise opens a lightweight inline tutorial for iOS
 */

import { useEffect, useRef, useState } from 'react'
import { X, Download, Share } from 'lucide-react'

const STORAGE_KEY = 'abqu-hook-v1'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallState = 'android-ready' | 'ios-instructions' | 'unavailable'

export function HomepageStickyHook() {
  const [show, setShow]           = useState(false)
  const [tab, setTab]             = useState<'email' | 'save'>('email')
  const [email, setEmail]         = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [installState, setInstallState] = useState<InstallState>('unavailable')
  const [showIOSSteps, setShowIOSSteps] = useState(false)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Don't show if already dismissed / completed
    try { if (localStorage.getItem(STORAGE_KEY)) return } catch { return }

    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    const nav = window.navigator as { standalone?: boolean }
    if (nav.standalone === true) return

    // Detect iOS Safari
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    if (isIOS) setInstallState('ios-instructions')

    // Listen for Android/Chrome install prompt
    const onPrompt = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      setInstallState('android-ready')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // Small delay so it doesn't flash before the page settles
    const t = setTimeout(() => setShow(true), 1200)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      clearTimeout(t)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setShow(false)
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || emailStatus !== 'idle') return
    setEmailStatus('loading')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setEmailStatus('success')
        // Auto-dismiss after success moment
        setTimeout(dismiss, 4000)
      } else {
        setEmailStatus('idle')
      }
    } catch {
      setEmailStatus('idle')
    }
  }

  async function handleInstall() {
    if (installState === 'android-ready' && promptRef.current) {
      await promptRef.current.prompt()
      await promptRef.current.userChoice
      dismiss()
    } else if (installState === 'ios-instructions') {
      setShowIOSSteps(true)
    }
  }

  if (!show) return null

  // ── Success state ──────────────────────────────────────────────────────────
  if (emailStatus === 'success') {
    return (
      <div className="mx-4 mb-2 rounded-2xl bg-[#9a442d] text-white px-4 py-3.5 flex items-center gap-3">
        <span className="text-lg" aria-hidden="true">✦</span>
        <div className="flex-1">
          <p className="text-sm font-black leading-tight" style={{ fontFamily: 'var(--font-epilogue)' }}>
            You&apos;re on the list.
          </p>
          <p className="text-xs text-white/75 mt-0.5">Weekend picks land Friday. Check your inbox.</p>
        </div>
      </div>
    )
  }

  // ── iOS instructions ───────────────────────────────────────────────────────
  if (showIOSSteps) {
    return (
      <div className="mx-4 mb-2 rounded-2xl border border-[#ddc9a3] bg-[#fbf7f1] overflow-hidden">
        <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
          <p className="text-sm font-black text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Add to Home Screen
          </p>
          <button onClick={dismiss} aria-label="Dismiss" className="p-1 -mr-1 text-[#6b5d57] hover:text-[#4a3f3a] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 pb-4 space-y-2.5">
          {([
            {
              n: 1,
              label: (
                <>Tap <Share className="w-3.5 h-3.5 inline mb-0.5 text-[#007AFF]" aria-label="Share" /> in Safari&apos;s toolbar</>
              ),
            },
            { n: 2, label: 'Scroll down — tap "Add to Home Screen"' },
            { n: 3, label: 'Tap Add. Done.' },
          ] as const).map(({ n, label }) => (
            <div key={n} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#9a442d] text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                {n}
              </div>
              <p className="text-xs text-[#4a3f3a] leading-relaxed">{label}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-[#f0e4cc] px-4 py-2 flex items-center justify-between">
          <p className="text-[10px] text-[#6b5d57]">↓ Look for Share in the Safari toolbar</p>
          <button onClick={dismiss} className="text-[10px] text-[#9a442d] font-semibold">Done</button>
        </div>
      </div>
    )
  }

  // ── Main state: two-tab layout ─────────────────────────────────────────────
  return (
    <div className="mx-4 mb-2 rounded-2xl border border-[#e8d5c0] bg-gradient-to-br from-[#f8f1ea] to-[#fbf7f1] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-0 flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#9a442d] font-semibold mb-0.5">
            Updated daily
          </p>
          <p
            className="text-base font-black text-[#1a1614] leading-tight"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Make it your go-to.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 -mr-1 -mt-0.5 text-[#6b5d57] hover:text-[#4a3f3a] transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="px-4 pt-3 pb-0 flex gap-2">
        <button
          onClick={() => setTab('email')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            tab === 'email'
              ? 'bg-[#9a442d] text-white'
              : 'bg-[#f0e4cc]/70 text-[#4a3f3a] hover:bg-[#f0e4cc]'
          }`}
        >
          Weekly picks
        </button>
        {installState !== 'unavailable' && (
          <button
            onClick={() => setTab('save')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'save'
                ? 'bg-[#9a442d] text-white'
                : 'bg-[#f0e4cc]/70 text-[#4a3f3a] hover:bg-[#f0e4cc]'
            }`}
          >
            Save to phone
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="px-4 pb-4 pt-3">
        {tab === 'email' ? (
          <>
            <p className="text-xs text-[#4a3f3a] mb-2.5 leading-snug">
              ABQ&apos;s best weekend picks, every Friday. No noise.
            </p>
            <form onSubmit={handleEmailSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-[#ddc9a3] rounded-lg text-[#1a1614] placeholder:text-[#b0a69e] focus:outline-none focus:border-[#9a442d] focus:ring-1 focus:ring-[#9a442d]/30 transition-all"
              />
              <button
                type="submit"
                disabled={emailStatus === 'loading'}
                className="px-4 py-2 bg-[#9a442d] text-white text-sm font-bold rounded-lg hover:bg-[#7d3725] transition-colors disabled:opacity-60 flex-shrink-0"
              >
                {emailStatus === 'loading' ? '…' : 'Subscribe'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-xs text-[#4a3f3a] mb-3 leading-snug">
              {installState === 'ios-instructions'
                ? 'One tap from your home screen to tonight\'s picks.'
                : 'Install for one-tap access to tonight\'s events.'}
            </p>
            <button
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#9a442d] text-white text-sm font-bold rounded-lg hover:bg-[#7d3725] transition-colors"
            >
              {installState === 'ios-instructions' ? (
                <><Share className="w-4 h-4" /> Add to Home Screen</>
              ) : (
                <><Download className="w-4 h-4" /> Install App</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
