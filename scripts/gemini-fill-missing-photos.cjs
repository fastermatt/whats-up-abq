#!/usr/bin/env node
/**
 * ABQ Unplugged — Fill Missing Photos via Gemini CLI
 *
 * Finds all places in public/places-data.json that have no image URL,
 * asks Gemini to find a real publicly accessible photo for each one,
 * verifies the URL is a live image, then writes the result back into
 * places-data.json so it's immediately live on the next deploy.
 *
 * This script works purely on places-data.json (no Supabase writes needed
 * for the photo URL — the static JSON is what the site pre-seeds from).
 *
 * Usage:
 *   cd /Users/matt/Documents/Claude/Projects/whats-up-abq
 *   node scripts/gemini-fill-missing-photos.cjs
 *   node scripts/gemini-fill-missing-photos.cjs --dry-run
 *   node scripts/gemini-fill-missing-photos.cjs --limit 30
 *   node scripts/gemini-fill-missing-photos.cjs --category coffee
 *   node scripts/gemini-fill-missing-photos.cjs --model flash
 *
 * After running (without --dry-run):
 *   git add public/places-data.json
 *   git commit -m "chore: fill missing place photos via Gemini"
 *   git push
 */
'use strict';

const fs           = require('fs');
const path         = require('path');
const https        = require('https');
const http         = require('http');
const { execSync } = require('child_process');

const PLACES_JSON  = path.join(__dirname, '../public/places-data.json');
const GEMINI_BIN   = '/opt/homebrew/bin/gemini';
const MODEL_PRO    = 'gemini-2.5-pro';
const MODEL_FLASH  = 'gemini-2.0-flash';
const BATCH_SAVE   = 20;   // write JSON every N updates
const DELAY_MS     = 600;

const args           = process.argv.slice(2);
const getArg         = f => { const i = args.indexOf(f); return i !== -1 ? args[i+1] : null; };
const dryRun         = args.includes('--dry-run');
const forceRedo      = args.includes('--force');
const filterCat      = getArg('--category');
const limitCount     = parseInt(getArg('--limit') || '9999', 10);
const GEMINI_MODEL   = getArg('--model') === 'flash' ? MODEL_FLASH : MODEL_PRO;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function askGemini(place) {
  const catHints = {
    restaurant:    'a photo of the interior, food, or exterior of the restaurant',
    coffee:        'a photo of the coffee shop interior, latte art, or storefront',
    bar:           'a photo of the bar interior, craft beer, or exterior',
    park:          'a scenic photo of the park, trail, or natural area',
    fitness:       'a photo of the gym, yoga studio, golf course, or fitness facility',
    arts:          'a photo of the art gallery, theater, performance space, or artwork',
    museum:        'a photo of the museum exhibits, interior, or building exterior',
    hotel:         'a photo of the hotel lobby, rooms, pool, or exterior',
    shop:          'a photo of the storefront, interior, or products',
    entertainment: 'a photo of the venue, performance, or attraction',
    other:         'a photo clearly showing this place',
  };
  const hint = catHints[place.category] || catHints.other;

  const prompt = `You are helping source images for "ABQ Unplugged", a local discovery app for Albuquerque, NM.

Find ONE real, publicly accessible image URL for this specific place:
  Name: "${place.name}"
  Category: ${place.category}
  Address: ${place.address || 'Albuquerque, NM'}
  ${place.rating ? `Rating: ${place.rating}` : ''}

Looking for: ${hint}

RULES (strictly enforced):
1. The URL must be a DIRECT image link ending in .jpg, .jpeg, .png, or .webp — OR from a known image CDN (wikimedia, maps.gstatic, googleusercontent, cloudfront, imgur)
2. Prefer: official venue website, Wikimedia Commons, Google Street View, city/gov/edu sites
3. NEVER use: Unsplash, Shutterstock, Getty, Pexels, iStock, Pixabay (stock photo sites)
4. NEVER use: Instagram, Facebook, Twitter/X, TikTok (social media — links expire)
5. NEVER use: Yelp, Tripadvisor, Eventbrite (gated or expiring)
6. ONLY return a URL you are confident is real and publicly accessible right now
7. If this is a chain (Starbucks, McDonald's, etc.) you may use an official brand image

Reply with ONLY the raw URL on one line. No markdown, no explanation.
If you cannot find a verified URL, reply exactly: NONE`;

  try {
    const tmpFile = `/tmp/gemini_photo_${process.pid}_${Date.now()}.txt`;
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
    const urlLine = lines.find(l =>
      l.startsWith('http') &&
      !l.match(/unsplash|shutterstock|getty|pexels|istock|pixabay|instagram|facebook|twitter|yelp|tripadvisor/i) &&
      (l.match(/\.(jpg|jpeg|png|webp)/i) ||
       l.includes('wikimedia') || l.includes('googleusercontent') ||
       l.includes('maps.gstatic') || l.includes('cloudfront') || l.includes('imgur'))
    );
    if (!urlLine || urlLine.trim() === 'NONE') return null;
    return urlLine.trim();
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || '').toString().slice(0, 100);
    process.stderr.write(`  ⚠ Gemini error: ${detail}\n`);
    return null;
  }
}

