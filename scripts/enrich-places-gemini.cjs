#!/usr/bin/env node
/**
 * ABQ Unplugged — Place Enrichment
 *
 * Model priority:
 *   1. qwen/qwen2.5-coder-14b on Windows PC 10.0.0.53:1234  (~8s/place, fast & capable)
 *   2. Gemini 2.5-pro CLI  (daily quota fallback)
 *   3. Gemini 2.0-flash CLI (higher quota fallback)
 *
 * Usage:
 *   node scripts/enrich-places-gemini.cjs
 *   node scripts/enrich-places-gemini.cjs --category museum --limit 20
 *   node scripts/enrich-places-gemini.cjs --force
 *   node scripts/enrich-places-gemini.cjs --dry-run
 *   node scripts/enrich-places-gemini.cjs --model gemini-pro
 *   node scripts/enrich-places-gemini.cjs --model gemini-flash
 */
'use strict';

const fs           = require('fs');
const path         = require('path');
const http         = require('http');
const https        = require('https');
const { execSync } = require('child_process');

const PLACES_FILE = path.join(__dirname, '../public/places-data.json');

// ── Supabase config for syncing enriched data to DB ──────────────────────────
const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  || 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

/** Sync enriched data to the Supabase `places.enriched` column (JSONB) */
function syncToSupabase(placeId, enrichedObj) {
  if (!placeId) return Promise.resolve(false);
  const dbId = String(placeId).startsWith('google_') ? placeId : `google_${placeId}`;
  const body = JSON.stringify({ enriched: enrichedObj });
  const url = new URL(`${SUPABASE_URL}/rest/v1/places?id=eq.${dbId}`);
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 300) console.warn(`  ⚠ Supabase sync ${dbId}: ${res.statusCode} ${data.slice(0,100)}`);
        resolve(res.statusCode < 300);
      });
    });
    req.on('error', (err) => { console.warn(`  ⚠ Supabase sync error: ${err.message}`); resolve(false); });
    req.setTimeout(10000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}
const GEMINI_BIN  = '/opt/homebrew/bin/gemini';
const MODEL_PRO   = 'gemini-2.5-pro';
const MODEL_FLASH = 'gemini-2.0-flash';
const LM_HOST     = '10.0.0.53';
const LM_PORT     = 1234;
const LM_MODEL    = 'qwen/qwen2.5-coder-14b';
const DELAY_MS    = 50;   // local LM Studio needs almost no delay
const BATCH_SAVE  = 10;
const CONCURRENCY = 5;   // parallel workers — Windows PC with 14B coder model
const MAX_RETRIES = 2;

const args           = process.argv.slice(2);
const getArg         = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i+1] : null; };
const filterCategory = getArg('--category');
const limitCount     = parseInt(getArg('--limit') || '9999', 10);
const forceRedo      = args.includes('--force');
const dryRun         = args.includes('--dry-run');
const forceModel     = getArg('--model');

const CTX = {
  restaurant:    { tone: 'warm and appetizing',       extras: 'cuisine type, signature dishes, ambiance, best time to visit, must-order items' },
  bar:           { tone: 'lively and inviting',        extras: 'drink specialties, live music, happy hour, vibe, local favorites' },
  museum:        { tone: 'informative and inspiring',  extras: 'collections, standout exhibits, admission, free days, hidden gems' },
  arts:          { tone: 'creative and evocative',     extras: 'art type or performances, notable shows, community role, ticket info' },
  park:          { tone: 'adventurous and grounding',  extras: 'trails, wildlife, views, amenities, best season, dog-friendly' },
  entertainment: { tone: 'exciting and fun',           extras: 'experience description, age appropriateness, booking tips, insider tricks' },
  shop:          { tone: 'enthusiastic and specific',  extras: 'what they sell, local vs chain, unique finds, price range' },
  fitness:       { tone: 'motivating and informative', extras: 'facilities or classes, membership vs drop-in, specialty focus' },
  hotel:         { tone: 'welcoming and descriptive',  extras: 'amenities, location perks, historic features, pet-friendly, pool/spa' },
  other:         { tone: 'curious and informative',    extras: 'what makes this place interesting or valuable to locals' },
};

