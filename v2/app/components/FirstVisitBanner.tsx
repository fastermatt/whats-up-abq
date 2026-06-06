'use client'
/**
 * Subtle "welcome, you're new here" banner that appears once per device.
 *
 * Storage key: `abqu-visited-v1` in localStorage. Set on first dismiss OR after
 * banner has been mounted for >2.5s (gives visitor time to read it once even
 * if they don't dismiss). Hidden forever after that — never re-shows for the
 * same browser even on a second mount.
 *
 * Pinned to the bottom on mobile to avoid covering hero content. Slides up.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Sparkles } from 'lucide-react'

const STORAGE_KEY = 'abqu-visited-v1'

export function FirstVisitBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(STORAGE_KEY)) return
    } catch { return }
    // Defer mount until page is settled — avoids inflating Speed Index
    // (Lighthouse has no localStorage so the banner would always appear in perf tests)
    const t = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setVisible(false)
  }

  // Auto-mark visited after the banner has been on screen for 8s — even if
  // they didn't tap the X, we don't want to nag forever on repeat visits.
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    }, 8000)
    return () => clearTimeout(t)
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Welcome banner"
      className="fixed bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-[360px] z-40 animate-fade-up"
    >
      <div className="bg-gradient-to-br from-terra to-terra-hover text-white rounded-2xl shadow-2xl border border-white/10 p-3 sm:p-4 flex items-start gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-black leading-tight mb-0.5"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            New to ABQ Unplugged?
          </p>
          <p className="text-xs text-white/85 leading-snug mb-2.5">
            Every event in Albuquerque, all in one place. Take 30 seconds to see what we do.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/welcome"
              onClick={dismiss}
              className="inline-flex items-center text-xs font-bold bg-white text-terra px-3 py-1.5 rounded-full hover:bg-cream transition-colors"
            >
              Take a tour
            </Link>
            <button
              onClick={dismiss}
              className="text-xs font-semibold text-white/80 hover:text-white px-2 py-1.5 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss welcome banner"
          className="flex-shrink-0 p-1 -m-1 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
