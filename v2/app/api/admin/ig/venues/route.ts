/**
 * GET /api/admin/ig/venues?q=Tatted+Bee+Brewhouse
 *
 * Searches Facebook Places for venues to tag in an Instagram post.
 * Returns up to 8 matching places with their Facebook Page IDs.
 * The ID returned is suitable for use as `location_id` in the IG publish API.
 *
 * Facebook Places search requires center coordinates — we default to central
 * Albuquerque (35.0844, -106.6504) with a 50 km radius.
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

export interface VenueResult {
  id: string
  name: string
  address: string
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return NextResponse.json({ error: 'No access token configured' }, { status: 500 })

  // Central Albuquerque coordinates, 50 km radius covers metro area
  const center = '35.0844,-106.6504'
  const distance = 50000

  const searchUrl = new URL('https://graph.facebook.com/v19.0/search')
  searchUrl.searchParams.set('type', 'place')
  searchUrl.searchParams.set('q', q)
  searchUrl.searchParams.set('center', center)
  searchUrl.searchParams.set('distance', String(distance))
  searchUrl.searchParams.set('fields', 'id,name,location')
  searchUrl.searchParams.set('limit', '10')
  searchUrl.searchParams.set('access_token', token)

  const res = await fetch(searchUrl.toString())
  const data = await res.json()

  if (!res.ok || data.error) {
    const msg = data.error?.message ?? `HTTP ${res.status}`
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  type FBPlace = {
    id: string
    name: string
    location?: {
      street?: string
      city?: string
      state?: string
      zip?: string
    }
  }

  const results: VenueResult[] = ((data.data ?? []) as FBPlace[])
    .slice(0, 8)
    .map(place => ({
      id: place.id,
      name: place.name,
      address: [
        place.location?.street,
        place.location?.city,
        place.location?.state,
      ].filter(Boolean).join(', '),
    }))

  return NextResponse.json(results)
}
