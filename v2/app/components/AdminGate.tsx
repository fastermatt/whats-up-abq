'use client'

/**
 * AdminGate — hides its children on /admin/* routes.
 *
 * Uses usePathname() (client-side) instead of headers() (server-side) so that
 * the root layout stays a static Server Component and ISR can cache the homepage.
 * The brief SSR→hydration gap is invisible in practice — admin is a single user.
 */
import { usePathname } from 'next/navigation'

export function AdminGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null
  return <>{children}</>
}
