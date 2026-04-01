#!/usr/bin/env python3
"""
ABQ Unplugged — Place Enrichment Script (Windows)
=================================================
Enriches every place with hours, phone, website, and an AI insider tip.
Zero recurring API costs — data comes from:
  ① OpenStreetMap Overpass  (free, no key)  → hours, phone, website URL
  ② Business website scrape (free)          → Schema.org JSON-LD, contact info
  ③ Ollama local LLM        (free, offline) → insider tip

Optional (low-volume, you control):
  ④ Google Places Details   (pay-per-call)  → enable with --google flag only

SETUP (one-time):
  1. pip install supabase requests beautifulsoup4 lxml
  2. Install Ollama  →  https://ollama.ai
     ollama pull llama3.2
  3. Create .env next to this script:
       SUPABASE_URL=https://bsmvfutebmbkjvlrhiyq.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=<service role key>
       LM_STUDIO_URL=http://localhost:1234/v1/chat/completions   # default, change if needed
       GOOGLE_PLACES_API_KEY=<optional — only used with --google flag>

  4. Open LM Studio → Local Server tab → Start Server
     Load a model (qwen3.5-27b recommended for best tips)

RUN:
  python enrich-places-windows.py                        # full pipeline
  python enrich-places-windows.py --limit 20             # test on 20 places first
  python enrich-places-windows.py --model qwen3.5-9b     # use faster/smaller model
  python enrich-places-windows.py --skip-ai --skip-osm   # scrape only, no AI
  python enrich-places-windows.py --google               # also call Google Details (sparingly)
  python enrich-places-windows.py --resync               # re-upload cached data, no new scraping
  python enrich-places-windows.py --stats                # cache stats only

Cache lives at: ~/.abq-enrichment-cache.db  (SQLite, safe to Ctrl+C and restart)
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
import unicodedata
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────────────────────
missing = []
try:
    import requests
except ImportError:
    missing.append('requests')
try:
    from bs4 import BeautifulSoup
except ImportError:
    missing.append('beautifulsoup4')
try:
    from supabase import create_client
except ImportError:
    missing.append('supabase')
if missing:
    print(f"Missing packages. Run:  pip install {' '.join(missing)}")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

def load_env():
    env = Path(__file__).parent / '.env'
    if env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                os.environ.setdefault(k.strip(), v.strip().strip('"\''))

load_env()

SUPABASE_URL    = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY    = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
GOOGLE_KEY      = os.environ.get('GOOGLE_PLACES_API_KEY', '')
LM_STUDIO_URL   = os.environ.get('LM_STUDIO_URL', 'http://localhost:1234/v1/chat/completions')
LM_STUDIO_BASE  = os.environ.get('LM_STUDIO_URL', 'http://localhost:1234').replace('/v1/chat/completions', '')
OVERPASS_URL    = 'https://overpass-api.de/api/interpreter'
CACHE_DB      = Path.home() / '.abq-enrichment-cache.db'
ABQ_BBOX      = (34.9, -107.5, 35.4, -106.2)  # south,west,north,east
BATCH_SYNC    = 25
PAGE_SIZE     = 1000

SCRAPE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; ABQUnplugged/1.0; community app enrichment bot)',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
}

# ── SQLite cache ──────────────────────────────────────────────────────────────

def open_cache() -> sqlite3.Connection:
    con = sqlite3.connect(str(CACHE_DB))
    con.execute('''CREATE TABLE IF NOT EXISTS enriched (
        place_id    TEXT PRIMARY KEY,
        place_name  TEXT,
        tip         TEXT,
        hours       TEXT,
        phone       TEXT,
        website     TEXT,
        menu        TEXT,
        source      TEXT,
        tip_model   TEXT,
        synced      INTEGER DEFAULT 0,
        created_at  TEXT
    )''')
    # Add menu column if upgrading from older cache
    try:
        con.execute('ALTER TABLE enriched ADD COLUMN menu TEXT')
        con.commit()
    except Exception:
        pass
    con.commit()
    return con


def cache_stats(con):
    total  = con.execute('SELECT COUNT(*) FROM enriched').fetchone()[0]
    tips   = con.execute("SELECT COUNT(*) FROM enriched WHERE tip IS NOT NULL AND tip!=''").fetchone()[0]
    hours  = con.execute("SELECT COUNT(*) FROM enriched WHERE hours IS NOT NULL").fetchone()[0]
    synced = con.execute('SELECT COUNT(*) FROM enriched WHERE synced=1').fetchone()[0]
    print(f'\n── Cache  {CACHE_DB}')
    print(f'   Total    : {total}')
    print(f'   Tips     : {tips}')
    print(f'   Hours    : {hours}')
    print(f'   Synced   : {synced}  /  Pending: {total - synced}\n')

# ── Supabase ──────────────────────────────────────────────────────────────────

def fetch_all_places(sb):
    places, page = [], 0
    print('Fetching places from Supabase…')
    while True:
        res = sb.from_('places').select('id, raw').range(
            page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1
        ).execute()
        if not res.data:
            break
        places.extend(res.data)
        print(f'  …{len(places)}')
        if len(res.data) < PAGE_SIZE:
            break
        page += 1
    print(f'  Total: {len(places)}\n')
    return places


def sync_to_supabase(sb, con, force_all=False):
    where = '' if force_all else 'WHERE synced=0'
    rows  = con.execute(
        f'SELECT place_id, tip, hours, phone, website, menu, created_at FROM enriched {where}'
    ).fetchall()
    if not rows:
        print('  Nothing to sync.')
        return
    upserts = []
    for place_id, tip, hours, phone, website, menu, created_at in rows:
        e = {'enriched_at': created_at}
        if tip:     e['tip']     = tip
        if hours:   e['hours']   = hours
        if phone:   e['phone']   = phone
        if website: e['website'] = website
        if menu:    e['menu']    = menu
        upserts.append({'id': place_id, 'enriched': e})
    for u in upserts:
        sb.from_('places').update({'enriched': u['enriched']}).eq('id', u['id']).execute()
    ids = [r[0] for r in rows]
    con.execute(f'UPDATE enriched SET synced=1 WHERE place_id IN ({",".join("?"*len(ids))})', ids)
    con.commit()
    print(f'  ✓ Synced {len(upserts)} places')

# ── ① OpenStreetMap / Overpass ────────────────────────────────────────────────

def _slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return ''.join(c.lower() for c in s if c.isalnum() or c.isspace()).strip()


def _fmt_osm_hours(raw):
    if not raw:
        return None
    if raw.strip() == '24/7':
        return 'Open 24/7'
    DAY = {'Mo':'Mon','Tu':'Tue','We':'Wed','Th':'Thu','Fr':'Fri','Sa':'Sat','Su':'Sun'}
    try:
        parts = []
        for seg in raw.split(';'):
            seg = seg.strip()
            if not seg:
                continue
            tokens = seg.split(None, 1)
            if len(tokens) == 2:
                days, times = tokens
                for s, l in DAY.items():
                    days = days.replace(s, l)
                parts.append(f'{days} {times}')
            else:
                parts.append(seg)
        return ' | '.join(parts)
    except Exception:
        return raw


def osm_lookup(name, lat, lng):
    """Query Overpass for the place; return dict with hours/phone/website."""
    if lat and lng:
        d    = 0.006
        bbox = f'{lat-d},{lng-d},{lat+d},{lng+d}'
    else:
        bbox = '{},{},{},{}'.format(*ABQ_BBOX)

    safe = name.replace('"', '\\"')
    query = f'''
[out:json][timeout:15];
(
  node["name"~"^{safe}$",i]({bbox});
  way["name"~"^{safe}$",i]({bbox});
);
out body;
'''
    try:
        r    = requests.post(OVERPASS_URL, data={'data': query}, timeout=22)
        els  = r.json().get('elements', [])
    except Exception as e:
        print(f'    OSM error: {e}')
        return {}

    if not els:
        return {}

    def score(el):
        t      = el.get('tags', {})
        nm     = t.get('name', '')
        match  = 10 if _slug(nm) == _slug(name) else 0
        rich   = sum(1 for k in ('opening_hours','phone','website','contact:phone','contact:website') if k in t)
        return match + rich

    tags = max(els, key=score).get('tags', {})
    return {
        'hours':   _fmt_osm_hours(tags.get('opening_hours')),
        'phone':   tags.get('phone') or tags.get('contact:phone'),
        'website': tags.get('website') or tags.get('contact:website') or tags.get('url'),
    }

# ── ② Website scraper ─────────────────────────────────────────────────────────

_PHONE_RE = re.compile(
    r'(?<!\d)(\+?1[-.\s]?)?'
    r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)'
)

_HOUR_KEYWORDS = re.compile(
    r'(hours|hours of operation|open|monday|tuesday|we(dnesday)?|thursday|friday|saturday|sunday)',
    re.IGNORECASE,
)

_MENU_RE = re.compile(
    r'href=["\']([^"\']*(?:menu|menus)[^"\']*)["\']',
    re.IGNORECASE,
)


def _clean_phone(raw):
    digits = re.sub(r'\D', '', raw)
    if len(digits) == 10:
        return f'({digits[:3]}) {digits[3:6]}-{digits[6:]}'
    if len(digits) == 11 and digits[0] == '1':
        return f'({digits[1:4]}) {digits[4:7]}-{digits[7:]}'
    return raw.strip()


def _extract_schema(soup):
    """Pull hours/phone/description from Schema.org JSON-LD blocks."""
    result = {}
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string or '')
        except Exception:
            continue
        # Handle @graph arrays
        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if isinstance(node, dict) and node.get('@graph'):
                nodes.extend(node['@graph'])
        for node in nodes:
            if not isinstance(node, dict):
                continue
            t = node.get('@type', '')
            if not any(x in str(t) for x in ('LocalBusiness','Restaurant','Store','Organization','Hotel','Cafe','Bar','Museum')):
                continue

            # Phone
            if not result.get('phone'):
                ph = node.get('telephone') or node.get('phone')
                if ph:
                    result['phone'] = _clean_phone(str(ph))

            # Website
            if not result.get('website'):
                result['website'] = node.get('url') or node.get('sameAs')

            # Description
            if not result.get('description'):
                result['description'] = node.get('description')

            # Hours — openingHoursSpecification or openingHours string
            if not result.get('hours'):
                oh = node.get('openingHours')
                if isinstance(oh, list):
                    result['hours'] = ' | '.join(oh)
                elif isinstance(oh, str):
                    result['hours'] = oh
                spec = node.get('openingHoursSpecification')
                if spec and not result.get('hours'):
                    parts = []
                    for s in (spec if isinstance(spec, list) else [spec]):
                        day  = s.get('dayOfWeek', '')
                        day  = day.split('/')[-1] if '/' in str(day) else str(day)
                        opens  = s.get('opens', '')
                        closes = s.get('closes', '')
                        if day and opens:
                            parts.append(f'{day} {opens}–{closes}')
                    if parts:
                        result['hours'] = ' | '.join(parts)
    return result


def _extract_page_patterns(soup, existing):
    """
    Fallback: scan visible text for phone numbers and hours-like content.
    Only fills gaps not already found by Schema.org.
    """
    text = soup.get_text(separator=' ', strip=True)

    # Phone
    if not existing.get('phone'):
        m = _PHONE_RE.search(text)
        if m:
            existing['phone'] = _clean_phone(m.group())

    # Hours — look for table rows / dt-dd pairs / paragraphs mentioning days
    if not existing.get('hours'):
        # Try definition lists or table cells
        hour_chunks = []
        for tag in soup.find_all(['dt', 'td', 'th', 'li', 'p', 'span', 'div']):
            t = tag.get_text(strip=True)
            if _HOUR_KEYWORDS.search(t) and len(t) < 120:
                hour_chunks.append(t)
            if len(hour_chunks) >= 7:
                break
        if hour_chunks:
            existing['hours'] = ' | '.join(hour_chunks[:7])

    return existing


def scrape_website(url):
    """Fetch a business website and extract structured data."""
    if not url:
        return {}
    # Normalise URL
    if not url.startswith('http'):
        url = 'https://' + url
    try:
        r = requests.get(url, headers=SCRAPE_HEADERS, timeout=12, allow_redirects=True)
        if r.status_code != 200:
            return {}
        soup = BeautifulSoup(r.content, 'lxml')
    except Exception as e:
        print(f'    Scrape error ({url[:50]}): {e}')
        return {}

    result = _extract_schema(soup)
    result = _extract_page_patterns(soup, result)

    # Menu URL — look for links containing "menu" in href
    if not result.get('menu'):
        html_str = r.text
        menu_match = _MENU_RE.search(html_str)
        if menu_match:
            menu_href = menu_match.group(1)
            # Make absolute if relative
            if menu_href.startswith('http'):
                result['menu'] = menu_href
            elif menu_href.startswith('/'):
                from urllib.parse import urlparse
                base = urlparse(url)
                result['menu'] = f'{base.scheme}://{base.netloc}{menu_href}'
        # Also check for known third-party menu links (Toast, Square, etc.)
        for platform in ['toasttab.com', 'squareup.com/store', 'clover.com/store', 'menupages.com', 'allmenus.com']:
            if platform in html_str:
                pm = re.search(rf'https?://[^"\'\s]*{re.escape(platform)}[^"\'\s]*', html_str)
                if pm and not result.get('menu'):
                    result['menu'] = pm.group(0).rstrip('.,)')

    return result

# ── ③ Google Places Details (optional, low-volume) ───────────────────────────

def google_details(google_place_id):
    if not GOOGLE_KEY or not google_place_id:
        return {}
    fields = 'formatted_phone_number,website,opening_hours,editorial_summary'
    url    = (f'https://maps.googleapis.com/maps/api/place/details/json'
              f'?place_id={google_place_id}&fields={fields}&key={GOOGLE_KEY}')
    try:
        r      = requests.get(url, timeout=10)
        result = r.json().get('result', {})
        hours  = None
        wt     = result.get('opening_hours', {}).get('weekday_text')
        if wt:
            hours = ' | '.join(wt)
        return {
            'phone':       result.get('formatted_phone_number'),
            'website':     result.get('website'),
            'hours':       hours,
            'description': result.get('editorial_summary', {}).get('overview'),
        }
    except Exception as e:
        print(f'    Google error: {e}')
        return {}

# ── ④ LM Studio (OpenAI-compatible local AI) ─────────────────────────────────

def check_lm_studio(model):
    """Verify LM Studio server is running and the requested model is loaded."""
    try:
        resp  = requests.get(f'{LM_STUDIO_BASE}/v1/models', timeout=5)
        avail = [m.get('id', '') for m in resp.json().get('data', [])]
        # Accept exact match or prefix match (e.g. "qwen3.5-27b" matches "qwen/qwen3.5-27b")
        match = any(model in m or m.endswith(model) for m in avail)
        if not match:
            print(f'\n⚠  LM Studio: model "{model}" not loaded.')
            print(f'   Available models: {avail}')
            print(f'   Either load the model in LM Studio or pass --model with one of the above.\n')
            return False
        print(f'  ✓ LM Studio connected at {LM_STUDIO_BASE}  |  model: {model}')
        return True
    except Exception as e:
        print(f'\n⚠  Cannot reach LM Studio at {LM_STUDIO_BASE}')
        print(f'   Make sure LM Studio is open, the server is started, and a model is loaded.\n')
        return False


def generate_tip(name, types, address, rating, model, description=None):
    """Call LM Studio's OpenAI-compatible chat endpoint to generate an insider tip."""
    cat  = (types[0] if types else 'place').replace('_', ' ')
    desc = f'\n  Description: {description[:200]}' if description else ''
    prompt = (
        "You are a friendly Albuquerque local writing short insider tips for a community app called ABQ Unplugged.\n\n"
        f"Write a genuine insider tip (2–3 sentences, max 65 words) for:\n"
        f"  Name: {name}\n"
        f"  Type: {cat}\n"
        f"  Area: {address}\n"
        f"  Rating: {rating}/5{desc}\n\n"
        "Rules:\n"
        "- Second person: \"you\", \"your\"\n"
        "- Specific local knowledge: best time to go, what to order, parking, hidden details\n"
        "- Friendly ABQ local voice, not a marketing blurb\n"
        "- NO emojis. Don't start with \"This place\" or \"I recommend\"\n"
        "- Only the tip — no label or intro\n"
    )
    try:
        r = requests.post(LM_STUDIO_URL, json={
            'model':       model,
            'messages':    [{'role': 'user', 'content': prompt}],
            'temperature': 0.75,
            'max_tokens':  130,
            'top_p':       0.9,
            'stream':      False,
        }, timeout=120)
        tip = r.json()['choices'][0]['message']['content'].strip()
        # Strip any label prefix the model might add
        for pfx in ('Tip:', 'Local tip:', 'Insider tip:', 'ABQ tip:'):
            if tip.lower().startswith(pfx.lower()):
                tip = tip[len(pfx):].strip()
        return tip if len(tip) > 20 else None
    except Exception as e:
        print(f'    LM Studio error: {e}')
        return None

