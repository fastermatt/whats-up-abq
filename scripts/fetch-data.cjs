#!/usr/bin/env node
/**
 * ABQ Unplugged Ã¢ÂÂ Data Fetcher
 *
 * Fetches events and places for the Greater ABQ Metro area:
 *   Albuquerque, Rio Rancho, Bernalillo, Cedar Crest, Tijeras,
 *   Bosque Farms, Corrales, Los Lunas (nearby), East Mountains.
 *
 * Geographic center:  35.1053ÃÂ° N, 106.6464ÃÂ° W
 * Search radius:      40 miles (covers full metro)
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=xxx TICKETMASTER_API_KEY=xxx node scripts/fetch-data.cjs
 *
 * Or create a .env file (gitignored) with those two keys and run:
 *   node scripts/fetch-data.cjs
 *
 * Outputs:
 *   public/data/ticketmaster-events.json
 *   public/data/google-places.json
 *   public/places-data.json  (merged/cleaned version used by the app)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Load .env if present Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  });
}

const TM_KEY         = process.env.TICKETMASTER_API_KEY;
const GOOGLE_KEY     = process.env.GOOGLE_PLACES_API_KEY;
const EB_TOKEN       = process.env.EVENTBRITE_TOKEN;      // optional
const SG_CLIENT_ID   = process.env.SEATGEEK_CLIENT_ID;    // optional Ã¢ÂÂ register at seatgeek.com/account/develop
const BIT_APP_ID     = process.env.BANDSINTOWN_APP_ID;    // optional Ã¢ÂÂ register at bandsintown.com/v3/api
const MEETUP_KEY     = process.env.MEETUP_API_KEY;        // optional Ã¢ÂÂ register at secure.meetup.com/meetup_api
const SKIP_PLACES    = process.env.SKIP_PLACES === 'true';

if (!TM_KEY)     { console.error('Missing TICKETMASTER_API_KEY'); process.exit(1); }
if (!GOOGLE_KEY && !SKIP_PLACES) { console.error('Missing GOOGLE_PLACES_API_KEY (set SKIP_PLACES=true to skip places)'); process.exit(1); }

// Warn for optional sources but don't fail
for (const [name, val] of [
  ['EVENTBRITE_TOKEN',    EB_TOKEN],
  ['SEATGEEK_CLIENT_ID',  SG_CLIENT_ID],
  ['BANDSINTOWN_APP_ID',  BIT_APP_ID],
  ['MEETUP_API_KEY',      MEETUP_KEY],
]) {
  if (!val) console.warn(`  [optional] ${name} not set Ã¢ÂÂ skipping that source`);
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Geographic Config Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Greater ABQ Metro bounding box:
//   North: Bernalillo / Rio Rancho north  (~35.45ÃÂ°)
//   South: Bosque Farms / Los Lunas       (~34.80ÃÂ°)
//   East:  Cedar Crest / Tijeras          (~106.30ÃÂ°)
//   West:  West Rio Rancho                (~107.10ÃÂ°)

const METRO_CENTER = { lat: 35.1053, lng: -106.6464 };
const METRO_RADIUS_MILES = 40;

// Sub-area search circles for Google Places (max radius 50 000 m each)
const PLACES_SEARCH_AREAS = [
  { name: 'Albuquerque Core',        lat: 35.0844, lng: -106.6504, radius: 22000 },
  { name: 'Rio Rancho',              lat: 35.2828, lng: -106.6630, radius: 14000 },
  { name: 'East Mountains (Cedar Crest/Tijeras)', lat: 35.1200, lng: -106.3800, radius: 12000 },
  { name: 'South Valley / Bosque Farms',          lat: 34.8900, lng: -106.6700, radius: 12000 },
  { name: 'Bernalillo / Corrales',   lat: 35.3100, lng: -106.5600, radius: 10000 },
  { name: 'North ABQ / Balloon Fiesta Park area', lat: 35.1900, lng: -106.5900, radius: 10000 },
  { name: 'West ABQ / Petroglyph area',           lat: 35.1200, lng: -106.7700, radius: 10000 },
];

// Google Places types to search for each area
const PLACES_TYPES = [
  'restaurant', 'bar', 'cafe', 'night_club',
  'museum', 'art_gallery', 'park', 'tourist_attraction',
  'shopping_mall', 'gym', 'spa', 'movie_theater',
  'bowling_alley', 'amusement_park', 'zoo', 'aquarium',
  'stadium', 'campground', 'hiking_area',
];

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Helpers Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}\nBody: ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Ticketmaster Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function fetchTicketmasterEvents() {
  console.log('\nÃ°ÂÂÂ  Fetching Ticketmaster events for Greater ABQ Metro...');
  console.log(`    Center: ${METRO_CENTER.lat}, ${METRO_CENTER.lng}  |  Radius: ${METRO_RADIUS_MILES} miles`);

  const allEvents = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages && page < 10) {  // cap at 10 pages (2 000 events)
    const url = [
      'https://app.ticketmaster.com/discovery/v2/events.json',
      `?apikey=${TM_KEY}`,
      `&latlong=${METRO_CENTER.lat},${METRO_CENTER.lng}`,
      `&radius=${METRO_RADIUS_MILES}`,
      `&unit=miles`,
      `&locale=*`,
      `&sort=date,asc`,
      `&size=200`,
      `&page=${page}`,
      // Only future events
      `&startDateTime=${new Date().toISOString().split('.')[0]}Z`,
    ].join('');

    const data = await get(url);

    if (data.fault) {
      console.error('TM API error:', data.fault.faultstring);
      break;
    }

    const page_info = data.page || {};
    totalPages = page_info.totalPages || 1;
    const events = data._embedded?.events || [];
    allEvents.push(...events);

    console.log(`    Page ${page + 1}/${totalPages}: ${events.length} events (total so far: ${allEvents.length})`);
    page++;

    if (page < totalPages) await sleep(300); // rate limit
  }

  // Deduplicate by ID
  const seen = new Set();
  const unique = allEvents.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  console.log(`    Ã¢ÂÂ ${unique.length} unique events fetched`);
  return unique;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Google Places Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function fetchGooglePlacesForArea(area, type) {
  const url = [
    'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
    `?location=${area.lat},${area.lng}`,
    `&radius=${area.radius}`,
    `&type=${type}`,
    `&key=${GOOGLE_KEY}`,
  ].join('');

  const data = await get(url);

  if (data.status === 'REQUEST_DENIED') {
    throw new Error(`Google Places API denied: ${data.error_message}`);
  }
  if (data.status === 'OVER_QUERY_LIMIT') {
    console.warn('    Ã¢ÂÂ  Rate limited Ã¢ÂÂ sleeping 2s...');
    await sleep(2000);
    return fetchGooglePlacesForArea(area, type);
  }

  const results = data.results || [];
  // Follow next_page_token up to 2 extra pages
  let nextToken = data.next_page_token;
  let extraPages = 0;
  while (nextToken && extraPages < 2) {
    await sleep(2000); // Google requires ~2s before using next_page_token
    const next = await get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextToken}&key=${GOOGLE_KEY}`
    );
    results.push(...(next.results || []));
    nextToken = next.next_page_token;
    extraPages++;
  }

  return results;
}

async function fetchAllGooglePlaces() {
  console.log('\nÃ°ÂÂÂ  Fetching Google Places for Greater ABQ Metro...');

  const allPlaces = [];
  const seenIds = new Set();

  for (const area of PLACES_SEARCH_AREAS) {
    console.log(`\n  Area: ${area.name}`);
    for (const type of PLACES_TYPES) {
      try {
        const results = await fetchGooglePlacesForArea(area, type);
        let added = 0;
        for (const p of results) {
          if (!seenIds.has(p.place_id)) {
            seenIds.add(p.place_id);
            allPlaces.push(p);
            added++;
          }
        }
        if (added > 0) process.stdout.write(`    ${type}: +${added}  `);
        await sleep(100);
      } catch (e) {
        console.error(`    Ã¢ÂÂ ${type}: ${e.message}`);
      }
    }
    console.log('');
  }

  console.log(`\n    Ã¢ÂÂ ${allPlaces.length} unique places fetched`);
  return allPlaces;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Transform Google Place Ã¢ÂÂ app Place Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
function placeTypeToCategory(types) {
  if (!types) return 'other';
  if (types.includes('restaurant') || types.includes('food')) return 'restaurant';
  if (types.includes('bar') || types.includes('night_club'))  return 'bar';
  if (types.includes('cafe'))                                  return 'coffee';
  if (types.includes('park') || types.includes('campground') || types.includes('hiking_area')) return 'park';
  if (types.includes('museum'))                                return 'museum';
  if (types.includes('art_gallery'))                           return 'arts';
  if (types.includes('gym') || types.includes('spa'))         return 'fitness';
  if (types.includes('lodging'))                               return 'hotel';
  if (types.includes('shopping_mall') || types.includes('store')) return 'shop';
  if (types.includes('stadium') || types.includes('amusement_park') ||
      types.includes('bowling_alley') || types.includes('movie_theater') ||
      types.includes('zoo') || types.includes('aquarium'))    return 'entertainment';
  if (types.includes('tourist_attraction'))                    return 'entertainment';
  return 'other';
}

function placeTypesToTags(types, name) {
  const tags = [];
  const nameLower = (name || '').toLowerCase();

  if (types.includes('park') || types.includes('campground') || types.includes('hiking_area') ||
      nameLower.includes('trail') || nameLower.includes('park') || nameLower.includes('canyon') ||
      nameLower.includes('mountain') || nameLower.includes('bosque') || nameLower.includes('petroglyph'))
    tags.push('outdoor');

  if (types.includes('museum') || types.includes('art_gallery') || types.includes('movie_theater') ||
      types.includes('bowling_alley') || nameLower.includes('theater') || nameLower.includes('theatre') ||
      nameLower.includes('cinema') || nameLower.includes('gallery'))
    tags.push('indoor');

  if (types.includes('amusement_park') || types.includes('zoo') || types.includes('aquarium') ||
      nameLower.includes('family') || nameLower.includes('children') || nameLower.includes('kid'))
    tags.push('family-friendly');

  if (nameLower.includes('dog') || nameLower.includes('paw') || nameLower.includes('leash'))
    tags.push('dog-friendly');

  if (nameLower.includes('music') || nameLower.includes('jazz') || nameLower.includes('blues') ||
      nameLower.includes('concert') || nameLower.includes('lounge'))
    tags.push('live-music');

  if (nameLower.includes('patio') || nameLower.includes('rooftop') || nameLower.includes('terrace'))
    tags.push('patio');

  return [...new Set(tags)];
}

// Gradient pool for places without images
const GRADIENTS = [
  'linear-gradient(135deg,#f97316,#ef4444)',
  'linear-gradient(135deg,#8b5cf6,#3b82f6)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#d97706)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#14b8a6,#0284c7)',
  'linear-gradient(135deg,#f97316,#84cc16)',
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
];
let gradIdx = 0;

function transformGooglePlace(raw) {
  const photo = raw.photos?.[0];
  const photoRef = photo?.photo_reference;
  const imageUrl = photoRef
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_KEY}`
    : null;

  return {
    id:          raw.place_id,
    name:        raw.name,
    category:    placeTypeToCategory(raw.types),
    isFeatured:  (raw.rating >= 4.5 && raw.user_ratings_total >= 200),
    description: '',
    address:     raw.vicinity || '',
    lat:         raw.geometry?.location?.lat,
    lng:         raw.geometry?.location?.lng,
    image:       imageUrl,
    gradient:    GRADIENTS[gradIdx++ % GRADIENTS.length],
    rating:      raw.rating,
    reviewCount: raw.user_ratings_total,
    priceLevel:  raw.price_level,
    hours:       raw.opening_hours?.open_now != null
                   ? (raw.opening_hours.open_now ? 'Open now' : 'Closed now')
                   : undefined,
    phone:       undefined,
    website:     undefined,
    tags:        placeTypesToTags(raw.types, raw.name),
    isKidFriendly:  raw.types?.includes('amusement_park') || raw.types?.includes('zoo'),
    isAccessible: undefined,
    source:      'google_places',
  };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Eventbrite Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

/**
 * DEPRECATED: Eventbrite public location-based event search was shut down
 * on December 12, 2019. The /v3/events/search/ endpoint no longer exists.
 * There is no public replacement for location-based search.
 *
 * Docs (deprecated): https://www.eventbrite.com/platform/docs/by-location
 *
 * The EVENTBRITE_TOKEN env var is kept for potential future use if Eventbrite
 * ever restores a public search API.
 */
