import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { token_hash, type } = await request.json()

  if (!token_hash || type !== 'email') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'email' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const response = NextResponse.json({ success: true })

  // Admin session token — 30 days
  response.cookies.set('admin_token', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  // Trusted device marker — 90 days (skip OTP on future logins)
  response.cookies.set('admin_trusted_device', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
  })

  return response
}
