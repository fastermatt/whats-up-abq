#!/usr/bin/env node
/**
 * ABQ Unplugged — Movie Scraper (TMDB)
 *
 * Fetches currently-in-theaters movies from The Movie Database API and
 * writes them into src/data/events.ts as static Movie events.
 *
 * API: https://www.themoviedb.org/documentation/api  (free, requires key)
 * Env var: TMDB_API_KEY
 *
 * Usage:
 *   node scripts/fetch-movies.cjs
 *
 * What it does:
 *   1. Fetches "now playing" US movies from TMDB
 *   2. For each movie: description, poster, runtime, genres, MPAA rating
 *   3. Filters to wide-release films (vote_count > 50) likely playing ABQ
 *   4. Replaces the movie events block in src/data/events.ts
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  });
}

const TMDB_KEY = process.env.TMDB_API_KEY;
if (!TMDB_KEY) {
  console.error('❌  TMDB_API_KEY not set. Get a free key at https://www.themoviedb.org/settings/api');
  process.exit(1);
}

const ABQ_THEATERS = [
  'AMC Albuquerque 12 & IMAX',
  'Cinemark Century Rio 24 XD',
  'Regal Winrock Stadium 16 IMAX',
];

// ── HTTP helper ───────────────────────────────────────────────────────────────
function tmdbGet(path) {
  return new Promise((resolve, reject) => {
    const url = `https://api.themoviedb.org/3${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}&language=en-US`;
    https.get(url, { headers: { 'Accept': 'application/json' } }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ── MPAA rating from release_dates ───────────────────────────────────────────
async function getMpaaRating(movieId) {
  try {
    const data = await tmdbGet(`/movie/${movieId}/release_dates`);
    const us = (data.results || []).find(r => r.iso_3166_1 === 'US');
    if (!us) return null;
    // theatrical release types: 3 = Theatrical, 2 = Limited
    const theatrical = (us.release_dates || []).find(r => [2, 3].includes(r.type) && r.certification);
    return theatrical ? theatrical.certification : null;
  } catch { return null; }
}

// ── Genre IDs → readable name ─────────────────────────────────────────────────
function genreName(genres) {
  if (!genres || genres.length === 0) return null;
  return genres.slice(0, 2).map(g => g.name).join(' / ');
}

// ── Format runtime ────────────────────────────────────────────────────────────
function fmtRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

// ── Escape for TS template literal ───────────────────────────────────────────
function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎬  Fetching now-playing movies from TMDB...');

  // Fetch pages 1 & 2 (~40 movies) then filter
  const [page1, page2] = await Promise.all([
    tmdbGet('/movie/now_playing?region=US&page=1'),
    tmdbGet('/movie/now_playing?region=US&page=2'),
  ]);

  const raw = [...(page1.results || []), ...(page2.results || [])];
  console.log(`   Found ${raw.length} raw results`);

  // Filter to wide-release films likely showing in ABQ (not tiny indie/limited)
  const candidates = raw.filter(m =>
    m.vote_count > 30 &&          // has enough votes = real release
    m.original_language === 'en' && // English language
    !m.adult                        // no adult content
  );
  console.log(`   ${candidates.length} candidates after filtering`);

  // Fetch details for each (runtime, full genres, MPAA rating)
  const movies = [];
  for (const m of candidates.slice(0, 15)) { // cap at 15 to avoid rate limits
    try {
      const [details, mpaa] = await Promise.all([
        tmdbGet(`/movie/${m.id}`),
        getMpaaRating(m.id),
      ]);

      const releaseDate = m.release_date; // YYYY-MM-DD
      // Movies typically run 4-6 weeks in theaters; use 5 weeks as default
      const endDate = addWeeks(releaseDate, 5);
      const today = new Date().toISOString().split('T')[0];

      // Skip if already past end date
      if (endDate < today) { console.log(`   ⏭  Skipping ${m.title} (past run)`); continue; }

      const poster = m.poster_path
        ? `https://image.tmdb.org/t/p/w780${m.poster_path}`
        : null;
      const backdrop = m.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}`
        : null;

      movies.push({
        id: `mv-tmdb-${m.id}`,
        title: m.title,
        releaseDate,
        endDate,
        description: m.overview || '',
        poster,
        backdrop,
        runtime: fmtRuntime(details.runtime),
        genre: genreName(details.genres),
        mpaa: mpaa || '',
        priceMin: 13,
        priceMax: 22,
        voteAvg: m.vote_average,
        featured: m.vote_count > 500 && m.vote_average > 6.5,
      });

      console.log(`   ✅  ${m.title} (${releaseDate}) · ${mpaa || 'NR'} · ${fmtRuntime(details.runtime)}`);
      // Small delay to respect TMDB rate limits (40 req/10s)
      await new Promise(r => setTimeout(r, 260));
    } catch (e) {
      console.warn(`   ⚠️  Skipping ${m.title}: ${e.message}`);
    }
  }

  console.log(`\n📝  Writing ${movies.length} movies to events.ts...`);

  // ── Build the TS source block ────────────────────────────────────────────
  const lines = movies.map((mv, i) => {
    const imgLine = mv.poster
      ? `    image: ${JSON.stringify(mv.poster)},`
      : `    image: U("1489599849927-2ee91cede3ba"), // fallback cinema image`;
    const backdropLine = mv.backdrop
      ? `    additionalImages: [${JSON.stringify(mv.backdrop)}],`
      : '';

    return `  {
    id: ${JSON.stringify(mv.id)},
    title: ${JSON.stringify(mv.title)},
    category: "Movie",
    date: ${JSON.stringify(mv.releaseDate)},
    endDate: ${JSON.stringify(mv.endDate)},
    time: "Various showtimes",
    location: "Multiple ABQ Theaters",
    address: "Check Fandango for nearest theater",
    description: ${JSON.stringify(mv.description)},
    price: "$${mv.priceMin}\u2013$${mv.priceMax}",
    priceNum: ${mv.priceMin},
${imgLine}${backdropLine ? '\n' + backdropLine : ''}
    gradient: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
    featured: ${mv.featured},
    movieRating: ${JSON.stringify(mv.mpaa || '')},
    movieRuntime: ${JSON.stringify(mv.runtime || '')},
    movieGenre: ${JSON.stringify(mv.genre || '')},
    theaters: ABQ_THEATERS,
    tags: [${JSON.stringify(mv.title.toLowerCase())}, "movie", "film", "fandango"],
    isKidFriendly: ${['G','PG','PG-13'].includes(mv.mpaa)},
    isOutdoor: false,
    isAccessible: true,
    source: "Fandango",
    website: "https://www.fandango.com/albuquerque_nm_movietimes",
    ticketUrl: "https://www.fandango.com/search?q=${encodeURIComponent(mv.title)}+Albuquerque",
  }`;
  });

  const newBlock = `// ─── MOVIES (auto-refreshed daily via fetch-movies.cjs) ──────────────────────
// Last updated: ${new Date().toISOString().split('T')[0]}
${lines.join(',\n')}`;

  // ── Replace the movie block in events.ts ────────────────────────────────
  const eventsPath = path.join(__dirname, '..', 'src', 'data', 'events.ts');
  let src = fs.readFileSync(eventsPath, 'utf8');

  // The movie block is bracketed by these markers
  const START_MARKER = '// ─── MOVIES (auto-refreshed daily via fetch-movies.cjs) ──────────────────────';
  const END_MARKER   = '\n\n  // ─';   // next section separator

  if (src.includes(START_MARKER)) {
    // Replace existing auto-generated block
    const start = src.indexOf(START_MARKER);
    const afterBlock = src.indexOf(END_MARKER, start);
    if (afterBlock === -1) {
      console.error('❌  Could not find end of movie block. Manual check needed.');
      process.exit(1);
    }
    src = src.slice(0, start) + newBlock + src.slice(afterBlock);
    console.log('   Replaced existing movie block');
  } else {
    // First run — replace the old hand-written mv-7 / mv-8 entries
    // They start right after "export const ALL_EVENTS: Event[] = ["
    const HAND_START = '  {\n    id: "mv-7"';
    const HAND_END_MARKER = '\n\n  // ─'; // next section after hand-written movies

    if (src.includes(HAND_START)) {
      const start = src.indexOf(HAND_START);
      const afterBlock = src.indexOf(HAND_END_MARKER, start);
      if (afterBlock === -1) {
        console.error('❌  Could not find end of hand-written movie block.');
        process.exit(1);
      }
      src = src.slice(0, start) + newBlock + src.slice(afterBlock);
      console.log('   Replaced hand-written mv-7/mv-8 entries with auto-generated block');
    } else {
      // Inject right after the ALL_EVENTS opening bracket
      const INSERT_AFTER = 'export const ALL_EVENTS: Event[] = [\n';
      if (!src.includes(INSERT_AFTER)) {
        console.error('❌  Could not find ALL_EVENTS array. Manual check needed.');
        process.exit(1);
      }
      src = src.replace(INSERT_AFTER, INSERT_AFTER + newBlock + ',\n\n');
      console.log('   Injected new movie block at top of ALL_EVENTS');
    }
  }

  fs.writeFileSync(eventsPath, src, 'utf8');
  console.log(`\n🎉  Done! ${movies.length} movies written to src/data/events.ts`);
  console.log('   Run: npm run build  →  verify, then git commit + push to deploy\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
