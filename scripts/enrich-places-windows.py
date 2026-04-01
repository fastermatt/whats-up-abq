#!/usr/bin/env python3
"""
ABQ Unplugged — Place Enrichment Script (Windows)
==================================================
Runs on your Windows PC. Uses Ollama (free local LLM) to write an insider tip
for every place, and optionally calls Google Places Details API for real hours,
phone, and website. Everything is cached in a local SQLite database so the
script can be stopped and resumed without losing work or wasting API calls.

SETUP (one-time):
  1. Install Python  https://python.org
  2. pip install supabase requests
  3. Install Ollama  https://ollama.ai
     In a terminal: ollama pull llama3.2
  4. Create a .env file next to this script (or set env vars):
       SUPABASE_URL=https://bsmvfutebmbkjvlrhiyq.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=<your service role key>
       GOOGLE_PLACES_API_KEY=<optional — enables real hours/phone/website>

RUN:
  python enrich-places-windows.py

  Flags:
    --skip-ollama      Skip LLM tip generation (Google Details only)
    --skip-google      Skip Google Details API (tips only)
    --limit N          Only process N places (useful for testing)
    --resync           Re-upload all cached data to Supabase (no new generation)
    --model NAME       Ollama model to use (default: llama3.2)
    --stats            Print cache stats and exit

The script saves progress to ~/.abq-enrichment-cache.db (SQLite).
It will skip places already in the cache. Safe to Ctrl+C and restart.
"""

import argparse
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────────────────────

try:
    import requests
except ImportError:
    print("Missing 'requests'. Run: pip install requests")
    sys.exit(1)

try:
    from supabase import create_client
except ImportError:
    print("Missing 'supabase'. Run: pip install supabase")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

def load_env():
    """Load .env file from the script directory if it exists."""
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                os.environ.setdefault(k.strip(), v.strip().strip('"\''))

load_env()

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
GOOGLE_KEY   = os.environ.get('GOOGLE_PLACES_API_KEY', '')
OLLAMA_URL   = os.environ.get('OLLAMA_URL', 'http://localhost:11434/api/generate')
CACHE_DB     = Path.home() / '.abq-enrichment-cache.db'
BATCH_SYNC   = 20   # upload to Supabase every N places
PAGE_SIZE    = 1000 # Supabase fetch page size

# ── SQLite cache ──────────────────────────────────────────────────────────────

def open_cache() -> sqlite3.Connection:
    con = sqlite3.connect(str(CACHE_DB))
    con.execute('''
        CREATE TABLE IF NOT EXISTS enriched (
            place_id      TEXT PRIMARY KEY,
            place_name    TEXT,
            tip           TEXT,
            hours         TEXT,
            phone         TEXT,
            website       TEXT,
            editorial     TEXT,
            tip_model     TEXT,
            synced        INTEGER DEFAULT 0,
            enriched_at   TEXT DEFAULT (datetime('now'))
        )
    ''')
    con.commit()
    return con


def cache_stats(con: sqlite3.Connection):
    total   = con.execute('SELECT COUNT(*) FROM enriched').fetchone()[0]
    with_tip = con.execute("SELECT COUNT(*) FROM enriched WHERE tip IS NOT NULL AND tip != ''").fetchone()[0]
    with_hours = con.execute("SELECT COUNT(*) FROM enriched WHERE hours IS NOT NULL").fetchone()[0]
    synced  = con.execute('SELECT COUNT(*) FROM enriched WHERE synced=1').fetchone()[0]
    print(f'\n── Cache stats ({CACHE_DB}) ──')
    print(f'  Total cached:   {total}')
    print(f'  With tips:      {with_tip}')
    print(f'  With hours:     {with_hours}')
    print(f'  Synced to DB:   {synced}')
    print(f'  Unsynced:       {total - synced}\n')

# ── Supabase ──────────────────────────────────────────────────────────────────

def fetch_all_places(sb):
    """Page through all places in Supabase and return id + raw data."""
    places = []
    page = 0
    print('Fetching places from Supabase…')
    while True:
        res = sb.from_('places') \
                .select('id, raw') \
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1) \
                .execute()
        if not res.data:
            break
        places.extend(res.data)
        print(f'  Fetched {len(places)} so far…')
        if len(res.data) < PAGE_SIZE:
            break
        page += 1
    print(f'  Total: {len(places)} places')
    return places


