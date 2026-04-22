#!/usr/bin/env python3
"""
ABQ Unplugged — Multi-Source Event Fetcher
==========================================
Fetches events from 6 sources, normalizes them to TMEvent format,
and outputs JSON to stdout for Claude to upsert via Supabase MCP.

Sources:
  seatgeek           - SeatGeek API (concerts, sports, comedy)
  albuquerque.events - WordPress + The Events Calendar plugin
  albuquerquecc.com  - ABQ Convention Center (WordPress + MEC)
  cabq.gov/events    - City of Albuquerque events (Plone CMS)
  newmexico.org      - Visit New Mexico (CivicPlus)
  newmexicomagazine  - New Mexico Magazine event calendar

Usage:
  python3 fetch_multi_source_events.py           — fetch all sources
  python3 fetch_multi_source_events.py seatgeek  — fetch one source only

Output:
  JSON array of event rows to stdout, each with:
    { "id": str, "source": str, "raw": {...TMEvent...}, "event_date": "YYYY-MM-DD" }
"""

import sys
import re
import json
import time
import hashlib
import requests
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

# ─── CONFIG ─────────────────────────────────────────────────────────────────
SEATGEEK_AID = "a74134c31c4ac4008d2c75ce858e2c4a1d84fc400c66eccfc706accd32ec9c2e"

