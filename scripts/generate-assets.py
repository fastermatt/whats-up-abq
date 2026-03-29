#!/usr/bin/env python3
"""
ABQ Unplugged — Urban Curator PWA Asset Generator
Generates: OG image, app icons, apple-touch icons, iOS splash screens
Run: python3 scripts/generate-assets.py (from repo root)
"""

import os, math
from PIL import Image, ImageDraw, ImageFont

# ── Paths ──────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
ICONS_DIR = os.path.join(PUBLIC, 'icons')
SPLASH_DIR = os.path.join(PUBLIC, 'splash')
os.makedirs(ICONS_DIR, exist_ok=True)
os.makedirs(SPLASH_DIR, exist_ok=True)

# ── Urban Curator Palette ─────────────────────────────────────────
BG           = (248, 250, 248)   # #F8FAF8  Gallery White
DARK         = (26, 26, 26)      # #1A1A1A  near-black
OLIVE        = (86, 101, 0)      # #566500  Neon Moss dark
MOSS         = (212, 239, 77)    # #D4EF4D  Neon Moss bright
ELECTRIC     = (0, 87, 194)      # #0057c2  Deep Electric
MID_GRAY     = (120, 128, 120)   # muted text
LIGHT_GRAY   = (216, 224, 216)   # border

# ── Fonts ─────────────────────────────────────────────────────────
FONT_BASE = '/System/Library/Fonts/Avenir Next.ttc'
FONT_MONO = '/System/Library/Fonts/Menlo.ttc'

def load_font(size, bold=False):
    try:
        # TTC index: 0=Regular, 1=Italic, 2=Medium, 3=MediumItalic,
        # 4=DemiBold, 5=DemiBoldItalic, 6=Bold, 7=BoldItalic, 8=Heavy, 9=HeavyItalic
        idx = 8 if bold else 0
        return ImageFont.truetype(FONT_BASE, size, index=idx)
    except Exception:
        return ImageFont.load_default()

