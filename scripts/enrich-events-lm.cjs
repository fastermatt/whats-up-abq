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
const LM_MODEL          = process.env.LM_MODEL      || 'qwen/qwen3.5-9b';
const CONCURRENCY       = parseInt(process.env.CONCURRENCY || '2', 10);
const FORCE             = process.argv.includes('--force');
const LIMIT_ARG         = process.argv.find(a => a.startsWith('--limit='));
const LIMIT             = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : Infinity;

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
    temperature: 0.4,
    max_tokens:  600,
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

  return `You are a local Albuquerque events guide. Given the following event details, produce a JSON object with exactly these keys:

{
  "about": "1-2 sentence description of the artist, performer, or event type. Be specific and interesting — not generic.",
  "highlights": ["2-3 short bullet points about what attendees can expect — specific, enthusiastic, useful"],
  "venue_tips": "1-2 sentences about parking, transit options, or arrival tips for this specific venue in Albuquerque.",
  "local_tips": "1 sentence ABQ-specific tip — a nearby restaurant, bar, or thing to do before/after the event."
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
- Keep each field concise. "highlights" must be an array of strings.
- If you don't know specific facts, give practical general advice appropriate for ABQ.
- For "about": if it's a band/artist, mention their style or a notable fact. If it's a sports game, mention the teams. If community/local event, describe the experience.`;
}

// ── Parse LM response ─────────────────────────────────────────────────────────
function parseEnrichment(text) {
  // Strip thinking tags if present (some models emit <think>...</think>)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');
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
  console.log(`    Mode: ${FORCE ? 'FORCE (re-enrich all)' : 'INCREMENTAL (skip enriched)'}`);
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
  const filter    = FORCE
    ? `event_date=gte.${today}&order=event_date.asc&limit=500`
    : `event_date=gte.${today}&ai_enrichment=is.null&order=event_date.asc&limit=500`;

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
