#!/usr/bin/env python3
"""
ABQ Unplugged — Photo Fetcher (Yelp + Gemini)
==============================================
Fetches photos for every business in your Supabase database using:
  1. Yelp Fusion API  (primary — fast, reliable, free up to 500/day)
  2. Google Gemini    (fallback for businesses not found on Yelp — free tier)

Images are downloaded and saved permanently to Supabase Storage so they
never expire, then the database row is updated with the permanent URL.

SETUP (one time):
  1. Install Python from https://www.python.org  (check "Add to PATH")
  2. Open Command Prompt and run:
       pip install requests google-genai
  3. Fill in the CONFIG section below:
       - YELP_API_KEY   → https://www.yelp.com/developers (free account)
       - GEMINI_API_KEY → https://aistudio.google.com/app/apikey (free)
       - SUPABASE_KEY   → Supabase dashboard > Settings > API > service_role key
  4. Run:  python fetch_photos_gemini.py

USAGE:
  python fetch_photos_gemini.py            — Yelp-only test run (first 100 places)
  python fetch_photos_gemini.py --all      — Yelp-only, process everything remaining
  python fetch_photos_gemini.py --gemini   — also use Gemini for Yelp misses (slower)
  python fetch_photos_gemini.py --reset    — clear progress and start over
  python fetch_photos_gemini.py --stats    — show progress without running
"""

import os
import re
import sys
import json
import time
import requests
from pathlib import Path

def _load_env(env_file):
    """Load key=value pairs from a .env file into os.environ (if file exists)."""
    p = Path(env_file)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, _, v = line.partition('=')
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v

# Load secrets from scripts/.env (ignored by git)
_load_env(Path(__file__).parent / '.env')

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG — set these in scripts/.env or environment before running
# ─────────────────────────────────────────────────────────────────────────────
YELP_API_KEY    = os.getenv('YELP_API_KEY', '')
GEMINI_API_KEY  = os.getenv('GEMINI_API_KEY', '')
SUPABASE_URL    = os.getenv('SUPABASE_URL', 'https://bsmvfutebmbkjvlrhiyq.supabase.co')
SUPABASE_KEY    = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY') or os.getenv('SUPABASE_ANON_KEY', '')
BUCKET          = "place-photos"
# ─────────────────────────────────────────────────────────────────────────────

PROGRESS_FILE   = Path(__file__).parent / "fetch_progress_gemini.json"

# Limits per run
TEST_LIMIT      = 100     # --default: test with first 100 places
DAILY_YELP_MAX  = 490     # Yelp free tier: 500/day — stay safely under

# Delays (respect rate limits)
YELP_DELAY_S    = 1.0     # seconds between Yelp calls
GEMINI_DELAY_S  = 5.0     # seconds between Gemini calls (free tier: 15 req/min)
MATCH_RADIUS_M  = 400     # Yelp search radius in meters


# ─────────────────────────────────────────────────────────────────────────────
#  Startup checks
# ─────────────────────────────────────────────────────────────────────────────

def check_config():
    missing = []
    if "PASTE_YOUR" in GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY")
    if "PASTE_YOUR" in SUPABASE_KEY:
        missing.append("SUPABASE_KEY")
    if missing:
        print("ERROR: Please open this file and fill in these values in the CONFIG section:")
        for k in missing:
            print(f"  {k}")
        print()
        print("Where to get them:")
        print("  YELP_API_KEY   → https://www.yelp.com/developers")
        print("  GEMINI_API_KEY → https://aistudio.google.com/app/apikey  (free)")
        print("  SUPABASE_KEY   → Supabase dashboard > Settings > API > service_role key")
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
#  Progress tracking
# ─────────────────────────────────────────────────────────────────────────────

def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {
        "done": [],          # id list — photo saved
        "yelp_miss": [],     # id list — not found on Yelp
        "gemini_miss": [],   # id list — not found via Gemini either
        "failed": [],        # id list — found but download/upload failed
    }


