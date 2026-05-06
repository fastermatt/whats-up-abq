import type { Design, Slide, Layer, TextLayer, BrandFontName, CanvasFormat } from '../types'
import { BRAND_COLORS, BRAND_FONTS, CANVAS_DIMS } from '../types'

/**
 * Templates are pure "design recipes" — given optional event data (and an
 * optional target canvas format), they return a Design ready to load.
 *
 * All y-positions in the build functions were originally calibrated for 4:5
 * (h = 1350). When building for a different format, `sy(y)` scales them
 * proportionally: sy(y) = round(y * h / 1350). Positions already expressed
 * relative to `h` (e.g. `h - 96`) are left as-is — they self-adapt.
 *
 * Each template also includes a `thumb` descriptor used to render a visual
 * swatch in the template gallery — no canvas rendering needed.
 */

export interface TemplateContext {
  title?: string
  subtitle?: string
  date?: string
  time?: string
  venue?: string
  category?: string
  imageUrl?: string
  tagline?: string
  cta?: string
}

// Thumbnail descriptor — rendered as a small SVG in the template gallery.
// Coordinate system: 100×125 units (mirrors 4:5 aspect ratio).
export interface ThumbBlock {
  x: number; y: number; w: number; h: number
  c: string; o?: number; r?: number
}
export interface TemplateThumbnail {
  bg?: string
  gradient?: { from: string; to: string; angle: number }
  blocks: ThumbBlock[]
}

export interface Template {
  id: string
  name: string
  description: string
  category: 'event' | 'brand'
  thumb: TemplateThumbnail
  build: (ctx: TemplateContext, format?: CanvasFormat) => Design
}

const uid = () => Math.random().toString(36).slice(2, 10)

function font(name: BrandFontName) {
  return BRAND_FONTS.find(f => f.name === name)!.stack
}

// ── Shared layer factories with all required fields ──────────────────────

type TextInit = {
  name?: string; text: string; x: number; y: number; width?: number; rotation?: number; opacity?: number
  fontFamily?: string; fontSize?: number; fontWeight?: number; fontStyle?: 'normal'|'italic'
  fill?: string; align?: 'left'|'center'|'right'; letterSpacing?: number; lineHeight?: number
  shadow?: TextLayer['shadow']; stroke?: TextLayer['stroke']; uppercase?: boolean
}

function textLayer(p: TextInit): TextLayer {
  return {
    id: uid(),
    name: p.name ?? 'Text',
    type: 'text',
    text: p.text,
    x: p.x, y: p.y,
    width: p.width ?? 900,
    rotation: p.rotation ?? 0,
    opacity: p.opacity ?? 1,
    visible: true, locked: false,
    fontFamily: p.fontFamily ?? font('Epilogue'),
    fontSize: p.fontSize ?? 80,
    fontWeight: p.fontWeight ?? 900,
    fontStyle: p.fontStyle ?? 'normal',
    fill: p.fill ?? BRAND_COLORS.ink,
    align: p.align ?? 'left',
    letterSpacing: p.letterSpacing ?? 0,
    lineHeight: p.lineHeight ?? 1.1,
    shadow: p.shadow ?? { enabled: false, color: 'rgba(0,0,0,0.5)', blur: 8, offsetX: 0, offsetY: 2 },
    stroke: p.stroke ?? { enabled: false, color: '#000', width: 2 },
    uppercase: p.uppercase ?? false,
  }
}

function imageLayer(partial: {
  src: string; x: number; y: number; width: number; height: number
  cornerRadius?: number; fit?: 'cover' | 'contain' | 'stretch'
}): Layer {
  return {
    id: uid(), name: 'Image', type: 'image',
    src: partial.src,
    x: partial.x, y: partial.y, width: partial.width, height: partial.height,
    rotation: 0, opacity: 1, visible: true, locked: false,
    cornerRadius: partial.cornerRadius ?? 0,
    fit: partial.fit ?? 'cover',
  }
}

function shape(partial: { shape: 'rect'|'circle'|'line'; x: number; y: number; width: number; height: number; fill?: string; stroke?: string; strokeWidth?: number; cornerRadius?: number; opacity?: number }): Layer {
  return {
    id: uid(), name: partial.shape, type: 'shape',
    shape: partial.shape,
    x: partial.x, y: partial.y, width: partial.width, height: partial.height,
    rotation: 0,
    opacity: partial.opacity ?? 1,
    visible: true, locked: false,
    fill: partial.fill ?? BRAND_COLORS.terra,
    stroke: partial.stroke ?? 'transparent',
    strokeWidth: partial.strokeWidth ?? 0,
    cornerRadius: partial.cornerRadius ?? 0,
  }
}

// Logo image helpers — SVG viewBox is 1907×1032, so width = height × (1907/1032)
// Logos use fit:'stretch' because their dimensions are pre-computed to the correct aspect ratio.
const LOGO_R = 1907 / 1032
const LOGO_W = '/logo-white.svg'  // white paths — for dark canvas backgrounds
const LOGO_T = '/logo-terra.svg'  // terra paths — for cream/light backgrounds
function logo(src: string, x: number, y: number, h: number): Layer {
  return imageLayer({ src, x, y, width: Math.round(h * LOGO_R), height: h, fit: 'stretch' })
}

const formatDate = (iso?: string, time?: string) => {
  if (!iso) return ''
  try {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso
    const d = new Date(base)
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver' })
    return time ? `${dateStr} · ${time}` : dateStr
  } catch { return iso }
}

// ════════════════════════════════════════════════════════════════════════
//   EVENT TEMPLATES (6)
// ════════════════════════════════════════════════════════════════════════

// ── 1. Poster ────────────────────────────────────────────────────────────

