---
name: ABQ Unplugged
description: Albuquerque's cultural events guide — find it before everyone else does
colors:
  terra: "#9a442d"
  terra-hover: "#7d3725"
  terra-mid: "#c4614a"
  terra-light: "#e8a898"
  sage: "#4f6249"
  sage-mid: "#6f8469"
  sage-light: "#b0c4b1"
  turquoise: "#006a62"
  turquoise-mid: "#2a8f87"
  turquoise-light: "#7cc4bf"
  sand-border: "#ddc9a3"
  sand-fill: "#f0e4cc"
  cream: "#fbf7f1"
  ink: "#1a1614"
  ink-mid: "#4a3f3a"
  ink-muted: "#8a7a74"
typography:
  display:
    fontFamily: "Epilogue, system-ui, sans-serif"
    fontSize: "clamp(34px, 7vw, 58px)"
    fontWeight: 900
    lineHeight: 1.0
    letterSpacing: "-1.5px"
  headline:
    fontFamily: "Epilogue, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.5px"
  title:
    fontFamily: "Epilogue, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.20em"
  mono:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
rounded:
  pill: "9999px"
  xl: "12px"
  lg: "8px"
  md: "6px"
  sm: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.terra}"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.terra-hover}"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-mid}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  chip-unselected:
    backgroundColor: "rgba(154,68,45,0.10)"
    textColor: "{colors.terra}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  chip-selected:
    backgroundColor: "{colors.terra}"
    textColor: "{colors.cream}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  card-event:
    backgroundColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "0"
---

# Design System: ABQ Unplugged

## 1. Overview

**Creative North Star: "The Burque Broadside"**

ABQ Unplugged is a city's printed bulletin board, digitized with intention. The aesthetic owes more to a well-made alternative weekly than a tech product: warm cream paper stock, terra-cotta ink that feels sun-baked and local, headings that assert themselves without shouting. The tone is a Burqueño who has been to the show — confident, slightly playful, never corporate.

The system is light-mode only, and that choice is load-bearing. A warm cream base (`#fbf7f1`) with ink (`#1a1614`) text reads like a page held in golden-hour light. The city this site serves runs on sunlight, adobe, and big sky. Dark mode would remove all of that — it belongs to generic tech products, not this place.

Density is deliberately moderate: not sparse like a marketing landing page, not crammed like a ticketing dashboard. The grid breathes; sections have rhythm. The goal is a user who feels they can skim quickly and read deeply when something catches their eye.

**Key Characteristics:**
- Warm cream-and-terra palette rooted in New Mexico materials
- Three-weight typography hierarchy (Epilogue headings, Inter body, Space Grotesk data)
- Mostly flat elevation, with lift reserved for interactive states
- Pill-heavy component shapes — soft, readable, not sharp-edged
- Spring-physics card entrances; scroll-driven reveals; no gratuitous motion
- Voice: the insider, not the algorithm

## 2. Colors: The New Mexico Palette

The palette draws from adobe walls, Sandia sunset, and high-desert sage. Three accent families (terra, sage, turquoise) layer categorical meaning onto a warm neutral base — terra is the brand, sage is free/secondary, turquoise is info/ticket.

### Primary
- **Fired Terra** (`#9a442d`): The signature brand color. Used on primary buttons, active nav states, headings on cream, event category badges, and the footer heartbeat mark. Never used for decorative fills — its rarity is the point.
- **Deep Rust** (`#7d3725`): Terra hover state only. Never appears at rest; it signals that something is interactive and pressed.
- **Terra Mid** (`#c4614a`): Lighter terra for subtle accents, avatar fallback backgrounds. Not for text.
- **Peach** (`#e8a898`): Hero accent on dark backgrounds only. Used for outline text in the hero headline (ghost stroke technique). Never on cream.

### Secondary
- **Desert Sage** (`#4f6249`): Secondary accent. Applied to "free event" pricing pills, sage filter chips. Earthy, reliable.
- **Sage Mid** (`#6f8469`): Supplementary sage for hover states and mid-weight fills.
- **Sage Light** (`#b0c4b1`): Very light sage for tags and background tints.

### Tertiary
- **Turquoise Deep** (`#006a62`): Ticket/info color. Focus rings (via CSS `outline`), "Free" pill backgrounds in some contexts, ticket CTA links. The turquoise reads as a trustworthy action color.
- **Turquoise Mid** (`#2a8f87`): Used for lighter ticket states.
- **Turquoise Light** (`#7cc4bf`): Light turquoise for icon fills or background splashes.