def save_progress(p):
    PROGRESS_FILE.write_text(json.dumps(p, indent=2))


# ─────────────────────────────────────────────────────────────────────────────
#  Supabase helpers
# ─────────────────────────────────────────────────────────────────────────────

def sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def fetch_all_places():
    """Return all places that still need a photo (cached_photo_url IS NULL or = 'none')."""
    print("Loading places from Supabase...", end="", flush=True)
    all_rows, page, offset = [], 1000, 0
    while True:
        # BUG FIX: was only fetching cached_photo_url=eq.none (the string 'none'),
        # which missed 2,315 places where cached_photo_url IS NULL (never processed).
        # Now we fetch BOTH: NULL values and the string 'none'.
        url = (
            f"{SUPABASE_URL}/rest/v1/places"
            f"?select=id,raw,cached_photo_url"
            f"&or=(cached_photo_url.is.null,cached_photo_url.eq.none)"
            f"&offset={offset}&limit={page}"
        )
        r = requests.get(url, headers=sb_headers(), timeout=30)
        r.raise_for_status()
        rows = r.json()
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < page:
            break
        offset += page
    print(f" {len(all_rows):,} places still need photos")
    return all_rows


def upload_to_storage(place_id, image_bytes):
    """Upload JPEG bytes → Supabase Storage. Returns public URL or None."""
    filename = place_id.replace("google_", "") + ".jpg"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{filename}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
    }
    try:
        r = requests.post(url, headers=headers, data=image_bytes, timeout=30)
        if r.status_code in (200, 201):
            return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"
    except Exception:
        pass
    return None


def update_db(place_id, photo_url):
    """Write the permanent URL back to cached_photo_url and cached_thumbnail_url."""
    url = f"{SUPABASE_URL}/rest/v1/places?id=eq.{place_id}"
    payload = {"cached_photo_url": photo_url, "cached_thumbnail_url": photo_url}
    try:
        requests.patch(url, headers=sb_headers(), json=payload, timeout=10)
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────────────
#  Image download
# ─────────────────────────────────────────────────────────────────────────────

def download_image(url):
    """Download image bytes. Returns bytes or None (rejects tiny/broken images)."""
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200 and len(r.content) > 5_000:
            return r.content
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────────────────────
#  Yelp API
# ─────────────────────────────────────────────────────────────────────────────

_yelp_calls_this_session = 0


def search_yelp(name, lat, lng):
    """
    Search Yelp for the business.
    Returns a full-size image URL string, or None if not found.
    """
    global _yelp_calls_this_session
    if _yelp_calls_this_session >= DAILY_YELP_MAX:
        return None  # caller will switch to Gemini-only mode

    try:
        r = requests.get(
            "https://api.yelp.com/v3/businesses/search",
            headers={"Authorization": f"Bearer {YELP_API_KEY}"},
            params={
                "term": name,
                "latitude": lat,
                "longitude": lng,
                "radius": MATCH_RADIUS_M,
                "limit": 1,
            },
            timeout=10,
        )
        _yelp_calls_this_session += 1

        if r.status_code == 429:
            print("\n  [!] Yelp rate-limited — pausing 60 s...")
            time.sleep(60)
            return None
        if r.status_code != 200:
            return None

        businesses = r.json().get("businesses", [])
        if not businesses:
            return None

        img = businesses[0].get("image_url", "")
        if not img:
            return None

        # Swap Yelp's 300px thumbnail for the original full-size image
        return img.replace("/300s.jpg", "/o.jpg").replace("/ls.jpg", "/o.jpg")

    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  Gemini API  (fallback)
# ─────────────────────────────────────────────────────────────────────────────

_gemini_client = None


def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        try:
            from google import genai
            from google.genai import types
            _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        except ImportError:
            print("\n  [!] google-genai not installed.")
            print("      Run:  pip install google-genai")
            sys.exit(1)
    return _gemini_client


