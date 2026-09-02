'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Offline page served by the service worker (public/sw.js) when the network
 * is unreachable AND the request is a top-level navigation. Static, no data
 * fetches — must render purely from precached HTML.
 *
 * Client component so the "Try again" button can call `location.reload()`
 * without a navigation round-trip.
 */
export default function OfflinePage() {
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let active = true

    const retry = async () => {
      if (!active) return
      setChecking(true)
      try {
        // A normal fetch is not a navigation, so sw.js cannot answer this with
        // the cached offline shell. A 2xx/3xx response proves the origin is back.
        const response = await fetch(`/?offline-probe=${Date.now()}`, {
          method: 'HEAD',
          cache: 'no-store',
        })
        if (response.ok || response.redirected) {
          window.location.replace('/')
          return
        }
      } catch {
        // Still offline; the interval below will try again without user action.
      }
      if (active) setChecking(false)
    }

    const interval = window.setInterval(retry, 15_000)
    window.addEventListener('online', retry)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('online', retry)
    }
  }, [])

  const retryNow = () => {
    setChecking(true)
    window.location.reload()
  }

  return (
    <main id="main" className="min-h-dvh bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-terra font-semibold">
          Offline
        </p>
        <h1
          className="text-3xl font-black text-ink"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          You&apos;re not connected
        </h1>
        <p className="text-ink-light leading-relaxed">
          ABQ Unplugged needs the network to pull live event data. We&apos;ll reconnect automatically when the site is reachable again.
        </p>

        <div className="space-y-3">
          <button
            onClick={retryNow}
            disabled={checking}
            className="block w-full bg-terra text-white rounded-2xl px-6 py-3 font-semibold hover:bg-terra-hover transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {checking ? 'Checking…' : 'Try again'}
          </button>

          <Link
            href="/"
            className="block w-full bg-sand-border text-ink rounded-2xl px-6 py-3 font-semibold hover:bg-sand-mid transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Back to home
          </Link>
        </div>

        <p className="text-[11px] text-ink-light pt-4">
          You see this page when ABQ Unplugged is installed and the network drops out.
        </p>
      </div>
    </main>
  )
}