### Neutral
- **Warm Cream** (`#fbf7f1`): Page canvas. Applied to `<html>` and `<body>` backgrounds. Not pure white — the tint is essential to the warmth. Never replace with `#ffffff` on the main canvas.
- **Press Ink** (`#1a1614`): Primary text. Not pure black — warm-dark with a red undertone that harmonizes with terra. Used for all body copy and primary headings.
- **Secondary Ink** (`#4a3f3a`): Large secondary text, taglines, nav labels at rest. WCAG AAA on cream.
- **Muted Ink** (`#8a7a74`): Small metadata text only. Does not pass WCAG AA at small sizes — use only at 14px+ for non-critical labels. Never for body copy.
- **Adobe Border** (`#ddc9a3`): Card borders, dividers, input strokes at rest. The warm-tan border unifies cards with the cream canvas without sharp contrast.
- **Sand Fill** (`#f0e4cc`): Tag pill backgrounds, hover tints on neutral buttons, secondary container fills. Also used for the skeleton loading shimmer base.

### Named Rules
**The Terra Economy Rule.** Terra (`#9a442d`) appears on ≤15% of any given screen at rest. It is the brand's voice, not wallpaper. When everything is terra, nothing is.

**The No-Pure-Black Rule.** `#000000` and `#ffffff` are forbidden. Every neutral is tinted toward the brand hue. The ink (`#1a1614`) has warmth; the cream (`#fbf7f1`) has warmth. Coldness is off-brand.

**The No-Muted-On-Small-Text Rule.** `#8a7a74` (ink-muted) fails WCAG AA at small sizes. Use it only on labels 14px or larger, never on body copy or interactive labels.

## 3. Typography: The Three-Register System

**Display Font:** Epilogue (weights 700–900), system-ui fallback
**Body Font:** Inter (400, 500, 600), system-ui fallback
**Data Font:** Space Grotesk (400, 500) for numbers, stats, tabular content

**Character:** Epilogue at 900 weight is assertive without being loud — its slight condensed proportions read fast in a scroll context. Inter is neutral enough to disappear into content. The pairing avoids the category reflex (no serif-for-culture, no geometric-for-tech). Space Grotesk gives data and counts a slightly mechanical quality that differentiates them from editorial text.

### Hierarchy
- **Display** (900, `clamp(34px, 7vw, 58px)`, line-height 1.0, tracking -1.5px): Hero headlines only. Tight leading creates visual mass; the negative tracking compensates for Epilogue's generous default spacing at large sizes.
- **Headline** (900, 30px, line-height 1.1, tracking -0.5px): Section headings, page titles, featured event titles.
- **Title** (800, 22px, line-height 1.2): Card section headings, sub-page titles, dialog headings.
- **Body** (Inter 400, 15px, line-height 1.6): All prose content. Line length should stay within 65–75ch.
- **Label** (Inter 600, 11px, UPPERCASE, tracking 0.20em, terra `#9a442d`): Eyebrow labels, category markers, nav tab labels. The all-caps + tracking signals metadata without needing brackets or pipes.
- **Data** (Space Grotesk 500, 14px): Ticket counts, event totals, date/time displays, leaderboard numbers.

### Named Rules
**The Weight Contrast Rule.** Epilogue 900 next to Inter 400 creates the system's core tension. Avoid mixing Epilogue 700/800 with Inter 500/600 — the contrast collapses and the hierarchy reads as flat.

**The Negative-Tracking Rule.** Epilogue at display size (34px+) gets -1.5px tracking. At headline size (22-30px), -0.4 to -0.5px. At title size, 0 or slightly negative. Never apply positive tracking to Epilogue — it fights the font's proportions.

## 4. Elevation: Flat-First with Lifted States

The system is flat by default. Cards rest on cream with an almost-invisible shadow (`0 1px 3px rgba(26,22,20,0.04)`) — enough to separate card from background at high contrast, invisible at a glance. Depth is not decorative; it is a state signal.

Hover lifts cards with a stronger shadow and a 1px upward translate. The combination communicates "this thing moves" without literal motion until the user engages.

CTAs (primary buttons, "Surprise Me") use a terra-tinted glow shadow (`shadow-[#9a442d]/20`) on hover — the accent color bleeds into the shadow, reinforcing the brand color even in the elevation layer.

