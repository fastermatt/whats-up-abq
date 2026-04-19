#!/usr/bin/env node
/**
 * ABQ Unplugged — Local Event Source Scrapers
 *
 * Fetches events from ABQ-specific sources that don't have mainstream APIs:
 *   • Eventbrite (JSON-LD from their public event pages — no API key needed)
 *   • Do505     (WordPress Events Calendar REST API — no API key needed)
 *   • ABQToDo.com (WordPress Events Calendar REST API)
 *
 * Usage:
 *   node scripts/fetch-local-events.cjs
 *
 * Env vars (all optional with hardcoded fallbacks for local dev):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

'use strict';

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { URL } = require('url');

// Load .env files before Supabase init (scripts/.env has SERVICE_ROLE_KEY)
for (const _envFile of [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
]) {
  if (fs.existsSync(_envFile)) {
    fs.readFileSync(_envFile, 'utf8').split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    });
  }
}

// ── Supabase ─────────────────────────────────────────────────────────────────
let _sb = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  const _sbUrl = process.env.SUPABASE_URL
              || process.env.VITE_SUPABASE_URL
              || 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
  const _sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
              || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
              || process.env.VITE_SUPABASE_ANON_KEY
              || '';
  _sb = createClient(_sbUrl, _sbKey);
} catch (e) { console.warn('[Supabase] init error:', e.message); }

// ── HTTP helper ───────────────────────────────────────────────────────────────
function fetchUrl(urlStr, opts = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 4) return reject(new Error('Too many redirects'));
    const parsed  = new URL(urlStr);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method:   'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ABQUnplugged-Bot/1.0; +https://abqunplugged.com)',
        'Accept':     opts.accept || 'text/html,application/json,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 20000,
    };
    const req = lib.request(options, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
        return fetchUrl(loc, opts, redirectCount + 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── OG Image fetcher ─────────────────────────────────────────────────────────
// For events with no image from the source API, fetch og:image from the event
// page URL. Every Do505, ABQToDo, and Eventbrite page has one for social sharing.
async function fetchOgImage(url) {
  try {
    const { status, body } = await fetchUrl(url);
    if (status !== 200) return null;
    // Try both property-first and content-first attribute orderings
    const m = body.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
           || body.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
           || body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    const imgUrl = m?.[1] || null;
    // Ignore generic placeholder / tracking pixel URLs
    if (!imgUrl || imgUrl.includes('placeholder') || imgUrl.includes('1x1')) return null;
    return imgUrl;
  } catch {
    return null;
  }
}

// Generic image filenames that the WP API returns as placeholders/banners rather
// than actual event-specific photos. We treat these as "missing" and try OG instead.
const GENERIC_IMAGE_PATTERNS = [
  'banner', 'default', 'placeholder', 'logo', 'header', 'thumbnail',
  'featured-image', 'no-image', 'noimage', 'event-default',
];
function isGenericImage(url) {
  if (!url) return true;
  const lc = url.toLowerCase().split('?')[0].split('/').pop() || '';
  return GENERIC_IMAGE_PATTERNS.some(p => lc.includes(p));
}

// After building an events array, fetch og:image for events still missing photos
// OR whose WP API image looks like a generic placeholder/banner.
// Runs concurrently in small batches to stay polite but not too slow.
async function enrichImagesFromOg(events, label) {
  const noImg = events.filter(e => {
    if (!e.url) return false;
    if (!e.images || e.images.length === 0) return true;
    // Also re-fetch if the image looks like a generic site banner / placeholder
    return isGenericImage(e.images[0]?.url);
  });
  if (!noImg.length) return;
  console.log(`  🖼️  Fetching OG images for ${noImg.length} ${label} events without photos...`);
  let found = 0;
  // Process in batches of 5 to avoid hammering servers
  for (let i = 0; i < noImg.length; i += 5) {
    const batch = noImg.slice(i, i + 5);
    await Promise.all(batch.map(async ev => {
      const imgUrl = await fetchOgImage(ev.url);
      if (imgUrl) { ev.images = [{ url: imgUrl, _source: 'og' }]; found++; }
    }));
    if (i + 5 < noImg.length) await sleep(500); // polite pause between batches
  }
  console.log(`  ✓ Got OG images for ${found}/${noImg.length} events`);
}

// ── Geo helpers ───────────────────────────────────────────────────────────────
const ABQ_LAT  = 35.1053;
const ABQ_LNG  = -106.6464;
const MAX_MILES = 45;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function isInMetro(lat, lng) {
  if (!lat || !lng) return true;
  const dlat = parseFloat(lat), dlng = parseFloat(lng);
  if (isNaN(dlat) || isNaN(dlng)) return true;
  return haversine(ABQ_LAT, ABQ_LNG, dlat, dlng) <= MAX_MILES;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function isFuture(d) { return typeof d === 'string' && d >= todayStr(); }

// ── 1. EVENTBRITE HTML scraper ─────────────────────────────────────────────────
// Eventbrite embeds full schema.org JSON-LD in window.__SERVER_DATA__ on every
// public event listing page. No API key required — this is intentionally public
// structured data for search engine indexing.
async function fetchEventbriteEvents() {
  console.log('\n🎟️  Fetching Eventbrite events (Albuquerque, NM)...');
  const events = [];
  const seenIds = new Set();

  const urls = [
    'https://www.eventbrite.com/d/nm--albuquerque/events/',
    'https://www.eventbrite.com/d/nm--albuquerque/events/?page=2',
    'https://www.eventbrite.com/d/nm--albuquerque/events/?page=3',
    'https://www.eventbrite.com/d/nm--albuquerque/music/',
    'https://www.eventbrite.com/d/nm--albuquerque/food-and-drink/',
    'https://www.eventbrite.com/d/nm--albuquerque/arts/',
    'https://www.eventbrite.com/d/nm--albuquerque/family-and-education/',
    'https://www.eventbrite.com/d/nm--rio-rancho/events/',
  ];

  for (const url of urls) {
    try {
      const { status, body } = await fetchUrl(url);
      if (status !== 200) { console.warn(`  ⚠️  ${url} → HTTP ${status}`); continue; }

      // Extract times from HTML — Eventbrite shows "Day • HH:MM AM/PM" in cards
      // but JSON-LD only has dates. Build a map from event ID → 24h time string.
      const timeBySlug = {};
      const cardTimeRe = /data-event-id="(\d+)"[\s\S]{0,2000}?(\d{1,2}:\d{2}\s*[AP]M)/gi;
      let tm;
      while ((tm = cardTimeRe.exec(body)) !== null) {
        const ebId = tm[1];
        if (!timeBySlug[ebId]) {
          timeBySlug[ebId] = convertTo24h(tm[2].trim());
        }
      }

      // Extract __SERVER_DATA__ JSON from the script tag
      const match = body.match(/window\.__SERVER_DATA__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
      if (!match) {
        // Fallback: try JSON-LD script tags
        const ldMatches = [...body.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
        for (const ldM of ldMatches) {
          try {
            const ld = JSON.parse(ldM[1]);
            const items = ld['@type'] === 'ItemList' ? ld.itemListElement?.map(e => e.item) : [ld];
            for (const item of (items || [])) {
              if (item?.['@type'] !== 'Event') continue;
              const ev = transformEventbriteJsonLd(item, timeBySlug);
              if (ev && !seenIds.has(ev.id)) { seenIds.add(ev.id); events.push(ev); }
            }
          } catch {}
        }
        continue;
      }

      // Parse the server data — look for jsonld array
      try {
        const serverData = JSON.parse(match[1]);
        const jsonld = serverData?.jsonld || serverData?.search_data?.jsonld || [];
        const items  = Array.isArray(jsonld)
          ? jsonld
          : (jsonld?.itemListElement?.map((e) => e.item) || []);

        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const ev = transformEventbriteJsonLd(item, timeBySlug);
          if (ev && !seenIds.has(ev.id)) { seenIds.add(ev.id); events.push(ev); }
        }
      } catch (parseErr) {
        console.warn(`  ⚠️  JSON parse error for ${url}:`, parseErr.message.slice(0, 80));
      }

      await sleep(800); // polite delay
    } catch (err) {
      console.warn(`  ⚠️  ${url} error:`, err.message);
    }
  }

  console.log(`  ✓ ${events.length} Eventbrite events`);
  return events;
}

/** Convert "7:00 PM" → "19:00", "11:30 AM" → "11:30" */
function convertTo24h(timeStr) {
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return undefined;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + min;
}

