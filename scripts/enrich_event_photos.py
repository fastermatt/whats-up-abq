#!/usr/bin/env python3
"""
ABQ Unplugged — Event Photo Enrichment Pipeline
================================================
Finds events missing photos and fills them via a 3-tier strategy:

  Tier 1: Extract images from raw API data (SeatGeek performers, etc.)
  Tier 2: Scrape og:image from the event's ticket URL
  Tier 3: Generate a stylized promotional image with Gemini

After obtaining an image, uploads it to Supabase Storage (event-photos bucket)
and updates both cached_photo_url and raw->'images' on the events row.

USAGE:
  python3 enrich_event_photos.py              — process all events missing photos
  python3 enrich_event_photos.py --stats      — show counts only
  python3 enrich_event_photos.py --source sg  — only SeatGeek events
  python3 enrich_event_photos.py --limit 10   — process max 10 events
  python3 enrich_event_photos.py --tier 1     — only try Tier 1 (API scrape)
  python3 enrich_event_photos.py --tier 12    — Tier 1 + 2 (no Gemini generation)
  python3 enrich_event_photos.py --tier 123   — all tiers (default)
"""

import sys
import json
import time
import re
import os
import hashlib
import argparse
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import quote, urlencode

import requests

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────────────────────────────────────
SUPABASE_URL  = "https://bsmvfutebmbkjvlrhiyq.supabase.co"
SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXZmdXRlYm1ia2p2bHJoaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzgwMzIsImV4cCI6MjA4OTgxNDAzMn0.3rvMRErlF-HnKfbJ6rCNSeCJc39n4K48xjAeSGqf_rc"
BUCKET        = "event-photos"
SEATGEEK_AID  = "a74134c31c4ac4008d2c75ce858e2c4a1d84fc400c66eccfc706accd32ec9c2e"
GEMINI_BIN    = "/opt/homebrew/bin/gemini"

PROGRESS_FILE = Path(__file__).parent / "enrich_event_progress.json"
DELAY_SECONDS = 0.5

# User-Agent for scraping og:image
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

# ─────────────────────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def sb_headers(content_type="application/json"):
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
    }

def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"done": [], "failed": [], "generated": [], "scraped": []}

def save_progress(p):
    PROGRESS_FILE.write_text(json.dumps(p, indent=2))

def unwrap_raw(raw: dict) -> dict:
    """Unwrap nested raw structure. Some sources store data at raw['raw'], others directly."""
    if "raw" in raw and isinstance(raw["raw"], dict) and "name" in raw["raw"]:
        return raw["raw"]
    return raw

def slugify(text: str) -> str:
    """Convert event name to a filesystem-safe slug."""
    s = text.lower().strip()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s-]+', '-', s)
    return s[:80]

# ─────────────────────────────────────────────────────────────────────────────
#  FETCH EVENTS MISSING PHOTOS
# ─────────────────────────────────────────────────────────────────────────────

def fetch_events_missing_photos(source_filter=None):
    """Get events where raw->'images' is empty/null AND cached_photo_url is null."""
    print("Loading events missing photos from Supabase...", end="", flush=True)

    all_rows = []
    offset = 0
    page_size = 1000

    while True:
        url = f"{SUPABASE_URL}/rest/v1/events"
        params = {
            "select": "id,source,raw,event_date",
            "event_date": f"gte.{time.strftime('%Y-%m-%d')}",
            "cached_photo_url": "is.null",
            "order": "event_date.asc",
            "offset": str(offset),
            "limit": str(page_size),
        }
        if source_filter:
            params["source"] = f"eq.{source_filter}"

        r = requests.get(url, headers=sb_headers(), params=params)
        r.raise_for_status()
        rows = r.json()

        # Filter to only events truly missing images
        for row in rows:
            raw = unwrap_raw(row.get("raw") or {})
            row["_inner_raw"] = raw  # store unwrapped for later use
            imgs = raw.get("images") or []
            # Include events that have no images OR have images but no cached copy
            if not imgs:
                row["_needs"] = "full"  # needs a photo found + cached
            else:
                row["_needs"] = "cache"  # has URLs but needs caching
            all_rows.append(row)

        if len(rows) < page_size:
            break
        offset += page_size

    print(f" {len(all_rows)} events found")
    return all_rows


# ─────────────────────────────────────────────────────────────────────────────
#  TIER 1: Extract / re-fetch from source API
# ─────────────────────────────────────────────────────────────────────────────