def sync_to_supabase(sb, con: sqlite3.Connection, force_all=False):
    """Upload unsynced (or all) cached rows to Supabase enriched column."""
    where = '' if force_all else 'WHERE synced=0'
    rows = con.execute(f'''
        SELECT place_id, tip, hours, phone, website, editorial, enriched_at
        FROM enriched {where}
    ''').fetchall()

    if not rows:
        print('  Nothing to sync.')
        return

    upserts = []
    for place_id, tip, hours, phone, website, editorial, enriched_at in rows:
        enriched = {'enriched_at': enriched_at}
        if tip:       enriched['tip']       = tip
        if hours:     enriched['hours']     = hours
        if phone:     enriched['phone']     = phone
        if website:   enriched['website']   = website
        if editorial: enriched['editorial'] = editorial
        upserts.append({'id': place_id, 'enriched': enriched})

    sb.from_('places').upsert(upserts, on_conflict='id').execute()
    ids = [r[0] for r in rows]
    placeholders = ','.join('?' * len(ids))
    con.execute(f'UPDATE enriched SET synced=1 WHERE place_id IN ({placeholders})', ids)
    con.commit()
    print(f'  ✓ Synced {len(upserts)} places to Supabase')

# ── Ollama ────────────────────────────────────────────────────────────────────

def check_ollama(model: str) -> bool:
    """Check if Ollama is running and the model is available."""
    try:
        r = requests.get('http://localhost:11434/api/tags', timeout=3)
        tags = r.json().get('models', [])
        available = [m.get('name', '').split(':')[0] for m in tags]
        if model not in available and model.split(':')[0] not in available:
            print(f'\n⚠ Ollama is running but model "{model}" not found.')
            print(f'  Available: {available}')
            print(f'  Run: ollama pull {model}\n')
            return False
        return True
    except Exception:
        print('\n⚠ Ollama is not running. Start it with: ollama serve')
        print('  Or download from: https://ollama.ai\n')
        return False


def generate_tip(name: str, category: str, address: str, rating: float,
                 model: str) -> str | None:
    """Call Ollama to generate an insider tip for this place."""
    # Clean up category (Google API types use underscores)
    cat_clean = category.replace('_', ' ')

    prompt = (
        f"You are a friendly Albuquerque local writing short insider tips for a community app.\n\n"
        f"Write a genuine, specific insider tip (2–3 sentences, max 65 words) for:\n"
        f"  Name: {name}\n"
        f"  Type: {cat_clean}\n"
        f"  Area: {address}\n"
        f"  Rating: {rating}/5\n\n"
        f"Rules:\n"
        f"- Write in second person (\"you\", \"your\")\n"
        f"- Mention something specific: best time to go, what to order, parking, hidden details\n"
        f"- Sound like a friend who lives in ABQ, not a marketing brochure\n"
        f"- NO emojis. NO generic phrases like 'This place is great' or 'I recommend'\n"
        f"- Output the tip only — no intro, no label, just the tip text\n"
    )

    try:
        r = requests.post(OLLAMA_URL, json={
            'model': model,
            'prompt': prompt,
            'stream': False,
            'options': {
                'temperature': 0.75,
                'num_predict': 120,
                'top_p': 0.9,
            }
        }, timeout=45)
        tip = r.json().get('response', '').strip()
        # Strip any leading label like "Tip:" the model might add
        for prefix in ('Tip:', 'Insider tip:', 'Local tip:'):
            if tip.lower().startswith(prefix.lower()):
                tip = tip[len(prefix):].strip()
        return tip if len(tip) > 20 else None
    except Exception as e:
        print(f'    Ollama error: {e}')
        return None

# ── Google Places Details ─────────────────────────────────────────────────────