function verifyImageUrl(url) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        { method: 'HEAD', hostname: parsed.hostname, path: parsed.pathname + parsed.search,
          headers: { 'User-Agent': 'Mozilla/5.0' } },
        res => {
          const ct = res.headers['content-type'] || '';
          resolve(res.statusCode >= 200 && res.statusCode < 400 &&
                  (ct.startsWith('image/') || url.match(/\.(jpg|jpeg|png|webp)/i)));
        }
      );
      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    } catch { resolve(false); }
  });
}

async function run() {
  console.log('📸  ABQ Unplugged — Fill Missing Photos (Gemini)');
  console.log(`    Model: ${GEMINI_MODEL} | Dry-run: ${dryRun}${filterCat ? ` | Category: ${filterCat}` : ''}\n`);

  const places = JSON.parse(fs.readFileSync(PLACES_JSON, 'utf8'));

  const targets = places
    .filter(p => {
      if (filterCat && p.category !== filterCat) return false;
      if (!forceRedo && p.image) return false;      // already has a photo
      if (!p.name || p.name === 'Albuquerque') return false;
      return true;
    })
    .slice(0, limitCount);

  console.log(`Total places: ${places.length}`);
  console.log(`Missing photos: ${places.filter(p => !p.image).length}`);
  console.log(`Target for this run: ${targets.length}`);
  if (!targets.length) { console.log('\nNothing to do. Use --force to redo existing.'); return; }
  console.log(`Est. time: ~${Math.ceil(targets.length * (DELAY_MS + 7000) / 60000)} min\n`);

  if (dryRun) {
    console.log('(Dry run — no changes)');
    targets.slice(0, 10).forEach(p => console.log(`  ${p.category.padEnd(14)} ${p.name}`));
    if (targets.length > 10) console.log(`  ...and ${targets.length - 10} more`);
    return;
  }

  let found = 0, verified = 0, skipped = 0;
  const placeIdx = Object.fromEntries(places.map((p, i) => [p.id, i]));

  for (let i = 0; i < targets.length; i++) {
    const place = targets[i];
    process.stdout.write(`[${i+1}/${targets.length}] ${place.name.slice(0, 45).padEnd(45)} `);

    const url = askGemini(place);
    if (!url) { console.log('NONE'); skipped++; await sleep(DELAY_MS); continue; }

    found++;
    const ok = await verifyImageUrl(url);
    if (!ok) { console.log(`INVALID  ${url.slice(0, 60)}`); skipped++; await sleep(DELAY_MS); continue; }

    verified++;
    console.log(`✓  ${url.slice(0, 75)}`);
    const idx = placeIdx[place.id];
    if (idx !== undefined) {
      places[idx].image     = url;
      places[idx].thumbnail = url;
    }

    if (verified % BATCH_SAVE === 0) {
      fs.writeFileSync(PLACES_JSON, JSON.stringify(places, null, 2));
      console.log(`\n  💾 Saved (${verified} photos added)\n`);
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(PLACES_JSON, JSON.stringify(places, null, 2));

  console.log(`\n✅ Done: ${verified} photos added | ${found - verified} invalid | ${skipped} not found`);
  console.log(`\n💡 Deploy:`);
  console.log(`   git add public/places-data.json`);
  console.log(`   git commit -m "chore: fill ${verified} missing place photos via Gemini"`);
  console.log(`   git push`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
