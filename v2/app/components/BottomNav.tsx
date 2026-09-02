'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, CalendarDays, MapPin, Bookmark, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',              label: 'Home',     Icon: Compass      },
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
      className="abq-bottom-nav fixed z-50 md:hidden"
    >
      <div className="grid grid-cols-5 h-full max-w-lg mx-auto">
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
                abq-bottom-nav-item flex flex-col items-center justify-center gap-1 relative
                transition-all duration-150
                ${isActive ? 'text-terra' : 'text-ink-light'}
              `}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.5 : 1.75}
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
