'use client'

import { useEffect } from 'react'

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[EventsError]', error.name, error.message, error.digest)
    // Fire-and-forget audit log entry; never block the UI on logging.
    if (typeof window !== 'undefined') {
      try {
        fetch('/api/admin/error-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            source:   'client-boundary',
            severity: 'error',
            message:  `${error.name}: ${error.message}`.slice(0, 2000),
            location: window.location.pathname,
            context:  {
              url:       window.location.href,
              userAgent: navigator.userAgent,
              digest:    error.digest ?? null,
              boundary:  'events',
            },
          }),
        }).catch(() => {})
      } catch { /* never block the UI on logging */ }
    }
  }, [error])

  return (
    <main id="main" className="min-h-dvh bg-[#fbf7f1] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Heading */}
        <h1
          className="text-3xl font-black text-[#1a1614]"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Events couldn&apos;t load
        </h1>

        {/* Subtitle */}
        <p className="text-[#6b5d57]">
          The event data source is having a moment. Try again, or come back in a few.
        </p>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => reset()}
            className="w-full bg-[#9a442d] text-white rounded-2xl px-6 py-3 font-semibold hover:bg-[#7d3725] transition-colors duration-300"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Try again
          </button>

          <a
            href="/"
            className="block w-full bg-[#e8ddd0] text-[#1a1614] rounded-2xl px-6 py-3 font-semibold hover:bg-[#ddc9a3] transition-colors duration-300"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Back to home
          </a>
        </div>
      </div>
    </main>
  )
}