function transformEventbriteJsonLd(item, timeBySlug) {
  const startDate = item.startDate || '';
  const localDate = startDate ? startDate.slice(0, 10) : '';
  if (!localDate || !isFuture(localDate)) return null;

  // Try JSON-LD time first, then fall back to HTML-scraped time
  let localTime = startDate.length > 10 ? startDate.slice(11, 16) : undefined;
  if (!localTime && timeBySlug) {
    const urlMatch = (item.url || '').match(/-(\d+)(?:\?|$)/);
    if (urlMatch && timeBySlug[urlMatch[1]]) {
      localTime = timeBySlug[urlMatch[1]];
    }
  }
  const loc     = item.location || {};
  const addr    = loc.address || {};
  const geo     = loc.geo    || {};
  const lat     = geo.latitude;
  const lng     = geo.longitude;

  // Filter to ABQ metro only (online events pass through)
  if (loc['@type'] !== 'VirtualLocation' && lat && lng && !isInMetro(lat, lng)) return null;

  // Generate stable ID from URL
  const urlMatch = (item.url || '').match(/\/e\/[a-z0-9-]+-(\d+)/i);
  const ebId     = urlMatch ? urlMatch[1] : (item.url || '').replace(/[^a-z0-9]/gi, '').slice(-16);
  if (!ebId) return null;

  const name = item.name || 'Untitled Event';

  return {
    id:      `eb-${ebId}`,
    name,
    url:     item.url,
    _source: 'eventbrite',
    info:    (item.description || '').slice(0, 400),
    images:  item.image ? [{ url: typeof item.image === 'string' ? item.image : item.image?.url || item.image?.[0] }] : [],
    dates:   { start: { localDate, localTime } },
    _embedded: {
      venues: [{
        name:    loc.name || addr.streetAddress || '',
        address: { line1: addr.streetAddress || '' },
        city:    { name: addr.addressLocality || 'Albuquerque' },
        state:   { name: addr.addressRegion || 'NM' },
        location: (lat && lng) ? { latitude: String(lat), longitude: String(lng) } : undefined,
      }],
    },
    classifications: [{ segment: { name: guessCategory(name, item.description || '') } }],
    ticketLinks: item.url ? [{ url: item.url }] : [],
    isFree: /free/i.test(item.name || '') || /free/i.test(item.description || ''),
  };
}

