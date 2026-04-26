# ABQ Unplugged — Brand Style Guide

Design tokens, voice, and asset paths for making Instagram, Threads, Reddit, Facebook, and other social posts that look like they belong to the site.

> Live site: [abqunplugged.com](https://abqunplugged.com)
> Last updated: 2026-04-26

---

## 1. Color palette

### Primary

| Role | Hex | RGB | Use |
|---|---|---|---|
| **Cream** (background) | `#FBF7F1` | rgb(251, 247, 241) | Primary background. Page canvases, cards on dark backgrounds. |
| **Terra** (accent) | `#9A442D` | rgb(154, 68, 45) | Headlines on light bg, primary buttons, active links, badges. The signature color of the brand. |
| **Dark** (ink) | `#1A1614` | rgb(26, 22, 20) | Body text on cream, reverse on dark. **Not pure black.** |

### Secondary

| Role | Hex | RGB | Use |
|---|---|---|---|
| **Sage** | `#4F6249` | rgb(79, 98, 73) | Secondary accent, success states, "free" pricing pills. |
| **Turquoise** | `#006A62` | rgb(0, 106, 98) | Tertiary accent, info states, ticket links. |
| **Adobe** (warm tan) | `#DDC9A3` | rgb(221, 201, 163) | Card borders, dividers, secondary backgrounds. |
| **Sand** (lighter tan) | `#F0E4CC` | rgb(240, 228, 204) | Tag pill backgrounds, tertiary fill. |
| **Body Muted** | `#6B5D57` | rgb(107, 93, 87) | Small/secondary body text. **WCAG AA on cream.** |
| **Body Soft** | `#4A3F3A` | rgb(74, 63, 58) | Large secondary text, taglines. **WCAG AAA on cream.** |
| **Peach** | `#E8A898` | rgb(232, 168, 152) | Hero accent on dark bg only. |
| **Rust** | `#7D3725` | rgb(125, 55, 37) | Hover state for terra buttons. |

### What NOT to use

- ❌ Pure black `#000000` — too harsh against the cream
- ❌ Pure white `#FFFFFF` (except inside dark cards / OG overlays) — clashes with cream
- ❌ Saturated blues, purples, hot pinks — off-brand
- ❌ Any text in `#8A7A74` — fails WCAG AA contrast (the old "muted" color)

### Gradients

The brand has two named gradients:

```
Sunset (hero, dark surfaces):
  linear-gradient(135deg, #9A442D 0%, #7D3725 50%, #5A2416 100%)

Adobe (warm card surface):
  linear-gradient(135deg, #F0E4CC 0%, #DDC9A3 100%)
```

---

## 2. Typography

### Fonts

| Family | Use | Source |
|---|---|---|
| **Epilogue** (weights 700–900) | All headings (H1–H4), brand name, hero copy | Google Fonts |
| **Inter** (400, 500, 600) | Body text, UI labels, buttons, captions | Google Fonts |
| **Space Grotesk** (400, 500) | Numbers, stats, tabular data | Google Fonts |

### Heading scale

| Level | Web px | IG/Print pt | Style |
|---|---|---|---|
| Display / Hero | 48–72px | 80–96pt | Epilogue 900, tight (-1px tracking) |
| H1 | 30–36px | 48–56pt | Epilogue 900 |
| H2 | 22–24px | 32–40pt | Epilogue 800 |
| H3 | 16–18px | 22–28pt | Epilogue 700 |
| Eyebrow / Label | 11px | 14pt | UPPERCASE + letter-spacing 0.20em, Inter 600, terra `#9A442D` |

### Voice / words

- **Tone**: confident, slightly playful, not corporate. Never bro-y.
- **POV**: a Burqueño who's been to the show. We're not a tech company.
- **Forbidden**: "Discover", "Unleash", "amazing", "epic", "elevate", "let's [verb]". Anything that sounds like a SaaS landing page.
- **Preferred**: "Tonight", "Worth knowing", "Don't miss", "If you only do one thing", "Make ABQ feel smaller".

---

## 3. Logo + visual marks

### Logo files

```
v2/public/logo.svg                    — Terra version (default, on cream)
v2/public/logo-white.svg              — White version (on dark bg / hero)
v2/public/icon-192.png  /  icon-512.png — App icon (terra background)
v2/public/apple-touch-icon.png        — iOS home screen
v2/public/og-image.png                — Default OG image
```

### Logo lockup rules

- Always set on a `cream` or `dark` background — never on a busy photo without overlay.
- Minimum clear space = the height of the "A" in the wordmark on every side.
- Don't recolor. Use either the terra version or the white version.
- Don't stretch. Don't put it inside a rounded rectangle stroke.

### Heart `♥` motif

The footer line uses `♥` in terra `#9A442D` — animated heartbeat at 1.6s ease-in-out. Use sparingly in social posts (max once per image) as a brand callback.

---

## 4. Photography + imagery

### Source priorities (in order)

1. The actual event photo from `cached_photo_url` (real, specific to the event)
2. A real local Albuquerque photo from `/v2/public/og-images/` or `/v2/public/hero-*` carousel images
3. A Pixabay-licensed real photo from the `PIXABAY_IMAGES` fallback pool (5 per category)
4. A Midjourney brand illustration (`/v2/public/category-fallbacks/`) — last resort only

### Image style

- **Always real photography over illustration.** The Midjourney fallbacks are a safety net.
- **Warm tones preferred**: golden hour, sunset, adobe walls, terra cotta, neon at night.
- **Local context preferred**: Sandias on horizon, balloon fiesta sky, chile lights, vigas.
- Crop to **16:10** (web cards), **1:1** (IG feed), **4:5** (IG portrait), **9:16** (IG story / Reel).

### OG image (auto-generated)

Every event page has a dynamically generated 1200×630 OG image at `/events/[id]/opengraph-image`. It composites:
- The event photo as background (with dark gradient overlay)
- White "ABQ UNPLUGGED" pill top-left
- Terra category pill top-right
- Title (white, Epilogue 900) bottom-left
- Date + venue with terra dot bottom-left
Useful as the visual template for any other branded social card you make.

---

## 5. Social-post templates (Instagram, Threads, FB)

### IG Feed Post (1080×1350, 4:5)

```
Top 1/3:        Real photo of event or venue, dark gradient bottom
Middle:         Eyebrow label (eg "FRI MAY 3 · NOB HILL") in cream/terra
                Title in Epilogue 900, max 4 lines, white if photo bg / dark if cream
Lower 1/3:      Venue name with MapPin icon
                Time, ticket price (sage pill if free)
                "abqunplugged.com" wordmark in cream/terra
```

The IG editor at [abqunplugged.com/ig-editor.html](https://abqunplugged.com/ig-editor.html) generates these from any event ID.

### IG Story (1080×1920, 9:16)

```
Full-bleed photo
Center stack:
  Eyebrow label
  Title
  CTA: "Save event ✦ Tap link in bio"
Bottom-right ABQU mark
```

### Carousel: "5 Things This Weekend"

5 slides:
1. Cover: "5 things to do in ABQ this weekend" + dates + ABQ Unplugged mark
2–5. One event per slide (use the IG feed template)
Final: CTA slide — "More at abqunplugged.com/weekend" + sage CTA pill

### Caption formula

```
[Hook line — declarative, 6–10 words]
[2-3 line summary of what's happening]

[Date / time / venue / price]
🔗 abqunplugged.com/events/[id]

[3-5 hashtags, no more]
```

### Recommended hashtag pool (rotate, never use all at once)

`#Albuquerque` `#ABQ` `#NobHill` `#OldTownABQ` `#DowntownABQ`
`#NewMexicoTrue` `#ThingsToDoABQ` `#ABQEvents` `#ABQNightlife`
`#NMArts` `#KiMoTheatre` `#SunshineTheater` `#PopejoyHall`

Plus 1-2 specific to the event itself (band name, festival, etc.).

---

## 6. Asset bundle for designers

### Color swatches (download into your design tool)

```
.ase / .clr palette for Adobe / Mac:
  Cream     #FBF7F1
  Terra     #9A442D
  Dark      #1A1614
  Sage      #4F6249
  Turquoise #006A62
  Adobe     #DDC9A3
  Sand      #F0E4CC
```

### Tailwind shorthand (if using Tailwind in design)

```css
/* These are referenced as bg-[#9A442D] etc throughout the codebase */
bg:        #FBF7F1
accent:    #9A442D
text:      #1A1614
secondary: #4F6249
tertiary:  #006A62
```

### Where to find ready-made templates

- Existing OG card layout: `v2/app/events/[id]/opengraph-image.tsx` (TSX source — copy structure)
- Existing IG editor: `public/ig-editor.html` (live tool, exports PNG)
- Hero photos: `public/hero-1.webp` through `hero-7.webp` (real ABQ scenes)

---

## 7. Don'ts (a short list)

- Don't use Comic Sans, Papyrus, or any Western/Southwest-clichéd font.
- Don't stack logos with sponsor logos at equal weight — ABQ Unplugged is the host.
- Don't use stock business photos. Use real ABQ photos or category fallbacks.
- Don't claim "the only" / "the best" — we're "the easiest way" or "all in one place".
- Don't over-emoji. One per caption max in feed posts; zero in stories.
- Don't hashtag-spam. Five tops.
- Don't make the heart `♥` sparkle, gradient, or animated outside the footer.

---

## 8. File checklist when making a post

- [ ] Copy uses the brand voice (no SaaS-ese, no "discover")
- [ ] Color is one of the seven brand hex codes — not "close to terra"
- [ ] Headline is in Epilogue 900 (or matched bold display font)
- [ ] Body is in Inter (or matched humanist sans)
- [ ] Logo present once, at brand size, on cream/dark only
- [ ] Photo is real ABQ — no stock business meeting people
- [ ] If event-specific, includes title, date, venue, time, abqunplugged.com link
- [ ] Caption ends with the URL `abqunplugged.com/events/[id]`

---

*Questions? Open a feedback ticket via the site footer or talk to Matt directly.*