async function fetchEventbriteEvents() {
  // NOTE: Eventbrite's public location-based event search (/v3/events/search/)
  // was deprecated and shut down on December 12, 2019. No public replacement
  // exists for searching events by city/radius. The current public API only
  // supports fetching by event ID, venue ID, or organization ID.
  // See: https://www.eventbrite.com/platform/docs/by-location
  if (EB_TOKEN) {
    console.log('\nð Eventbrite: public location search deprecated Dec 2019 â skipping.');
    console.log('   No public endpoint for location-based search. See: https://www.eventbrite.com/platform/docs/by-location');
  }
  return [];
}

/**
 * Transform a raw Eventbrite event into a normalized shape the app can merge
 * with Ticketmaster events. We keep it as a separate format with a `_source`
 * marker so the app can render it correctly.
 */
function transformEventbriteEvent(ev) {
  const venue   = ev.venue || {};
  const address = venue.address || {};
  const start   = ev.start || {};

  return {
    // Core fields matching TMEvent shape so the app can consume both
    id:       `eb-${ev.id}`,
    name:     ev.name?.text || 'Untitled Event',
    url:      ev.url,
    _source:  'eventbrite',

    images: ev.logo ? [{
      url:    ev.logo.original?.url || ev.logo.url,
      width:  ev.logo.original?.width,
      height: ev.logo.original?.height,
    }] : [],

    dates: {
      start: {
        localDate: start.local ? start.local.split('T')[0] : undefined,
        localTime: start.local ? start.local.split('T')[1]?.slice(0, 5) : undefined,
      },
    },

    _embedded: {
      venues: [{
        name:    venue.name,
        address: { line1: [address.address_1, address.address_2].filter(Boolean).join(', ') },
        city:    { name: address.city },
        location: venue.latitude ? {
          latitude:  String(venue.latitude),
          longitude: String(venue.longitude),
        } : undefined,
      }],
    },

    classifications: [{
      segment: { name: mapEventbriteCategory(ev.category_id) },
      genre:   { name: ev.subcategory_id ? `EB-${ev.subcategory_id}` : undefined },
    }],

    priceRanges: ev.ticket_availability?.minimum_ticket_price ? [{
      min:      parseFloat(ev.ticket_availability.minimum_ticket_price.major_value || '0'),
      max:      parseFloat(ev.ticket_availability.maximum_ticket_price?.major_value || '0'),
      currency: ev.ticket_availability.minimum_ticket_price.currency || 'USD',
    }] : undefined,

    isFree: ev.is_free,
  };
}

