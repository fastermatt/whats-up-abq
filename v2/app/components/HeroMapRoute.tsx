'use client'

/**
 * HeroMapRoute — animated route trace overlaid on the real ABQ street map.
 *
 * On every page load, picks two random ABQ landmarks and draws an
 * L-shaped path between them (horizontal first, then vertical — following
 * the street grid). The path animates with a stroke-dashoffset draw effect.
 *
 * Coordinates are in the same viewBox as abq-map-bg.svg: "0 0 1284 539".
 * The SVG uses preserveAspectRatio="xMidYMid slice" to match the <img>
 * object-cover rendering of the map background.
 *
 * Renders null during SSR — no flicker, no layout shift.
 */

import { useEffect, useState } from 'react'

// ABQ landmark coordinates in the real map's viewBox "0 0 1284 539"
// Rio Grande: ~x=260, Downtown: ~x=400, Tramway: ~x=1080, Central Ave: ~y=275
const WAYPOINTS = [
  { name: 'West Mesa',       x:  88, y: 280 },
  { name: 'Old Town',        x: 308, y: 265 },
  { name: 'Downtown',        x: 400, y: 268 },
  { name: 'The Big I',       x: 418, y: 250 },
  { name: 'UNM',             x: 492, y: 282 },
  { name: 'Nob Hill',        x: 578, y: 272 },
  { name: 'Uptown',          x: 650, y: 192 },
  { name: 'Tramway',         x:1082, y: 268 },
  { name: 'Balloon Fiesta',  x: 398, y:  78 },
  { name: 'NE Heights',      x: 782, y: 160 },
  { name: 'Sunport',         x: 712, y: 412 },
  { name: 'North Valley',    x: 218, y: 118 },
  { name: 'South Valley',    x: 372, y: 438 },
  { name: 'Rio Grande',      x: 225, y: 198 },
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
    // Pick two distinct points with minimum meaningful distance
    let i = 0, j = 0, attempts = 0
    do {
      i = Math.floor(Math.random() * pts.length)
      j = Math.floor(Math.random() * pts.length)
      attempts++
    } while (
      (i === j || Math.abs(pts[i].x - pts[j].x) + Math.abs(pts[i].y - pts[j].y) < 150)
      && attempts < 20
    )

    const a = pts[i], b = pts[j]
    // L-shaped path: horizontal to destination x, then vertical
    const d = `M ${a.x},${a.y} L ${b.x},${a.y} L ${b.x},${b.y}`
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoute({ d, len, sx: a.x, sy: a.y, ex: b.x, ey: b.y })
  }, [])

  if (!route) return null

  const dash = route.len + 20

  return (
    // Matches the panning container's overshoot so coordinates align with the map img
    <div className="absolute" style={{ top: '-15%', bottom: '-15%', left: '-6%', right: '-6%' }}>
      <svg
        viewBox="0 0 1284 539"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Start dot — fades in immediately */}
        <circle
          cx={route.sx} cy={route.sy} r="4"
          fill="#9a442d"
          style={{ opacity: 0, animation: 'routeDotIn 0.25s ease-out 0.35s forwards' }}
        />
        <circle
          cx={route.sx} cy={route.sy} r="8"
          fill="none" stroke="#9a442d" strokeWidth="1.2"
          style={{ opacity: 0, animation: 'routeDotIn 0.25s ease-out 0.35s forwards' }}
        />

        {/* Route line — draws itself over 2 seconds */}
        <path
          d={route.d}
          fill="none"
          stroke="#9a442d"
          strokeWidth="2"
          style={{
            strokeDasharray: dash,
            strokeDashoffset: dash,
            opacity: 0.75,
            animation: `drawRoute 2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards`,
          }}
        />

        {/* End dot — appears as the route finishes drawing */}
        <circle
          cx={route.ex} cy={route.ey} r="4"
          fill="#9a442d"
          style={{ opacity: 0, animation: 'routeDotIn 0.3s ease-out 2.4s forwards' }}
        />
      </svg>
    </div>
  )
}
