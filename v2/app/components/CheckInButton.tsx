'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { CheckCircle2, MapPin, Loader2, Navigation } from 'lucide-react'

// ── Geo helpers ──────────────────────────────────────────────────────────────

/** Haversine distance in kilometres between two lat/lng pairs. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Max distance (miles) from venue centre to allow a check-in.
 *  ~0.31 mi ≈ 500 m — covers GPS drift in large venues, rooftop patios, adjacent parking. */
const MAX_MILES = 0.31

/** Geocode a venue name + optional address via Nominatim (OSM, free, no key). */
async function geocodeVenue(venueName: string, venueAddress: string | null): Promise<{ lat: number; lng: number } | null> {
  const queries = [
    [venueName, venueAddress, 'Albuquerque, NM'].filter(Boolean).join(', '),
    `${venueName}, Albuquerque, NM`,
    venueAddress ? `${venueAddress}, Albuquerque, NM` : null,
  ].filter((q): q is string => !!q)

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ABQ Unplugged (abqunplugged.com)' },
      })
      const data = (await res.json()) as Array<{ lat: string; lon: string }>
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      }
    } catch {
      // try next query form
    }
  }
  return null
}

/** Get browser geolocation — resolves with coords or null on error/denial. */
function getBrowserLocation(): Promise<GeolocationCoordinates | null> {
  return new Promise((resolve) => {
    if (!navigator?.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { timeout: 12000, maximumAge: 60000, enableHighAccuracy: true },
    )
  })
}

// ── Badge helper ─────────────────────────────────────────────────────────────

