import type { Design, Slide, Layer, TextLayer, BrandFontName } from '../types'
import { BRAND_COLORS, BRAND_FONTS, CANVAS_DIMS } from '../types'

/**
 * Templates are pure "design recipes" — given optional event data, they return
 * a Design (canvas + slides + layers). User can then customize everything.
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

function imageLayer(partial: { src: string; x: number; y: number; width: number; height: number; cornerRadius?: number }): Layer {
  return {
    id: uid(), name: 'Image', type: 'image',
    src: partial.src,
    x: partial.x, y: partial.y, width: partial.width, height: partial.height,
    rotation: 0, opacity: 1, visible: true, locked: false,
    cornerRadius: partial.cornerRadius ?? 0,
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
//   TEMPLATES
// ════════════════════════════════════════════════════════════════════════

export interface Template {
  id: string
  name: string
  description: string
  build: (ctx: TemplateContext) => Design
}

// ── 1. Poster (full-bleed image + dark gradient + bottom title) ──────────

const poster: Template = {
  id: 'poster',
  name: 'Poster',
  description: 'Full-bleed photo with bold bottom title. Highest impact in feed.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['4:5']
    const slide: Slide = {
      id: uid(),
      background: ctx.imageUrl
        ? { type: 'image', src: ctx.imageUrl, fit: 'cover', overlayColor: '#000000', overlayOpacity: 0.55 }
        : { type: 'gradient', from: BRAND_COLORS.terra, to: BRAND_COLORS.mesaBrown, angle: 135 },
      layers: [
        // Category pill
        ctx.category ? textLayer({
          name: 'Category', text: (ctx.category ?? '').toUpperCase(),
          x: 80, y: 120, width: w - 160,
          fontFamily: font('Inter'), fontSize: 34, fontWeight: 700,
          fill: BRAND_COLORS.white, opacity: 0.85, letterSpacing: 4,
        }) : null,
        // Title
        textLayer({
          name: 'Title', text: ctx.title ?? 'Your Title Here',
          x: 80, y: h - 560, width: w - 160,
          fontFamily: font('Epilogue'), fontSize: 120, fontWeight: 900,
          fill: BRAND_COLORS.white, lineHeight: 1.0,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.4)', blur: 24, offsetX: 0, offsetY: 4 },
        }),
        // Date + venue
        textLayer({
          name: 'Date & Venue',
          text: `${formatDate(ctx.date, ctx.time)}${ctx.venue ? `\n${ctx.venue}` : ''}`,
          x: 80, y: h - 260, width: w - 160,
          fontFamily: font('Inter'), fontSize: 42, fontWeight: 500,
          fill: BRAND_COLORS.white, opacity: 0.92, lineHeight: 1.3,
        }),
        // CTA
        textLayer({
          name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
          x: 80, y: h - 110, width: w - 160,
          fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
          fill: BRAND_COLORS.white, opacity: 0.7, letterSpacing: 2,
        }),
      ].filter(Boolean) as Layer[],
    }
    return {
      id: uid(), name: ctx.title ?? 'Poster post', format: '4:5',
      slides: [slide], createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 2. Mesa (terracotta block — no photo required) ───────────────────────

const mesa: Template = {
  id: 'mesa',
  name: 'Mesa',
  description: 'Solid terracotta with cream sans-serif. Works without a photo.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['4:5']
    return {
      id: uid(), name: ctx.title ?? 'Mesa post', format: '4:5',
      slides: [{
        id: uid(),
        background: { type: 'color', color: BRAND_COLORS.terra },
        layers: [
          shape({ shape: 'rect', x: 80, y: 80, width: 180, height: 10, fill: BRAND_COLORS.sandstone }),
          textLayer({
            name: 'Eyebrow', text: (ctx.category ?? 'EVENT').toUpperCase(),
            x: 80, y: 120, width: w - 160,
            fontFamily: font('Inter'), fontSize: 36, fontWeight: 700,
            fill: BRAND_COLORS.sandstone, opacity: 0.85, letterSpacing: 6,
          }),
          textLayer({
            name: 'Title', text: ctx.title ?? 'Your Title Here',
            x: 80, y: 260, width: w - 160,
            fontFamily: font('Epilogue'), fontSize: 150, fontWeight: 900,
            fill: BRAND_COLORS.cream, lineHeight: 0.95,
          }),
          textLayer({
            name: 'Tagline', text: ctx.tagline ?? ctx.venue ?? 'Albuquerque, NM',
            x: 80, y: h - 340, width: w - 160,
            fontFamily: font('Fraunces'), fontSize: 60, fontWeight: 400,
            fontStyle: 'italic',
            fill: BRAND_COLORS.sandstone, lineHeight: 1.25,
          }),
          textLayer({
            name: 'Date',
            text: formatDate(ctx.date, ctx.time),
            x: 80, y: h - 180, width: w - 160,
            fontFamily: font('DM Mono'), fontSize: 32, fontWeight: 500,
            fill: BRAND_COLORS.cream, opacity: 0.8, letterSpacing: 2,
          }),
          textLayer({
            name: 'CTA', text: 'abqunplugged.com',
            x: 80, y: h - 110, width: w - 160,
            fontFamily: font('DM Mono'), fontSize: 26, fontWeight: 500,
            fill: BRAND_COLORS.cream, opacity: 0.6, letterSpacing: 3,
          }),
        ],
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 3. Editorial (cream magazine cover with serif) ────────────────────────

const editorial: Template = {
  id: 'editorial',
  name: 'Editorial',
  description: 'Magazine-cover serif on cream. Best for spotlights and hidden gems.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['4:5']
    const layers: Layer[] = [
      textLayer({
        name: 'Kicker', text: 'ABQ UNPLUGGED · EDITORIAL',
        x: 80, y: 90, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 26, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 3,
      }),
      shape({ shape: 'rect', x: 80, y: 160, width: w - 160, height: 2, fill: BRAND_COLORS.terra, opacity: 0.4 }),
      textLayer({
        name: 'Title', text: ctx.title ?? 'Your Headline',
        x: 80, y: 220, width: w - 160,
        fontFamily: font('Fraunces'), fontSize: 140, fontWeight: 900,
        fill: BRAND_COLORS.ink, lineHeight: 0.95,
      }),
    ]
    if (ctx.imageUrl) {
      layers.push(imageLayer({ src: ctx.imageUrl, x: 80, y: h - 720, width: w - 160, height: 460, cornerRadius: 6 }))
    }
    layers.push(
      textLayer({
        name: 'Caption', text: ctx.tagline ?? ctx.venue ?? '',
        x: 80, y: h - 230, width: w - 160,
        fontFamily: font('Fraunces'), fontSize: 38, fontStyle: 'italic', fontWeight: 400,
        fill: BRAND_COLORS.ink, opacity: 0.7, lineHeight: 1.35,
      }),
      textLayer({
        name: 'Date', text: formatDate(ctx.date, ctx.time),
        x: 80, y: h - 130, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 2,
      }),
    )
    return {
      id: uid(), name: ctx.title ?? 'Editorial post', format: '4:5',
      slides: [{
        id: uid(),
        background: { type: 'color', color: BRAND_COLORS.cream },
        layers,
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 4. Story (9:16 for Instagram Stories) ─────────────────────────────────

const story: Template = {
  id: 'story',
  name: 'Story',
  description: '9:16 vertical for Instagram Stories. Safe-zone aware.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['9:16']
    return {
      id: uid(), name: ctx.title ?? 'Story post', format: '9:16',
      slides: [{
        id: uid(),
        background: ctx.imageUrl
          ? { type: 'image', src: ctx.imageUrl, fit: 'cover', overlayColor: '#000000', overlayOpacity: 0.45 }
          : { type: 'gradient', from: BRAND_COLORS.night, to: BRAND_COLORS.terra, angle: 180 },
        layers: [
          // Safe zone reminder: top 15% (288px) + bottom 22% (422px) have UI overlays
          textLayer({
            name: 'Tonight', text: 'TONIGHT IN ABQ',
            x: 80, y: 340, width: w - 160,
            fontFamily: font('Inter'), fontSize: 38, fontWeight: 700,
            fill: BRAND_COLORS.sandstone, letterSpacing: 6, align: 'center',
          }),
          textLayer({
            name: 'Title', text: ctx.title ?? 'Your Event',
            x: 80, y: 520, width: w - 160,
            fontFamily: font('Epilogue'), fontSize: 140, fontWeight: 900,
            fill: BRAND_COLORS.white, lineHeight: 0.95, align: 'center',
            shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', blur: 30, offsetX: 0, offsetY: 4 },
          }),
          textLayer({
            name: 'Meta', text: `${formatDate(ctx.date, ctx.time)}${ctx.venue ? `\n${ctx.venue}` : ''}`,
            x: 80, y: h - 700, width: w - 160,
            fontFamily: font('Inter'), fontSize: 44, fontWeight: 500,
            fill: BRAND_COLORS.white, lineHeight: 1.3, align: 'center', opacity: 0.95,
          }),
          textLayer({
            name: 'CTA', text: '→ abqunplugged.com',
            x: 80, y: h - 480, width: w - 160,
            fontFamily: font('DM Mono'), fontSize: 32, fontWeight: 500,
            fill: BRAND_COLORS.white, letterSpacing: 2, align: 'center', opacity: 0.8,
          }),
        ],
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 5. Square feed (1:1 classic) ──────────────────────────────────────────

const square: Template = {
  id: 'square',
  name: 'Square',
  description: '1:1 classic feed post. Dense layout.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['1:1']
    return {
      id: uid(), name: ctx.title ?? 'Square post', format: '1:1',
      slides: [{
        id: uid(),
        background: ctx.imageUrl
          ? { type: 'image', src: ctx.imageUrl, fit: 'cover', overlayColor: '#000000', overlayOpacity: 0.5 }
          : { type: 'color', color: BRAND_COLORS.terra },
        layers: [
          textLayer({
            name: 'Eyebrow', text: (ctx.category ?? 'ABQ').toUpperCase(),
            x: 60, y: 90, width: w - 120,
            fontFamily: font('Inter'), fontSize: 30, fontWeight: 700,
            fill: BRAND_COLORS.white, letterSpacing: 4, opacity: 0.85,
          }),
          textLayer({
            name: 'Title', text: ctx.title ?? 'Your Title',
            x: 60, y: h - 380, width: w - 120,
            fontFamily: font('Epilogue'), fontSize: 100, fontWeight: 900,
            fill: BRAND_COLORS.white, lineHeight: 1.0,
          }),
          textLayer({
            name: 'Meta', text: `${formatDate(ctx.date, ctx.time)}${ctx.venue ? ` · ${ctx.venue}` : ''}`,
            x: 60, y: h - 160, width: w - 120,
            fontFamily: font('Inter'), fontSize: 30, fontWeight: 500,
            fill: BRAND_COLORS.white, opacity: 0.9,
          }),
          textLayer({
            name: 'CTA', text: 'abqunplugged.com',
            x: 60, y: h - 100, width: w - 120,
            fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 500,
            fill: BRAND_COLORS.white, letterSpacing: 2, opacity: 0.6,
          }),
        ],
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 6. Blank (start from scratch) ─────────────────────────────────────────

const blank: Template = {
  id: 'blank',
  name: 'Blank Canvas',
  description: 'Empty canvas — add your own text, images, shapes.',
  build: () => ({
    id: uid(), name: 'Blank post', format: '4:5',
    slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers: [] }],
    createdAt: Date.now(), updatedAt: Date.now(),
  }),
}

// ── Quick-post presets (generic promos, no event required) ───────────────

const tonightDrop: Template = {
  id: 'tonight-drop',
  name: 'Tonight in ABQ',
  description: 'Daily promo — "What to do tonight" drop.',
  build: () => {
    const { w, h } = CANVAS_DIMS['4:5']
    return {
      id: uid(), name: 'Tonight drop', format: '4:5',
      slides: [{
        id: uid(),
        background: { type: 'gradient', from: BRAND_COLORS.night, to: BRAND_COLORS.terra, angle: 135 },
        layers: [
          textLayer({
            name: 'Date', text: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
            x: 80, y: 180, width: w - 160,
            fontFamily: font('Inter'), fontSize: 40, fontWeight: 700,
            fill: BRAND_COLORS.sandstone, letterSpacing: 6, align: 'center',
          }),
          textLayer({
            name: 'Kicker', text: 'TONIGHT',
            x: 80, y: 340, width: w - 160,
            fontFamily: font('Epilogue'), fontSize: 220, fontWeight: 900,
            fill: BRAND_COLORS.white, letterSpacing: 8, align: 'center',
          }),
          textLayer({
            name: 'Subtitle', text: 'in Albuquerque',
            x: 80, y: 600, width: w - 160,
            fontFamily: font('Fraunces'), fontSize: 56, fontStyle: 'italic', fontWeight: 400,
            fill: BRAND_COLORS.white, opacity: 0.85, align: 'center',
          }),
          textLayer({
            name: 'CTA', text: '→ abqunplugged.com/tonight',
            x: 80, y: h - 180, width: w - 160,
            fontFamily: font('DM Mono'), fontSize: 32, fontWeight: 500,
            fill: BRAND_COLORS.sandstone, align: 'center', letterSpacing: 2,
          }),
        ],
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

const weekendList: Template = {
  id: 'weekend-list',
  name: '5 Events This Weekend',
  description: 'Educational carousel — weekend picks (5 slides).',
  build: () => {
    const { w, h } = CANVAS_DIMS['4:5']
    const cover: Slide = {
      id: uid(),
      background: { type: 'color', color: BRAND_COLORS.terra },
      layers: [
        textLayer({
          name: 'Count', text: '5',
          x: 80, y: 180, width: w - 160,
          fontFamily: font('Epilogue'), fontSize: 480, fontWeight: 900,
          fill: BRAND_COLORS.cream, align: 'center', lineHeight: 1,
        }),
        textLayer({
          name: 'Headline', text: 'events\nthis weekend',
          x: 80, y: h - 700, width: w - 160,
          fontFamily: font('Fraunces'), fontSize: 96, fontStyle: 'italic', fontWeight: 400,
          fill: BRAND_COLORS.cream, align: 'center', lineHeight: 1.05,
        }),
        textLayer({
          name: 'Swipe', text: 'SWIPE →',
          x: 80, y: h - 180, width: w - 160,
          fontFamily: font('DM Mono'), fontSize: 34, fontWeight: 500,
          fill: BRAND_COLORS.cream, align: 'center', letterSpacing: 6, opacity: 0.75,
        }),
      ],
    }
    const pick = (n: number): Slide => ({
      id: uid(),
      background: { type: 'color', color: BRAND_COLORS.cream },
      layers: [
        textLayer({
          name: 'Number', text: `0${n}`,
          x: 80, y: 120, width: w - 160,
          fontFamily: font('DM Mono'), fontSize: 60, fontWeight: 500,
          fill: BRAND_COLORS.terra, letterSpacing: 4,
        }),
        textLayer({
          name: 'Title', text: `Event ${n} title`,
          x: 80, y: 280, width: w - 160,
          fontFamily: font('Epilogue'), fontSize: 120, fontWeight: 900,
          fill: BRAND_COLORS.ink, lineHeight: 0.95,
        }),
        textLayer({
          name: 'Meta', text: 'Day · Time · Venue',
          x: 80, y: h - 300, width: w - 160,
          fontFamily: font('Inter'), fontSize: 40, fontWeight: 500,
          fill: BRAND_COLORS.ink, opacity: 0.7,
        }),
        textLayer({
          name: 'Why', text: 'Why we love it...',
          x: 80, y: h - 180, width: w - 160,
          fontFamily: font('Fraunces'), fontSize: 34, fontStyle: 'italic', fontWeight: 400,
          fill: BRAND_COLORS.terra, lineHeight: 1.35,
        }),
      ],
    })
    return {
      id: uid(), name: 'Weekend picks', format: '4:5',
      slides: [cover, pick(1), pick(2), pick(3), pick(4), pick(5)],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

const hiddenGem: Template = {
  id: 'hidden-gem',
  name: 'Hidden Gem',
  description: 'Venue/neighborhood spotlight.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['4:5']
    return {
      id: uid(), name: 'Hidden gem', format: '4:5',
      slides: [{
        id: uid(),
        background: ctx.imageUrl
          ? { type: 'image', src: ctx.imageUrl, fit: 'cover', overlayColor: BRAND_COLORS.night, overlayOpacity: 0.55 }
          : { type: 'color', color: BRAND_COLORS.sage },
        layers: [
          textLayer({
            name: 'Kicker', text: 'HIDDEN GEM',
            x: 80, y: 140, width: w - 160,
            fontFamily: font('Inter'), fontSize: 34, fontWeight: 700,
            fill: BRAND_COLORS.sandstone, letterSpacing: 6, align: 'center',
          }),
          textLayer({
            name: 'Name', text: ctx.title ?? ctx.venue ?? 'Venue name',
            x: 80, y: h / 2 - 140, width: w - 160,
            fontFamily: font('Fraunces'), fontSize: 130, fontStyle: 'italic', fontWeight: 400,
            fill: BRAND_COLORS.cream, align: 'center', lineHeight: 1.0,
          }),
          textLayer({
            name: 'Tagline', text: ctx.tagline ?? 'Why locals love it',
            x: 80, y: h - 360, width: w - 160,
            fontFamily: font('Inter'), fontSize: 38, fontWeight: 500,
            fill: BRAND_COLORS.cream, align: 'center', opacity: 0.9, lineHeight: 1.4,
          }),
          textLayer({
            name: 'CTA', text: '@abqunplugged',
            x: 80, y: h - 130, width: w - 160,
            fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
            fill: BRAND_COLORS.sandstone, align: 'center', letterSpacing: 2, opacity: 0.7,
          }),
        ],
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

export const TEMPLATES: Template[] = [
  poster, mesa, editorial, square, story, blank,
  tonightDrop, weekendList, hiddenGem,
]

export const EVENT_TEMPLATES = [poster, mesa, editorial, square, story]
export const PROMO_TEMPLATES = [tonightDrop, weekendList, hiddenGem, blank]
