#!/usr/bin/env python3
"""
ABQ Unplugged — Generate Event Images via Gemini
=================================================
For events missing photos, uses Gemini to generate relevant event artwork.
Saves images to public/images/events/ and updates the event data.

Usage:
  python3 scripts/generate-event-images.py
  python3 scripts/generate-event-images.py --dry-run
"""

import json, os, sys, subprocess, time, re, hashlib

GEMINI_BIN = '/opt/homebrew/bin/gemini'
IMAGES_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'events')
EVENTS_TS  = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'events.ts')
LOCAL_JSON = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'local-events.json')

DRY_RUN = '--dry-run' in sys.argv

os.makedirs(IMAGES_DIR, exist_ok=True)

# Category to visual style mapping
CATEGORY_STYLES = {
    'Live Music': 'concert stage with dramatic lighting, musical instruments, crowd energy',
    'Festival': 'outdoor festival scene with colorful tents, crowd, festive atmosphere in the desert Southwest',
    'Arts & Culture': 'vibrant art gallery or cultural exhibition with Southwest artistic elements',
    'Food & Drink': 'artisanal food and drink scene, New Mexico cuisine, warm restaurant ambiance',
    'Community': 'community gathering, diverse people, outdoor public space in Albuquerque',
    'Sports': 'athletic event, stadium energy, competitive sports action',
    'Theater & Comedy': 'theater stage with dramatic spotlight, performance arts',
    'Outdoors': 'scenic outdoor New Mexico landscape, Sandia Mountains, hiking trails',
    'Family': 'family-friendly outdoor activity, children playing, colorful and welcoming',
    'Nightlife': 'upscale nightlife scene, city lights, Albuquerque downtown at night',
    'Health & Wellness': 'serene wellness scene, yoga or meditation, natural New Mexico setting',
    'Film': 'cinema or film screening, movie theater ambiance with dramatic lighting',
    'Farmers Market': 'fresh produce market, colorful fruits and vegetables, outdoor stalls',
}
DEFAULT_STYLE = 'vibrant event scene in Albuquerque, New Mexico with Southwest architectural elements'


def slug(name):
    """Generate a filesystem-safe slug from event name."""
    s = re.sub(r'[^a-zA-Z0-9\s-]', '', name.lower())
    s = re.sub(r'\s+', '-', s.strip())
    return s[:60]


def generate_image(event_name, category, location, event_id):
    """Use Gemini to generate an event image. Returns the local file path or None."""
    safe_slug = slug(event_name) or hashlib.md5(event_id.encode()).hexdigest()[:12]
    out_path = os.path.join(IMAGES_DIR, f"{safe_slug}.webp")
    
    # Skip if already generated
    if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
        print(f"  ✓ Already exists: {safe_slug}.webp")
        return f"/images/events/{safe_slug}.webp"
    
    style = CATEGORY_STYLES.get(category, DEFAULT_STYLE)
    
    prompt = f"""Generate a high-quality, visually striking event promotional image.

Event: "{event_name}"
Location: {location or 'Albuquerque, NM'}
Category: {category}

Create a photorealistic or artistic promotional image that:
1. Visually represents this specific event - not a generic stock photo
2. Includes the event name "{event_name}" as stylish text overlay
3. Uses a style that matches: {style}
4. Has an Albuquerque/New Mexico Southwest feel (desert colors, adobe, mountain silhouettes)
5. Is sized for a mobile card (16:9 aspect ratio)
6. Has rich, vibrant colors that look great as a card thumbnail

Save the image to: {out_path}
Only output the file path, nothing else."""

    if DRY_RUN:
        print(f"  [DRY RUN] Would generate: {safe_slug}.webp")
        return None
    
    try:
        result = subprocess.run(
            [GEMINI_BIN, '-m', 'gemini-2.0-flash', '-p', prompt],
            capture_output=True, text=True, timeout=60,
            cwd=os.path.dirname(IMAGES_DIR)
        )
        
        # Check if image was created
        if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
            print(f"  ✓ Generated: {safe_slug}.webp ({os.path.getsize(out_path)} bytes)")
            return f"/images/events/{safe_slug}.webp"
        else:
            # Gemini might have saved it somewhere else or with different name
            # Check for any new files
            print(f"  ✗ Image not found at expected path: {out_path}")
            if result.stdout:
                print(f"    Gemini output: {result.stdout[:200]}")
            return None
    except subprocess.TimeoutExpired:
        print(f"  ✗ Timeout generating image for: {event_name}")
        return None
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return None


def main():
    # Load events needing images
    with open('/tmp/all_events_need_images.json') as f:
        needs_images = json.load(f)
    
    # Deduplicate by name (many ABQ Artwalks etc.)
    seen_names = set()
    unique_events = []
    for e in needs_images:
        name = e.get('name', '').strip()
        if name and name not in seen_names:
            seen_names.add(name)
            unique_events.append(e)
    
    print(f"Events needing images: {len(needs_images)} ({len(unique_events)} unique)")
    print(f"Mode: {'DRY RUN' if DRY_RUN else 'GENERATING'}")
    print()
    
    generated = {}  # name -> path
    
    for i, event in enumerate(unique_events):
        name = event.get('name', 'Unknown Event')
        category = event.get('category', '')
        location = event.get('location', 'Albuquerque, NM')
        ev_id = event.get('id', str(i))
        
        print(f"[{i+1}/{len(unique_events)}] {name}")
        
        path = generate_image(name, category, location, ev_id)
        if path:
            generated[name] = path
        
        if not DRY_RUN:
            time.sleep(2)  # Rate limit
    
    print(f"\n{'='*60}")
    print(f"Generated {len(generated)} images")
    
    if not DRY_RUN and generated:
        # Update events.ts with new image paths
        update_events_ts(generated)
        # Update local-events.json with new image paths
        update_local_json(generated)


def update_events_ts(generated):
    """Update static events.ts file with generated image paths."""
    with open(EVENTS_TS) as f:
        content = f.read()
    
    updated = 0
    for name, path in generated.items():
        # Find events with this title that have empty/missing images
        # Pattern: title: "Name",\n...image: "",
        pattern = re.compile(
            r'(title:\s*["\']' + re.escape(name) + r'["\'].*?image:\s*["\'])(["\']\s*,)',
            re.DOTALL
        )
        new_content = pattern.sub(r'\g<1>' + path + r'\2', content)
        if new_content != content:
            content = new_content
            updated += 1
    
    with open(EVENTS_TS, 'w') as f:
        f.write(content)
    print(f"Updated {updated} entries in events.ts")


def update_local_json(generated):
    """Update local-events.json with generated image paths."""
    with open(LOCAL_JSON) as f:
        events = json.load(f)
    
    updated = 0
    for event in events:
        name = event.get('name', '')
        if name in generated:
            imgs = event.get('images') or []
            if not imgs or not (imgs[0].get('url') if imgs else None):
                event['images'] = [{'url': generated[name], 'width': 640, 'height': 360}]
                updated += 1
    
    with open(LOCAL_JSON, 'w') as f:
        json.dump(events, f, ensure_ascii=False)
    print(f"Updated {updated} entries in local-events.json")


if __name__ == '__main__':
    main()