TODAY       = datetime.now().strftime('%Y-%m-%d')
FUTURE_90   = (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')
FUTURE_180  = (datetime.now() + timedelta(days=180)).strftime('%Y-%m-%d')

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def slug_id(prefix: str, *parts: str) -> str:
    """Generate a stable, unique ID from prefix + string parts."""
    h = hashlib.md5(''.join(parts).encode()).hexdigest()[:10]
    return f"{prefix}_{h}"


def parse_date(raw: str) -> str:
    """
    Try to parse a date string into YYYY-MM-DD.
    Handles: ISO datetimes, 'April 15 2026', 'Apr 15, 2026', etc.
    Returns '' if unparseable.
    """
    if not raw:
        return ''
    raw = raw.strip()
    # ISO / already formatted
    m = re.match(r'(\d{4}-\d{2}-\d{2})', raw)
    if m:
        return m.group(1)
    # Try common human formats
    for fmt in ('%B %d, %Y', '%b %d, %Y', '%B %d %Y', '%b %d %Y',
                '%m/%d/%Y', '%m-%d-%Y', '%d %B %Y', '%d %b %Y'):
        try:
            return datetime.strptime(raw, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    # Partial: "April 15" — assume current/next year
    m = re.match(r'([A-Za-z]+)\s+(\d{1,2})$', raw)
    if m:
        for yr in [datetime.now().year, datetime.now().year + 1]:
            try:
                return datetime.strptime(f"{m.group(1)} {m.group(2)} {yr}", '%B %d %Y').strftime('%Y-%m-%d')
            except ValueError:
                pass
    return ''


def parse_time(raw: str) -> str:
    """Extract HH:MM:SS from a string. Returns '' if not found."""
    if not raw:
        return ''
    # ISO time component
    m = re.search(r'T(\d{2}:\d{2}:\d{2})', raw)
    if m:
        return m.group(1)
    m = re.search(r'(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?', raw)
    if m:
        h, mi, ampm = int(m.group(1)), int(m.group(2)), (m.group(3) or '').lower()
        if ampm == 'pm' and h < 12:
            h += 12
        elif ampm == 'am' and h == 12:
            h = 0
        return f"{h:02d}:{mi:02d}:00"
    return ''


def strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    if not text:
        return ''
    return re.sub(r'<[^>]+>', ' ', text).strip()


def make_image(url: str) -> dict:
    """Build a TMEvent-compatible image object."""
    return {'url': url, 'ratio': '16_9', 'width': 1024, 'height': 576, 'fallback': False}


def make_row(ev_id: str, source: str, raw: dict, local_date: str) -> dict:
    """Wrap a raw TMEvent dict into a Supabase row."""
    return {
        'id': ev_id,
        'source': source,
        'raw': raw,
        'event_date': local_date,
    }


# ─── SEATGEEK ────────────────────────────────────────────────────────────────

def fetch_seatgeek() -> list:
    """Fetch Albuquerque events from SeatGeek API. Returns list of Supabase rows."""
    print("  Fetching SeatGeek...", flush=True, file=sys.stderr)
    rows = []
    page = 1

    while True:
        try:
            r = SESSION.get(
                'https://api.seatgeek.com/2/events',
                params={
                    'venue.city': 'Albuquerque',
                    'venue.state': 'NM',
                    'per_page': 100,
                    'page': page,
                    'aid': SEATGEEK_AID,
                    'datetime_local.gte': TODAY,
                    'datetime_local.lte': FUTURE_180,
                    'sort': 'datetime_local.asc',
                },
                timeout=30,
            )
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"  SeatGeek error (page {page}): {e}", file=sys.stderr)
            break

        events = data.get('events', [])
        if not events:
            break

        for ev in events:
            row = _normalize_seatgeek_event(ev)
            if row:
                rows.append(row)

        meta = data.get('meta', {})
        total = meta.get('total', 0)
        if len(rows) >= total or len(events) < 100:
            break

        page += 1
        time.sleep(0.4)

    print(f"  SeatGeek: {len(rows)} events", file=sys.stderr)
    return rows


def _normalize_seatgeek_event(ev: dict) -> dict:
    """Convert a SeatGeek API event object to a Supabase row."""
    dt = ev.get('datetime_local', '')  # "2026-04-04T15:00:00" — should be venue local time
    local_date = dt[:10] if dt else ''
    local_time = dt[11:16] if len(dt) > 10 else ''  # HH:MM only

    # SeatGeek sometimes returns datetime_local in UTC for multi-day passes and certain
    # sports/festival events (e.g. "03:30" instead of the real local noon start time).
    # Guard: if localTime is between 00:00–05:59 for an entertainment event, it's likely
    # a bad UTC value. Try to correct using datetime_utc + MDT offset (-6h), or null it out.
    if local_time and local_time < '06:00':
        dt_utc = ev.get('datetime_utc', '')  # "2026-05-15T09:30:00"
        if dt_utc and len(dt_utc) >= 16:
            try:
                from datetime import datetime, timedelta
                utc_dt = datetime.strptime(dt_utc[:16], '%Y-%m-%dT%H:%M')
                mdt_dt = utc_dt - timedelta(hours=6)  # MDT = UTC-6
                corrected = mdt_dt.strftime('%H:%M')
                # Only accept if corrected time is a plausible event time (6am–11:59pm)
                if corrected >= '06:00':
                    local_time = corrected
                    local_date = mdt_dt.strftime('%Y-%m-%d')  # date may shift too
                else:
                    local_time = ''  # still bad — store as time unknown
            except Exception:
                local_time = ''  # parse failed — store as time unknown
        else:
            local_time = ''  # no UTC fallback — store as time unknown

    if not local_date or local_date < TODAY:
        return None

    venue = ev.get('venue', {})
    venue_city = (venue.get('city') or 'Albuquerque').strip()
    venue_state = (venue.get('state') or 'NM').strip()

    # Only ABQ metro
    ABQ_METRO = {
        'albuquerque', 'rio rancho', 'corrales', 'bernalillo', 'placitas',
        'edgewood', 'tijeras', 'cedar crest', 'sandia park', 'los lunas',
        'belen', 'bosque farms',
    }
    if venue_city.lower() not in ABQ_METRO:
        return None

    performers = ev.get('performers', [])
    performer_image = None
    if performers:
        imgs = performers[0].get('images', {})
        performer_image = (
            imgs.get('huge') or imgs.get('large') or
            imgs.get('medium') or imgs.get('small')
        )

    images = [make_image(performer_image)] if performer_image else []

    taxons = ev.get('taxonomies', [])
    segment = taxons[0].get('name', 'Other').title() if taxons else 'Other'

    ev_id = f"seatgeek_{ev['id']}"

    raw = {
        'id': ev_id,
        'name': ev.get('title', '').strip(),
        'url': ev.get('url', ''),
        '_source': 'seatgeek',
        'info': ev.get('description') or None,
        'images': images,
        'dates': {
            'start': {'localDate': local_date, 'localTime': local_time},
        },
        '_embedded': {
            'venues': [{
                'name': venue.get('name', ''),
                'address': {'line1': venue.get('address', '')},
                'city': {'name': venue_city},
                'location': {
                    'latitude': str(venue.get('location', {}).get('lat', '')),
                    'longitude': str(venue.get('location', {}).get('lon', '')),
                },
            }],
        },
        'classifications': [{'segment': {'name': segment}, 'genre': {'name': ''}}],
    }

    if not raw['name']:
        return None

    return make_row(ev_id, 'seatgeek', raw, local_date)


# ─── WORDPRESS / THE EVENTS CALENDAR (albuquerque.events, albuquerquecc.com) ─

def fetch_wordpress_events(base_url: str, prefix: str) -> list:
    """
    Fetch events from WordPress sites running The Events Calendar plugin.
    Tries Tribe REST API, then WordPress REST API, then JSON-LD scraping.
    """
    print(f"  Fetching {base_url} ...", flush=True, file=sys.stderr)
    rows = []

    # ── Strategy 1: Tribe Events REST API ─────────────────────────────────
    try:
        r = SESSION.get(
            f"{base_url}/wp-json/tribe/events/v1/events",
            params={'per_page': 100, 'start_date': TODAY, 'end_date': FUTURE_180},
            timeout=20,
        )
        if r.status_code == 200:
            data = r.json()
            for ev in data.get('events', []):
                row = _normalize_tribe_event(ev, prefix, base_url)
                if row:
                    rows.append(row)
            print(f"  {prefix}: {len(rows)} events (Tribe API)", file=sys.stderr)
            return rows
    except Exception:
        pass

    # ── Strategy 2: WP REST API custom post type ──────────────────────────
    for cpt in ('tribe_events', 'mec-events', 'events'):
        try:
            r = SESSION.get(
                f"{base_url}/wp-json/wp/v2/{cpt}",
                params={'per_page': 100, 'status': 'publish', '_embed': 1},
                timeout=20,
            )
            if r.status_code == 200 and r.json():
                for ev in r.json():
                    row = _normalize_wp_v2_event(ev, prefix, base_url)
                    if row:
                        rows.append(row)
                print(f"  {prefix}: {len(rows)} events (WP REST {cpt})", file=sys.stderr)
                return rows
        except Exception:
            pass

    # ── Strategy 3: JSON-LD from HTML page ───────────────────────────────
    rows = _scrape_jsonld(base_url, prefix, base_url)
    print(f"  {prefix}: {len(rows)} events (JSON-LD)", file=sys.stderr)
    return rows


def _normalize_tribe_event(ev: dict, prefix: str, base_url: str) -> dict:
    """Normalize The Events Calendar REST API event."""
    start = ev.get('start_date', '')        # "2026-04-15 19:00:00"
    local_date = start[:10] if start else ''
    local_time = start[11:19] if len(start) > 10 else ''

    if not local_date or local_date < TODAY:
        return None

    venue = ev.get('venue', {})
    venue_name = venue.get('venue', '') or venue.get('name', '')
    venue_address = venue.get('address', '')
    venue_city = venue.get('city', 'Albuquerque') or 'Albuquerque'

    # Image
    images = []
    img_data = ev.get('image', {})
    if isinstance(img_data, dict):
        img_url = img_data.get('url') or img_data.get('sizes', {}).get('large', {}).get('url')
    elif isinstance(img_data, str) and img_data.startswith('http'):
        img_url = img_data
    else:
        img_url = None
    if img_url:
        images = [make_image(img_url)]

    url = ev.get('url', '') or ev.get('website', '') or ''
    desc = strip_html(ev.get('description', '') or ev.get('excerpt', ''))
    title = strip_html(ev.get('title', ''))

    if not title:
        return None

    ev_id = f"{prefix}_{ev.get('id', slug_id(prefix, title, local_date))}"

    raw = {
        'id': ev_id,
        'name': title,
        'url': url if url.startswith('http') else base_url,
        '_source': 'local',
        'info': desc,
        'images': images,
        'dates': {'start': {'localDate': local_date, 'localTime': local_time}},
        '_embedded': {
            'venues': [{
                'name': venue_name,
                'address': {'line1': venue_address},
                'city': {'name': venue_city},
            }],
        },
        'classifications': [{'segment': {'name': 'Other'}, 'genre': {'name': ''}}],
    }

    return make_row(ev_id, 'local', raw, local_date)


def _normalize_wp_v2_event(ev: dict, prefix: str, base_url: str) -> dict:
    """Normalize a WP REST API v2 post to a TMEvent row."""
    title = strip_html(ev.get('title', {}).get('rendered', '') or '')
    if not title:
        return None

    # Date often in meta or ACF fields
    meta = ev.get('meta', {}) or {}
    acf = ev.get('acf', {}) or {}
    start_date = (
        meta.get('_EventStartDate') or acf.get('start_date') or
        ev.get('date', '')[:10]
    )
    local_date = parse_date(start_date)
    if not local_date or local_date < TODAY:
        return None

    start_time = parse_time(meta.get('_EventStartDate', '') or '')
    url = ev.get('link', '') or base_url

    # Featured image from _embedded
    images = []
    embedded = ev.get('_embedded', {}) or {}
    wp_media = embedded.get('wp:featuredmedia', [])
    if wp_media and isinstance(wp_media, list):
        media_url = (wp_media[0].get('source_url') or
                     wp_media[0].get('media_details', {}).get('sizes', {})
                     .get('large', {}).get('source_url'))
        if media_url:
            images = [make_image(media_url)]

    venue_name = meta.get('_EventVenueName', '') or acf.get('venue', '')
    venue_address = meta.get('_EventAddress', '') or ''
    venue_city = meta.get('_EventCity', 'Albuquerque') or 'Albuquerque'

    desc = strip_html(ev.get('content', {}).get('rendered', '') or ev.get('excerpt', {}).get('rendered', ''))

    ev_id = f"{prefix}_{ev.get('id', slug_id(prefix, title, local_date))}"

    raw = {
        'id': ev_id,
        'name': title,
        'url': url,
        '_source': 'local',
        'info': desc[:1000],
        'images': images,
        'dates': {'start': {'localDate': local_date, 'localTime': start_time}},
        '_embedded': {
            'venues': [{
                'name': venue_name,
                'address': {'line1': venue_address},
                'city': {'name': venue_city},
            }],
        },
        'classifications': [{'segment': {'name': 'Other'}, 'genre': {'name': ''}}],
    }

    return make_row(ev_id, 'local', raw, local_date)


# ─── JSON-LD SCRAPER (generic) ────────────────────────────────────────────────

def _scrape_jsonld(page_url: str, prefix: str, base_url: str) -> list:
    """Fetch a page and extract Event JSON-LD objects from it."""
    rows = []
    try:
        r = SESSION.get(page_url, timeout=20)
        if r.status_code != 200:
            return rows
        soup = BeautifulSoup(r.text, 'html.parser')
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string or '{}')
                items = []
                if isinstance(data, list):
                    items = data
                elif data.get('@type') == 'Event':
                    items = [data]
                elif data.get('@type') == 'ItemList':
                    items = [i.get('item', i) for i in data.get('itemListElement', [])]
                for item in items:
                    row = _normalize_jsonld_event(item, prefix, base_url)
                    if row:
                        rows.append(row)
            except Exception:
                pass
    except Exception as e:
        print(f"  JSON-LD scrape error ({page_url}): {e}", file=sys.stderr)
    return rows