### Shadow Vocabulary
- **Card resting** (`0 1px 3px rgba(26,22,20,0.04)`): Nearly invisible. Cards float above cream without a hard edge.
- **Card hover** (`0 8px 24px rgba(26,22,20,0.12)`): Applied on hover with `hover:-translate-y-1`. Communicates interactivity.
- **Ambient subtle** (`shadow-sm`, approximately `0 1px 2px rgba(0,0,0,0.05)`): Used on chips, small action buttons, and floating elements at rest.
- **CTA accent glow** (`0 4px 12px rgba(154,68,45,0.20)`): Applied to primary CTAs on hover. The terra bleed is intentional brand reinforcement.
- **Dialog/picker** (`shadow-lg`, approximately `0 10px 40px rgba(0,0,0,0.12)`): Floating panels (calendar picker, tooltips). Never used on inline content.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, lift, focus) or structural depth (floating dialogs). Decorative shadows — applied to section headings, static illustrations, or background containers — are prohibited.

## 5. Components

### Buttons

The primary button is a terra pill. Rounded-full shape keeps it friendly; the terra fill makes it unmissable. All buttons use 200ms ease-out transitions — fast enough to feel responsive, not so fast they feel jerky.

- **Shape:** Fully rounded pill (`border-radius: 9999px`)
- **Primary:** Terra fill (`#9a442d`), cream text, padding `10px 20px`, font Inter 600 14px. On hover: `#7d3725` fill, `shadow-[#9a442d]/20` glow, optional subtle upward translate. On focus-visible: `2px solid #006a62` ring with 2px offset.
- **Active:** `scale(0.95)` for a press feel — kept at 200ms so it doesn't overshoot.
- **Disabled:** `opacity: 0.7`, `cursor: wait` (when loading) or `cursor: not-allowed`.
- **Ghost/outline:** Transparent fill, `ink-mid` (`#4a3f3a`) text, `sand-border` (`#ddc9a3`) stroke, pill shape. On hover: stroke shifts to terra, text shifts to terra.
- **Secondary wide** (used in forms): `rounded-2xl` (16px radius), full-width, same terra fill.

### Chips / Filter Pills

Used extensively in the FilterBar (3-row filter: time / category / subcategory) and MoodChips. Horizontal scrollable rows; chips snap to the pill shape.

- **Unselected:** Terra tint background (`rgba(154,68,45,0.10)`), terra text, terra/20 border. On hover: terra fill, cream text, terra border.
- **Selected:** Terra fill, cream text, terra border.
- **Ghost chip** (for clearing filters): No fill, `sand-border` stroke, `ink-mid` text. On hover: terra stroke, terra text.
- **Category badge chip** (color-keyed): Terra for default, sage for "free" events, turquoise for ticket/info states.

### Cards / Event Cards

The event card is the most-used component. White background on cream canvas, rounded-xl corners (12px), adobe-border (`#f0e4cc/80`) at rest. Spring card entrance animation on load.

- **Corner Style:** Gently curved (12px radius). Not sharp, not pill — the balance communicates content container.
- **Background:** White (`#ffffff`) — intentionally one step brighter than the cream canvas to create separation.
- **Shadow Strategy:** Resting: `0 1px 3px rgba(26,22,20,0.04)`. Hover: `0 8px 24px rgba(26,22,20,0.12)` + `translateY(-1px)`.
- **Border:** `#f0e4cc` at 80% opacity. The warm-sand border reads as a gentle separation without hard contrast.
- **Image area:** Full-width top, `aspect-[16/10]` or `aspect-[4/3]` depending on row type. Rounded-xl clipped to card corners.
- **Metadata badges:** Absolute-positioned pills overlaid on the image — category top-left (or top-right), "Free" bottom-left. Dark or category-color fill with backdrop blur for legibility over photos.
- **Internal padding:** 8–12px on text content area below the image.

### Inputs / Search Fields

- **Style:** White background, `border: 1px solid #e8ddd0`, radius 12px (rounded-xl). Placeholder in `#b0a69e`.
- **Focus:** Border shifts to terra (`#9a442d`), `ring-1 ring-[#9a442d]/30` glow. Transition 150ms.
- **Icon prefix:** Left-side search icon at `#8a7a74`, 16px.
- **Clear button:** Right-side × at `#8a7a74`, appears when field has content.

### Navigation

**Desktop (sticky header, md+):** White/cream background at 95% opacity with backdrop blur. Height 56px. Logo left; nav links as inline pills. Active link: terra fill, cream text. Inactive: `ink-mid` text, no fill. Hover: `sand-fill` tint.

**Mobile (fixed bottom, below md):** 5-column grid, 64px height, white/92% backdrop-blur. Active item: terra icon + terra underline pip at top edge. Inactive: `#4a3f3a` (ink-mid) icon, no label color change.

**Label style:** Space Grotesk 500, 10px, UPPERCASE, tracking wider — gives the nav a slightly editorial, non-app feel.

### Mood Chips (Signature Component)

