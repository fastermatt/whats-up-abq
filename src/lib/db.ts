import { supabase } from './supabase';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string;
if (!GOOGLE_KEY) throw new Error('VITE_GOOGLE_PLACES_KEY is not set');

function placeTypeToCategory(types: string[]): string {
  if (!types) return 'other';
  if (types.includes('cafe')) return 'coffee';
  if (types.includes('restaurant') || types.includes('food')) return 'restaurant';
  if (types.includes('bar') || types.includes('night_club')) return 'bar';
  if (types.includes('park') || types.includes('campground') || types.includes('hiking_area')) return 'park';
  if (types.includes('museum')) return 'museum';
  if (types.includes('art_gallery')) return 'arts';
  if (types.includes('gym') || types.includes('spa')) return 'fitness';
  if (types.includes('lodging')) return 'hotel';
  if (types.includes('shopping_mall') || types.includes('store')) return 'shop';
  if (types.includes('stadium') || types.includes('amusement_park') || types.includes('bowling_alley') ||
      types.includes('movie_theater') || types.includes('zoo') || types.includes('aquarium') ||
      types.includes('tourist_attraction')) return 'entertainment';
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

function transformGoogleRaw(raw: Record<string, unknown>): Record<string, unknown> {
  // Already transformed (has our custom fields)
  if ('image' in raw || 'source' in raw) return raw;

  const photos = raw.photos as Array<{ photo_reference: string }> | undefined;
  const photoRef = photos?.[0]?.photo_reference;
  // Full-res image for detail modal hero
  const imageUrl = photoRef
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_KEY}`
    : undefined;
  // Smaller thumbnail for list cards (saves ~60% bandwidth)
  const thumbnailUrl = photoRef
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${GOOGLE_KEY}`
    : undefined;
  // Up to 5 additional photos for gallery (6 total)
  const additionalImages = photos?.slice(1, 6).map(
    p => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${GOOGLE_KEY}`
  );

  const geometry = raw.geometry as { location?: { lat: number; lng: number } } | undefined;
  const openingHours = raw.opening_hours as { open_now?: boolean } | undefined;

  const types = (raw.types as string[]) || [];
  return {
    id: raw.place_id,
    name: raw.name,
    category: placeTypeToCategory(types),
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
    hours: openingHours?.open_now != null
      ? (openingHours.open_now ? 'Open now' : 'Closed now')
      : undefined,
    tags: placeTypesToTags(types, raw.name as string),
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
