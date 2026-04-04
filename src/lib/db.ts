import { supabase } from './supabase';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;
if (!GOOGLE_KEY) throw new Error('VITE_GOOGLE_PLACES_KEY is not set');

function placeTypeToCategory(types: string[], name = ''): string {
  if (!types) return 'other';
  const n = name.toLowerCase();

  // ── Drinks / Food ────────────────────────────────────────────────────────
  // Convenience / gas wins over everything — Google also gives them 'cafe'
  if (types.includes('convenience_store') || types.includes('gas_station')) return 'shop';
  if (types.includes('fast_food') && !types.includes('cafe')) return 'restaurant';

  // Coffee: exact type OR (cafe type AND name reads like a coffee brand)
  const COFFEE_NAMES = ['coffee', 'cafe', 'café', 'espresso', 'roast', 'brew', 'java',
    'starbucks', "dunkin'", 'dunkin ', 'bean', 'grind', 'roasters', 'barista',
    'latte', 'cappuccino', 'grounds', 'drip', 'percolat'];
  const isCoffeeName = COFFEE_NAMES.some(w => n.includes(w));
  if (types.includes('coffee_shop') || (types.includes('cafe') && isCoffeeName)) return 'coffee';

  if (types.includes('restaurant') || types.includes('food') ||
      types.includes('cafe') || types.includes('fast_food') || types.includes('bakery') ||
      types.includes('meal_takeaway') || types.includes('meal_delivery')) return 'restaurant';
  if (types.includes('bar') || types.includes('night_club') ||
      types.includes('brewery') || types.includes('liquor_store')) return 'bar';

  // ── Outdoors ─────────────────────────────────────────────────────────────
  if (types.includes('park') || types.includes('campground') ||
      types.includes('hiking_area') || types.includes('natural_feature') ||
      types.includes('rv_park')) return 'park';

  // ── Culture ──────────────────────────────────────────────────────────────
  if (types.includes('museum') || types.includes('library')) return 'museum';
  if (types.includes('art_gallery') || types.includes('performing_arts_theater')) return 'arts';

  // ── Wellness (spas, salons) — check BEFORE generic 'health' because med spas
  //    and beauty-focused health studios carry both 'spa' and 'health' types ───
  if (types.includes('spa') || types.includes('beauty_salon') ||
      types.includes('hair_care')) return 'wellness';

  // ── Fitness (gyms, sports) — check BEFORE generic 'health' because gyms
  //    commonly carry 'gym' + 'health' together ──────────────────────────────
  if (types.includes('gym') || types.includes('fitness_center') ||
      types.includes('sports_complex') || types.includes('swimming_pool') ||
      types.includes('golf_course') || types.includes('stadium')) return 'fitness';

  // ── Health/Medical — only reaches here if not a spa or gym ───────────────
  if (types.includes('dentist') || types.includes('doctor') ||
      types.includes('hospital') || types.includes('health') ||
      types.includes('veterinary_care') || types.includes('physiotherapist') ||
      types.includes('pharmacy')) return 'other';

  // ── Stays ────────────────────────────────────────────────────────────────
  if (types.includes('lodging') || types.includes('hotel') ||
      types.includes('motel') || types.includes('resort')) return 'hotel';

  // ── Name-priority fitness / wellness (before shopping, so "Yoga Studio" tagged
  //    as 'store' by Google still lands in the right category) ──────────────
  if (n.includes('yoga') || n.includes('pilates') || n.includes('crossfit') ||
      n.includes('martial art') || n.includes('boxing') || n.includes('aquatic') ||
      n.includes('swim school') || n.includes('athletic club'))
    return 'fitness';
  if (n.includes('med spa') || n.includes('medspa') || n.includes('aesthetics') ||
      n.includes('esthetics') || n.includes('laser') || n.includes('botox') ||
      n.includes('rejuvenat'))
    return 'wellness';

  // ── Shopping ─────────────────────────────────────────────────────────────
  if (types.includes('shopping_mall') || types.includes('store') ||
      types.includes('clothing_store') || types.includes('shoe_store') ||
      types.includes('electronics_store') || types.includes('book_store') ||
      types.includes('jewelry_store') || types.includes('furniture_store') ||
      types.includes('home_goods_store') || types.includes('hardware_store') ||
      types.includes('car_dealer') || types.includes('bicycle_store') ||
      types.includes('pet_store') || types.includes('florist') ||
      types.includes('supermarket') || types.includes('convenience_store') ||
      types.includes('department_store') || types.includes('pharmacy') ||
      types.includes('gift_shop')) return 'shop';

  // ── Entertainment ─────────────────────────────────────────────────────────
  if (types.includes('amusement_park') || types.includes('bowling_alley') ||
      types.includes('movie_theater') || types.includes('zoo') ||
      types.includes('aquarium') || types.includes('casino') ||
      types.includes('tourist_attraction')) return 'entertainment';

  // ── Name-based fallbacks (catches things Google under-types) ─────────────
  if (n.includes('theater') || n.includes('theatre') || n.includes('auditorium') ||
      n.includes('cinema') || n.includes('comedy') || n.includes('fun center') ||
      n.includes('escape room') || n.includes('bowling') || n.includes('arcade'))
    return 'entertainment';
  if (n.includes('gallery') || n.includes('studio') || n.includes('art ') ||
      n.includes('dance') || n.includes(' arts') || n.includes('music school') ||
      n.includes('pottery') || n.includes('ceramic'))
    return 'arts';
  if (n.includes('golf') || n.includes('crossfit') || n.includes('yoga') ||
      n.includes('pilates') || n.includes('martial art') || n.includes('boxing') ||
      n.includes('swim') || n.includes('aquatic') || n.includes('athletic'))
    return 'fitness';
  if (n.includes('library') || n.includes('historical') || n.includes('heritage') ||
      n.includes('history') || n.includes('science center') || n.includes('planetarium'))
    return 'museum';
  if (n.includes(' spa') || n.includes('salon') || n.includes('barbershop') ||
      n.includes('nail ') || n.includes('massage') || n.includes('wellness'))
    return 'wellness';
  if (n.includes('dispensary') || n.includes('cannabis') || n.includes('tattoo'))
    return 'shop';

  return 'other';
}

