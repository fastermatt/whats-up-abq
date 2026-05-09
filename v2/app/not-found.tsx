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
    <main id="main" className="min-h-dvh bg-[#fbf7f1] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a442d] font-semibold">
          404
        </p>
        <h1
          className="text-3xl font-black text-[#1a1614]"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          That page isn&apos;t here
        </h1>
        <p className="text-[#6b5d57]">
          The link might be old, the URL might be a typo, or the event may have come down. Either way, here&apos;s what to try.
        </p>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full bg-[#9a442d] text-white rounded-2xl px-6 py-3 font-semibold hover:bg-[#7d3725] transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Back to home
          </Link>

          <Link
            href="/events"
            className="block w-full bg-[#e8ddd0] text-[#1a1614] rounded-2xl px-6 py-3 font-semibold hover:bg-[#ddc9a3] transition-colors"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Browse events
          </Link>

          <Link
            href="/tonight"
            className="inline-block text-xs text-[#6b5d57] hover:text-[#9a442d] underline underline-offset-2 transition-colors"
          >
            Or see what&apos;s on tonight
          </Link>
        </div>
      </div>
    </main>
  )
}
