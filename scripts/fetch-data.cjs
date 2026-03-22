#!/usr/bin/env node
/**
 * ABQ Unplugged — Data Fetcher
 *
 * Fetches events and places for the Greater ABQ Metro area:
 *   Albuquerque, Rio Rancho, Bernalillo, Cedar Crest, Tijeras,
 *   Bosque Farms, Corrales, Los Lunas (nearby), East Mountains.
 *
 * Geographic center:  35.1053° N, 106.6464° W
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

// ─── Load .env if present ────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  });
}

const TM_KEY     = process.env.TICKETMASTER_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
const EB_TOKEN   = process.env.EVENTBRITE_TOKEN; // optional — skipped if absent
const SKIP_PLACES = process.env.SKIP_PLACES === 'true';

if (!TM_KEY)     { console.error('Missing TICKETMASTER_API_KEY'); process.exit(1); }
if (!GOOGLE_KEY && !SKIP_PLACES) { console.error('Missing GOOGLE_PLACES_API_KEY (set SKIP_PLACES=true to skip places refresh)'); process.exit(1); }
if (!EB_TOKEN)   { console.warn('EVENTBRITE_TOKEN not set — skipping Eventbrite fetch'); }

// ─── Geographic Config ────────────────────────────────────────────────────────
// Greater ABQ Metro bounding box:
//   North: Bernalillo / Rio Rancho north  (~35.45°)
//   South: Bosque Farms / Los Lunas       (~34.80°)
//   East:  Cedar Crest / Tijeras          (~106.30°)
//   West:  West Rio Rancho                (~107.10°)

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// ─── Ticketmaster ─────────────────────────────────────────────────────────────
async function fetchTicketmasterEvents() {
  console.log('\n📅  Fetching Ticketmaster events for Greater ABQ Metro...');
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

  console.log(`    ✓ ${unique.length} unique events fetched`);
  return unique;
}

// ─── Google Places ────────────────────────────────────────────────────────────
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
    console.warn('    ⚠ Rate limited — sleeping 2s...');
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
  console.log('\n📍  Fetching Google Places for Greater ABQ Metro...');

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
        console.error(`    ✗ ${type}: ${e.message}`);
      }
    }
    console.log('');
  }

  console.log(`\n    ✓ ${allPlaces.length} unique places fetched`);
  return allPlaces;
}

// ─── Transform Google Place → app Place ──────────────────────────────────────
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

// ─── Eventbrite ───────────────────────────────────────────────────────────────

/**
 * Fetch public events near ABQ from the Eventbrite v3 API.
 *
 * Docs: https://www.eventbrite.com/platform/api#/reference/event/search
 *
 * Requires EVENTBRITE_TOKEN (private token or OAuth bearer token).
 * Get one at: https://www.eventbrite.com/platform/api#/introduction/authentication
 */
async function fetchEventbriteEvents() {
  if (!EB_TOKEN) return [];
  console.log('\n🎟  Fetching Eventbrite events for Greater ABQ Metro...');

  const allEvents = [];
  let pageNumber = 1;
  let hasMore    = true;

  while (hasMore && pageNumber <= 10) {
    const params = new URLSearchParams({
      'location.address':      'Albuquerque, NM',
      'location.within':       '40mi',
      'sort_by':               'date',
      'expand':                'venue,ticket_availability,logo',
      'page_size':             '50',
      'page':                  String(pageNumber),
      'start_date.range_start': new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });

    const url = `https://www.eventbriteapi.com/v3/events/search/?${params}`;

    const data = await new Promise((resolve, reject) => {
      const options = {
        headers: { Authorization: `Bearer ${EB_TOKEN}` },
      };
      https.get(url, options, res => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`Eventbrite JSON parse error: ${e.message}`)); }
        });
      }).on('error', reject);
    });

    if (data.error) {
      console.warn(`  Eventbrite API error: ${data.error_description || data.error}`);
      break;
    }

    const events = data.events || [];
    allEvents.push(...events);
    console.log(`  Page ${pageNumber}: ${events.length} events (total so far: ${allEvents.length})`);

    // Pagination
    const pagination = data.pagination || {};
    hasMore = pagination.has_more_items === true;
    pageNumber++;

    if (pageNumber <= pagination.page_count) {
      await sleep(250); // respect rate limits
    } else {
      hasMore = false;
    }
  }

  console.log(`  Eventbrite: ${allEvents.length} total events found`);
  return allEvents;
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

// Eventbrite category IDs → human-readable segment names
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== ABQ Unplugged Data Fetcher — Greater Metro Area ===');
  console.log(`Coverage: ${METRO_RADIUS_MILES}-mile radius from ABQ city center`);
  console.log(`Communities: Albuquerque, Rio Rancho, Bernalillo, Cedar Crest,`);
  console.log(`             Tijeras, Bosque Farms, Corrales, East Mountains\n`);

  ensureDir(path.join(__dirname, '..', 'public', 'data'));

  // ── Ticketmaster ──
  let tmEvents = [];
  try {
    tmEvents = await fetchTicketmasterEvents();
    const tmPath = path.join(__dirname, '..', 'public', 'data', 'ticketmaster-events.json');
    fs.writeFileSync(tmPath, JSON.stringify(tmEvents, null, 2));
    console.log(`\n✓ Saved ${tmEvents.length} events → public/data/ticketmaster-events.json`);
  } catch (e) {
    console.error('Ticketmaster fetch failed:', e.message);
  }

  // ── Eventbrite ──
  let ebEvents = [];
  try {
    const rawEb = await fetchEventbriteEvents();
    ebEvents = rawEb.map(transformEventbriteEvent);
    const ebPath = path.join(__dirname, '..', 'public', 'data', 'eventbrite-events.json');
    fs.writeFileSync(ebPath, JSON.stringify(ebEvents, null, 2));
    if (EB_TOKEN) {
      console.log(`\n✓ Saved ${ebEvents.length} events → public/data/eventbrite-events.json`);
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

  // ── Google Places ──
  let places = [];
  if (SKIP_PLACES) {
    console.log('\n⚡ Skipping Google Places refresh (SKIP_PLACES=true)');
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
      console.log(`\n✓ Saved ${rawPlaces.length} raw places → public/data/google-places.json`);

      // Transform and save app-ready version
      places = rawPlaces
        .filter(p => p.business_status !== 'CLOSED_PERMANENTLY')
        .map(transformGooglePlace);

      const appPath = path.join(__dirname, '..', 'public', 'places-data.json');
      fs.writeFileSync(appPath, JSON.stringify(places, null, 2));
      console.log(`✓ Saved ${places.length} places → public/places-data.json`);
    } catch (e) {
      console.error('Google Places fetch failed:', e.message);
    }
  }

  const totalEvents = tmEvents.length + ebEvents.length;
  console.log('\n=== Done! ===');
  console.log(`Ticketmaster: ${tmEvents.length} events`);
  console.log(`Eventbrite:   ${ebEvents.length} events`);
  console.log(`Total events: ${totalEvents}  |  Places: ${places.length}`);
  if (!process.env.CI) {
    console.log('\nNext steps:');
    console.log('  git add public/data public/places-data.json');
    console.log('  git commit -m "data: refresh for Greater ABQ Metro"');
    console.log('  git push origin main');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
