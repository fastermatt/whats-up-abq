'use client'

/**
 * HeroMapRoute — animated route trace overlaid on the real ABQ street map.
 *
 * Picks one of several hand-crafted routes on each load. Every route follows
 * ABQ's actual street grid (horizontal + vertical segments only), connects
 * real neighborhoods, and is short enough to read as a plausible trip.
 *
 * Coordinates are in the same viewBox as abq-map-bg.svg: "0 0 1284 539".
 * The SVG uses preserveAspectRatio="xMidYMid slice" to match the <img>
 * object-cover rendering of the map background.
 *
 * Renders null during SSR — no flicker, no layout shift.
 */

import { useEffect, useState } from 'react'

interface Route {
  /** SVG path data — street-grid segments only (H/V turns) */
  d: string
  /** Approximate path length for stroke-dasharray animation */
  len: number
  sx: number; sy: number   // origin dot
  ex: number; ey: number   // destination pin
}

/**
 * Hand-crafted routes — each follows ABQ's N-S / E-W grid and represents
 * a real trip between named places. Keep these short and legible.
 * All coords in viewBox "0 0 1284 539".
 *
 * Street rough positions:
 *   Central Ave:       y ≈ 272
 *   Montgomery/Menaul: y ≈ 196
 *   Paseo del Norte:   y ≈ 100
 *   Rio Grande blvd:   x ≈ 228
 *   4th / Rio Grande:  x ≈ 310
 *   I-25 / 2nd St:     x ≈ 408
 *   Wyoming/San Mateo: x ≈ 640
 *   Eubank/Juan Tabo:  x ≈ 800
 *   Airport/Gibson:    x ≈ 712, y ≈ 390
 */
const ROUTES: Route[] = [
  // 1. Old Town → Nob Hill along Central Ave
  {
    d:   'M 310,272 L 578,272',
    len: 268,
    sx: 310, sy: 272, ex: 578, ey: 272,
  },
  // 2. North Valley → Downtown: south on Rio Grande, right on Central
  {
    d:   'M 228,118 L 228,272 L 408,272',
    len: 154 + 180,
    sx: 228, sy: 118, ex: 408, ey: 272,
  },
  // 3. Downtown → Uptown: north on I-25, east on Montgomery
  {
    d:   'M 408,272 L 408,196 L 650,196',
    len: 76 + 242,
    sx: 408, sy: 272, ex: 650, ey: 196,
  },
  // 4. Nob Hill → NE Heights: north on San Mateo, east on Montgomery
  {
    d:   'M 578,272 L 578,196 L 782,196',
    len: 76 + 204,
    sx: 578, sy: 272, ex: 782, ey: 196,
  },
  // 5. UNM → Airport: east on Central, south on Airport Blvd
  {
    d:   'M 492,272 L 712,272 L 712,404',
    len: 220 + 132,
    sx: 492, sy: 272, ex: 712, ey: 404,
  },
  // 6. Balloon Fiesta → Downtown: south on 2nd St
  {
    d:   'M 408,82 L 408,272',
    len: 190,
    sx: 408, sy: 82, ex: 408, ey: 272,
  },
  // 7. South Valley → Old Town: north on 4th St
  {
    d:   'M 310,440 L 310,272',
    len: 168,
    sx: 310, sy: 440, ex: 310, ey: 272,
  },
  // 8. West Mesa → Old Town: east on Central
  {
    d:   'M 100,272 L 310,272',
    len: 210,
    sx: 100, sy: 272, ex: 310, ey: 272,
  },
]

export function HeroMapRoute() {
  const [route, setRoute] = useState<Route | null>(null)

  useEffect(() => {
    const r = ROUTES[Math.floor(Math.random() * ROUTES.length)]
    setRoute(r)
  }, [])

  if (!route) return null

  const dash = route.len + 20

  return (
    <div className="absolute" style={{ top: '-15%', bottom: '-15%', left: '-6%', right: '-6%' }}>
      <svg
        viewBox="0 0 1284 539"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ── Origin dot — fades in before the route draws ── */}
        <circle
          cx={route.sx} cy={route.sy} r="3.5"
          fill="#9a442d"
          style={{ opacity: 0, animation: 'routeDotIn 0.3s ease-out 0.2s forwards' }}
        />
        {/* Pulse ring around origin */}
        <circle
          cx={route.sx} cy={route.sy} r="7"
          fill="none" stroke="#9a442d" strokeWidth="1"
          style={{ opacity: 0, animation: 'routeDotIn 0.3s ease-out 0.2s forwards' }}
        />

        {/* ── Route line — draws itself ── */}
        <path
          d={route.d}
          fill="none"
          stroke="#9a442d"
          strokeWidth="2.5"
          style={{
            strokeDasharray: dash,
            strokeDashoffset: dash,
            opacity: 0.7,
            animation: `drawRoute 1.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards`,
          }}
        />

        {/* ── Destination pin — appears as route finishes ── */}
        {/* Outer glow ring */}
        <circle
          cx={route.ex} cy={route.ey} r="10"
          fill="none" stroke="#9a442d" strokeWidth="1"
          style={{ opacity: 0, animation: 'routeDotIn 0.35s ease-out 2.2s forwards' }}
        />
        {/* Filled destination dot */}
        <circle
          cx={route.ex} cy={route.ey} r="5"
          fill="#9a442d"
          style={{ opacity: 0, animation: 'routeDotIn 0.35s ease-out 2.2s forwards' }}
        />
        {/* Inner white center — makes it look like a map pin */}
        <circle
          cx={route.ex} cy={route.ey} r="2"
          fill="white"
          style={{ opacity: 0, animation: 'routeDotIn 0.35s ease-out 2.2s forwards' }}
        />
      </svg>
    </div>
  )
}
