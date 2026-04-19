'use client'

/**
 * HeroCarousel — auto-rotating background image for the homepage hero.
 *
 * Crossfade strategy:
 *   - Two <img> elements stacked. The "previous" sits at full opacity beneath.
 *   - The "current" image remounts (via React key) and fades in via CSS animation.
 *   - After the fade completes, the previous slot is cleared.
 *   - No JS opacity tweening — GPU-composited CSS animation only.
 */

import { useEffect, useRef, useState } from 'react'
import { CAROUSEL_IMAGES } from '@/lib/fallback-images'

const INTERVAL_MS = 11000  // ms between slides
const FADE_MS     = 1500   // must match .hero-fade-in animation duration in globals.css

interface Props {
  /** Server-rendered start index; refined client-side to hour-of-day */
  serverIndex: number
}

export function HeroCarousel({ serverIndex }: Props) {
  const [current,  setCurrent]  = useState(serverIndex)
  const [previous, setPrevious] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On mount: refine to hour-based index without hydration mismatch
  useEffect(() => {
    const hour = new Date().getHours()
    let idx = serverIndex
    if      (hour >= 6  && hour < 11) idx = 0  // morning   → hero-1
    else if (hour >= 11 && hour < 15) idx = 2  // afternoon → hero-3
    else if (hour >= 15 && hour < 20) idx = 4  // evening   → hero-5
    else                              idx = 6  // night     → hero-7
    setCurrent(idx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Preload the next image so the crossfade is seamless
    const nextIdx = (current + 1) % CAROUSEL_IMAGES.length
    const preload = new Image()
    preload.src = CAROUSEL_IMAGES[nextIdx]

    timer.current = setTimeout(() => {
      setPrevious(current)
      setCurrent(nextIdx)
      // Once the CSS fade finishes, drop the now-hidden previous image
      setTimeout(() => setPrevious(null), FADE_MS + 200)
    }, INTERVAL_MS)

    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [current])

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Previous image — sits at full opacity underneath while new one fades in */}
      {previous !== null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`prev-${previous}`}
          src={CAROUSEL_IMAGES[previous]}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Current image — CSS animation fades it in from opacity 0 on every mount */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={`cur-${current}`}
        src={CAROUSEL_IMAGES[current]}
        alt=""
        className="absolute inset-0 w-full h-full object-cover hero-fade-in"
        fetchPriority="high"
      />
    </div>
  )
}