def tier1_seatgeek_performer_image(raw: dict) -> Optional[str]:
    """Try to get performer image from raw SeatGeek data or re-query API."""
    # Check existing performer data in raw
    performers = raw.get("performers") or []
    for p in performers:
        img = p.get("image")
        if img and "seatgeek" in img:
            return img
        imgs = p.get("images") or {}
        for key in ("huge", "banner", "large"):
            url = imgs.get(key)
            if isinstance(url, dict):
                url = url.get("url")
            if url:
                return url

    # Try re-querying SeatGeek API by event ID
    sg_id = (raw.get("id") or "").replace("seatgeek_", "")
    if sg_id.isdigit():
        try:
            api_url = f"https://api.seatgeek.com/2/events/{sg_id}"
            r = requests.get(api_url, params={"client_id": SEATGEEK_AID}, timeout=10)
            if r.ok:
                data = r.json()
                for p in (data.get("performers") or []):
                    if p.get("image"):
                        return p["image"]
                    for key in ("huge", "banner"):
                        imgs = p.get("images") or {}
                        if isinstance(imgs.get(key), str):
                            return imgs[key]
                        elif isinstance(imgs.get(key), dict) and imgs[key].get("url"):
                            return imgs[key]["url"]
        except Exception as e:
            print(f"    SeatGeek API error: {e}")

    return None

def tier1_extract_existing_image(raw: dict, source: str) -> Optional[str]:
    """Try to extract an image URL from the raw event data."""
    # Direct image field
    if raw.get("image"):
        return raw["image"]

    # Eventbrite logo
    logo = raw.get("logo") or {}
    if isinstance(logo, dict):
        orig = logo.get("original") or {}
        if isinstance(orig, dict) and orig.get("url"):
            return orig["url"]
        if logo.get("url"):
            return logo["url"]

    # SeatGeek-specific
    if source == "seatgeek":
        return tier1_seatgeek_performer_image(raw)

    return None


# ─────────────────────────────────────────────────────────────────────────────
#  TIER 2: Scrape og:image from event URL
# ─────────────────────────────────────────────────────────────────────────────