# Regex to pull the first direct image URL out of Gemini's reply
_IMG_RE = re.compile(
    r'https?://[^\s\'"<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s\'"<>]*)?',
    re.IGNORECASE,
)


def search_gemini(name, address, lat, lng, _retries=0):
    """
    Ask Gemini (with Search grounding) for a direct image URL for the business.
    Returns a URL string or None.  Retries once after a rate-limit pause.
    """
    from google import genai
    from google.genai import types
    client = get_gemini_client()
    prompt = (
        f"Find a high-quality photo of the business '{name}' located at "
        f"{address} in Albuquerque, NM (coordinates {lat:.4f}, {lng:.4f}). "
        f"Search the web for their official website, Yelp page, TripAdvisor "
        f"listing, or Facebook/Instagram business page. "
        f"Reply with ONLY a single direct image URL (ending in .jpg, .jpeg, "
        f".png, or .webp) — no explanation, no markdown, just the URL. "
        f"If you cannot find a real photo, reply with the single word: NONE"
    )
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())]
            ),
        )
        text = response.text.strip()

        if text.upper() == "NONE" or not text:
            return None

        # Try to pull an image URL from the reply
        matches = _IMG_RE.findall(text)
        if matches:
            return matches[0]

        # Sometimes Gemini wraps in markdown — strip and retry
        clean = text.strip("`").strip()
        if clean.startswith("http") and any(
            clean.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp")
        ):
            return clean

        return None
    except Exception as e:
        err = str(e)
        if ("429" in err or "quota" in err.lower() or "RESOURCE_EXHAUSTED" in err):
            if _retries < 3:
                wait = 65 * (_retries + 1)
                print(f"\n  [!] Gemini rate-limited — pausing {wait}s then retrying...")
                time.sleep(wait)
                return search_gemini(name, address, lat, lng, _retries + 1)
            else:
                print(f"\n  [!] Gemini rate limit persists after retries — skipping")
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  Per-place pipeline
# ─────────────────────────────────────────────────────────────────────────────

def process_place(place, use_yelp=True, use_gemini=True):
    """
    Full fetch-download-upload pipeline for one place.
    Returns (success: bool, reason: str)
    """
    raw   = place.get("raw", {})
    name  = raw.get("name", "")
    geo   = raw.get("geometry", {}).get("location", {})
    lat   = geo.get("lat")
    lng   = geo.get("lng")
    addr  = raw.get("vicinity") or raw.get("formatted_address") or ""

    if not name or lat is None or lng is None:
        return False, "missing_data"

    image_url = None
    source    = None

    # ── 1. Try Yelp ──────────────────────────────────────────────────────────
    if use_yelp:
        image_url = search_yelp(name, lat, lng)
        if image_url:
            source = "yelp"
        time.sleep(YELP_DELAY_S)

    # ── 2. Fall back to Gemini ───────────────────────────────────────────────
    if not image_url and use_gemini:
        image_url = search_gemini(name, addr, lat, lng)
        if image_url:
            source = "gemini"
        time.sleep(GEMINI_DELAY_S)

    if not image_url:
        return False, "not_found"

    # ── 3. Download ──────────────────────────────────────────────────────────
    image_bytes = download_image(image_url)
    if not image_bytes:
        return False, f"download_failed ({source})"

    # ── 4. Upload to Supabase Storage ────────────────────────────────────────
    public_url = upload_to_storage(place["id"], image_bytes)
    if not public_url:
        return False, "upload_failed"

    # ── 5. Update database ───────────────────────────────────────────────────
    update_db(place["id"], public_url)
    return True, source


# ─────────────────────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────────────────────

