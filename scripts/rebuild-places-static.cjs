#!/usr/bin/env node
/**
 * rebuild-places-static.cjs
 * Fetches all places from Supabase and writes public/places-data.json
 * Used to pre-seed the static file the app loads at boot for instant startup.
 *
 * Run: node scripts/rebuild-places-static.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let _gradIdx = 0;
const GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#fccb90,#d57eeb)',
  'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
  'linear-gradient(135deg,#fddb92,#d1fdff)',
  'linear-gradient(135deg,#96fbc4,#f9f586)',
];

function placeTypeToCategory(types, name) {
  const t = types || [];
  const n = (name || '').toLowerCase();
  if (t.includes('restaurant') || t.includes('food') || t.includes('cafe') || t.includes('bakery') || t.includes('meal_takeaway') || t.includes('meal_delivery')) return 'Food & Drink';
  if (t.includes('bar') || t.includes('night_club') || t.includes('brewery') || n.includes('brewery') || n.includes('brewpub') || n.includes('winery')) return 'Bars & Nightlife';
  if (t.includes('lodging') || t.includes('hotel') || t.includes('motel')) return 'Hotels';
  if (t.includes('shopping_mall') || t.includes('clothing_store') || t.includes('shoe_store') || t.includes('store') || t.includes('shop')) return 'Shopping';
  if (t.includes('gym') || t.includes('stadium') || t.includes('bowling_alley') || t.includes('amusement_park') || t.includes('aquarium') || t.includes('golf_course')) return 'Sports & Recreation';
  if (t.includes('museum') || t.includes('art_gallery') || t.includes('movie_theater') || t.includes('library')) return 'Arts & Culture';
  if (t.includes('park') || t.includes('campground') || t.includes('natural_feature')) return 'Parks & Outdoors';
  if (t.includes('spa') || t.includes('beauty_salon') || t.includes('hair_care')) return 'Beauty & Wellness';
  if (t.includes('hospital') || t.includes('pharmacy') || t.includes('doctor') || t.includes('dentist')) return 'Health & Medical';
  if (t.includes('school') || t.includes('university') || t.includes('library')) return 'Education';
  if (t.includes('place_of_worship') || t.includes('church') || t.includes('mosque') || t.includes('synagogue')) return 'Community';
  return 'Other';
}

function transformPlace(raw, cachedPhotoUrl, cachedThumbnailUrl, enriched) {
  if (!raw) return null;
  // Already transformed
  if ('image' in raw || 'source' in raw) {
    const place = { ...raw };
    if (enriched) {
      if (enriched.hours) place.hours = enriched.hours;
      if (enriched.phone) place.phone = enriched.phone;
      if (enriched.website) place.website = enriched.website;
    }
    return place;
  }

  const hasCachedReal = cachedPhotoUrl && cachedPhotoUrl !== 'none';
  const hasCachedThumbReal = cachedThumbnailUrl && cachedThumbnailUrl !== 'none';
  const overridePhoto = raw.overridePhoto;

  // Use cached URLs only — no Google API keys in static file
  const imageUrl = overridePhoto || (hasCachedReal ? cachedPhotoUrl : undefined);
  const thumbnailUrl = overridePhoto || (hasCachedThumbReal ? cachedThumbnailUrl : undefined) || (hasCachedReal ? cachedPhotoUrl : undefined);

  const geometry = raw.geometry;
  const types = raw.types || [];

  const place = {
    id: raw.place_id,
    name: raw.name,
    category: placeTypeToCategory(types, raw.name),
    isFeatured: false,
    description: '',
    address: raw.vicinity || '',
    lat: geometry?.location?.lat,
    lng: geometry?.location?.lng,
    image: imageUrl,
    thumbnail: thumbnailUrl,
    gradient: GRADIENTS[_gradIdx++ % GRADIENTS.length],
    rating: raw.rating,
    reviewCount: raw.user_ratings_total,
    priceLevel: raw.price_level,
    hours: undefined,
    tags: [],
    googleTypes: types,
    source: 'google_places',
  };

  if (enriched) {
    if (enriched.hours) place.hours = enriched.hours;
    if (enriched.phone) place.phone = enriched.phone;
    if (enriched.website) place.website = enriched.website;
  }

  return place;
}

async function main() {
  console.log('Fetching places from Supabase...');

  // Get total count
  const { count, error: countErr } = await sb
    .from('places')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('Count query failed:', countErr.message);
    process.exit(1);
  }

  const total = count || 0;
  console.log(`Total places in Supabase: ${total}`);

  if (total === 0) {
    console.error('No places found in Supabase! Is the database populated?');
    process.exit(1);
  }

  const PAGE = 1000;
  const pageCount = Math.ceil(total / PAGE);
  const allPlaces = [];

  for (let i = 0; i < pageCount; i++) {
    const start = i * PAGE;
    const end = (i + 1) * PAGE - 1;
    process.stdout.write(`  Fetching page ${i + 1}/${pageCount} (rows ${start}-${end})...`);

    const { data, error } = await sb
      .from('places')
      .select('raw,cached_photo_url,cached_thumbnail_url,enriched')
      .range(start, end);

    if (error) {
      console.error(`\nPage ${i + 1} failed:`, error.message);
      continue;
    }

    let pageCount2 = 0;
    for (const row of (data || [])) {
      const place = transformPlace(row.raw, row.cached_photo_url, row.cached_thumbnail_url, row.enriched);
      if (place && place.id && place.name) {
        allPlaces.push(place);
        pageCount2++;
      }
    }
    console.log(` → ${pageCount2} places`);
  }

  console.log(`\nTotal transformed: ${allPlaces.length} places`);

  const outPath = path.join(__dirname, '..', 'public', 'places-data.json');
  fs.writeFileSync(outPath, JSON.stringify(allPlaces));

  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`✓ Written to public/places-data.json (${sizeMB} MB, ${allPlaces.length} places)`);
}

main().catch(err => { console.error(err); process.exit(1); });