def tier2_scrape_og_image(raw: dict) -> Optional[str]:
    """Fetch the event's ticket URL and extract og:image meta tag."""
    # Find a URL to scrape
    url = raw.get("url")
    if not url:
        links = raw.get("ticketLinks") or []
        for link in links:
            if isinstance(link, dict) and link.get("url"):
                url = link["url"]
                break
    if not url:
        return None

    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=10, allow_redirects=True)
        if not r.ok:
            return None

        html = r.text[:50000]  # Only check first 50k chars

        # Look for og:image
        patterns = [
            r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
            r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:image["\']',
            r'<meta\s+name=["\']twitter:image["\']\s+content=["\']([^"\']+)["\']',
        ]
        for pat in patterns:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                img_url = m.group(1)
                # Filter out generic placeholders
                placeholders = ['placeholder', 'default', 'logo-og', 'social-share',
                               'og-default', 'meta-image']
                if any(p in img_url.lower() for p in placeholders):
                    continue
                return img_url
    except Exception as e:
        print(f"    og:image scrape failed: {e}")

    return None


# ─────────────────────────────────────────────────────────────────────────────
#  TIER 3: Generate stylized image with Gemini
# ─────────────────────────────────────────────────────────────────────────────

# Category → visual style mapping for Gemini prompts
CATEGORY_STYLES = {
    "music":     "concert stage with dramatic purple and blue lighting, crowd silhouettes, smoke effects",
    "comedy":    "comedy club spotlight on empty microphone stand, warm amber lighting, brick wall background",
    "sports":    "dynamic stadium atmosphere, green field, dramatic floodlights, crowd energy",
    "arts":      "art gallery with warm lighting, colorful abstract paintings on walls, elegant atmosphere",
    "family":    "colorful carnival/festival scene with balloons, bright daylight, cheerful atmosphere",
    "outdoor":   "beautiful New Mexico desert landscape at golden hour, mountains, dramatic sky",
    "food":      "vibrant food festival scene with string lights, food stalls, warm evening atmosphere",
    "festival":  "large outdoor festival with colorful tents, string lights, crowd gathering at dusk",
    "volunteer": "community gathering in a park, diverse group of people, warm sunlight, friendly atmosphere",
    "film":      "cinematic movie theater interior, dramatic red curtains, projected light beam",
    "free":      "public park gathering with people enjoying outdoors, trees, sunny day in Albuquerque",
    "default":   "vibrant event scene in Albuquerque New Mexico, warm desert colors, evening atmosphere",
}

def guess_category(raw: dict) -> str:
    """Guess the event category from its data for Gemini prompt styling."""
    name = (raw.get("name") or "").lower()
    classifications = raw.get("classifications") or []
    segment = ""
    genre = ""
    for c in classifications:
        seg = c.get("segment") or {}
        gen = c.get("genre") or {}
        segment = (seg.get("name") or "").lower()
        genre = (gen.get("name") or "").lower()

    combined = f"{name} {segment} {genre}"

    if any(w in combined for w in ["concert", "music", "band", "singer", "dj", "live music"]):
        return "music"
    if any(w in combined for w in ["comedy", "comedian", "standup", "stand-up", "laugh"]):
        return "comedy"
    if any(w in combined for w in ["sport", "game", "match", "baseball", "football", "soccer", "basketball"]):
        return "sports"
    if any(w in combined for w in ["art", "gallery", "museum", "exhibition", "theatre", "theater", "dance", "ballet"]):
        return "arts"
    if any(w in combined for w in ["family", "kid", "children", "puppet"]):
        return "family"
    if any(w in combined for w in ["outdoor", "hike", "trail", "nature", "park"]):
        return "outdoor"
    if any(w in combined for w in ["food", "drink", "beer", "wine", "culinary", "tasting"]):
        return "food"
    if any(w in combined for w in ["festival", "fest", "fair", "fiesta"]):
        return "festival"
    if any(w in combined for w in ["film", "movie", "screening", "cinema", "documentary"]):
        return "film"
    if any(w in combined for w in ["volunteer", "cleanup", "community service", "donation"]):
        return "volunteer"
    if any(w in combined for w in ["free"]):
        return "free"

    return "default"

def tier3_generate_image(raw: dict, event_id: str) -> Optional[str]:
    """Generate a stylized promotional image using Gemini CLI."""
    name = raw.get("name") or raw.get("title") or "Event"
    category = guess_category(raw)
    style = CATEGORY_STYLES.get(category, CATEGORY_STYLES["default"])

    # Build the Gemini prompt
    prompt = (
        f'Generate a 16:9 landscape promotional photo for an event called "{name}". '
        f'The background should be: {style}. '
        f'Apply a slight gaussian blur and film grain to the background to give it an atmospheric, '
        f'editorial look — it should NOT look AI-generated. '
        f'Overlay the event name "{name}" in large, bold, modern sans-serif white text '
        f'(with a subtle drop shadow) centered in the image. '
        f'The text should be the clear focal point. '
        f'Make it look like a professional event promotional banner. '
        f'Save the result as a high-quality JPEG.'
    )

    slug = slugify(name)
    out_path = f"/tmp/event_img_{slug}.jpg"

    try:
        # Use Gemini CLI to generate
        result = subprocess.run(
            [GEMINI_BIN, "-p", prompt, "--yolo"],
            capture_output=True,
            text=True,
            timeout=120,
            cwd="/tmp",
        )

        # Check if Gemini created an image file
        # Gemini CLI typically saves files in the current directory
        possible_files = list(Path("/tmp").glob(f"event_img_{slug}*")) + \
                        list(Path("/tmp").glob("*.jpg")) + \
                        list(Path("/tmp").glob("*.png")) + \
                        list(Path("/tmp").glob("*.jpeg"))

        # Find the newest image file created in the last 60 seconds
        import stat
        now = time.time()
        for f in sorted(possible_files, key=lambda x: x.stat().st_mtime, reverse=True):
            if now - f.stat().st_mtime < 120 and f.stat().st_size > 5000:
                return str(f)

        print(f"    Gemini didn't produce an image file for: {name[:40]}")
        return None

    except subprocess.TimeoutExpired:
        print(f"    Gemini timed out for: {name[:40]}")
        return None
    except Exception as e:
        print(f"    Gemini error: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  IMAGE DOWNLOAD + UPLOAD TO SUPABASE STORAGE
# ─────────────────────────────────────────────────────────────────────────────

def download_image(url: str) -> Optional[bytes]:
    """Download an image from a URL, return bytes or None."""
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=15, stream=True)
        if not r.ok:
            return None
        content_type = r.headers.get("Content-Type", "")
        if "image" not in content_type and "octet" not in content_type:
            return None
        data = r.content
        if len(data) < 2000:  # Too small, probably a placeholder
            return None
        return data
    except Exception:
        return None

def upload_to_supabase(event_id: str, image_data: bytes, ext: str = "jpg") -> Optional[str]:
    """Upload image bytes to Supabase Storage, return public URL."""
    safe_id = event_id.replace("/", "_")
    object_path = f"{safe_id}.{ext}"

    content_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"

    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{object_path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }

    try:
        r = requests.post(url, headers=headers, data=image_data, timeout=30)
        if r.ok or r.status_code == 200:
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{object_path}"
            return public_url
        else:
            print(f"    Upload failed ({r.status_code}): {r.text[:200]}")
            return None
    except Exception as e:
        print(f"    Upload error: {e}")
        return None

def upload_local_file(event_id: str, local_path: str) -> Optional[str]:
    """Upload a local file to Supabase Storage, return public URL."""
    p = Path(local_path)
    if not p.exists() or p.stat().st_size < 2000:
        return None
    ext = p.suffix.lstrip(".") or "jpg"
    data = p.read_bytes()
    return upload_to_supabase(event_id, data, ext)


# ─────────────────────────────────────────────────────────────────────────────
#  UPDATE EVENT IN SUPABASE
# ─────────────────────────────────────────────────────────────────────────────

def update_event_photo(event_id: str, photo_url: str, inner_raw: dict, full_raw: dict):
    """Update the event's cached_photo_url and inject URL into raw.images."""
    # Build updated images array
    existing_images = inner_raw.get("images") or []
    new_image = {"url": photo_url, "width": 1200, "height": 675, "ratio": "16_9", "fallback": False}

    # Prepend the new cached image
    updated_images = [new_image] + [img for img in existing_images if img.get("url") != photo_url]

    # Update inner raw with new images
    inner_raw["images"] = updated_images

    # If full_raw has a nested 'raw' key, update that; otherwise full_raw IS inner_raw
    if "raw" in full_raw and isinstance(full_raw["raw"], dict):
        full_raw["raw"] = inner_raw

    # PATCH the event
    url = f"{SUPABASE_URL}/rest/v1/events"
    params = {"id": f"eq.{event_id}"}
    body = {
        "cached_photo_url": photo_url,
        "raw": full_raw,
    }
    headers = sb_headers()
    headers["Prefer"] = "return=minimal"

    try:
        r = requests.patch(url, headers=headers, params=params, json=body, timeout=15)
        if r.ok or r.status_code == 204:
            return True
        else:
            print(f"    DB update failed ({r.status_code}): {r.text[:200]}")
            return False
    except Exception as e:
        print(f"    DB update error: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
#  MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def process_event(row: dict, tiers: str = "123", progress: dict = None) -> str:
    """Process a single event through the photo enrichment tiers.
    Returns: 'done', 'scraped', 'generated', 'failed'
    """
    event_id = row["id"]
    source = row["source"]
    full_raw = row.get("raw") or {}
    raw = row.get("_inner_raw") or unwrap_raw(full_raw)
    name = raw.get("name") or raw.get("title") or event_id
    needs = row.get("_needs", "full")

    print(f"  [{source}] {name[:60]}", end="", flush=True)

    image_url = None
    result_type = "failed"

    # ── If event already has images, just cache the best one ──
    if needs == "cache":
        existing = (raw.get("images") or [])
        if existing:
            best_url = existing[0].get("url")
            if best_url:
                print(" → caching existing...", end="", flush=True)
                img_data = download_image(best_url)
                if img_data:
                    cached_url = upload_to_supabase(event_id, img_data)
                    if cached_url:
                        update_event_photo(event_id, cached_url, raw, full_raw)
                        print(f" ✓ cached")
                        return "done"
                print(f" ✗ download failed, trying other tiers")

    # ── Tier 1: Extract from raw data / re-query API ──
    if "1" in tiers:
        print(" → T1", end="", flush=True)
        image_url = tier1_extract_existing_image(raw, source)
        if image_url:
            img_data = download_image(image_url)
            if img_data:
                cached_url = upload_to_supabase(event_id, img_data)
                if cached_url:
                    update_event_photo(event_id, cached_url, raw, full_raw)
                    print(f" ✓ API")
                    return "scraped"
            image_url = None  # Reset — download failed

    # ── Tier 2: Scrape og:image from event URL ──
    if "2" in tiers:
        print(" → T2", end="", flush=True)
        image_url = tier2_scrape_og_image(raw)
        if image_url:
            img_data = download_image(image_url)
            if img_data:
                cached_url = upload_to_supabase(event_id, img_data)
                if cached_url:
                    update_event_photo(event_id, cached_url, raw, full_raw)
                    print(f" ✓ og:image")
                    return "scraped"
            image_url = None

    # ── Tier 3: Generate with Gemini ──
    if "3" in tiers:
        print(" → T3", end="", flush=True)
        local_path = tier3_generate_image(raw, event_id)
        if local_path:
            cached_url = upload_local_file(event_id, local_path)
            if cached_url:
                update_event_photo(event_id, cached_url, raw, full_raw)
                print(f" ✓ generated")
                # Clean up temp file
                try: os.unlink(local_path)
                except: pass
                return "generated"

    print(f" ✗ no photo found")
    return "failed"


def main():
    parser = argparse.ArgumentParser(description="ABQ Unplugged Event Photo Enrichment")
    parser.add_argument("--stats", action="store_true", help="Show stats only")
    parser.add_argument("--source", type=str, help="Filter by source (seatgeek, local, volunteer, eventbrite, ticketmaster)")
    parser.add_argument("--limit", type=int, default=0, help="Max events to process")
    parser.add_argument("--tier", type=str, default="123", help="Which tiers to run: 1, 12, 123 (default: 123)")
    parser.add_argument("--reset", action="store_true", help="Reset progress file")
    parser.add_argument("--cache-existing", action="store_true", help="Also cache events that have image URLs but no cached copy")
    args = parser.parse_args()

    if args.reset:
        if PROGRESS_FILE.exists():
            PROGRESS_FILE.unlink()
        print("Progress reset.")
        return

    # Source filter mapping
    source_map = {
        "sg": "seatgeek", "seatgeek": "seatgeek",
        "tm": "ticketmaster", "ticketmaster": "ticketmaster",
        "eb": "eventbrite", "eventbrite": "eventbrite",
        "local": "local",
        "vol": "volunteer", "volunteer": "volunteer",
    }
    source_filter = source_map.get(args.source) if args.source else None

    events = fetch_events_missing_photos(source_filter)

    # Separate events by need type
    needs_full = [e for e in events if e.get("_needs") == "full"]
    needs_cache = [e for e in events if e.get("_needs") == "cache"]

    # Count by source
    by_source = {}
    for e in needs_full:
        s = e["source"]
        by_source[s] = by_source.get(s, 0) + 1

    print(f"\n📊 Events needing photos: {len(needs_full)}")
    for s, c in sorted(by_source.items(), key=lambda x: -x[1]):
        print(f"   {s}: {c}")
    print(f"   Events with URLs but no cache: {len(needs_cache)}")

    if args.stats:
        return

    # Decide what to process
    to_process = needs_full.copy()
    if args.cache_existing:
        to_process += needs_cache

    if not to_process:
        print("\n✅ All events have photos!")
        return

    if args.limit:
        to_process = to_process[:args.limit]

    print(f"\n🔄 Processing {len(to_process)} events (tiers: {args.tier})...\n")

    progress = load_progress()
    done_set = set(progress.get("done", []))

    stats = {"done": 0, "scraped": 0, "generated": 0, "failed": 0, "skipped": 0}

    for i, row in enumerate(to_process):
        eid = row["id"]
        if eid in done_set:
            stats["skipped"] += 1
            continue

        print(f"[{i+1}/{len(to_process)}]", end="")
        result = process_event(row, tiers=args.tier, progress=progress)

        stats[result] = stats.get(result, 0) + 1

        if result in ("done", "scraped", "generated"):
            progress.setdefault("done", []).append(eid)
            if result == "scraped":
                progress.setdefault("scraped", []).append(eid)
            elif result == "generated":
                progress.setdefault("generated", []).append(eid)
        else:
            progress.setdefault("failed", []).append(eid)

        # Save progress periodically
        if (i + 1) % 10 == 0:
            save_progress(progress)

        time.sleep(DELAY_SECONDS)

    save_progress(progress)

    print(f"\n{'='*60}")
    print(f"📊 Results:")
    print(f"   Cached existing:  {stats['done']}")
    print(f"   Scraped (T1/T2):  {stats['scraped']}")
    print(f"   Generated (T3):   {stats['generated']}")
    print(f"   Failed:           {stats['failed']}")
    print(f"   Skipped (prior):  {stats['skipped']}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
