import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ── Edge-level URL normalization ──────────────────────────────────────────────
// These redirects run BEFORE ISR cache, so stale cached empty-result pages
// for slug-form category params are bypassed entirely.

/** Map URL-slug category params to canonical DB values.
 *  Keys are lowercase slug forms; values are the exact DB category names. */
const CATEGORY_SLUG_REDIRECTS: Record<string, string> = {
  'arts':             'Arts & Theater',
  'arts-culture':     'Arts & Theater',
  'arts-theater':     'Arts & Theater',
  'arts-theatre':     'Arts & Theater',
  'arts-and-theater': 'Arts & Theater',
  'theater':          'Arts & Theater',
  'theatre':          'Arts & Theater',
  'food':             'Food & Drink',
  'food-drink':       'Food & Drink',
  'food-and-drink':   'Food & Drink',
  'drink':            'Food & Drink',
  'film-cinema':      'Film',
  'cinema':           'Film',
  'movies':           'Film',
  'outdoors':         'Outdoor',
  'festival':         'Festivals',
  'kids':             'Family',
  'nightlife':        'Nightlife',   // kept as-is (UI uses it; page shows Community fallback)
}

// Middleware runs on Edge Runtime.
// For admin: checks cookie presence only (actual secret compared in layout.tsx / Node.js runtime).
// For Supabase auth: refreshes the session so server components can read the user.
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // ── /search → /events redirect (edge-level, before ISR) ─────────────────────
  if (pathname === '/search') {
    const url = request.nextUrl.clone()
    url.pathname = '/events'
    return NextResponse.redirect(url, { status: 308 })
  }

  // ── Venue slug aliases (/venues/[slug]) ─────────────────────────────────────
  // Same ISR cache issue: redirect common shorthand slugs → canonical slugs.
  if (pathname.startsWith('/venues/')) {
    const venueSlug = pathname.slice('/venues/'.length)
    const VENUE_SLUG_REDIRECTS: Record<string, string> = {
      'el-rey':             'the-historic-el-rey-theater-albuquerque',
      'el-rey-theater':     'the-historic-el-rey-theater-albuquerque',
      'el-rey-theatre':     'the-historic-el-rey-theater-albuquerque',
      'kimo-theater':       'kimo-theatre',
      'popejoy-theater':    'popejoy-hall',
      'revel-abq':          'revel-entertainment-center',
      'revel':              'revel-entertainment-center',
      'sunshine':           'sunshine-theater',
      'isotopes':           'rio-grande-credit-union-field-at-isotopes-park',
      'isotopes-park':      'rio-grande-credit-union-field-at-isotopes-park',
      'nhcc':               'national-hispanic-cultural-center',
      'national-hispanic':  'national-hispanic-cultural-center',
    }
    const canonical = VENUE_SLUG_REDIRECTS[venueSlug]
    if (canonical) {
      const url = request.nextUrl.clone()
      url.pathname = `/venues/${canonical}`
      return NextResponse.redirect(url, { status: 308 })
    }
  }

  // ── Category slug normalization on /events ───────────────────────────────────
  // Redirect slug-form params to canonical DB names so ISR caches canonical URLs.
  if (pathname === '/events') {
    const cat = searchParams.get('category')
    if (cat) {
      const canonical = CATEGORY_SLUG_REDIRECTS[cat.toLowerCase()]
      if (canonical && canonical !== cat) {
        const url = request.nextUrl.clone()
        url.searchParams.set('category', canonical)
        return NextResponse.redirect(url, { status: 308 })
      }
    }
  }

  // Admin guard: protect /admin/* pages and /api/admin/* routes
  // Edge runtime can't compare env secrets reliably, so we check cookie presence only.
  // The actual secret comparison happens in AdminLayout (Node.js) and each /api/admin route.
  const ADMIN_PUBLIC_PAGES = ['/admin/login', '/admin/verify']
  const ADMIN_PUBLIC_APIS  = ['/api/admin/login', '/api/admin/verify', '/api/admin/verify-session']
  const isAdminPage = pathname.startsWith('/admin') && !ADMIN_PUBLIC_PAGES.includes(pathname)
  const isAdminApi  = pathname.startsWith('/api/admin') && !ADMIN_PUBLIC_APIS.includes(pathname)

  // ── Public routes: return immediately, NO cookie ops ──────────────────────
  // supabase.auth.getUser() sets Set-Cookie on the response when a session
  // needs refresh. That header makes every CDN (Netlify, Cloudflare, etc.)
  // mark the response private/no-cache, which kills ISR caching for public pages.
  // Public pages never need an auth session, so we skip auth entirely.
  if (!isAdminPage && !isAdminApi) {
    // Forward pathname header so server components can read it if needed
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', pathname)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // ── Admin routes: full auth + session refresh ──────────────────────────────
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
