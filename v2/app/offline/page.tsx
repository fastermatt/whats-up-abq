'use client'

/**
 * Offline page served by the service worker (public/sw.js) when the network
 * is unreachable AND the request is a top-level navigation. Static, no data
 * fetches — must render purely from precached HTML.
 *
 * Client component so the "Try again" button can call `location.reload()`
 * without a navigation round-trip.
 */
export default function OfflinePage() {
  return (
    <main id="main" className="min-h-dvh bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-terra font-semibold">
          Offline
        </p>
        <h1
          className="text-3xl font-black text-ink"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          You&apos;re not connected
        </h1>
        <p className="text-ink-light leading-relaxed">
          ABQ Unplugged needs the network to pull live event data. Reconnect and try again — the pages you&apos;ve already visited may still load from cache.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="block w-full bg-terra text-white rounded-2xl px-6 py-3 font-semibold hover:bg-terra-hover transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Try again
          </button>

          <a
            href="/"
            className="block w-full bg-sand-border text-ink rounded-2xl px-6 py-3 font-semibold hover:bg-sand-mid transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Back to home
          </a>
        </div>

        <p className="text-[10px] text-ink-light pt-4">
          You see this page when ABQ Unplugged is installed and the network drops out.
        </p>
      </div>
    </main>
  )
}
