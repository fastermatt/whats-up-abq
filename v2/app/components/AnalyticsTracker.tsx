'use client'

/**
 * AnalyticsTracker — re-establishes custom Supabase analytics tracking in V2.
 *
 * V1 (retired React SPA) wrote to public.analytics; V2 never ported it,
 * leaving the admin analytics page with no live data after 2026-04-16.
 *
 * Browser identity persists in localStorage. A real visit/session lives in
 * sessionStorage and rotates after 30 minutes without a tracked event.
 * `trackEvent` emits session_start automatically before the first event in a
 * new session, and every route change emits a pageview.
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/analytics/track'

export function AnalyticsTracker() {
  const pathname = usePathname()

  // Track pageview on every pathname change
  useEffect(() => {
    trackEvent('pageview', {
      path: pathname,
      title: document.title,
    })
  }, [pathname])

  return null
}