# ── Zia Sun Symbol ────────────────────────────────────────────────
def draw_zia(draw, cx, cy, r, color, line_width_ratio=0.045):
    """Draw a simplified Zia sun: central circle + 4×4 rays."""
    inner_r = r * 0.22         # central circle radius
    ray_start = r * 0.28       # where rays begin (just outside circle)
    ray_end   = r              # where rays end
    gap       = 10             # degrees between rays within a group
    lw = max(2, int(r * line_width_ratio))

    # Central filled circle
    draw.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        fill=color
    )

    # 4 groups of 4 rays at cardinal directions
    for group_angle in [0, 90, 180, 270]:
        for ray_offset in [-1.5*gap, -0.5*gap, 0.5*gap, 1.5*gap]:
            angle_deg = group_angle + ray_offset
            angle_rad = math.radians(angle_deg - 90)  # -90 so 0° = up
            x1 = cx + ray_start * math.cos(angle_rad)
            y1 = cy + ray_start * math.sin(angle_rad)
            x2 = cx + ray_end   * math.cos(angle_rad)
            y2 = cy + ray_end   * math.sin(angle_rad)
            draw.line([x1, y1, x2, y2], fill=color, width=lw)

    # Outer ring (thin)
    ring_r = r * 1.05
    draw.arc(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        0, 360, fill=color, width=max(1, lw // 2)
    )

def draw_dot_texture(draw, width, height, step=20, dot_r=1.0, color=(184, 200, 160), alpha_layer=None):
    """Draw the Urban Curator dot grid pattern."""
    for x in range(0, width + step, step):
        for y in range(0, height + step, step):
            draw.ellipse([x - dot_r, y - dot_r, x + dot_r, y + dot_r], fill=color)

# ═══════════════════════════════════════════════════════════════════
# ICONS
# ═══════════════════════════════════════════════════════════════════

def make_icon(size, maskable=False):
    """Dark olive background, neon moss Zia, white ABQ text."""
    padding = int(size * 0.12) if maskable else 0
    img = Image.new('RGB', (size, size), OLIVE)
    draw = ImageDraw.Draw(img)

    # Subtle dot texture
    dot_color = tuple(min(255, c + 18) for c in OLIVE)
    draw_dot_texture(draw, size, size, step=max(8, size // 24), dot_r=0.8, color=dot_color)

    cx, cy = size // 2, size // 2
    zia_r = size * 0.32 - padding

    # Shadow / depth (offset Zia)
    shadow_color = tuple(max(0, c - 20) for c in OLIVE)
    draw_zia(draw, cx + 2, cy + 2, zia_r, shadow_color)
    # Main Zia in neon moss
    draw_zia(draw, cx, cy, zia_r, MOSS)

    # "ABQ" text for 192+ sizes
    if size >= 192:
        font_size = max(18, size // 7)
        font = load_font(font_size, bold=True)
        text = "ABQ"
        bbox = font.getbbox(text)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        ty = cy + zia_r + size * 0.04
        draw.text((cx - tw // 2, ty), text, fill=MOSS, font=font)

    return img

for sz in [180, 167, 152]:
    img = make_icon(sz)
    img.save(os.path.join(PUBLIC, f'apple-touch-icon-{sz}.png'))
    print(f'  ✓ apple-touch-icon-{sz}.png')

for sz in [192, 512]:
    img = make_icon(sz)
    img.save(os.path.join(ICONS_DIR, f'icon-{sz}.png'))
    print(f'  ✓ icons/icon-{sz}.png')

mask = make_icon(512, maskable=True)
mask.save(os.path.join(ICONS_DIR, 'icon-maskable-512.png'))
print('  ✓ icons/icon-maskable-512.png')

# ═══════════════════════════════════════════════════════════════════
# SPLASH SCREENS
# ═══════════════════════════════════════════════════════════════════

SPLASH_SIZES = [
    (1179, 2556),   # iPhone 15/16 Pro
    (1170, 2532),   # iPhone 14/15
    (750,  1334),   # iPhone 8
    (1290, 2796),   # iPhone 15/16 Plus/Max
    (1284, 2778),   # iPhone 12/13 Pro Max
    (1488, 2266),   # iPad Mini
    (1620, 2160),   # iPad Air
    (2048, 2732),   # iPad Pro 12.9"
]

def make_splash(w, h):
    img = Image.new('RGB', (w, h), BG)
    draw = ImageDraw.Draw(img)

    # Dot texture (every 24px)
    step = max(16, w // 55)
    draw_dot_texture(draw, w, h, step=step, dot_r=1.0, color=(184, 200, 160))

    cx = w // 2

    # Vertical layout: zia at 38% height, text below
    zia_cy = int(h * 0.40)
    zia_r  = min(w, h) * 0.18

    # Thin accent ring behind zia
    ring_r = zia_r * 1.35
    draw.ellipse(
        [cx - ring_r, zia_cy - ring_r, cx + ring_r, zia_cy + ring_r],
        outline=LIGHT_GRAY, width=2
    )

    # Zia symbol
    draw_zia(draw, cx, zia_cy, zia_r, OLIVE, line_width_ratio=0.048)

    # Neon moss dot at center of Zia
    dot_r = zia_r * 0.12
    draw.ellipse(
        [cx - dot_r, zia_cy - dot_r, cx + dot_r, zia_cy + dot_r],
        fill=MOSS
    )

    # "ABQ UNPLUGGED" headline
    font_h1_size = max(32, int(w * 0.075))
    font_h1 = load_font(font_h1_size, bold=True)
    h1_text = "ABQ UNPLUGGED"
    h1_bbox = font_h1.getbbox(h1_text)
    h1_w = h1_bbox[2] - h1_bbox[0]
    h1_y = zia_cy + zia_r + int(h * 0.055)
    draw.text((cx - h1_w // 2, h1_y), h1_text, fill=DARK, font=font_h1)

    # Neon moss underline accent bar
    bar_y = h1_y + font_h1_size + 6
    bar_w = min(h1_w, int(w * 0.30))
    bar_h_px = max(3, int(font_h1_size * 0.12))
    draw.rectangle(
        [cx - bar_w // 2, bar_y, cx + bar_w // 2, bar_y + bar_h_px],
        fill=MOSS
    )

    # Tagline
    font_sub_size = max(18, int(w * 0.035))
    font_sub = load_font(font_sub_size, bold=False)
    sub_text = "Events  ·  Places  ·  Culture in Albuquerque"
    sub_bbox = font_sub.getbbox(sub_text)
    sub_w = sub_bbox[2] - sub_bbox[0]
    sub_y = bar_y + bar_h_px + int(h * 0.025)
    draw.text((cx - sub_w // 2, sub_y), sub_text, fill=MID_GRAY, font=font_sub)

    # Bottom olive strip with URL
    strip_h = max(48, int(h * 0.06))
    draw.rectangle([0, h - strip_h, w, h], fill=OLIVE)
    font_url_size = max(14, int(w * 0.025))
    font_url = load_font(font_url_size, bold=False)
    url_text = "explore-abq.netlify.app"
    url_bbox = font_url.getbbox(url_text)
    url_w = url_bbox[2] - url_bbox[0]
    url_y = h - strip_h + (strip_h - font_url_size) // 2
    draw.text((cx - url_w // 2, url_y), url_text, fill=MOSS, font=font_url)

    return img

for w, h in SPLASH_SIZES:
    img = make_splash(w, h)
    fname = f'splash-{w}x{h}.png'
    img.save(os.path.join(SPLASH_DIR, fname))
    print(f'  ✓ splash/{fname}')

# ═══════════════════════════════════════════════════════════════════
# OG IMAGE  1200 × 630
# ═══════════════════════════════════════════════════════════════════

def make_og():
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)

    # Dot texture
    draw_dot_texture(draw, W, H, step=20, dot_r=1.0, color=(180, 196, 156))

    # Left column — olive panel
    panel_w = 420
    draw.rectangle([0, 0, panel_w, H], fill=OLIVE)

    # Dot texture on panel too (darker)
    dot_dark = tuple(max(0, c - 10) for c in OLIVE)
    for x in range(0, panel_w + 20, 20):
        for y in range(0, H + 20, 20):
            draw.ellipse([x-1, y-1, x+1, y+1], fill=dot_dark)

    # Zia on left panel
    zia_cx = panel_w // 2
    zia_cy = H // 2 - 20
    zia_r  = 130
    draw_zia(draw, zia_cx, zia_cy, zia_r, MOSS, line_width_ratio=0.038)

    # Small "ABQ" label below Zia on panel
    font_abq = load_font(28, bold=True)
    abq_text = "ABQ"
    abq_bbox = font_abq.getbbox(abq_text)
    abq_w = abq_bbox[2] - abq_bbox[0]
    draw.text((zia_cx - abq_w // 2, zia_cy + zia_r + 22), abq_text, fill=MOSS, font=font_abq)

    # Right column content
    rx = panel_w + 56  # right content left edge
    rw = W - panel_w   # right column width

    # Tag: "DISCOVER · EXPLORE · CONNECT"
    font_tag = load_font(18, bold=True)
    tag_text = "DISCOVER  ·  EXPLORE  ·  CONNECT"
    draw.text((rx, 80), tag_text, fill=MID_GRAY, font=font_tag)

    # Main headline
    font_h1 = load_font(72, bold=True)
    draw.text((rx, 118), "ABQ", fill=DARK, font=font_h1)
    draw.text((rx, 192), "Unplugged", fill=OLIVE, font=font_h1)

    # Neon moss accent bar
    bar_w = 260
    draw.rectangle([rx, 278, rx + bar_w, 284], fill=MOSS)

    # Body text
    font_body = load_font(28, bold=False)
    draw.text((rx, 300), "Events, places & culture in", fill=DARK, font=font_body)
    draw.text((rx, 336), "Albuquerque — free, forever.", fill=DARK, font=font_body)

    # Stats row
    font_stat_num = load_font(36, bold=True)
    font_stat_lbl = load_font(16, bold=False)
    stats = [("490+", "Events"), ("4,500+", "Places"), ("Free", "Always")]
    sx = rx
    for num, lbl in stats:
        draw.text((sx, 408), num, fill=OLIVE, font=font_stat_num)
        num_bbox = font_stat_num.getbbox(num)
        draw.text((sx, 450), lbl, fill=MID_GRAY, font=font_stat_lbl)
        sx += 210

    # URL footer
    font_url = load_font(22, bold=False)
    url_text = "explore-abq.netlify.app"
    draw.text((rx, 548), url_text, fill=ELECTRIC, font=font_url)

    # Hard shadow on left panel edge (Urban Curator signature)
    draw.line([panel_w, 0, panel_w, H], fill=DARK, width=3)
    draw.line([panel_w + 4, 4, panel_w + 4, H + 4], fill=(200, 200, 200), width=1)

    return img

og = make_og()
og.save(os.path.join(PUBLIC, 'og-image.jpg'), quality=92)
print('  ✓ og-image.jpg')

print('\n✅ All assets generated successfully!')
