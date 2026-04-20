'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Calendar, MapPin, User, Trophy, PlusCircle, Moon, CalendarDays } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',              label: 'Discover',      Icon: Compass },
  { href: '/events',        label: 'Events',        Icon: Calendar },
  { href: '/tonight',       label: 'Tonight',       Icon: Moon },
  { href: '/weekend',       label: 'Weekend',       Icon: CalendarDays },
  { href: '/things-to-do', label: 'Things To Do',  Icon: MapPin },
  { href: '/leaderboard',   label: 'Leaderboard',   Icon: Trophy },
  { href: '/submit',        label: 'Submit Event',  Icon: PlusCircle },
  { href: '/profile',       label: 'Profile',       Icon: User },
] as const

export default function DesktopNav() {
  const pathname = usePathname()

  // Don't show on admin pages
  if (pathname.startsWith('/admin')) return null

  return (
    <header className="hidden md:flex sticky top-0 z-40 items-center justify-between px-6 h-14 bg-[#fbf7f1]/95 backdrop-blur-md border-b border-[#f0e4cc]">
      {/* Logo */}
      <Link href="/" className="flex items-center hover:opacity-85 transition-opacity">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-black.svg" alt="ABQ Unplugged" className="h-8 w-auto" />
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#9a442d] text-white'
                  : 'text-[#4a3f3a] hover:bg-[#f0e4cc] hover:text-[#1a1614]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
