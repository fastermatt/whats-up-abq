'use client'

/**
 * WebVitals — Core Web Vitals monitoring component.
 *
 * Tracks LCP, INP, CLS, FCP, TTFB and sends them to Umami as custom events
 * so you can monitor real-user CWV from the Umami dashboard.
 *
 * Usage: mounted once in layout.tsx outside the admin routes.
 */

import { useEffect } from 'react'

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void }
  }
}

export function WebVitals() {
  useEffect(() => {
    // Lazy-import web-vitals so it never blocks the main thread
    import('web-vitals').then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      const report = ({ name, value, rating }: { name: string; value: number; rating: string }) => {
        // Round to 1 decimal for readability
        const rounded = Math.round(value * 10) / 10

        // Send to Umami if the tracker is loaded
        if (typeof window !== 'undefined' && window.umami?.track) {
          window.umami.track('web-vital', { metric: name, value: rounded, rating })
        }

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
          const color = rating === 'good' ? '🟢' : rating === 'needs-improvement' ? '🟡' : '🔴'
          console.log(`${color} ${name}: ${rounded}ms (${rating})`)
        }
      }

      onCLS(report)
      onINP(report)
      onLCP(report)
      onFCP(report)
      onTTFB(report)
    })
  }, [])

  return null
}
