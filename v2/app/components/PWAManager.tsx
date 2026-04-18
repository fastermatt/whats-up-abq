'use client'

/**
 * PWAManager — registers the service worker and handles pull-to-refresh.
 *
 * Mount once in the root layout. Does three things:
 * 1. Registers /sw.js on first load
 * 2. Handles pull-to-refresh gesture with a visual spinner
 * 3. Exposes a way for other components to request push permission
 *
 * Pull-to-refresh:
 * - Only active in standalone mode (installed PWA)
 * - Touch: pull down > 70px from top → shows spinner → refreshes on release
 * - Uses Next.js router.refresh() for a soft refresh (no full page reload)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const PTR_THRESHOLD   = 70   // px pull required to trigger refresh
const PTR_MAX_PULL    = 110  // px max visual stretch

export function PWAManager() {
  const router  = useRouter()
  const [pullY, setPullY]         = useState(0)   // current pull distance (0–max)
  const [refreshing, setRefreshing] = useState(false)

  const touchStartY = useRef(0)
  const isPulling   = useRef(false)
  const isStandalone = useRef(false)

  // ── Register service worker ────────────────────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => console.warn('[SW] Registration failed:', err))
    }

    // Detect standalone mode (installed PWA)
    isStandalone.current =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  }, [])

  // ── Pull-to-refresh gesture ────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isStandalone.current) return
    if (window.scrollY > 0) return          // only trigger at very top
    touchStartY.current = e.touches[0].clientY
    isPulling.current = true
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current || refreshing) return

    const deltaY = e.touches[0].clientY - touchStartY.current
    if (deltaY <= 0) {
      setPullY(0)
      return
    }

    // Resist pull with a logarithmic curve so it feels springy
    const pull = Math.min(PTR_MAX_PULL, deltaY * 0.55)
    setPullY(pull)

    // Prevent default scroll only while actively pulling
    if (pull > 8) e.preventDefault()
  }, [refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false

    if (pullY >= PTR_THRESHOLD) {
      setRefreshing(true)
      setPullY(PTR_THRESHOLD)   // hold indicator in place

      router.refresh()

      // Keep spinner visible briefly so user sees it worked
      await new Promise(r => setTimeout(r, 1000))
      setRefreshing(false)
    }
    setPullY(0)
  }, [pullY, router])

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove',  handleTouchMove,  { passive: false })
    document.addEventListener('touchend',   handleTouchEnd,   { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove',  handleTouchMove)
      document.removeEventListener('touchend',   handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  // ── Render ─────────────────────────────────────────────────────────────────
  // The PTR indicator sits at the top of the screen, above all content.
  // It slides down as you pull and springs back when released.

  const showIndicator = pullY > 4 || refreshing
  const triggered = pullY >= PTR_THRESHOLD || refreshing

  if (!showIndicator) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
      style={{
        transform:  `translateY(${refreshing ? 52 : pullY - 8}px)`,
        transition: refreshing || pullY === 0 ? 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
      }}
    >
      <div
        className={`
          w-10 h-10 rounded-full shadow-lg flex items-center justify-center
          transition-colors duration-200
          ${triggered
            ? 'bg-[#9a442d] text-white'
            : 'bg-white text-[#9a442d] border border-[#f0e4cc]'
          }
        `}
        style={{ opacity: Math.min(1, pullY / 30) }}
      >
        <RefreshCw
          className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
          style={!refreshing ? { transform: `rotate(${(pullY / PTR_MAX_PULL) * 270}deg)` } : {}}
        />
      </div>
    </div>
  )
}
