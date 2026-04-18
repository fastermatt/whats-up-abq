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
 *   TICKETMASTER_API_KEY=xxx node scripts/fetch-data.cjs
 *
 * Or create a .env file (gitignored) with those two keys and run:
 *   node scripts/fetch-data.cjs
 *
 * Outputs:
 *   public/data/ticketmaster-events.json
 *   public/data/google-places.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
// ── Supabase client (service-role key for writes) ──
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const _sbUrl = process.env.SUPABASE_URL || '';
const _sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const _sb = (_sbUrl && _sbKey) ? createSupabaseClient(_sbUrl, _sbKey) : null;

async function _upsertEvents(source, rawArr) {
  if (!_sb || !rawArr || rawArr.length === 0) return;
  const rows = rawArr.map(raw => {
    let d = raw.dates?.start?.localDate || raw.datetime_local?.split('T')[0]
           || raw.datetime_utc?.split('T')[0] || raw.start?.local?.split('T')[0]
           || raw.date?.split('T')[0] || null;
    // Always prepend source to the raw ID. SeatGeek IDs are numeric (e.g. 18163107)
    // → stored as seatgeek_18163107. TM IDs contain letters (e.g. G5vzZ_...) → ticketmaster_G5vzZ_...
    // Never use sg- prefix — that was a historical bug that caused duplicate records.
    const rawId = raw.id || raw.event_id || raw.uid;
    const storedId = rawId
      ? source + '_' + String(rawId)
      : source + '_' + Math.random();
    return { id: storedId, source, raw, event_date: d };
  });
  const {error} = await _sb.from('events').upsert(rows, {onConflict:'id'});
  if (error) console.error('[Supabase] events error:', source, error.message);
  else console.log('[Supabase] upserted', rows.length, source, 'events');
}

async function _upsertPlaces(rawArr) {
  if (!_sb || !rawArr || rawArr.length === 0) return;
  const rows = rawArr.map(raw => ({
    id: 'google_'+(raw.place_id||raw.id||Math.random()), source:'google', raw
  }));
  const {error} = await _sb.from('places').upsert(rows, {onConflict:'id'});
  if (error) console.error('[Supabase] places error:', error.message);
  else console.log('[Supabase] upserted', rows.length, 'places');
}


// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Load .env if present Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  });
}

const TM_KEY         = process.env.TICKETMASTER_API_KEY;
const EB_TOKEN       = process.env.EVENTBRITE_TOKEN;      // optional
const SG_CLIENT_ID   = process.env.SEATGEEK_CLIENT_ID;    // optional Ã¢ÂÂ register at seatgeek.com/account/develop
const BIT_APP_ID     = process.env.BANDSINTOWN_APP_ID;    // optional Ã¢ÂÂ register at bandsintown.com/v3/api
const MEETUP_KEY     = process.env.MEETUP_API_KEY;        // optional Ã¢ÂÂ register at secure.meetup.com/meetup_api

if (!TM_KEY)     { console.error('Missing TICKETMASTER_API_KEY'); process.exit(1); }

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

