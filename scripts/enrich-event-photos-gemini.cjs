#!/usr/bin/env node
/**
 * ABQ Unplugged — Static Event Photo Enrichment via Gemini CLI
 *
 * The static events bundled in src/data/events.ts currently use generic
 * Unsplash stock photos (same 20-ish images reused across categories).
 * This script asks Gemini to find specific, real photo URLs for each event
 * and writes the updated image URLs back into events.ts.
 *
 * Uses Gemini CLI (gemini) — must be authenticated.
 *
 * Usage:
 *   node scripts/enrich-event-photos-gemini.cjs
 *   node scripts/enrich-event-photos-gemini.cjs --dry-run    # print changes only
 *   node scripts/enrich-event-photos-gemini.cjs --force      # re-run events that already have real photos
 *   node scripts/enrich-event-photos-gemini.cjs --limit 10   # process at most 10 events
 *   node scripts/enrich-event-photos-gemini.cjs --model flash
 *
 * After running: rebuild and redeploy
 *   npm run build && git add src/data/events.ts && git commit -m "chore: enrich static event photos" && git push
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const https        = require('https');
const http         = require('http');
const { execSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const EVENTS_FILE = path.join(__dirname, '../src/data/events.ts');
const GEMINI_BIN  = '/opt/homebrew/bin/gemini';
const MODEL_PRO   = 'gemini-2.5-pro';
const MODEL_FLASH = 'gemini-2.0-flash';
const DELAY_MS    = 1000;

// Generic Unsplash patterns that indicate a placeholder image
const GENERIC_PATTERNS = [
  'unsplash.com/photo-1565123409695',  // concert
  'unsplash.com/photo-1493225457124',  // concert mic
  'unsplash.com/photo-1521967906867',  // concert crowd
  'unsplash.com/photo-1516450360452',  // dj
  'unsplash.com/photo-1501386761578',  // outdoor concert
  'unsplash.com/photo-1523050854058',  // graduation
  'unsplash.com/photo-1571902943202',  // fitness
  'unsplash.com/photo-1555507036',     // bread/food
  'unsplash.com/photo-1504384308090',  // tech/startup
  'unsplash.com/photo-1516035069371',  // camera/photography
  'unsplash.com/photo-1540575467063',  // conference
  'unsplash.com/photo-1529156069898',  // group/community
  'unsplash.com/photo-1470229722913',  // concert lights
  'unsplash.com/photo-1416879595882',  // garden/flower
  'unsplash.com/photo-1521737711867',  // startup
  'unsplash.com/photo-1510812431401',  // wine
  'unsplash.com/photo-1505236858219',  // music generic
];

// ── Args ──────────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const getArg       = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i+1] : null; };
const dryRun       = args.includes('--dry-run');
const forceRedo    = args.includes('--force');
const limitCount   = parseInt(getArg('--limit') || '9999', 10);
const modelArg     = getArg('--model');
const GEMINI_MODEL = modelArg === 'flash' ? MODEL_FLASH : MODEL_PRO;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isGenericUnsplash(url) {
  return GENERIC_PATTERNS.some(p => url.includes(p));
}

/**
 * Parse events from events.ts: extract name, category, date, venue, current image.
 * Returns an array of { lineIndex, name, venue, date, category, currentImage }.
 */
function parseEventsFile(content) {
  const events = [];
  // Match event objects — look for the image: "..." field and nearby context
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find name lines: name: "Something"
    const nameMatch = line.match(/^\s+name:\s+"([^"]+)"/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    let venue = '', date = '', category = '', imageLineIdx = -1, currentImage = '';

    // Look ahead up to 20 lines for relevant fields
    for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
      const l = lines[j];
      if (/^\s+venue:\s+"([^"]+)"/.test(l)) venue = l.match(/venue:\s+"([^"]+)"/)[1];
      if (/^\s+date:\s+"([^"]+)"/.test(l)) date = l.match(/date:\s+"([^"]+)"/)[1];
      if (/^\s+category:\s+"([^"]+)"/.test(l)) category = l.match(/category:\s+"([^"]+)"/)[1];
      if (/^\s+image:\s+"([^"]+)"/.test(l)) {
        imageLineIdx = j;
        currentImage = l.match(/image:\s+"([^"]+)"/)[1];
        break;
      }
      // Stop if we hit the next event object
      if (/^\s+\{$/.test(l) || /^\s+\},?$/.test(l)) break;
    }

    if (imageLineIdx === -1) continue;

    // Only target events with generic Unsplash images (unless --force)
    if (!forceRedo && !isGenericUnsplash(currentImage)) continue;

    events.push({ lineIndex: i, imageLineIdx, name, venue, date, category, currentImage });
  }

  return events;
}

/**
 * Ask Gemini to find a real photo URL for an event.
 */
