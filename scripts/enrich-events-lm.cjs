#!/usr/bin/env node
/**
 * enrich-events-lm.cjs
 * 
 * Uses a locally-running LM Studio model to enrich ABQ Unplugged events with:
 *   - about:       1-2 sentences about the artist / act / event
 *   - highlights:  2-3 bullet points on what to expect
 *   - venue_tips:  parking, transit, and arrival tips for the venue
 *   - local_tips:  ABQ-specific tips (food nearby, things to do before/after)
 *
 * Run: node scripts/enrich-events-lm.cjs
 *
 * Requires LM Studio running at http://localhost:1234 with a model loaded.
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from scripts/.env
 *
 * Safe to re-run — skips events that already have ai_enrichment.
 * Use --force to re-enrich everything, --limit=N to cap the batch.
 */

'use strict';
const https  = require('https');
const http   = require('http');
const path   = require('path');
const fs     = require('fs');

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LM_STUDIO_URL     = process.env.LM_STUDIO_URL || 'http://localhost:1234';
const LM_MODEL          = process.env.LM_MODEL      || 'google/gemma-4-e4b';
const CONCURRENCY       = parseInt(process.env.CONCURRENCY || '1', 10); // 1 = safe; model takes ~50s/event
const FORCE             = process.argv.includes('--force');
const LIMIT_ARG         = process.argv.find(a => a.startsWith('--limit='));
const LIMIT             = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;
const ID_ARG            = process.argv.find(a => a.startsWith('--id='));
const SINGLE_ID         = ID_ARG ? ID_ARG.split('=').slice(1).join('=') : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env');
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
      timeout: opts.timeout || 60000,
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
        } else {
          try { resolve(JSON.parse(text)); }
          catch { resolve(text); }
        }
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

