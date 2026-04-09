#!/usr/bin/env python3
"""
ABQ Unplugged — Event Photo Fetcher
=====================================
Downloads event images from Ticketmaster CDN / Unsplash and uploads them
permanently to Supabase Storage so they never expire or break.

Works for all event sources:
  - ticketmaster  → picks best image from raw['images'] array
  - local         → downloads raw['image'] (Unsplash or any direct URL)

After upload, sets cached_photo_url and cached_thumbnail_url on the events row.

SETUP (one time):
  1. Install Python from https://www.python.org  (check "Add to PATH")
  2. Open Command Prompt and run:
       pip install requests
  3. Paste your Supabase service_role key in the CONFIG section below
       (Supabase dashboard → Settings → API → service_role key)
  4. Run:  python fetch_event_photos.py

USAGE:
  python fetch_event_photos.py          — process all events missing photos
  python fetch_event_photos.py --reset  — clear progress and start over
  python fetch_event_photos.py --stats  — show progress without running
"""

import sys
import json
import time
import requests
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────────────────────────────────────
SUPABASE_URL  = "https://bsmvfutebmbkjvlrhiyq.supabase.co"
SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXZmdXRlYm1ia2p2bHJoaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzgwMzIsImV4cCI6MjA4OTgxNDAzMn0.3rvMRErlF-HnKfbJ6rCNSeCJc39n4K48xjAeSGqf_rc"
BUCKET        = "event-photos"
# ─────────────────────────────────────────────────────────────────────────────

PROGRESS_FILE = Path(__file__).parent / "fetch_event_progress.json"
DELAY_SECONDS = 0.5   # small pause between downloads — respectful but fast


def check_config():
    if "PASTE_YOUR" in SUPABASE_KEY:
        print("ERROR: Please open this file and paste your Supabase service_role key.")
        print("  Get it from: Supabase dashboard → Settings → API → service_role")
        sys.exit(1)


def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"done": [], "no_image": [], "failed": []}


def save_progress(p):
    PROGRESS_FILE.write_text(json.dumps(p, indent=2))


def sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Fetch events that still need photos
# ─────────────────────────────────────────────────────────────────────────────

def fetch_all_events():
    """Return all events where cached_photo_url IS NULL."""
    print("Loading events from Supabase...", end="", flush=True)
    all_rows, page, offset = [], 1000, 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/events"
            f"?select=id,source,raw,cached_photo_url"
            f"&cached_photo_url=is.null"
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
    print(f" {len(all_rows):,} events need photos")
    return all_rows


# ─────────────────────────────────────────────────────────────────────────────
#  Pick the best image URL from an event's raw data
# ─────────────────────────────────────────────────────────────────────────────

def pick_best_image(event):
    """
    Returns (full_url, thumb_url) or (None, None) if no image found.

    For ticketmaster events: raw['images'] is an array of objects like:
      { url, ratio, width, height, fallback }
    We pick the largest non-fallback 16_9 image, falling back to the
    largest image of any ratio if no 16_9 is available.

    For local events: raw['image'] is a direct URL string.
    """
    raw    = event.get("raw", {})
    source = event.get("source", "")

    # ── local events ─────────────────────────────────────────────────────────
    if source == "local":
        img = raw.get("image")
        if img and isinstance(img, str) and img.startswith("http"):
            return img, img
        # Also check images array if present
        images = raw.get("images", [])
        if images and isinstance(images, list):
            img = images[0].get("url") if isinstance(images[0], dict) else images[0]
            if img:
                return img, img
        return None, None

    # ── ticketmaster events ───────────────────────────────────────────────────
    images = raw.get("images", [])
    if not images:
        return None, None

    # Separate real images from fallback placeholders
    real   = [i for i in images if not i.get("fallback", True)]
    pool   = real if real else images   # if all are fallback, use them anyway

    def score(img):
        """Higher score = prefer this image. Prefer 16_9, larger dimensions."""
        ratio_score = 2 if img.get("ratio") == "16_9" else 1
        size_score  = img.get("width", 0) * img.get("height", 0)
        return (ratio_score, size_score)

    sorted_imgs = sorted(pool, key=score, reverse=True)
    best        = sorted_imgs[0]["url"] if sorted_imgs else None
    if not best:
        return None, None

    # Pick a thumbnail: smallest 16_9 >= 300px wide, or just the smallest overall
    thumb_candidates = [
        i for i in pool
        if i.get("ratio") == "16_9" and i.get("width", 0) >= 300
    ]
    if not thumb_candidates:
        thumb_candidates = pool
    thumb = sorted(thumb_candidates, key=lambda i: i.get("width", 0))[0]["url"]

    return best, thumb


