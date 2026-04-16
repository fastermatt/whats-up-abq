#!/usr/bin/env node
/**
 * fetch-more-sources.cjs
 *
 * Additional ABQ event sources:
 *   1. JCC Albuquerque (WordPress Events Calendar REST API)
 *   2. Explora Children's Museum (WordPress REST API)
 *   3. NM Magazine (custom REST API)
 *   4. Meetup.com ABQ groups (GraphQL)
 *
 * Run: node scripts/fetch-more-sources.cjs
 * Upserts directly into public.events (same table as other sources).
 */

'use strict';

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { URL } = require('url');

// Load env
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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function fetchUrl(urlStr, opts = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 4) return reject(new Error('Too many redirects'));
    const parsed = new URL(urlStr);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const req    = lib.request({
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      method:   opts.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ABQUnplugged-Bot/1.0; +https://abqunplugged.com)',
        'Accept': opts.accept || 'application/json,*/*',
        ...(opts.headers || {}),
      },
      timeout: 20000,
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
        return fetchUrl(loc, opts, redirectCount + 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function todayStr() { return new Date().toISOString().split('T')[0]; }
function isFuture(d) { return typeof d === 'string' && d >= todayStr(); }
function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 500);
}

// ── Supabase upsert ───────────────────────────────────────────────────────────
async function upsertEvents(rows) {
  if (!rows.length) return;
  const body = JSON.stringify(rows);
  const { status } = await fetchUrl(
    `${SUPABASE_URL}/rest/v1/events?on_conflict=id`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body,
      accept: 'application/json',
    }
  );
  if (status >= 400) {
    console.error('  ❌ Supabase upsert failed, status:', status);
  } else {
    console.log(`  ✅ Upserted ${rows.length} events`);
  }
}

// ── WordPress Events Calendar helper ─────────────────────────────────────────
async function fetchWPEvents(domain, sourceName, sourcePrefix) {
  const events = [];
  let page = 1;

  while (page <= 5) {
    try {
      const url = `https://${domain}/wp-json/tribe/events/v1/events?per_page=50&page=${page}&start_date=${todayStr()}&status=publish`;
      const { status, body } = await fetchUrl(url);
      if (status !== 200) break;

      const data  = JSON.parse(body);
      const items = Array.isArray(data?.events) ? data.events : [];
      if (!items.length) break;

      for (const ev of items) {
        const start = ev.start_date || '';
        if (!start) continue;
        const localDate = start.slice(0, 10);
        if (!isFuture(localDate)) continue;
        const localTime = start.length >= 16 ? start.slice(11, 16) : undefined;
        const venue     = ev.venue || {};

        events.push({
          id:     `${sourcePrefix}-${ev.id}`,
          source: sourceName,
          raw: {
            name:   ev.title || 'Untitled Event',
            id:     `${sourcePrefix}-${ev.id}`,
            _source: sourceName,
            url:    ev.url,
            info:   stripHtml(ev.excerpt || ev.description || ''),
            images: ev.image ? [{ url: ev.image.url }] : [],
            dates:  { start: { localDate, localTime } },
            _embedded: {
              venues: [{
                name:    venue.venue || venue.name || '',
                address: { line1: [venue.address, venue.address_2].filter(Boolean).join(', ') },
                city:    { name: venue.city || 'Albuquerque' },
                state:   { name: 'NM' },
              }],
            },
            classifications: [{ segment: { name: guessCat(ev.title || '', ev.categories || []) } }],
            isFree: /free/i.test(ev.cost || '') || ev.cost === '0',
            ticketLinks: ev.url ? [{ url: ev.url }] : [],
          },
          event_date: localDate,
        });
      }

      if (!data.next_rest_url) break;
      page++;
      await sleep(400);
    } catch (err) {
      if (page === 1) console.warn(`  ⚠ ${domain}: ${err.message.slice(0, 80)}`);
      break;
    }
  }
  return events;
}

function guessCat(title, cats) {
  const catNames = (cats || []).map(c => (c.name || '').toLowerCase());
  const t = title.toLowerCase() + ' ' + catNames.join(' ');
  if (/music|concert|band|dj|jazz/.test(t))           return 'Music';
  if (/comedy|stand.?up|improv/.test(t))              return 'Comedy';
  if (/art|gallery|exhibit|paint/.test(t))            return 'Arts & Theater';
  if (/film|movie|cinema|screen/.test(t))             return 'Film';
  if (/family|kid|child|toddler|youth|camp/.test(t))  return 'Family';
  if (/food|drink|beer|wine|tast|brew/.test(t))       return 'Food & Drink';
  if (/festival|fair|fiesta|market/.test(t))          return 'Festivals';
  if (/outdoor|hike|trail|nature|balloon|garden/.test(t)) return 'Outdoor';
  if (/sport|run|race|fitness|yoga/.test(t))          return 'Sports';
  if (/volunteer|civic|community|class|workshop/.test(t)) return 'Community';
  return 'Community';
}

