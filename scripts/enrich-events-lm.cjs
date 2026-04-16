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
const LM_MODEL          = process.env.LM_MODEL      || 'gemma-4-e4b-uncensored-hauhaucs-aggressive';
const CONCURRENCY       = parseInt(process.env.CONCURRENCY || '2', 10);
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
    max_tokens:  800,
    stream:      false,
  };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await request(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 90000,
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

// ── Build prompt ──────────────────────────────────────────────────────────────
function buildPrompt(event) {
  const raw        = event.raw || event;
  const name       = raw.name || 'Unknown Event';
  const venue      = raw._embedded?.venues?.[0];
  const venueName  = venue?.name || '';
  const venueAddr  = venue?.address?.line1 ? `${venue.address.line1}, ${venue.city?.name || 'Albuquerque'}, NM` : 'Albuquerque, NM';
  const date       = raw.dates?.start?.localDate || '';
  const time       = raw.dates?.start?.localTime || '';
  const segment    = raw.classifications?.[0]?.segment?.name || '';
  const genre      = raw.classifications?.[0]?.genre?.name   || '';
  const info       = raw.info || raw.description || '';
  const parking    = venue?.parkingDetail || '';
  const category   = [segment, genre].filter(Boolean).join(' / ');
  const cat        = detectCategory(event);
  const motivation = MOTIVATION_HOOKS[cat];

  return `You are a passionate local Albuquerque events guide whose mission is to get people off their couches and into the city together. You believe in-person experiences are transformative.

Given the following event details, produce a JSON object with exactly these keys:

{
  "about": "1-2 sentences about the artist, performer, or event — specific and interesting, NOT generic. For bands: mention their sound and a notable fact. For sports: mention teams and stakes. For community events: paint the experience.",
  "highlights": [
    "specific highlight about what attendees will experience",
    "another concrete, enthusiastic thing to expect",
    "${motivation}"
  ],
  "venue_tips": "1-2 practical sentences about parking, transit, or arrival tips for this venue in Albuquerque (be specific to the neighborhood).",
  "local_tips": "1 warm, insider sentence — a nearby restaurant, bar, coffee shop, or activity to pair with this event. Make it feel like advice from a local friend."
}

EVENT DETAILS:
- Name: ${name}
- Category: ${category || 'Event'}
- Date: ${date}${time ? ' at ' + time : ''}
- Venue: ${venueName}${venueAddr ? ' — ' + venueAddr : ''}
${info ? `- Description: ${info.slice(0, 400)}` : ''}
${parking ? `- Venue parking info: ${parking.slice(0, 200)}` : ''}

Rules:
- Return ONLY the raw JSON object. No markdown, no code fences, no extra text.
- "highlights" MUST be an array of exactly 3 strings.
- The third highlight MUST be the motivation hook provided — include it verbatim or closely paraphrased.
- Keep each field warm, direct, and human. Avoid corporate/generic language.
- Local tips should name actual ABQ spots (Frontier Restaurant, Casa de Benavidez, Nob Hill, Old Town, etc.) when relevant.
- If you don't know the exact venue details, give solid general tips for that part of ABQ.
- NEVER mention specific days of the week (Monday, Tuesday, Friday, etc.) in "about" or "highlights" unless the event details above explicitly state which days. Never invent a recurring schedule or specific day.
- For volunteer/signup events, describe what participants do — not when slots are available.`;
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