# ─────────────────────────────────────────────────────────────────────────────
#  Download + upload
# ─────────────────────────────────────────────────────────────────────────────

def download_image(url):
    """Download image bytes. Returns bytes or None."""
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200 and len(r.content) > 2_000:
            return r.content
    except Exception:
        pass
    return None


def upload_to_storage(event_id, image_bytes, suffix=""):
    """Upload JPEG/image bytes to Supabase Storage. Returns public URL or None."""
    # Use a clean filename from the event id
    safe_id  = event_id.replace("ticketmaster_", "tm_").replace("/", "_")
    filename = f"{safe_id}{suffix}.jpg"
    url      = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{filename}"
    headers  = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "image/jpeg",
        "x-upsert":      "true",
    }
    try:
        r = requests.post(url, headers=headers, data=image_bytes, timeout=30)
        if r.status_code in (200, 201):
            return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"
    except Exception:
        pass
    return None


def update_db(event_id, photo_url, thumb_url):
    """Write cached photo URLs back to the events row."""
    url     = f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}"
    payload = {
        "cached_photo_url":     photo_url,
        "cached_thumbnail_url": thumb_url,
    }
    try:
        requests.patch(url, headers=sb_headers(), json=payload, timeout=10)
    except Exception:
        pass


# ─────────────────────────────────────────────────────────────────────────────
#  Per-event pipeline
# ─────────────────────────────────────────────────────────────────────────────

def process_event(event):
    """Full fetch-download-upload pipeline for one event. Returns (ok, reason)."""
    full_url, thumb_url = pick_best_image(event)

    if not full_url:
        return False, "no_image_in_raw"

    # Download full image
    image_bytes = download_image(full_url)
    if not image_bytes:
        return False, "download_failed"

    # Upload full image
    public_url = upload_to_storage(event["id"], image_bytes)
    if not public_url:
        return False, "upload_failed"

    # If thumb is a different URL, try to upload separately; otherwise reuse full
    if thumb_url and thumb_url != full_url:
        thumb_bytes = download_image(thumb_url)
        if thumb_bytes:
            thumb_public = upload_to_storage(event["id"], thumb_bytes, suffix="_thumb")
        else:
            thumb_public = public_url
    else:
        thumb_public = public_url

    # Update database
    update_db(event["id"], public_url, thumb_public)
    return True, public_url


# ─────────────────────────────────────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────────────────────────────────────

def print_stats(progress, total):
    done = len(progress["done"])
    pct  = round(done / max(total, 1) * 100, 1)
    print(f"\n  Photos saved : {done:>4}  ({pct}% of {total})")
    print(f"  No image     : {len(progress['no_image']):>4}")
    print(f"  Errors       : {len(progress['failed']):>4}")
    print()


def main():
    do_reset  = "--reset" in sys.argv
    show_only = "--stats" in sys.argv

    print("=" * 50)
    print("  ABQ Unplugged — Event Photo Fetcher")
    print("=" * 50)
    print()

    if do_reset:
        PROGRESS_FILE.unlink(missing_ok=True)
        print("Progress cleared. Starting fresh.\n")

    if not show_only:
        check_config()

    progress     = load_progress()
    already_done = set(progress["done"] + progress["no_image"] + progress["failed"])

    all_events = fetch_all_events()
    pending    = [e for e in all_events if e["id"] not in already_done]

    total_processed = len(progress["done"]) + len(progress["no_image"]) + len(progress["failed"])
    print_stats(progress, total_processed + len(all_events))

    if show_only:
        return

    if not pending:
        print("All done! Every event has been processed.")
        return

    print(f"{len(pending)} events to process\n")

    session_saved  = 0
    session_none   = 0
    session_errors = 0

    for i, event in enumerate(pending):
        name = event.get("raw", {}).get("name", event["id"])
        print(f"[{i+1}/{len(pending)}] {name[:50]:<50} ", end="", flush=True)

        ok, result = process_event(event)

        if ok:
            progress["done"].append(event["id"])
            session_saved += 1
            print("✓ saved")
        elif result == "no_image_in_raw":
            progress["no_image"].append(event["id"])
            session_none += 1
            print("— no image data")
        else:
            progress["failed"].append(event["id"])
            session_errors += 1
            print(f"✗ {result}")

        save_progress(progress)
        time.sleep(DELAY_SECONDS)

    print(f"\n{'=' * 50}")
    print(f"Done:")
    print(f"  ✓ {session_saved} event photos saved to Supabase Storage")
    print(f"  — {session_none} events had no image in source data")
    print(f"  ✗ {session_errors} errors")
    print()
    print(f"Total: {len(progress['done'])} events now have Supabase-hosted photos")


if __name__ == "__main__":
    main()