def _normalize_jsonld_event(item: dict, prefix: str, base_url: str) -> dict:
    """Normalize a schema.org Event JSON-LD object to a TMEvent row."""
    if item.get('@type') not in ('Event', 'MusicEvent', 'SportsEvent', 'TheaterEvent',
                                  'FoodEvent', 'ComedyEvent', 'ScreeningEvent'):
        return None

    name = (item.get('name') or '').strip()
    if not name:
        return None

    start_raw = item.get('startDate', '')
    local_date = start_raw[:10] if start_raw else ''
    local_time = parse_time(start_raw)

    if not local_date or local_date < TODAY:
        return None

    # Location / venue
    location = item.get('location', {})
    if isinstance(location, str):
        venue_name, street, city = location, '', 'Albuquerque'
    else:
        venue_name = location.get('name', '')
        addr = location.get('address', {})
        if isinstance(addr, str):
            street, city = addr, 'Albuquerque'
        else:
            street = addr.get('streetAddress', '')
            city = addr.get('addressLocality', 'Albuquerque') or 'Albuquerque'

    # Image
    images = []
    img = item.get('image', '')
    if isinstance(img, list) and img:
        img = img[0]
    if isinstance(img, dict):
        img = img.get('url', img.get('@id', ''))
    if img and isinstance(img, str) and img.startswith('http'):
        images = [make_image(img)]

    # URL
    url = item.get('url', '') or item.get('@id', '')
    if url and not url.startswith('http'):
        url = base_url.rstrip('/') + '/' + url.lstrip('/')

    desc = strip_html(item.get('description', ''))

    # Price
    offers = item.get('offers', {})
    price_ranges = []
    if isinstance(offers, dict) and offers.get('price') not in (None, ''):
        try:
            price_ranges = [{'min': float(offers['price']), 'max': float(offers.get('highPrice', offers['price'])), 'currency': 'USD'}]
        except Exception:
            pass

    ev_id = slug_id(prefix, name, local_date)

    raw = {
        'id': ev_id,
        'name': name,
        'url': url,
        '_source': 'local',
        'info': desc[:1000],
        'images': images,
        'dates': {'start': {'localDate': local_date, 'localTime': local_time}},
        '_embedded': {
            'venues': [{'name': venue_name, 'address': {'line1': street}, 'city': {'name': city}}],
        },
        'classifications': [{'segment': {'name': 'Other'}, 'genre': {'name': ''}}],
        'priceRanges': price_ranges,
    }

    return make_row(ev_id, 'local', raw, local_date)


