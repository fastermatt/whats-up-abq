'use client'

import Link from 'next/link'

export type IGSubNavTab = 'editor' | 'week' | 'digest' | 'suggest' | 'queue' | 'history'

interface Props {
  active: IGSubNavTab
  className?: string
  pendingCount?: number
}

const TABS: { id: IGSubNavTab; label: string; href: string }[] = [
  { id: 'editor',  label: 'Editor',       href: '/admin/ig'             },
  { id: 'week',    label: 'Week Planner', href: '/admin/ig/week'        },
  { id: 'digest',  label: 'Digest',       href: '/admin/ig/digest'      },
  { id: 'suggest', label: 'Suggest',      href: '/admin/ig/suggest'     },
  { id: 'queue',   label: 'Queue',        href: '/admin/ig/queue'       },
  { id: 'history', label: 'History',      href: '/admin/ig/history'     },
]

/**
 * Shared sub-nav for every page under /admin/ig.
 *
 * Active item gets a terra accent + underline. Same component on every page
 * keeps users oriented when switching between the editor, week planner,
 * scheduled queue, and post history.
 */
export function IGSubNav({ active, className = '', pendingCount }: Props) {
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
            className="relative px-2.5 py-1.5 rounded-md text-white/65 hover:bg-white/[0.05] hover:text-white transition-colors border-b-2 border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a442d]/60"
          >
            {tab.label}
            {tab.id === 'suggest' && pendingCount && pendingCount > 0 ? (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#9a442d] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