// Eventbrite category IDs Ã¢ÂÂ human-readable segment names
// Full list: https://www.eventbrite.com/platform/api#/reference/category/list/
const EB_CATEGORY_MAP = {
  '103': 'Music',
  '110': 'Sports',
  '113': 'Arts & Theatre',
  '105': 'Arts & Theatre', // performing arts
  '107': 'Arts & Theatre', // film & media
  '101': 'Business',
  '102': 'Science & Tech',
  '108': 'Holiday',
  '109': 'Family',
  '111': 'Food & Drink',
  '114': 'Community',
  '115': 'Charity',
  '116': 'Fashion',
  '117': 'Home & Lifestyle',
  '118': 'Government',
  '119': 'Spirituality',
  '120': 'School Activities',
  '199': 'Miscellaneous',
};

function mapEventbriteCategory(id) {
  return EB_CATEGORY_MAP[String(id)] || 'Miscellaneous';
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ SeatGeek Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
/**
 * Fetch events near ABQ from SeatGeek's public platform API.
 *
 * Docs: https://platform.seatgeek.com/
 * Free registration: https://seatgeek.com/account/develop
 *
 * SeatGeek aggregates inventory from many sources including AXS, Dice,
 * venue box offices, and resale marketplaces Ã¢ÂÂ catching shows that
 * Ticketmaster doesn't list.
 */
async function fetchSeatGeekEvents() {
  if (!SG_CLIENT_ID) return [];
  console.log('\nÃ°ÂÂÂ  Fetching SeatGeek events near ABQ...');

  const allEvents = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 10) {
    const params = new URLSearchParams({
      'venue.city':  'Albuquerque',
      'venue.state': 'NM',
      'sort':        'datetime_utc.asc',
      'datetime_utc.gte': new Date().toISOString(),
      'per_page':    '200',
      'page':        String(page),
      'client_id':   SG_CLIENT_ID,
    });
    const url = `https://api.seatgeek.com/2/events?${params}`;
    const data = await get(url);

    if (data.status === 'error' || !data.events) {
      console.warn(`  SeatGeek error: ${data.message || JSON.stringify(data).slice(0, 100)}`);
      break;
    }

    allEvents.push(...data.events);
    totalPages = Math.ceil((data.meta?.total || 0) / 200);
    console.log(`  Page ${page}/${totalPages}: ${data.events.length} events`);
    page++;
    if (page <= totalPages) await sleep(300);
  }

  console.log(`  SeatGeek: ${allEvents.length} total events`);
  return allEvents;
}