# ─── CABQ.GOV/EVENTS ─────────────────────────────────────────────────────────

def fetch_cabq_events() -> list:
    """Fetch events from cabq.gov/events (Plone CMS)."""
    print("  Fetching cabq.gov/events ...", file=sys.stderr)

    # First try JSON-LD on the events listing page
    rows = _scrape_jsonld('https://www.cabq.gov/events', 'cabq', 'https://www.cabq.gov')
    if rows:
        print(f"  cabq.gov: {len(rows)} events (JSON-LD)", file=sys.stderr)
        return rows

    # Fallback: try Plone JSON API
    try:
        r = SESSION.get('https://www.cabq.gov/events', params={'format': 'json'}, timeout=20)
        if r.status_code == 200:
            data = r.json()
            items = data.get('items', data.get('results', []))
            for item in items:
                ev_type = item.get('@type', '')
                if 'event' not in ev_type.lower():
                    continue
                name = item.get('title', '').strip()
                start_raw = item.get('start', item.get('start_date', ''))
                local_date = parse_date(start_raw)
                if not local_date or local_date < TODAY or not name:
                    continue
                url = item.get('@id', item.get('url', ''))
                img = item.get('image', {})
                img_url = img.get('download') if isinstance(img, dict) else None
                images = [make_image(img_url)] if img_url else []
                location = item.get('location', item.get('venue', ''))
                ev_id = slug_id('cabq', name, local_date)
                raw = {
                    'id': ev_id, 'name': name, 'url': url, '_source': 'local',
                    'info': strip_html(item.get('description', '')),
                    'images': images,
                    'dates': {'start': {'localDate': local_date, 'localTime': parse_time(start_raw)}},
                    '_embedded': {'venues': [{'name': str(location), 'address': {'line1': ''}, 'city': {'name': 'Albuquerque'}}]},
                    'classifications': [{'segment': {'name': 'Community'}, 'genre': {'name': ''}}],
                }
                rows.append(make_row(ev_id, 'local', raw, local_date))
    except Exception as e:
        print(f"  cabq.gov JSON API error: {e}", file=sys.stderr)

    # Fallback: HTML scraping
    if not rows:
        rows = _scrape_cabq_html()

    print(f"  cabq.gov: {len(rows)} events", file=sys.stderr)
    return rows