A horizontal scrollable strip of large-format emoji + label chips just below the hero. Users pick a mood (Chill Night, Live Music, Get Outside, etc.) and the event list filters by `ai_enrichment` mood scores.

- **Format:** Pill, `px-3.5 py-2`, `rounded-full`. Emoji + label side by side.
- **Unselected:** `rgba(154,68,45,0.10)` fill, terra text, terra/20 border. Horizontal scroll with `scrollbar-hide`.
- **Selected:** Terra fill, cream text.
- **One-time scroll hint:** On mount, a CSS `scroll-hint` animation nudges the strip 14px left then snaps back — teaches horizontal scrollability without a tooltip.

### Hero Section (Signature Component)

Full-bleed dark hero with carousel background, SVG city map overlay, and large Epilogue display type.

- **Background:** Dark gradient (`from-[#1a0a00] via-[#2d1408] to-[#3d1a0e]`) with rotating photo carousel at 30% opacity crossfade.
- **Map overlay:** Inline SVG line-drawing of ABQ streets (I-25, I-40, Central/Route 66, Sandia silhouette, Rio Grande). Masked left-to-right so it's invisible behind the text and visible to the right as architectural texture.
- **Display type:** Epilogue 900, cream (`#fbf7f1`) solid for the first line. Second line: fully transparent fill with white ghost stroke (`-webkit-text-stroke: 1.5px rgba(255,255,255,0.5)`) — creates an outlined/hollow headline word.
- **Subcopy:** Inter 400, 16-17px, `rgba(255,255,255,0.72)`.

## 6. Do's and Don'ts

### Do:
- **Do** use `#9a442d` terra as the primary accent — on buttons, active states, headlines over cream, and category chips. Its rarity is the point; protect it.
- **Do** use Epilogue 900 for all headings. Never Epilogue 400–600 — those weights are for display in narrow editorial contexts only, and this site doesn't have them.
- **Do** keep card borders warm (`#f0e4cc` or `#ddc9a3`) — cold grey borders read as a different product.
- **Do** animate card entrances with spring physics (`cubic-bezier(0.34, 1.56, 0.64, 1)`, 0.5s). The slight overshoot gives cards the feeling of physical weight.
- **Do** use scroll-driven CSS animations (`animation-timeline: view()`) with graceful fallback for unsupported browsers.
- **Do** label category context with the terra eyebrow label style: Inter 600, 11px, UPPERCASE, `0.20em` tracking.
- **Do** use `#006a62` turquoise for the global focus ring. It's distinct from the terra primary and visually accessible.
- **Do** use Space Grotesk for all numeric data: event counts, ticket prices, times. It separates data from editorial text.
- **Do** write copy in the Burqueño voice: "Tonight", "Worth knowing", "If you only do one thing". Declarative, local, human.

### Don't:
- **Don't** use pure black `#000000` or pure white `#ffffff` on the main canvas. Both clash with the warm cream base. Ink is `#1a1614`; canvas is `#fbf7f1`.
- **Don't** use `#8a7a74` (ink-muted) for body copy or interactive labels — it fails WCAG AA at small sizes. Reserve it for supplementary metadata at 14px+.
- **Don't** use saturated blues, purples, or hot pinks. The palette is warm-earth; anything cool-saturated reads as off-brand.
- **Don't** add left-stripe borders (border-left > 1px as a colored accent) to cards, alerts, or list items. Rewrite with a full border, background tint, or leading icon instead.
- **Don't** use gradient text (`background-clip: text`). Headlines are solid-color; weight and size carry emphasis.
- **Don't** use glassmorphism (backdrop-blur + transparent fill) as a decorative default. The only legitimate glass surfaces are the sticky nav, bottom nav, and absolute-positioned metadata badges over event images.
- **Don't** write SaaS copy: "Discover", "Unleash", "amazing", "epic", "elevate", "let's [verb]". The BRAND.md explicitly forbids this voice.
- **Don't** claim "the only" or "the best". The brand is "the easiest way" or "all in one place".
- **Don't** use Western/Southwest-clichéd fonts (Trajan, Impact, Western-style serifs). Epilogue is modern and specific; it doesn't lean on regional cliché.
- **Don't** add motion to layout properties (width, height, top, left). Animate only transform and opacity.
- **Don't** use bounce or elastic easing. Expo ease-out or the site's spring curve only.
- **Don't** render identical card grids: same-sized cards with icon + heading + text endlessly repeated. Mix card sizes, use horizontal scroll rows, vary the rhythm.
- **Don't** over-emoji. One per caption in social posts; zero in UI elements except the Mood Chips, where emoji is the affordance.
