import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Middleware runs on Edge Runtime.
// For admin: checks cookie presence only (actual secret compared in layout.tsx / Node.js runtime).
// For Supabase auth: refreshes the session so server components can read the user.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Forward pathname so AdminLayout can detect /admin/login and skip auth check
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // Create a mutable response so Supabase SSR can set refresh cookies
  let response = NextResponse.next({ request: { headers: requestHeaders } })

  // Refresh Supabase session (keeps auth working across server components)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Non-blocking — we don't await this for speed, but it sets cookies if needed
  await supabase.auth.getUser()

  // Admin guard: protect /admin/* pages and /api/admin/* routes
  // Edge runtime can't compare env secrets reliably, so we check cookie presence only.
  // The actual secret comparison happens in AdminLayout (Node.js) and each /api/admin route.
  const isAdminPage = pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/verify'
  const isAdminApi  = pathname.startsWith('/api/admin') && pathname !== '/api/admin/login' && pathname !== '/api/admin/verify'

  if (isAdminPage || isAdminApi) {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      // Pages → redirect to login; API routes → return 401
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Run on all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|icon-|manifest.json).*)',
  ],
}