def _scrape_cabq_html() -> list:
    """HTML-scrape cabq.gov/events as a last resort."""
    rows = []
    try:
        r = SESSION.get('https://www.cabq.gov/events', timeout=20)
        if r.status_code != 200:
            return rows
        soup = BeautifulSoup(r.text, 'html.parser')
        for article in soup.find_all(['article', 'div'], class_=re.compile(r'event', re.I)):
            try:
                title_el = article.find(['h2', 'h3', 'h4', 'a'])
                name = title_el.get_text(strip=True) if title_el else ''
                if not name or len(name) < 4:
                    continue
                link_el = article.find('a', href=True)
                href = link_el['href'] if link_el else ''
                url = href if href.startswith('http') else f"https://www.cabq.gov{href}"
                date_el = article.find(class_=re.compile(r'date|when|time', re.I))
                local_date = parse_date(date_el.get_text(strip=True)) if date_el else ''
                if not local_date or local_date < TODAY:
                    continue
                img_el = article.find('img', src=True)
                images = []
                if img_el:
                    src = img_el['src']
                    if not src.startswith('http'):
                        src = f"https://www.cabq.gov{src}"
                    images = [make_image(src)]
                desc_el = article.find(class_=re.compile(r'desc|summary|excerpt|body', re.I))
                desc = desc_el.get_text(strip=True) if desc_el else ''
                ev_id = slug_id('cabq', name, local_date)
                raw = {
                    'id': ev_id, 'name': name, 'url': url, '_source': 'local',
                    'info': desc,
                    'images': images,
                    'dates': {'start': {'localDate': local_date, 'localTime': ''}},
                    '_embedded': {'venues': [{'name': 'City of Albuquerque', 'address': {'line1': ''}, 'city': {'name': 'Albuquerque'}}]},
                    'classifications': [{'segment': {'name': 'Community'}, 'genre': {'name': ''}}],
                }
                rows.append(make_row(ev_id, 'local', raw, local_date))
            except Exception:
                pass
    except Exception as e:
        print(f"  cabq HTML scrape error: {e}", file=sys.stderr)
    return rows


# ─── NEWMEXICO.ORG/EVENTS ─────────────────────────────────────────────────────

def fetch_newmexico_events() -> list:
    """Fetch events from newmexico.org (CivicPlus CMS, filters for ABQ area)."""
    print("  Fetching newmexico.org/events ...", file=sys.stderr)

    rows = _scrape_jsonld('https://www.newmexico.org/events/', 'nmdot', 'https://www.newmexico.org')
    if not rows:
        rows = _scrape_jsonld('https://www.newmexico.org/events', 'nmdot', 'https://www.newmexico.org')

    # Filter to ABQ metro only
    ABQ_KEYWORDS = {'albuquerque', 'abq', 'rio rancho', 'corrales', 'bernalillo',
                    'bosque farms', 'los lunas', 'cedar crest', 'edgewood', 'tijeras'}
    filtered = []
    for row in rows:
        venues = row['raw'].get('_embedded', {}).get('venues', [{}])
        city = (venues[0].get('city', {}).get('name', '') or '').lower()
        addr = (venues[0].get('address', {}).get('line1', '') or '').lower()
        name = (row['raw'].get('name', '') or '').lower()
        if any(k in city or k in addr or k in name for k in ABQ_KEYWORDS):
            filtered.append(row)

    print(f"  newmexico.org: {len(filtered)} ABQ-area events", file=sys.stderr)
    return filtered


# ─── NEWMEXICOMAGAZINE.ORG ────────────────────────────────────────────────────

def fetch_nmmagazine_events() -> list:
    """Fetch events from newmexicomagazine.org event calendar."""
    print("  Fetching newmexicomagazine.org ...", file=sys.stderr)
    rows = _scrape_jsonld(
        'https://www.newmexicomagazine.org/things-to-do/event-calendar/',
        'nmmag', 'https://www.newmexicomagazine.org'
    )

    # Filter to ABQ metro
    ABQ_KEYWORDS = {'albuquerque', 'abq', 'rio rancho', 'corrales', 'bernalillo'}
    filtered = []
    for row in rows:
        venues = row['raw'].get('_embedded', {}).get('venues', [{}])
        city = (venues[0].get('city', {}).get('name', '') or '').lower()
        if any(k in city for k in ABQ_KEYWORDS):
            filtered.append(row)

    # If JSON-LD filtering leaves too few, keep all (NM magazine is mostly NM-focused)
    if len(filtered) < 3 and rows:
        filtered = rows

    print(f"  newmexicomagazine.org: {len(filtered)} events", file=sys.stderr)
    return filtered


