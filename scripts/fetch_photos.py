#!/usr/bin/env python3
"""
ABQ Unplugged — Business Photo Fetcher
=======================================
Fetches photos from Yelp for every business in your Supabase database
and saves them permanently to Supabase Storage so they never expire.

Runs on Windows. Free — uses Yelp's free API tier (500 calls/day).
At 500/day it covers all 4,622 places in about 9 nights of background running.

SETUP (one time):
  1. Install Python from https://www.python.org  (check "Add to PATH")
  2. Open Command Prompt and run:
       pip install requests supabase
  3. Get a free Yelp API key:
       - Go to https://www.yelp.com/developers
       - Click "Create App" (free account required)
       - Copy your "API Key"
  4. Get your Supabase service key:
       - Go to https://supabase.com/dashboard/project/bsmvfutebmbkjvlrhiyq/settings/api
       - Copy the "service_role" key (NOT the anon key)
  5. Paste both keys into the CONFIG section below
  6. Run:  python fetch_photos.py

USAGE:
  python fetch_photos.py          — runs today's batch (up to 490 places)
  python fetch_photos.py --reset  — clears progress and starts over

The script saves progress to fetch_progress.json in the same folder.
Run it once per day (or set up Windows Task Scheduler to run it overnight).
"""

import os
import sys
import json
import time
import requests
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG — fill these in before running
# ─────────────────────────────────────────────────────────────────────────────
YELP_API_KEY    = "PASTE_YOUR_YELP_API_KEY_HERE"
SUPABASE_URL    = "https://bsmvfutebmbkjvlrhiyq.supabase.co"
SUPABASE_KEY    = "PASTE_YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE"
BUCKET          = "place-photos"
# ─────────────────────────────────────────────────────────────────────────────

PROGRESS_FILE   = Path(__file__).parent / "fetch_progress.json"
DAILY_LIMIT     = 490       # safely under Yelp's 500/day
DELAY_SECONDS   = 7.5       # pause between Yelp calls (keeps us well under limit)
MATCH_RADIUS_M  = 400       # meters — tight to avoid matching wrong business


def check_config():
    if "PASTE_YOUR" in YELP_API_KEY or "PASTE_YOUR" in SUPABASE_KEY:
        print("ERROR: Please open this file and fill in your API keys in the CONFIG section.")
        print("  YELP_API_KEY    — from https://www.yelp.com/developers")
        print("  SUPABASE_KEY    — service_role key from Supabase dashboard > Settings > API")
        sys.exit(1)


def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"done": [], "failed": [], "no_match": []}


def save_progress(progress):
    PROGRESS_FILE.write_text(json.dumps(progress, indent=2))


def get_supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def fetch_all_places():
    """Fetch all places with cached_photo_url = 'none' from Supabase."""
    print("Loading places from Supabase...", end="", flush=True)
    all_rows = []
    page = 1000
    offset = 0

    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/places"
            f"?select=id,raw,cached_photo_url"
            f"&or=(cached_photo_url.is.null,cached_photo_url.eq.none)"
            f"&offset={offset}&limit={page}"
        )
        resp = requests.get(url, headers=get_supabase_headers(), timeout=30)
        resp.raise_for_status()
        rows = resp.json()
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < page:
            break
        offset += page

    print(f" {len(all_rows)} places need photos")
    return all_rows


def search_yelp(name, lat, lng):
    """Search Yelp for a business. Returns image URL or None."""
    try:
        resp = requests.get(
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
        if resp.status_code == 429:
            print("\n  [!] Yelp rate limit hit — pausing 60 seconds...")
            time.sleep(60)
            return None
        if resp.status_code != 200:
            return None

        businesses = resp.json().get("businesses", [])
        if not businesses:
            return None

        img = businesses[0].get("image_url", "")
        if not img:
            return None

        # Replace Yelp's 300px thumbnail with full-size version
        return img.replace("/300s.jpg", "/o.jpg").replace("/ls.jpg", "/o.jpg")

    except Exception:
        return None


def download_image(url):
    """Download image bytes. Returns bytes or None."""
    try:
        resp = requests.get(url, timeout=20)
        if resp.status_code == 200:
            content = resp.content
            if len(content) > 5000:   # reject tiny/broken images
                return content
    except Exception:
        pass
    return None


def upload_to_storage(place_id, image_bytes):
    """Upload image to Supabase Storage. Returns public URL or None."""
    # Strip the 'google_' prefix for cleaner filenames
    filename = place_id.replace("google_", "") + ".jpg"
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{filename}"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
    }

    try:
        resp = requests.post(upload_url, headers=headers, data=image_bytes, timeout=30)
        if resp.status_code in (200, 201):
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"
            return public_url
    except Exception:
        pass
    return None