function transformSeatGeekEvent(ev) {
  const venue = ev.venue || {};
  const perf  = ev.performers?.[0] || {};

  return {
    id:      `sg-${ev.id}`,
    name:    ev.title || perf.name || 'Untitled Event',
    url:     ev.url,
    _source: 'seatgeek',

    images: perf.image ? [{ url: perf.image }] : [],

    dates: {
      start: {
        localDate: ev.datetime_local ? ev.datetime_local.split('T')[0] : undefined,
        localTime: ev.datetime_local ? ev.datetime_local.split('T')[1]?.slice(0, 5) : undefined,
      },
    },

    _embedded: {
      venues: [{
        name:    venue.name,
        address: { line1: venue.address },
        city:    { name: venue.city },
        location: venue.location ? {
          latitude:  String(venue.location.lat),
          longitude: String(venue.location.lon),
        } : undefined,
      }],
    },

    classifications: [{
      segment: { name: mapSeatGeekType(ev.type) },
      genre:   { name: perf.type },
    }],

    priceRanges: (ev.stats?.lowest_price || ev.stats?.average_price) ? [{
      min:      ev.stats.lowest_price  || 0,
      max:      ev.stats.highest_price || ev.stats.lowest_price || 0,
      currency: 'USD',
    }] : undefined,
  };
}

