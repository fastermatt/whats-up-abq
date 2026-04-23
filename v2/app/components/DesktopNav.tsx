'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Calendar, MapPin, User, Trophy, PlusCircle, Moon, CalendarDays, Sparkles } from 'lucide-react'

// Primary nav items — always visible on md+
// Secondary items hide on md and only show on lg+, so medium desktop widths
// don't wrap.
const NAV_ITEMS = [
  { href: '/',              label: 'Discover',  Icon: Compass,      primary: true  },
  { href: '/events',        label: 'Events',    Icon: Calendar,     primary: true  },
  { href: '/for-you',       label: 'For You',   Icon: Sparkles,     primary: true  },
  { href: '/tonight',       label: 'Tonight',   Icon: Moon,         primary: false },
  { href: '/weekend',       label: 'Weekend',   Icon: CalendarDays, primary: false },
  { href: '/things-to-do',  label: 'Places',    Icon: MapPin,       primary: true  },
  { href: '/leaderboard',   label: 'Leaders',   Icon: Trophy,       primary: false },
  { href: '/submit',        label: 'Submit',    Icon: PlusCircle,   primary: false },
  { href: '/profile',       label: 'Profile',   Icon: User,         primary: true  },
] as const

export default function DesktopNav() {
  const pathname = usePathname()

  // Don't show on admin pages
  if (pathname.startsWith('/admin')) return null

  return (
    <header className="hidden md:flex sticky top-0 z-40 items-center justify-between gap-4 px-6 h-14 bg-[#fbf7f1]/95 backdrop-blur-md border-b border-[#f0e4cc]">
      {/* Logo */}
      <Link href="/" className="flex items-center hover:opacity-85 transition-opacity flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-black.svg" alt="ABQ Unplugged" className="h-8 w-auto" />
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-0.5">
        {NAV_ITEMS.map(({ href, label, Icon, primary }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                !primary ? 'hidden lg:inline-flex' : ''
              } ${
                isActive
                  ? 'bg-[#9a442d] text-white'
                  : 'text-[#4a3f3a] hover:bg-[#f0e4cc] hover:text-[#1a1614]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