const poster: Template = {
  id: 'poster',
  name: 'Poster',
  description: 'Full-bleed photo with bold bottom title. Highest impact in feed.',
  category: 'event',
  thumb: {
    gradient: { from: '#0a0908', to: '#1a0a00', angle: 170 },
    blocks: [
      { x: 7, y: 9, w: 25, h: 3.5, c: '#fff', o: 0.7 },
      { x: 7, y: 56, w: 86, h: 14, c: '#fff' },
      { x: 7, y: 76, w: 55, h: 3.5, c: '#fff', o: 0.7 },
      { x: 7, y: 83, w: 38, h: 2.5, c: '#fff', o: 0.45 },
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const isStory = fmt === '9:16'

    // ── Safe zone margins per format ──────────────────────────────────────
    // Instagram overlays profile/timer at top (~12% of stories) and the reply
    // bar at bottom (~15% of stories). Feed posts only need a small margin.
    const topSafe = isStory ? Math.round(h * 0.12) : 46  // px from top edge
    const botSafe = isStory ? Math.round(h * 0.15) : 80  // px from bottom edge

    // ── Title sizing — responsive to avoid multi-line overflow ────────────
    // At w=1080, usable width is 920px. Fraunces avg char width ≈ 65% of fontSize.
    // Sizing keeps the title to ≤2 lines comfortably, leaving headroom for Date/Venue.
    const title = ctx.title ?? 'Your Title Here'
    const titleSize = title.length < 10 ? 130
                    : title.length < 20 ? 110
                    : title.length < 35 ? 90
                    : 70

    // ── Bottom cluster: CTA → Date/Venue → [gap] → Title ─────────────────
    // All positions are anchored relative to the bottom safe margin so they
    // automatically adapt to every format without separate sy() scaling.
    const ctaY   = h - botSafe - 50   // DM Mono 28px + 22px breathing room
    const dateY  = h - botSafe - 170  // ~120px for 2-line Date/Venue block above CTA gap
    const titleY = h - botSafe - 505  // big gap above Date; same relative position as h-580 on 4:5

    const slide: Slide = {
      id: uid(),
      background: ctx.imageUrl
        ? { type: 'image', src: ctx.imageUrl, fit: 'cover', overlayColor: '#000000', overlayOpacity: 0.48 }
        : { type: 'gradient', from: BRAND_COLORS.terra, to: BRAND_COLORS.mesaBrown, angle: 135 },
      layers: [
        // Logo at top safe boundary (safe for all formats including Story)
        logo(LOGO_W, 80, topSafe, 60),
        ctx.category ? textLayer({
          name: 'Category', text: (ctx.category ?? '').toUpperCase(),
          x: 80, y: topSafe + 70, width: w - 160,
          fontFamily: font('Inter'), fontSize: 30, fontWeight: 700,
          fill: BRAND_COLORS.white, opacity: 0.65, letterSpacing: 6,
        }) : null,
        textLayer({
          name: 'Title', text: title,
          x: 80, y: titleY, width: w - 160,
          fontFamily: font('Fraunces'), fontSize: titleSize, fontWeight: 800,
          fill: BRAND_COLORS.white, lineHeight: 0.96,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.4)', blur: 24, offsetX: 0, offsetY: 4 },
        }),
        textLayer({
          name: 'Date & Venue',
          text: `${formatDate(ctx.date, ctx.time)}${ctx.venue ? `\n${ctx.venue}` : ''}`,
          x: 80, y: dateY, width: w - 160,
          fontFamily: font('Fraunces'), fontSize: 44, fontWeight: 400, fontStyle: 'italic',
          fill: BRAND_COLORS.white, opacity: 0.92, lineHeight: 1.3,
        }),
        textLayer({
          name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
          x: 80, y: ctaY, width: w - 160,
          fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
          fill: BRAND_COLORS.white, opacity: 0.7, letterSpacing: 2,
        }),
      ].filter(Boolean) as Layer[],
    }
    return {
      id: uid(), name: ctx.title ?? 'Poster post', format: fmt,
      slides: [slide], createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 2. Broadside ──────────────────────────────────────────────────────────

const broadside: Template = {
  id: 'broadside',
  name: 'Broadside',
  description: 'Letterpress type poster — no photo needed. Maximum typographic punch.',
  category: 'event',
  thumb: {
    bg: BRAND_COLORS.cream,
    blocks: [
      { x: 7, y: 7, w: 18, h: 3, c: BRAND_COLORS.terra },
      { x: 7, y: 12, w: 52, h: 3.5, c: BRAND_COLORS.terra, o: 0.8 },
      { x: 7, y: 17.5, w: 86, h: 0.8, c: BRAND_COLORS.ink, o: 0.2 },
      { x: 7, y: 21, w: 86, h: 35, c: BRAND_COLORS.ink, o: 0.88 },
      { x: 7, y: 76, w: 86, h: 3, c: BRAND_COLORS.terra },
      { x: 7, y: 82, w: 62, h: 5, c: BRAND_COLORS.ink, o: 0.65 },
    ],
  },
  build: (ctx, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    const title = ctx.title ?? 'Your Event'
    const titleSize = title.length < 15 ? 200 : title.length < 25 ? 170 : title.length < 40 ? 145 : 120
    const dateLine = [formatDate(ctx.date, ctx.time), ctx.venue].filter(Boolean).join('\n')
    const layers: Layer[] = [
      shape({ shape: 'rect', x: 80, y: sy(78), width: 180, height: 4, fill: BRAND_COLORS.terra }),
      logo(LOGO_T, 80, sy(96), 76),
      shape({ shape: 'rect', x: 80, y: sy(188), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.2 }),
      textLayer({
        name: 'Title', text: title,
        x: 80, y: sy(230), width: w - 160,
        fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 900,
        fill: BRAND_COLORS.ink, lineHeight: 0.88, letterSpacing: -2,
      }),
      shape({ shape: 'rect', x: 80, y: h - 340, width: w - 160, height: 4, fill: BRAND_COLORS.terra }),
    ]
    if (dateLine) {
      layers.push(textLayer({
        name: 'Date & Venue', text: dateLine,
        x: 80, y: h - 308, width: w - 160,
        fontFamily: font('Inter'), fontSize: 48, fontWeight: 600,
        fill: BRAND_COLORS.ink, lineHeight: 1.3,
      }))
    }
    layers.push(textLayer({
      name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
      x: 80, y: h - 95, width: w - 160,
      fontFamily: font('DM Mono'), fontSize: 26, fontWeight: 500,
      fill: BRAND_COLORS.terra, letterSpacing: 3, opacity: 0.85,
    }))
    return {
      id: uid(), name: ctx.title ?? 'Broadside post', format: format ?? '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 3. Marquee ────────────────────────────────────────────────────────────

const marquee: Template = {
  id: 'marquee',
  name: 'Marquee',
  description: 'Theater marquee on near-black. Bold all-caps centered type — no photo needed.',
  category: 'event',
  thumb: {
    bg: '#0c0b0a',
    blocks: [
      { x: 7, y: 20, w: 86, h: 0.8, c: BRAND_COLORS.terra, o: 0.7 },
      { x: 10, y: 24, w: 80, h: 26, c: BRAND_COLORS.cream },
      { x: 7, y: 72, w: 86, h: 0.8, c: BRAND_COLORS.terra, o: 0.7 },
      { x: 7, y: 76, w: 86, h: 4, c: BRAND_COLORS.cream, o: 0.6 },
      { x: 7, y: 84, w: 86, h: 3, c: BRAND_COLORS.cream, o: 0.35 },
    ],
  },
  build: (ctx, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    const title = (ctx.title ?? 'Your Event').toUpperCase()
    // Bebas Neue is condensed — can run larger than Epilogue at the same character count
    const titleSize = title.length < 8 ? 260 : title.length < 14 ? 220 : title.length < 22 ? 185 : title.length < 32 ? 150 : 120
    const ruleY = sy(ctx.category ? 248 : 200)
    const titleY = ruleY + 32
    const layers: Layer[] = [logo(LOGO_W, Math.round((w - Math.round(70 * LOGO_R)) / 2), sy(46), 70)]
    if (ctx.category) {
      layers.push(textLayer({
        name: 'Category', text: ctx.category.toUpperCase(),
        x: 80, y: sy(180), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 8, align: 'center',
      }))
    }
    layers.push(
      shape({ shape: 'rect', x: 280, y: ruleY, width: 520, height: 2, fill: BRAND_COLORS.terra, opacity: 0.7 }),
      textLayer({
        name: 'Title', text: title,
        x: 80, y: titleY, width: w - 160,
        fontFamily: font('Bebas Neue'), fontSize: titleSize, fontWeight: 400,
        fill: BRAND_COLORS.cream, lineHeight: 0.88, align: 'center', letterSpacing: 2,
      }),
      shape({ shape: 'rect', x: 280, y: h - 400, width: 520, height: 2, fill: BRAND_COLORS.terra, opacity: 0.7 }),
      textLayer({
        name: 'Date', text: formatDate(ctx.date, ctx.time),
        x: 80, y: h - 370, width: w - 160,
        fontFamily: font('Fraunces'), fontSize: 48, fontWeight: 400, fontStyle: 'italic',
        fill: BRAND_COLORS.cream, opacity: 0.85, align: 'center',
      }),
    )
    if (ctx.venue) {
      layers.push(textLayer({
        name: 'Venue', text: ctx.venue,
        x: 80, y: h - 290, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 30, fontWeight: 500,
        fill: BRAND_COLORS.cream, opacity: 0.55, align: 'center', letterSpacing: 3,
        uppercase: true,
      }))
    }
    return {
      id: uid(), name: ctx.title ?? 'Marquee post', format: format ?? '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: '#0c0b0a' }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 4. Split ──────────────────────────────────────────────────────────────

const split: Template = {
  id: 'split',
  name: 'Split',
  description: 'Photo top half, cream text bottom. Strongest with a vivid event photo.',
  category: 'event',
  thumb: {
    bg: BRAND_COLORS.cream,
    blocks: [
      { x: 0, y: 0, w: 100, h: 52, c: BRAND_COLORS.terra },
      { x: 0, y: 52, w: 100, h: 3.5, c: BRAND_COLORS.terra },
      { x: 7, y: 59, w: 28, h: 3, c: BRAND_COLORS.terra },
      { x: 7, y: 64, w: 82, h: 18, c: BRAND_COLORS.ink },
      { x: 7, y: 86, w: 55, h: 3.5, c: BRAND_COLORS.ink, o: 0.6 },
    ],
  },
  build: (ctx, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const splitY = Math.round(h * 0.52)
    const title = ctx.title ?? 'Your Event'
    const titleSize = title.length < 15 ? 170 : title.length < 25 ? 145 : title.length < 40 ? 115 : 95
    const layers: Layer[] = []
    if (ctx.imageUrl) {
      // fit:'cover' ensures the photo fills the split zone without stretching
      layers.push(imageLayer({ src: ctx.imageUrl, x: 0, y: 0, width: w, height: splitY, fit: 'cover' }))
    } else {
      layers.push(shape({ shape: 'rect', x: 0, y: 0, width: w, height: splitY, fill: BRAND_COLORS.terra }))
      if (ctx.category) {
        layers.push(textLayer({
          name: 'Category Block', text: ctx.category,
          x: 80, y: Math.round(splitY / 2) - 80, width: w - 160,
          fontFamily: font('Inter'), fontSize: 90, fontWeight: 700,
          fill: BRAND_COLORS.cream, opacity: 0.9, align: 'center',
        }))
      }
    }
    layers.push(shape({ shape: 'rect', x: 0, y: splitY, width: w, height: 6, fill: BRAND_COLORS.terra }))
    const textBaseY = splitY + 48
    if (ctx.category) {
      layers.push(textLayer({
        name: 'Category', text: ctx.category.toUpperCase(),
        x: 80, y: textBaseY, width: w - 160,
        fontFamily: font('Inter'), fontSize: 42, fontWeight: 700,
        fill: BRAND_COLORS.terra, letterSpacing: 3,
      }))
    }
    layers.push(textLayer({
      name: 'Title', text: title,
      x: 80, y: textBaseY + (ctx.category ? 66 : 0), width: w - 160,
      fontFamily: font('Fraunces'), fontSize: titleSize, fontWeight: 800,
      fill: BRAND_COLORS.ink, lineHeight: 0.92,
    }))
    const dateStr = formatDate(ctx.date, ctx.time)
    if (dateStr) {
      layers.push(textLayer({
        name: 'Date', text: dateStr,
        x: 80, y: h - 230, width: w - 160,
        fontFamily: font('Inter'), fontSize: 46, fontWeight: 600,
        fill: BRAND_COLORS.ink, opacity: 0.75,
      }))
    }
    if (ctx.venue) {
      layers.push(textLayer({
        name: 'Venue', text: ctx.venue,
        x: 80, y: h - 170, width: w - 160,
        fontFamily: font('Inter'), fontSize: 40, fontWeight: 400,
        fill: BRAND_COLORS.ink, opacity: 0.55,
      }))
    }
    layers.push(logo(LOGO_T, 80, h - 96, 60))
    return {
      id: uid(), name: ctx.title ?? 'Split post', format: format ?? '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 5. Dispatch ───────────────────────────────────────────────────────────

const dispatch: Template = {
  id: 'dispatch',
  name: 'Dispatch',
  description: 'Newspaper front-page aesthetic. Dramatic editorial feel, works with or without a photo.',
  category: 'event',
  thumb: {
    bg: BRAND_COLORS.cream,
    blocks: [
      { x: 7, y: 6, w: 86, h: 3.5, c: BRAND_COLORS.terra, o: 0.85 },
      { x: 7, y: 11, w: 86, h: 2.5, c: BRAND_COLORS.ink },
      { x: 7, y: 14, w: 86, h: 0.8, c: BRAND_COLORS.ink, o: 0.35 },
      { x: 18, y: 17, w: 64, h: 2.5, c: BRAND_COLORS.ink, o: 0.4 },
      { x: 7, y: 21, w: 86, h: 0.8, c: BRAND_COLORS.ink, o: 0.2 },
      { x: 7, y: 24, w: 82, h: 26, c: BRAND_COLORS.ink, o: 0.9 },
      { x: 7, y: 63, w: 86, h: 15, c: BRAND_COLORS.sandstone },
      { x: 7, y: 80, w: 86, h: 0.8, c: BRAND_COLORS.ink, o: 0.2 },
      { x: 7, y: 83, w: 55, h: 3.5, c: BRAND_COLORS.ink, o: 0.55 },
      { x: 7, y: 92, w: 65, h: 3, c: BRAND_COLORS.terra },
    ],
  },
  build: (ctx, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    const title = ctx.title ?? 'Event of the Year'
    const titleSize = title.length < 15 ? 155 : title.length < 25 ? 135 : title.length < 40 ? 110 : 90
    const dateLine = formatDate(ctx.date, ctx.time) ||
      new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const metaText = [ctx.venue, ctx.category].filter(Boolean).join(' · ') || 'Albuquerque, NM'
    const layers: Layer[] = [
      textLayer({
        name: 'Masthead', text: 'ABQ DISPATCH',
        x: 80, y: sy(80), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 6, align: 'center',
      }),
      shape({ shape: 'rect', x: 80, y: sy(142), width: w - 160, height: 4, fill: BRAND_COLORS.ink }),
      shape({ shape: 'rect', x: 80, y: sy(154), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.4 }),
      textLayer({
        name: 'Date Line', text: dateLine,
        x: 80, y: sy(176), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 24, fontWeight: 500,
        fill: BRAND_COLORS.ink, opacity: 0.45, align: 'center',
      }),
      shape({ shape: 'rect', x: 80, y: sy(222), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.25 }),
      textLayer({
        name: 'Title', text: title,
        x: 80, y: sy(258), width: w - 160,
        fontFamily: font('Fraunces'), fontSize: titleSize, fontWeight: 800,
        fill: BRAND_COLORS.ink, lineHeight: 0.9, letterSpacing: -1,
      }),
    ]
    if (ctx.imageUrl) {
      layers.push(imageLayer({ src: ctx.imageUrl, x: 80, y: sy(840), width: w - 160, height: sy(350), cornerRadius: 4, fit: 'cover' }))
    }
    layers.push(
      shape({ shape: 'rect', x: 80, y: h - 152, width: w - 160, height: 2, fill: BRAND_COLORS.ink, opacity: 0.25 }),
      textLayer({
        name: 'Meta', text: metaText,
        x: 80, y: h - 135, width: w - 160,
        fontFamily: font('Inter'), fontSize: 42, fontWeight: 400,
        fill: BRAND_COLORS.ink, opacity: 0.7,
      }),
      logo(LOGO_T, 80, h - 65, 52),
    )
    return {
      id: uid(), name: ctx.title ?? 'Dispatch post', format: format ?? '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 6. Golden Hour ────────────────────────────────────────────────────────

const goldenHour: Template = {
  id: 'golden-hour',
  name: 'Golden Hour',
  description: 'Warm sunset gradient. Atmospheric and inviting — works with or without a photo.',
  category: 'event',
  thumb: {
    gradient: { from: BRAND_COLORS.skyGold, to: BRAND_COLORS.night, angle: 155 },
    blocks: [
      { x: 7, y: 12, w: 86, h: 3.5, c: 'rgba(251,247,241,0.88)' },
      { x: 7, y: 18, w: 86, h: 0.8, c: 'rgba(232,214,183,0.55)' },
      { x: 10, y: 22, w: 80, h: 34, c: 'rgba(0,0,0,0.22)', r: 2 },
      { x: 7, y: 60, w: 86, h: 16, c: BRAND_COLORS.cream },
      { x: 40, y: 82, w: 20, h: 2.5, c: BRAND_COLORS.skyGold },
      { x: 7, y: 87, w: 86, h: 4, c: 'rgba(251,247,241,0.75)' },
      { x: 7, y: 95, w: 86, h: 3, c: 'rgba(251,247,241,0.4)' },
    ],
  },
  build: (ctx, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    const title = ctx.title ?? 'Your Event'
    const titleSize = title.length < 15 ? 170 : title.length < 25 ? 145 : title.length < 40 ? 115 : 95
    const layers: Layer[] = []
    if (ctx.category) {
      layers.push(textLayer({
        name: 'Category', text: ctx.category.toUpperCase(),
        x: 80, y: sy(150), width: w - 160,
        fontFamily: font('Inter'), fontSize: 44, fontWeight: 700,
        fill: BRAND_COLORS.cream, opacity: 0.9, letterSpacing: 5, align: 'center',
      }))
    }
    layers.push(shape({
      shape: 'rect', x: 240, y: sy(ctx.category ? 218 : 190), width: 600, height: 2,
      fill: BRAND_COLORS.sandstone, opacity: 0.6,
    }))
    if (ctx.imageUrl) {
      const photoY = sy(ctx.category ? 248 : 218)
      const photoH = sy(500)
      layers.push(imageLayer({ src: ctx.imageUrl, x: 90, y: photoY, width: w - 180, height: photoH, cornerRadius: 8, fit: 'cover' }))
      layers.push(shape({ shape: 'rect', x: 90, y: photoY, width: w - 180, height: photoH, fill: BRAND_COLORS.ink, opacity: 0.18, cornerRadius: 8 }))
    }
    const titleY = sy(ctx.imageUrl
      ? (ctx.category ? 810 : 778)
      : (ctx.category ? 460 : 430))
    layers.push(textLayer({
      name: 'Title', text: title,
      x: 80, y: titleY, width: w - 160,
      fontFamily: font('Fraunces'), fontSize: titleSize, fontWeight: 800,
      fill: BRAND_COLORS.cream, lineHeight: 0.92, align: 'center',
      shadow: { enabled: true, color: 'rgba(0,0,0,0.6)', blur: 24, offsetX: 0, offsetY: 4 },
    }))
    layers.push(shape({ shape: 'rect', x: Math.round((w - 100) / 2), y: h - 215, width: 100, height: 4, fill: BRAND_COLORS.skyGold }))
    const dateStr = formatDate(ctx.date, ctx.time)
    if (dateStr) {
      layers.push(textLayer({
        name: 'Date', text: dateStr,
        x: 80, y: h - 190, width: w - 160,
        fontFamily: font('Inter'), fontSize: 48, fontWeight: 600,
        fill: BRAND_COLORS.cream, align: 'center',
        shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', blur: 12, offsetX: 0, offsetY: 2 },
      }))
    }
    if (ctx.venue) {
      layers.push(textLayer({
        name: 'Venue', text: ctx.venue,
        x: 80, y: h - (dateStr ? 130 : 190), width: w - 160,
        fontFamily: font('Inter'), fontSize: 42, fontWeight: 400,
        fill: BRAND_COLORS.sandstone, align: 'center', opacity: 0.9,
      }))
    }
    layers.push(logo(LOGO_W, Math.round((w - Math.round(60 * LOGO_R)) / 2), h - 65, 60))
    return {
      id: uid(), name: ctx.title ?? 'Golden Hour post', format: format ?? '4:5',
      slides: [{
        id: uid(),
        background: { type: 'gradient', from: BRAND_COLORS.skyGold, to: BRAND_COLORS.night, angle: 155 },
        layers,
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── Paper ────────────────────────────────────────────────────────────────────
//   Ink-on-white editorial. Horizontal rules frame a photo, one bold headline
//   leads the eye, a single 3 px terra accent is the only color. Like a
//   well-made zine or weekend newspaper arts section.

const paper: Template = {
  id: 'paper',
  name: 'Paper',
  description: 'Ink-on-white editorial — rules frame the photo, headline leads. Minimal color.',
  category: 'event',
  thumb: {
    bg: '#F9F7F4',
    blocks: [
      { x: 7,  y: 8,    w: 86, h: 0.6, c: '#111111' },            // top rule
      { x: 7,  y: 10.5, w: 36, h: 2.5, c: '#111111', o: 0.85 },   // masthead logo placeholder
      { x: 50, y: 11,   w: 30, h: 1.8, c: '#111111', o: 0.28 },   // category label
      { x: 7,  y: 15,   w: 86, h: 0.5, c: '#111111', o: 0.16 },   // separator rule
      { x: 7,  y: 16,   w: 86, h: 32,  c: '#ddd6ce' },            // photo zone
      { x: 7,  y: 48,   w: 86, h: 0.6, c: '#111111' },            // photo bottom rule
      { x: 7,  y: 53,   w: 82, h: 10,  c: '#111111', o: 0.95 },   // headline
      { x: 7,  y: 65,   w: 20, h: 1.2, c: '#9a442d' },            // terra accent
      { x: 7,  y: 68.5, w: 58, h: 2.2, c: '#111111', o: 0.55 },   // date
      { x: 7,  y: 73,   w: 42, h: 1.8, c: '#111111', o: 0.38 },   // venue
      { x: 7,  y: 90,   w: 86, h: 0.5, c: '#111111', o: 0.16 },   // bottom rule
      { x: 50, y: 92,   w: 36, h: 1.8, c: '#111111', o: 0.26 },   // CTA right
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const isStory = fmt === '9:16'
    const topSafe = isStory ? Math.round(h * 0.12) : 46
    const botSafe = isStory ? Math.round(h * 0.15) : 80
    const mx = 72  // side margins

    // Scale helper — positions calibrated to 4:5 (h=1350)
    const sy = (y: number) => Math.round(y * h / 1350)

    const title = ctx.title ?? 'Event Title'
    const titleSize = title.length < 12 ? 118
                    : title.length < 26 ? 96
                    : title.length < 42 ? 74
                    : 58

    // Estimate title block height for downstream stacking
    const charsPerLine = Math.floor((w - mx * 2) / (titleSize * 0.52))
    const titleLines   = Math.min(Math.ceil(title.length / Math.max(charsPerLine, 1)), 4)
    const titleH       = titleLines * titleSize * 1.06

    // ── Vertical rhythm ──────────────────────────────────────────────────────
    const ruleTopY = topSafe
    const logoY    = ruleTopY + 14
    const rule2Y   = logoY + (isStory ? 58 : 50)      // clears the logo
    const photoY   = rule2Y + 4
    const photoH   = isStory ? Math.round(h * 0.36) : sy(490)
    const rule3Y   = photoY + photoH + 2
    const titleY   = rule3Y + 40
    const accentY  = titleY + titleH + 26
    const dateY    = accentY + 20
    const venueY   = dateY + sy(54)
    const ruleBotY = h - botSafe - 48
    const ctaY     = h - botSafe - 36

    const INK   = '#111111'
    const PAPER = '#F9F7F4'
    const LINEN = '#E2D9CF'   // placeholder when no event image

    const slide: Slide = {
      id: uid(),
      background: { type: 'color', color: PAPER },
      layers: ([
        // Top rule
        shape({ shape: 'rect', x: mx, y: ruleTopY, width: w - mx * 2, height: 2, fill: INK }),

        // Logo — terra keeps the masthead warm
        logo(LOGO_T, mx, logoY, isStory ? 42 : 34),

        // Category — right-aligned, ghosted, monospace
        ctx.category ? textLayer({
          name: 'Category',
          text: ctx.category.toUpperCase(),
          x: mx, y: logoY + (isStory ? 6 : 4),
          width: w - mx * 2,
          fontFamily: font('DM Mono'),
          fontSize: isStory ? 28 : 22,
          fontWeight: 500,
          fill: INK, opacity: 0.34,
          letterSpacing: 4, align: 'right',
        }) : null,

        // Separator rule (faint)
        shape({ shape: 'rect', x: mx, y: rule2Y, width: w - mx * 2, height: 1, fill: INK, opacity: 0.15 }),

        // Photo (or linen placeholder)
        ctx.imageUrl
          ? imageLayer({ src: ctx.imageUrl, x: mx, y: photoY, width: w - mx * 2, height: photoH, fit: 'cover' })
          : shape({ shape: 'rect', x: mx, y: photoY, width: w - mx * 2, height: photoH, fill: LINEN }),

        // Rule below photo
        shape({ shape: 'rect', x: mx, y: rule3Y, width: w - mx * 2, height: 2, fill: INK }),

        // Headline
        textLayer({
          name: 'Title',
          text: title,
          x: mx, y: titleY,
          width: w - mx * 2,
          fontFamily: font('Epilogue'),
          fontSize: titleSize, fontWeight: 900,
          fill: INK, lineHeight: 0.97, letterSpacing: -1,
        }),

        // Terra accent — the sole color touch
        shape({ shape: 'rect', x: mx, y: accentY, width: 72, height: 3, fill: BRAND_COLORS.terra }),

        // Date
        textLayer({
          name: 'Date',
          text: formatDate(ctx.date, ctx.time),
          x: mx, y: dateY,
          width: w - mx * 2,
          fontFamily: font('Inter'),
          fontSize: isStory ? 40 : 34, fontWeight: 500,
          fill: INK, opacity: 0.62, lineHeight: 1.2,
        }),

        // Venue
        ctx.venue ? textLayer({
          name: 'Venue',
          text: ctx.venue,
          x: mx, y: venueY,
          width: w - mx * 2,
          fontFamily: font('Inter'),
          fontSize: isStory ? 34 : 28, fontWeight: 400,
          fill: INK, opacity: 0.42, lineHeight: 1.2,
        }) : null,

        // Bottom rule
        shape({ shape: 'rect', x: mx, y: ruleBotY, width: w - mx * 2, height: 1, fill: INK, opacity: 0.15 }),

        // CTA — right-aligned, monospace, ghosted
        textLayer({
          name: 'CTA',
          text: ctx.cta ?? 'abqunplugged.com',
          x: mx, y: ctaY,
          width: w - mx * 2,
          fontFamily: font('DM Mono'),
          fontSize: isStory ? 26 : 21, fontWeight: 400,
          fill: INK, opacity: 0.27,
          letterSpacing: 2, align: 'right',
        }),
      ] as (Layer | null)[]).filter((l): l is Layer => l !== null),
    }

    return {
      id: uid(), name: ctx.title ?? 'Paper post', format: fmt,
      slides: [slide], createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════
//   BRAND TEMPLATES (7)
// ════════════════════════════════════════════════════════════════════════

// ── 7. Statement ──────────────────────────────────────────────────────────

const statement: Template = {
  id: 'statement',
  name: 'Statement',
  description: 'Pure brand typography card — no event or photo needed. Your voice, in ink.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.cream,
    blocks: [
      { x: 7, y: 7, w: 24, h: 2.5, c: BRAND_COLORS.terra },
      { x: 7, y: 12, w: 55, h: 3, c: BRAND_COLORS.terra, o: 0.75 },
      { x: 15, y: 32, w: 70, h: 9, c: BRAND_COLORS.ink },
      { x: 15, y: 43, w: 62, h: 9, c: BRAND_COLORS.ink },
      { x: 15, y: 54, w: 48, h: 9, c: BRAND_COLORS.ink },
      { x: 7, y: 93, w: 86, h: 2.5, c: BRAND_COLORS.terra },
      { x: 25, y: 98, w: 50, h: 3, c: BRAND_COLORS.terra, o: 0.7 },
    ],
  },
  build: (_, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    const layers: Layer[] = [
      shape({ shape: 'rect', x: 80, y: sy(78), width: 220, height: 4, fill: BRAND_COLORS.terra }),
      logo(LOGO_T, 80, sy(96), 76),
      shape({ shape: 'rect', x: 80, y: sy(188), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.15 }),
      textLayer({
        name: 'Statement', text: 'Find it before\neveryone else does.',
        x: 80, y: sy(320), width: w - 160,
        fontFamily: font('Epilogue'), fontSize: 160, fontWeight: 900,
        fill: BRAND_COLORS.ink, lineHeight: 0.88, letterSpacing: -2,
      }),
      shape({ shape: 'rect', x: 80, y: h - 120, width: w - 160, height: 4, fill: BRAND_COLORS.terra }),
      logo(LOGO_T, Math.round((w - Math.round(60 * LOGO_R)) / 2), h - 100, 60),
    ]
    return {
      id: uid(), name: 'Statement post', format: format ?? '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 8. Category Spotlight ─────────────────────────────────────────────────

const categorySpotlight: Template = {
  id: 'category-spotlight',
  name: 'Category Spotlight',
  description: 'Promote a section of the site — Music, Comedy, Outdoor, etc. Swap fill for the right category vibe.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.terra,
    blocks: [
      { x: 10, y: 12, w: 80, h: 3, c: 'rgba(251,247,241,0.7)' },
      { x: 7, y: 28, w: 86, h: 45, c: 'rgba(251,247,241,0.95)' },
      { x: 15, y: 95, w: 70, h: 4, c: 'rgba(251,247,241,0.6)' },
    ],
  },
  build: (ctx, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    const category = ctx.category ?? 'Music'
    const catUpper = category.toUpperCase()
    // Scale to fill width — shorter names get bigger
    const titleSize = catUpper.length < 5 ? 240 : catUpper.length < 8 ? 190 : catUpper.length < 12 ? 155 : 130
    const layers: Layer[] = [
      textLayer({
        name: 'Kicker', text: 'THIS WEEK IN',
        x: 80, y: sy(150), width: w - 160,
        fontFamily: font('Inter'), fontSize: 40, fontWeight: 700,
        fill: BRAND_COLORS.cream, opacity: 0.75, letterSpacing: 8, align: 'center',
      }),
      shape({ shape: 'rect', x: 280, y: sy(215), width: 520, height: 2, fill: BRAND_COLORS.cream, opacity: 0.4 }),
      textLayer({
        name: 'Category', text: catUpper,
        x: 80, y: sy(268), width: w - 160,
        fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 900,
        fill: BRAND_COLORS.cream, lineHeight: 0.88, align: 'center',
      }),
      shape({ shape: 'rect', x: 280, y: h - 390, width: 520, height: 2, fill: BRAND_COLORS.cream, opacity: 0.4 }),
      textLayer({
        name: 'Subcopy', text: 'All the best events in Albuquerque.',
        x: 80, y: h - 354, width: w - 160,
        fontFamily: font('Fraunces'), fontSize: 52, fontStyle: 'italic', fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.85, align: 'center', lineHeight: 1.2,
      }),
      logo(LOGO_W, Math.round((w - Math.round(60 * LOGO_R)) / 2), h - 100, 60),
    ]
    return {
      id: uid(), name: `${category} spotlight`, format: format ?? '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.terra }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 9. Weekend Preview ────────────────────────────────────────────────────

const weekendPreview: Template = {
  id: 'weekend-preview',
  name: 'Weekend Preview',
  description: 'Editorial teaser with 3 editable event slots. Works as a standalone or carousel cover.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.cream,
    blocks: [
      { x: 7, y: 6, w: 52, h: 3, c: BRAND_COLORS.terra, o: 0.8 },
      { x: 7, y: 11, w: 86, h: 2, c: BRAND_COLORS.ink },
      { x: 7, y: 14, w: 86, h: 0.6, c: BRAND_COLORS.ink, o: 0.35 },
      { x: 7, y: 20, w: 82, h: 12, c: BRAND_COLORS.ink, o: 0.9 },
      { x: 7, y: 40, w: 10, h: 3, c: BRAND_COLORS.terra },
      { x: 20, y: 40, w: 62, h: 3, c: BRAND_COLORS.ink, o: 0.7 },
      { x: 7, y: 47, w: 10, h: 3, c: BRAND_COLORS.terra },
      { x: 20, y: 47, w: 55, h: 3, c: BRAND_COLORS.ink, o: 0.7 },
      { x: 7, y: 54, w: 10, h: 3, c: BRAND_COLORS.terra },
      { x: 20, y: 54, w: 68, h: 3, c: BRAND_COLORS.ink, o: 0.7 },
      { x: 7, y: 93, w: 86, h: 2.5, c: BRAND_COLORS.terra },
      { x: 7, y: 98, w: 60, h: 3, c: BRAND_COLORS.terra, o: 0.75 },
    ],
  },
  build: (ctx, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    const today = new Date()
    // Saturday of this week
    const daysToSat = (6 - today.getDay() + 7) % 7 || 7
    const sat = new Date(today)
    sat.setDate(today.getDate() + daysToSat)
    const sun = new Date(sat)
    sun.setDate(sat.getDate() + 1)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const weekendRange = `${fmt(sat)} – ${fmt(sun)}`

    const layers: Layer[] = [
      logo(LOGO_T, 80, sy(64), 76),
      shape({ shape: 'rect', x: 80, y: sy(152), width: w - 160, height: 4, fill: BRAND_COLORS.ink }),
      shape({ shape: 'rect', x: 80, y: sy(152), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.35 }),
      textLayer({
        name: 'Date Range', text: weekendRange,
        x: 80, y: sy(174), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 24, fontWeight: 500,
        fill: BRAND_COLORS.ink, opacity: 0.45, align: 'center',
      }),
      shape({ shape: 'rect', x: 80, y: sy(218), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.2 }),
      textLayer({
        name: 'Headline', text: 'This Weekend\nin Burque',
        x: 80, y: sy(252), width: w - 160,
        fontFamily: font('Epilogue'), fontSize: 155, fontWeight: 900,
        fill: BRAND_COLORS.ink, lineHeight: 0.9, letterSpacing: -2,
      }),
      shape({ shape: 'rect', x: 80, y: sy(630), width: w - 160, height: 2, fill: BRAND_COLORS.ink, opacity: 0.15 }),
      // Item 01
      textLayer({
        name: 'No.', text: '01',
        x: 80, y: sy(660), width: 100,
        fontFamily: font('DM Mono'), fontSize: 44, fontWeight: 500,
        fill: BRAND_COLORS.terra,
      }),
      textLayer({
        name: 'Event 1', text: ctx.title ?? 'Event name here',
        x: 200, y: sy(668), width: w - 280,
        fontFamily: font('Fraunces'), fontSize: 52, fontStyle: 'italic', fontWeight: 400,
        fill: BRAND_COLORS.ink, lineHeight: 1.1,
      }),
      shape({ shape: 'rect', x: 80, y: sy(758), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.12 }),
      // Item 02
      textLayer({
        name: 'No.', text: '02',
        x: 80, y: sy(786), width: 100,
        fontFamily: font('DM Mono'), fontSize: 44, fontWeight: 500,
        fill: BRAND_COLORS.terra,
      }),
      textLayer({
        name: 'Event 2', text: 'Second event name',
        x: 200, y: sy(794), width: w - 280,
        fontFamily: font('Fraunces'), fontSize: 52, fontStyle: 'italic', fontWeight: 400,
        fill: BRAND_COLORS.ink, lineHeight: 1.1,
      }),
      shape({ shape: 'rect', x: 80, y: sy(884), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.12 }),
      // Item 03
      textLayer({
        name: 'No.', text: '03',
        x: 80, y: sy(912), width: 100,
        fontFamily: font('DM Mono'), fontSize: 44, fontWeight: 500,
        fill: BRAND_COLORS.terra,
      }),
      textLayer({
        name: 'Event 3', text: 'Third event name',
        x: 200, y: sy(920), width: w - 280,
        fontFamily: font('Fraunces'), fontSize: 52, fontStyle: 'italic', fontWeight: 400,
        fill: BRAND_COLORS.ink, lineHeight: 1.1,
      }),
      shape({ shape: 'rect', x: 80, y: h - 328, width: w - 160, height: 3, fill: BRAND_COLORS.terra }),
      // Large centered logo sits in the footer zone for brand presence
      logo(LOGO_T, Math.round((w - Math.round(80 * LOGO_R)) / 2), h - 230, 80),
    ]
    return {
      id: uid(), name: 'Weekend preview', format: format ?? '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 10. Mesa ──────────────────────────────────────────────────────────────

const mesa: Template = {
  id: 'mesa',
  name: 'Mesa',
  description: 'Atmospheric night-to-sage gradient. Place names, vibe copy, brand identity.',
  category: 'brand',
  thumb: {
    gradient: { from: BRAND_COLORS.night, to: BRAND_COLORS.sage, angle: 155 },
    blocks: [
      { x: 10, y: 10, w: 80, h: 3, c: 'rgba(251,247,241,0.55)' },
      { x: 7, y: 35, w: 86, h: 28, c: 'rgba(251,247,241,0.9)' },
      { x: 42, y: 70, w: 16, h: 2, c: 'rgba(232,214,183,0.6)' },
      { x: 10, y: 76, w: 80, h: 3.5, c: 'rgba(251,247,241,0.6)' },
      { x: 15, y: 98, w: 70, h: 3, c: 'rgba(251,247,241,0.5)' },
    ],
  },
  build: (ctx, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    const layers: Layer[] = [
      textLayer({
        name: 'Location', text: 'ALBUQUERQUE, NEW MEXICO',
        x: 80, y: sy(130), width: w - 160,
        fontFamily: font('Inter'), fontSize: 30, fontWeight: 700,
        fill: BRAND_COLORS.cream, opacity: 0.55, letterSpacing: 6, align: 'center',
      }),
      shape({ shape: 'rect', x: 340, y: sy(188), width: 400, height: 1, fill: BRAND_COLORS.sandstone, opacity: 0.45 }),
      textLayer({
        name: 'Place', text: ctx.tagline ?? 'Old Town to\nNob Hill.',
        x: 80, y: sy(320), width: w - 160,
        fontFamily: font('Fraunces'), fontSize: 170, fontStyle: 'italic', fontWeight: 400,
        fill: BRAND_COLORS.cream, lineHeight: 0.92, align: 'center',
      }),
      shape({ shape: 'rect', x: Math.round((w - 80) / 2), y: sy(850), width: 80, height: 3, fill: BRAND_COLORS.sandstone, opacity: 0.55 }),
      textLayer({
        name: 'Tagline', text: ctx.title ?? 'All the events. All the time.',
        x: 80, y: sy(890), width: w - 160,
        fontFamily: font('Inter'), fontSize: 46, fontWeight: 500,
        fill: BRAND_COLORS.cream, opacity: 0.7, align: 'center', lineHeight: 1.3,
      }),
      logo(LOGO_W, Math.round((w - Math.round(60 * LOGO_R)) / 2), h - 100, 60),
    ]
    return {
      id: uid(), name: 'Mesa post', format: format ?? '4:5',
      slides: [{
        id: uid(),
        background: { type: 'gradient', from: BRAND_COLORS.night, to: BRAND_COLORS.sage, angle: 155 },
        layers,
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 11. Tonight Drop ──────────────────────────────────────────────────────

const tonightDrop: Template = {
  id: 'tonight-drop',
  name: 'Tonight in ABQ',
  description: 'Daily promo — drop this any evening to drive /tonight traffic.',
  category: 'brand',
  thumb: {
    gradient: { from: BRAND_COLORS.night, to: BRAND_COLORS.terra, angle: 135 },
    blocks: [
      { x: 10, y: 14, w: 80, h: 3, c: 'rgba(232,214,183,0.75)' },
      { x: 7, y: 28, w: 86, h: 26, c: 'rgba(255,255,255,0.95)' },
      { x: 10, y: 58, w: 80, h: 5, c: 'rgba(255,255,255,0.7)' },
      { x: 10, y: 85, w: 80, h: 3.5, c: 'rgba(232,214,183,0.65)' },
    ],
  },
  build: (_, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    return {
      id: uid(), name: 'Tonight drop', format: format ?? '4:5',
      slides: [{
        id: uid(),
        background: { type: 'gradient', from: BRAND_COLORS.night, to: BRAND_COLORS.terra, angle: 135 },
        layers: [
          textLayer({
            name: 'Day', text: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
            x: 80, y: sy(180), width: w - 160,
            fontFamily: font('Inter'), fontSize: 40, fontWeight: 700,
            fill: BRAND_COLORS.sandstone, letterSpacing: 6, align: 'center',
          }),
          // Fixed: 190px + letterSpacing: 4 fits "TONIGHT" (7 chars) safely in 920px
          textLayer({
            name: 'Tonight', text: 'TONIGHT',
            x: 80, y: sy(340), width: w - 160,
            fontFamily: font('Epilogue'), fontSize: 190, fontWeight: 900,
            fill: BRAND_COLORS.white, letterSpacing: 4, align: 'center',
          }),
          textLayer({
            name: 'Subtitle', text: 'in Albuquerque',
            x: 80, y: sy(578), width: w - 160,
            fontFamily: font('Fraunces'), fontSize: 56, fontStyle: 'italic', fontWeight: 400,
            fill: BRAND_COLORS.white, opacity: 0.85, align: 'center',
          }),
          shape({ shape: 'rect', x: Math.round((w - 120) / 2), y: sy(680), width: 120, height: 3, fill: BRAND_COLORS.sandstone, opacity: 0.5 }),
          logo(LOGO_W, Math.round((w - Math.round(60 * LOGO_R)) / 2), h - 115, 60),
        ],
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 12. Hidden Gem ────────────────────────────────────────────────────────

const hiddenGem: Template = {
  id: 'hidden-gem',
  name: 'Hidden Gem',
  description: 'Venue or neighborhood spotlight — sage background, Fraunces italic.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.sage,
    blocks: [
      { x: 10, y: 11, w: 80, h: 3, c: 'rgba(232,214,183,0.7)' },
      { x: 7, y: 40, w: 86, h: 28, c: 'rgba(251,247,241,0.9)' },
      { x: 10, y: 74, w: 80, h: 4, c: 'rgba(251,247,241,0.75)' },
      { x: 15, y: 90, w: 70, h: 3, c: 'rgba(232,214,183,0.6)' },
    ],
  },
  build: (ctx, format) => {
    const { w, h } = CANVAS_DIMS[format ?? '4:5']
    const sy = (y: number) => Math.round(y * h / 1350)
    return {
      id: uid(), name: 'Hidden gem', format: format ?? '4:5',
      slides: [{
        id: uid(),
        background: ctx.imageUrl
          ? { type: 'image', src: ctx.imageUrl, fit: 'cover', overlayColor: BRAND_COLORS.night, overlayOpacity: 0.55 }
          : { type: 'color', color: BRAND_COLORS.sage },
        layers: [
          textLayer({
            name: 'Kicker', text: 'HIDDEN GEM',
            x: 80, y: sy(140), width: w - 160,
            fontFamily: font('Inter'), fontSize: 34, fontWeight: 700,
            fill: BRAND_COLORS.sandstone, letterSpacing: 6, align: 'center',
          }),
          textLayer({
            name: 'Name', text: ctx.title ?? ctx.venue ?? 'Venue name',
            x: 80, y: h / 2 - sy(140), width: w - 160,
            fontFamily: font('Fraunces'), fontSize: 130, fontStyle: 'italic', fontWeight: 400,
            fill: BRAND_COLORS.cream, align: 'center', lineHeight: 1.0,
          }),
          textLayer({
            name: 'Tagline', text: ctx.tagline ?? 'Why locals love it',
            x: 80, y: h - 360, width: w - 160,
            fontFamily: font('Inter'), fontSize: 38, fontWeight: 500,
            fill: BRAND_COLORS.cream, align: 'center', opacity: 0.9, lineHeight: 1.4,
          }),
          logo(LOGO_W, Math.round((w - Math.round(60 * LOGO_R)) / 2), h - 110, 60),
        ],
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 13. Blank ─────────────────────────────────────────────────────────────

const blank: Template = {
  id: 'blank',
  name: 'Blank Canvas',
  description: 'Start from scratch — add your own text, images, and shapes.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.cream,
    blocks: [
      { x: 44, y: 57, w: 12, h: 1.5, c: BRAND_COLORS.ink, o: 0.15 },
      { x: 49, y: 52, w: 2, h: 11, c: BRAND_COLORS.ink, o: 0.15 },
    ],
  },
  build: (_, format) => ({
    id: uid(), name: 'Blank post', format: format ?? '4:5',
    slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers: [] }],
    createdAt: Date.now(), updatedAt: Date.now(),
  }),
}

// ════════════════════════════════════════════════════════════════════════
//   STORY TEMPLATES (9:16 native)
// ════════════════════════════════════════════════════════════════════════

// ── 14. Story: Full Bleed ─────────────────────────────────────────────

const storyFullBleed: Template = {
  id: 'story-fullbleed',
  name: 'Story: Full Bleed',
  description: 'Full bleed photo with dark overlay, bold title, date, venue, and CTA. Best for 9:16.',
  category: 'event',
  thumb: {
    bg: '#000',
    blocks: [
      { x: 0, y: 0, w: 60, h: 125, c: '#555', o: 0.5 },
      { x: 5, y: 10, w: 50, h: 8, c: '#fff' },
      { x: 5, y: 75, w: 25, h: 4, c: '#9a442d' },
      { x: 5, y: 82, w: 35, h: 3, c: '#fff' },
      { x: 5, y: 88, w: 40, h: 3, c: '#c99b3b' },
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '9:16'
    const { w, h } = CANVAS_DIMS[fmt]
    const title = ctx.title ?? 'Event Title'
    const date = ctx.date ?? 'Date'
    const time = ctx.time ? ` · ${ctx.time}` : ''
    const venue = ctx.venue ?? 'Albuquerque, NM'
    const cta = ctx.cta ?? 'abqunplugged.com'
    const isStory = fmt === '9:16'
    const topSafe = isStory ? Math.round(h * 0.12) : Math.round(h * 0.08)
    const botSafe  = isStory ? Math.round(h * 0.15) : Math.round(h * 0.08)

    const titleFontSize = title.length > 20 ? 80 : title.length > 12 ? 100 : 130

    const layers: Layer[] = []

    // Full bleed photo background (via image layer if imageUrl provided)
    if (ctx.imageUrl) {
      layers.push(imageLayer({ src: ctx.imageUrl, x: 0, y: 0, width: w, height: h, fit: 'cover' }))
    }

    // Dark overlay
    layers.push(shape({ shape: 'rect', x: 0, y: 0, width: w, height: h, fill: '#000', opacity: 0.55 }))

    // Title
    layers.push(textLayer({
      name: 'title', text: title,
      x: 60, y: topSafe, width: w - 120,
      fontFamily: font('Epilogue'), fontSize: titleFontSize, fontWeight: 900,
      fill: '#fff', align: 'left', lineHeight: 1.1,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.6)', blur: 15, offsetX: 0, offsetY: 4 },
    }))

    // Date + Time
    layers.push(textLayer({
      name: 'dateTime', text: `${date}${time}`,
      x: 60, y: h - botSafe - 400, width: w - 120,
      fontFamily: font('Bebas Neue'), fontSize: 60, fontWeight: 400,
      fill: '#9a442d', align: 'left', letterSpacing: 3, uppercase: true,
    }))

    // Venue
    layers.push(textLayer({
      name: 'venue', text: venue,
      x: 60, y: h - botSafe - 300, width: w - 120,
      fontFamily: font('Inter'), fontSize: 36, fontWeight: 400,
      fill: '#fff', align: 'left', letterSpacing: 0.5,
    }))

    // CTA
    layers.push(textLayer({
      name: 'cta', text: cta,
      x: 60, y: h - botSafe - 160, width: w - 120,
      fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 400,
      fill: '#c99b3b', align: 'left', letterSpacing: 2, uppercase: true,
    }))

    return {
      id: uid(), name: 'Story: Full Bleed', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: '#000' }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 15. Story: Split ─────────────────────────────────────────────────

const storySplit: Template = {
  id: 'story-split',
  name: 'Story: Split',
  description: 'Top-half photo, cream bottom with title, date, time, venue, and CTA.',
  category: 'event',
  thumb: {
    bg: '#fbf7f1',
    blocks: [
      { x: 0, y: 0, w: 60, h: 55, c: '#555', o: 0.8 },
      { x: 3, y: 57, w: 4, h: 50, c: '#9a442d' },
      { x: 12, y: 60, w: 45, h: 8, c: '#1a1614' },
      { x: 12, y: 72, w: 30, h: 4, c: '#9a442d' },
      { x: 12, y: 79, w: 35, h: 3, c: '#1a1614' },
      { x: 12, y: 90, w: 40, h: 3, c: '#c99b3b' },
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '9:16'
    const { w, h } = CANVAS_DIMS[fmt]
    const title = ctx.title ?? 'Event Title'
    const date = ctx.date ?? 'Date'
    const time = ctx.time ?? ''
    const venue = ctx.venue ?? 'Albuquerque, NM'
    const cta = ctx.cta ?? 'abqunplugged.com'
    const isStory = fmt === '9:16'
    const botSafe  = isStory ? Math.round(h * 0.15) : Math.round(h * 0.08)
    const halfH = Math.round(h / 2)

    const layers: Layer[] = []

    // Top-half photo
    if (ctx.imageUrl) {
      layers.push(imageLayer({ src: ctx.imageUrl, x: 0, y: 0, width: w, height: halfH, fit: 'cover' }))
    }

    // Accent bar
    layers.push(shape({ shape: 'rect', x: 60, y: halfH + 40, width: 6, height: 360, fill: '#9a442d' }))

    // Title
    layers.push(textLayer({
      name: 'title', text: title,
      x: 90, y: halfH + 60, width: w - 150,
      fontFamily: font('Fraunces'), fontSize: 100, fontWeight: 900,
      fill: '#1a1614', align: 'left', letterSpacing: -0.5, lineHeight: 1.0,
    }))

    // Date
    layers.push(textLayer({
      name: 'date', text: date,
      x: 90, y: halfH + 260, width: w - 150,
      fontFamily: font('Bebas Neue'), fontSize: 48, fontWeight: 400,
      fill: '#9a442d', align: 'left', letterSpacing: 3, uppercase: true,
    }))

    // Time + Venue
    layers.push(textLayer({
      name: 'timeVenue', text: time ? `${time} · ${venue}` : venue,
      x: 90, y: halfH + 340, width: w - 150,
      fontFamily: font('Inter'), fontSize: 28, fontWeight: 400,
      fill: '#1a1614', align: 'left', letterSpacing: 0.5,
    }))

    // CTA
    layers.push(textLayer({
      name: 'cta', text: cta,
      x: 90, y: h - botSafe - 120, width: w - 150,
      fontFamily: font('DM Mono'), fontSize: 24, fontWeight: 400,
      fill: '#c99b3b', align: 'left', letterSpacing: 2, uppercase: true,
    }))

    return {
      id: uid(), name: 'Story: Split', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: '#fbf7f1' }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 16. Story: Type Only ─────────────────────────────────────────────

const storyTypeOnly: Template = {
  id: 'story-type',
  name: 'Story: Type Only',
  description: 'Dark night background, large centered title, category pill, date, and branding.',
  category: 'event',
  thumb: {
    bg: '#11141f',
    blocks: [
      { x: 5, y: 5, w: 50, h: 4, c: '#c99b3b' },
      { x: 10, y: 30, w: 40, h: 14, c: '#fff' },
      { x: 20, y: 48, w: 20, h: 6, c: '#9a442d', r: 10 },
      { x: 15, y: 58, w: 30, h: 4, c: '#fff' },
      { x: 20, y: 70, w: 20, h: 3, c: '#c99b3b' },
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '9:16'
    const { w, h } = CANVAS_DIMS[fmt]
    const title = ctx.title ?? 'Event Title'
    const date = ctx.date ?? 'Date'
    const time = ctx.time ? ` · ${ctx.time}` : ''
    const category = ctx.category ?? 'Event'
    const cta = ctx.cta ?? 'abqunplugged.com'
    const isStory = fmt === '9:16'
    const topSafe = isStory ? Math.round(h * 0.12) : Math.round(h * 0.08)
    const botSafe  = isStory ? Math.round(h * 0.15) : Math.round(h * 0.08)

    const titleFontSize = title.length > 20 ? 100 : title.length > 12 ? 130 : 150
    const centerY = Math.round(h * 0.42)  // visual center for title block
    const pillWidth = 320
    const pillHeight = 64
    const pillX = Math.round((w - pillWidth) / 2)
    const pillY = centerY + titleFontSize + 40

    const layers: Layer[] = []

    // Branding header
    layers.push(textLayer({
      name: 'branding', text: 'ABQ UNPLUGGED',
      x: 60, y: topSafe + 20, width: w - 120,
      fontFamily: font('Bebas Neue'), fontSize: 36, fontWeight: 400,
      fill: '#c99b3b', align: 'center', letterSpacing: 6, uppercase: true,
    }))

    // Large title
    layers.push(textLayer({
      name: 'title', text: title,
      x: 60, y: centerY, width: w - 120,
      fontFamily: font('Space Grotesk'), fontSize: titleFontSize, fontWeight: 700,
      fill: '#fff', align: 'center', letterSpacing: -1, lineHeight: 1.1,
    }))

    // Category pill background
    layers.push(shape({ shape: 'rect', x: pillX, y: pillY, width: pillWidth, height: pillHeight, fill: '#9a442d', cornerRadius: 32 }))

    // Category pill text
    layers.push(textLayer({
      name: 'category', text: category,
      x: pillX, y: pillY + 16, width: pillWidth,
      fontFamily: font('Inter'), fontSize: 30, fontWeight: 700,
      fill: '#fff', align: 'center', letterSpacing: 2, uppercase: true,
    }))

    // Date + Time
    layers.push(textLayer({
      name: 'dateTime', text: `${date}${time}`,
      x: 60, y: pillY + pillHeight + 60, width: w - 120,
      fontFamily: font('DM Mono'), fontSize: 32, fontWeight: 400,
      fill: '#fff', align: 'center', letterSpacing: 2,
    }))

    // CTA
    layers.push(textLayer({
      name: 'cta', text: cta,
      x: 60, y: h - botSafe - 80, width: w - 120,
      fontFamily: font('Epilogue'), fontSize: 22, fontWeight: 400,
      fill: '#c99b3b', align: 'center', letterSpacing: 3, uppercase: true,
      opacity: 0.7,
    }))

    return {
      id: uid(), name: 'Story: Type Only', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: '#11141f' }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════
//   EXPORTS
// ════════════════════════════════════════════════════════════════════════

export const TEMPLATES: Template[] = [
  // Event templates (7 feed + 3 story)
  poster, broadside, marquee, split, dispatch, goldenHour, paper,
  storyFullBleed, storySplit, storyTypeOnly,
  // Brand templates (7)
  statement, categorySpotlight, weekendPreview, mesa, tonightDrop, hiddenGem, blank,
]

export const EVENT_TEMPLATES  = TEMPLATES.filter(t => t.category === 'event')
export const PROMO_TEMPLATES  = TEMPLATES.filter(t => t.category === 'brand')
