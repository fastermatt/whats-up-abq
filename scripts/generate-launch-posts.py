#!/usr/bin/env python3
"""
Generate a series of Instagram portrait posts (1080×1350) for the
ABQ Unplugged launch campaign.

Matches the 10 captions in LAUNCH-PLAYBOOK.md. Respects IG portrait
safe zones:
  - Top 8% and bottom 14% of the frame may be obscured by UI on some
    surfaces (e.g. when reshared to Stories), so keep critical type
    inside the 78% center band.
  - Horizontal safe zone: 5% padding on each side.

Brand palette:
  cream     #fbf7f1
  terra     #9a442d  (primary accent)
  sage      #4f6249
  turquoise #006a62
  ink       #1a1614

Output: /Users/matt/Desktop/ABQ Unplugged/Launch Posts/*.png
"""

import os
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ── Paths ────────────────────────────────────────────────────────────────────
REPO   = Path("/Users/matt/Documents/ClaudeObsidian/Projects/ABQ Unplugged v2/repo")
PUBLIC = REPO / "v2" / "public"
OUT    = Path.home() / "Desktop" / "ABQ Unplugged" / "Launch Posts"
OUT.mkdir(parents=True, exist_ok=True)

# ── Colors ───────────────────────────────────────────────────────────────────
CREAM     = (251, 247, 241)
TERRA     = (154, 68, 45)
TERRA_DK  = (125, 55, 37)
SAGE      = (79, 98, 73)
TURQ      = (0, 106, 98)
INK       = (26, 22, 20)
WARM      = (240, 228, 204)  # light cream-gold
MUTED     = (138, 122, 116)

# ── Canvas ───────────────────────────────────────────────────────────────────
W, H = 1080, 1350
SAFE_TOP    = int(H * 0.08)
SAFE_BOTTOM = int(H * 0.86)  # = 100% - 14%
SAFE_LEFT   = int(W * 0.05)
SAFE_RIGHT  = int(W * 0.95)

# ── Fonts (fall back gracefully) ─────────────────────────────────────────────
FONT_DIRS = ["/System/Library/Fonts/Supplemental", "/System/Library/Fonts"]

def pick_font(candidates, size):
    for name in candidates:
        for d in FONT_DIRS:
            path = os.path.join(d, name)
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except OSError:
                    pass
    return ImageFont.load_default()

def F_HEADLINE(size): return pick_font(["Futura.ttc", "HelveticaNeue.ttc", "Helvetica.ttc"], size)
def F_SERIF(size):    return pick_font(["Georgia Bold.ttf", "Georgia.ttf", "Didot.ttc"], size)
def F_BODY(size):     return pick_font(["HelveticaNeue.ttc", "Helvetica.ttc"], size)
def F_MONO(size):     return pick_font(["Courier.ttc", "HelveticaNeue.ttc"], size)

# ── Drawing helpers ──────────────────────────────────────────────────────────

def new_canvas(bg=CREAM):
    return Image.new("RGB", (W, H), bg)

