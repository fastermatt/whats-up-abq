/**
 * Enrich top-rated places with additional Google photo references.
 * Only processes places with rating >= 4.0 and reviewCount >= 20 that have < 3 photos.
 * Targets ~200-400 places. Cost: ~$3-7. Time: ~1 minute.
 */

'use strict';
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
const path = require('path');

const dbSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'supabase.ts'), 'utf8');
const SB_URL = dbSrc.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
const SB_KEY = dbSrc.match(/eyJ[A-Za-z0-9._-]{20,}/)[0];
const GOOGLE_KEY = process.env.VITE_GOOGLE_PLACES_KEY || '';

const sb = createClient(SB_URL, SB_KEY);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchDetails(placeId) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_KEY}`;
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching all places from Supabase...');
  const PAGE = 500;
  let from = 0, allRows = [];
  while (true) {
    const { data, error } = await sb.from('places').select('id, raw').range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Total places in DB: ${allRows.length}`);

  // Filter: top-rated places with few photos
  const targets = allRows.filter(row => {
    const r = row.raw;
    if (!r?.place_id) return false;
    const photoCount = r?.photos?.length || 0;
    if (photoCount >= 3) return false; // already has enough
    const rating = r?.rating || 0;
    const reviews = r?.user_ratings_total || 0;
    return rating >= 4.0 && reviews >= 20;
  });

  console.log(`Target places (rating>=4.0, reviews>=20, photos<3): ${targets.length}`);
  console.log(`Estimated cost: ~$${(targets.length * 0.017).toFixed(2)}`);
  console.log(`Estimated time: ~${Math.ceil(targets.length * 0.12 / 60)} minutes\n`);

  let updated = 0, skipped = 0, errors = 0;
  const start = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    const placeId = row.raw?.place_id;
    try {
      const details = await fetchDetails(placeId);
      if (details.status !== 'OK') {
        skipped++;
      } else {
        const newPhotos = details.result?.photos;
        if (newPhotos && newPhotos.length > (row.raw.photos?.length || 0)) {
          const updatedRaw = { ...row.raw, photos: newPhotos };
          const { error } = await sb.from('places').update({ raw: updatedRaw }).eq('id', row.id);
          if (error) { errors++; console.error(`Update error ${placeId}:`, error.message); }
          else { updated++; }
        } else {
          skipped++;
        }
      }
    } catch(e) {
      errors++;
      console.error(`Error ${placeId}:`, e.message);
    }

    if ((i + 1) % 25 === 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(0);
      const rate = (i + 1) / ((Date.now() - start) / 1000);
      const eta = ((targets.length - i - 1) / rate).toFixed(0);
      console.log(`[${i+1}/${targets.length}] +${updated} updated, ${skipped} skipped, ${errors} errors | ${elapsed}s elapsed, ~${eta}s left`);
    }

    await sleep(120);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`   Updated: ${updated} | Skipped: ${skipped} | Errors: ${errors}`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
