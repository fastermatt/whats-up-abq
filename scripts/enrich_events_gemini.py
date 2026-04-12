#!/usr/bin/env python3
"""
Gemini-powered event enrichment for ABQ Unplugged.
Adds local tips, venue info, and expert advice to events WITHOUT changing dates/times.

Usage:
  python3 scripts/enrich_events_gemini.py [--batch-size 10] [--dry-run] [--max-events 50]

Reads: public/data/local-events.json, public/data/ticketmaster-events.json
Writes: enriched data back into the same files (preserving all existing fields)

SAFETY: dates, times, names, URLs, IDs are NEVER modified.
"""

import json
import subprocess
import sys
import os
import time
import argparse
import re
import urllib.parse
from pathlib import Path
from copy import deepcopy

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data"

EVENT_FILES = [
    DATA_DIR / "local-events.json",
    DATA_DIR / "ticketmaster-events.json",
]

GEMINI_PATH = "/opt/homebrew/bin/gemini"

ENRICHMENT_PROMPT = """You are a local Albuquerque, New Mexico events expert. Enrich each event with helpful local context.

For EACH event, return a JSON object with "id" and "_aiEnrichment" containing:
- "about": 1-2 factual sentences describing the artist/event/show for someone unfamiliar
- "highlights": array of 2-3 short bullet points — what to expect, interesting facts
- "venue_tips": 1-2 sentences about this specific ABQ venue — parking, arrival tips, seating, food/drink
- "local_tips": 1-2 sentences — nearby restaurants, pre/post-show spots in that ABQ neighborhood (Nob Hill, Downtown, Old Town, EDo, UNM area, etc.)

RULES:
1. NEVER include dates, times, or prices in your response
2. Be FACTUAL — only state things you're confident about
3. Keep concise — this is for a mobile app
4. Reference actual ABQ neighborhoods, streets, restaurants when possible
5. If unsure about an artist, give a brief genre-appropriate description
6. Return ONLY a JSON array — no markdown, no explanation

EVENTS:
"""


def load_events(filepath):
    if not filepath.exists():
        return [], None
    with open(filepath) as f:
        data = json.load(f)
    if isinstance(data, list):
        return data, data
    if isinstance(data, dict) and "events" in data:
        return data["events"], data
    return [], data


def save_events(filepath, events, original_structure):
    if isinstance(original_structure, dict) and "events" in original_structure:
        original_structure["events"] = events
        out = original_structure
    else:
        out = events
    with open(filepath, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)


def needs_enrichment(event):
    enr = event.get("_aiEnrichment")
    if not enr:
        return True
    if not enr.get("about") and not enr.get("local_tips"):
        return True
    return False


def slim_event(event):
    """Create a minimal version of the event for the Gemini prompt (save tokens)."""
    venue = None
    venues = event.get("_embedded", {}).get("venues", [])
    if venues:
        v = venues[0]
        venue = {
            "name": v.get("name"),
            "address": v.get("address", {}).get("line1"),
            "city": v.get("city", {}).get("name"),
        }
    return {
        "id": event["id"],
        "name": event.get("name", ""),
        "category": (event.get("classifications", [{}])[0]
                     .get("segment", {}).get("name", "Event")),
        "venue": venue,
        "info": (event.get("info") or "")[:200],
    }