# ─── VISITALBUQUERQUE.ORG ─────────────────────────────────────────────────────

def fetch_visitalbuquerque_events() -> list:
    """Fetch events from visitalbuquerque.org/abq365 (iCalendar / JSON-LD)."""
    print("  Fetching visitalbuquerque.org ...", file=sys.stderr)
    rows = _scrape_jsonld(
        'https://www.visitalbuquerque.org/abq365/events/search-calendar/',
        'visitabq', 'https://www.visitalbuquerque.org'
    )
    print(f"  visitalbuquerque.org: {len(rows)} events", file=sys.stderr)
    return rows


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    target = sys.argv[1].lower() if len(sys.argv) > 1 else 'all'

    fetchers = {
        # ── Original sources ─────────────────────────────────────────────────
        'seatgeek':          fetch_seatgeek,
        'albuquerqueevents': lambda: fetch_wordpress_events('https://albuquerque.events', 'albuquerqueevents'),
        'conventioncc':      lambda: fetch_wordpress_events('https://albuquerquecc.com', 'conventioncc'),
        'cabq':              fetch_cabq_events,
        'newmexico':         fetch_newmexico_events,
        'nmmag':             fetch_nmmagazine_events,
        'visitabq':          fetch_visitalbuquerque_events,
        # ── New sources added 2026-04-05 ─────────────────────────────────────
        'abqtodo':           fetch_abqtodo_events,
        'ipcc':              fetch_ipcc_events,
        'nhcc':              fetch_nhcc_events,
        'abqmuseum':         fetch_abqmuseum_events,
        'explora':           fetch_explora_events,
        'abqnews':           fetch_abqnews_events,
        'unm':               fetch_unm_events,
        'biopark':           fetch_biopark_events,
        'balloonfiesta':     fetch_balloon_fiesta_events,
        'abq365':            fetch_abq365_events,
        'volunteer':         fetch_volunteer_events,
    }

    if target != 'all' and target not in fetchers:
        print(f"Unknown source '{target}'. Valid: all, {', '.join(fetchers)}", file=sys.stderr)
        sys.exit(1)

    all_rows = []
    sources_to_run = [target] if target != 'all' else list(fetchers.keys())

    for source in sources_to_run:
        try:
            rows = fetchers[source]()
            all_rows.extend(rows)
        except Exception as e:
            print(f"  ERROR in {source}: {e}", file=sys.stderr)
        time.sleep(1)

    # Deduplicate by id
    seen_ids = set()
    deduped = []
    for row in all_rows:
        if row['id'] not in seen_ids:
            seen_ids.add(row['id'])
            deduped.append(row)

    print(f"\nTotal: {len(deduped)} unique events from {len(sources_to_run)} sources", file=sys.stderr)

    # Output JSON to stdout for Claude to upsert via Supabase MCP
    print(json.dumps(deduped, ensure_ascii=False, indent=None))




# ═══════════════════════════════════════════════════════════════════════════════
# NEW SOURCES — added 2026-04-05
# ═══════════════════════════════════════════════════════════════════════════════

# ─── LOCALIST (UNM Events) ───────────────────────────────────────────────────

def fetch_localist_events(base_url: str, prefix: str) -> list:
    """
    Fetch events from a Localist-powered calendar (used by UNM, many universities).
    Tries the Localist REST API first, falls back to JSON-LD scraping.
    """
    print(f"  Fetching {base_url} (Localist)...", flush=True, file=sys.stderr)
    rows = []

    # Strategy 1: Localist REST API
    try:
        r = SESSION.get(
            f"{base_url}/api/2/events",
            params={
                'days': 180,
                'pp': 100,
                'page': 1,
            },
            timeout=20,
        )
        if r.status_code == 200:
            data = r.json()
            events = data.get('events', [])
            for item in events:
                ev = item.get('event', item)
                name = (ev.get('title') or '').strip()
                start_raw = ev.get('first_date', ev.get('event_instances', [{}])[0].get('event_instance', {}).get('start', ''))
                local_date = parse_date(str(start_raw)[:10]) if start_raw else ''
                if not local_date or local_date < TODAY or not name:
                    continue
                local_time = parse_time(str(start_raw))
                venue = ev.get('location_name', ev.get('location', ''))
                address = ev.get('address', '')
                desc = strip_html(ev.get('description_text', ev.get('description', '')))
                url = ev.get('localist_url', ev.get('url', ''))
                img_url = (ev.get('photo_url') or ev.get('image_url') or '').strip()
                images = [make_image(img_url)] if img_url else []
                filters = ev.get('filters', {})
                dept = ''
                if isinstance(filters, dict):
                    depts = filters.get('departments', filters.get('event_types', []))
                    dept = depts[0].get('name', '') if depts else ''
                ev_id = slug_id(prefix, name, local_date)
                raw = {
                    'id': ev_id, 'name': name, 'url': url,
                    '_source': prefix, 'info': desc or None,
                    'images': images,
                    'dates': {'start': {'localDate': local_date, 'localTime': local_time}},
                    '_embedded': {
                        'venues': [{'name': venue, 'address': {'line1': address}, 'city': {'name': 'Albuquerque'}}],
                    },
                    'classifications': [{'segment': {'name': dept or 'Community'}, 'genre': {'name': ''}}],
                }
                rows.append(make_row(ev_id, prefix, raw, local_date))
            if rows:
                print(f"  {prefix}: {len(rows)} events (Localist API)", file=sys.stderr)
                return rows
    except Exception as e:
        print(f"  {prefix} Localist API error: {e}", file=sys.stderr)

    # Fallback: JSON-LD scrape
    rows = _scrape_jsonld(base_url, prefix, base_url)
    print(f"  {prefix}: {len(rows)} events (JSON-LD fallback)", file=sys.stderr)
    return rows