function askGemini(event) {
  const prompt = `You are helping find a real publicly accessible photo for an event listing app.

Event: "${event.name}"
Venue: ${event.venue || 'Albuquerque, NM'}
Date: ${event.date || 'upcoming'}
Category: ${event.category || 'event'}

Find ONE real image URL that represents this specific event or event type.

STRICT RULES:
- The URL must be a direct image link (jpg, jpeg, png, or webp)
- Prefer images from: official event website, Wikimedia Commons, venue official site, city/gov sites
- If this is a recurring event (festival, fair, etc.), find the official event photo
- If this is a venue, find a photo of the venue itself
- Do NOT use stock photo sites (Unsplash, Shutterstock, Getty, Pexels, iStock, Pixabay)
- Do NOT use social media (Instagram, Facebook, Twitter/X)
- Do NOT use Yelp or Eventbrite photos (they expire or require login)
- Do NOT fabricate or guess — only return a URL you are confident exists and is publicly accessible

Reply with ONLY the raw image URL on a single line. No markdown, no explanation.
If you cannot find a verified real URL, reply exactly: NONE`;

  try {
    // Write prompt to temp file to avoid shell escaping issues
    const tmpFile = `/tmp/gemini_event_${Date.now()}.txt`;
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
      l.startsWith('http') && !l.includes('unsplash.com') && (
        l.match(/\.(jpg|jpeg|png|webp)/i) ||
        l.includes('/photo/') ||
        l.includes('/image/') ||
        l.includes('wikimedia') ||
        l.includes('albuquerque') ||
        l.includes('.gov') ||
        l.includes('.edu')
      )
    );

    if (!urlLine || urlLine === 'NONE') return null;
    return urlLine;
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || '').toString().slice(0, 120);
    console.error(`  ⚠ Gemini error: ${detail}`);
    return null;
  }
}

/**
 * HEAD check that URL is a live image.
 */
function verifyImageUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        { method: 'HEAD', hostname: parsed.hostname, path: parsed.pathname + parsed.search },
        (res) => {
          const ct = res.headers['content-type'] || '';
          resolve(res.statusCode >= 200 && res.statusCode < 400 && ct.startsWith('image/'));
        }
      );
      req.setTimeout(8000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log('🎟  ABQ Unplugged — Event Photo Enricher (Gemini)');
  console.log(`   Model: ${GEMINI_MODEL} | Dry run: ${dryRun} | Force: ${forceRedo}\n`);

  const content = fs.readFileSync(EVENTS_FILE, 'utf8');
  const lines   = content.split('\n');

  const events = parseEventsFile(content).slice(0, limitCount);
  console.log(`Events with generic placeholder photos: ${events.length}`);
  if (!events.length) {
    console.log('Nothing to do. All events already have specific photos, or use --force to re-check.');
    return;
  }
  console.log(`Estimated time: ~${Math.ceil(events.length * (DELAY_MS + 6000) / 60000)} minutes\n`);

  let found = 0, verified = 0, skipped = 0;
  const updates = []; // { imageLineIdx, newUrl }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    process.stdout.write(`[${i+1}/${events.length}] ${ev.name.slice(0, 50).padEnd(50)} `);

    const url = askGemini(ev);

    if (!url) {
      console.log('→ NONE');
      skipped++;
    } else {
      found++;
      const ok = await verifyImageUrl(url);
      if (!ok) {
        console.log(`→ INVALID ${url.slice(0, 60)}`);
        skipped++;
      } else {
        verified++;
        console.log(`→ ✓ ${url.slice(0, 80)}`);
        updates.push({ imageLineIdx: ev.imageLineIdx, newUrl: url });
      }
    }

    await sleep(DELAY_MS);
  }

  if (!dryRun && updates.length > 0) {
    // Apply updates back to lines array (process in reverse to preserve indices)
    updates.sort((a, b) => b.imageLineIdx - a.imageLineIdx);
    for (const { imageLineIdx, newUrl } of updates) {
      // Replace the image URL in the line, preserving indentation
      lines[imageLineIdx] = lines[imageLineIdx].replace(
        /image:\s+"[^"]+"/,
        `image: "${newUrl}"`
      );
    }
    fs.writeFileSync(EVENTS_FILE, lines.join('\n'));
    console.log(`\n✅ events.ts updated with ${updates.length} new photo URLs`);
    console.log('\n💡 Next steps:');
    console.log('   npm run build');
    console.log('   git add src/data/events.ts');
    console.log('   git commit -m "chore: enrich static event photos via Gemini"');
    console.log('   git push');
  } else if (dryRun) {
    console.log(`\n🔍 Dry run: would update ${updates.length} photo URLs`);
  }

  console.log(`\nSummary: Found ${found} | Verified ${verified} | Skipped ${skipped}`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