# ── Main ──────────────────────────────────────────────────────────────────────

def merge(*dicts, keys=('hours','phone','website','description')):
    """Return first non-empty value for each key across multiple dicts."""
    out = {}
    for k in keys:
        for d in dicts:
            v = d.get(k) if d else None
            if v:
                out[k] = v
                break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--skip-ai',     action='store_true', help='Skip LM Studio tip generation')
    ap.add_argument('--skip-ollama', action='store_true', help='Alias for --skip-ai (backward compat)')
    ap.add_argument('--skip-osm',    action='store_true', help='Skip OSM lookup')
    ap.add_argument('--skip-scrape', action='store_true', help='Skip website scraping')
    ap.add_argument('--google',      action='store_true', help='Also call Google Places Details API')
    ap.add_argument('--limit',       type=int, default=0)
    ap.add_argument('--resync',      action='store_true')
    ap.add_argument('--model',       default='qwen3.5-27b', help='LM Studio model ID (default: qwen3.5-27b)')
    ap.add_argument('--stats',       action='store_true')
    args = ap.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print('❌  Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env')
        sys.exit(1)

    sb  = create_client(SUPABASE_URL, SUPABASE_KEY)
    con = open_cache()

    if args.stats:
        cache_stats(con)
        return

    if args.resync:
        print('Re-syncing all cached data to Supabase…')
        sync_to_supabase(sb, con, force_all=True)
        return

    skip_ai  = args.skip_ai or args.skip_ollama
    use_ai   = not skip_ai
    if use_ai and not check_lm_studio(args.model):
        print('Continuing without AI tips.\n')
        use_ai = False

    use_osm    = not args.skip_osm
    use_scrape = not args.skip_scrape
    use_google = args.google and bool(GOOGLE_KEY)
    if args.google and not GOOGLE_KEY:
        print('ℹ  --google flag set but GOOGLE_PLACES_API_KEY not in .env — skipping.\n')

    # Print active sources
    sources = []
    if use_osm:    sources.append('OpenStreetMap')
    if use_scrape: sources.append('Website scrape')
    if use_google: sources.append('Google Places Details')
    if use_ai:     sources.append(f'LM Studio ({args.model})')
    print(f'Active sources: {", ".join(sources)}\n')

    all_places = fetch_all_places(sb)
    cached_ids = {r[0] for r in con.execute('SELECT place_id FROM enriched').fetchall()}
    to_enrich  = [p for p in all_places if p['id'] not in cached_ids]
    if args.limit > 0:
        to_enrich = to_enrich[:args.limit]

    print(f'Cached: {len(cached_ids)}  |  To process: {len(to_enrich)}\n')
    if not to_enrich:
        print('✓  All done. Run --resync to re-upload to Supabase.')
        cache_stats(con)
        return

    processed = 0
    for i, place in enumerate(to_enrich):
        raw      = place.get('raw') or {}
        place_id = place['id']
        name     = raw.get('name', 'Unknown')
        types    = raw.get('types', [])
        address  = raw.get('vicinity', '')
        rating   = raw.get('rating') or 0
        geo      = raw.get('geometry', {}).get('location', {})
        lat, lng = geo.get('lat'), geo.get('lng')
        # Google place_id lives inside raw (without the 'google_' prefix we add)
        gpid     = raw.get('place_id', '')

        print(f'[{i+1}/{len(to_enrich)}] {name}')

        osm_data    = {}
        scrape_data = {}
        g_data      = {}

        # ① OSM
        if use_osm:
            osm_data = osm_lookup(name, lat, lng)
            if any(osm_data.values()):
                flags = ' '.join(k for k, v in osm_data.items() if v)
                print(f'  🗺  OSM: {flags}')
            time.sleep(1.1)  # Overpass rate limit: ~1 req/sec

        # ② Scrape the business website
        website_url = osm_data.get('website') or raw.get('website')
        if use_scrape and website_url:
            print(f'  🌐  Scraping {website_url[:60]}…')
            scrape_data = scrape_website(website_url)
            if any(scrape_data.get(k) for k in ('hours','phone','description')):
                flags = ' '.join(k for k in ('hours','phone','website','description') if scrape_data.get(k))
                print(f'      Found: {flags}')
            time.sleep(0.5)

        # ③ Google (optional, gated behind --google flag)
        if use_google and gpid:
            g_data = google_details(gpid)
            time.sleep(0.1)

        # Merge: scrape > OSM > Google (first non-empty wins per field)
        merged = merge(scrape_data, osm_data, g_data, keys=('hours','phone','website','description','menu'))
        hours   = merged.get('hours')
        phone   = merged.get('phone')
        website = website_url or merged.get('website')
        menu    = merged.get('menu')
        desc    = merged.get('description')

        active_sources = '+'.join(filter(None, [
            'osm'    if any(osm_data.values())    else '',
            'scrape' if any(scrape_data.values()) else '',
            'google' if any(g_data.values())      else '',
        ]))

        # ④ LM Studio tip
        tip = None
        if use_ai:
            tip = generate_tip(name, types, address, rating, args.model, description=desc)
            if tip:
                print(f'  💬  {tip[:75]}{"…" if len(tip) > 75 else ""}')

        # Save to cache
        import datetime as _dt
        con.execute('''INSERT OR REPLACE INTO enriched
            (place_id, place_name, tip, hours, phone, website, menu, source, tip_model, synced, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,0,?)
        ''', (place_id, name, tip, hours, phone, website, menu, active_sources,
              args.model if use_ai else None, _dt.datetime.utcnow().isoformat()))
        con.commit()
        processed += 1

        if processed % BATCH_SYNC == 0:
            print(f'\n── Batch sync ──')
            sync_to_supabase(sb, con)
            print()

    print('\n── Final sync ──')
    sync_to_supabase(sb, con)
    cache_stats(con)
    print('✅  Done!')


if __name__ == '__main__':
    main()