// ── OG Image fetcher (shared helper) ────────────────────────────────────────
async function fetchOgImage(url) {
  try {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? require('https') : require('http');
    return await new Promise((resolve) => {
      const req = lib.request({
        hostname: parsed.hostname, path: parsed.pathname + parsed.search,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ABQUnplugged-Bot/1.0)', 'Accept': 'text/html' },
        timeout: 12000,
      }, res => {
        const chunks = []; let done = false;
        res.on('data', d => { chunks.push(d); if (Buffer.concat(chunks).length > 200000) { done = true; req.destroy(); } });
        res.on('end', () => {
          if (done && chunks.length === 0) return resolve(null);
          const body = Buffer.concat(chunks).toString('utf8');
          const m = body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                 || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
          const imgUrl = m?.[1] || null;
          resolve(imgUrl && !imgUrl.includes('placeholder') ? imgUrl : null);
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    });
  } catch { return null; }
}

async function enrichImagesFromOg(events, label) {
  const noImg = events.filter(e => (!e.images || e.images.length === 0) && e.url);
  if (!noImg.length) return;
  console.log(`  🖼️  Fetching OG images for ${noImg.length} ${label} events without photos...`);
  let found = 0;
  for (let i = 0; i < noImg.length; i += 5) {
    const batch = noImg.slice(i, i + 5);
    await Promise.all(batch.map(async ev => {
      const imgUrl = await fetchOgImage(ev.url);
      if (imgUrl) { ev.images = [{ url: imgUrl, _source: 'og' }]; found++; }
    }));
    if (i + 5 < noImg.length) await sleep(500);
  }
  console.log(`  ✓ Got OG images for ${found}/${noImg.length} events`);
}

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
  // Enforce: if TM doesn't provide localTime, store 'TBD' instead of undefined.
  // This prevents stale or guessed times from being stored.
  // Also null out literal 00:00 — no real ABQ event starts at midnight.
  for (const ev of unique) {
    const start = ev.dates?.start;
    if (start && !start.localTime) start.localTime = 'TBD';
    if (start && (start.localTime === '00:00' || start.localTime === '00:00:00')) {
      start.localTime = 'TBD';
    }
  }

  // Fix 2: Deduplicate TM events by name+date+venue before upsert
  // TM sometimes returns the same event under two different IDs (individual ticket vs season package)
  const tmSeenKey = new Set();
  const tmUnique = unique.filter(ev => {
    const name = (ev.name || '').toLowerCase().trim();
    const date = ev.dates?.start?.localDate || '';
    const venue = (ev._embedded?.venues?.[0]?.name || '').toLowerCase().trim().slice(0, 40);
    const k = `${name}|${date}|${venue}`;
    if (tmSeenKey.has(k)) return false;
    tmSeenKey.add(k);
    return true;
  });
  if (tmUnique.length < unique.length) {
    console.log(`    Deduped ${unique.length - tmUnique.length} internal TM duplicates (same name+date+venue)`);
  }

  return tmUnique;
}

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
        localTime: (() => {
          const t = start.local ? start.local.split('T')[1]?.slice(0, 5) : undefined;
          return (t === '00:00' || t === '00:00:00') ? undefined : t;
        })(),
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
    id:      String(ev.id),  // numeric SG id; _upsertEvents prepends 'seatgeek_' → seatgeek_18163107
    name:    ev.title || perf.name || 'Untitled Event',
    url:     ev.url,
    _source: 'seatgeek',
    ticketLinks: ev.url ? [{ source: 'SeatGeek', url: ev.url }] : [],

    // Use all performer images (primary + extras) for richer gallery
    images: [
      ...(perf.image ? [{ url: perf.image }] : []),
      ...(perf.images?.huge?.url ? [{ url: perf.images.huge.url }] : []),
      ...(perf.images?.banner?.url ? [{ url: perf.images.banner.url }] : []),
    ].filter((img, i, arr) => arr.findIndex(x => x.url === img.url) === i),

    dates: {
      start: {
        // Use datetime_local (local Mountain Time) — NOT datetime_utc.
        // Storing the UTC dateTime alongside localTime has caused display bugs
        // where the app accidentally renders the UTC time instead of local.
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

    // Pull description from SeatGeek's description or performer info
    info: ev.description || perf.description || perf.short_bio || undefined,

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
 * BLOCKED: Bandsintown API fully locked down — all endpoints require B2B auth.
 *
 * As of 2025, Bandsintown requires a paid B2B partnership for ALL API access.
 * Both the geographic search and artist-specific endpoints return auth errors:
 *   - /events/search?app_id=...         → "Missing Authentication Token"
 *   - /artists/{name}/events?app_id=... → "User is not authorized to access this resource"
 *
 * The BANDSINTOWN_APP_ID env var is retained as a placeholder in case B2B
 * access is obtained in the future.
 * To pursue B2B partnership: https://bandsintown.com/contact
 */
async function fetchBandsintownEvents() {
  if (!BIT_APP_ID) return [];
  console.log('\n🎸 Bandsintown: API requires B2B partnership — skipping (0 events).');
  console.log('   Both /events/search and /artists/{name}/events require auth beyond app_id.');
  return [];
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
      path:     '/gql-ext',
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

// ── Suspicious-time validator ────────────────────────────────────────────────
// Music/nightlife events before 4 PM are likely UTC times stored as local.
const EVENING_CATS_FD = new Set(['Music', 'Sports', 'Arts & Theatre', 'Comedy']);
const DAYTIME_OK_FD = /brunch|afternoon|matinee|family|kid|child|workshop|class|tour|market|farmer|craft|gallery|exhibit/i;

function checkSuspiciousTimeFD(ev) {
  const localTime = ev.dates?.start?.localTime;
  if (!localTime || localTime === 'TBD') return null;
  const h = parseInt((localTime.split(':')[0] || ''), 10);
  if (isNaN(h) || h >= 16) return null;
  const seg = ev.classifications?.[0]?.segment?.name || '';
  if (!EVENING_CATS_FD.has(seg)) return null;
  const name = ev.name || '';
  if (DAYTIME_OK_FD.test(name)) return null;
  return { name, time: localTime, seg, reason: `${localTime} is unusually early for a ${seg} event (possible UTC/local mix-up)` };
}

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
  await _upsertEvents('ticketmaster', Array.isArray(tmEvents) ? tmEvents : (tmEvents.events||[]));
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
    const sgRaw = rawSg.map(transformSeatGeekEvent);
    // Fix 3: Cross-source dedup — skip SeatGeek events where TM already has same name+date
    // TM preferred (better data: more images, structured venues, official ticket links)
    const tmEventSet = new Set(
      (Array.isArray(tmEvents) ? tmEvents : []).map(e =>
        `${(e.name||'').toLowerCase().trim()}|${e.dates?.start?.localDate||''}`
      )
    );
    const sgBeforeDedup = sgRaw.length;
    sgEvents = sgRaw.filter(ev => {
      const k = `${(ev.name||'').toLowerCase().trim()}|${ev.dates?.start?.localDate||''}`;
      return !tmEventSet.has(k);
    });
    if (sgEvents.length < sgBeforeDedup) {
      console.log(`    Cross-source dedup: removed ${sgBeforeDedup - sgEvents.length} SG events already in TM`);
    }
    // Fix 4: Null out 00:00 localTime on SG events (no event truly starts at midnight)
    for (const ev of sgEvents) {
      const t = ev.dates?.start?.localTime;
      if (t === '00:00' || t === '00:00:00') ev.dates.start.localTime = undefined;
    }
    const sgPath = path.join(__dirname, '..', 'public', 'data', 'seatgeek-events.json');
    fs.writeFileSync(sgPath, JSON.stringify(sgEvents, null, 2));
  await _upsertEvents('seatgeek', Array.isArray(sgEvents) ? sgEvents : (sgEvents.events||[]));
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
  await _upsertEvents('bandsintown', Array.isArray(bitEvents) ? bitEvents : (bitEvents.events||[]));
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
    await enrichImagesFromOg(meetupEvents, 'Meetup');
    const muPath = path.join(__dirname, '..', 'public', 'data', 'meetup-events.json');
    fs.writeFileSync(muPath, JSON.stringify(meetupEvents, null, 2));
  await _upsertEvents('meetup', Array.isArray(meetupEvents) ? meetupEvents : (meetupEvents.events||[]));
    if (MEETUP_KEY) console.log(`\nÃ¢ÂÂ Saved ${meetupEvents.length} events Ã¢ÂÂ public/data/meetup-events.json`);
    else fs.writeFileSync(muPath, '[]');
  } catch (e) {
    console.error('Meetup fetch failed:', e.message);
    const p = path.join(__dirname, '..', 'public', 'data', 'meetup-events.json');
    if (!fs.existsSync(p)) fs.writeFileSync(p, '[]');
  }

  // ── Cross-source duplicate detection ──────────────────────────────────────
  // Same venue (normalised) + same date + start times within 6h → probable dup.
  // TM takes priority over SeatGeek; SeatGeek over EB; EB over others.
  const SOURCE_PRIORITY_FD = { ticketmaster: 0, seatgeek: 1, eventbrite: 2, bandsintown: 3, meetup: 4 };
  function normVenueFD(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  function timeToMinsFD(t) {
    if (!t || t === 'TBD') return null;
    const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0);
  }

  const allCrossSource = [...tmEvents, ...sgEvents, ...ebEvents, ...bitEvents, ...meetupEvents];
  const byVenueDate = new Map();
  for (const ev of allCrossSource) {
    const v = normVenueFD(ev._embedded?.venues?.[0]?.name);
    const d = ev.dates?.start?.localDate;
    if (!v || !d) continue;
    const k = v + '|' + d;
    if (!byVenueDate.has(k)) byVenueDate.set(k, []);
    byVenueDate.get(k).push(ev);
  }

  const dupLog = [];
  const dupRemove = new Set();
  for (const [, grp] of byVenueDate) {
    if (grp.length < 2) continue;
    for (let i = 0; i < grp.length; i++) {
      for (let j = i + 1; j < grp.length; j++) {
        const a = grp[i], b = grp[j];
        if (dupRemove.has(a.id) || dupRemove.has(b.id)) continue;
        const tA = timeToMinsFD(a.dates?.start?.localTime);
        const tB = timeToMinsFD(b.dates?.start?.localTime);
        const diff = (tA !== null && tB !== null) ? Math.abs(tA - tB) : 0;
        if (diff <= 360) {
          const pA = SOURCE_PRIORITY_FD[a._source] ?? 99;
          const pB = SOURCE_PRIORITY_FD[b._source] ?? 99;
          const rem = pA <= pB ? b : a;
          dupRemove.add(rem.id);
          dupLog.push(`  Removed dup: [${rem._source}] ${rem.name} (kept ${pA <= pB ? a._source : b._source} version)`);
        }
      }
    }
  }

  // ── Validation Report ────────────────────────────────────────────────────
  const total = allCrossSource.length - dupRemove.size;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 VALIDATION REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Ticketmaster: ${tmEvents.length} events`);
  console.log(`  SeatGeek:     ${sgEvents.length} events`);
  console.log(`  Eventbrite:   ${ebEvents.length} events`);
  console.log(`  Bandsintown:  ${bitEvents.length} events`);
  console.log(`  Meetup:       ${meetupEvents.length} events`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Total (before dedup): ${allCrossSource.length}`);
  console.log(`  Duplicates removed:   ${dupRemove.size}`);
  console.log(`  ✅ Net events:        ${total}`);
  if (dupLog.length) dupLog.forEach(l => console.log(l));

  // Suspicious time check across all events
  const allForTimeCheck = [...tmEvents, ...sgEvents, ...ebEvents, ...bitEvents, ...meetupEvents];
  const suspTimes = allForTimeCheck.map(checkSuspiciousTimeFD).filter(Boolean);
  console.log(`  ⚠️  Suspicious times: ${suspTimes.length}`);
  if (suspTimes.length) {
    suspTimes.forEach(s => console.log(`     • "${s.name}" at ${s.time} [${s.seg}] — ${s.reason}`));
    console.log('     ↳ Review these manually — may be UTC stored as local');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(e => { console.error(e); process.exit(1); });
