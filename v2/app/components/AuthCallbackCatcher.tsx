'use client'

import { useEffect } from 'react'

/**
 * Catches Supabase auth tokens arriving in the URL hash on any page.
 *
 * When a magic link is clicked and Supabase doesn't have our full redirect
 * URL in its allow-list, it falls back to the Site URL (homepage) with
 * `#access_token=xxx&refresh_token=yyy&type=...` in the hash. Without this
 * catcher, those tokens just sit in the URL and do nothing — causing the
 * admin to infinite-loop back to the login form.
 *
 * This component detects the hash on any page and forwards it to
 * `/admin/verify`, preserving the fragment so the verify page can complete
 * the flow.
 */
export function AuthCallbackCatcher() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token=')) return

    // Already on the verify page — don't loop
    if (window.location.pathname === '/admin/verify') return

    // Preserve the hash when redirecting — /admin/verify reads it to finish sign-in
    window.location.replace(`/admin/verify${hash}`)
  }, [])

  return null
}
