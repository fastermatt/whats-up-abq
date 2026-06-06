'use client'

import { useEffect, useState } from 'react'

/**
 * Detect Next.js chunk-load errors from after-deploy stale tabs.
 * When a tab has been open across a deploy, the build IDs in its bundle
 * no longer match what the server has, so any client-side navigation
 * fails with "Loading chunk N failed" or "Failed to fetch dynamically
 * imported module". Hard-reload picks up the new chunks.
 */
function isChunkLoadError(err: Error): boolean {
  const msg = (err.message || '').toLowerCase()
  const name = (err.name || '').toLowerCase()
  return (
    name.includes('chunkloaderror') ||
    msg.includes('loading chunk') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed')
  )
}

/** Clear all caches the SW or browser might be holding stale entries in. */
async function nukeCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch {
    // best-effort; reload anyway
  }
  // bypass-cache reload
  window.location.reload()
}

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [autoReloading, setAutoReloading] = useState(false)

  useEffect(() => {
    console.error('[RootError]', error.name, error.message, error.digest)

    // Report to the admin error log so we have a central record of every
    // boundary trip. Fire-and-forget; failure here must not affect the
    // recovery flow below. Chunk-load errors are still reported (helps us
    // see how often they actually trip).
    if (typeof window !== 'undefined') {
      try {
        fetch('/api/admin/error-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            source: 'client-boundary',
            severity: 'error',
            message: `${error.name}: ${error.message}`.slice(0, 2000),
            location: window.location.pathname,
            context: {
              url:       window.location.href,
              userAgent: navigator.userAgent,
              digest:    error.digest ?? null,
              isChunkLoadError: isChunkLoadError(error),
            },
          }),
        }).catch(() => {})
      } catch { /* never block the UI on logging */ }
    }

    // Auto-recover from chunk-load errors caused by stale tabs across a
    // deploy. Use sessionStorage as a circuit breaker so we don't infinite
    // loop if the reload itself triggers the same error.
    if (typeof window !== 'undefined' && isChunkLoadError(error)) {
      const guardKey = 'chunk-error-reload-attempted'
      if (!sessionStorage.getItem(guardKey)) {
        sessionStorage.setItem(guardKey, '1')
        setAutoReloading(true)
        // Tiny delay so the error UI flashes briefly, then reload
        setTimeout(() => window.location.reload(), 250)
      }
    }
  }, [error])

  if (autoReloading) {
    return (
      <main id="main" className="min-h-dvh bg-cream flex items-center justify-center px-4">
        <p className="text-sm text-ink-light">Reloading to pick up the latest version…</p>
      </main>
    )
  }

  return (
    <main id="main" className="min-h-dvh bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Heading */}
        <h1
          className="text-3xl font-black text-ink"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Something broke
        </h1>

        {/* Subtitle */}
        <p className="text-ink-light">
          The page didn&apos;t load. Usually a refresh fixes it.
        </p>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => reset()}
            className="w-full bg-terra text-white rounded-2xl px-6 py-3 font-semibold hover:bg-terra-hover transition-colors duration-300"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Try again
          </button>

          <button
            onClick={() => nukeCachesAndReload()}
            className="block w-full bg-sand-border text-ink rounded-2xl px-6 py-3 font-semibold hover:bg-sand-mid transition-colors duration-300"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Hard refresh
          </button>

          <a
            href="/"
            className="block w-full text-ink-light rounded-2xl px-6 py-2 text-sm hover:text-terra transition-colors duration-300"
          >
            Back to home
          </a>
        </div>

        {/* Debug detail — collapsed but inspectable. Always visible when a
            digest is present (production with a real server-side error). */}
        {error.digest || error.message ? (
          <details className="text-left text-xs text-[#9a8880]">
            <summary className="cursor-pointer text-center">Technical details</summary>
            <pre className="mt-2 p-3 bg-sand-light/40 rounded overflow-auto whitespace-pre-wrap break-all">
              {error.name}: {error.message}
              {error.digest ? `\n\ndigest: ${error.digest}` : ''}
            </pre>
          </details>
        ) : null}
      </div>
    </main>
  )
}
