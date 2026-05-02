'use client'

/**
 * ExcludeVisits — lets the site owner opt their browser out of analytics.
 *
 * Sets localStorage._abq_no_track = '1' (checked by AnalyticsTracker) and
 * umami.disabled = '1' (checked by the Umami script) so neither system
 * counts visits from this device.
 *
 * Admin-section visits are already excluded by layout.tsx (AnalyticsTracker
 * is not rendered inside /admin). This covers public-page visits from the
 * owner's personal browser.
 */

import { useEffect, useState } from 'react'
import { EyeOff, Eye } from 'lucide-react'

export function ExcludeVisits() {
  const [excluded, setExcluded] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      setExcluded(localStorage.getItem('_abq_no_track') === '1')
    } catch {
      setExcluded(false)
    }
  }, [])

  if (excluded === null) return null // SSR / hydration guard

  function toggle() {
    try {
      if (excluded) {
        localStorage.removeItem('_abq_no_track')
        localStorage.removeItem('umami.disabled')
        setExcluded(false)
      } else {
        localStorage.setItem('_abq_no_track', '1')
        localStorage.setItem('umami.disabled', '1') // Umami's own opt-out key
        setExcluded(true)
      }
    } catch {
      // localStorage blocked
    }
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
        excluded
          ? 'bg-green-600/15 text-green-300 border-green-600/30 hover:bg-green-600/25'
          : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60'
      }`}
      title={excluded
        ? 'Your visits are NOT counted — click to re-enable'
        : 'Your visits ARE being counted — click to exclude this browser'}
    >
      {excluded
        ? <><EyeOff className="w-3.5 h-3.5" /> This browser excluded</>
        : <><Eye className="w-3.5 h-3.5" /> Exclude my visits</>
      }
    </button>
  )
}