// ── Meetup.com ABQ (REST v3) ─────────────────────────────────────────────────
async function fetchMeetupEvents() {
  console.log('\n👥 Fetching Meetup.com ABQ events...');
  const events = [];

  // Meetup's public endpoint for location-based events (no auth required for public events)
  const queries = [
    'https://api.meetup.com/find/upcoming_events?lat=35.1053&lon=-106.6464&radius=30&topic_category=&per_page=50&page=1',
  ];

  for (const url of queries) {
    try {
      const { status, body } = await fetchUrl(url, { accept: 'application/json' });
      if (status !== 200) {
        console.warn(`  ⚠ Meetup API returned ${status}`);
        continue;
      }
      const data   = JSON.parse(body);
      const items  = data?.events || [];

      for (const ev of items) {
        const localDate = ev.local_date;
        if (!localDate || !isFuture(localDate)) continue;

        const venue = ev.venue || {};
        events.push({
          id:     `meetup-${ev.id}`,
          source: 'meetup',
          raw: {
            name:   ev.name || 'Untitled Event',
            _source: 'meetup',
            url:    ev.link,
            info:   (ev.description || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 400),
            dates:  { start: { localDate, localTime: ev.local_time } },
            _embedded: {
              venues: [{
                name:    venue.name || ev.group?.name || '',
                address: { line1: venue.address_1 || '' },
                city:    { name: venue.city || 'Albuquerque' },
                state:   { name: venue.state || 'NM' },
              }],
            },
            classifications: [{ segment: { name: guessCat(ev.name || '', []) } }],
            isFree: ev.fee?.amount === 0 || !ev.fee,
            ticketLinks: ev.link ? [{ url: ev.link }] : [],
          },
          event_date: localDate,
        });
      }
      console.log(`  ✓ ${events.length} Meetup events`);
      await sleep(500);
    } catch (err) {
      console.warn(`  ⚠ Meetup unavailable: ${err.message.slice(0, 80)}`);
    }
  }
  return events;
}

// ── NM Magazine events ────────────────────────────────────────────────────────
async function fetchNMMagEvents() {
  console.log('\n📰 Fetching NM Magazine events...');
  const events = [];

  try {
    const { status, body } = await fetchUrl('https://www.newmexicomagazine.org/includes/rest_v2/plugins/the-events-calendar/src/The_Events_Calendar/REST/V1/Events/Maintenance/Controller.php?action=find&paged=1&per_page=50');
    if (status !== 200) { console.warn(`  ⚠ NM Magazine returned ${status}`); return events; }

    const data  = JSON.parse(body);
    const items = data?.events || data?.data || [];

    for (const ev of items) {
      const start = ev.start_date || ev.startDate || '';
      const localDate = start ? start.slice(0, 10) : null;
      if (!localDate || !isFuture(localDate)) continue;

      const venue = ev.venue || {};
      events.push({
        id:     `nmmag-${ev.id}`,
        source: 'local',
        raw: {
          name:   ev.title || ev.name || 'Untitled Event',
          _source: 'nmmag',
          url:    ev.url || ev.permalink,
          info:   stripHtml(ev.description || ev.excerpt || ''),
          dates:  { start: { localDate, localTime: start.length >= 16 ? start.slice(11, 16) : undefined } },
          _embedded: {
            venues: [{
              name:    venue.venue || venue.name || '',
              address: { line1: venue.address || '' },
              city:    { name: venue.city || 'Albuquerque' },
              state:   { name: 'NM' },
            }],
          },
          classifications: [{ segment: { name: guessCat(ev.title || ev.name || '', ev.categories || []) } }],
          isFree: /free/i.test(ev.cost || '') || !ev.cost,
          ticketLinks: (ev.url || ev.permalink) ? [{ url: ev.url || ev.permalink }] : [],
        },
        event_date: localDate,
      });
    }
    console.log(`  ✓ ${events.length} NM Magazine events`);
  } catch (err) {
    console.warn(`  ⚠ NM Magazine: ${err.message.slice(0, 80)}`);
  }
  return events;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('🗓️  ABQ Unplugged — Additional Event Sources');
  console.log('   Sources: JCC, Explora, NM Magazine, Meetup\n');

  const [jccEvents, exploraEvents, nmMagEvents, meetupEvents] = await Promise.all([
    fetchWPEvents('www.jccabq.org', 'local', 'jcc').then(evs => { console.log(`\n🕍 JCC ABQ: ${evs.length} events`); return evs; }),
    fetchWPEvents('www.explora.us', 'local', 'explora').then(evs => { console.log(`\n🔬 Explora: ${evs.length} events`); return evs; }),
    fetchNMMagEvents(),
    fetchMeetupEvents(),
  ]);

  const all = [...jccEvents, ...exploraEvents, ...nmMagEvents, ...meetupEvents];
  console.log(`\n📊 Total new events: ${all.length}`);
  console.log(`   JCC: ${jccEvents.length} | Explora: ${exploraEvents.length} | NM Mag: ${nmMagEvents.length} | Meetup: ${meetupEvents.length}`);

  if (all.length > 0) {
    console.log('\n💾 Upserting to Supabase...');
    await upsertEvents(all);
  }

  console.log('\n✅ Done.');
})().catch(err => { console.error('Fatal:', err); process.exit(1); });
