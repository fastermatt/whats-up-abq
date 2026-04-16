import type { Metadata } from 'next'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Saved Events | ABQ Unplugged',
}

export const revalidate = false

export default function SavedPage() {
  return (
    <main className="min-h-dvh bg-[#fbf7f1] text-[#1a1614] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* Bookmark icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-[#f5f0e8]">
            <Bookmark className="w-8 h-8 text-[#9a442d]" />
          </div>
        </div>

        {/* H1 */}
        <h1
          className="text-3xl md:text-4xl font-black leading-tight mb-4 text-[#1a1614]"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Saved Events
        </h1>

        {/* Message */}
        <p className="text-base text-[#8a7a74] mb-8 leading-relaxed">
          Save your favorite events and find them here. This feature is coming soon!
        </p>

        {/* CTA button */}
        <Link
          href="/events"
          className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all duration-300 hover:shadow-lg hover:shadow-[#9a442d]/20"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Browse Events
        </Link>
      </div>
    </main>
  )
}