const SG_TYPE_MAP = {
  'concert':         'Music',
  'sports':          'Sports',
  'theater':         'Arts & Theatre',
  'comedy':          'Arts & Theatre',
  'classical':       'Arts & Theatre',
  'dance_performace':'Arts & Theatre',
  'opera':           'Arts & Theatre',
  'family':          'Family',
  'festival':        'Music',
};
function mapSeatGeekType(type) {
  return SG_TYPE_MAP[type] || 'Miscellaneous';
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Bandsintown Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
/**
 * Fetch music events near ABQ from Bandsintown.
 *
 * Bandsintown specializes in concert discovery, especially for smaller
 * local venues and touring acts that don't sell through Ticketmaster.
 * Common ABQ venues it covers: Sunshine Theater, El Rey, Meow Wolf,
 * Launchpad, Tractor Brewing, Low Spirits, Sister Bar, etc.
 *
 * Docs: https://bandsintown.com/api/v3 (requires free app_id registration)
 * Register: https://help.artists.bandsintown.com/en/articles/9186477-api-documentation
 */
async function fetchBandsintownEvents() {
  if (!BIT_APP_ID) return [];
  console.log('\nÃ°ÂÂÂ¸  Fetching Bandsintown events near ABQ...');

  const params = new URLSearchParams({
    app_id:   BIT_APP_ID,
    location: 'Albuquerque, NM, US',
    radius:   '40',
    per_page: '100',
    date:     'upcoming',
  });
  const url = `https://rest.bandsintown.com/events/search?${params}`;
  const data = await get(url);

  if (!Array.isArray(data)) {
    console.warn('  Bandsintown returned unexpected format');
    return [];
  }

  console.log(`  Bandsintown: ${data.length} events found`);
  return data;
}

function transformBandsintownEvent(ev) {
  const venue = ev.venue || {};
  const start = ev.datetime ? new Date(ev.datetime) : null;

  return {
    id:      `bit-${ev.id}`,
    name:    ev.title || (ev.artist?.name ? `${ev.artist.name} Live` : 'Concert'),
    url:     ev.url,
    _source: 'bandsintown',

    images: ev.artist?.image_url ? [{ url: ev.artist.image_url }] : [],

    dates: {
      start: start ? {
        localDate: start.toLocaleDateString('en-CA'), // YYYY-MM-DD
        localTime: start.toTimeString().slice(0, 5),
      } : {},
    },

    _embedded: {
      venues: [{
        name:    venue.name,
        address: { line1: venue.location },
        city:    { name: venue.city },
        location: venue.latitude ? {
          latitude:  String(venue.latitude),
          longitude: String(venue.longitude),
        } : undefined,
      }],
    },

    classifications: [{ segment: { name: 'Music' }, genre: { name: ev.artist?.genre } }],
  };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Meetup Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
/**
 * Fetch local group events near ABQ from Meetup.com.
 *
 * Meetup covers free and low-cost community events that no ticketing
 * platform carries: hiking groups, tech meetups, book clubs, language
 * exchanges, craft nights, outdoor adventures, etc.
 *
 * Docs: https://www.meetup.com/api/guide/ (GraphQL Ã¢ÂÂ no key required for
 * public events via the Open Events endpoint)
 *
 * Note: Meetup deprecated its v2 REST API. The v3 / GraphQL API requires
 * OAuth for most operations. The MEETUP_API_KEY here is an OAuth Bearer
 * token from https://secure.meetup.com/meetup_api/oauth_consumers/create
 */
async function fetchMeetupEvents() {
  if (!MEETUP_KEY) return [];
  console.log('\nÃ¢ÂÂ  Fetching Meetup events near ABQ...');

  // Meetup GraphQL endpoint
  const query = `
    query {
      results: rankedEvents(
        filter: {
          location: "Albuquerque, NM, US"
          radius: 40
          isOnline: false
          startDateRange: "${new Date().toISOString()}"
        }
        first: 200
        sort: { sortField: DATE_TIME, sortOrder: ASC }
      ) {
        edges {
          node {
            id title eventUrl dateTime
            description(truncate: 300)
            venue { name address city lat lng }
            group { name category { name } }
            going rsvpOpenDuration
            tickets { type price }
            images { id baseUrl preview }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  const data = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: 'api.meetup.com',
      path:     '/gql',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization':  `Bearer ${MEETUP_KEY}`,
      },
    };
    const req = require('https').request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  const events = data?.data?.results?.edges?.map(e => e.node) || [];
  console.log(`  Meetup: ${events.length} events found`);
  return events;
}

function transformMeetupEvent(ev) {
  const venue = ev.venue || {};
  const start = ev.dateTime ? new Date(ev.dateTime) : null;
  const ticket = ev.tickets?.[0];

  return {
    id:      `mu-${ev.id}`,
    name:    ev.title || 'Meetup Event',
    url:     ev.eventUrl,
    _source: 'meetup',

    images: ev.images?.[0] ? [{ url: `${ev.images[0].baseUrl}${ev.images[0].preview}` }] : [],

    dates: {
      start: start ? {
        localDate: start.toLocaleDateString('en-CA'),
        localTime: start.toTimeString().slice(0, 5),
      } : {},
    },

    _embedded: {
      venues: [{
        name:    venue.name || ev.group?.name,
        address: { line1: venue.address },
        city:    { name: venue.city },
        location: venue.lat ? {
          latitude:  String(venue.lat),
          longitude: String(venue.lng),
        } : undefined,
      }],
    },

    classifications: [{
      segment: { name: ev.group?.category?.name || 'Community' },
    }],

    priceRanges: ticket?.price ? [{
      min:      parseFloat(ticket.price),
      max:      parseFloat(ticket.price),
      currency: 'USD',
    }] : undefined,

    isFree: !ticket?.price || parseFloat(ticket?.price || '0') === 0,
  };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Main Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
async function main() {
  console.log('=== ABQ Unplugged Data Fetcher Ã¢ÂÂ Greater Metro Area ===');
  console.log(`Coverage: ${METRO_RADIUS_MILES}-mile radius from ABQ city center`);
  console.log(`Communities: Albuquerque, Rio Rancho, Bernalillo, Cedar Crest,`);
  console.log(`             Tijeras, Bosque Farms, Corrales, East Mountains\n`);

  ensureDir(path.join(__dirname, '..', 'public', 'data'));

  // Ã¢ÂÂÃ¢ÂÂ Ticketmaster Ã¢ÂÂÃ¢ÂÂ
  let tmEvents = [];
  try {
    tmEvents = await fetchTicketmasterEvents();
    const tmPath = path.join(__dirname, '..', 'public', 'data', 'ticketmaster-events.json');
    fs.writeFileSync(tmPath, JSON.stringify(tmEvents, null, 2));
    console.log(`\nÃ¢ÂÂ Saved ${tmEvents.length} events Ã¢ÂÂ public/data/ticketmaster-events.json`);
  } catch (e) {
    console.error('Ticketmaster fetch failed:', e.message);
  }

  // Ã¢ÂÂÃ¢ÂÂ Eventbrite Ã¢ÂÂÃ¢ÂÂ
  let ebEvents = [];
  try {
    const rawEb = await fetchEventbriteEvents();
    ebEvents = rawEb.map(transformEventbriteEvent);
    const ebPath = path.join(__dirname, '..', 'public', 'data', 'eventbrite-events.json');
    fs.writeFileSync(ebPath, JSON.stringify(ebEvents, null, 2));
    if (EB_TOKEN) {
      console.log(`\nÃ¢ÂÂ Saved ${ebEvents.length} events Ã¢ÂÂ public/data/eventbrite-events.json`);
    } else {
      // Write empty array so app fetch doesn't 404
      fs.writeFileSync(ebPath, '[]');
    }
  } catch (e) {
    console.error('Eventbrite fetch failed:', e.message);
    // Write empty array so app doesn't error on missing file
    const ebPath = path.join(__dirname, '..', 'public', 'data', 'eventbrite-events.json');
    if (!fs.existsSync(ebPath)) fs.writeFileSync(ebPath, '[]');
  }

  // Ã¢ÂÂÃ¢ÂÂ SeatGeek Ã¢ÂÂÃ¢ÂÂ
  let sgEvents = [];
  try {
    const rawSg = await fetchSeatGeekEvents();
    sgEvents = rawSg.map(transformSeatGeekEvent);
    const sgPath = path.join(__dirname, '..', 'public', 'data', 'seatgeek-events.json');
    fs.writeFileSync(sgPath, JSON.stringify(sgEvents, null, 2));
    if (SG_CLIENT_ID) console.log(`\nÃ¢ÂÂ Saved ${sgEvents.length} events Ã¢ÂÂ public/data/seatgeek-events.json`);
    else fs.writeFileSync(sgPath, '[]');
  } catch (e) {
    console.error('SeatGeek fetch failed:', e.message);
    const p = path.join(__dirname, '..', 'public', 'data', 'seatgeek-events.json');
    if (!fs.existsSync(p)) fs.writeFileSync(p, '[]');
  }

  // Ã¢ÂÂÃ¢ÂÂ Bandsintown Ã¢ÂÂÃ¢ÂÂ
  let bitEvents = [];
  try {
    const rawBit = await fetchBandsintownEvents();
    bitEvents = rawBit.map(transformBandsintownEvent);
    const bitPath = path.join(__dirname, '..', 'public', 'data', 'bandsintown-events.json');
    fs.writeFileSync(bitPath, JSON.stringify(bitEvents, null, 2));
    if (BIT_APP_ID) console.log(`\nÃ¢ÂÂ Saved ${bitEvents.length} events Ã¢ÂÂ public/data/bandsintown-events.json`);
    else fs.writeFileSync(bitPath, '[]');
  } catch (e) {
    console.error('Bandsintown fetch failed:', e.message);
    const p = path.join(__dirname, '..', 'public', 'data', 'bandsintown-events.json');
    if (!fs.existsSync(p)) fs.writeFileSync(p, '[]');
  }

  // Ã¢ÂÂÃ¢ÂÂ Meetup Ã¢ÂÂÃ¢ÂÂ
  let meetupEvents = [];
  try {
    const rawMu = await fetchMeetupEvents();
    meetupEvents = rawMu.map(transformMeetupEvent);
    const muPath = path.join(__dirname, '..', 'public', 'data', 'meetup-events.json');
    fs.writeFileSync(muPath, JSON.stringify(meetupEvents, null, 2));
    if (MEETUP_KEY) console.log(`\nÃ¢ÂÂ Saved ${meetupEvents.length} events Ã¢ÂÂ public/data/meetup-events.json`);
    else fs.writeFileSync(muPath, '[]');
  } catch (e) {
    console.error('Meetup fetch failed:', e.message);
    const p = path.join(__dirname, '..', 'public', 'data', 'meetup-events.json');
    if (!fs.existsSync(p)) fs.writeFileSync(p, '[]');
  }

  // Ã¢ÂÂÃ¢ÂÂ Google Places Ã¢ÂÂÃ¢ÂÂ
  let places = [];
  if (SKIP_PLACES) {
    console.log('\nÃ¢ÂÂ¡ Skipping Google Places refresh (SKIP_PLACES=true)');
    // Load existing places if available
    const appPath = path.join(__dirname, '..', 'public', 'places-data.json');
    if (fs.existsSync(appPath)) {
      try { places = JSON.parse(fs.readFileSync(appPath, 'utf8')); } catch {}
    }
  } else {
    try {
      const rawPlaces = await fetchAllGooglePlaces();

      // Save raw data
      const rawPath = path.join(__dirname, '..', 'public', 'data', 'google-places.json');
      fs.writeFileSync(rawPath, JSON.stringify(rawPlaces, null, 2));
      console.log(`\nÃ¢ÂÂ Saved ${rawPlaces.length} raw places Ã¢ÂÂ public/data/google-places.json`);

      // Transform and save app-ready version
      places = rawPlaces
        .filter(p => p.business_status !== 'CLOSED_PERMANENTLY')
        .map(transformGooglePlace);

      const appPath = path.join(__dirname, '..', 'public', 'places-data.json');
      fs.writeFileSync(appPath, JSON.stringify(places, null, 2));
      console.log(`Ã¢ÂÂ Saved ${places.length} places Ã¢ÂÂ public/places-data.json`);
    } catch (e) {
      console.error('Google Places fetch failed:', e.message);
    }
  }

  const totalEvents = tmEvents.length + ebEvents.length + sgEvents.length + bitEvents.length + meetupEvents.length;
  console.log('\n=== Done! ===');
  console.log(`Ticketmaster: ${tmEvents.length} events`);
  console.log(`Eventbrite:   ${ebEvents.length} events`);
  console.log(`SeatGeek:     ${sgEvents.length} events`);
  console.log(`Bandsintown:  ${bitEvents.length} events`);
  console.log(`Meetup:       ${meetupEvents.length} events`);
  console.log(`Total events: ${totalEvents}  |  Places: ${places.length}`);
  if (!process.env.CI) {
    console.log('\nNext steps:');
    console.log('  git add public/data public/places-data.json');
    console.log('  git commit -m "data: refresh for Greater ABQ Metro"');
    console.log('  git push origin main');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
