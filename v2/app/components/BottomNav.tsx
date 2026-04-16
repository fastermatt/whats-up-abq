'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',        label: 'Discover', icon: 'explore' },
  { href: '/events',  label: 'Events',   icon: 'calendar_today' },
  { href: '/saved',   label: 'Saved',    icon: 'bookmark' },
  { href: '/profile', label: 'Profile',  icon: 'person' },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white/92 backdrop-blur-xl border-t border-[#f0e4cc] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive =
            href === '/'
              ? pathname === '/'
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={`
                flex flex-col items-center justify-center gap-0.5 relative
                transition-colors duration-150
                ${isActive ? 'text-[#9a442d]' : 'text-[#8a7a74]'}
              `}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-sm bg-[#9a442d]" />
              )}

              <span
                className="material-symbols-rounded text-2xl"
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24" }
                    : { fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
                }
              >
                {icon}
              </span>

              <span
                className="text-[10px] font-bold tracking-wider uppercase"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
