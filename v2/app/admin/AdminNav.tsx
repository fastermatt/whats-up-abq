'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from './LogoutButton'

interface NavItem {
  href: string
  label: string
  prefix: string
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin',             label: 'Dashboard',   prefix: '/admin', exact: true  },
  { href: '/admin/tools',       label: 'Tools',       prefix: '/admin/tools'  },
  { href: '/admin/ig',          label: 'Instagram',   prefix: '/admin/ig'     },
  { href: '/admin/events',      label: 'Events',      prefix: '/admin/events' },
  { href: '/admin/submissions', label: 'Submissions', prefix: '/admin/submissions' },
  { href: '/admin/feedback',    label: 'Feedback',    prefix: '/admin/feedback' },
  { href: '/admin/reports',     label: 'Reports',     prefix: '/admin/reports' },
  { href: '/admin/analytics',   label: 'Analytics',   prefix: '/admin/analytics' },
]

/**
 * Admin top nav with active-state indication.
 * Round-6 fix: prior version rendered every link in `text-white/60`
 * regardless of which page was active, so users had no orientation.
 */
export function AdminNav() {
  const pathname = usePathname() ?? ''

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.prefix)

  return (
    <nav className="border-b border-white/10 sticky top-0 bg-[#1a1614]/95 backdrop-blur z-10">
      <div className="flex items-center gap-4 px-4 py-3 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <span className="font-black text-[#9a442d] shrink-0" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Admin
        </span>
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`text-sm transition-colors shrink-0 border-b-2 -mb-3 pb-3 ${
                active
                  ? 'text-white font-bold border-[#9a442d]'
                  : 'text-white/65 hover:text-white border-transparent'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
        <span className="flex-1 shrink-0 min-w-4" />
        <Link
          href="/"
          className="text-xs text-white/55 hover:text-white transition-colors shrink-0"
        >
          ← Site
        </Link>
        <LogoutButton />
      </div>
    </nav>
  )
}
