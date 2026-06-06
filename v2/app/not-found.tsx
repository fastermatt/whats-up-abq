import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Not found · ABQ Unplugged',
  robots: { index: false, follow: true },
}

/**
 * Root 404 page — fires for any URL that doesn't match a route
 * (and isn't covered by a more specific not-found.tsx like
 * /events/[id]/not-found.tsx). Mirrors the voice + structure of
 * app/error.tsx so the two failure surfaces feel like the same site.
 */
export default function NotFound() {
  return (
    <main id="main" className="min-h-dvh bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-terra font-semibold">
          404
        </p>
        <h1
          className="text-3xl font-black text-ink"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          That page isn&apos;t here
        </h1>
        <p className="text-ink-light">
          The link might be old, the URL might be a typo, or the event may have come down. Either way, here&apos;s what to try.
        </p>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-terra text-white rounded-2xl px-6 py-3 font-semibold hover:bg-terra-hover transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Back to home
          </Link>

          <Link
            href="/events"
            className="block w-full bg-sand-border text-ink rounded-2xl px-6 py-3 font-semibold hover:bg-sand-mid transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Browse events
          </Link>

          <Link
            href="/tonight"
            className="inline-block text-xs text-ink-light hover:text-terra underline underline-offset-2 transition-colors"
          >
            Or see what&apos;s on tonight
          </Link>
        </div>
      </div>
    </main>
  )
}