def get_google_details(google_place_id: str) -> dict:
    """Fetch real hours, phone, website, editorial from Google Places Details API."""
    if not GOOGLE_KEY or not google_place_id:
        return {}
    fields = 'formatted_phone_number,website,opening_hours,editorial_summary'
    url = (
        f'https://maps.googleapis.com/maps/api/place/details/json'
        f'?place_id={google_place_id}&fields={fields}&key={GOOGLE_KEY}'
    )
    try:
        r = requests.get(url, timeout=10)
        result = r.json().get('result', {})
        hours_text = None
        weekday = result.get('opening_hours', {}).get('weekday_text')
        if weekday:
            hours_text = ' | '.join(weekday)
        return {
            'phone':     result.get('formatted_phone_number'),
            'website':   result.get('website'),
            'hours':     hours_text,
            'editorial': result.get('editorial_summary', {}).get('overview'),
        }
    except Exception as e:
        print(f'    Google Details error: {e}')
        return {}

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Enrich ABQ Unplugged places')
    parser.add_argument('--skip-ollama',  action='store_true', help='Skip tip generation')
    parser.add_argument('--skip-google',  action='store_true', help='Skip Google Details API')
    parser.add_argument('--limit',        type=int, default=0, help='Max places to process')
    parser.add_argument('--resync',       action='store_true', help='Re-upload all cached data')
    parser.add_argument('--model',        default='llama3.2', help='Ollama model name')
    parser.add_argument('--stats',        action='store_true', help='Print stats and exit')
    args = parser.parse_args()

    # Validate config
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
        print('   Create a .env file next to this script or set env vars.')
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

    # Check Ollama if we'll use it
    use_ollama = not args.skip_ollama
    if use_ollama and not check_ollama(args.model):
        print('Continuing without Ollama tip generation (use --skip-ollama to suppress this message).')
        use_ollama = False

    use_google = not args.skip_google and bool(GOOGLE_KEY)
    if not args.skip_google and not GOOGLE_KEY:
        print('ℹ GOOGLE_PLACES_API_KEY not set — skipping real hours/phone/website.')
        print('  Add it to .env to enable Google Places Details.\n')

    # Fetch places from Supabase
    all_places = fetch_all_places(sb)

    # Filter out already-cached places
    cached_ids = {row[0] for row in con.execute('SELECT place_id FROM enriched').fetchall()}
    to_enrich  = [p for p in all_places if p['id'] not in cached_ids]

    if args.limit > 0:
        to_enrich = to_enrich[:args.limit]

    print(f'\nAlready cached: {len(cached_ids)}  |  To process: {len(to_enrich)}\n')

    if not to_enrich:
        print('✓ All places already enriched! Run --resync to re-upload to Supabase.')
        cache_stats(con)
        return

    processed = 0
    for i, place in enumerate(to_enrich):
        raw           = place.get('raw') or {}
        place_id      = place['id']
        name          = raw.get('name', 'Unknown')
        types         = raw.get('types', [])
        category      = types[0] if types else 'point_of_interest'
        address       = raw.get('vicinity', '')
        rating        = raw.get('rating', 0) or 0
        google_pid    = raw.get('place_id', '')  # original Google place_id

        print(f'[{i+1}/{len(to_enrich)}] {name}  ({category})')

        tip = editorial = phone = website = hours = None

        # Generate insider tip via local LLM
        if use_ollama:
            tip = generate_tip(name, category, address, rating, args.model)
            if tip:
                preview = tip[:70] + '…' if len(tip) > 70 else tip
                print(f'  💬 {preview}')
            else:
                print(f'  ⚠ No tip generated')

        # Fetch real data from Google Places Details API
        if use_google and google_pid:
            details  = get_google_details(google_pid)
            phone    = details.get('phone')
            website  = details.get('website')
            hours    = details.get('hours')
            editorial = details.get('editorial')
            if phone or hours:
                print(f'  📞 {phone or "–"}  🕐 {"hours found" if hours else "–"}')
            time.sleep(0.1)  # be polite to Google's API

        # Save to SQLite cache
        con.execute('''
            INSERT OR REPLACE INTO enriched
              (place_id, place_name, tip, hours, phone, website, editorial, tip_model, synced, enriched_at)
            VALUES (?,?,?,?,?,?,?,?,0,datetime('now'))
        ''', (place_id, name, tip, hours, phone, website, editorial, args.model if use_ollama else None))
        con.commit()

        processed += 1

        # Batch sync to Supabase
        if processed % BATCH_SYNC == 0:
            print(f'\n  ── Syncing batch to Supabase…')
            sync_to_supabase(sb, con)
            print()

    # Final sync
    print('\n── Final sync to Supabase ──')
    sync_to_supabase(sb, con)

    cache_stats(con)
    print('✅ Done!')


if __name__ == '__main__':
    main()
