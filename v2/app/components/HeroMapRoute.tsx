'use client'

/**
 * HeroMagnifier — an SVG magnifying glass that draws itself in,
 * then slowly scans across the ABQ map as if searching for events.
 *
 * Animation sequence:
 *  0.3s  → lens circle begins drawing (stroke-dashoffset, ~1.0s)
 *  1.15s → lens complete; handle begins drawing (~0.45s)
 *  1.5s  → crosshair + lens fill fade in
 *  2.0s  → search pan begins (slow translate across the ABQ map, infinite)
 *
 * Same viewBox / preserveAspectRatio as abq-map-bg.svg: "0 0 1284 539" xMidYMid slice.
 * Renders null during SSR — no flicker, no layout shift.
 */

import { useState, useEffect } from 'react'

// ── Lens geometry ───────────────────────────────────────────────────────────
const CX = 215                        // lens centre x — North Valley / Rio Grande area
const CY = 192                        // lens centre y
const R  = 46                         // lens radius (viewBox units) — intentionally modest
const CIRCUM = 2 * Math.PI * R        // ≈ 289.0 — full lens circumference

// Handle: emerges from the SE quadrant of the lens rim, extends 40 units at 45°
const COS45 = Math.cos(Math.PI / 4)   // 0.7071
const SIN45 = Math.sin(Math.PI / 4)   // 0.7071
const HX1 = CX + R * COS45           // handle start (on lens rim)
const HY1 = CY + R * SIN45
const H_LEN = 40                      // handle length (scaled with R)
const HX2 = HX1 + H_LEN * COS45      // handle end
const HY2 = HY1 + H_LEN * SIN45

// Crosshair endpoints (stop short of lens rim so they look inset)
const INSET = 10
const CH_X1 = CX - R + INSET;  const CH_X2 = CX + R - INSET   // horizontal
const CH_Y1 = CY - R + INSET;  const CH_Y2 = CY + R - INSET   // vertical

export function HeroMapRoute() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

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
        {/*
          Outer group — handles the slow search pan after draw-in completes.
          The 2.0s delay lets the draw-in animations finish before movement begins.
        */}
        <g style={{ opacity: 0.5, animation: 'magnifierSearch 15s ease-in-out 2.0s infinite' }}>

          {/* Lens fill — very subtle terra tint, fades in after draw */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="rgba(154,68,45,0.04)"
            style={{ opacity: 0, animation: 'magnifierFadeIn 0.6s ease-out 1.2s forwards' }}
          />

          {/* Crosshair — faint scope lines inside the lens */}
          <line
            x1={CH_X1} y1={CY} x2={CH_X2} y2={CY}
            stroke="rgba(154,68,45,0.28)" strokeWidth="1"
            style={{ opacity: 0, animation: 'magnifierFadeIn 0.5s ease-out 1.5s forwards' }}
          />
          <line
            x1={CX} y1={CH_Y1} x2={CX} y2={CH_Y2}
            stroke="rgba(154,68,45,0.28)" strokeWidth="1"
            style={{ opacity: 0, animation: 'magnifierFadeIn 0.5s ease-out 1.5s forwards' }}
          />

          {/* Lens circle — draws itself via stroke-dashoffset */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="#9a442d"
            strokeWidth="2.5"
            style={{
              opacity: 0.72,
              strokeDasharray: `${CIRCUM + 20}`,
              strokeDashoffset: `${CIRCUM + 20}`,
              animation: 'drawMagnifierLens 1.0s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards',
            }}
          />

          {/* Handle — draws in after lens finishes */}
          <line
            x1={HX1} y1={HY1} x2={HX2} y2={HY2}
            stroke="#9a442d"
            strokeWidth="2.5"
            style={{
              opacity: 0.72,
              strokeDasharray: `${H_LEN + 5}`,
              strokeDashoffset: `${H_LEN + 5}`,
              animation: 'drawMagnifierHandle 0.45s cubic-bezier(0.16, 1, 0.3, 1) 1.15s forwards',
            }}
          />

        </g>
      </svg>
    </div>
  )
}
