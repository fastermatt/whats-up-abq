#!/usr/bin/env node
/**
 * tag-neighborhoods-venues.cjs
 *
 * Fast (no LLM) backfill script that computes neighborhood + venue_slug
 * for every event in the DB and writes them back.
 *
 * Safe to re-run — use --force to overwrite existing tags.
 * Run: node scripts/tag-neighborhoods-venues.cjs [--force] [--limit=N]
 *
 * ~1-2 minutes for 1000 events (pure address lookup, no AI needed).
 */

'use strict';
const https = require('https');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FORCE        = process.argv.includes('--force');
const LIMIT_ARG    = process.argv.find(a => a.startsWith('--limit='));
const LIMIT        = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;
const BATCH_SIZE   = 50; // rows per PATCH call

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function request(url, opts = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const req    = lib.request(parsed, {
      method:  opts.method  || 'GET',
      headers: opts.headers || {},
      timeout: opts.timeout || 30000,
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
        else { try { resolve(JSON.parse(text)); } catch { resolve(text); } }
      });
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function sbGet(path) {
  return request(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept':        'application/json',
    },
  });
}

function sbPatch(table, id, data) {
  return request(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
  }, data);
}

// ── Venue slug (mirrors venueToSlug in the Next.js app) ───────────────────────
function venueToSlug(name) {
  if (!name) return null;
  return encodeURIComponent(
    name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
  );
}

// ── Known ABQ venues → canonical neighborhood ─────────────────────────────────
// Keep in sync with enrich-events-lm.cjs KNOWN_VENUES
const KNOWN_VENUES = {
  'nexus brewery':              'Near I-25 / Midtown',
  'isleta amphitheater':        'South Valley',
  'isleta amphitheatre':        'South Valley',
  'tingley coliseum':           'State Fairgrounds / Midtown',
  'expo new mexico':            'State Fairgrounds / Midtown',
  'state fair':                 'State Fairgrounds / Midtown',
  'sandia resort':              'Far Northeast / Sandia Foothills',
  'sandia casino':              'Far Northeast / Sandia Foothills',
  'hard rock hotel':            'South Valley / South I-25',
  'hard rock casino':           'South Valley / South I-25',
  'popejoy hall':               'UNM Campus',
  'keller hall':                'UNM Campus',
  'launchpad':                  'Downtown / EDo',
  'sunshine theater':           'Downtown',
  'kiva auditorium':            'Downtown',
  'albuquerque convention':     'Downtown',
  'isotopes park':              'UNM / South Campus',
  'rio rancho events center':   'Rio Rancho',
  'rio rancho civic center':    'Rio Rancho',
  'hotel albuquerque':          'Old Town',
  'albuquerque museum':         'Old Town',
  'national hispanic cultural': 'Barelas / South Downtown',
  'national museum of nuclear': 'Nob Hill',
  'meow wolf':                  'Santa Fe',
  'santa fe':                   'Santa Fe',
  'abq biopark':                'Barelas / Rio Grande',
  'biopark':                    'Barelas / Rio Grande',
  'abq biopark zoo':            'Barelas / Rio Grande',
  'explora':                    'Old Town',
  'los alamos':                 'Los Alamos',
  'new mexico museum of natural': 'Old Town',
  'albuquerque little theater': 'Old Town',
  'the dirty bourbon':          'Northeast Heights',
  'el rey court':               'Nob Hill',
  'nob hill bar':               'Nob Hill',
  'historic lobo theater':      'Nob Hill',
  'tractor brewing':            'Downtown / Nob Hill',
  'marble brewery':             'Downtown',
  'ponderosa brewing':          'South Downtown',
  'boxing bear brewing':        'Westside / Cottonwood',
  'bosque brewing':             'South Valley',
  'canteen brewhouse':          'Downtown',
  'rio bravo brewing':          'Downtown',
  'sidetrack brewing':          'Nob Hill',
  'quarter celtic':             'Nob Hill',
  'juno':                       'Nob Hill',
  'brewery arts center':        'Silver City',
};

