'use client'

/**
 * HeroMapRoute — animated route trace on the hero map.
 *
 * On every page load, picks two random ABQ landmarks and draws an
 * L-shaped path between them (horizontal first, then vertical — following
 * the street grid). The path animates with a stroke-dashoffset draw effect.
 *
 * Coordinates are in the same viewBox as the static terra grid:
 * "-900 -420 3000 1800". The overshoot div matches the grid's panning
 * container so landmark positions align perfectly.
 *
 * Renders null during SSR — no flicker, no layout shift.
 */

import { useEffect, useState } from 'react'

// Notable ABQ locations in the map's coordinate system
// viewBox: "-900 -420 3000 1800"  (city spans roughly x=55–1000, y=142–800)
const WAYPOINTS = [
  { name: 'West Mesa',        x:  60, y: 491 },
  { name: 'Old Town',         x: 232, y: 464 },
  { name: 'Downtown',         x: 332, y: 468 },
  { name: 'The Big I',        x: 370, y: 450 },
  { name: 'UNM',              x: 455, y: 502 },
  { name: 'Nob Hill',         x: 538, y: 491 },
  { name: 'Uptown',           x: 608, y: 355 },
  { name: 'Tramway',          x: 998, y: 491 },
  { name: 'Balloon Fiesta',   x: 343, y: 184 },
  { name: 'NE Heights',       x: 728, y: 298 },
  { name: 'Sunport',          x: 674, y: 710 },
  { name: 'North Valley',     x: 200, y: 210 },
  { name: 'South Valley',     x: 350, y: 750 },
  { name: 'Rio Grande',       x: 158, y: 350 },
]

interface RouteState {
  d: string
  len: number
  sx: number; sy: number
  ex: number; ey: number
}

export function HeroMapRoute() {
  const [route, setRoute] = useState<RouteState | null>(null)

  useEffect(() => {
    const pts = WAYPOINTS
    // Pick two distinct points, ensuring minimum meaningful distance
    let i = 0, j = 0, attempts = 0
    do {
      i = Math.floor(Math.random() * pts.length)
      j = Math.floor(Math.random() * pts.length)
      attempts++
    } while (
      (i === j || Math.abs(pts[i].x - pts[j].x) + Math.abs(pts[i].y - pts[j].y) < 200)
      && attempts < 20
    )

    const a = pts[i], b = pts[j]
    // L-shaped path: move horizontally to destination x, then vertically
    const d = `M ${a.x},${a.y} L ${b.x},${a.y} L ${b.x},${b.y}`
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)

    setRoute({ d, len, sx: a.x, sy: a.y, ex: b.x, ey: b.y })
  }, [])

  if (!route) return null

  const dash = route.len + 20

  return (
    // Overshoot div matches the grid's panning container — coordinates align
    <div className="absolute" style={{ top: '-15%', bottom: '-15%', left: '-6%', right: '-6%' }}>
      <svg
        viewBox="-900 -420 3000 1800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Start dot — fades in immediately */}
        <circle
          cx={route.sx} cy={route.sy} r="5.5"
          fill="#9a442d"
          style={{ opacity: 0, animation: 'routeDotIn 0.25s ease-out 0.35s forwards' }}
        />
        <circle
          cx={route.sx} cy={route.sy} r="10"
          fill="none" stroke="#9a442d" strokeWidth="1.5"
          style={{ opacity: 0, animation: 'routeDotIn 0.25s ease-out 0.35s forwards' }}
        />

        {/* Route line — draws itself over 2 seconds */}
        <path
          d={route.d}
          fill="none"
          stroke="#9a442d"
          strokeWidth="2.5"
          style={{
            strokeDasharray: dash,
            strokeDashoffset: dash,
            opacity: 0.72,
            animation: `drawRoute 2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards`,
          }}
        />

        {/* End dot — appears as the route finishes drawing */}
        <circle
          cx={route.ex} cy={route.ey} r="5.5"
          fill="#9a442d"
          style={{ opacity: 0, animation: 'routeDotIn 0.3s ease-out 2.4s forwards' }}
        />
      </svg>
    </div>
  )
}
