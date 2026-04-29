'use client'

import { useEffect } from 'react'

/**
 * ScrollHintManager — gates the .scroll-hint-inner nudge animation to once per session.
 *
 * First visit: does nothing; CSS animation plays naturally on all scroll rows.
 * Subsequent visits: adds `scroll-hint-done` to <html> on mount, which the global CSS rule
 * `html.scroll-hint-done .scroll-hint-inner { animation: none }` uses to suppress it.
 *
 * Renders nothing — drop it once anywhere in the page tree.
 */
export function ScrollHintManager() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('abq-scroll-hint-seen')) {
        document.documentElement.classList.add('scroll-hint-done')
      } else {
        sessionStorage.setItem('abq-scroll-hint-seen', '1')
      }
    } catch {
      // sessionStorage blocked (private browsing strictest mode) — degrade gracefully
    }
  }, [])

  return null
}
