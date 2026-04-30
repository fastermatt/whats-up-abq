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

// ── 2. Broadside (cream, letterpress type-only) ───────────────────────────

const broadside: Template = {
  id: 'broadside',
  name: 'Broadside',
  description: 'Letterpress type poster — no photo needed. Maximum typographic punch.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['4:5']
    const title = ctx.title ?? 'Your Event'
    const titleSize = title.length < 15 ? 200 : title.length < 25 ? 170 : title.length < 40 ? 145 : 120
    const dateLine = [formatDate(ctx.date, ctx.time), ctx.venue].filter(Boolean).join('\n')
    const layers: Layer[] = [
      shape({ shape: 'rect', x: 80, y: 90, width: 180, height: 5, fill: BRAND_COLORS.terra }),
      textLayer({
        name: 'Masthead', text: 'ABQ UNPLUGGED',
        x: 80, y: 122, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 4,
      }),
      shape({ shape: 'rect', x: 80, y: 188, width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.2 }),
      textLayer({
        name: 'Title', text: title,
        x: 80, y: 230, width: w - 160,
        fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 900,
        fill: BRAND_COLORS.ink, lineHeight: 0.88, letterSpacing: -2,
      }),
      shape({ shape: 'rect', x: 80, y: 1010, width: w - 160, height: 4, fill: BRAND_COLORS.terra }),
    ]
    if (dateLine) {
      layers.push(textLayer({
        name: 'Date & Venue', text: dateLine,
        x: 80, y: 1042, width: w - 160,
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
      id: uid(), name: ctx.title ?? 'Broadside post', format: '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 3. Marquee (near-black theater marquee) ───────────────────────────────

const marquee: Template = {
  id: 'marquee',
  name: 'Marquee',
  description: 'Theater marquee on near-black. Bold all-caps centered type — no photo needed.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['4:5']
    const title = (ctx.title ?? 'Your Event').toUpperCase()
    const titleSize = title.length < 15 ? 220 : title.length < 20 ? 190 : title.length < 30 ? 160 : 130
    const ruleY = ctx.category ? 248 : 200
    const titleY = ruleY + 32
    const layers: Layer[] = []
    if (ctx.category) {
      layers.push(textLayer({
        name: 'Category', text: ctx.category.toUpperCase(),
        x: 80, y: 180, width: w - 160,
        fontFamily: font('Inter'), fontSize: 36, fontWeight: 700,
        fill: BRAND_COLORS.terra, letterSpacing: 6, align: 'center',
      }))
    }
    layers.push(
      shape({ shape: 'rect', x: 280, y: ruleY, width: 520, height: 2, fill: BRAND_COLORS.terra, opacity: 0.7 }),
      textLayer({
        name: 'Title', text: title,
        x: 80, y: titleY, width: w - 160,
        fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 900,
        fill: BRAND_COLORS.cream, lineHeight: 0.88, align: 'center',
      }),
      shape({ shape: 'rect', x: 280, y: 950, width: 520, height: 2, fill: BRAND_COLORS.terra, opacity: 0.7 }),
      textLayer({
        name: 'Date', text: formatDate(ctx.date, ctx.time),
        x: 80, y: 980, width: w - 160,
        fontFamily: font('Inter'), fontSize: 48, fontWeight: 500,
        fill: BRAND_COLORS.cream, opacity: 0.75, align: 'center',
      }),
    )
    if (ctx.venue) {
      layers.push(textLayer({
        name: 'Venue', text: ctx.venue,
        x: 80, y: 1060, width: w - 160,
        fontFamily: font('Inter'), fontSize: 42, fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.55, align: 'center',
      }))
    }
    layers.push(textLayer({
      name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
      x: 80, y: h - 95, width: w - 160,
      fontFamily: font('DM Mono'), fontSize: 30, fontWeight: 500,
      fill: BRAND_COLORS.cream, opacity: 0.4, align: 'center', letterSpacing: 2,
    }))
    return {
      id: uid(), name: ctx.title ?? 'Marquee post', format: '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: '#0c0b0a' }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 4. Split (photo top half, cream text bottom) ──────────────────────────

const split: Template = {
  id: 'split',
  name: 'Split',
  description: 'Photo top half, cream text bottom. Strongest with a vivid event photo.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['4:5']
    const splitY = Math.round(h * 0.52) // 702
    const title = ctx.title ?? 'Your Event'
    // Bigger title — needs to dominate the cream zone
    const titleSize = title.length < 15 ? 170 : title.length < 25 ? 145 : title.length < 40 ? 115 : 95
    const layers: Layer[] = []
    if (ctx.imageUrl) {
      layers.push(imageLayer({ src: ctx.imageUrl, x: 0, y: 0, width: w, height: splitY }))
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
    // Terra split rule — 6px for visual weight
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
    // Title — the hero of the cream zone
    layers.push(textLayer({
      name: 'Title', text: title,
      x: 80, y: textBaseY + (ctx.category ? 66 : 0), width: w - 160,
      fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 900,
      fill: BRAND_COLORS.ink, lineHeight: 0.92,
    }))
    // Date + venue anchored to bottom of cream zone — no dead gap
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
    layers.push(textLayer({
      name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
      x: 80, y: h - 80, width: w - 160,
      fontFamily: font('DM Mono'), fontSize: 30, fontWeight: 500,
      fill: BRAND_COLORS.terra, letterSpacing: 2,
    }))
    return {
      id: uid(), name: ctx.title ?? 'Split post', format: '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 5. Dispatch (newspaper front page) ────────────────────────────────────

const dispatch: Template = {
  id: 'dispatch',
  name: 'Dispatch',
  description: 'Newspaper front-page aesthetic. Dramatic editorial feel, works with or without a photo.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['4:5']
    const title = ctx.title ?? 'Event of the Year'
    const titleSize = title.length < 15 ? 155 : title.length < 25 ? 135 : title.length < 40 ? 110 : 90
    const dateLine = formatDate(ctx.date, ctx.time) ||
      new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const metaText = [ctx.venue, ctx.category].filter(Boolean).join(' · ') || 'Albuquerque, NM'
    const layers: Layer[] = [
      textLayer({
        name: 'Masthead', text: 'ABQ DISPATCH',
        x: 80, y: 80, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 6, align: 'center',
      }),
      shape({ shape: 'rect', x: 80, y: 142, width: w - 160, height: 4, fill: BRAND_COLORS.ink }),
      shape({ shape: 'rect', x: 80, y: 154, width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.4 }),
      textLayer({
        name: 'Date Line', text: dateLine,
        x: 80, y: 176, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 24, fontWeight: 500,
        fill: BRAND_COLORS.ink, opacity: 0.45, align: 'center',
      }),
      shape({ shape: 'rect', x: 80, y: 222, width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.25 }),
      textLayer({
        name: 'Title', text: title,
        x: 80, y: 258, width: w - 160,
        fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 900,
        fill: BRAND_COLORS.ink, lineHeight: 0.9, letterSpacing: -1,
      }),
    ]
    if (ctx.imageUrl) {
      layers.push(imageLayer({ src: ctx.imageUrl, x: 80, y: 840, width: w - 160, height: 350, cornerRadius: 4 }))
    }
    layers.push(
      shape({ shape: 'rect', x: 80, y: 1210, width: w - 160, height: 2, fill: BRAND_COLORS.ink, opacity: 0.25 }),
      textLayer({
        name: 'Meta', text: metaText,
        x: 80, y: 1228, width: w - 160,
        fontFamily: font('Inter'), fontSize: 42, fontWeight: 400,
        fill: BRAND_COLORS.ink, opacity: 0.7,
      }),
      textLayer({
        name: 'CTA', text: `Find tickets: ${ctx.cta ?? 'abqunplugged.com'}`,
        x: 80, y: h - 85, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 1,
      }),
    )
    return {
      id: uid(), name: ctx.title ?? 'Dispatch post', format: '4:5',
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 6. Golden Hour (sunset gradient, optional photo) ──────────────────────

const goldenHour: Template = {
  id: 'golden-hour',
  name: 'Golden Hour',
  description: 'Warm sunset gradient. Atmospheric and inviting — works with or without a photo.',
  build: (ctx) => {
    const { w, h } = CANVAS_DIMS['4:5']
    const title = ctx.title ?? 'Your Event'
    // Big enough to read on a warm gradient — shadows handle contrast
    const titleSize = title.length < 15 ? 170 : title.length < 25 ? 145 : title.length < 40 ? 115 : 95
    const layers: Layer[] = []
    if (ctx.category) {
      layers.push(textLayer({
        name: 'Category', text: ctx.category.toUpperCase(),
        x: 80, y: 150, width: w - 160,
        fontFamily: font('Inter'), fontSize: 44, fontWeight: 700,
        fill: BRAND_COLORS.cream, opacity: 0.9, letterSpacing: 5, align: 'center',
      }))
    }
    // Sandstone rule — 2px for visibility
    layers.push(shape({
      shape: 'rect', x: 240, y: ctx.category ? 218 : 190, width: 600, height: 2,
      fill: BRAND_COLORS.sandstone, opacity: 0.6,
    }))
    if (ctx.imageUrl) {
      // Photo inset — no color overlay. The gradient provides the warmth.
      // Slight dark vignette (ink not terra) so it doesn't clash with gold.
      const photoY = ctx.category ? 248 : 218
      layers.push(imageLayer({ src: ctx.imageUrl, x: 90, y: photoY, width: w - 180, height: 500, cornerRadius: 8 }))
      layers.push(shape({ shape: 'rect', x: 90, y: photoY, width: w - 180, height: 500, fill: BRAND_COLORS.ink, opacity: 0.18, cornerRadius: 8 }))
    }
    // Title — big and cream with strong shadow for gradient contrast
    const titleY = ctx.imageUrl
      ? (ctx.category ? 810 : 778)
      : (ctx.category ? 460 : 430)
    layers.push(textLayer({
      name: 'Title', text: title,
      x: 80, y: titleY, width: w - 160,
      fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 900,
      fill: BRAND_COLORS.cream, lineHeight: 0.92, align: 'center',
      shadow: { enabled: true, color: 'rgba(0,0,0,0.6)', blur: 24, offsetX: 0, offsetY: 4 },
    }))
    // Centered skyGold accent bar
    layers.push(shape({ shape: 'rect', x: Math.round((w - 100) / 2), y: 1160, width: 100, height: 4, fill: BRAND_COLORS.skyGold }))
    const dateStr = formatDate(ctx.date, ctx.time)
    if (dateStr) {
      layers.push(textLayer({
        name: 'Date', text: dateStr,
        x: 80, y: 1188, width: w - 160,
        fontFamily: font('Inter'), fontSize: 48, fontWeight: 600,
        fill: BRAND_COLORS.cream, align: 'center',
        shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', blur: 12, offsetX: 0, offsetY: 2 },
      }))
    }
    if (ctx.venue) {
      layers.push(textLayer({
        name: 'Venue', text: ctx.venue,
        x: 80, y: dateStr ? 1252 : 1188, width: w - 160,
        fontFamily: font('Inter'), fontSize: 42, fontWeight: 400,
        fill: BRAND_COLORS.sandstone, align: 'center', opacity: 0.9,
      }))
    }
    layers.push(textLayer({
      name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
      x: 80, y: h - 78, width: w - 160,
      fontFamily: font('DM Mono'), fontSize: 30, fontWeight: 500,
      fill: BRAND_COLORS.cream, opacity: 0.45, align: 'center', letterSpacing: 2,
    }))
    return {
      id: uid(), name: ctx.title ?? 'Golden Hour post', format: '4:5',
      slides: [{
        id: uid(),
        background: { type: 'gradient', from: BRAND_COLORS.skyGold, to: BRAND_COLORS.night, angle: 155 },
        layers,
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 7. Blank (start from scratch) ─────────────────────────────────────────

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
  poster, broadside, marquee, split, dispatch, goldenHour, blank,
  tonightDrop, weekendList, hiddenGem,
]

export const EVENT_TEMPLATES = [poster, broadside, marquee, split, dispatch, goldenHour]
export const PROMO_TEMPLATES = [tonightDrop, weekendList, hiddenGem, blank]
