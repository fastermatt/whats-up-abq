'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, CalendarDays, MapPin, Bookmark, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',              label: 'Discover', Icon: Compass      },
  { href: '/events',        label: 'Events',   Icon: CalendarDays },
  { href: '/things-to-do', label: 'Places',   Icon: MapPin       },
  { href: '/saved',         label: 'Saved',    Icon: Bookmark     },
  { href: '/profile',       label: 'Profile',  Icon: User         },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-50 bg-white/92 backdrop-blur-xl border-t border-[#f0e4cc] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            href === '/'
              ? pathname === '/'
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              data-umami-event="bottom-nav"
              data-umami-event-target={href}
              className={`
                flex flex-col items-center justify-center gap-1 relative
                transition-colors duration-150
                ${isActive ? 'text-[#9a442d]' : 'text-[#6b5d57]'}
              `}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-sm bg-[#9a442d]" />
              )}

              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.5 : 1.75}
                fill={isActive ? 'currentColor' : 'none'}
              />

              <span
                className="text-[10px] font-bold tracking-wider uppercase"
                style={{ fontFamily: 'var(--font-inter)' }}
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
