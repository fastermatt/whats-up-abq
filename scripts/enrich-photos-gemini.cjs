#!/usr/bin/env node
/**
 * ABQ Unplugged — Photo URL Enrichment via Gemini CLI
 *
 * Finds places in places-data.json that have no photo reference in raw.photos,
 * and asks Gemini to locate a real, publicly accessible photo URL for each one.
 * Also regenerates places-data.json from Supabase after updating.
 *
 * Uses Gemini CLI (gemini) which must be authenticated (`gemini auth` or API key set).
 *
 * Data flow:
 *   Supabase places table → filter no-photo rows → Gemini web search per place
 *   → verify URL is a real image → UPDATE raw.photoUrl in Supabase
 *   → regenerate public/places-data.json
 *
 * Usage:
 *   node scripts/enrich-photos-gemini.cjs
 *   node scripts/enrich-photos-gemini.cjs --limit 20        # process at most 20 places
 *   node scripts/enrich-photos-gemini.cjs --dry-run         # preview only, no writes
 *   node scripts/enrich-photos-gemini.cjs --force           # re-run even if photoUrl exists
 *   node scripts/enrich-photos-gemini.cjs --category museum # filter by category
 *   node scripts/enrich-photos-gemini.cjs --model flash     # use gemini-2.0-flash (higher quota)
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const https        = require('https');
const http         = require('http');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────
const PLACES_JSON = path.join(__dirname, '../public/places-data.json');
const GEMINI_BIN  = '/opt/homebrew/bin/gemini';
const MODEL_PRO   = 'gemini-2.5-pro';
const MODEL_FLASH = 'gemini-2.0-flash';
const DELAY_MS    = 800;   // polite delay between Gemini calls
const BATCH_SAVE  = 5;     // save to Supabase every N updates

// ── Args ──────────────────────────────────────────────────────────────────────
const args           = process.argv.slice(2);
const getArg         = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i+1] : null; };
const dryRun         = args.includes('--dry-run');
const forceRedo      = args.includes('--force');
const filterCategory = getArg('--category');
const limitCount     = parseInt(getArg('--limit') || '9999', 10);
const modelArg       = getArg('--model');
const GEMINI_MODEL   = modelArg === 'flash' ? MODEL_FLASH : MODEL_PRO;

// ── Supabase ──────────────────────────────────────────────────────────────────
const dbSrc = fs.readFileSync(path.join(__dirname, '../src/lib/supabase.ts'), 'utf8');
const SB_URL = dbSrc.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
const SB_KEY = dbSrc.match(/eyJ[A-Za-z0-9._-]{20,}/)[0];
const sb = createClient(SB_URL, SB_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Ask Gemini to find a real photo URL for a place.
 * Returns a URL string or null if nothing useful found.
 */
