#!/usr/bin/env python3
"""
normalize_and_commit.py

Reads /tmp/raw_events.json (produced by the SKILL.md scrape step),
normalizes events, deduplicates against events.ts, commits new events to GitHub,
polls Netlify for deploy status, then runs LM Studio enrichment (Gemma).

Usage: python3 scripts/normalize_and_commit.py
"""

import json, re, urllib.request, base64, subprocess, sys, time, os
from datetime import date

TOKEN        = os.environ.get('GITHUB_TOKEN', '')
REPO         = 'fastermatt/whats-up-abq'
FILE         = 'src/data/events.ts'
NETLIFY_SITE = '29767e56-5e88-4c2f-9818-3b2df6e14ed0'
LM_STUDIO_URL = os.environ.get('LM_STUDIO_URL', 'http://localhost:1234')
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
ENRICH_SCRIPT = os.path.join(SCRIPT_DIR, 'enrich-events-lm.cjs')
TODAY        = date.today()

# ─── Date parsing ─────────────────────────────────────────────────────────────

MONTHS = {
    'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,
    'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12
}

def parse_date(raw):
    if not raw:
        return None
    raw = str(raw).strip()
    # Already ISO YYYY-MM-DD
    if re.match(r'^\d{4}-\d{2}-\d{2}', raw):
        return raw[:10]
    # YYYYMMDD
    if re.match(r'^\d{8}$', raw):
        return f'{raw[:4]}-{raw[4:6]}-{raw[6:8]}'
    # "Apr 07, 2026" or "April 7, 2026"
    m = re.match(r'(\w+)\s+(\d+),\s+(\d{4})', raw)
    if m:
        mon = MONTHS.get(m.group(1)[:3].lower())
        if mon:
            return f'{m.group(3)}-{mon:02d}-{int(m.group(2)):02d}'
    # "Apr\n7" or "Apr 7" (Growers Market)
    m = re.match(r'(\w{3})\s*\n?\s*(\d+)', raw)
    if m:
        mon = MONTHS.get(m.group(1).lower())
        if mon:
            yr = TODAY.year if mon >= TODAY.month else TODAY.year + 1
            return f'{yr}-{mon:02d}-{int(m.group(2)):02d}'
    # "Tuesday, April 7" or "Tuesday April 7" (The Paper)
    m = re.match(r'\w+,?\s+(\w+)\s+(\d+)', raw)
    if m:
        mon = MONTHS.get(m.group(1)[:3].lower())
        if mon:
            yr = TODAY.year if mon >= TODAY.month else TODAY.year + 1
            return f'{yr}-{mon:02d}-{int(m.group(2)):02d}'
    return None

# ─── Category inference ───────────────────────────────────────────────────────

def infer_category(title, desc=''):
    text = (title + ' ' + (desc or '')).lower()
    if re.search(r'gallery|exhibit|art\b|museum|mural|photo|paint|sculpt', text):
        return 'Arts & Culture'
    if re.search(r'concert|music|band|jazz|blues|rock|country|hip.hop|orchestra|symphony|choir|singer', text):
        return 'Music'
    if re.search(r'festival|fair|fiesta|carnival|fest\b', text):
        return 'Festivals'
    if re.search(r'family|kids|children|youth|toddler|baby', text):
        return 'Family'
    if re.search(r'market|farmers|growers|vendor|bazaar', text):
        return 'Markets'
    if re.search(r'\bcar\b|auto\b|swap meet|lowrider|motorsport|car show', text):
        return 'Cars & Motors'
    if re.search(r'yoga|fitness|pilates|wellness|\b5k\b|marathon|hike|spin class', text):
        return 'Health & Wellness'
    if re.search(r'history|heritage|historical|native american|culture tour', text):
        return 'History & Culture'
    if re.search(r'food|restaurant|tasting|beer|wine|brew|cocktail|dine|culinary', text):
        return 'Food & Drink'
    if re.search(r'comedy|improv|stand.?up|theater|theatre|ballet|dance|opera|musical', text):
        return 'Arts & Culture'
    if re.search(r'sport|game|match|race|tournament|baseball|basketball|football|soccer|hockey|golf|lacrosse', text):
        return 'Sports'
    if re.search(r'expo|conference|trade show|convention|summit|seminar|training', text):
        return 'Conventions'
    return 'Community'

# ─── Slugify ──────────────────────────────────────────────────────────────────

def slugify(prefix, title):
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:55]
    return f'{prefix}{slug}'

# ─── Source config ────────────────────────────────────────────────────────────