def update_place_in_db(place_id, photo_url):
    """Update cached_photo_url and cached_thumbnail_url in Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/places?id=eq.{place_id}"
    payload = {
        "cached_photo_url": photo_url,
        "cached_thumbnail_url": photo_url,
    }
    requests.patch(url, headers=get_supabase_headers(), json=payload, timeout=10)


def process_place(place):
    """Full pipeline for one place. Returns (success, reason)."""
    raw = place.get("raw", {})
    name = raw.get("name", "")
    loc = raw.get("geometry", {}).get("location", {})
    lat = loc.get("lat")
    lng = loc.get("lng")

    if not name or lat is None or lng is None:
        return False, "missing_data"

    # 1. Find on Yelp
    image_url = search_yelp(name, lat, lng)
    if not image_url:
        return False, "not_on_yelp"

    # 2. Download
    image_bytes = download_image(image_url)
    if not image_bytes:
        return False, "download_failed"

    # 3. Upload to Supabase Storage
    public_url = upload_to_storage(place["id"], image_bytes)
    if not public_url:
        return False, "upload_failed"

    # 4. Update database
    update_place_in_db(place["id"], public_url)
    return True, public_url


def main():
    print("=" * 50)
    print("  ABQ Unplugged — Photo Fetcher")
    print("=" * 50)
    print()

    # Handle --reset flag
    if "--reset" in sys.argv:
        PROGRESS_FILE.unlink(missing_ok=True)
        print("Progress cleared. Starting fresh.\n")

    check_config()

    # Load progress
    progress = load_progress()
    already_done = set(progress["done"] + progress["failed"] + progress["no_match"])
    print(f"Progress: {len(progress['done'])} photos saved, "
          f"{len(progress['no_match'])} not on Yelp, "
          f"{len(progress['failed'])} errors\n")

    # Fetch places
    all_places = fetch_all_places()
    pending = [p for p in all_places if p["id"] not in already_done]

    if not pending:
        print("All done! Every place has been processed.")
        print(f"  {len(progress['done'])} photos saved to Supabase Storage")
        print(f"  {len(progress['no_match'])} places not found on Yelp (gradient fallback shown)")
        return

    print(f"{len(pending)} places left to process  (running up to {DAILY_LIMIT} today)\n")

    session_saved = 0
    session_skipped = 0
    session_errors = 0

    for i, place in enumerate(pending):
        if i >= DAILY_LIMIT:
            print(f"\nReached today's limit of {DAILY_LIMIT}.")
            print("Run the script again tomorrow to continue.\n")
            break

        name = place.get("raw", {}).get("name", "unknown")
        pct = round((len(progress["done"]) / max(len(all_places), 1)) * 100, 1)
        print(f"[{i+1}/{min(len(pending), DAILY_LIMIT)}  {pct}%] {name[:45]}... ",
              end="", flush=True)

        success, result = process_place(place)

        if success:
            progress["done"].append(place["id"])
            session_saved += 1
            print("✓ saved")
        elif result == "not_on_yelp":
            progress["no_match"].append(place["id"])
            session_skipped += 1
            print("— not on Yelp")
        else:
            progress["failed"].append(place["id"])
            session_errors += 1
            print(f"✗ {result}")

        save_progress(progress)

        # Respect Yelp's rate limit
        if i < min(len(pending), DAILY_LIMIT) - 1:
            time.sleep(DELAY_SECONDS)

    remaining = len(pending) - min(len(pending), DAILY_LIMIT)
    print(f"\n{'=' * 50}")
    print(f"Today's session complete:")
    print(f"  ✓ {session_saved} photos saved")
    print(f"  — {session_skipped} not found on Yelp")
    print(f"  ✗ {session_errors} errors")
    if remaining > 0:
        print(f"  {remaining} places still remaining — run again tomorrow")
    print()
    print(f"Total progress: {len(progress['done'])} / {len(all_places)} places have photos")


if __name__ == "__main__":
    main()
