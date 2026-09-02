import Link from 'next/link'
import { Search } from 'lucide-react'

/** Shared mobile chrome for every public route. Kept intentionally small so the
 * page title—not the navigation—remains the first content landmark. */
export function MobileTopBar() {
  return (
    <header className="abq-mobile-header md:hidden" aria-label="ABQ Unplugged">
      <Link href="/" className="abq-mobile-logo" aria-label="ABQ Unplugged home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-terra.svg" alt="ABQ Unplugged" />
      </Link>
      <Link href="/events" className="abq-mobile-search" aria-label="Search Albuquerque events">
        <Search aria-hidden="true" />
      </Link>
    </header>
  )
}