// ── Address pattern → neighborhood ────────────────────────────────────────────
function neighborhoodFromAddress(addr, city) {
  const a = (addr || '').toLowerCase();
  const c = (city || '').toLowerCase();

  if (/rio rancho/.test(c) || /rio rancho/.test(a)) return 'Rio Rancho';
  if (/santa fe/.test(c) || /santa fe/.test(a)) return 'Santa Fe';
  if (/los alamos/.test(c) || /los alamos/.test(a)) return 'Los Alamos';
  if (/bernalillo/.test(c) && !/albuquerque/.test(c)) return 'Bernalillo / North Valley';

  // Street-based ABQ neighborhoods
  if (/pan american|pan-american freeway/.test(a))     return 'Near I-25 / Midtown';
  if (/paseo del norte/.test(a))                        return 'Journal Center / North';
  if (/paseo del volcan|paradise hills|coors.*nw/.test(a)) return 'Westside';
  if (/unser blvd|universe blvd/.test(a))               return 'Westside / Rio Rancho Border';
  if (/rio grande blvd|old town/.test(a))               return 'Old Town';
  if (/mountain rd.*nw|old town rd/.test(a))            return 'Old Town';
  if (/4th st.*nw|4th.*nw|north 4th/.test(a))          return 'North Valley';
  if (/barelas|broadway.*sw|south broadway/.test(a))    return 'Barelas / South Downtown';
  if (/isleta blvd|isleta.*sw|south valley/.test(a))    return 'South Valley';
  if (/university blvd.*se/.test(a))                    return 'South I-25 / University SE';

  // Central Ave by block number — the main ABQ corridor
  const centralMatch = a.match(/^(\d{1,5})\s+central/);
  if (centralMatch) {
    const block = parseInt(centralMatch[1]);
    if (block < 900)   return 'Downtown';
    if (block < 2000)  return 'EDo (East Downtown)';
    if (block < 3500)  return 'Nob Hill';
    if (block < 5500)  return 'Near Heights';
    if (block < 8000)  return 'Northeast Heights';
    return 'Far Northeast Heights';
  }

  if (/central ave.*ne|ne.*central|central.*nob hill/.test(a)) return 'Nob Hill';
  if (/central ave.*sw|central.*downtown/.test(a))             return 'Downtown';

  // Downtown markers
  if (/civic plaza|marquette|copper ave.*nw|gold ave.*nw|1st st.*nw|2nd st.*nw/.test(a)) return 'Downtown';
  if (/lomas.*nw|lomas.*downtown/.test(a))                     return 'Downtown';
  if (/1st.*sw|2nd.*sw|3rd.*sw|4th.*sw/.test(a))              return 'Downtown / Barelas';

  // Lomas by block
  const lomasMatch = a.match(/^(\d{1,5})\s+lomas/);
  if (lomasMatch) {
    const block = parseInt(lomasMatch[1]);
    if (block < 1500) return 'Downtown';
    if (block < 4000) return 'Midtown';
    if (block < 8000) return 'Northeast Heights';
    return 'Far Northeast Heights';
  }

  if (/lomas blvd/.test(a))    return 'Midtown';
  if (/candelaria.*ne/.test(a)) return 'Northeast Heights';
  if (/montgomery.*ne/.test(a)) return 'Northeast Heights';
  if (/academy.*ne/.test(a))    return 'Northeast Heights';
  if (/wyoming.*ne/.test(a))    return 'Northeast Heights';
  if (/eubank.*ne/.test(a))     return 'Far Northeast Heights';
  if (/juan tabo/.test(a))      return 'Far Northeast Heights';
  if (/tramway/.test(a))        return 'Far Northeast / Sandia Foothills';
  if (/san mateo.*ne/.test(a))  return 'Northeast Heights';
  if (/louisiana.*ne/.test(a))  return 'Uptown / Midtown';
  if (/indian school.*ne/.test(a)) return 'Uptown / Midtown';
  if (/menaul.*ne/.test(a))     return 'Northeast Heights';
  if (/girard.*ne/.test(a))     return 'Nob Hill';
  if (/yale.*ne/.test(a))       return 'UNM Campus';
  if (/university.*ne/.test(a)) return 'UNM / Nob Hill';
  if (/avenida cesar chavez/.test(a)) return 'UNM / South Campus';
  if (/stadium blvd/.test(a))   return 'UNM / South Campus';

  return null; // unknown
}

