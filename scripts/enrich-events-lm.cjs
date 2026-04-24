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
    temperature: 0.2,
    max_tokens:  1600,
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

// ── ABQ neighborhood lookup ────────────────────────────────────────────────────
// Maps venue names and street addresses to accurate neighborhood context,
// parking info, and pre-seeded nearby dining so the LLM doesn't have to guess.
const KNOWN_VENUES = {
  'nexus brewery':              {
    neighborhood: 'near I-25 / Pan American Freeway in northeast Albuquerque (midtown, close to Uptown)',
    parking: 'Large parking lot on-site.',
    nearby_dining: [
      { name: 'Flying Star Cafe (Juan Tabo)', why: 'Excellent NM comfort food, great green chile, 10 min away' },
      { name: 'Gecko\'s Bar & Tapas (Montgomery)', why: 'Lively bar, solid pub grub, 5 min drive' },
    ],
  },
  'isleta amphitheater':        {
    neighborhood: 'in the South Valley near I-25 south',
    parking: 'Large parking lots on-site; expect heavy traffic — arrive 45–60 min early for big shows.',
    nearby_dining: [
      { name: 'El Pinto (4th St NW)', why: 'Legendary NM restaurant with a huge patio; 20 min north' },
      { name: 'Garcia\'s Kitchen (Central)', why: 'Classic NM diner, open late, green chile everything' },
    ],
  },
  'isleta amphitheatre':        {
    neighborhood: 'in the South Valley near I-25 south',
    parking: 'Large parking lots on-site; expect heavy traffic — arrive 45–60 min early for big shows.',
    nearby_dining: [
      { name: 'El Pinto (4th St NW)', why: 'Legendary NM restaurant with a huge patio; 20 min north' },
      { name: 'Garcia\'s Kitchen (Central)', why: 'Classic NM diner, open late, green chile everything' },
    ],
  },
  'first financial credit union amphitheater': {
    neighborhood: 'in the South Valley near I-25 south',
    parking: 'Large parking lots on-site; expect heavy traffic — arrive 45–60 min early for big shows.',
    nearby_dining: [
      { name: 'El Pinto (4th St NW)', why: 'Legendary NM restaurant with a huge patio; 20 min north' },
      { name: 'Garcia\'s Kitchen (Central)', why: 'Classic NM diner, open late, green chile everything' },
    ],
  },
  'tingley coliseum':           {
    neighborhood: 'at Expo New Mexico / State Fairgrounds, midtown (near Louisiana Blvd)',
    parking: 'Fairgrounds parking on-site; $10–15 typical.',
    nearby_dining: [
      { name: 'Flying Star Cafe (Nob Hill, Central Ave)', why: 'New Mexican comfort food and espresso, 10 min east' },
      { name: 'Casa de Benavidez (Rio Grande Blvd)', why: 'Family-run NM classics, great margaritas, 15 min west' },
    ],
  },
  'expo new mexico':            {
    neighborhood: 'at the State Fairgrounds, midtown Albuquerque',
    parking: 'Large fairgrounds parking; $10–15 typical.',
    nearby_dining: [
      { name: 'Flying Star Cafe (Nob Hill, Central Ave)', why: 'Excellent green chile dishes and pastries, 10 min east' },
      { name: 'Quarters BBQ (Louisiana Blvd)', why: 'Local BBQ institution right nearby' },
    ],
  },
  'sandia resort':              {
    neighborhood: 'at the base of the Sandia Mountains in the far northeast (Tramway area)',
    parking: 'Free valet and self-parking on-site.',
    nearby_dining: [
      { name: 'Range Cafe (Bernalillo)', why: 'NM diner institution, great breakfast/lunch, 20 min north on I-25' },
      { name: 'Saddle Up New Mexican (Tramway area)', why: 'NM food within 10 min drive' },
    ],
  },
  'sandia casino':              {
    neighborhood: 'at the base of the Sandia Mountains in the far northeast (Tramway area)',
    parking: 'Free parking on-site.',
    nearby_dining: [
      { name: 'Range Cafe (Bernalillo)', why: 'NM diner institution, great breakfast/lunch, 20 min north' },
    ],
  },
  'hard rock hotel':            {
    neighborhood: 'in the South Valley near I-25 south (exit 220)',
    parking: 'Free parking on-site.',
    nearby_dining: [
      { name: 'El Pinto (4th St NW)', why: 'Legendary NM restaurant, huge patio, 20 min north on I-25' },
      { name: 'Barelas Coffee House (4th St SW)', why: 'Classic green chile breakfast, cash only, 15 min north' },
    ],
  },
  'hard rock casino':           {
    neighborhood: 'in the South Valley near I-25 south (exit 220)',
    parking: 'Free parking on-site.',
    nearby_dining: [
      { name: 'El Pinto (4th St NW)', why: 'Legendary NM restaurant, huge patio, 20 min north on I-25' },
      { name: 'Barelas Coffee House (4th St SW)', why: 'Classic green chile breakfast, cash only, 15 min north' },
    ],
  },
  'popejoy hall':               {
    neighborhood: 'on the UNM campus in central Albuquerque',
    parking: 'UNM parking structures nearby; Yale Parking Structure is closest ($1–2/hr after 5 PM).',
    nearby_dining: [
      { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, legendary green chile cheeseburgers, a UNM institution since 1971' },
      { name: 'Flying Star Cafe (Nob Hill)', why: 'Upscale diner vibe, great cocktails and NM food, 10 min walk east' },
    ],
  },
  'keller hall':                {
    neighborhood: 'on the UNM campus in central Albuquerque',
    parking: 'UNM parking structures nearby.',
    nearby_dining: [
      { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, legendary NM food, 2 min walk' },
    ],
  },
  'launchpad':                  {
    neighborhood: 'on Central Ave in Downtown/EDo (East Downtown)',
    parking: 'Free 2-hr street parking on Central and side streets; free after 6 PM.',
    nearby_dining: [
      { name: 'Frontier Restaurant (Central & Cornell)', why: '10 min east, open until midnight, legendary green chile' },
      { name: 'Twisters Burritos (Central Ave)', why: 'Local chain, great late-night green chile burritos, 5 min walk' },
      { name: 'Gold Street Caffe', why: 'Cozy downtown spot, solid cocktails and small plates, 5 min walk' },
    ],
  },
  'sunshine theater':           {
    neighborhood: 'on Central Ave in Downtown Albuquerque',
    parking: 'Street parking on Central; free city lot 1 block south on 1st St (free after 6 PM).',
    nearby_dining: [
      { name: 'Frontier Restaurant (Central & Cornell)', why: '10 min east, open until midnight, NM institution' },
      { name: 'Gold Street Caffe', why: 'Downtown cocktail bar and bites, a short walk away' },
      { name: 'Twisters Burritos (Central Ave)', why: 'Classic late-night green chile stop near the venue' },
    ],
  },
  'el rey theater':             {
    neighborhood: 'on Central Ave in Downtown/EDo (East Downtown)',
    parking: 'Free street parking on Central Ave and surrounding side streets after 6 PM.',
    nearby_dining: [
      { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, legendary green chile, 10 min east' },
      { name: 'Twisters Burritos (Central Ave)', why: 'Quick NM burritos, walking distance' },
    ],
  },
  'kimo theatre':               {
    neighborhood: 'on Central Ave in Downtown Albuquerque (Pueblo Deco landmark, 1927)',
    parking: 'Street parking on Central; city garage on 2nd St.',
    nearby_dining: [
      { name: 'Gold Street Caffe', why: 'Right downtown, cocktails and small plates' },
      { name: 'Frontier Restaurant', why: '15 min walk east on Central, open late' },
    ],
  },
  'meow wolf':                  {
    neighborhood: 'in the Railyard district of Santa Fe — NOT Albuquerque, about 60 miles north on I-25',
    parking: 'Dedicated parking lot adjacent to the venue.',
    nearby_dining: [
      { name: 'Tomasita\'s (Santa Fe)', why: 'Classic NM restaurant in the Railyard area, 5 min walk' },
      { name: 'Second Street Brewery (Santa Fe)', why: 'Local brewery with great food, walking distance in Railyard' },
    ],
  },
  'kiva auditorium':            {
    neighborhood: 'at the Albuquerque Convention Center, Downtown',
    parking: 'Convention Center parking garage on-site (paid, ~$10); street parking available on surrounding blocks.',
    nearby_dining: [
      { name: 'Casa de Benavidez (Rio Grande Blvd)', why: 'Family NM restaurant, killer margaritas, 15 min west' },
      { name: 'Gold Street Caffe (Gold Ave)', why: 'Walkable from Convention Center, cocktails and tapas' },
    ],
  },
  'albuquerque convention':     {
    neighborhood: 'in Downtown Albuquerque',
    parking: 'Convention Center parking garage (paid); street parking on 2nd and 3rd St.',
    nearby_dining: [
      { name: 'Gold Street Caffe (Gold Ave)', why: 'Walking distance, cocktails and small plates' },
      { name: 'Casa de Benavidez (Rio Grande Blvd)', why: 'Full NM dinner, great for pre-event, 15 min west' },
    ],
  },
  'isotopes park':              {
    neighborhood: 'just south of UNM on Avenida Cesar Chavez, central Albuquerque',
    parking: 'Large stadium lots on-site; $5–10 cash. Arrive 30 min early for big games.',
    nearby_dining: [
      { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, right by UNM, legendary NM food' },
      { name: 'Flying Star Cafe (Nob Hill)', why: 'Great for pre-game brunch or dinner, 10 min east on Central' },
    ],
  },
  'rio grande credit union field': {
    neighborhood: 'just south of UNM on Avenida Cesar Chavez, central Albuquerque',
    parking: 'Large stadium lots on-site; $5–10 cash. Arrive 30 min early for big games.',
    nearby_dining: [
      { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, right by UNM, a local staple' },
      { name: 'Flying Star Cafe (Nob Hill)', why: 'Great for pre-game dinner, 10 min east on Central' },
    ],
  },
  'rio rancho events center':   {
    neighborhood: 'in Rio Rancho, about 15 miles northwest of downtown Albuquerque',
    parking: 'Free parking on-site.',
    nearby_dining: [
      { name: 'Tucanos Brazilian Grill (Rio Rancho)', why: 'All-you-can-eat Brazilian BBQ, popular pre-show spot nearby' },
      { name: 'Quarters BBQ (Rio Rancho)', why: 'Local BBQ, close to the events center' },
    ],
  },
  'revel entertainment':        {
    neighborhood: 'near the Pan American Freeway (I-25 & Paseo del Norte area), north Albuquerque',
    parking: 'Large parking lot on-site; free.',
    nearby_dining: [
      { name: 'Flying Star Cafe (Juan Tabo)', why: 'Solid NM food and coffee, 10 min drive' },
      { name: 'El Pinto (4th St NW)', why: 'Huge NM restaurant with great margaritas, 15 min southwest' },
    ],
  },
  'hotel albuquerque':          {
    neighborhood: 'in Old Town Albuquerque, near the original plaza',
    parking: 'Hotel parking garage on-site.',
    nearby_dining: [
      { name: 'Casa de Benavidez (Rio Grande Blvd NW)', why: 'New Mexico classics and great margaritas, 5 min drive' },
      { name: 'Casa Chaco (inside Hotel Albuquerque)', why: 'Right there — patio dining with Old Town views' },
      { name: 'Antiquity Restaurant (Old Town)', why: 'Old Town staple, classic steaks and NM food' },
    ],
  },
  'duran\'s pharmacy':          {
    neighborhood: 'in the Old Town / Barelas neighborhood near 12th and Central',
    parking: 'Small lot; street parking nearby.',
    nearby_dining: [],
  },
  'abq biopark':                {
    neighborhood: 'in Albuquerque\'s South Valley/Barelas near the Rio Grande',
    parking: 'Large parking lots on-site; $3 typical.',
    nearby_dining: [
      { name: 'Barelas Coffee House (4th St SW)', why: 'Legendary NM breakfast spot, 5 min away — go early, it gets packed' },
      { name: 'Casa de Benavidez (Rio Grande Blvd)', why: 'NM classics and margaritas, 15 min north along Rio Grande' },
    ],
  },
  'biopark':                    {
    neighborhood: 'near the Rio Grande in central/south Albuquerque',
    parking: 'Large parking lots on-site.',
    nearby_dining: [
      { name: 'Barelas Coffee House (4th St SW)', why: 'Legendary local breakfast, 5 min away' },
    ],
  },
  'albuquerque museum':         {
    neighborhood: 'in Old Town Albuquerque near the plaza',
    parking: 'Museum lot on Mountain Rd NW; street parking around Old Town plaza.',
    nearby_dining: [
      { name: 'Casa Chaco (Hotel Albuquerque)', why: 'Patio dining with Old Town views, 5 min walk' },
      { name: 'Casa de Benavidez (Rio Grande Blvd)', why: 'NM classics and margaritas, 5 min drive' },
      { name: 'Antiquity Restaurant (Old Town)', why: 'Old-school NM steaks and enchiladas right in Old Town' },
    ],
  },
  'national hispanic cultural': {
    neighborhood: 'in the Barelas neighborhood, south of Downtown along 4th St SW',
    parking: 'Free parking lot on-site.',
    nearby_dining: [
      { name: 'Barelas Coffee House (4th St SW)', why: 'Cash-only NM breakfast institution, literally around the corner' },
      { name: 'Casa de Benavidez (Rio Grande Blvd)', why: 'Full NM dinner, 10 min drive north' },
    ],
  },
  'nhcc': {
    neighborhood: 'in the Barelas neighborhood, south of Downtown along 4th St SW',
    parking: 'Free parking lot on-site.',
    nearby_dining: [
      { name: 'Barelas Coffee House (4th St SW)', why: 'Cash-only NM breakfast institution, literally around the corner' },
    ],
  },
  'harwood art center':         {
    neighborhood: 'in the EDo / East Downtown neighborhood on Menaul Blvd NE',
    parking: 'Street parking on Menaul and side streets.',
    nearby_dining: [
      { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, 15 min south on Central' },
      { name: 'Flying Star Cafe (Nob Hill)', why: 'Great coffee and NM food, 15 min east on Central' },
    ],
  },
  'outpost performance space':  {
    neighborhood: 'in the EDo / East Downtown neighborhood',
    parking: 'Street parking nearby.',
    nearby_dining: [
      { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, nearby NM institution' },
      { name: 'Twisters Burritos', why: 'Quick green chile burritos, walking distance on Central' },
    ],
  },
  'hyena\'s comedy':            {
    neighborhood: 'in the Uptown / Northeast Heights area (near Menaul & Louisiana)',
    parking: 'Strip mall parking lot on-site; free.',
    nearby_dining: [
      { name: 'Quarters BBQ (Louisiana Blvd)', why: 'Local BBQ institution right nearby, great pre-show dinner' },
      { name: 'Flying Star Cafe (Juan Tabo)', why: 'Good NM comfort food and cocktails, 10 min east' },
    ],
  },
  'route 66 casino':            {
    neighborhood: 'west of Albuquerque on I-40 (exit 140), about 20 miles from Downtown',
    parking: 'Free parking lots on-site.',
    nearby_dining: [
      { name: 'Route 66 Casino restaurants', why: 'Several on-site dining options; Six66 Steakhouse for pre-show' },
    ],
  },
};

function getVenueContext(venueName, address) {
  const key = (venueName || '').toLowerCase();
  const addr = (address || '').toLowerCase();
  const combined = key + ' ' + addr;

  // Check known venues first (most accurate, includes pre-seeded nearby_dining)
  for (const [pattern, info] of Object.entries(KNOWN_VENUES)) {
    if (combined.includes(pattern)) return info;
  }

  // Derive neighborhood + dining suggestions from street/address patterns
  let neighborhood = null;
  let parking = null;
  let nearby_dining = [];

  if (/pan american|pan-american freeway/.test(addr)) {
    neighborhood = 'near the Pan American Freeway (I-25), midtown/north Albuquerque';
    parking = 'Parking typically available in adjacent lots.';
    nearby_dining = [{ name: 'Flying Star Cafe (Juan Tabo)', why: 'Good NM comfort food and coffee, 10 min east' }];
  } else if (/central ave/.test(addr)) {
    const block = parseInt(addr.match(/(\d+)\s+central/)?.[1] || '0');
    if (block < 1000) {
      neighborhood = 'on Central Ave in Downtown Albuquerque';
      nearby_dining = [
        { name: 'Gold Street Caffe', why: 'Cocktails and small plates, walkable from here' },
        { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, 10 min east, NM institution' },
      ];
    } else if (block < 3000) {
      neighborhood = 'on Central Ave / EDo (East Downtown)';
      nearby_dining = [
        { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, green chile institution, 5 min walk' },
        { name: 'Twisters Burritos', why: 'Quick green chile burritos, nearby on Central' },
      ];
    } else if (block < 5000) {
      neighborhood = 'on Central Ave in the Nob Hill neighborhood';
      nearby_dining = [
        { name: 'Flying Star Cafe (Nob Hill)', why: 'Right in Nob Hill, great NM food and cocktails' },
        { name: 'Frontier Restaurant (Central & Cornell)', why: '10 min walk west, open until midnight' },
      ];
    } else if (block < 8000) {
      neighborhood = 'on Central Ave in the Heights';
      nearby_dining = [
        { name: 'Garcia\'s Kitchen (Central)', why: 'Classic NM diner with green chile, a Heights staple' },
      ];
    } else {
      neighborhood = 'on Central Ave in the Far East Heights';
    }
  } else if (/university blvd/.test(addr)) {
    neighborhood = 'on University Blvd near UNM, central Albuquerque';
    nearby_dining = [
      { name: 'Frontier Restaurant (Central & Cornell)', why: 'UNM institution, open until midnight, 5 min walk' },
    ];
  } else if (/lomas blvd/.test(addr)) {
    neighborhood = 'on Lomas Blvd in central Albuquerque';
    nearby_dining = [
      { name: 'Flying Star Cafe (Nob Hill)', why: 'Good NM food and coffee, 10 min east' },
    ];
  } else if (/paseo del norte/.test(addr)) {
    neighborhood = 'near Paseo del Norte, in the north Albuquerque / Journal Center area';
    nearby_dining = [
      { name: 'El Pinto (4th St NW)', why: 'NM classics and margaritas, 10 min southwest on 4th' },
    ];
  } else if (/montgomery/.test(addr)) {
    neighborhood = 'on Montgomery in the Northeast Heights';
    nearby_dining = [
      { name: 'Quarters BBQ (Louisiana Blvd)', why: 'Local BBQ landmark nearby' },
      { name: 'Flying Star Cafe (Juan Tabo)', why: 'Good NM comfort food and pastries, 10 min east' },
    ];
  } else if (/academy.*ne|ne.*academy/.test(addr)) {
    neighborhood = 'in the Northeast Heights near Academy Blvd';
    nearby_dining = [
      { name: 'Flying Star Cafe (Juan Tabo)', why: 'NM comfort food, pastries, great margaritas' },
    ];
  } else if (/rio rancho/.test(addr) || /rio rancho/.test(key)) {
    neighborhood = 'in Rio Rancho, about 15 miles northwest of downtown Albuquerque';
    nearby_dining = [
      { name: 'Tucanos Brazilian Grill (Rio Rancho)', why: 'All-you-can-eat Brazilian BBQ, popular in Rio Rancho' },
    ];
  } else if (/4th st.*nw|nw.*4th/.test(addr)) {
    neighborhood = 'on North 4th St NW, in the North Valley area';
    nearby_dining = [
      { name: 'El Pinto Restaurant (N 4th St NW)', why: 'Legendary NM restaurant with huge patio and great margaritas' },
      { name: 'Casa de Benavidez (Rio Grande Blvd)', why: 'Family NM cooking, a North Valley institution' },
    ];
  } else if (/old town|mountain rd nw/.test(addr)) {
    neighborhood = 'in Old Town Albuquerque';
    nearby_dining = [
      { name: 'Casa Chaco (Hotel Albuquerque)', why: 'Patio dining with Old Town views' },
      { name: 'Casa de Benavidez (Rio Grande Blvd)', why: 'NM classics and margaritas, 5 min drive' },
    ];
  } else if (/downtown|civic plaza|marquette|gold ave|copper ave/.test(addr)) {
    neighborhood = 'in Downtown Albuquerque';
    nearby_dining = [
      { name: 'Gold Street Caffe', why: 'Cocktails and tapas, walkable downtown spot' },
      { name: 'Frontier Restaurant (Central & Cornell)', why: 'Open until midnight, 15 min walk east on Central' },
    ];
  }

  if (neighborhood || parking || nearby_dining.length) return { neighborhood, parking, nearby_dining };
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
  const tmParking  = tmVenue?.parkingDetail || '';
  const category   = [segment, genre].filter(Boolean).join(' / ');

  // Pre-compute venue context (neighborhood, parking, nearby dining seeds)
  const venueCtx      = getVenueContext(venueName, addrLine);
  const neighborhoodLine = venueCtx?.neighborhood
    ? `- Venue neighborhood (USE VERBATIM — never contradict): ${venueCtx.neighborhood}`
    : '';
  const parkingLine      = (venueCtx?.parking || tmParking)
    ? `- Parking: ${venueCtx?.parking || tmParking.slice(0, 200)}`
    : '';
  // Inject pre-seeded nearby dining so the LLM has real names to work with
  const diningSeeds = venueCtx?.nearby_dining?.length
    ? `- Nearby dining (verified, use these): ${JSON.stringify(venueCtx.nearby_dining)}`
    : '';

  const hasSeeds = !!(venueCtx?.nearby_dining?.length);

  const prompt = `You are a knowledgeable local Albuquerque guide helping people decide whether to attend an event.

Given the event details below, produce a JSON object with EXACTLY these keys:

{
  "about": "1-2 SPECIFIC sentences about the performer, act, or event — the artist's sound, the teams/stakes, what makes THIS distinctive. Return null if you have nothing specific beyond restating the title.",
  "highlights": [
    "A specific detail about the experience — NOT venue address, parking, or event time",
    "Another specific detail about the performance, sport, or activity itself",
    "Optional third highlight — only if you have a genuinely distinct third thing to say"
  ],
  "venue_tips": "WHERE in Albuquerque the venue is + parking/arrival info. Use the Venue neighborhood line verbatim if provided. Return null only if venue is completely unknown.",
  "nearby_dining": [
    {"name": "Restaurant name", "why": "What it is and why it pairs with this event"}
  ],
  "local_rec": "One SPECIFIC verifiable insider tip about this exact venue or neighborhood in ABQ. Return null if you cannot name something concrete."
}

EVENT DETAILS:
- Name: ${name}
- Category: ${category || event.category || 'Event'}
- Date: ${date}${time ? ' at ' + time : ''}
- Venue: ${venueName || '(unknown)'}${venueAddr !== cityName + ', NM' ? ' — ' + venueAddr : ''}
${neighborhoodLine}
${parkingLine}
${diningSeeds}
${info ? `- Description: ${info.slice(0, 500)}` : ''}

RULES — follow exactly:
1. Return ONLY the raw JSON object. No markdown fences, no preamble, no trailing text.
2. "about": Return null for generic community meetings, recurring library programs, or any event where you can only restate the title. Never write "This promises to be..." or "This is a great opportunity to..."
3. "highlights": Return 2–3 items. EVERY item must be specific to THIS event. NEVER include venue address, parking info, event start time, or anything that belongs in venue_tips. Return 2 items rather than padding to 3.
4. "venue_tips": Use the "Venue neighborhood" line verbatim if provided. Never contradict it.
5. "nearby_dining": ${hasSeeds
    ? 'Use the verified "Nearby dining" seeds listed above — include 2–3 of them. Do not add any others.'
    : 'Return [] — no dining seeds were provided for this venue. Do NOT suggest any restaurants.'
  }
6. "local_rec": Return null UNLESS you know a SPECIFIC, VERIFIABLE fact about this exact venue — e.g., "The KiMo has a stunning 1927 Pueblo Deco lobby worth arriving early for" or "Exit Isleta Amphitheater via Isleta Blvd south — the I-25 ramp backs up for miles after big shows." Generic tips like "near the freeway so check traffic" or "parking can be busy" are NOT acceptable. Return null.
7. Never state specific day names (Monday, Friday…) unless the event text explicitly says them.
8. If venue is in Rio Rancho or Santa Fe, note the distance from Albuquerque in venue_tips.
9. For volunteer/service events: say what participants actually DO, not why it matters.`;

  return { prompt, hasSeeds };
}

// ── Parse LM response ─────────────────────────────────────────────────────────
function parseEnrichment(text, hasSeeds = false) {
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

  // Sanitize nearby_dining — must be array of {name, why} objects
  let nearby_dining = [];
  if (Array.isArray(parsed.nearby_dining)) {
    nearby_dining = parsed.nearby_dining
      .filter(d => d && typeof d.name === 'string' && d.name.trim())
      .map(d => ({ name: d.name.trim(), why: (d.why || '').trim() }))
      .slice(0, 4);
  }
  // Hard rule: no seeds → no suggestions (model hallucinate restaurant names)
  if (!hasSeeds) nearby_dining = [];

  // Null out generic local_recs — these are things any LLM would write for any venue
  let local_rec = typeof parsed.local_rec === 'string' ? parsed.local_rec.trim() : null;
  const GENERIC_LOCAL_REC_PATTERNS = [
    /traffic\s+cam/i,
    /live\s+traffic/i,
    /unexpected\s+congestion/i,
    /before\s+heading\s+over/i,
    /near.*freeway.*locals/i,
    /locals\s+often\s+recommend/i,
    /great\s+(opportunity|way\s+to)/i,
    /consider\s+arriving\s+early/i,
  ];
  if (local_rec && GENERIC_LOCAL_REC_PATTERNS.some(p => p.test(local_rec))) {
    local_rec = null;
  }

  // Filter highlights: remove venue-location / parking / time padding
  let highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights.map(h => String(h).trim()).filter(h => h.length > 10)
    : [];
  const HIGHLIGHT_PADDING = [
    /^(the\s+event\s+takes\s+place\s+at|this\s+is\s+an?\s+(evening|morning|afternoon))/i,
    /parking\s+lot\s+located/i,
    /free\s+(on-?site\s+)?parking/i,
    /attendees\s+can\s+utilize/i,
  ];
  highlights = highlights.filter(h => !HIGHLIGHT_PADDING.some(p => p.test(h)));

  return {
    about:          typeof parsed.about       === 'string'  ? parsed.about.trim()    : null,
    highlights,
    venue_tips:     typeof parsed.venue_tips  === 'string'  ? parsed.venue_tips.trim() : null,
    nearby_dining,
    local_rec,
    local_tips:     typeof parsed.local_tips  === 'string'  ? parsed.local_tips.trim() : null,
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
    filter = `event_date=gte.${today}&hidden=eq.false&raw->>name=not.is.null&order=event_date.asc&limit=500`;
  } else {
    // Only enrich events that are missing ai_enrichment OR have the old schema (no nearby_dining)
    filter = `event_date=gte.${today}&hidden=eq.false&raw->>name=not.is.null&or=(ai_enrichment.is.null,ai_enrichment->nearby_dining.is.null)&order=event_date.asc&limit=500`;
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
      const { prompt, hasSeeds } = buildPrompt(row);
      const response   = await callLM(prompt);
      const enrichment = parseEnrichment(response, hasSeeds);
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