def draw_grain(img, intensity=0.04):
    """Subtle grain to prevent the flat-Canva look."""
    import random
    noise = Image.new("L", (W // 2, H // 2))
    px = noise.load()
    for y in range(noise.size[1]):
        for x in range(noise.size[0]):
            px[x, y] = int(random.random() * 255)
    noise = noise.resize((W, H), Image.NEAREST).filter(ImageFilter.GaussianBlur(0.5))
    grain = Image.new("RGB", (W, H), (128, 128, 128))
    return Image.blend(img, Image.merge("RGB", (noise, noise, noise)), intensity)

def text_wh(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def draw_center_text(draw, y, text, font, fill=INK):
    tw, _ = text_wh(draw, text, font)
    draw.text(((W - tw) // 2, y), text, font=font, fill=fill)
    return y + text_wh(draw, text, font)[1]

def draw_wrapped(draw, text, font, fill, x, y, max_w, line_spacing=1.2, align="center"):
    """Wrap text and draw line by line. Returns y after the block."""
    # naive wrap by measuring words
    words = text.split(" ")
    lines = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        tw, _ = text_wh(draw, trial, font)
        if tw <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    _, lh = text_wh(draw, "Ag", font)
    line_h = int(lh * line_spacing)
    for i, line in enumerate(lines):
        tw, _ = text_wh(draw, line, font)
        if align == "center":
            lx = x + (max_w - tw) // 2
        elif align == "right":
            lx = x + max_w - tw
        else:
            lx = x
        draw.text((lx, y + i * line_h), line, font=font, fill=fill)
    return y + len(lines) * line_h

def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def load_hero(n):
    p = PUBLIC / "hero" / f"hero-{n}.png"
    if not p.exists():
        return None
    return Image.open(p).convert("RGB")

def place_hero(img, hero, box, darken=0.35):
    """Crop hero to the target box aspect, paste darkened."""
    x, y, x2, y2 = box
    bw, bh = x2 - x, y2 - y
    src_w, src_h = hero.size
    target_aspect = bw / bh
    src_aspect = src_w / src_h
    if src_aspect > target_aspect:
        # src is wider › crop sides
        new_w = int(src_h * target_aspect)
        xs = (src_w - new_w) // 2
        cropped = hero.crop((xs, 0, xs + new_w, src_h))
    else:
        new_h = int(src_w / target_aspect)
        ys = (src_h - new_h) // 2
        cropped = hero.crop((0, ys, src_w, ys + new_h))
    cropped = cropped.resize((bw, bh), Image.LANCZOS)
    # darken overlay for legibility
    overlay = Image.new("RGB", cropped.size, (0, 0, 0))
    cropped = Image.blend(cropped, overlay, darken)
    img.paste(cropped, (x, y))

# ── Design primitives ────────────────────────────────────────────────────────

def draw_brand_bar(draw, y, text="ABQ UNPLUGGED", fill=INK):
    f = F_HEADLINE(28)
    tw, th = text_wh(draw, text, f)
    draw.text(((W - tw) // 2, y), text, font=f, fill=fill, spacing=4)
    # tracking fake via char-by-char
    return y + th

def draw_tagline(draw, y, text, color=MUTED):
    f = F_BODY(22)
    tw, _ = text_wh(draw, text, f)
    draw.text(((W - tw) // 2, y), text, font=f, fill=color)

def draw_cta_pill(img, draw, y, text, bg=TERRA, fg=CREAM):
    f = F_HEADLINE(34)
    tw, th = text_wh(draw, text, f)
    pad_x, pad_y = 44, 22
    box_w = tw + pad_x * 2
    box_h = th + pad_y * 2
    bx = (W - box_w) // 2
    rounded_rect(draw, (bx, y, bx + box_w, y + box_h), radius=box_h // 2, fill=bg)
    draw.text((bx + pad_x, y + pad_y - 2), text, font=f, fill=fg)
    return y + box_h

def draw_rule(draw, y, w=200, color=TERRA, thickness=3):
    x = (W - w) // 2
    draw.rectangle((x, y, x + w, y + thickness), fill=color)

# ── Post templates ──────────────────────────────────────────────────────────

def post_01_launch():
    img = new_canvas(CREAM)
    hero = load_hero(4)
    if hero:
        place_hero(img, hero, (0, int(H * 0.42), W, H), darken=0.50)
    draw = ImageDraw.Draw(img)

    # Top brand bar
    y = SAFE_TOP + 20
    draw.text((SAFE_LEFT, y), "ABQ UNPLUGGED", font=F_HEADLINE(32), fill=INK)
    draw.text((SAFE_LEFT, y + 44), "abqunplugged.com", font=F_BODY(20), fill=MUTED)

    # Huge headline in top half
    y = int(H * 0.17)
    y = draw_wrapped(draw, "Every show.", F_HEADLINE(118), INK, SAFE_LEFT, y,
                     SAFE_RIGHT - SAFE_LEFT, line_spacing=1.0, align="left")
    y = draw_wrapped(draw, "Every gallery night.", F_HEADLINE(86), TERRA, SAFE_LEFT, y + 10,
                     SAFE_RIGHT - SAFE_LEFT, line_spacing=1.0, align="left")
    y = draw_wrapped(draw, "Every First Friday.", F_HEADLINE(86), SAGE, SAFE_LEFT, y + 4,
                     SAFE_RIGHT - SAFE_LEFT, line_spacing=1.0, align="left")

    # Bottom text over hero
    draw.text((SAFE_LEFT, int(H * 0.78)), "One place. Free. No ads.",
              font=F_HEADLINE(40), fill=CREAM)
    draw.text((SAFE_LEFT, int(H * 0.78) + 58), "abqunplugged.com",
              font=F_BODY(32), fill=CREAM)

    img.save(OUT / "01-launch-announcement.png", "PNG", quality=95)

def post_02_tonight():
    img = new_canvas(CREAM)
    draw = ImageDraw.Draw(img)
    # Top bar
    y = SAFE_TOP + 20
    draw.text((SAFE_LEFT, y), "TONIGHT IN BURQUE", font=F_HEADLINE(36), fill=TERRA)
    draw_rule(draw, y + 52, w=120, color=TERRA)
    # Main stack
    y = int(H * 0.15)
    y = draw_wrapped(draw, "Three ways", F_HEADLINE(110), INK, SAFE_LEFT, y,
                     SAFE_RIGHT - SAFE_LEFT, line_spacing=1.0, align="left")
    y = draw_wrapped(draw, "to not stay home.", F_HEADLINE(84), SAGE, SAFE_LEFT, y + 6,
                     SAFE_RIGHT - SAFE_LEFT, line_spacing=1.0, align="left")

    # 3 cards — colored circle dots replace unrenderable emoji
    items = [
        (TERRA, "Comedy at Hyena's",      "7:30 . SE Heights"),
        (SAGE,  "Indie at Launchpad",     "8:00 . Downtown"),
        (TURQ,  "First Friday Artscrawl", "6-9 . Downtown"),
    ]
    cy = int(H * 0.53)
    for color, title, sub in items:
        card_h = 110
        rounded_rect(draw, (SAFE_LEFT, cy, SAFE_RIGHT, cy + card_h),
                     radius=16, fill=WARM)
        # colored dot
        dot_r = 16
        draw.ellipse((SAFE_LEFT + 40, cy + card_h // 2 - dot_r,
                      SAFE_LEFT + 40 + dot_r * 2, cy + card_h // 2 + dot_r),
                     fill=color)
        draw.text((SAFE_LEFT + 110, cy + 22), title, font=F_HEADLINE(34), fill=INK)
        draw.text((SAFE_LEFT + 110, cy + 62), sub, font=F_BODY(22), fill=MUTED)
        cy += card_h + 18

    # Footer (no emoji/arrows)
    draw.text((SAFE_LEFT, int(H * 0.87)), "Link in bio.",
              font=F_BODY(26), fill=TERRA)
    draw.text((SAFE_LEFT, int(H * 0.87) + 36), "abqunplugged.com",
              font=F_HEADLINE(28), fill=INK)

    img.save(OUT / "02-tonight-picks.png", "PNG", quality=95)

def post_03_weekend():
    img = new_canvas(CREAM)
    draw = ImageDraw.Draw(img)
    # Split: top half sage with arts, bottom half cream with outdoor
    # Top
    draw.rectangle((0, 0, W, H // 2), fill=SAGE)
    # Bottom already cream
    # Top label
    draw.text((SAFE_LEFT, SAFE_TOP + 20), "YOUR WEEKEND",
              font=F_HEADLINE(32), fill=CREAM)
    draw.text((SAFE_LEFT, SAFE_TOP + 62), "is handled.",
              font=F_HEADLINE(78), fill=CREAM)
    # Top content
    draw.text((SAFE_LEFT, int(H * 0.22)), "SATURDAY", font=F_HEADLINE(24), fill=WARM)
    draw.text((SAFE_LEFT, int(H * 0.22) + 36),
              "Oil Painting on Yupo", font=F_HEADLINE(50), fill=CREAM)
    draw.text((SAFE_LEFT, int(H * 0.22) + 88),
              "Harwood Art Center · 10am · $45", font=F_BODY(24), fill=WARM)

    # Bottom content
    draw.text((SAFE_LEFT, int(H * 0.58)), "SUNDAY", font=F_HEADLINE(24), fill=TERRA)
    draw.text((SAFE_LEFT, int(H * 0.58) + 36),
              "Embudito Hike", font=F_HEADLINE(58), fill=INK)
    draw.text((SAFE_LEFT, int(H * 0.58) + 102),
              "Sandia foothills · Free · 2 hrs", font=F_BODY(24), fill=MUTED)

    # Footer
    draw.text((SAFE_LEFT, int(H * 0.83)), "One indoors with wine.",
              font=F_SERIF(26), fill=MUTED)
    draw.text((SAFE_LEFT, int(H * 0.83) + 36), "One outdoors with views.",
              font=F_SERIF(26), fill=MUTED)
    draw.text((SAFE_LEFT, int(H * 0.83) + 78), "abqunplugged.com",
              font=F_HEADLINE(28), fill=TERRA)

    img.save(OUT / "03-weekend-preview.png", "PNG", quality=95)

def post_04_hidden_gem():
    img = new_canvas(INK)
    hero = load_hero(2)
    if hero:
        place_hero(img, hero, (0, 0, W, int(H * 0.55)), darken=0.45)
    draw = ImageDraw.Draw(img)

    # Top badge
    badge_text = "HIDDEN GEM"
    f = F_HEADLINE(28)
    tw, th = text_wh(draw, badge_text, f)
    bx = SAFE_LEFT
    by = SAFE_TOP + 20
    rounded_rect(draw, (bx, by, bx + tw + 40, by + th + 20),
                 radius=(th + 20) // 2, fill=TERRA)
    draw.text((bx + 20, by + 9), badge_text, font=f, fill=CREAM)

    # Venue name (big)
    draw.text((SAFE_LEFT, int(H * 0.32)), "Canteen",
              font=F_HEADLINE(120), fill=CREAM)
    draw.text((SAFE_LEFT, int(H * 0.32) + 130), "Brewhouse",
              font=F_HEADLINE(120), fill=CREAM)
    draw.text((SAFE_LEFT, int(H * 0.32) + 260), "2381 Aztec NE",
              font=F_BODY(28), fill=WARM)

    # Body on dark
    y = int(H * 0.60)
    lines = [
        "Free live bluegrass",
        "Wednesdays at 7pm.",
        "No cover. Fire-pit patio.",
        "Dog-friendly.",
    ]
    for i, line in enumerate(lines):
        draw.text((SAFE_LEFT, y + i * 54), line, font=F_SERIF(40), fill=CREAM)

    # Bottom CTA
    draw.text((SAFE_LEFT, int(H * 0.88)), "Saved on the site ›",
              font=F_BODY(26), fill=TERRA)
    draw.text((SAFE_LEFT, int(H * 0.88) + 36), "abqunplugged.com",
              font=F_HEADLINE(28), fill=CREAM)

    img.save(OUT / "04-hidden-gem.png", "PNG", quality=95)

def post_05_preferences():
    img = new_canvas(CREAM)
    draw = ImageDraw.Draw(img)
    # Top
    draw.text((SAFE_LEFT, SAFE_TOP + 20), "TELL US WHAT YOU LOVE",
              font=F_HEADLINE(30), fill=TERRA)
    # Headline
    y = int(H * 0.14)
    y = draw_wrapped(draw, "We'll stop wasting your time.", F_HEADLINE(72), INK,
                     SAFE_LEFT, y, SAFE_RIGHT - SAFE_LEFT, line_spacing=1.05, align="left")

    # Category chips
    categories = [
        ("Music", TERRA), ("Theater", SAGE),
        ("Comedy", TURQ), ("Arts", TERRA_DK),
        ("Sports", SAGE), ("Food", TURQ),
        ("Festivals", TERRA), ("Outdoors", SAGE),
    ]
    cy = int(H * 0.37)
    line_x = SAFE_LEFT
    for label, color in categories:
        f = F_HEADLINE(28)
        tw, th = text_wh(draw, label, f)
        pad = 24
        box_w = tw + pad * 2
        if line_x + box_w > SAFE_RIGHT:
            line_x = SAFE_LEFT
            cy += th + 28
        rounded_rect(draw, (line_x, cy, line_x + box_w, cy + th + 20),
                     radius=(th + 20) // 2, fill=color)
        draw.text((line_x + pad, cy + 8), label, font=f, fill=CREAM)
        line_x += box_w + 14

    # Arrow
    y = int(H * 0.64)
    draw.text((SAFE_LEFT, y), "Pick what matters. We handle the rest.",
              font=F_SERIF(30), fill=INK)

    # CTA
    draw_cta_pill(img, draw, int(H * 0.78), "Set your preferences")
    draw.text((SAFE_LEFT, int(H * 0.86) + 40),
              "abqunplugged.com/profile/notifications",
              font=F_BODY(22), fill=MUTED)

    img.save(OUT / "05-set-preferences.png", "PNG", quality=95)

def post_06_balloon_fiesta():
    img = new_canvas(CREAM)
    hero = load_hero(1)
    if hero:
        place_hero(img, hero, (0, 0, W, H), darken=0.30)
    draw = ImageDraw.Draw(img)

    # Counter
    draw.text((SAFE_LEFT, SAFE_TOP + 20), "BALLOON FIESTA",
              font=F_HEADLINE(28), fill=WARM)
    draw.text((SAFE_LEFT, int(H * 0.14)), "163",
              font=F_HEADLINE(280), fill=CREAM)
    draw.text((SAFE_LEFT, int(H * 0.42)), "days away.",
              font=F_HEADLINE(68), fill=CREAM)

    # Insider tip box
    box_y = int(H * 0.60)
    rounded_rect(draw, (SAFE_LEFT, box_y, SAFE_RIGHT, box_y + 220),
                 radius=18, fill=CREAM)
    draw.text((SAFE_LEFT + 32, box_y + 24), "PARKING TIP",
              font=F_HEADLINE(22), fill=TERRA)
    draw.text((SAFE_LEFT + 32, box_y + 56),
              "Park in Journal Pavilion",
              font=F_HEADLINE(36), fill=INK)
    draw.text((SAFE_LEFT + 32, box_y + 100),
              "and walk in.",
              font=F_HEADLINE(36), fill=INK)
    draw.text((SAFE_LEFT + 32, box_y + 148),
              "Saves $20 + a 90-min exit line.",
              font=F_BODY(22), fill=MUTED)

    # Bottom CTA
    draw.text((SAFE_LEFT, int(H * 0.88)), "Save your favorites now ›",
              font=F_BODY(26), fill=CREAM)
    draw.text((SAFE_LEFT, int(H * 0.88) + 36), "abqunplugged.com",
              font=F_HEADLINE(28), fill=CREAM)

    img.save(OUT / "06-balloon-fiesta.png", "PNG", quality=95)

def post_07_just_added():
    img = new_canvas(WARM)
    draw = ImageDraw.Draw(img)

    draw.text((SAFE_LEFT, SAFE_TOP + 20), "JUST ADDED",
              font=F_HEADLINE(30), fill=TERRA)

    # Huge number
    draw.text((SAFE_LEFT, int(H * 0.12)), "47", font=F_HEADLINE(380), fill=TERRA)
    draw.text((SAFE_LEFT, int(H * 0.42)), "new events", font=F_HEADLINE(68), fill=INK)
    draw.text((SAFE_LEFT, int(H * 0.42) + 78), "this week.", font=F_HEADLINE(68), fill=INK)

    # Sample list
    y = int(H * 0.60)
    events = [
        "Mrs. Doubtfire at Popejoy",
        "Kitten Yoga at Happy Cat Hotel",
        "Bard Crawl at Differential Brewing",
    ]
    for ev in events:
        draw.text((SAFE_LEFT, y), f"• {ev}", font=F_SERIF(28), fill=INK)
        y += 44

    draw.text((SAFE_LEFT, int(H * 0.81)),
              "(all of those are real.", font=F_BODY(22), fill=MUTED)
    draw.text((SAFE_LEFT, int(H * 0.81) + 30),
              "Burque is unhinged and we love it.)", font=F_BODY(22), fill=MUTED)

    draw.text((SAFE_LEFT, int(H * 0.91)), "abqunplugged.com",
              font=F_HEADLINE(32), fill=TERRA)

    img.save(OUT / "07-just-added.png", "PNG", quality=95)

def post_08_challenge():
    img = new_canvas(TERRA)
    draw = ImageDraw.Draw(img)

    draw.text((SAFE_LEFT, SAFE_TOP + 20), "BURQUE CHALLENGE",
              font=F_HEADLINE(30), fill=WARM)

    y = int(H * 0.14)
    y = draw_wrapped(draw, "Go to one", F_HEADLINE(140), CREAM,
                     SAFE_LEFT, y, SAFE_RIGHT - SAFE_LEFT, line_spacing=1.0, align="left")
    y = draw_wrapped(draw, "thing this", F_HEADLINE(140), CREAM,
                     SAFE_LEFT, y + 6, SAFE_RIGHT - SAFE_LEFT, line_spacing=1.0, align="left")
    y = draw_wrapped(draw, "week.", F_HEADLINE(140), WARM,
                     SAFE_LEFT, y + 6, SAFE_RIGHT - SAFE_LEFT, line_spacing=1.0, align="left")

    # Sub-challenges
    y = int(H * 0.63)
    subs = [
        "Comedy-person › try a gallery.",
        "Music-person › try open mic.",
        "Homebody › pick literally anything.",
    ]
    for s in subs:
        draw.text((SAFE_LEFT, y), s, font=F_SERIF(28), fill=WARM)
        y += 48

    draw.text((SAFE_LEFT, int(H * 0.91)),
              "We'll help you find it. abqunplugged.com",
              font=F_HEADLINE(26), fill=CREAM)

    img.save(OUT / "08-challenge.png", "PNG", quality=95)

def post_09_save_feature():
    img = new_canvas(CREAM)
    draw = ImageDraw.Draw(img)

    draw.text((SAFE_LEFT, SAFE_TOP + 20), "HOW TO USE THE SITE",
              font=F_HEADLINE(26), fill=TERRA)

    # Giant heart illustration with text
    heart_cx = W // 2
    heart_cy = int(H * 0.26)
    heart_r = 130
    # Simple heart shape via two circles + triangle
    draw.ellipse((heart_cx - heart_r, heart_cy - heart_r // 2,
                  heart_cx, heart_cy + heart_r // 2), fill=TERRA)
    draw.ellipse((heart_cx, heart_cy - heart_r // 2,
                  heart_cx + heart_r, heart_cy + heart_r // 2), fill=TERRA)
    draw.polygon([
        (heart_cx - heart_r, heart_cy),
        (heart_cx + heart_r, heart_cy),
        (heart_cx, heart_cy + heart_r + 20),
    ], fill=TERRA)

    draw_center_text(draw, int(H * 0.48), "Tap the heart", F_HEADLINE(68), fill=INK)
    draw_center_text(draw, int(H * 0.48) + 78, "on any event.", F_HEADLINE(68), fill=INK)

    y = int(H * 0.68)
    draw_center_text(draw, y, "Your Saved list:", F_BODY(26), fill=MUTED)
    y = draw_center_text(draw, y + 38, "abqunplugged.com/saved", F_HEADLINE(32), fill=TERRA)

    draw_center_text(draw, int(H * 0.84),
                     "We'll remind you before it happens.",
                     F_SERIF(26), fill=INK)

    img.save(OUT / "09-save-feature.png", "PNG", quality=95)

def post_10_thursday_drop():
    img = new_canvas(CREAM)
    draw = ImageDraw.Draw(img)

    # Newspaper feel — serif heavy
    draw.text((SAFE_LEFT, SAFE_TOP + 20), "NEW. WEEKLY. FREE.",
              font=F_HEADLINE(26), fill=TERRA)
    draw_rule(draw, SAFE_TOP + 60, w=W - 2 * SAFE_LEFT, color=INK, thickness=2)

    draw.text((SAFE_LEFT, int(H * 0.14)), "The Thursday",
              font=F_SERIF(110), fill=INK)
    draw.text((SAFE_LEFT, int(H * 0.14) + 120), "Drop.",
              font=F_SERIF(110), fill=TERRA)

    # Italic subhead
    draw.text((SAFE_LEFT, int(H * 0.38)),
              "Five things worth leaving",
              font=F_SERIF(40), fill=INK)
    draw.text((SAFE_LEFT, int(H * 0.38) + 50),
              "the house for that weekend.",
              font=F_SERIF(40), fill=INK)

    # What's included / excluded
    y = int(H * 0.53)
    for i, line in enumerate(["Events + parking tips",
                              "Editorial picks with reasons",
                              "Where to eat nearby"]):
        draw.text((SAFE_LEFT, y + i * 40), "+ " + line, font=F_BODY(26), fill=SAGE)
    y += 140
    for i, line in enumerate(["Real estate spam",
                              "4,000-word essays",
                              "Sports scores"]):
        draw.text((SAFE_LEFT, y + i * 40), "- " + line, font=F_BODY(26), fill=MUTED)

    # CTA
    draw_cta_pill(img, draw, int(H * 0.85), "Subscribe free ›")

    img.save(OUT / "10-thursday-drop.png", "PNG", quality=95)

# ── Manifest card — shows safe zones + specs ────────────────────────────────
def post_00_specs_reference():
    """Reference card for Matt: safe zones visualized + brand palette."""
    img = new_canvas(CREAM)
    draw = ImageDraw.Draw(img)

    # Draw safe zone outlines
    # Red-ish = unsafe top
    draw.rectangle((0, 0, W, SAFE_TOP), fill=(255, 225, 220))
    draw.rectangle((0, SAFE_BOTTOM, W, H), fill=(255, 225, 220))
    draw.rectangle((0, 0, SAFE_LEFT, H), fill=(255, 235, 230))
    draw.rectangle((SAFE_RIGHT, 0, W, H), fill=(255, 235, 230))

    # Safe center zone
    draw.rectangle((SAFE_LEFT, SAFE_TOP, SAFE_RIGHT, SAFE_BOTTOM),
                   outline=TERRA, width=3)

    draw.text((40, 20), "UNSAFE: top 8%", font=F_BODY(22), fill=INK)
    draw.text((40, H - 50), "UNSAFE: bottom 14%", font=F_BODY(22), fill=INK)

    # Specs
    y = int(H * 0.25)
    draw_center_text(draw, y, "IG PORTRAIT POST", F_HEADLINE(48), fill=INK)
    draw_center_text(draw, y + 70, "1080 × 1350 (4:5)", F_BODY(32), fill=MUTED)

    y = int(H * 0.43)
    for line in [
        "Keep critical content inside the red outline.",
        "Logo + caption/sticker overlays can crop 8% top",
        "and 14% bottom when reshared to Stories.",
    ]:
        draw_center_text(draw, y, line, F_BODY(26), fill=INK)
        y += 40

    # Palette swatches
    swatches = [("cream", CREAM), ("terra", TERRA), ("sage", SAGE),
                ("turquoise", TURQ), ("ink", INK)]
    sw_y = int(H * 0.70)
    sw_w = 140
    total_w = sw_w * len(swatches) + 20 * (len(swatches) - 1)
    sw_x = (W - total_w) // 2
    for name, color in swatches:
        draw.rounded_rectangle((sw_x, sw_y, sw_x + sw_w, sw_y + 100),
                               radius=10, fill=color, outline=INK, width=1)
        draw.text((sw_x, sw_y + 110), name, font=F_BODY(18), fill=INK)
        sw_x += sw_w + 20

    img.save(OUT / "00-safe-zones-reference.png", "PNG", quality=95)

# ── Run all ──────────────────────────────────────────────────────────────────

def main():
    print("Generating launch posts ›", OUT)
    post_00_specs_reference()
    post_01_launch()
    post_02_tonight()
    post_03_weekend()
    post_04_hidden_gem()
    post_05_preferences()
    post_06_balloon_fiesta()
    post_07_just_added()
    post_08_challenge()
    post_09_save_feature()
    post_10_thursday_drop()
    print("Done. 11 files:")
    for p in sorted(OUT.iterdir()):
        print(f"  {p.name}  ({p.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
