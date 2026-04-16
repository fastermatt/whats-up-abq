import Link from 'next/link'

export default function EventNotFound() {
  return (
    <main className="min-h-dvh bg-[--bg] flex items-center justify-center">
      <div className="text-center animate-fade-up">
        <div className="text-5xl mb-4">🌵</div>
        <h1
          className="text-2xl font-black text-[#1a1614] mb-2"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Event not found
        </h1>
        <p className="text-sm text-[#8a7a74] mb-6">
          This event may have been removed or the link is incorrect.
        </p>
        <Link
          href="/events"
          className="px-5 py-2 rounded-full bg-[#9a442d] text-white text-sm font-medium hover:bg-[#7d3725] transition-colors"
        >
          Browse Events
        </Link>
      </div>
    </main>
  )
}
