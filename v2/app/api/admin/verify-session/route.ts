/**
 * Admin 2FA — session grant
 *
 * Called by the client-side /admin/verify page after it has established
 * a valid Supabase auth session (via verifyOtp or setSession from a magic link).
 * This route confirms the session is real, then sets the admin httpOnly cookies.
 *
 * Note: the admin email is whitelisted — any other authenticated user is rejected.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = '4mattcarlson@gmail.com'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'No valid session. Please try the link again.' }, { status: 401 })
  }

  // Only the admin's own email may receive admin cookies
  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized email address.' }, { status: 403 })
  }

  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const isProd = process.env.NODE_ENV === 'production'
  const response = NextResponse.json({ success: true })

  // Admin session — 30 days
  response.cookies.set('admin_token', secret, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,
    path:     '/',
  })

  // Trusted device marker — 90 days (skip 2FA on this browser for 3 months)
  response.cookies.set('admin_trusted_device', secret, {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 90,
    path:     '/',
  })

  return response
}
