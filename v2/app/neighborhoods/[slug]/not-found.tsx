import Link from 'next/link'
import { Map } from 'lucide-react'

export default function NeighborhoodNotFound() {
  return (
    <main id="main" className="min-h-dvh bg-[--bg] flex flex-col items-center justify-center px-4 py-16 text-center">
      <Map className="w-12 h-12 text-sand-mid mx-auto mb-4" />
      <h1 className="text-2xl font-black text-ink mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
        Neighborhood Not Found
      </h1>
      <p className="text-sm text-ink-light mb-6">No upcoming events found in this neighborhood.</p>
      <Link
        href="/events"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-terra text-white font-semibold text-sm hover:bg-terra-hover transition-all"
      >
        Browse All Events
      </Link>
    </main>
  )
}
