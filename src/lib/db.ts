import { supabase } from './supabase';

const GOOGLE_KEY = 'AIzaSyDn-W5LqhBBAK2VaZhORgRW8oQagpCVq6k';

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

function transformGoogleRaw(raw: Record<string, unknown>): Record<string, unknown> {
  // Already transformed (has our custom fields)
  if ('image' in raw || 'source' in raw) return raw;

  const photos = raw.photos as Array<{ photo_reference: string }> | undefined;
  const photoRef = photos?.[0]?.photo_reference;
  const imageUrl = photoRef
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_KEY}`
    : undefined;

  const geometry = raw.geometry as { location?: { lat: number; lng: number } } | undefined;
  const openingHours = raw.opening_hours as { open_now?: boolean } | undefined;

  return {
    id: raw.place_id,
    name: raw.name,
    category: 'place',
    isFeatured: false,
    description: '',
    address: raw.vicinity || '',
    lat: geometry?.location?.lat,
    lng: geometry?.location?.lng,
    image: imageUrl,
    gradient: GRADIENTS[_gradIdx++ % GRADIENTS.length],
    rating: raw.rating,
    reviewCount: raw.user_ratings_total,
    priceLevel: raw.price_level,
    hours: openingHours?.open_now != null
      ? (openingHours.open_now ? 'Open now' : 'Closed now')
      : undefined,
    tags: [],
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
  // Paginate to get all places past Supabase's 1000-row default limit
  const PAGE = 1000;
  let allRows: unknown[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('places')
      .select('raw')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    allRows = allRows.concat(
      rows.map((row: { raw: unknown }) => {
        const raw = row.raw as Record<string, unknown>;
        return transformGoogleRaw(raw);
      })
    );
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return allRows;
}