async function awardBadges(supabase: SupabaseClient, userId: string) {
  try {
    const [{ data: profile }, { data: checkIns }] = await Promise.all([
      supabase.from('profiles').select('badges, events_attended').eq('id', userId).single(),
      supabase.from('check_ins').select('event_id, category, event_date').eq('user_id', userId),
    ])

    const earned: string[] = (profile?.badges as string[]) ?? []
    const totalCheckins = checkIns?.length ?? 0
    const uniqueVenues = new Set(checkIns?.map(c => c.event_id)).size
    const musicEvents = checkIns?.filter(c => c.category === 'Music').length ?? 0
    const comedyEvents = checkIns?.filter(c => c.category === 'Comedy').length ?? 0
    const outdoorEvents = checkIns?.filter(c => c.category === 'Outdoor').length ?? 0

    const toAdd: string[] = []
    if (totalCheckins >= 1  && !earned.includes('first_checkin'))    toAdd.push('first_checkin')
    if (totalCheckins >= 5  && !earned.includes('five_checkins'))    toAdd.push('five_checkins')
    if (totalCheckins >= 10 && !earned.includes('ten_checkins'))     toAdd.push('ten_checkins')
    if (uniqueVenues >= 5   && !earned.includes('burqueno'))         toAdd.push('burqueno')
    if (musicEvents >= 5    && !earned.includes('music_lover'))      toAdd.push('music_lover')
    if (comedyEvents >= 3   && !earned.includes('comedy_buff'))      toAdd.push('comedy_buff')
    if (outdoorEvents >= 3  && !earned.includes('outdoor_explorer')) toAdd.push('outdoor_explorer')

    if (toAdd.length > 0) {
      await supabase
        .from('profiles')
        .update({ badges: [...earned, ...toAdd], events_attended: totalCheckins })
        .eq('id', userId)
    }
  } catch {
    // Non-critical — don't fail the check-in
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type GeoState =
  | 'idle'
  | 'verifying'   // requesting location + geocoding
  | 'confirm'     // geo passed, show "Yes, I'm here!"
  | 'too_far'     // user is too far from venue
  | 'geo_denied'  // location access denied
  | 'submitting'
  | 'done'

interface Props {
  eventId: string
  eventName: string
  eventDate: string | null
  venueName?: string | null
  venueAddress?: string | null
}

export function CheckInButton({ eventId, eventName, eventDate, venueName, venueAddress }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [geoState, setGeoState] = useState<GeoState>('idle')
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      if (!u) { setLoaded(true); return }

      const { data } = await supabase
        .from('check_ins')
        .select('id')
        .eq('user_id', u.id)
        .eq('event_id', eventId)
        .maybeSingle()

      setCheckedIn(!!data)
      setLoaded(true)
    }
    init()
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!loaded) return null

  // Only show if event is today or within the past 2 days
  const today = new Date().toISOString().slice(0, 10)
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
  if (eventDate && eventDate > today) return null
  if (eventDate && eventDate < twoDaysAgo) return null

  if (checkedIn) {
    return (
      <div className="flex items-center gap-2 text-[#4f6249]">
        <CheckCircle2 className="w-4 h-4 fill-[#4f6249] text-white" />
        <span className="text-xs font-semibold">Checked in!</span>
      </div>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleCheckInTap() {
    if (!user) { router.push(`/login?next=/events/${eventId}`); return }

    // If we have no venue info, skip geo and go straight to confirm
    if (!venueName && !venueAddress) {
      setGeoState('confirm')
      return
    }

    setGeoState('verifying')
    setDistanceMiles(null)

    // Step 1: get user's location
    const coords = await getBrowserLocation()

    if (!coords) {
      // Could be denied or unsupported — degrade gracefully
      setGeoState('geo_denied')
      setTimeout(() => setGeoState('idle'), 4000)
      return
    }

    // Step 2: geocode the venue
    const venueCoords = await geocodeVenue(venueName ?? '', venueAddress ?? null)

    if (!venueCoords) {
      // Can't find venue — allow check-in (don't punish for bad data)
      setGeoState('confirm')
      return
    }

    // Step 3: check distance
    const km = haversineKm(coords.latitude, coords.longitude, venueCoords.lat, venueCoords.lng)
    const miles = km * 0.621371
    setDistanceMiles(miles)

    if (miles <= MAX_MILES) {
      setGeoState('confirm')
    } else {
      setGeoState('too_far')
      setTimeout(() => {
        setGeoState('idle')
        setDistanceMiles(null)
      }, 4000)
    }
  }

  async function handleConfirm() {
    if (!user) return
    setGeoState('submitting')

    await supabase.from('check_ins').upsert({
      user_id: user.id,
      event_id: eventId,
      event_name: eventName,
      event_date: eventDate,
    }, { onConflict: 'user_id,event_id' })

    await awardBadges(supabase, user.id)

    setGeoState('done')
    setCheckedIn(true)
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (geoState === 'verifying') {
    return (
      <div className="flex items-center gap-2 text-[#6b5d57]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="text-xs">Getting your location…</span>
      </div>
    )
  }

  if (geoState === 'too_far') {
    const displayDist =
      distanceMiles == null ? '' :
      distanceMiles >= 0.1 ? ` (${distanceMiles.toFixed(1)} mi away)` :
      ` (about ${Math.round(distanceMiles * 5280)} ft away)`

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[#9a442d]">
          <Navigation className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Get a little closer to check in{displayDist}</span>
        </div>
        <p className="text-[10px] text-[#6b5d57]">You need to be at the venue to check in.</p>
      </div>
    )
  }

  if (geoState === 'geo_denied') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[#6b5d57]">
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Location access needed</span>
        </div>
        <p className="text-[10px] text-[#6b5d57]">Enable location services to verify you&apos;re at the event.</p>
      </div>
    )
  }

  if (geoState === 'confirm' || geoState === 'submitting') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleConfirm}
          disabled={geoState === 'submitting'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4f6249] text-white text-xs font-semibold hover:bg-[#3d4e38] transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {geoState === 'submitting' ? 'Checking in…' : "Yes, I'm here!"}
        </button>
        {geoState !== 'submitting' && (
          <button
            onClick={() => setGeoState('idle')}
            className="text-xs text-[#6b5d57] hover:text-[#4a3f3a]"
          >
            Cancel
          </button>
        )}
      </div>
    )
  }

  // idle (default)
  return (
    <button
      onClick={handleCheckInTap}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#ddc9a3] bg-white text-xs font-semibold text-[#4a3f3a] hover:border-[#4f6249] hover:text-[#4f6249] transition-all"
    >
      <MapPin className="w-3.5 h-3.5" />
      Check in
    </button>
  )
}