function placeTypesToTags(types: string[], name: string): string[] {
  const tags: string[] = [];
  const n = (name || '').toLowerCase();
  if (types.includes('park') || types.includes('campground') || types.includes('hiking_area') ||
      n.includes('trail') || n.includes('park') || n.includes('canyon') ||
      n.includes('mountain') || n.includes('bosque') || n.includes('petroglyph'))
    tags.push('outdoor');
  if (types.includes('museum') || types.includes('art_gallery') || types.includes('movie_theater') ||
      types.includes('bowling_alley') || n.includes('theater') || n.includes('theatre') ||
      n.includes('cinema') || n.includes('gallery'))
    tags.push('indoor');
  if (types.includes('amusement_park') || types.includes('zoo') || types.includes('aquarium') ||
      n.includes('family') || n.includes('children') || n.includes('kid'))
    tags.push('family-friendly');
  if (n.includes('dog') || n.includes('paw') || n.includes('leash')) tags.push('dog-friendly');
  if (n.includes('music') || n.includes('jazz') || n.includes('blues') ||
      n.includes('concert') || n.includes('lounge')) tags.push('live-music');
  if (n.includes('patio') || n.includes('rooftop') || n.includes('terrace')) tags.push('patio');
  return [...new Set(tags)];
}

const GRADIENTS = [
  'linear-gradient(135deg,#a03b00,#c4622d)',
  'linear-gradient(135deg,#1a3a2a,#2d6a4f)',
  'linear-gradient(135deg,#2c1654,#6b3fa0)',
  'linear-gradient(135deg,#1a2a4a,#2d4f8a)',
  'linear-gradient(135deg,#4a1a2a,#8a2d4f)',
  'linear-gradient(135deg,#0d3b2e,#1a7a5a)',
  'linear-gradient(135deg,#3b2a0d,#7a5a1a)',
  'linear-gradient(135deg,#14b8a6,#0284c7)',
  'linear-gradient(135deg,#f97316,#84cc16)',
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
];
let _gradIdx = 0;

