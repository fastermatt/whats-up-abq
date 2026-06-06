import Link from 'next/link'

export default function EventNotFound() {
  return (
    <main id="main" className="min-h-dvh bg-[--bg] flex items-center justify-center">
      <div className="text-center animate-fade-up">
        <div className="text-5xl mb-4">🌵</div>
        <h1
          className="text-2xl font-black text-ink mb-2"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          Event not found
        </h1>
        <p className="text-sm text-ink-light mb-6">
          This event may have been removed or the link is incorrect.
        </p>
        <Link
          href="/events"
          className="px-5 py-2 rounded-full bg-terra text-white text-sm font-medium hover:bg-terra-hover transition-colors"
        >
          Browse Events
        </Link>
      </div>
    </main>
  )
}
