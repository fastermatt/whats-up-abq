import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware only checks cookie PRESENCE (Edge Runtime — no process.env secret comparison).
// The actual secret value is verified in app/admin/layout.tsx (Node.js runtime).
// We also pass x-pathname header so AdminLayout can detect the login page and skip auth.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Forward pathname to server components via header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/admin/:path*'],
}
