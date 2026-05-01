'use client'

/**
 * KoFiFloat — a small persistent floating coffee cup button.
 * Desktop-only (hidden on mobile — the SupportBar handles it there).
 * Fixed bottom-right, above content but below modals.
 * Links to ko-fi.com/stopscrolling.
 */

import { useState } from 'react'

export function KoFiFloat() {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href="https://ko-fi.com/stopscrolling"
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Support ABQ Unplugged on Ko-Fi"
      className="hidden md:flex fixed bottom-6 right-6 z-40 items-center gap-2 rounded-full shadow-lg transition-all duration-300"
      style={{
        background: '#9a442d',
        color: '#fff',
        padding: hovered ? '0.55rem 1.1rem 0.55rem 0.85rem' : '0.55rem',
        boxShadow: hovered
          ? '0 6px 24px rgba(154,68,45,.35)'
          : '0 2px 10px rgba(154,68,45,.25)',
      }}
    >
      {/* Coffee cup */}
      <span
        style={{
          fontSize: '1.15rem',
          lineHeight: 1,
          display: 'block',
          transition: 'transform 0.25s ease',
          transform: hovered ? 'scale(1.12)' : 'scale(1)',
        }}
        aria-hidden="true"
      >
        ☕
      </span>

      {/* Expand label */}
      <span
        className="text-xs font-bold whitespace-nowrap overflow-hidden transition-all duration-300"
        style={{
          maxWidth: hovered ? '140px' : '0px',
          opacity: hovered ? 1 : 0,
        }}
      >
        Buy me a coffee
      </span>
    </a>
  )
}
