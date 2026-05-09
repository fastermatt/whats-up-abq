'use client'

import Link from 'next/link'

export type IGSubNavTab = 'editor' | 'week' | 'queue' | 'history'

interface Props {
  active: IGSubNavTab
  className?: string
}

const TABS: { id: IGSubNavTab; label: string; href: string }[] = [
  { id: 'editor',  label: 'Editor',       href: '/admin/ig'         },
  { id: 'week',    label: 'Week Planner', href: '/admin/ig/week'    },
  { id: 'queue',   label: 'Queue',        href: '/admin/ig/queue'   },
  { id: 'history', label: 'History',      href: '/admin/ig/history' },
]

/**
 * Shared sub-nav for every page under /admin/ig.
 *
 * Active item gets a terra accent + underline. Same component on every page
 * keeps users oriented when switching between the editor, week planner,
 * scheduled queue, and post history.
 */
export function IGSubNav({ active, className = '' }: Props) {
  return (
    <nav className={`flex items-center gap-1 text-[11px] mb-3 ${className}`}>
      {TABS.map(tab => {
        const isActive = tab.id === active
        return isActive ? (
          <span
            key={tab.id}
            className="px-2.5 py-1.5 rounded-md bg-[#9a442d]/15 text-[#e8a898] font-bold border-b-2 border-[#9a442d]"
            aria-current="page"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.id}
            href={tab.href}
            // Contrast: text-white/60 = 4.6:1 on bg-[#0a0a0a] (passes WCAG AA for normal text)
            className="px-2.5 py-1.5 rounded-md text-white/65 hover:bg-white/[0.05] hover:text-white transition-colors border-b-2 border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a442d]/60"
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