ID_PREFIX = {
    'ABQ365':               'abq365-',
    'ABQToDo':              'abqtodo-',
    'The Paper':            'thepaper-',
    'Growers Market':       'growers-',
    'City of ABQ':          'cabq-',
    'ABQ Convention Center':'abqcc-',
}

FREE_SOURCES = {'ABQ365', 'Growers Market'}

# ─── GitHub helpers ───────────────────────────────────────────────────────────

def gh_get(path):
    req = urllib.request.Request(
        f'https://api.github.com/repos/{REPO}/contents/{path}',
        headers={'Authorization': f'token {TOKEN}', 'User-Agent': 'abq-bot'}
    )
    resp = json.loads(urllib.request.urlopen(req).read())
    return base64.b64decode(resp['content']).decode('utf-8'), resp['sha']

def gh_put(path, content, sha, message):
    body = json.dumps({
        'message': message,
        'content': base64.b64encode(content.encode('utf-8')).decode('utf-8'),
        'sha': sha,
        'committer': {'name': 'fastermatt', 'email': '4mattcarlson@gmail.com'}
    })
    req = urllib.request.Request(
        f'https://api.github.com/repos/{REPO}/contents/{path}',
        data=body.encode(), method='PUT',
        headers={
            'Authorization':  f'token {TOKEN}',
            'Content-Type':   'application/json',
            'User-Agent':     'abq-bot'
        }
    )
    return json.loads(urllib.request.urlopen(req).read())

# ─── Find ALL_EVENTS closing bracket via bracket counting ────────────────────

def find_all_events_end(content):
    """Return the index of the ']' that closes ALL_EVENTS = [...]"""
    start = content.find('export const ALL_EVENTS')
    if start == -1:
        start = content.find('const ALL_EVENTS')
    if start == -1:
        raise ValueError('ALL_EVENTS not found in events.ts')
    bracket_start = content.index('[', start)
    depth = 0
    for i in range(bracket_start, len(content)):
        if content[i] == '[':
            depth += 1
        elif content[i] == ']':
            depth -= 1
            if depth == 0:
                return i
    raise ValueError('Could not find closing ] of ALL_EVENTS')

# ─── TypeScript serialization ─────────────────────────────────────────────────

def ts_str(s):
    return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"