// ── Main tag function ─────────────────────────────────────────────────────────
function computeTags(row) {
  const raw     = row.raw || {};
  const source  = row.source;

  // Extract venue name + address from all source formats
  let venueName = '';
  let addrLine  = '';
  let cityName  = '';

  if (source === 'ticketmaster' || source === 'seatgeek') {
    const v = raw._embedded?.venues?.[0];
    venueName = v?.name || '';
    addrLine  = v?.address?.line1 || '';
    cityName  = v?.city?.name || '';
  } else if (source === 'eventbrite') {
    const v = raw.venue;
    if (typeof v === 'object' && v) {
      venueName = v.name || '';
      addrLine  = v.address?.address_1 || v.address?.localized_address_display || '';
      cityName  = v.address?.city || '';
    }
  } else if (source === 'bandsintown') {
    const v = raw.venue;
    if (typeof v === 'object' && v) {
      venueName = v.name || '';
      cityName  = v.city || '';
    }
  } else if (source === 'local') {
    venueName = typeof raw.venue === 'string' ? raw.venue : raw.venue?.name || raw.venue_name || '';
    addrLine  = raw.address || '';
    cityName  = raw.city || 'Albuquerque';
  }

  const slug = venueToSlug(venueName) || null;

  // Neighborhood: check known venues first, then address patterns
  let neighborhood = null;
  const combined = (venueName + ' ' + addrLine).toLowerCase();
  for (const [pattern, hood] of Object.entries(KNOWN_VENUES)) {
    if (combined.includes(pattern)) { neighborhood = hood; break; }
  }
  if (!neighborhood) {
    neighborhood = neighborhoodFromAddress(addrLine, cityName);
  }

  return { venue_slug: slug, neighborhood };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏷️   ABQ Unplugged — Neighborhood + Venue Tag Backfill');
  console.log(`    Mode: ${FORCE ? 'FORCE (overwrite existing)' : 'INCREMENTAL (skip tagged)'}`);
  if (LIMIT < Infinity) console.log(`    Limit: ${LIMIT}`);
  console.log('');

  // Fetch events needing tags
  const today  = new Date().toISOString().split('T')[0];
  const filter = FORCE
    ? `event_date=gte.${today}&hidden=eq.false&order=event_date.asc&limit=2000`
    : `event_date=gte.${today}&hidden=eq.false&neighborhood=is.null&order=event_date.asc&limit=2000`;

  console.log('📥  Fetching events from Supabase…');
  const rows = await sbGet(`events?${filter}&select=id,source,raw,neighborhood,venue_slug`);
  if (!Array.isArray(rows)) {
    console.error('❌  Unexpected response:', rows);
    process.exit(1);
  }

  const toProcess = rows.slice(0, LIMIT);
  console.log(`    Found ${rows.length} events to tag (processing ${toProcess.length})\n`);

  let tagged = 0, skipped = 0, failed = 0;
  const neighborhoodCounts = {};

  for (const row of toProcess) {
    try {
      const { venue_slug, neighborhood } = computeTags(row);

      // Skip if nothing changed (incremental mode)
      if (!FORCE && row.neighborhood === neighborhood && row.venue_slug === venue_slug) {
        skipped++;
        continue;
      }

      await sbPatch('events', row.id, { venue_slug, neighborhood });
      tagged++;

      if (neighborhood) {
        neighborhoodCounts[neighborhood] = (neighborhoodCounts[neighborhood] || 0) + 1;
      }

      if (tagged % 50 === 0) {
        console.log(`  📍 [${tagged}/${toProcess.length}] tagged…`);
      }
    } catch (err) {
      failed++;
      console.warn(`  ❌ ${row.id} — ${err.message}`);
    }
  }

  console.log(`\n🏁  Done — ${tagged} tagged, ${skipped} skipped, ${failed} failed`);

  if (Object.keys(neighborhoodCounts).length > 0) {
    console.log('\n📊  Neighborhood breakdown:');
    Object.entries(neighborhoodCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([hood, count]) => console.log(`    ${count.toString().padStart(4)}  ${hood}`));

    const untagged = toProcess.length - tagged - skipped - failed;
    const noNeighborhood = tagged - Object.values(neighborhoodCounts).reduce((s, n) => s + n, 0);
    if (noNeighborhood > 0) {
      console.log(`\n  ⚠  ${noNeighborhood} events couldn't be matched to a neighborhood`);
      console.log('     (add their venue/address patterns to KNOWN_VENUES or neighborhoodFromAddress)');
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
