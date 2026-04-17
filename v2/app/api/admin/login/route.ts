import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = '4mattcarlson@gmail.com'
const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://abqunplugged.com'

export async function POST(request: NextRequest) {
  const { password } = await request.json()
  const secret = process.env.ADMIN_SECRET

  if (!secret || password !== secret) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Check if this device is already trusted (completed OTP before)
  const trustedDevice = request.cookies.get('admin_trusted_device')?.value
  if (trustedDevice === secret) {
    // Known device — set session token and let them in directly
    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_token', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
    return response
  }

  // New/unrecognized device — send magic link OTP to admin email
  try {
    const supabase = await createClient()
    await supabase.auth.signInWithOtp({
      email: ADMIN_EMAIL,
      options: {
        emailRedirectTo: `${SITE_URL}/admin/verify`,
        shouldCreateUser: true,
      },
    })
  } catch {
    // Non-fatal — log only; the check-email screen will still show
    console.error('[admin/login] Failed to send OTP email')
  }

  return NextResponse.json({ action: 'verify_required' })
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin_token')
  return response
}