function transformGoogleRaw(
  raw: Record<string, unknown>,
  cachedPhotoUrl?: string | null,
  cachedThumbnailUrl?: string | null,
): Record<string, unknown> {
  // Already transformed (has our custom fields)
  if ('image' in raw || 'source' in raw) return raw;

  const photos = raw.photos as Array<{ photo_reference: string }> | undefined;
  const photoRef = photos?.[0]?.photo_reference;
  // Admin-set photo override takes precedence over everything
  const overridePhoto = raw.overridePhoto as string | undefined;
  // 'none' means the photo was checked and is unavailable — don't hit Google API
  const hasCachedReal = cachedPhotoUrl && cachedPhotoUrl !== 'none';
  const hasCachedThumbReal = cachedThumbnailUrl && cachedThumbnailUrl !== 'none';
  const photoExpired = cachedPhotoUrl === 'none';
  // Priority: overridePhoto > cached Supabase Storage URL > Google API URL (only if not expired)
  const imageUrl = overridePhoto
    || (hasCachedReal ? cachedPhotoUrl : undefined)
    || (!photoExpired && photoRef
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_KEY}`
      : undefined);
  const thumbnailUrl = overridePhoto
    || (hasCachedThumbReal ? cachedThumbnailUrl : undefined)
    || (hasCachedReal ? cachedPhotoUrl : undefined)
    || (!photoExpired && photoRef
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${GOOGLE_KEY}`
      : undefined);
  // Additional photos — only fall back to Google API if no cached main photo and not expired
  const additionalImages = (!cachedPhotoUrl && !overridePhoto && !photoExpired)
    ? photos?.slice(1, 6).map(
        p => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${GOOGLE_KEY}`
      )
    : undefined;

  const geometry = raw.geometry as { location?: { lat: number; lng: number } } | undefined;
  const openingHours = raw.opening_hours as { open_now?: boolean } | undefined;

  const types = (raw.types as string[]) || [];
  return {
    id: raw.place_id,
    name: raw.name,
    category: placeTypeToCategory(types, raw.name as string),
    isFeatured: false,
    description: '',
    address: raw.vicinity || '',
    lat: geometry?.location?.lat,
    lng: geometry?.location?.lng,
    image: imageUrl,
    thumbnail: thumbnailUrl,
    additionalImages: additionalImages?.length ? additionalImages : undefined,
    gradient: GRADIENTS[_gradIdx++ % GRADIENTS.length],
    rating: raw.rating,
    reviewCount: raw.user_ratings_total,
    priceLevel: raw.price_level,
    // Note: Google Nearby Search only returns a snapshot `open_now` boolean,
    // not actual hours. Showing stale "Open now"/"Closed now" is misleading.
    // Real hours come from enriched data (loaded on detail modal open).
    hours: undefined,
    tags: placeTypesToTags(types, raw.name as string),
    googleTypes: types,
    source: 'google_places',
  };
}

export async function fetchEventsFromDB(): Promise<Record<string, unknown[]>> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('source, raw')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(2000);
  if (error) throw error;
  const result: Record<string, unknown[]> = {};
  for (const row of (data ?? [])) {
    const src = (row as { source: string; raw: unknown }).source;
    const raw = (row as { source: string; raw: unknown }).raw;
    if (!result[src]) result[src] = [];
    result[src].push(raw);
  }
  return result;
}

export async function fetchPlacesFromDB(): Promise<unknown[]> {
  const PAGE = 1000;

  // Get the total row count — use the Content-Range header value
  const { count, error: countErr } = await supabase
    .from('places')
    .select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;

  const total = count ?? 0;
  if (total === 0) return [];

  const pageCount = Math.ceil(total / PAGE);

  // Fire all page fetches concurrently. Exclude `enriched`/`hide_enriched` from
  // the initial load — they are large and cause statement timeouts when 5 queries
  // hit the DB simultaneously. Enriched data is fetched on demand in the detail modal.
  // Use Promise.allSettled so a single failing page doesn't wipe out all results.
  const pageResults = await Promise.allSettled(
    Array.from({ length: pageCount }, (_, i) =>
      supabase
        .from('places')
        .select('raw,cached_photo_url,cached_thumbnail_url')
        .range(i * PAGE, (i + 1) * PAGE - 1)
    )
  );

  const allRows: unknown[] = [];
  for (const result of pageResults) {
    if (result.status === 'rejected') {
      console.warn('[fetchPlacesFromDB] A page fetch was rejected:', result.reason);
      continue;
    }
    const { data, error } = result.value;
    if (error) {
      console.warn('[fetchPlacesFromDB] A page returned an error:', error.message);
      continue;
    }
    for (const row of (data ?? [])) {
      const typed = row as { raw: Record<string, unknown>; cached_photo_url?: string; cached_thumbnail_url?: string };
      const place = transformGoogleRaw(typed.raw, typed.cached_photo_url, typed.cached_thumbnail_url);
      allRows.push(place);
    }
  }

  return allRows;
}

/**
 * Server-side search using Postgres full-text + fuzzy matching.
 * Returns transformed Place objects ready for the UI.
 */
export async function searchPlacesFromDB(query: string, limit = 50): Promise<unknown[]> {
  const { data, error } = await supabase.rpc('search_places', {
    query,
    result_limit: limit,
  });
  if (error) {
    console.warn('Server search failed, falling back to client-side:', error.message);
    return [];
  }
  return (data ?? []).map((row: { raw: Record<string, unknown>; enriched?: Record<string, unknown>; hide_enriched?: boolean; cached_photo_url?: string; cached_thumbnail_url?: string }) => {
    const place = transformGoogleRaw(row.raw, row.cached_photo_url, row.cached_thumbnail_url);
    if (row.enriched) (place as Record<string, unknown>)._enriched = row.enriched;
    if (row.hide_enriched) (place as Record<string, unknown>)._hideEnriched = true;
    return place;
  });
}