function guessCategory(name, desc) {
  const t = (name + ' ' + desc).toLowerCase();
  if (/music|concert|band|dj|live|jazz|blues|folk|rock|country|hip.?hop/.test(t)) return 'Music';
  if (/comedy|stand.?up|improv|laugh/.test(t)) return 'Comedy';
  if (/art|galler|exhibit|paint|sculpt|photo|craft/.test(t)) return 'Arts & Theatre';
  if (/film|movie|cinema|screen/.test(t)) return 'Arts & Theatre';
  if (/theater|theatre|play|musical|opera|dance|ballet/.test(t)) return 'Arts & Theatre';
  if (/sport|run|race|5k|marathon|bike|yoga|fitness|gym/.test(t)) return 'Sports';
  if (/kid|child|famil|baby|toddler|youth/.test(t)) return 'Family';
  if (/food|drink|beer|wine|tast|brew|cocktail|dinner/.test(t)) return 'Food & Drink';
  if (/festival|market|fair|fiesta/.test(t)) return 'Community';
  if (/outdoor|hike|trail|nature|garden/.test(t)) return 'Community';
  return 'Community';
}

// ── 2. Do505 WordPress API ─────────────────────────────────────────────────────
async function fetchDo505Events() {
  console.log('\n🎉 Fetching Do505 events (ABQ arts/culture calendar)...');
  const events = [];
  let page = 1;

  while (page <= 5) {
    try {
      const url = `https://do505.com/wp-json/tribe/events/v1/events?per_page=50&page=${page}&start_date=${todayStr()}&status=publish`;
      const { status, body } = await fetchUrl(url, { accept: 'application/json' });
      if (status !== 200) break;

      const data  = JSON.parse(body);
      const items = Array.isArray(data?.events) ? data.events : [];
      if (items.length === 0) break;

      for (const ev of items) {
        const norm = transformDo505Event(ev);
        if (norm) events.push(norm);
      }
      if (!data.next_rest_url) break;
      page++;
      await sleep(400);
    } catch (err) {
      if (page === 1) console.warn(`  ⚠️  Do505 unavailable:`, err.message.slice(0, 60));
      break;
    }
  }

  console.log(`  ✓ ${events.length} Do505 events`);
  return events;
}

// Parse a cost string that may be a range like "$45-$105" or a single value
function parseCost(costStr) {
  const s = (costStr || '').trim();
  if (!s || s === '0' || /free/i.test(s)) return { min: 0, max: 0, isFree: true };
  // Range: "$45-$105" / "$45 – $105" / "$45/$105"
  const rangeMatch = s.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*[-–—\/]\s*\$?\s*([\d,]+(?:\.\d+)?)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1].replace(/,/g, ''));
    const max = parseFloat(rangeMatch[2].replace(/,/g, ''));
    if (!isNaN(min) && !isNaN(max) && min <= max && max <= 2000) {
      return { min, max, isFree: false };
    }
  }
  const single = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (isNaN(single) || single === 0) return { min: 0, max: 0, isFree: true };
  if (single > 2000) return { min: 0, max: 0, isFree: false };  // sanity cap
  return { min: single, max: single, isFree: false };
}