# ─── GENERIC ICAL FETCHER ────────────────────────────────────────────────────

def fetch_ical_events(ical_url: str, prefix: str, default_venue: str = 'Albuquerque, NM') -> list:
    """Fetch and parse an iCalendar (.ics) feed."""
    print(f"  Fetching iCal {ical_url}...", flush=True, file=sys.stderr)
    rows = []
    try:
        r = SESSION.get(ical_url, timeout=20)
        if r.status_code != 200:
            return []
        text = r.text
        # Parse VEVENT blocks
        events = re.findall(r'BEGIN:VEVENT(.*?)END:VEVENT', text, re.DOTALL)
        for block in events:
            def ical_field(name):
                m = re.search(rf'{name}[^:]*:(.*?)(?:\r?\n)(?!\s)', block, re.DOTALL)
                return m.group(1).replace('\r\n ', '').replace('\n ', '').strip() if m else ''
            name = ical_field('SUMMARY')
            dtstart = ical_field('DTSTART')
            local_date = ''
            local_time = ''
            if dtstart:
                # Handle TZID format: DTSTART;TZID=...:20260415T190000
                raw_dt = dtstart.split(':')[-1] if ':' in dtstart else dtstart
                if len(raw_dt) >= 8:
                    local_date = f"{raw_dt[0:4]}-{raw_dt[4:6]}-{raw_dt[6:8]}"
                if len(raw_dt) >= 15:
                    local_time = f"{raw_dt[9:11]}:{raw_dt[11:13]}:00"
            if not local_date or local_date < TODAY or not name:
                continue
            desc = strip_html(ical_field('DESCRIPTION'))
            location = ical_field('LOCATION') or default_venue
            url = ical_field('URL')
            ev_id = slug_id(prefix, name, local_date)
            raw = {
                'id': ev_id, 'name': name, 'url': url,
                '_source': prefix, 'info': desc[:500] if desc else None,
                'images': [],
                'dates': {'start': {'localDate': local_date, 'localTime': local_time}},
                '_embedded': {
                    'venues': [{'name': location, 'address': {'line1': ''}, 'city': {'name': 'Albuquerque'}}],
                },
                'classifications': [{'segment': {'name': 'Community'}, 'genre': {'name': ''}}],
            }
            rows.append(make_row(ev_id, prefix, raw, local_date))
    except Exception as e:
        print(f"  iCal {prefix} error: {e}", file=sys.stderr)
    print(f"  {prefix}: {len(rows)} events (iCal)", file=sys.stderr)
    return rows


# ─── VOLUNTEER EVENTS (Roadrunner Food Bank + community) ─────────────────────

