import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { password } = await request.json()
  const secret = process.env.ADMIN_SECRET

  if (!secret || password !== secret) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Check if this device is already trusted (completed OTP before)
  const trustedDevice = request.cookies.get('admin_trusted_device')?.value
  if (trustedDevice === secret) {
    // Known device — grant session immediately
    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_token', secret, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 30, // 30 days
      path:     '/',
    })
    return response
  }

  // New/unrecognized device — client will send the OTP email via Supabase
  return NextResponse.json({ action: 'verify_required' })
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin_token')
  return response
}