def print_stats(progress, total):
    done  = len(progress["done"])
    pct   = round(done / max(total, 1) * 100, 1)
    print(f"\n  Photos saved   : {done:>5,}  ({pct}% of {total:,})")
    print(f"  Yelp misses    : {len(progress['yelp_miss']):>5,}")
    print(f"  Gemini misses  : {len(progress['gemini_miss']):>5,}")
    print(f"  Errors         : {len(progress['failed']):>5,}")
    skipped = len(progress["yelp_miss"]) + len(progress["gemini_miss"])
    print(f"  Processed total: {done + skipped:>5,}")
    print()


def main():
    run_all   = "--all"   in sys.argv
    do_reset  = "--reset" in sys.argv
    show_only = "--stats" in sys.argv

    print("=" * 55)
    print("  ABQ Unplugged — Photo Fetcher  (Yelp + Gemini)")
    print("=" * 55)
    print()

    if do_reset:
        PROGRESS_FILE.unlink(missing_ok=True)
        print("Progress cleared. Starting fresh.\n")

    if not show_only:
        check_config()

    progress    = load_progress()
    already_done = set(
        progress["done"]
        + progress["yelp_miss"]
        + progress["gemini_miss"]
        + progress["failed"]
    )

    all_places = fetch_all_places()
    pending    = [p for p in all_places if p["id"] not in already_done]
    limit      = len(pending) if run_all else TEST_LIMIT

    print_stats(progress, len(all_places) + len(progress["done"]))

    if show_only:
        return

    if not pending:
        print("All done! Every place has been processed.")
        return

    mode_label = "FULL RUN" if run_all else f"TEST RUN — first {limit} places"
    print(f"{len(pending):,} places remaining  [{mode_label}]\n")

    session_saved   = 0
    session_yelp    = 0
    session_gemini  = 0
    session_miss    = 0
    session_errors  = 0

    for i, place in enumerate(pending[:limit]):
        name = place.get("raw", {}).get("name", "unknown")
        pct  = round(len(progress["done"]) / max(len(all_places) + len(progress["done"]), 1) * 100, 1)
        idx  = f"[{i+1}/{min(len(pending), limit)}  {pct}%]"
        print(f"{idx} {name[:42]:<42} ", end="", flush=True)

        yelp_ok = bool(YELP_API_KEY) and _yelp_calls_this_session < DAILY_YELP_MAX
        # use_gemini=False for the first Yelp pass — much faster; re-enable with --gemini flag
        gemini_ok = "--gemini" in sys.argv
        success, result = process_place(place, use_yelp=yelp_ok, use_gemini=gemini_ok)

        if success:
            progress["done"].append(place["id"])
            session_saved += 1
            if result == "yelp":
                session_yelp += 1
                print("✓ yelp")
            else:
                session_gemini += 1
                print("✓ gemini")
        elif result == "not_found":
            # Only mark as fully missed if we tried both sources
            if yelp_ok:
                progress["yelp_miss"].append(place["id"])
            else:
                progress["gemini_miss"].append(place["id"])
            session_miss += 1
            print("— not found")
        else:
            progress["failed"].append(place["id"])
            session_errors += 1
            print(f"✗ {result}")

        save_progress(progress)

    remaining = len(pending) - limit
    print(f"\n{'=' * 55}")
    print(f"Session complete:")
    print(f"  ✓ {session_saved} photos saved  "
          f"({session_yelp} via Yelp, {session_gemini} via Gemini)")
    print(f"  — {session_miss} not found on either source")
    print(f"  ✗ {session_errors} errors")
    if remaining > 0:
        print(f"\n  {remaining:,} places still remaining.")
        if not run_all:
            print(f"  Run with --all to process everything:")
            print(f"    python fetch_photos_gemini.py --all")
    print()
    total_done = len(progress["done"])
    grand_total = len(all_places) + total_done
    print(f"Overall: {total_done:,} / {grand_total:,} places now have photos  "
          f"({round(total_done/max(grand_total,1)*100,1)}%)")


if __name__ == "__main__":
    main()
