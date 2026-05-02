'use client'

/**
 * AnalyticsTracker — re-establishes custom Supabase analytics tracking in V2.
 *
 * V1 (retired React SPA) wrote to public.analytics; V2 never ported it,
 * leaving the admin analytics page with no live data after 2026-04-16.
 *
 * Design:
 * - Session ID: persisted in localStorage (`_abq_sid`) across page loads,
 *   new UUID generated on first visit or if missing.
 * - session_start: sent once per browser session (sessionStorage `_abq_ss` flag).
 * - pageview: sent on every pathname change (including first render).
 * - Device detection: mobile if touch device or viewport < 768px.
 * - Never blocks render — fire-and-forget inserts via the anon Supabase client.
 *   RLS allows anon INSERT on public.analytics.
 */

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** Returns true if this browser has opted out of being counted in analytics. */
function isSelfExcluded(): boolean {
  try {
    return localStorage.getItem('_abq_no_track') === '1'
  } catch {
    return false
  }
}

function getOrCreateSessionId(): string {
  try {
    let sid = localStorage.getItem('_abq_sid')
    if (!sid) {
      sid = crypto.randomUUID()
      localStorage.setItem('_abq_sid', sid)
    }
    return sid
  } catch {
    return crypto.randomUUID()
  }
}

function getDevice(): 'mobile' | 'desktop' {
  try {
    return navigator.maxTouchPoints > 0 || window.innerWidth < 768 ? 'mobile' : 'desktop'
  } catch {
    return 'desktop'
  }
}

function track(event_type: string, session_id: string, data: Record<string, unknown> = {}) {
  const supabase = createClient()
  // Fire-and-forget — don't await, don't block render
  supabase
    .schema('public')
    .from('analytics')
    .insert({
      event_type,
      session_id,
      device: getDevice(),
      data,
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .then(({ error }) => {
      // Silently ignore — analytics must never break the app
    })
}

export function AnalyticsTracker() {
  const pathname = usePathname()
  const sessionIdRef = useRef<string | null>(null)

  // Initialize session ID once on mount
  useEffect(() => {
    // Bail out entirely if this browser has been opted out (e.g. the site owner)
    if (isSelfExcluded()) return

    sessionIdRef.current = getOrCreateSessionId()

    // Track session_start once per browser session
    try {
      if (!sessionStorage.getItem('_abq_ss')) {
        sessionStorage.setItem('_abq_ss', '1')
        track('session_start', sessionIdRef.current, {
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        })
      }
    } catch {
      // sessionStorage blocked (private mode edge case)
    }
  }, [])

  // Track pageview on every pathname change
  useEffect(() => {
    if (!sessionIdRef.current) return
    if (isSelfExcluded()) return
    track('pageview', sessionIdRef.current, {
      path: pathname,
      title: document.title,
    })
  }, [pathname])

  return null
}
