#!/usr/bin/env node
/**
 * ABQ Unplugged — Google Places Details Enrichment
 *
 * Fetches full Place Details from Google Places API for every place that is
 * missing hours, website, or dining attributes, then writes the results to the
 * Supabase `places.enriched` JSONB column.
 *
 * Fields fetched (chosen to balance cost vs. value):
 *   • opening_hours          → weekday_text, open_now, periods
 *   • website                → direct business URL
 *   • editorial_summary      → Google's description of the place
 *   • price_level            → 0–4 (free–very expensive)
 *   • serves_beer / wine / brunch / breakfast / lunch / dinner
 *   • outdoor_seating / delivery / dine_in / takeout / reservable
 *   • wheelchair_accessible_entrance
 *   • formatted_phone_number → local format e.g. "(505) 555-1234"
 *
 * Google API pricing note (as of 2025):
 *   Basic data  (name, location)   → free
 *   Contact     (phone, website)   → $3  / 1,000 requests
 *   Atmosphere  (hours, editorial) → $17 / 1,000 requests
 *   → Fetching ALL fields above for 4,622 places ≈ $78–$95 one-time cost.
 *   After first run, use --only-missing to only update places still lacking data.
 *
 * DATA IS SAVED PERMANENTLY IN SUPABASE — you only pay once per place.
 * The app reads from Supabase's enriched column on every modal open (free).
 * Re-run every 3–6 months to refresh stale hours using --refresh-stale.
 *
 * Google Maps Platform gives $200/month free credit.
 * At $17/1,000 for atmosphere fields, 4,622 places ≈ $78 — likely free on credit.
 * Check usage: https://console.cloud.google.com → Billing
 *
 * Usage:
 *   node scripts/enrich-places-google-details.cjs              # all places
 *   node scripts/enrich-places-google-details.cjs --only-missing          # skip places with hours
 *   node scripts/enrich-places-google-details.cjs --refresh-stale 90      # re-fetch if older than 90 days
 *   node scripts/enrich-places-google-details.cjs --limit 50              # test with 50 places
 *   node scripts/enrich-places-google-details.cjs --dry-run               # parse only, no writes
 *   node scripts/enrich-places-google-details.cjs --place ChIJ...         # single place_id
 *   node scripts/enrich-places-google-details.cjs --category restaurant   # one category
 *
 * Recommended workflow:
 *   1. First run:  node scripts/enrich-places-google-details.cjs
 *   2. Monthly:    node scripts/enrich-places-google-details.cjs --only-missing   (new places only)
 *   3. Quarterly:  node scripts/enrich-places-google-details.cjs --refresh-stale 90
 */
'use strict';

const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────
const GOOGLE_KEY    = process.env.VITE_GOOGLE_PLACES_KEY  || 'AIzaSyDn-W5LqhBBAK2VaZhORgRW8oQagpCVq6k';
const SUPABASE_URL  = process.env.VITE_SUPABASE_URL       || 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const SUPABASE_KEY  = process.env.VITE_SUPABASE_ANON_KEY  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXZmdXRlYm1ia2p2bHJoaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzgwMzIsImV4cCI6MjA4OTgxNDAzMn0.3rvMRErlF-HnKfbJ6rCNSeCJc39n4K48xjAeSGqf_rc';

// All the fields we want from Place Details — batched in one call per place
const DETAILS_FIELDS = [
  'opening_hours',
  'website',
  'editorial_summary',
  'price_level',
  'serves_beer',
  'serves_wine',
  'serves_brunch',
  'serves_breakfast',
  'serves_lunch',
  'serves_dinner',
  'delivery',
  'dine_in',
  'takeout',
  'reservable',
  'wheelchair_accessible_entrance',
  'formatted_phone_number',
].join(',');

// Rate-limit: Google allows ~10 req/s on the default quota; we go conservative.
const DELAY_MS       = 120;   // ~8 req/s
const BATCH_SIZE     = 200;   // Supabase fetch page size
const MAX_ERRORS     = 20;    // Stop if too many API errors

// ── CLI args ──────────────────────────────────────────────────────────────────
const args          = process.argv.slice(2);
const DRY_RUN       = args.includes('--dry-run');
const ONLY_MISSING  = args.includes('--only-missing');
const limitIdx      = args.indexOf('--limit');
const LIMIT         = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const placeIdx      = args.indexOf('--place');
const SINGLE_PLACE  = placeIdx !== -1 ? args[placeIdx + 1] : null;
const catIdx        = args.indexOf('--category');
const CATEGORY_FILTER = catIdx !== -1 ? args[catIdx + 1] : null;
const staleIdx      = args.indexOf('--refresh-stale');
// --refresh-stale N  → re-fetch places where hoursUpdatedAt is older than N days
const REFRESH_STALE_DAYS = staleIdx !== -1 ? parseInt(args[staleIdx + 1], 10) : null;

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error: ' + data.slice(0, 120))); }
      });
    }).on('error', reject);
  });
}

function supabaseRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(SUPABASE_URL + path);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(u, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function fetchPlacePage(offset, onlyMissing, category, refreshStaleDays) {
  let url = `/rest/v1/places?select=id,raw,enriched&order=id&offset=${offset}&limit=${BATCH_SIZE}`;
  if (onlyMissing) {
    // Fetch places where enriched is NULL entirely OR where enriched exists but has no hours key.
    // Using Supabase's OR filter: enriched.is.null or enriched->>'hours' is null.
    url += '&or=(enriched.is.null,enriched->>hours.is.null)';
  }
  if (category) {
    url += `&raw->>category=eq.${encodeURIComponent(category)}`;
  }
  const res = await supabaseRequest(url, 'GET', null);
  if (res.status !== 200) throw new Error(`Supabase fetch failed: ${res.status} ${res.body}`);
  let rows = JSON.parse(res.body);

  // Filter client-side for stale rows (Supabase can't easily filter nested JSONB dates)
  if (refreshStaleDays != null) {
    const cutoff = new Date(Date.now() - refreshStaleDays * 86400000).toISOString();
    rows = rows.filter(row => {
      const updatedAt = row.enriched?.hoursUpdatedAt;
      // Include if no timestamp (never enriched) OR timestamp is older than cutoff
      return !updatedAt || updatedAt < cutoff;
    });
  }

  return rows;
}

async function patchEnriched(dbId, enrichedPatch) {
  // Merge into existing enriched object — we don't want to erase other enriched fields
  const res = await supabaseRequest(
    `/rest/v1/rpc/merge_enriched`,
    'POST',
    { p_id: dbId, p_patch: enrichedPatch }
  );
  // If the RPC doesn't exist yet, fall back to a full replace with merge
  if (res.status === 404 || res.status === 400) {
    // Fallback: fetch current enriched, merge, write back
    const existing = await supabaseRequest(`/rest/v1/places?select=enriched&id=eq.${dbId}`, 'GET', null);
    let current = {};
    try {
      const rows = JSON.parse(existing.body);
      current = rows?.[0]?.enriched || {};
    } catch { /* ignore */ }
    const merged = { ...current, ...enrichedPatch };
    const patch = await supabaseRequest(
      `/rest/v1/places?id=eq.${dbId}`,
      'PATCH',
      { enriched: merged }
    );
    return patch.status === 204 || patch.status === 200;
  }
  return res.status === 204 || res.status === 200;
}

// ── Google Places Details ─────────────────────────────────────────────────────
async function fetchGoogleDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json`
    + `?place_id=${encodeURIComponent(placeId)}`
    + `&fields=${encodeURIComponent(DETAILS_FIELDS)}`
    + `&key=${GOOGLE_KEY}`;
  const data = await httpsGet(url);
  if (data.status !== 'OK') {
    if (data.status === 'NOT_FOUND') return null;       // place deleted
    if (data.status === 'ZERO_RESULTS') return null;
    throw new Error(`Google API ${data.status}: ${data.error_message || ''}`);
  }
  return data.result;
}

// ── Parse Google result → enriched patch object ───────────────────────────────
function parseGoogleDetails(result) {
  if (!result) return null;
  const patch = {};

  // Hours: store as pipe-separated string (matches current enriched.hours format)
  if (result.opening_hours?.weekday_text?.length) {
    patch.hours = result.opening_hours.weekday_text.join(' | ');
    patch.hoursSource = 'google';
    patch.hoursUpdatedAt = new Date().toISOString();  // stamp for stale-refresh logic
  }

  // Website
  if (result.website) {
    patch.website = result.website;
  }

  // Editorial summary (Google's description)
  if (result.editorial_summary?.overview) {
    patch.editorial = result.editorial_summary.overview;
  }

  // Price level (0=free, 1=$, 2=$$, 3=$$$, 4=$$$$)
  if (result.price_level != null) {
    const symbols = ['Free', '$', '$$', '$$$', '$$$$'];
    patch.priceLevel = result.price_level;
    patch.priceNote = symbols[result.price_level] || '';
  }

  // Phone
  if (result.formatted_phone_number) {
    patch.phone = result.formatted_phone_number;
  }

  // Dining & amenity attributes — bundle into a compact array for display chips
  const attrs = [];
  const truthy = (key) => result[key] === true;

  if (truthy('dine_in'))          attrs.push('Dine In');
  if (truthy('takeout'))          attrs.push('Takeout');
  if (truthy('delivery'))         attrs.push('Delivery');
  if (truthy('reservable'))       attrs.push('Reservations');
  if (truthy('serves_brunch'))    attrs.push('Brunch');
  if (truthy('serves_breakfast')) attrs.push('Breakfast');
  if (truthy('serves_lunch'))     attrs.push('Lunch');
  if (truthy('serves_dinner'))    attrs.push('Dinner');
  if (truthy('serves_beer'))      attrs.push('Beer');
  if (truthy('serves_wine'))      attrs.push('Wine');
  if (truthy('wheelchair_accessible_entrance')) attrs.push('Accessible');

  if (attrs.length) patch.amenities = attrs;

  return Object.keys(patch).length ? patch : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🗺️  ABQ Unplugged — Google Places Details Enrichment');
  const modeStr = ONLY_MISSING ? ' (only missing)' : REFRESH_STALE_DAYS ? ` (refresh stale >${REFRESH_STALE_DAYS}d)` : ' (all places)';
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${modeStr}${CATEGORY_FILTER ? ` category=${CATEGORY_FILTER}` : ''}`);
  if (LIMIT !== Infinity) console.log(`   Limit: ${LIMIT} places`);
  console.log(`   💡 Data saved to Supabase permanently — you only pay once per place.`);
  if (!DRY_RUN) console.log(`   💳 Check Google credit: console.cloud.google.com → Billing`);
  console.log('');

  let processed = 0, enriched = 0, skipped = 0, errors = 0;
  let offset = 0;

  // Handle --place single mode
  if (SINGLE_PLACE) {
    const placeId = SINGLE_PLACE.replace(/^google_/, '');
    console.log(`🔍 Fetching details for ${placeId}…`);
    const result = await fetchGoogleDetails(placeId);
    const patch = parseGoogleDetails(result);
    if (!patch) {
      console.log('   ⚠️  No usable data returned.');
      return;
    }
    console.log('   Parsed:', JSON.stringify(patch, null, 2));
    if (!DRY_RUN) {
      const dbId = `google_${placeId}`;
      await patchEnriched(dbId, patch);
      console.log('   ✅ Written to Supabase.');
    }
    return;
  }

  // Paginate through all places
  while (processed < LIMIT) {
    let page;
    try {
      page = await fetchPlacePage(offset, ONLY_MISSING, CATEGORY_FILTER, REFRESH_STALE_DAYS);
    } catch (err) {
      console.error('❌ Supabase fetch error:', err.message);
      break;
    }
    if (!page.length) break;

    for (const row of page) {
      if (processed >= LIMIT) break;

      const rawPlaceId = (row.raw?.place_id || row.id?.replace(/^google_/, '')) || null;
      const dbId = row.id;
      const placeName = row.raw?.name || dbId;

      if (!rawPlaceId) { skipped++; continue; }

      processed++;
      process.stdout.write(`[${processed}] ${placeName.slice(0, 45).padEnd(45)} `);

      let result;
      try {
        result = await fetchGoogleDetails(rawPlaceId);
      } catch (err) {
        errors++;
        console.log(`❌ ${err.message.slice(0, 80)}`);
        if (errors >= MAX_ERRORS) {
          console.error('\n🛑 Too many API errors. Stopping.');
          process.exit(1);
        }
        await sleep(DELAY_MS * 3);
        continue;
      }

      const patch = parseGoogleDetails(result);
      if (!patch) {
        skipped++;
        console.log('–  (no data)');
        await sleep(DELAY_MS);
        continue;
      }

      const parts = [];
      if (patch.hours)       parts.push('⏰');
      if (patch.website)     parts.push('🔗');
      if (patch.editorial)   parts.push('📝');
      if (patch.phone)       parts.push('📞');
      if (patch.priceNote)   parts.push(patch.priceNote);
      if (patch.amenities?.length) parts.push(`[${patch.amenities.join(', ')}]`);

      console.log(parts.join(' '));

      if (!DRY_RUN) {
        try {
          await patchEnriched(dbId, patch);
          enriched++;
        } catch (err) {
          errors++;
          console.error(`   ❌ Write failed: ${err.message}`);
        }
      } else {
        enriched++;
      }

      await sleep(DELAY_MS);
    }

    offset += page.length;
    if (page.length < BATCH_SIZE) break;
  }

  console.log('\n────────────────────────────────────────');
  console.log(`✅ Done: ${processed} processed, ${enriched} enriched, ${skipped} skipped, ${errors} errors`);
  if (DRY_RUN) console.log('   (DRY RUN — nothing written to Supabase)');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