function transformDo505Event(ev) {
  const start = ev.start_date || '';
  if (!start) return null;
  const localDate = start.slice(0, 10);
  if (!isFuture(localDate)) return null;
  const localTime = start.length >= 16 ? start.slice(11, 16) : undefined;
  const venue = ev.venue || {};
  const lat   = venue.geo_lat || venue.latitude;
  const lng   = venue.geo_lng || venue.longitude;
  if (lat && lng && !isInMetro(lat, lng)) return null;

  const costStr = (ev.cost || '').trim();
  const { min: _cMin, max: _cMax, isFree: _cFree } = parseCost(costStr);

  return {
    id:      `do505-${ev.id}`,
    name:    ev.title || 'Untitled Event',
    url:     ev.url,
    _source: 'do505',
    info:    stripHtml(ev.excerpt || ''),
    description: stripHtml(ev.description || ''),
    images:  ev.image ? [{ url: ev.image.url }] : [],
    dates:   { start: { localDate, localTime } },
    _embedded: {
      venues: [{
        name:    venue.venue || venue.name || '',
        address: { line1: [venue.address, venue.address_2].filter(Boolean).join(', ') },
        city:    { name: venue.city || 'Albuquerque' },
        state:   { name: venue.stateprovince || 'NM' },
        location: (lat && lng) ? { latitude: String(lat), longitude: String(lng) } : undefined,
      }],
    },
    classifications: [{ segment: { name: mapDo505Category(ev.categories || []) } }],
    priceRanges: _cMin > 0 ? [{ min: _cMin, max: _cMax, currency: 'USD' }] : undefined,
    isFree: _cFree,
    ticketLinks: ev.url ? [{ url: ev.url }] : [],
  };
}

function mapDo505Category(cats) {
  const names = cats.map(c => (c.name || '').toLowerCase());
  if (names.some(n => /music|concert|band/.test(n))) return 'Music';
  if (names.some(n => /art|galler|exhibit/.test(n))) return 'Arts & Theatre';
  if (names.some(n => /film|movie|cinema/.test(n))) return 'Arts & Theatre';
  if (names.some(n => /comedy|improv/.test(n))) return 'Comedy';
  if (names.some(n => /famil|kid|child/.test(n))) return 'Family';
  if (names.some(n => /food|drink|beer|wine/.test(n))) return 'Food & Drink';
  if (names.some(n => /festival|market|fair/.test(n))) return 'Community';
  if (names.some(n => /outdoor|hike|trail/.test(n))) return 'Community';
  return 'Community';
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 500);
}

// ── 3. ABQToDo.com WordPress API ──────────────────────────────────────────────
async function fetchAbqToDoEvents() {
  console.log('\n📍 Fetching ABQToDo.com events (local ABQ community calendar)...');
  const events = [];
  let page = 1;

  while (page <= 5) {
    try {
      const url = `https://abqtodo.com/wp-json/tribe/events/v1/events?per_page=50&page=${page}&start_date=${todayStr()}&status=publish`;
      const { status, body } = await fetchUrl(url, { accept: 'application/json' });
      if (status !== 200) break;

      const data  = JSON.parse(body);
      const items = Array.isArray(data?.events) ? data.events : [];
      if (items.length === 0) break;

      for (const ev of items) {
        const norm = transformAbqToDoEvent(ev);
        if (norm) events.push(norm);
      }
      if (!data.next_rest_url) break;
      page++;
      await sleep(400);
    } catch (err) {
      if (page === 1) console.warn(`  ⚠️  ABQToDo unavailable:`, err.message.slice(0, 60));
      break;
    }
  }

  console.log(`  ✓ ${events.length} ABQToDo events`);
  return events;
}

