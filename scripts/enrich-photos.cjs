/**
 * Enrich places in Supabase with full Google Place Details photos (up to 10).
 * Processes all places whose raw.photos array has fewer than 3 entries.
 * Uses 120ms delay between calls to stay within Google's 10 QPS limit.
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');

// Read Supabase creds from source
const dbSrc = fs.readFileSync(__dirname + '/../src/lib/supabase.ts', 'utf8');
const SB_URL = dbSrc.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
const SB_KEY = dbSrc.match(/eyJ[A-Za-z0-9._-]{20,}/)[0];
const GOOGLE_KEY = 'AIzaSyDn-W5LqhBBAK2VaZhORgRW8oQagpCVq6k';
const FIELDS = 'photos';

const sb = createClient(SB_URL, SB_KEY);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchDetails(placeId) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${FIELDS}&key=${GOOGLE_KEY}`;
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function run() {
  const PAGE = 500;
  let from = 0;
  let totalRows = [];

  console.log('Fetching all places from Supabase...');
  while (true) {
    const { data, error } = await sb.from('places').select('id, raw').range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    totalRows = totalRows.concat(data);
    console.log(`  Fetched ${totalRows.length} so far...`);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Total places: ${totalRows.length}`);

  // Only enrich places with fewer than 3 photos
  const needsEnrich = totalRows.filter(row => {
    const photos = row.raw?.photos;
    return !photos || photos.length < 3;
  });
  console.log(`Places needing enrichment (< 3 photos): ${needsEnrich.length}`);

  let updated = 0, skipped = 0, errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < needsEnrich.length; i++) {
    const row = needsEnrich[i];
    const placeId = row.raw?.place_id;
    if (!placeId) { skipped++; continue; }

    try {
      const details = await fetchDetails(placeId);

      if (details.status !== 'OK') {
        // Place may be closed/removed
        skipped++;
      } else {
        const newPhotos = details.result?.photos;
        if (newPhotos && newPhotos.length > (row.raw.photos?.length || 0)) {
          const updatedRaw = { ...row.raw, photos: newPhotos };
          const { error } = await sb
            .from('places')
            .update({ raw: updatedRaw })
            .eq('id', row.id);
          if (error) { errors++; console.error(`Update error for ${placeId}:`, error.message); }
          else updated++;
        } else {
          skipped++;
        }
      }
    } catch (e) {
      errors++;
      console.error(`Error for ${placeId}:`, e.message);
    }

    // Progress log every 50
    if ((i + 1) % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const eta = ((Date.now() - startTime) / (i + 1) * (needsEnrich.length - i - 1) / 1000).toFixed(0);
      console.log(`[${i+1}/${needsEnrich.length}] Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors} | ${elapsed}s elapsed, ~${eta}s remaining`);
    }

    // 120ms between calls → ~8 QPS (safely under Google's 10 QPS limit)
    await sleep(120);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`   Updated: ${updated} | Skipped/No change: ${skipped} | Errors: ${errors}`);
  console.log(`   Estimated API cost: ~$${(needsEnrich.length * 0.017).toFixed(2)}`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