function askGemini(place) {
  const prompt = `You are helping find a real publicly accessible photo for a local discovery app.

Place: "${place.name}"
Category: ${place.category || 'unknown'}
Address: ${place.address || 'Albuquerque, NM'}

Find ONE real image URL (jpg, jpeg, png, or webp) that clearly shows this specific place.

STRICT RULES:
- The URL must be a direct image link (ends in .jpg, .jpeg, .png, .webp, or contains /photo/ or /image/)
- Prefer images from: official venue website, Wikimedia Commons, city/government sites, Google Street View thumbnails
- The image must show the actual physical place, not a logo or poster
- Do NOT use stock photo sites (Unsplash, Shutterstock, Getty, Pexels, iStock)
- Do NOT use social media images (Instagram, Facebook, Twitter/X)
- Do NOT use Yelp photo URLs (they expire)
- Do NOT fabricate or guess URLs — only return a URL you are confident exists

Reply with ONLY the raw image URL on a single line. No explanation, no markdown, no quotes.
If you cannot find a real verified URL, reply with exactly: NONE`;

  try {
    // Write prompt to temp file to avoid shell escaping issues
    const tmpFile = `/tmp/gemini_photo_${Date.now()}.txt`;
    fs.writeFileSync(tmpFile, prompt, 'utf8');
    let result;
    try {
      result = execSync(
        `${GEMINI_BIN} -m ${GEMINI_MODEL} -p "$(cat ${tmpFile})"`,
        { timeout: 45000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
    }

    const lines = result.split('\n').map(l => l.trim()).filter(Boolean);
    // Find the line that looks like a URL
    const urlLine = lines.find(l => l.startsWith('http') && (
      l.match(/\.(jpg|jpeg|png|webp)/i) ||
      l.includes('/photo/') ||
      l.includes('/image/') ||
      l.includes('maps.googleapis.com') ||
      l.includes('wikimedia.org') ||
      l.includes('upload.wikimedia')
    ));

    if (!urlLine || urlLine === 'NONE') return null;
    return urlLine;
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || '').toString().slice(0, 120);
    console.error(`  ⚠ Gemini error for "${place.name}": ${detail}`);
    return null;
  }
}

/**
 * Verify a URL actually returns an image (HTTP HEAD check).
 */
function verifyImageUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({ method: 'HEAD', hostname: parsed.hostname, path: parsed.pathname + parsed.search }, (res) => {
        const ct = res.headers['content-type'] || '';
        resolve(res.statusCode >= 200 && res.statusCode < 400 && ct.startsWith('image/'));
      });
      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Write updated places-data.json from Supabase (same logic as fetch-data.cjs).
 * Only regenerates the local JSON — doesn't redeploy.
 */
async function regeneratePlacesJson() {
  console.log('\n📦 Regenerating places-data.json from Supabase...');
  const PAGE = 500;
  let from = 0, all = [];
  while (true) {
    const { data, error } = await sb.from('places').select('*').range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  fs.writeFileSync(PLACES_JSON, JSON.stringify(all, null, 2));
  console.log(`✅ places-data.json regenerated (${all.length} places)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`🔍 ABQ Unplugged — Gemini Photo Enricher`);
  console.log(`   Model: ${GEMINI_MODEL} | Dry run: ${dryRun} | Force: ${forceRedo}`);
  if (filterCategory) console.log(`   Category filter: ${filterCategory}`);
  console.log('');

  // Fetch all places from Supabase
  const PAGE = 500;
  let from = 0, allRows = [];
  console.log('Fetching places from Supabase...');
  while (true) {
    const { data, error } = await sb.from('places').select('id, raw').range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Total places: ${allRows.length}`);

  // Filter: places with no photos AND no manual photoUrl override
  const targets = allRows
    .filter(row => {
      const r = row.raw;
      if (!r) return false;
      if (filterCategory && r.category !== filterCategory) return false;
      // Already has Google photo references → skip (use enrich-photos.cjs instead)
      if (!forceRedo && r.photos?.length > 0) return false;
      // Already has a Gemini-sourced photoUrl
      if (!forceRedo && r.photoUrl) return false;
      return true;
    })
    .slice(0, limitCount);

  console.log(`Places needing photo URLs: ${targets.length}`);
  if (!targets.length) {
    console.log('Nothing to do. Use --force to re-enrich existing entries.');
    return;
  }
  console.log(`Estimated time: ~${Math.ceil(targets.length * (DELAY_MS + 5000) / 60000)} minutes\n`);

  let found = 0, verified = 0, skipped = 0, errors = 0;
  let pendingUpdates = [];

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    const r = row.raw;
    const name = r?.name || `Place ${row.id}`;

    process.stdout.write(`[${i+1}/${targets.length}] ${name.slice(0, 50).padEnd(50)} `);

    const photoUrl = askGemini(r);

    if (!photoUrl) {
      console.log('→ NONE (Gemini found nothing)');
      skipped++;
    } else {
      found++;
      // Verify the URL is real before storing
      const ok = await verifyImageUrl(photoUrl);
      if (!ok) {
        console.log(`→ INVALID (404 or not an image) ${photoUrl.slice(0, 60)}`);
        skipped++;
      } else {
        verified++;
        console.log(`→ ✓ ${photoUrl.slice(0, 80)}`);

        if (!dryRun) {
          pendingUpdates.push({
            id: row.id,
            raw: { ...r, photoUrl }
          });

          // Batch-save to Supabase
          if (pendingUpdates.length >= BATCH_SAVE) {
            for (const u of pendingUpdates) {
              const { error } = await sb.from('places').update({ raw: u.raw }).eq('id', u.id);
              if (error) { errors++; console.error(`  ⚠ DB error: ${error.message}`); }
            }
            pendingUpdates = [];
          }
        }
      }
    }

    await sleep(DELAY_MS);
  }

  // Flush remaining updates
  if (!dryRun && pendingUpdates.length) {
    for (const u of pendingUpdates) {
      const { error } = await sb.from('places').update({ raw: u.raw }).eq('id', u.id);
      if (error) { errors++; console.error(`  ⚠ DB error: ${error.message}`); }
    }
  }

  console.log(`\n✅ Done`);
  console.log(`   Found: ${found} | Verified OK: ${verified} | Skipped/None: ${skipped} | Errors: ${errors}`);

  if (!dryRun && verified > 0) {
    await regeneratePlacesJson();
    console.log('\n💡 Next steps:');
    console.log('   1. git add public/places-data.json && git commit -m "chore: enrich place photos via Gemini"');
    console.log('   2. git push  →  Netlify will redeploy automatically');
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