function transformAbqToDoEvent(ev) {
  const start = ev.start_date || '';
  if (!start) return null;
  const localDate = start.slice(0, 10);
  if (!isFuture(localDate)) return null;
  const localTime = start.length >= 16 ? start.slice(11, 16) : undefined;
  const venue = ev.venue || {};
  const lat   = venue.geo_lat || venue.latitude;
  const lng   = venue.geo_lng || venue.longitude;
  if (lat && lng && !isInMetro(lat, lng)) return null;

  const costStr = (ev.cost || '').trim();
  const { min: _cMin, max: _cMax, isFree: _cFree } = parseCost(costStr);

  // ABQToDo uses lazy-loaded images — try data-src first, then url
  let imageUrl = null;
  if (ev.image) {
    imageUrl = ev.image.url || ev.image['data-src'] || null;
  }

  const cats = ev.categories || [];
  const catNames = cats.map(c => (c.name || '').toLowerCase());
  let segment = 'Community';
  if (catNames.some(n => /music|concert|band/.test(n))) segment = 'Music';
  else if (catNames.some(n => /art|galler|exhibit/.test(n))) segment = 'Arts & Theatre';
  else if (catNames.some(n => /film|movie|cinema/.test(n))) segment = 'Arts & Theatre';
  else if (catNames.some(n => /comedy|improv/.test(n))) segment = 'Comedy';
  else if (catNames.some(n => /famil|kid|child/.test(n))) segment = 'Family';
  else if (catNames.some(n => /food|drink|beer|wine/.test(n))) segment = 'Food & Drink';
  else if (catNames.some(n => /festival|market|fair/.test(n))) segment = 'Community';
  else if (catNames.some(n => /outdoor|hike|trail|natur/.test(n))) segment = 'Community';

  return {
    id:      `abqtodo-${ev.id}`,
    name:    ev.title || 'Untitled Event',
    url:     ev.url,
    _source: 'local',
    info:    stripHtml(ev.excerpt || ''),
    description: stripHtml(ev.description || ''),
    images:  imageUrl ? [{ url: imageUrl }] : [],
    dates:   { start: { localDate, localTime } },
    _embedded: {
      venues: [{
        name:    venue.venue || venue.name || '',
        address: { line1: [venue.address, venue.address_2].filter(Boolean).join(', ') },
        city:    { name: venue.city || 'Albuquerque' },
        state:   { name: venue.stateprovince || 'NM' },
        location: (lat && lng) ? { latitude: String(lat), longitude: String(lng) } : undefined,
      }],
    },
    classifications: [{ segment: { name: segment } }],
    priceRanges: _cMin > 0 ? [{ min: _cMin, max: _cMax, currency: 'USD' }] : undefined,
    isFree: _cFree,
    ticketLinks: ev.url ? [{ url: ev.url }] : [],
  };
}

// ── 4. Upsert to Supabase ─────────────────────────────────────────────────────
async function upsertEvents(source, rawArr) {
  if (!_sb || !rawArr.length) return;
  const rows = rawArr.map(raw => ({
    id:               raw.id,
    source,
    raw,
    event_date:       raw.dates?.start?.localDate || null,
    // Denormalized columns — populated here so listing queries avoid raw JSONB
    cached_photo_url: raw.images?.[0]?.url || null,
    venue_name:       raw._embedded?.venues?.[0]?.name || null,
    category:         raw.classifications?.[0]?.segment?.name || null,
  }));
  const { error } = await _sb.from('events').upsert(rows, { onConflict: 'id' });
  if (error) console.error(`[Supabase] ${source} upsert error:`, error.message);
  else console.log(`[Supabase] ✓ upserted ${rows.length} ${source} events`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🗓️  ABQ Unplugged — Local Event Sources');
  console.log('   Sources: Eventbrite (HTML/JSON-LD), Do505 (WP API), ABQToDo (WP API)\n');

  const [ebEvents, do505Events, abqTodoEvents] = await Promise.all([
    fetchEventbriteEvents(),
    fetchDo505Events(),
    fetchAbqToDoEvents(),
  ]);

  // Enrich events still missing photos — fetch og:image from each event's page
  await enrichImagesFromOg(ebEvents,      'Eventbrite');
  await enrichImagesFromOg(do505Events,   'Do505');
  await enrichImagesFromOg(abqTodoEvents, 'ABQToDo');

  const allLocal = [...ebEvents, ...do505Events, ...abqTodoEvents];
  console.log(`\n📊 Total local/EB events: ${allLocal.length}`);
  console.log(`   Eventbrite: ${ebEvents.length}  |  Do505: ${do505Events.length}  |  ABQToDo: ${abqTodoEvents.length}`);

  // Write output file
  const outDir = path.join(__dirname, '..', 'public', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'local-events.json');
  fs.writeFileSync(outPath, JSON.stringify(allLocal, null, 2));
  console.log(`✅ Saved → ${outPath}`);

  // Upsert to Supabase by source bucket
  const ebRows       = allLocal.filter(e => e._source === 'eventbrite');
  const do505Rows    = allLocal.filter(e => e._source === 'do505');
  const localRows    = allLocal.filter(e => e._source === 'local');

  await upsertEvents('eventbrite', ebRows);
  await upsertEvents('do505',      do505Rows);
  await upsertEvents('local',      localRows);

  console.log('\n✅ Done.');
})();