function buildPrompt(p) {
  const ctx = CTX[p.category] || CTX.other;
  return `You are a local Albuquerque expert. Write accurate content for "ABQ Unplugged" — a local discovery app.

Place: ${p.name} | Category: ${p.category} | Address: ${p.address || 'Albuquerque, NM'} | Rating: ${p.rating || 'unknown'} | Price: ${p.priceLevel ? '$'.repeat(p.priceLevel) : 'unknown'}

Tone: ${ctx.tone}. Cover: ${ctx.extras}. Include ABQ/NM context where relevant (Route 66, Old Town, Pueblo history, green chile, Rio Grande). Only state facts you are confident about.

Output ONLY a raw JSON object. No markdown fences, no extra text before or after.

{"description":"2-3 sentence hook","about":"3-5 sentence rich history and character paragraph","website":"official URL or empty string","phone":"(505) 555-1234 or empty string","historicNote":"1-2 sentences on significance or empty string","insiderTip":"1 local tip or empty string","bestFor":["2-4 short tags"],"priceNote":"cost summary or empty string","parkingInfo":"parking tip or empty string"}`;
}

function parseJSON(text) {
  const clean = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```json?\s*/im, '').replace(/```\s*$/m, '').trim();
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error(`No JSON: ${text.slice(0, 120)}`);
  return JSON.parse(clean.slice(s, e + 1));
}

function checkLMStudio() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: LM_HOST, port: LM_PORT, path: '/v1/models', method: 'GET' }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const ids = JSON.parse(data).data.map(m => m.id);
          resolve(ids.includes(LM_MODEL) || ids.some(m => m.includes('qwen3.5') || m.includes('qwen/qwen')));
        } catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(4000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function callLMStudio(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: LM_MODEL, temperature: 0.3, max_tokens: 2048, stream: false,
      messages: [{ role: 'user', content: prompt }],
    });
    const req = http.request({
      hostname: LM_HOST, port: LM_PORT, path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parseJSON(parsed.choices?.[0]?.message?.content || ''));
        } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('LM Studio timeout')); });
    req.write(body); req.end();
  });
}

