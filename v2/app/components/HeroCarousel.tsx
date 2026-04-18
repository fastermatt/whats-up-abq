'use client'

/**
 * HeroCarousel — auto-rotating background image for the homepage hero.
 *
 * Cycles through 7 local WebP hero images (63–212KB each) with a smooth
 * crossfade every 5 seconds. Starts at a time-of-day appropriate image so
 * the hero genuinely looks different in the morning vs. evening.
 *
 * Two <img> elements are stacked; the "current" fades in while the "next"
 * waits beneath it. On each tick, they swap roles. This avoids flicker and
 * keeps GPU-composited transitions smooth.
 */

import { useEffect, useRef, useState } from 'react'
import { CAROUSEL_IMAGES } from '@/lib/fallback-images'

const INTERVAL_MS  = 11000  // ms between slides
const FADE_MS      = 1500   // CSS transition duration

interface Props {
  /** Server-rendered start index (day-of-week-based); refined client-side to hour */
  serverIndex: number
}

export function HeroCarousel({ serverIndex }: Props) {
  // Start with server index; refine once on client (avoids hydration mismatch)
  const [current, setCurrent]   = useState(serverIndex)
  const [previous, setPrevious] = useState<number | null>(null)
  const [fading, setFading]     = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On mount: refine to hour-based index without hydration mismatch
  useEffect(() => {
    const hour = new Date().getHours()
    let idx = serverIndex
    if (hour >= 6  && hour < 11) idx = 0
    else if (hour >= 11 && hour < 15) idx = 2
    else if (hour >= 15 && hour < 20) idx = 4
    else idx = 6
    setCurrent(idx)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Preload the next image so the transition is seamless
    const nextIdx = (current + 1) % CAROUSEL_IMAGES.length
    const img = new Image()
    img.src = CAROUSEL_IMAGES[nextIdx]

    timer.current = setTimeout(() => {
      setPrevious(current)
      setFading(true)
      setCurrent(nextIdx)

      // After fade completes, clear the previous slot
      setTimeout(() => {
        setPrevious(null)
        setFading(false)
      }, FADE_MS + 100)
    }, INTERVAL_MS)

    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [current])

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Previous image — sits underneath, visible during crossfade */}
      {previous !== null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`prev-${previous}`}
          src={CAROUSEL_IMAGES[previous]}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: fading ? 0 : 1, transition: `opacity ${FADE_MS}ms ease-in-out` }}
        />
      )}
      {/* Current image — fades in on top */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={`cur-${current}`}
        src={CAROUSEL_IMAGES[current]}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: fading ? 1 : 1, transition: `opacity ${FADE_MS}ms ease-in-out` }}
        fetchPriority="high"
      />
    </div>
  )
}