def event_to_ts(e):
    FIELD_ORDER = ['id','title','date','endDate','time','venue','location','category',
                   'description','url','imageUrl','price','source','_source']
    lines = []
    for k in FIELD_ORDER:
        v = e.get(k)
        if v is None:
            continue
        lines.append(f'      {k}: {ts_str(v)},')
    # any extra fields not in FIELD_ORDER
    for k, v in e.items():
        if k not in FIELD_ORDER and v is not None:
            lines.append(f'      {k}: {ts_str(v)},')
    return '    {\n' + '\n'.join(lines) + '\n    },'

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    # 1. Load raw scraped events
    raw_path = '/tmp/raw_events.json'
    if not os.path.exists(raw_path):
        print(f'❌  {raw_path} not found — run the scrape step first.')
        sys.exit(1)
    with open(raw_path) as f:
        raw_events = json.load(f)
    print(f'📥  Loaded {len(raw_events)} raw scraped events')

    # 2. Read current events.ts from GitHub
    print('📖  Fetching events.ts from GitHub…')
    content, sha = gh_get(FILE)

    # 3. Build dedup sets from existing content
    existing_ids    = set(re.findall(r"id:\s*'([^']+)'", content))
    existing_titles = set()
    for t in re.findall(r"title:\s*'([^']+)'", content):
        existing_titles.add(re.sub(r'[^a-z0-9]', '', t.lower())[:40])
    print(f'    {len(existing_ids)} existing events loaded for dedup')

    # 4. Normalize and deduplicate
    cutoff_ord = TODAY.toordinal() - 2  # allow events up to 2 days in the past
    new_events = []
    stats = {}

    for raw in raw_events:
        source = raw.get('source', 'Unknown')
        s = stats.setdefault(source, {'scraped':0, 'new':0, 'skipped':0, 'bad_date':0})
        s['scraped'] += 1

        title = (raw.get('title') or '').strip()
        if not title:
            s['skipped'] += 1
            continue

        iso_date = parse_date(raw.get('date'))
        if not iso_date:
            s['bad_date'] += 1
            s['skipped'] += 1
            continue

        try:
            if date.fromisoformat(iso_date).toordinal() < cutoff_ord:
                s['skipped'] += 1
                continue
        except Exception:
            s['skipped'] += 1
            continue

        prefix   = ID_PREFIX.get(source, 'event-')
        ev_id    = slugify(prefix, title)
        title_fp = re.sub(r'[^a-z0-9]', '', title.lower())[:40]

        if ev_id in existing_ids or title_fp in existing_titles:
            s['skipped'] += 1
            continue

        # Build normalized event
        url = raw.get('href') or raw.get('url') or ''
        img = raw.get('img') or raw.get('imageUrl') or ''
        if img and '?' in img:
            img = img.split('?')[0]

        price = raw.get('price')
        if price is None and source in FREE_SOURCES:
            price = 'Free'

        event = {
            'id':       ev_id,
            'title':    title,
            'date':     iso_date,
            'location': 'Albuquerque, NM',
            'category': infer_category(title, raw.get('desc', '')),
            'url':      url,
            'source':   source,
            '_source':  'local',
        }
        if raw.get('endDate'):  event['endDate']     = raw['endDate']
        if raw.get('time'):     event['time']        = raw['time']
        if raw.get('venue'):    event['venue']       = raw['venue']
        if raw.get('desc'):     event['description'] = raw['desc'][:300]
        if img:                 event['imageUrl']    = img
        if price:               event['price']       = price

        new_events.append(event)
        existing_ids.add(ev_id)
        existing_titles.add(title_fp)
        s['new'] += 1

    # 5. Print per-source stats
    print()
    max_src = max((len(s) for s in stats), default=10)
    for src, s in stats.items():
        bd = f'  ({s["bad_date"]} bad dates)' if s['bad_date'] else ''
        print(f'  {src:<{max_src}}  {s["scraped"]:>3} scraped,  {s["new"]:>3} new,  {s["skipped"]:>3} skipped{bd}')
    total_new     = sum(s['new']     for s in stats.values())
    total_scraped = sum(s['scraped'] for s in stats.values())
    print(f'  {"─"*(max_src+35)}')
    print(f'  {"TOTAL":<{max_src}}  {total_scraped:>3} scraped,  {total_new:>3} new')
    print()

    if total_new == 0:
        print('✨  No new events — skipping commit.')
        _run_enrichment()
        return

    # 6. Insert new events into events.ts
    ts_block = '\n' + '\n'.join(event_to_ts(e) for e in new_events) + '\n  '
    close_idx   = find_all_events_end(content)
    new_content = content[:close_idx] + ts_block + content[close_idx:]

    # 7. Commit to GitHub
    sources_used = sorted(set(e['source'] for e in new_events))
    commit_msg   = f'data: add {total_new} events from {", ".join(sources_used)}'
    print(f'📤  Committing {total_new} new events to GitHub…')
    gh_put(FILE, new_content, sha, commit_msg)
    print(f'    ✅  {commit_msg}')

    # 8. Poll Netlify
    print('\n⏳  Waiting for Netlify deploy…')
    netlify_url = f'https://api.netlify.com/api/v1/sites/{NETLIFY_SITE}/deploys?per_page=1'
    deploy_ok = False
    for attempt in range(10):
        time.sleep(30)
        try:
            resp  = json.loads(urllib.request.urlopen(netlify_url).read())
            state = resp[0].get('state', '') if resp else ''
            print(f'    state: {state}  (attempt {attempt+1}/10)')
            if state == 'ready':
                print('    ✅  Deploy live → abqunplugged.com')
                deploy_ok = True
                break
            elif state == 'error':
                print('    ❌  Deploy failed!')
                break
        except Exception as ex:
            print(f'    ⚠  Poll error: {ex}')
    if not deploy_ok:
        print('    ⏱  Deploy timed out — check Netlify dashboard.')

    # 9. Run LM Studio enrichment
    _run_enrichment()


def _run_enrichment():
    """Run LM Studio enrichment if the server is reachable."""
    try:
        urllib.request.urlopen(f'{LM_STUDIO_URL}/v1/models', timeout=3)
    except Exception:
        print('\n⚠️  LM Studio not reachable — skipping enrichment.')
        print(f'   Start LM Studio, load Gemma, then run:')
        print(f'   cd {os.path.dirname(SCRIPT_DIR)} && node scripts/enrich-events-lm.cjs')
        return

    if not os.path.exists(ENRICH_SCRIPT):
        print(f'\n⚠️  Enrichment script not found at {ENRICH_SCRIPT}')
        return

    print('\n🤖  Running LM Studio enrichment (Gemma)…')
    project_dir = os.path.dirname(SCRIPT_DIR)
    result = subprocess.run(['node', ENRICH_SCRIPT], cwd=project_dir)
    if result.returncode != 0:
        print(f'⚠️  Enrichment script exited with code {result.returncode}')


if __name__ == '__main__':
    main()