// ── LM Studio call ─────────────────────────────────────────────────────────────
async function callLM(prompt, retries = 2) {
  const payload = {
    model:       LM_MODEL,
    messages:    [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens:  1200,
    stream:      false,
  };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await request(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 180000,
      }, payload);
      return res.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
      if (attempt < retries) {
        console.warn(`  ⚠ LM retry ${attempt + 1}/${retries}: ${err.message}`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
}

// ── Category detection for prompt tone ────────────────────────────────────────
function detectCategory(event) {
  const raw  = event.raw || event;
  const name = (raw.name || '').toLowerCase();
  const desc = (raw.info || raw.description || '').toLowerCase();
  const seg  = (raw.classifications?.[0]?.segment?.name || '').toLowerCase();
  const gen  = (raw.classifications?.[0]?.genre?.name   || '').toLowerCase();
  const t    = name + ' ' + desc + ' ' + seg + ' ' + gen;

  if (/comedy|stand.?up|improv|laugh/.test(t))                          return 'comedy';
  if (/hike|trail|outdoor|nature|garden|park|river|mountain|balloon/.test(t)) return 'outdoor';
  if (/pottery|clay|craft|knit|sew|paint|draw|sculpt|ceramic/.test(t)) return 'craft';
  if (/yoga|meditation|wellness|mindful|breathe/.test(t))               return 'wellness';
  if (/volunteer|food bank|community|service|cleanup/.test(t))          return 'community';
  if (/food|dinner|tasting|beer|wine|cocktail|brew|restaurant/.test(t)) return 'food';
  if (/sport|game|match|race|5k|marathon|football|baseball|basketball|soccer/.test(t)) return 'sports';
  if (/dance|ballet|theater|theatre|musical|opera|play/.test(t))        return 'arts';
  if (/family|kid|child|toddler|storytime|youth/.test(t))               return 'family';
  if (/music|concert|band|dj|festival|live/.test(t))                    return 'music';
  return 'general';
}

// Category-specific motivation hooks for the "why go" highlight
const MOTIVATION_HOOKS = {
  comedy:    'Science says: laughter triggers endorphins and cuts cortisol in half — this is literally medicine for your stress.',
  outdoor:   'Getting outdoors reduces anxiety and cortisol levels within 20 minutes — your nervous system was built for this.',
  craft:     'Hands-on making puts you in a flow state that silences the mental chatter modern life never shuts off.',
  wellness:  'Communal movement and breathwork create a sense of shared presence that solo home practice simply can\'t replicate.',
  community: 'Research shows volunteering and community involvement are among the strongest predictors of long-term life satisfaction.',
  food:      'Breaking bread together is one of the oldest human bonding rituals — meals out strengthen relationships in ways texting can\'t.',
  sports:    'Live sports trigger the same tribal belonging circuits that kept human communities tight for 200,000 years. Feel the crowd.',
  arts:      'Experiencing art with others activates mirror neurons and creates shared emotional memories that last years.',
  family:    'Shared experiences outside the home build family identity — kids remember adventures, not screen time.',
  music:     'Live music synchronizes heartbeats across strangers. Your body literally gets on the same rhythm as the people around you.',
  general:   'Getting out and meeting people in person is one of the most powerful things you can do for your mental health.',
};

// ── ABQ neighborhood lookup ────────────────────────────────────────────────────
// Maps venue names and street addresses to accurate Albuquerque neighborhood context.
// This prevents the LLM from guessing and hallucinating location details.
const KNOWN_VENUES = {
  'nexus brewery':              { neighborhood: 'near I-25 / Pan American Freeway in northeast Albuquerque (midtown, close to Uptown)', parking: 'Large parking lot on-site.' },
  'isleta amphitheater':        { neighborhood: 'in the South Valley near I-25 south', parking: 'Large parking lots on-site; expect traffic — arrive 45 min early for big shows.' },
  'isleta amphitheatre':        { neighborhood: 'in the South Valley near I-25 south', parking: 'Large parking lots on-site; expect traffic — arrive 45 min early for big shows.' },
  'tingley coliseum':           { neighborhood: 'at Expo New Mexico / State Fairgrounds, midtown (near Louisiana Blvd)', parking: 'Fairgrounds parking on-site; $10–15 typical.' },
  'expo new mexico':            { neighborhood: 'at the State Fairgrounds, midtown Albuquerque', parking: 'Large fairgrounds parking; $10–15 typical.' },
  'sandia resort':              { neighborhood: 'at the base of the Sandia Mountains in the far northeast (Tramway area)', parking: 'Free valet and self-parking on-site.' },
  'sandia casino':              { neighborhood: 'at the base of the Sandia Mountains in the far northeast (Tramway area)', parking: 'Free parking on-site.' },
  'hard rock hotel':            { neighborhood: 'in the South Valley near I-25 south (exit 220)', parking: 'Free parking on-site.' },
  'hard rock casino':           { neighborhood: 'in the South Valley near I-25 south (exit 220)', parking: 'Free parking on-site.' },
  'popejoy hall':               { neighborhood: 'on the UNM campus in central Albuquerque', parking: 'UNM parking structures nearby; Yale Parking Structure is closest.' },
  'keller hall':                { neighborhood: 'on the UNM campus in central Albuquerque', parking: 'UNM parking structures nearby.' },
  'launchpad':                  { neighborhood: 'on Central Ave in Downtown/EDo (East Downtown)', parking: 'Street parking on Central and side streets; Albuquerque has free 2-hour street parking downtown.' },
  'sunshine theater':           { neighborhood: 'on Central Ave in Downtown Albuquerque', parking: 'Street parking on Central; free city lot nearby on 1st St.' },
  'meow wolf':                  { neighborhood: 'in the Railyard district of Santa Fe (not Albuquerque — about 60 miles north)', parking: 'Dedicated parking lot adjacent.' },
  'kiva auditorium':            { neighborhood: 'at the Albuquerque Convention Center, Downtown', parking: 'Convention Center parking garage on-site (paid).' },
  'albuquerque convention':     { neighborhood: 'in Downtown Albuquerque', parking: 'Convention Center parking garage (paid); street parking available.' },
  'isotopes park':              { neighborhood: 'just south of UNM on Avenida Cesar Chavez, central Albuquerque', parking: 'Large stadium lots on-site; $5–10.' },
  'rio rancho events center':   { neighborhood: 'in Rio Rancho, about 15 miles northwest of downtown Albuquerque', parking: 'Free parking on-site.' },
  'rio rancho civic center':    { neighborhood: 'in Rio Rancho, about 15 miles northwest of downtown Albuquerque', parking: 'Free parking adjacent.' },
  'nob hill':                   { neighborhood: 'in the Nob Hill neighborhood along Central Ave, east of Downtown', parking: 'Street parking on Central and side streets.' },
  'hotel albuquerque':          { neighborhood: 'in Old Town Albuquerque, near the original plaza', parking: 'Hotel parking garage on-site.' },
  'duran\'s pharmacy':          { neighborhood: 'in Old Town / Barelas neighborhood near 12th and Central', parking: 'Small lot; street parking nearby.' },
  'abq biopark':                { neighborhood: 'in Albuquerque\'s South Valley/Barelas near the Rio Grande', parking: 'Large parking lots on-site; $3 typical.' },
  'biopark':                    { neighborhood: 'near the Rio Grande in central/south Albuquerque', parking: 'Large parking lots on-site.' },
  'albuquerque museum':         { neighborhood: 'in Old Town Albuquerque near the plaza', parking: 'Museum lot on Mountain Rd; Old Town street parking nearby.' },
  'national hispanic cultural': { neighborhood: 'in the Barelas neighborhood, south of Downtown along 4th St', parking: 'Free parking lot on-site.' },
};

function getVenueContext(venueName, address) {
  const key = (venueName || '').toLowerCase();
  const addr = (address || '').toLowerCase();
  const combined = key + ' ' + addr;

  // Check known venues first (most accurate)
  for (const [pattern, info] of Object.entries(KNOWN_VENUES)) {
    if (combined.includes(pattern)) return info;
  }

  // Derive neighborhood from street/address patterns
  let neighborhood = null;
  let parking = null;

  if (/pan american|pan-american freeway/.test(addr)) {
    neighborhood = 'near the Pan American Freeway (I-25), midtown Albuquerque';
    parking = 'Parking is typically available in adjacent lots off the frontage road.';
  } else if (/central ave/.test(addr)) {
    const block = parseInt(addr.match(/(\d+)\s+central/)?.[1] || '0');
    if (block < 1000)       neighborhood = 'on Central Ave in Downtown Albuquerque';
    else if (block < 3000)  neighborhood = 'on Central Ave / EDo (East Downtown)';
    else if (block < 5000)  neighborhood = 'on Central Ave in the Nob Hill neighborhood';
    else if (block < 8000)  neighborhood = 'on Central Ave in the Heights';
    else                    neighborhood = 'on Central Ave in the Far Heights';
  } else if (/university blvd/.test(addr)) {
    neighborhood = 'on University Blvd near UNM, central Albuquerque';
  } else if (/lomas blvd/.test(addr)) {
    neighborhood = 'on Lomas Blvd in central Albuquerque';
  } else if (/paseo del norte/.test(addr)) {
    neighborhood = 'near Paseo del Norte, in the north Albuquerque / Journal Center area';
  } else if (/montgomery/.test(addr)) {
    neighborhood = 'on Montgomery in the Northeast Heights';
  } else if (/academy.*ne|ne.*academy/.test(addr)) {
    neighborhood = 'in the Northeast Heights near Academy Blvd';
  } else if (/rio rancho/.test(addr) || /rio rancho/.test(key)) {
    neighborhood = 'in Rio Rancho, about 15 miles northwest of downtown Albuquerque';
  } else if (/4th st.*nw|nw.*4th/.test(addr)) {
    neighborhood = 'on North 4th St NW, in the North Valley area';
  } else if (/old town|mountain rd nw/.test(addr)) {
    neighborhood = 'in Old Town Albuquerque';
  } else if (/downtown|civic plaza|marquette|gold ave|copper ave/.test(addr)) {
    neighborhood = 'in Downtown Albuquerque';
  }

  if (neighborhood || parking) return { neighborhood, parking };
  return null;
}

// ── Build prompt ──────────────────────────────────────────────────────────────
function buildPrompt(event) {
  const raw        = event.raw || event;
  const name       = raw.name || raw.title || 'Unknown Event';

  // Support both TM-format (_embedded.venues) and Eventbrite/local (venue field)
  const tmVenue    = raw._embedded?.venues?.[0];
  const ebVenue    = raw.venue;
  const venueName  = tmVenue?.name || (typeof ebVenue === 'object' ? ebVenue?.name : ebVenue) || '';
  const addrLine   = tmVenue?.address?.line1
                  || (typeof ebVenue === 'object' ? ebVenue?.address?.localized_address_display || ebVenue?.address?.address_1 : null)
                  || raw.address || '';
  const cityName   = tmVenue?.city?.name || (typeof ebVenue === 'object' ? ebVenue?.address?.city : null) || 'Albuquerque';
  const venueAddr  = addrLine ? `${addrLine}, ${cityName}, NM` : `${cityName}, NM`;

  const date       = raw.dates?.start?.localDate || raw.event_date || '';
  const time       = raw.dates?.start?.localTime || '';
  const segment    = raw.classifications?.[0]?.segment?.name || '';
  const genre      = raw.classifications?.[0]?.genre?.name   || '';
  const info       = raw.info || raw.description || (typeof raw.description === 'object' ? raw.description?.text : '') || '';
  const parking    = tmVenue?.parkingDetail || '';
  const category   = [segment, genre].filter(Boolean).join(' / ');
  const cat        = detectCategory(event);
  const motivation = MOTIVATION_HOOKS[cat];

  // Pre-compute neighborhood so the model doesn't have to guess
  const venueCtx   = getVenueContext(venueName, addrLine);
  const neighborhoodLine = venueCtx?.neighborhood
    ? `- Venue neighborhood (use this, do NOT contradict it): ${venueCtx.neighborhood}`
    : '';
  const parkingLine = (venueCtx?.parking || parking)
    ? `- Parking info: ${venueCtx?.parking || parking.slice(0, 200)}`
    : '';

  return `You are a passionate local Albuquerque events guide whose mission is to get people off their couches and into the city together. You believe in-person experiences are transformative.

Given the following event details, produce a JSON object with exactly these keys:

{
  "about": "1-2 sentences about the artist, performer, or event — specific and interesting, NOT generic. For bands: mention their sound and a notable fact. For sports: mention teams and stakes. For community events: paint the vivid experience.",
  "highlights": [
    "specific highlight about what attendees will experience",
    "another concrete, enthusiastic thing to expect",
    "${motivation}"
  ],
  "venue_tips": "1-2 practical sentences covering: where the venue is in the city (use the neighborhood context provided — do NOT contradict it), parking or transit tips, and anything useful about arrival.",
  "local_tips": "1 warm, insider sentence — a nearby restaurant, bar, coffee shop, or activity to pair with this event. Name a real, specific ABQ spot."
}

EVENT DETAILS:
- Name: ${name}
- Category: ${category || 'Event'}
- Date: ${date}${time ? ' at ' + time : ''}
- Venue: ${venueName}${venueAddr !== cityName + ', NM' ? ' — ' + venueAddr : ''}
${neighborhoodLine}
${parkingLine}
${info ? `- Description: ${info.slice(0, 400)}` : ''}

Rules:
- Return ONLY the raw JSON object. No markdown, no code fences, no extra text.
- "highlights" MUST be an array of exactly 3 strings.
- The third highlight MUST be the motivation hook provided — include it verbatim or closely paraphrased.
- Keep each field warm, direct, and human. Avoid corporate/generic language.
- CRITICAL: If a "Venue neighborhood" line is provided above, use it verbatim for location context in venue_tips. NEVER contradict it or substitute your own geographic claim.
- If no neighborhood context is provided, describe the venue only by its street/address — do NOT guess or claim which part of the city it is in.
- Local tips should name specific, real ABQ restaurants or bars near the venue (Frontier Restaurant, Casa de Benavidez, Duran's Pharmacy, Nob Hill spots, etc.).
- NEVER mention specific days of the week (Monday, Tuesday, Friday, etc.) in "about" or "highlights" unless the event details above explicitly state which days. Never invent a recurring schedule.
- For volunteer/signup events, describe what participants do — not when slots are available.
- If the event is in Rio Rancho or Santa Fe (not Albuquerque), acknowledge that in venue_tips.`;
}

// ── Parse LM response ─────────────────────────────────────────────────────────
function parseEnrichment(text) {
  // Strip thinking tags if present (some models emit <think>...</think>)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip markdown code fences
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
  // Extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('  ⚠ Raw response (first 500 chars):', text.slice(0, 500));
    throw new Error('No JSON found in response');
  }
  const parsed = JSON.parse(jsonMatch[0]);
  // Validate and sanitize
  return {
    about:       typeof parsed.about       === 'string'  ? parsed.about.trim()                         : null,
    highlights:  Array.isArray(parsed.highlights)        ? parsed.highlights.map(h => String(h).trim()) : [],
    venue_tips:  typeof parsed.venue_tips  === 'string'  ? parsed.venue_tips.trim()                    : null,
    local_tips:  typeof parsed.local_tips  === 'string'  ? parsed.local_tips.trim()                    : null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖  ABQ Unplugged — LM Studio Event Enrichment');
  console.log(`    Model: ${LM_MODEL}`);
  console.log(`    Endpoint: ${LM_STUDIO_URL}`);
  if (SINGLE_ID) console.log(`    Single event: ${SINGLE_ID}`);
  else console.log(`    Mode: ${FORCE ? 'FORCE (re-enrich all)' : 'INCREMENTAL (skip enriched)'}`);
  if (LIMIT < Infinity) console.log(`    Limit: ${LIMIT}`);
  console.log('');

  // 1. Ping LM Studio
  try {
    await request(`${LM_STUDIO_URL}/v1/models`, { timeout: 5000 });
    console.log('✅  LM Studio is running\n');
  } catch {
    console.error('❌  Cannot reach LM Studio at', LM_STUDIO_URL);
    console.error('    Make sure LM Studio is open and a model is loaded.');
    process.exit(1);
  }

  // 2. Fetch events needing enrichment
  const today     = new Date().toISOString().split('T')[0];
  let filter;
  if (SINGLE_ID) {
    filter = `id=eq.${encodeURIComponent(SINGLE_ID)}`;
  } else if (FORCE) {
    filter = `event_date=gte.${today}&raw->>name=not.is.null&order=event_date.asc&limit=500`;
  } else {
    filter = `event_date=gte.${today}&ai_enrichment=is.null&raw->>name=not.is.null&order=event_date.asc&limit=500`;
  }

  console.log('📥  Fetching events from Supabase…');
  const rows = await sbGet(`events?${filter}&select=id,source,raw`);
  if (!Array.isArray(rows)) {
    console.error('❌  Unexpected response from Supabase:', rows);
    process.exit(1);
  }

  const toProcess = rows.slice(0, LIMIT);
  console.log(`    Found ${rows.length} events needing enrichment (processing ${toProcess.length})\n`);

  if (toProcess.length === 0) {
    console.log('✨  Nothing to do — all upcoming events are already enriched.');
    return;
  }

  // 3. Process with concurrency limit
  let done = 0, failed = 0;

  async function processOne(row) {
    const eventName = row.raw?.name || row.id;
    try {
      const prompt     = buildPrompt(row);
      const response   = await callLM(prompt);
      const enrichment = parseEnrichment(response);
      await sbPatch('events', row.id, { ai_enrichment: enrichment });
      done++;
      console.log(`  ✅ [${done}/${toProcess.length}] ${eventName}`);
    } catch (err) {
      failed++;
      console.warn(`  ❌ [${done + failed}/${toProcess.length}] ${eventName} — ${err.message}`);
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(processOne));
  }

  console.log(`\n🏁  Done — ${done} enriched, ${failed} failed`);
  if (failed > 0) console.log('    Re-run to retry failed events.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