let gCount = 0;
function callGeminiCLI(prompt, model) {
  const tmp = `/tmp/_abq_${Date.now()}_${++gCount}.txt`;
  fs.writeFileSync(tmp, prompt, 'utf8');
  try {
    const raw = execSync(`"${GEMINI_BIN}" -m ${model} < "${tmp}" 2>&1`,
      { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 120000 });
    if (/quota_exhausted|exhausted your capacity/i.test(raw)) throw new Error('QUOTA_EXHAUSTED');
    if (/rate.?limit|429/i.test(raw)) throw new Error('RATE_LIMITED');
    return parseJSON(raw);
  } finally { try { fs.unlinkSync(tmp); } catch {} }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const lmAvailable = !forceModel && await checkLMStudio();
  let backend = lmAvailable ? 'lmstudio' :
                forceModel === 'gemini-flash' ? 'gemini-flash' : 'gemini-pro';

  console.log(`\n🗺  ABQ Unplugged — Place Enrichment`);
  if (backend === 'lmstudio')
    console.log(`   ✅ Windows PC: ${LM_MODEL} @ ${LM_HOST}:${LM_PORT}`);
  else
    console.log(`   backend: ${backend}${!lmAvailable && !forceModel ? ` (LM Studio unreachable)` : ''}`);
  if (filterCategory) console.log(`   category: ${filterCategory}`);
  if (dryRun) console.log(`   *** DRY RUN ***`);
  console.log('');

  const places  = JSON.parse(fs.readFileSync(PLACES_FILE, 'utf8'));
  const targets = places.filter(p => {
    if (!p.name || p.name === 'Albuquerque') return false;
    if (filterCategory && p.category !== filterCategory) return false;
    if (!forceRedo && p.enriched) return false;
    return true;
  }).slice(0, limitCount);

  const byCat = {};
  targets.forEach(p => byCat[p.category] = (byCat[p.category]||0)+1);
  console.log(`${targets.length} to enrich  |  ${places.filter(p=>p.enriched).length} done  |  ${places.length} total`);
  Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([c,n])=>console.log(`   ${String(n).padStart(4)}  ${c}`));
  if (backend === 'lmstudio') {
    const est = Math.round(targets.length * 10 / 60);
    console.log(`\n   ⏱  Est. time: ~${est} min at ~10s/place`);
  }
  console.log('');
  if (dryRun) return;

  let done = 0, errors = 0;
  let saving = false; // prevent concurrent file writes

  // ── Concurrent worker pool ─────────────────────────────────────────────────
  // Each worker pulls from the shared queue until empty.
  // JS is single-threaded so counter increments are race-free; only file I/O
  // needs the `saving` guard to avoid overlapping writes.

  async function processOne(place, workerIdx) {
    const idx = places.findIndex(p => p.id === place.id);
    if (idx === -1) return;

    const label = `[${place.name.slice(0,40)} (${place.category})]`;
    let result = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const prompt = buildPrompt(place);
        if (backend === 'lmstudio') {
          result = await callLMStudio(prompt);
          result._b = `lmstudio:${LM_MODEL}`;
        } else {
          const model = backend === 'gemini-flash' ? MODEL_FLASH : MODEL_PRO;
          result = callGeminiCLI(prompt, model);
          result._b = model;
        }
        break;
      } catch (err) {
        const msg = err.message;
        if (msg === 'QUOTA_EXHAUSTED' && backend === 'gemini-pro') {
          console.log(`\n⚡ Pro → Flash`); backend = 'gemini-flash';
        } else if (msg === 'QUOTA_EXHAUSTED') {
          console.log(`\n⏸  Quota exhausted — pausing 2 min...`); await sleep(120000);
        } else if (msg === 'RATE_LIMITED') {
          await sleep(60000);
        } else if (msg.includes('timeout') && backend === 'lmstudio') {
          console.log(`\n⚡ LM Studio timeout → Gemini Pro`); backend = 'gemini-pro';
        } else if (attempt <= MAX_RETRIES) {
          process.stdout.write(`  (retry ${attempt}) `);
          await sleep(DELAY_MS * attempt * 3);
        } else {
          console.error(`✗ ${label}: ${msg.slice(0, 100)}`); errors++;
        }
      }
    }

    if (result) {
      places[idx] = {
        ...places[idx],
        description:  result.description  || places[idx].description || '',
        about:        result.about        || '',
        website:      result.website      || places[idx].website     || '',
        phone:        result.phone        || places[idx].phone       || '',
        historicNote: result.historicNote || '',
        insiderTip:   result.insiderTip   || '',
        bestFor:      Array.isArray(result.bestFor) ? result.bestFor : [],
        priceNote:    result.priceNote    || '',
        parkingInfo:  result.parkingInfo  || '',
        enriched:     true,
        enrichedAt:   new Date().toISOString(),
        enrichedWith: result._b,
      };
      done++;
      // Sync to Supabase enriched column with UI-expected field names
      const enrichedPayload = {
        tip:       result.insiderTip   || '',
        hours:     '',  // hours come from Google, not enrichment
        phone:     result.phone        || '',
        website:   result.website      || '',
        editorial: result.about        || '',
        parking:   result.parkingInfo  || '',
        menu:      '',
        historicNote: result.historicNote || '',
        bestFor:      Array.isArray(result.bestFor) ? result.bestFor : [],
        priceNote:    result.priceNote    || '',
      };
      syncToSupabase(place.id, enrichedPayload).catch(() => {});
      console.log(`✓ [${done}/${targets.length}] ${label} — ${(result.description||'').slice(0,60)}…`);

      if (done % BATCH_SAVE === 0 && !saving) {
        saving = true;
        fs.writeFileSync(PLACES_FILE, JSON.stringify(places, null, 2));
        console.log(`\n   💾  saved (${done}/${targets.length} | ${errors} errors)\n`);
        saving = false;
      }
    }
    if (backend !== 'lmstudio') await sleep(DELAY_MS); // only throttle Gemini
  }

  // Build queue and launch CONCURRENCY workers
  const queue = [...targets];
  async function worker() {
    while (queue.length > 0) {
      const place = queue.shift();
      if (place) await processOne(place);
    }
  }

  const numWorkers = backend === 'lmstudio' ? CONCURRENCY : 1;
  console.log(`   🚀  Launching ${numWorkers} worker${numWorkers > 1 ? 's' : ''}...\n`);
  await Promise.all(Array.from({ length: numWorkers }, worker));

  fs.writeFileSync(PLACES_FILE, JSON.stringify(places, null, 2));
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅  ${done} enriched    ❌  ${errors} errors`);
  console.log(`\n  git add public/places-data.json && git commit -m "Enrich: ${done} places" && git push origin main`);
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
