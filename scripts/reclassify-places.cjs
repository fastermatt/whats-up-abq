#!/usr/bin/env node
/**
 * ABQ Unplugged — Reclassify Places & Regenerate places-data.json
 *
 * Reads all places from Supabase (raw Google Places data), applies the
 * improved placeTypeToCategory() mapping from db.ts, and writes an updated
 * public/places-data.json.
 *
 * Run after updating the category logic in db.ts / this file.
 *
 * Usage:
 *   node scripts/reclassify-places.cjs
 *   node scripts/reclassify-places.cjs --dry-run    # print stats only, don't write
 *   node scripts/reclassify-places.cjs --diff       # show which places changed category
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const PLACES_JSON = path.join(__dirname, '../public/places-data.json');
const args        = process.argv.slice(2);
const dryRun      = args.includes('--dry-run');
const showDiff    = args.includes('--diff');

// ── Read Supabase creds from source ──────────────────────────────────────────
const dbSrc  = fs.readFileSync(path.join(__dirname, '../src/lib/supabase.ts'), 'utf8');
const SB_URL = dbSrc.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
const SB_KEY = dbSrc.match(/eyJ[A-Za-z0-9._-]{20,}/)[0];
const sb     = createClient(SB_URL, SB_KEY);

const GOOGLE_KEY = (() => {
  try {
    const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
    const m = env.match(/VITE_GOOGLE_PLACES_KEY=(.+)/);
    return m ? m[1].trim() : '';
  } catch { return ''; }
})();

// ── Category mapping (keep in sync with src/lib/db.ts) ───────────────────────
function placeTypeToCategory(types = [], name = '') {
  const n = name.toLowerCase();

  if (types.includes('convenience_store') || types.includes('gas_station')) return 'shop';
  if (types.includes('fast_food') && !types.includes('cafe')) return 'restaurant';
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

  if (types.includes('park') || types.includes('campground') ||
      types.includes('hiking_area') || types.includes('natural_feature') ||
      types.includes('rv_park')) return 'park';

  if (types.includes('museum') || types.includes('library')) return 'museum';
  if (types.includes('art_gallery') || types.includes('performing_arts_theater')) return 'arts';

  if (types.includes('gym') || types.includes('spa') ||
      types.includes('sports_complex') || types.includes('fitness_center') ||
      types.includes('golf_course') || types.includes('swimming_pool') ||
      types.includes('stadium')) return 'fitness';

  if (types.includes('lodging') || types.includes('hotel') ||
      types.includes('motel') || types.includes('resort')) return 'hotel';

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

  if (types.includes('amusement_park') || types.includes('bowling_alley') ||
      types.includes('movie_theater') || types.includes('zoo') ||
      types.includes('aquarium') || types.includes('casino') ||
      types.includes('tourist_attraction')) return 'entertainment';

  // Name-based fallbacks
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
  if (n.includes('dispensary') || n.includes('cannabis') || n.includes('tattoo') ||
      n.includes(' spa') || n.includes('salon') || n.includes('barbershop') ||
      n.includes('nail '))
    return 'shop';

  return 'other';
}

function placeTypesToTags(types = [], name = '') {
  const tags = [];
  const n = name.toLowerCase();
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
let gradIdx = 0;

function transformRaw(raw) {
  if (!raw) return null;
  const photos  = raw.photos || [];
  const photo0  = photos[0]?.photo_reference;
  const override = raw.overridePhoto;

  const makeUrl = (ref, w) => ref
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${w}&photoreference=${ref}&key=${GOOGLE_KEY}`
    : undefined;

  const imageUrl    = override || makeUrl(photo0, 800);
  const thumbnailUrl = override || makeUrl(photo0, 400);
  const additionalImages = photos.slice(1, 6)
    .map(p => makeUrl(p.photo_reference, 800))
    .filter(Boolean);

  const types = raw.types || [];
  const name  = raw.name || '';

  return {
    id:               raw.place_id,
    name,
    category:         placeTypeToCategory(types, name),
    isFeatured:       false,
    description:      raw.description  || '',
    about:            raw.about        || '',
    website:          raw.website      || '',
    phone:            raw.phone        || '',
    historicNote:     raw.historicNote || '',
    insiderTip:       raw.insiderTip   || '',
    bestFor:          raw.bestFor      || [],
    priceNote:        raw.priceNote    || '',
    parkingInfo:      raw.parkingInfo  || '',
    enriched:         raw.enriched     || false,
    enrichedAt:       raw.enrichedAt   || '',
    address:          raw.vicinity     || raw.formatted_address || '',
    lat:              raw.geometry?.location?.lat,
    lng:              raw.geometry?.location?.lng,
    image:            imageUrl,
    thumbnail:        thumbnailUrl,
    additionalImages: additionalImages.length ? additionalImages : undefined,
    gradient:         GRADIENTS[gradIdx++ % GRADIENTS.length],
    rating:           raw.rating,
    reviewCount:      raw.user_ratings_total,
    priceLevel:       raw.price_level,
    hours:            raw.opening_hours?.open_now != null
                        ? (raw.opening_hours.open_now ? 'Open now' : 'Closed now')
                        : undefined,
    tags:             placeTypesToTags(types, name),
    source:           'google_places',
  };
}

async function run() {
  console.log('🗺  ABQ Unplugged — Reclassify Places');
  if (dryRun) console.log('   *** DRY RUN — no file will be written ***\n');

  // Load existing places-data.json for diff comparison
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(PLACES_JSON, 'utf8')); } catch {}
  const oldCats = {};
  existing.forEach(p => { oldCats[p.id] = p.category; });

  // Fetch all raw rows from Supabase
  console.log('Fetching from Supabase...');
  const PAGE = 1000;
  let from = 0, allRows = [];
  while (true) {
    const { data, error } = await sb.from('places').select('raw').range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    allRows = allRows.concat(data.map(r => r.raw));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Fetched ${allRows.length} raw place rows\n`);

  // Transform
  gradIdx = 0;
  const transformed = allRows.map(transformRaw).filter(Boolean);

  // Stats
  const newCats = {};
  let changed = 0;
  const diffs = [];
  for (const p of transformed) {
    newCats[p.category] = (newCats[p.category] || 0) + 1;
    const old = oldCats[p.id];
    if (old && old !== p.category) {
      changed++;
      diffs.push({ name: p.name, old, new: p.category });
    }
  }

  console.log('NEW CATEGORY BREAKDOWN:');
  for (const [c, n] of Object.entries(newCats).sort((a, b) => b[1] - a[1])) {
    const wasN = existing.filter(p => p.category === c).length;
    const delta = n - wasN;
    const sign = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '  =';
    console.log(`  ${String(n).padStart(4)}  ${c.padEnd(14)}  (${sign})`);
  }

  if (showDiff || changed > 0) {
    console.log(`\n${changed} places reclassified:`);
    for (const d of diffs.slice(0, 50)) {
      console.log(`  ${d.old.padEnd(14)} → ${d.new.padEnd(14)}  ${d.name}`);
    }
    if (diffs.length > 50) console.log(`  ... and ${diffs.length - 50} more`);
  }

  const noImage = transformed.filter(p => !p.image).length;
  console.log(`\nPlaces with no image: ${noImage}`);

  if (!dryRun) {
    fs.writeFileSync(PLACES_JSON, JSON.stringify(transformed, null, 2));
    console.log(`\n✅ Written: ${PLACES_JSON}`);
    console.log('\n💡 Next steps:');
    console.log('   git add public/places-data.json src/lib/db.ts');
    console.log('   git commit -m "fix: improved place category mapping"');
    console.log('   git push');
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
