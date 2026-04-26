'use client'

import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error.message)
  }, [error])

  return (
    <main className="min-h-dvh bg-[#fbf7f1] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Heading */}
        <h1
          className="text-3xl font-black text-[#1a1614]"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Something went wrong
        </h1>

        {/* Subtitle */}
        <p className="text-[#6b5d57]">
          We couldn&apos;t load the page. This is usually temporary.
        </p>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={() => reset()}
            className="w-full bg-[#9a442d] text-white rounded-2xl px-6 py-3 font-semibold hover:bg-[#7d3725] transition-colors duration-300"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Try Again
          </button>

          <a
            href="/"
            className="block w-full bg-[#e8ddd0] text-[#1a1614] rounded-2xl px-6 py-3 font-semibold hover:bg-[#ddc9a3] transition-colors duration-300"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Go Home
          </a>
        </div>
      </div>
    </main>
  )
}