def call_gemini(prompt_text, timeout=120):
    """Call Gemini CLI with a prompt and return the response text."""
    try:
        result = subprocess.run(
            [GEMINI_PATH, "--yolo", "-p", prompt_text],
            capture_output=True, text=True, timeout=timeout,
            cwd=str(PROJECT_ROOT)
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        print("  [warn] Gemini timed out")
        return None
    except Exception as e:
        print(f"  [error] Gemini call failed: {e}")
        return None


def parse_json_response(text):
    """Extract JSON array from Gemini response (may include markdown fences)."""
    if not text:
        return []
    # Strip markdown code fences
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return [data]
    except json.JSONDecodeError:
        # Try to find array in the text
        match = re.search(r"\[[\s\S]*\]", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    print(f"  [warn] Could not parse Gemini response ({len(text)} chars)")
    return []


def validate_enrichment(enrichment):
    """Validate an enrichment object has the right shape."""
    if not isinstance(enrichment, dict):
        return False
    if "id" not in enrichment or "_aiEnrichment" not in enrichment:
        return False
    ai = enrichment["_aiEnrichment"]
    if not isinstance(ai, dict):
        return False
    # Must have at least about or local_tips
    if not ai.get("about") and not ai.get("local_tips"):
        return False
    return True


def enrich_batch(events_batch, dry_run=False):
    """Enrich a batch of events using Gemini."""
    slim = [slim_event(e) for e in events_batch]
    prompt = ENRICHMENT_PROMPT + json.dumps(slim, indent=1, ensure_ascii=False)

    if dry_run:
        print(f"  [dry-run] Would send {len(slim)} events to Gemini")
        print(f"  [dry-run] Prompt length: {len(prompt)} chars")
        return {}

    print(f"  Calling Gemini for {len(slim)} events...")
    response = call_gemini(prompt)
    results = parse_json_response(response)

    enrichments = {}
    for r in results:
        if validate_enrichment(r):
            enrichments[r["id"]] = r["_aiEnrichment"]
        else:
            print(f"  [skip] Invalid enrichment for id={r.get('id', '?')}")

    print(f"  Got {len(enrichments)} valid enrichments from Gemini")
    return enrichments


def apply_enrichments(events, enrichments):
    """Apply enrichments to events WITHOUT modifying frozen fields."""
    applied = 0
    for event in events:
        eid = event.get("id")
        if eid in enrichments:
            # Deep copy the event's dates before applying anything
            frozen_snapshot = {
                "id": event.get("id"),
                "name": event.get("name"),
                "url": event.get("url"),
                "dates": deepcopy(event.get("dates")),
                "images": event.get("images"),
                "ticketLinks": event.get("ticketLinks"),
                "isFree": event.get("isFree"),
                "priceRanges": event.get("priceRanges"),
            }

            # Apply enrichment
            event["_aiEnrichment"] = enrichments[eid]

            # SAFETY: verify frozen fields weren't touched
            for key, val in frozen_snapshot.items():
                if event.get(key) != val:
                    print(f"  [SAFETY] Restoring frozen field '{key}' for {eid}")
                    event[key] = val

            applied += 1
    return applied


def main():
    parser = argparse.ArgumentParser(description="Enrich ABQ events with Gemini AI")
    parser.add_argument("--batch-size", type=int, default=8,
                        help="Events per Gemini call (default: 8)")
    parser.add_argument("--max-events", type=int, default=0,
                        help="Max events to enrich per run (0=all)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would happen without calling Gemini")
    parser.add_argument("--file", type=str, default="",
                        help="Only process this specific file")
    parser.add_argument("--delay", type=float, default=2.0,
                        help="Seconds between Gemini calls (rate limit)")
    args = parser.parse_args()

    # Check Gemini is available
    if not args.dry_run and not os.path.exists(GEMINI_PATH):
        print(f"[error] Gemini CLI not found at {GEMINI_PATH}")
        sys.exit(1)

    files_to_process = EVENT_FILES
    if args.file:
        files_to_process = [DATA_DIR / args.file]

    total_enriched = 0

    for filepath in files_to_process:
        print(f"\n{'='*60}")
        print(f"Processing: {filepath.name}")
        print(f"{'='*60}")

        events, original_structure = load_events(filepath)
        if not events:
            print(f"  [skip] No events in {filepath.name}")
            continue

        # Filter to events needing enrichment
        to_enrich = [e for e in events if needs_enrichment(e)]
        if args.max_events > 0:
            to_enrich = to_enrich[:args.max_events]

        already = len(events) - len([e for e in events if needs_enrichment(e)])
        print(f"  Total events: {len(events)}")
        print(f"  Already enriched: {already}")
        print(f"  To enrich: {len(to_enrich)}")

        if not to_enrich:
            print("  [done] All events already enriched!")
            continue

        # Process in batches
        all_enrichments = {}
        for i in range(0, len(to_enrich), args.batch_size):
            batch = to_enrich[i:i + args.batch_size]
            batch_num = (i // args.batch_size) + 1
            total_batches = (len(to_enrich) + args.batch_size - 1) // args.batch_size
            print(f"\n  Batch {batch_num}/{total_batches} ({len(batch)} events)")

            enrichments = enrich_batch(batch, dry_run=args.dry_run)
            all_enrichments.update(enrichments)

            # Rate limit between calls
            if i + args.batch_size < len(to_enrich) and not args.dry_run:
                time.sleep(args.delay)

        if not args.dry_run and all_enrichments:
            applied = apply_enrichments(events, all_enrichments)
            save_events(filepath, events, original_structure)
            print(f"\n  Applied {applied} enrichments to {filepath.name}")
            total_enriched += applied

    print(f"\n{'='*60}")
    print(f"DONE — Enriched {total_enriched} events total")
    if args.dry_run:
        print("(Dry run — no files were modified)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