def fetch_volunteer_events() -> list:
    """
    Generate recurring volunteer events for major ABQ nonprofits.
    These are standing volunteer opportunities with regular schedules.
    Links go directly to the signup page.
    """
    from datetime import date, timedelta

    print("  Generating volunteer events...", flush=True, file=sys.stderr)
    rows = []
    today = date.today()

    opportunities = [
        {
            'org': 'Roadrunner Food Bank',
            'name': 'Roadrunner Food Bank — Warehouse Volunteer Shift',
            'desc': 'Sort, check, label and box food items for distribution to hundreds of partner agencies across New Mexico. Shifts are 2 hours. Volunteers 8+ welcome with adult supervision. Register at least 24 hours in advance.',
            'url': 'https://www.rrfb.org/give/give-time/',
            'venue': 'Roadrunner Food Bank — 5840 Office Blvd NE, Albuquerque',
            'weekdays': [0, 1, 2, 3, 4, 5],  # Mon–Sat
            'times': [('09:00:00', '11:00:00'), ('13:00:00', '15:00:00')],
            'prefix': 'rrfb',
        },
        {
            'org': 'Roadrunner Food Bank',
            'name': 'Roadrunner Food Bank — Community Food Distribution',
            'desc': 'Help distribute food directly to families at community sites across Albuquerque. Assist with traffic control, bagging produce, and loading vehicles. 2–4 hour commitment. Ages 16+.',
            'url': 'https://www.rrfb.org/give/give-time/',
            'venue': 'Various Albuquerque Locations',
            'weekdays': [5, 6],  # Sat–Sun
            'times': [('08:00:00', '12:00:00')],
            'prefix': 'rrfb_dist',
        },
    ]

    for opp in opportunities:
        for days_ahead in range(1, 90):
            d = today + timedelta(days=days_ahead)
            if d.weekday() not in opp['weekdays']:
                continue
            for start_time, end_time in opp['times']:
                local_date = d.strftime('%Y-%m-%d')
                ev_id = slug_id(opp['prefix'], opp['name'], local_date, start_time)
                raw = {
                    'id': ev_id,
                    'name': opp['name'],
                    'url': opp['url'],
                    '_source': 'volunteer',
                    'info': opp['desc'],
                    'images': [],
                    'dates': {
                        'start': {'localDate': local_date, 'localTime': start_time},
                        'end': {'localTime': end_time},
                    },
                    '_embedded': {
                        'venues': [{'name': opp['venue'], 'address': {'line1': ''}, 'city': {'name': 'Albuquerque'}}],
                    },
                    'classifications': [{'segment': {'name': 'Volunteer'}, 'genre': {'name': 'Community Service'}}],
                    'priceRanges': [{'min': 0, 'max': 0, 'currency': 'USD'}],
                    '_isVolunteer': True,
                    '_ticketLabel': 'Sign Up',
                }
                rows.append(make_row(ev_id, 'volunteer', raw, local_date))

    print(f"  Volunteer: {len(rows)} recurring entries", file=sys.stderr)
    return rows


# ─── NEW WORDPRESS SOURCES ────────────────────────────────────────────────────

def fetch_abqtodo_events() -> list:
    return fetch_wordpress_events('https://abqtodo.com', 'abqtodo')

def fetch_ipcc_events() -> list:
    """Indian Pueblo Cultural Center."""
    return fetch_wordpress_events('https://indianpueblo.org', 'ipcc')

def fetch_nhcc_events() -> list:
    """National Hispanic Cultural Center."""
    return fetch_wordpress_events('https://nhccnm.org', 'nhcc')

def fetch_abqmuseum_events() -> list:
    """Albuquerque Museum."""
    rows = fetch_wordpress_events('https://www.albuquerquemuseum.org', 'abqmuseum')
    if not rows:
        rows = _scrape_jsonld('https://www.albuquerquemuseum.org/events', 'abqmuseum', 'https://www.albuquerquemuseum.org')
    return rows

def fetch_explora_events() -> list:
    """Explora Science Center."""
    rows = fetch_wordpress_events('https://www.explora.us', 'explora')
    if not rows:
        rows = _scrape_jsonld('https://www.explora.us/programs-events/', 'explora', 'https://www.explora.us')
    return rows

def fetch_abqnews_events() -> list:
    """calendar.abq.news — community news calendar."""
    rows = fetch_wordpress_events('https://calendar.abq.news', 'abqnews')
    if not rows:
        rows = _scrape_jsonld('https://calendar.abq.news', 'abqnews', 'https://calendar.abq.news')
    return rows

def fetch_unm_events() -> list:
    """UNM Events — Localist platform."""
    rows = fetch_localist_events('https://unmevents.unm.edu', 'unm')
    return rows

def fetch_biopark_events() -> list:
    """ABQ BioPark events."""
    rows = _scrape_jsonld('https://www.cabq.gov/culturalservices/biopark/events', 'biopark', 'https://www.cabq.gov')
    if not rows:
        rows = fetch_wordpress_events('https://www.cabq.gov/culturalservices/biopark', 'biopark')
    return rows

def fetch_balloon_fiesta_events() -> list:
    """Albuquerque International Balloon Fiesta events."""
    rows = _scrape_jsonld('https://balloonfiesta.com/events', 'balloonfiesta', 'https://balloonfiesta.com')
    if not rows:
        rows = fetch_wordpress_events('https://balloonfiesta.com', 'balloonfiesta')
    return rows

def fetch_abq365_events() -> list:
    """ABQ365 calendar — broader scrape of visitalbuquerque.org pages."""
    rows = []
    pages = [
        'https://www.visitalbuquerque.org/abq365/events/search-calendar/',
        'https://www.visitalbuquerque.org/abq365/events/search-calendar/?page=2',
        'https://www.visitalbuquerque.org/abq365/events/search-calendar/?page=3',
    ]
    for page_url in pages:
        batch = _scrape_jsonld(page_url, 'visitabq', 'https://www.visitalbuquerque.org')
        rows.extend(batch)
        if not batch:
            break
        time.sleep(0.5)
    # Deduplicate within this source
    seen = set()
    deduped = [r for r in rows if r['id'] not in seen and not seen.add(r['id'])]
    print(f"  ABQ365: {len(deduped)} events (multi-page)", file=sys.stderr)
    return deduped

if __name__ == '__main__':
    main()
