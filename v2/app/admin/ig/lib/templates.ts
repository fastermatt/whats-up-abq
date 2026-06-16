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

/** One event slot in a multi-event digest template */
export interface TemplateEventSlot {
  title: string
  date?: string
  time?: string
  venue?: string
  category?: string
  imageUrl?: string
}

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
  /** YYYY-MM-DD date of the post (from digest date picker). Used by tonight/weekly templates. */
  postDate?: string
  /** Multi-event digest: populated by /admin/ig/digest */
  events?: TemplateEventSlot[]
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

    const hasImage = !!ctx.imageUrl
    const rawTitle = ctx.title ?? 'Your Title Here'
    const title = truncateAtWord(rawTitle, 58)

    // ── Bottom cluster anchors (shared by both layouts) ──────────────────
    const ctaY  = h - botSafe - 50
    const dateY = h - botSafe - 210

    // ── Layout A: photo present — title in lower third over a scrim ───────
    // ── Layout B: no photo — title centered higher, bigger, fills the frame
    const titleSize = hasImage
      ? (title.length < 10 ? 130 : title.length < 20 ? 110 : title.length < 35 ? 90 : 70)
      : (title.length < 12 ? 150 : title.length < 24 ? 124 : title.length < 40 ? 100 : 82)
    const titleY = hasImage
      ? h - botSafe - 545
      : Math.round(h * 0.34)   // upper-middle so the frame reads as composed, not empty

    // Layered dark scrim toward the bottom — guarantees title/meta legibility
    // over any busy photo (shape layers can't gradient, so stack rects).
    const scrim: Layer[] = hasImage ? [
      shape({ shape: 'rect', x: 0, y: Math.round(h * 0.46), width: w, height: Math.round(h * 0.54), fill: '#000000', opacity: 0.22 }),
      shape({ shape: 'rect', x: 0, y: Math.round(h * 0.62), width: w, height: Math.round(h * 0.38), fill: '#000000', opacity: 0.26 }),
      shape({ shape: 'rect', x: 0, y: Math.round(h * 0.78), width: w, height: Math.round(h * 0.22), fill: '#000000', opacity: 0.30 }),
    ] : []

    // No-photo decorative anchor: a single large centered ghosted wordmark
    // sits behind everything as an intentional watermark (same device as the
    // Weekly Five "5"). Centered + fits within width so it never clips an edge
    // or tangents the meta block.
    const ghost: Layer[] = !hasImage ? [
      textLayer({
        name: 'Ghost', text: 'ABQ',
        x: 0, y: Math.round(h * 0.30), width: w,
        fontFamily: font('Epilogue'), fontSize: 400, fontWeight: 900,
        fill: BRAND_COLORS.cream, opacity: 0.05, align: 'center', lineHeight: 1, letterSpacing: -10,
      }),
    ] : []

    const slide: Slide = {
      id: uid(),
      background: hasImage
        ? { type: 'image', src: ctx.imageUrl!, fit: 'cover', overlayColor: '#000000', overlayOpacity: 0.38 }
        : { type: 'gradient', from: BRAND_COLORS.terra, to: BRAND_COLORS.mesaBrown, angle: 135 },
      layers: [
        ...scrim,
        ...ghost,
        logo(LOGO_W, 80, topSafe, 60),
        ctx.category ? textLayer({
          name: 'Category', text: (ctx.category ?? '').toUpperCase(),
          x: 80, y: topSafe + 70, width: w - 160,
          fontFamily: font('Inter'), fontSize: 30, fontWeight: 700,
          fill: BRAND_COLORS.white, opacity: 0.7, letterSpacing: 6, align: 'left',
        }) : null,
        textLayer({
          name: 'Title', text: title,
          x: 80, y: titleY, width: w - 160,
          fontFamily: font('Fraunces'), fontSize: titleSize, fontWeight: 800,
          fill: BRAND_COLORS.white, lineHeight: 1.05, align: 'left',
          shadow: { enabled: true, color: 'rgba(0,0,0,0.45)', blur: 24, offsetX: 0, offsetY: 4 },
        }),
        textLayer({
          name: 'Date & Venue',
          text: `${formatDate(ctx.date, ctx.time)}${ctx.venue ? `\n${shortVenue(ctx.venue)}` : ''}`,
          x: 80, y: dateY, width: w - 160,
          fontFamily: font('Fraunces'), fontSize: 44, fontWeight: 400, fontStyle: 'italic',
          fill: BRAND_COLORS.white, opacity: 0.92, lineHeight: 1.3, align: 'left',
        }),
        textLayer({
          name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
          x: 80, y: ctaY, width: w - 160,
          fontFamily: font('DM Mono'), fontSize: 28, fontWeight: 500,
          fill: BRAND_COLORS.white, opacity: 0.75, letterSpacing: 2, align: 'left',
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
    const title = truncateAtWord(ctx.title ?? 'Your Event', 56)
    const titleSize = title.length < 15 ? 200 : title.length < 25 ? 170 : title.length < 40 ? 145 : 120
    const dateLine = [formatDate(ctx.date, ctx.time), ctx.venue ? shortVenue(ctx.venue) : ''].filter(Boolean).join('\n')
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
        name: 'Venue', text: shortVenue(ctx.venue),
        x: 80, y: h - 290, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 30, fontWeight: 500,
        fill: BRAND_COLORS.cream, opacity: 0.6, align: 'center', letterSpacing: 3,
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
    const rawTitle = ctx.title ?? 'Your Event'
    // Text zone height: from textBaseY+category to Date layer (h-230).
    // With category: (splitY+48+66) → (h-230) = ~304px. Max 2 lines.
    // Font sizes chosen so 2 lines × lineHeight(0.92) fit within that zone.
    // Max chars at each size: width(920) / (fontSize × 0.52) × 2 lines.
    const titleSize =
      rawTitle.length < 12 ? 110   // 1-2 lines, 14-16 chars/line
      : rawTitle.length < 22 ? 88  // 2 lines, 20 chars/line, 2×88×0.92=162px
      : rawTitle.length < 36 ? 68  // 2 lines, 26 chars/line, 2×68×0.92=125px
      : 52                         // 2 lines, 34 chars/line, 2×52×0.92=96px
    // Truncate beyond 2-line capacity to prevent bleed into Date layer
    const maxChars = Math.floor((w - 160) / (titleSize * 0.52)) * 2
    const title = truncateAtWord(rawTitle, maxChars)
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
        name: 'Venue', text: shortVenue(ctx.venue),
        x: 80, y: h - 170, width: w - 160,
        fontFamily: font('Inter'), fontSize: 40, fontWeight: 400,
        fill: BRAND_COLORS.ink, opacity: 0.6,
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
    const metaText = [ctx.venue ? shortVenue(ctx.venue) : '', ctx.category].filter(Boolean).join(' · ') || 'Albuquerque, NM'
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
    // Truncate at word boundary — with an image the title zone is only ~350px,
    // so cap length and size to keep it within 2 lines.
    const title = truncateAtWord(ctx.title ?? 'Your Event', 42)
    const titleSize = title.length < 15 ? 150 : title.length < 25 ? 125 : title.length < 36 ? 100 : 84
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
        name: 'Venue', text: shortVenue(ctx.venue),
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
          text: shortVenue(ctx.venue),
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

// ── 8. Signal ────────────────────────────────────────────────────────────
//   Philosophy: "Geometric Silence" — strict vertical grid, photo on the
//   left as a dedicated visual column, editorial type on near-black right.
//   Swiss formalism. Photo never competes with text — they coexist in
//   clearly bounded spatial zones.

const signal: Template = {
  id: 'signal',
  name: 'Signal',
  description: 'Left photo column + dark editorial type column. Grid precision, zero overlap.',
  category: 'event',
  thumb: {
    bg: '#0f0e0d',
    blocks: [
      { x: 0,  y: 0,  w: 38,  h: 100, c: '#4a2e1a', o: 0.85 }, // photo zone
      { x: 38, y: 0,  w: 1.8, h: 100, c: BRAND_COLORS.terra },  // rule
      { x: 43, y: 10, w: 22,  h: 2.2, c: BRAND_COLORS.cream, o: 0.65 }, // logo
      { x: 43, y: 32, w: 50,  h: 10,  c: BRAND_COLORS.cream },           // title
      { x: 43, y: 44, w: 50,  h: 8,   c: BRAND_COLORS.cream, o: 0.85 }, // title line 2
      { x: 43, y: 57, w: 10,  h: 1,   c: BRAND_COLORS.terra },           // accent rule
      { x: 43, y: 61, w: 45,  h: 2.5, c: BRAND_COLORS.cream, o: 0.65 }, // date
      { x: 43, y: 67, w: 32,  h: 2,   c: BRAND_COLORS.cream, o: 0.4 },  // venue
      { x: 43, y: 92, w: 42,  h: 1.5, c: BRAND_COLORS.cream, o: 0.25 }, // CTA
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const isStory = fmt === '9:16'
    const topSafe = isStory ? Math.round(h * 0.12) : 46
    const botSafe = isStory ? Math.round(h * 0.15) : 80
    const sy = (y: number) => Math.round(y * h / 1350)

    // Column geometry
    const photoW   = Math.round(w * 0.40)       // 40% left
    const ruleW    = 5
    const textX    = photoW + ruleW + 44         // padding inside right column
    const textW    = w - textX - 44

    const DARK     = '#0f0e0d'
    const title    = ctx.title ?? 'Your Event'
    const titleSize = title.length < 12 ? 130
                    : title.length < 22 ? 108
                    : title.length < 36 ? 88
                    : 70

    // Estimate title block height for downstream stacking
    const charsPerLine = Math.floor(textW / (titleSize * 0.52))
    const titleLines   = Math.min(Math.ceil(title.length / Math.max(charsPerLine, 1)), 4)
    const titleH       = titleLines * titleSize * 1.06

    // Vertical rhythm — title floats in the upper-middle of the right column
    const titleY   = Math.max(topSafe + 80, Math.round(h * 0.22))
    const accentY  = titleY + titleH + 32
    const dateY    = accentY + 22
    const venueY   = dateY + sy(60)
    const ctaY     = h - botSafe - 36

    const layers: Layer[] = [
      // Right-column dark background
      shape({ shape: 'rect', x: photoW, y: 0, width: w - photoW, height: h, fill: DARK }),

      // Photo column (or terra gradient if no photo)
      ctx.imageUrl
        ? imageLayer({ src: ctx.imageUrl, x: 0, y: 0, width: photoW, height: h, fit: 'cover' })
        : shape({ shape: 'rect', x: 0, y: 0, width: photoW, height: h, fill: BRAND_COLORS.mesaBrown }),

      // Terra rule — the only color touch on the right side
      shape({ shape: 'rect', x: photoW, y: 0, width: ruleW, height: h, fill: BRAND_COLORS.terra }),

      // Logo — small, top of right column
      logo(LOGO_W, textX, topSafe, isStory ? 42 : 34),

      // Category — DM Mono, terra, below logo
      ...(ctx.category ? [textLayer({
        name: 'Category', text: ctx.category.toUpperCase(),
        x: textX, y: topSafe + (isStory ? 58 : 50), width: textW,
        fontFamily: font('DM Mono'), fontSize: 24, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 5,
      })] : []),

      // Title — the dominant element on the right column
      textLayer({
        name: 'Title', text: title,
        x: textX, y: titleY, width: textW,
        fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 900,
        fill: BRAND_COLORS.cream, lineHeight: 0.92, letterSpacing: -1,
      }),

      // Accent rule under title
      shape({ shape: 'rect', x: textX, y: accentY, width: 56, height: 3, fill: BRAND_COLORS.terra }),

      // Date
      ...(formatDate(ctx.date, ctx.time) ? [textLayer({
        name: 'Date', text: formatDate(ctx.date, ctx.time),
        x: textX, y: dateY, width: textW,
        fontFamily: font('Inter'), fontSize: isStory ? 38 : 34, fontWeight: 600,
        fill: BRAND_COLORS.cream, opacity: 0.75, lineHeight: 1.25,
      })] : []),

      // Venue
      ...(ctx.venue ? [textLayer({
        name: 'Venue', text: shortVenue(ctx.venue),
        x: textX, y: venueY, width: textW,
        fontFamily: font('Inter'), fontSize: isStory ? 32 : 28, fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.5, lineHeight: 1.2,
      })] : []),

      // CTA — bottom of right column, ghosted
      textLayer({
        name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
        x: textX, y: ctaY, width: textW,
        fontFamily: font('DM Mono'), fontSize: 20, fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.3, letterSpacing: 2,
      }),
    ]

    return {
      id: uid(), name: ctx.title ?? 'Signal post', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: DARK }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 9. Stencil ────────────────────────────────────────────────────────────
//   Philosophy: "Concrete Poetry" — type as pure visual mass. The event
//   title IS the artwork. Monumental letterforms fill the frame from edge
//   to edge. Photo, when present, dissolves behind the type as ghosted
//   texture — felt, not seen. Every word a sculpture.

const stencil: Template = {
  id: 'stencil',
  name: 'Stencil',
  description: 'Monumental type fills the frame. Photo becomes texture behind the words.',
  category: 'event',
  thumb: {
    gradient: { from: '#0f0e0d', to: '#1a1614', angle: 160 },
    blocks: [
      { x: 5,  y: 8,  w: 18, h: 1.8, c: BRAND_COLORS.terra, o: 0.85 }, // category
      { x: 5,  y: 16, w: 90, h: 22,  c: BRAND_COLORS.cream, o: 0.95 }, // massive title L1
      { x: 5,  y: 40, w: 72, h: 22,  c: BRAND_COLORS.cream, o: 0.9  }, // massive title L2
      { x: 5,  y: 64, w: 55, h: 14,  c: BRAND_COLORS.cream, o: 0.8  }, // massive title L3
      { x: 5,  y: 83, w: 8,  h: 0.8, c: BRAND_COLORS.terra },           // terra rule
      { x: 5,  y: 87, w: 44, h: 2,   c: BRAND_COLORS.cream, o: 0.4  }, // date
      { x: 58, y: 91, w: 37, h: 1.8, c: BRAND_COLORS.cream, o: 0.3  }, // logo right
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const isStory = fmt === '9:16'
    const topSafe = isStory ? Math.round(h * 0.12) : 46
    const botSafe = isStory ? Math.round(h * 0.15) : 80
    const sy = (y: number) => Math.round(y * h / 1350)

    const mx    = 60
    const title = ctx.title ?? 'Your Event'

    // Monumental sizing — title length drives font size
    const titleSize = title.length < 6  ? 340
                    : title.length < 12 ? 270
                    : title.length < 20 ? 210
                    : title.length < 30 ? 170
                    : 138

    // Anchor the type block just below safe zone — it flows DOWN from there,
    // covering as much canvas as it needs. The visual weight IS the design.
    const titleY = topSafe + (ctx.category ? sy(80) : sy(48))

    // Bottom strip: small terra rule, then date + logo
    const ruleY  = h - botSafe - 80
    const dateY  = ruleY + 18
    const logoX  = w - mx - Math.round(42 * LOGO_R)

    const layers: Layer[] = [
      // Photo as ghost texture — the image is always subordinate to the type
      ...(ctx.imageUrl ? [imageLayer({
        src: ctx.imageUrl, x: 0, y: 0, width: w, height: h, fit: 'cover',
      })] : []),
      // Photo scrim — heavy, keeps type legible over any image
      ...(ctx.imageUrl ? [shape({
        shape: 'rect', x: 0, y: 0, width: w, height: h,
        fill: '#0f0e0d', opacity: 0.82,
      })] : []),

      // Category label — terra, tiny, precise
      ...(ctx.category ? [textLayer({
        name: 'Category', text: ctx.category.toUpperCase(),
        x: mx, y: topSafe + 6, width: w - mx * 2,
        fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 7,
      })] : []),

      // THE TITLE — monumental, filling the canvas with letterform mass
      textLayer({
        name: 'Title', text: title,
        x: mx, y: titleY, width: w - mx * 2,
        fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 900,
        fill: BRAND_COLORS.cream, lineHeight: 0.82, letterSpacing: -3,
      }),

      // Terra accent — sole color element below the type
      shape({ shape: 'rect', x: mx, y: ruleY, width: 48, height: 3, fill: BRAND_COLORS.terra }),

      // Date — clinical, monospace, small
      ...(formatDate(ctx.date, ctx.time) ? [textLayer({
        name: 'Date', text: formatDate(ctx.date, ctx.time),
        x: mx, y: dateY, width: w - mx * 2 - 200,
        fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.5, letterSpacing: 1,
      })] : []),

      // Logo — right-aligned, small, ghosted
      logo(LOGO_W, logoX, dateY - 2, 36),
    ]

    return {
      id: uid(), name: ctx.title ?? 'Stencil post', format: fmt,
      slides: [{
        id: uid(),
        background: { type: 'gradient', from: '#0f0e0d', to: '#1a1614', angle: 160 },
        layers,
      }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── 10. Terra ─────────────────────────────────────────────────────────────
//   Philosophy: "Committed" color strategy. The brand's terra cotta owns
//   100% of the surface. Everything else — type, photo frame, logo — is
//   cream against the warm field. Unmistakable in any feed. The photo, when
//   present, sits as a carefully framed inset: a window, not a bleed.

const terra: Template = {
  id: 'terra',
  name: 'Terra',
  description: 'Full terra background — the brand color owns the canvas. High feed contrast.',
  category: 'event',
  thumb: {
    bg: BRAND_COLORS.terra,
    blocks: [
      { x: 7,  y: 7,  w: 30,  h: 2.2, c: BRAND_COLORS.cream, o: 0.7 },  // logo
      { x: 7,  y: 16, w: 86,  h: 40,  c: BRAND_COLORS.cream, o: 0.12, r: 2 }, // photo frame
      { x: 7,  y: 60, w: 86,  h: 12,  c: BRAND_COLORS.cream, o: 0.95 }, // title
      { x: 7,  y: 75, w: 86,  h: 0.8, c: BRAND_COLORS.cream, o: 0.25 }, // rule
      { x: 7,  y: 79, w: 62,  h: 2.5, c: BRAND_COLORS.cream, o: 0.7 },  // date
      { x: 7,  y: 85, w: 42,  h: 2,   c: BRAND_COLORS.cream, o: 0.5 },  // venue
      { x: 7,  y: 92, w: 36,  h: 1.5, c: BRAND_COLORS.cream, o: 0.3 },  // CTA
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const isStory = fmt === '9:16'
    const topSafe = isStory ? Math.round(h * 0.12) : 46
    const botSafe = isStory ? Math.round(h * 0.15) : 80
    const sy = (y: number) => Math.round(y * h / 1350)

    const mx     = 80
    const title  = ctx.title ?? 'Your Event'
    const titleSize = title.length < 12 ? 155
                    : title.length < 24 ? 130
                    : title.length < 38 ? 105
                    : 85

    // ── Photo zone — framed inset ──────────────────────────────────────────
    // When a photo exists: cream border rect behind the image gives a
    // "framed print" effect. The frame is 8px on all sides.
    const photoMx    = mx
    const photoW     = w - photoMx * 2
    const photoH     = isStory ? Math.round(h * 0.38) : sy(520)
    const photoTopY  = topSafe + sy(100) // logo clears the top

    // ── Text zone ─────────────────────────────────────────────────────────
    // If photo present: text cluster starts ~32px below photo + frame
    // If no photo: title sits higher, dominating the cream-free terra field
    const textTopY   = ctx.imageUrl
      ? photoTopY + photoH + 48
      : topSafe + sy(200)

    const charsPerLine = Math.floor((w - mx * 2) / (titleSize * 0.52))
    const titleLines   = Math.min(Math.ceil(title.length / Math.max(charsPerLine, 1)), 4)
    const titleH       = titleLines * titleSize * 1.06
    const ruleY        = textTopY + titleH + 28
    const dateY        = ruleY + 18
    const venueY       = dateY + sy(60)
    const ctaY         = h - botSafe - 36

    const layers: Layer[] = [
      // Logo — cream on terra, top left
      logo(LOGO_W, mx, topSafe, isStory ? 46 : 36),

      // Photo frame (cream border effect) + photo
      ...(ctx.imageUrl ? [
        shape({
          shape: 'rect', x: photoMx - 8, y: photoTopY - 8,
          width: photoW + 16, height: photoH + 16,
          fill: BRAND_COLORS.cream, opacity: 0.18, cornerRadius: 10,
        }),
        imageLayer({
          src: ctx.imageUrl, x: photoMx, y: photoTopY,
          width: photoW, height: photoH, cornerRadius: 6, fit: 'cover',
        }),
      ] : []),

      // Title — Fraunces italic for warmth; cream on terra
      textLayer({
        name: 'Title', text: title,
        x: mx, y: textTopY, width: w - mx * 2,
        fontFamily: font('Fraunces'), fontSize: titleSize, fontWeight: 800,
        fill: BRAND_COLORS.cream, lineHeight: 0.94, letterSpacing: -1,
      }),

      // Thin cream rule — sole structural separator
      shape({ shape: 'rect', x: mx, y: ruleY, width: w - mx * 2, height: 1, fill: BRAND_COLORS.cream, opacity: 0.3 }),

      // Date
      ...(formatDate(ctx.date, ctx.time) ? [textLayer({
        name: 'Date', text: formatDate(ctx.date, ctx.time),
        x: mx, y: dateY, width: w - mx * 2,
        fontFamily: font('Inter'), fontSize: isStory ? 40 : 36, fontWeight: 600,
        fill: BRAND_COLORS.cream, opacity: 0.82, lineHeight: 1.25,
      })] : []),

      // Venue
      ...(ctx.venue ? [textLayer({
        name: 'Venue', text: shortVenue(ctx.venue),
        x: mx, y: venueY, width: w - mx * 2,
        fontFamily: font('Inter'), fontSize: isStory ? 34 : 30, fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.58, lineHeight: 1.2,
      })] : []),

      // CTA — bottom, ghosted
      textLayer({
        name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
        x: mx, y: ctaY, width: w - mx * 2,
        fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.38, letterSpacing: 2,
      }),
    ]

    return {
      id: uid(), name: ctx.title ?? 'Terra post', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.terra }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
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
      // Event 3 — reduced from 52 to 44px so 2 lines stay above the terra bar at h-328=1022.
      // At 44px: 2 lines × 44 × 1.1 = 97px → bottom at sy(920)+97 ≈ 1017, clears the bar.
      textLayer({
        name: 'Event 3', text: 'Third event name',
        x: 200, y: sy(920), width: w - 280,
        fontFamily: font('Fraunces'), fontSize: 44, fontStyle: 'italic', fontWeight: 400,
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

    // Date — moved from halfH+260 to halfH+300 to clear 2-line title bottom (~halfH+260)
    layers.push(textLayer({
      name: 'date', text: date,
      x: 90, y: halfH + 300, width: w - 150,
      fontFamily: font('Bebas Neue'), fontSize: 48, fontWeight: 400,
      fill: '#9a442d', align: 'left', letterSpacing: 3, uppercase: true,
    }))

    // Time + Venue — shifted down to match
    layers.push(textLayer({
      name: 'timeVenue', text: time ? `${time} · ${venue}` : venue,
      x: 90, y: halfH + 380, width: w - 150,
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
//   DIGEST TEMPLATES — multi-event, auto-populated
// ════════════════════════════════════════════════════════════════════════

// ── D1. Weekend Digest ────────────────────────────────────────────────────

const DIGEST_FALLBACKS: { title: string; venue: string; time: string; date?: string }[] = [
  { title: 'Event name here',       venue: 'Venue TBD',    time: '' },
  { title: 'Second event',          venue: 'Another Venue', time: '' },
  { title: 'Third event',           venue: 'Venue Name',   time: '' },
  { title: 'Fourth event',          venue: 'Venue Name',   time: '' },
  { title: 'Fifth event',           venue: 'Venue Name',   time: '' },
]

/**
 * Resolve a digest slot's display title.
 * DB events sometimes have empty title strings — fall back to venue name,
 * then to a generic placeholder so the text layer is never empty/invisible.
 */
function resolveTitle(raw: string, venue: string): string {
  const t = raw.trim()
  if (t) return t
  const v = venue.trim()
  if (v) return v
  return 'Event TBA'
}

/** "2025-05-24" → "Sat May 24" (uses noon to avoid DST edge-cases) */
function shortDay(date: string | undefined): string {
  if (!date) return ''
  const d = new Date(date + 'T12:00:00')
  const day = d.toLocaleDateString('en-US', { weekday: 'short' })
  const md  = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${day} ${md}`
}

// Stopwords/articles/conjunctions a truncation should never end on — ending a
// clipped title with "and…" or "of…" reads as a bug, not an editorial cut.
const TRAILING_STOPWORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'at', 'in', 'on', 'for', 'to',
  'with', 'from', 'by', 'an', '&', 'vs', 'feat', 'ft', 'w',
])

/**
 * Truncate a title at a word boundary (never mid-word), then drop any trailing
 * stopword so the ellipsis lands on a content word:
 *   "...an Evening of Beethoven and" → "...an Evening of Beethoven…"
 *   "Roy E. Disney Center for"        → "Roy E. Disney Center…"
 */
function truncateAtWord(title: string, max: number): string {
  if (title.length <= max) return title
  const cut = title.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  let snap = lastSpace > max * 0.4 ? cut.slice(0, lastSpace) : cut
  snap = snap.replace(/[,;:\-–—&]+$/, '').trim()
  const words = snap.split(/\s+/)
  while (words.length > 1 && TRAILING_STOPWORDS.has(words[words.length - 1].toLowerCase().replace(/[.,]/g, ''))) {
    words.pop()
  }
  return words.join(' ') + '…'
}

/**
 * Shorten a venue name for display. Strips sub-venue suffixes (": Bank of
 * America Theatre"), " - Albuquerque", and trailing connector phrases
 * ("Center for Performing Arts" → "Center") so the recognizable core remains.
 * Caps at 34 chars on a word boundary.
 */
function shortVenue(venue: string): string {
  let v = venue
    .replace(/\s*:\s*.+$/, '')           // ": Bank of America Theatre"
    .replace(/\s*-\s*Albuquerque$/i, '') // " - Albuquerque"
    .replace(/\s+for\s+Performing\s+Arts$/i, '') // "...Center for Performing Arts" → "...Center"
    .replace(/\s+at\s+the\s+.+$/i, '')   // "Kiva Auditorium at the ABQ Convention Center" → "Kiva Auditorium"
    .trim()
  if (v.length > 34) v = truncateAtWord(v, 34)
  return v
}

/**
 * Fixed-size title for Fraunces italic rows (weekendDigest).
 * All 5 rows use the same 36px — visual consistency over squeeze-to-fit.
 * Available width: w-280 = 800px. Char estimate: 0.62 × 36 = 22.3px.
 * Max chars = floor(800/22.3) = 35. Titles longer than that are truncated
 * at a word boundary so we never get "Phoenix Risi…" — only "Phoenix…".
 */
function frauncesTitleSize(title: string): { fontSize: number; text: string } {
  const MAX = 35
  const text = title.length > MAX ? truncateAtWord(title, MAX) : title
  return { fontSize: 36, text }
}

/**
 * Fixed-size title for Epilogue 700 rows (tonightList, weeklyFive).
 * All rows in a given template use the same size — no per-row variation.
 * Char estimate: 0.56 × fontSize (slightly conservative for bold).
 * Max chars = floor(availWidth / (fontSize × 0.56)).
 * Truncates at word boundary.
 */
function epilogueTitleSize(title: string, availWidth: number): { fontSize: number; text: string } {
  const FONT_SIZE = 40
  const MAX = Math.floor(availWidth / (FONT_SIZE * 0.56))
  const text = title.length > MAX ? truncateAtWord(title, MAX) : title
  return { fontSize: FONT_SIZE, text }
}

const weekendDigest: Template = {
  id: 'weekend-digest',
  name: 'Weekend Digest',
  description: '5-event weekend guide — auto-populates from top upcoming events. Gets saves.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.cream,
    blocks: [
      { x: 7,  y: 5,  w: 28, h: 2, c: BRAND_COLORS.terra, o: 0.7 },
      { x: 7,  y: 10, w: 70, h: 9, c: BRAND_COLORS.ink },
      { x: 7,  y: 22, w: 40, h: 2, c: BRAND_COLORS.ink, o: 0.5 },
      { x: 7,  y: 27, w: 86, h: 0.5, c: BRAND_COLORS.terra, o: 0.5 },
      { x: 7,  y: 32, w: 8,  h: 2.5, c: BRAND_COLORS.terra }, { x: 18, y: 32, w: 68, h: 2.5, c: BRAND_COLORS.ink, o: 0.75 },
      { x: 7,  y: 40, w: 8,  h: 2.5, c: BRAND_COLORS.terra }, { x: 18, y: 40, w: 58, h: 2.5, c: BRAND_COLORS.ink, o: 0.75 },
      { x: 7,  y: 48, w: 8,  h: 2.5, c: BRAND_COLORS.terra }, { x: 18, y: 48, w: 72, h: 2.5, c: BRAND_COLORS.ink, o: 0.75 },
      { x: 7,  y: 56, w: 8,  h: 2.5, c: BRAND_COLORS.terra }, { x: 18, y: 56, w: 63, h: 2.5, c: BRAND_COLORS.ink, o: 0.75 },
      { x: 7,  y: 64, w: 8,  h: 2.5, c: BRAND_COLORS.terra }, { x: 18, y: 64, w: 55, h: 2.5, c: BRAND_COLORS.ink, o: 0.75 },
      { x: 7,  y: 93, w: 86, h: 2,   c: BRAND_COLORS.terra },
      { x: 22, y: 97, w: 56, h: 2.5, c: BRAND_COLORS.terra, o: 0.5 },
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const sy = (y: number) => Math.round(y * h / 1350)

    // Weekend date range — derive from the actual selected events when present
    // (so "this weekend" generation shows the right dates), else the next Sat/Sun.
    const fmtD = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const evDates = (ctx.events ?? [])
      .map(e => e.date).filter((d): d is string => !!d).sort()
    let weekendRange: string
    if (evDates.length > 0) {
      const first = new Date(evDates[0] + 'T12:00:00')
      const last  = new Date(evDates[evDates.length - 1] + 'T12:00:00')
      weekendRange = first.getTime() === last.getTime()
        ? fmtD(first)
        : `${fmtD(first)} – ${fmtD(last)}`
    } else {
      const today = new Date()
      const daysToSat = (6 - today.getDay() + 7) % 7 || 7
      const sat = new Date(today); sat.setDate(today.getDate() + daysToSat)
      const sun = new Date(sat); sun.setDate(sat.getDate() + 1)
      weekendRange = `${fmtD(sat)} – ${fmtD(sun)}`
    }

    // Merge provided events with fallbacks; guard against empty titles from DB
    const slots = Array.from({ length: 5 }, (_, i) => {
      const e = ctx.events?.[i]
      if (e) {
        const venue = e.venue ?? ''
        return { title: resolveTitle(e.title, venue), venue, time: e.time ?? '', date: e.date }
      }
      return DIGEST_FALLBACKS[i]
    })

    // Layout constants (all in 1350-unit space, scaled by sy())
    const ROW_START = 480
    const ROW_H     = 152   // bumped from 136 — gives meta + divider proper breathing room

    const layers: Layer[] = [
      logo(LOGO_T, 80, sy(42), 50),
      // Terra accent rule above kicker
      shape({ shape: 'rect', x: 80, y: sy(108), width: 220, height: 2, fill: BRAND_COLORS.terra, opacity: 0.7 }),
      // Kicker carries the weekend dates so no separate date line is needed
      // (the 175px headline leaves no clean gap between itself and the rows).
      textLayer({
        name: 'Kicker', text: `WEEKEND GUIDE · ${weekendRange.toUpperCase()}`,
        x: 80, y: sy(122), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 19, fontWeight: 500,
        fill: BRAND_COLORS.terra, letterSpacing: 5, opacity: 0.9,
      }),
      // Headline — "This Weekend" fills the upper area; bottom of line 2 ≈ sy(460)
      textLayer({
        name: 'Headline', text: 'This\nWeekend',
        x: 80, y: sy(155), width: w - 160,
        fontFamily: font('Epilogue'), fontSize: 175, fontWeight: 900,
        fill: BRAND_COLORS.ink, lineHeight: 0.82, letterSpacing: -4,
      }),
      // Section rule sits just above the first row (ROW_START 480), below headline
      shape({ shape: 'rect', x: 80, y: sy(466), width: w - 160, height: 2, fill: BRAND_COLORS.terra, opacity: 0.55 }),
    ]

    // 5 event rows
    slots.forEach((slot, i) => {
      const y   = sy(ROW_START + i * ROW_H)
      const num = String(i + 1).padStart(2, '0')
      const meta = [shortDay(slot.date), slot.time, slot.venue ? shortVenue(slot.venue) : ''].filter(Boolean).join(' · ')
      // Scale font so title always fits in ~1 line — no wrapping, no collisions
      const { fontSize: titleSize, text: titleText } = frauncesTitleSize(slot.title)
      layers.push(
        textLayer({
          name: `No.${num}`, text: num,
          x: 80, y: y, width: 90,
          fontFamily: font('DM Mono'), fontSize: 32, fontWeight: 500,
          fill: BRAND_COLORS.terra,
        }),
        textLayer({
          name: `Event ${i + 1}`, text: titleText,
          x: 180, y: y + sy(4), width: w - 280,
          fontFamily: font('Fraunces'), fontSize: titleSize, fontStyle: 'italic', fontWeight: 400,
          fill: BRAND_COLORS.ink, lineHeight: 1.05,
        }),
        ...(meta ? [textLayer({
          name: `Meta ${i + 1}`, text: meta,
          x: 180, y: y + sy(62), width: w - 280,
          fontFamily: font('Inter'), fontSize: 22, fontWeight: 500,
          fill: BRAND_COLORS.ink, opacity: 0.62, lineHeight: 1,
        })] : []),
        shape({ shape: 'rect', x: 80, y: y + sy(118), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.22 }),
      )
    })

    // Footer
    const footerY = sy(ROW_START + 5 * ROW_H + 18)
    layers.push(
      shape({ shape: 'rect', x: 80, y: footerY, width: w - 160, height: 3, fill: BRAND_COLORS.terra }),
      logo(LOGO_T, Math.round((w - Math.round(52 * LOGO_R)) / 2), footerY + sy(26), 52),
    )

    return {
      id: uid(), name: 'Weekend digest', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── D2. Tonight List ──────────────────────────────────────────────────────

const tonightList: Template = {
  id: 'tonight-list',
  name: 'Tonight in ABQ',
  description: 'Dark 5-event tonight lineup. Drop it daily to drive /tonight traffic.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.night,
    blocks: [
      { x: 7,  y: 6,  w: 30, h: 2.5, c: 'rgba(255,255,255,0.2)' },
      { x: 7,  y: 12, w: 80, h: 12,  c: BRAND_COLORS.terra, o: 0.9 },
      { x: 7,  y: 27, w: 50, h: 2,   c: 'rgba(255,255,255,0.35)' },
      { x: 7,  y: 32, w: 86, h: 0.5, c: 'rgba(255,255,255,0.2)' },
      { x: 7,  y: 36, w: 78, h: 2.5, c: 'rgba(255,255,255,0.8)' },
      { x: 7,  y: 41, w: 35, h: 1.5, c: BRAND_COLORS.terra, o: 0.7 },
      { x: 7,  y: 47, w: 68, h: 2.5, c: 'rgba(255,255,255,0.8)' },
      { x: 7,  y: 52, w: 30, h: 1.5, c: BRAND_COLORS.terra, o: 0.7 },
      { x: 7,  y: 58, w: 82, h: 2.5, c: 'rgba(255,255,255,0.8)' },
      { x: 7,  y: 63, w: 42, h: 1.5, c: BRAND_COLORS.terra, o: 0.7 },
      { x: 7,  y: 69, w: 58, h: 2.5, c: 'rgba(255,255,255,0.8)' },
      { x: 7,  y: 74, w: 38, h: 1.5, c: BRAND_COLORS.terra, o: 0.7 },
      { x: 7,  y: 80, w: 74, h: 2.5, c: 'rgba(255,255,255,0.8)' },
      { x: 7,  y: 85, w: 27, h: 1.5, c: BRAND_COLORS.terra, o: 0.7 },
      { x: 22, y: 96, w: 56, h: 2.5, c: 'rgba(255,255,255,0.2)' },
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const sy = (y: number) => Math.round(y * h / 1350)

    const postD = ctx.postDate
      ? new Date(ctx.postDate + 'T12:00:00')
      : new Date()
    const dayStr = postD.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: 'America/Denver',
    })

    // "Tonight" must mean ONE night. Enforce the template's own contract: if a
    // postDate is set, keep only events on that exact day, so a "TONIGHT /
    // FRIDAY" header can never sit over Saturday/Sunday events (which happens
    // when a multi-day range is fed in from the digest builder).
    const sameNight = ctx.postDate
      ? (ctx.events ?? []).filter(e => e.date === ctx.postDate)
      : (ctx.events ?? [])
    // Render only real rows; pad with design placeholders ONLY when there's no
    // data at all (empty-state preview). A sparse night shows 3 rows, not 3 + 2
    // "Event name here" placeholders.
    const rowCount = sameNight.length > 0 ? Math.min(sameNight.length, 5) : 5
    const slots = Array.from({ length: rowCount }, (_, i) => {
      const e = sameNight[i]
      if (e) {
        const venue = e.venue ?? ''
        return { title: resolveTitle(e.title, venue), time: e.time ?? '', venue, date: e.date }
      }
      return { ...DIGEST_FALLBACKS[i], time: '' }
    })

    const ROW_START = 400
    const ROW_H     = 156   // bumped from 144

    const layers: Layer[] = [
      logo(LOGO_W, 80, sy(42), 50),
      // "TONIGHT" — big terra block headline
      textLayer({
        name: 'Tonight', text: 'TONIGHT',
        x: 80, y: sy(108), width: w - 160,
        fontFamily: font('Epilogue'), fontSize: 148, fontWeight: 900,
        fill: BRAND_COLORS.terra, letterSpacing: -2, lineHeight: 1,
      }),
      textLayer({
        name: 'Day', text: dayStr.toUpperCase(),
        x: 80, y: sy(270), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 500,
        fill: BRAND_COLORS.cream, opacity: 0.62, letterSpacing: 3,
      }),
      shape({ shape: 'rect', x: 80, y: sy(314), width: w - 160, height: 1, fill: BRAND_COLORS.cream, opacity: 0.25 }),
      // "in ABQ" italic accent under TONIGHT
      textLayer({
        name: 'In ABQ', text: 'in ABQ',
        x: 80, y: sy(330), width: w - 160,
        fontFamily: font('Fraunces'), fontSize: 52, fontStyle: 'italic', fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.55,
      }),
    ]

    // 5 event rows
    slots.forEach((slot, i) => {
      const y    = sy(ROW_START + i * ROW_H)
      // No per-row date here: the header already states the night, so rows show
      // only time · venue (a date would be redundant, or contradictory if wrong).
      const meta = [slot.time, slot.venue ? shortVenue(slot.venue) : ''].filter(Boolean).join(' · ')
      const { fontSize: titleSize, text: titleText } = epilogueTitleSize(slot.title, w - 160)
      layers.push(
        textLayer({
          name: `Event ${i + 1}`, text: titleText,
          x: 80, y: y, width: w - 160,
          fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 700,
          fill: BRAND_COLORS.cream, lineHeight: 1.05, letterSpacing: -0.5,
        }),
        ...(meta ? [textLayer({
          name: `Meta ${i + 1}`, text: meta,
          // skyGold (warm amber) reads far brighter than terra on the night bg —
          // terra is too dark-on-dark for the must-read date/venue line.
          x: 80, y: y + sy(64), width: w - 160,
          fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 500,
          fill: BRAND_COLORS.skyGold, opacity: 0.95, lineHeight: 1,
        })] : []),
        shape({ shape: 'rect', x: 80, y: y + sy(122), width: w - 160, height: 1, fill: BRAND_COLORS.cream, opacity: 0.18 }),
      )
    })

    // Footer
    const footerY = sy(ROW_START + 5 * ROW_H + 22)
    layers.push(
      logo(LOGO_W, Math.round((w - Math.round(52 * LOGO_R)) / 2), footerY, 52),
      textLayer({
        name: 'URL', text: 'abqunplugged.com',
        x: 80, y: footerY + sy(68), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 20, fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.6, align: 'center', letterSpacing: 2,
      }),
    )

    return {
      id: uid(), name: 'Tonight list', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.night }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── D3. Weekly Five ───────────────────────────────────────────────────────

const weeklyFive: Template = {
  id: 'weekly-five',
  name: 'Weekly Five',
  description: '5 curated picks for the week. Terra background, bold editorial feel.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.terra,
    blocks: [
      { x: 7,  y: 6,  w: 28, h: 2,   c: 'rgba(251,247,241,0.25)' },
      { x: 7,  y: 12, w: 55, h: 6,   c: 'rgba(251,247,241,0.9)' },
      { x: 7,  y: 20, w: 35, h: 3,   c: 'rgba(251,247,241,0.5)' },
      { x: 60, y: 5,  w: 30, h: 22,  c: 'rgba(251,247,241,0.06)' }, // watermark
      { x: 7,  y: 28, w: 86, h: 0.5, c: 'rgba(251,247,241,0.25)' },
      { x: 7,  y: 33, w: 8,  h: 2.5, c: 'rgba(251,247,241,0.35)' }, { x: 18, y: 33, w: 68, h: 2.5, c: 'rgba(251,247,241,0.85)' },
      { x: 7,  y: 41, w: 8,  h: 2.5, c: 'rgba(251,247,241,0.35)' }, { x: 18, y: 41, w: 55, h: 2.5, c: 'rgba(251,247,241,0.85)' },
      { x: 7,  y: 49, w: 8,  h: 2.5, c: 'rgba(251,247,241,0.35)' }, { x: 18, y: 49, w: 72, h: 2.5, c: 'rgba(251,247,241,0.85)' },
      { x: 7,  y: 57, w: 8,  h: 2.5, c: 'rgba(251,247,241,0.35)' }, { x: 18, y: 57, w: 60, h: 2.5, c: 'rgba(251,247,241,0.85)' },
      { x: 7,  y: 65, w: 8,  h: 2.5, c: 'rgba(251,247,241,0.35)' }, { x: 18, y: 65, w: 48, h: 2.5, c: 'rgba(251,247,241,0.85)' },
      { x: 22, y: 95, w: 56, h: 2.5, c: 'rgba(251,247,241,0.25)' },
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const sy = (y: number) => Math.round(y * h / 1350)

    // Week range
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today); monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const fmtD = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const weekRange = `${fmtD(monday)} – ${fmtD(sunday)}`

    const slots = Array.from({ length: 5 }, (_, i) => {
      const e = ctx.events?.[i]
      if (e) {
        const venue = e.venue ?? ''
        return { title: resolveTitle(e.title, venue), venue, time: e.time ?? '', date: e.date }
      }
      return DIGEST_FALLBACKS[i]
    })

    const ROW_START = 468
    const ROW_H     = 144   // already tight due to high ROW_START — font scaling prevents wrapping

    const layers: Layer[] = [
      logo(LOGO_W, 80, sy(42), 50),
      // Watermark "5" — decorative, very low opacity
      textLayer({
        name: 'Watermark', text: '5',
        x: w - 420, y: sy(20), width: 400,
        fontFamily: font('Epilogue'), fontSize: 340, fontWeight: 900,
        fill: BRAND_COLORS.cream, opacity: 0.06, align: 'right', lineHeight: 1,
      }),
      // "5 PICKS" headline
      textLayer({
        name: 'Headline', text: '5 PICKS',
        x: 80, y: sy(112), width: w - 160,
        fontFamily: font('Epilogue'), fontSize: 160, fontWeight: 900,
        fill: BRAND_COLORS.cream, lineHeight: 0.88, letterSpacing: -3,
      }),
      textLayer({
        name: 'Subhead', text: 'THIS WEEK IN ABQ',
        x: 80, y: sy(288), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 500,
        fill: BRAND_COLORS.cream, opacity: 0.55, letterSpacing: 6,
      }),
      textLayer({
        name: 'Week Range', text: weekRange,
        x: 80, y: sy(326), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 24, fontWeight: 500,
        fill: BRAND_COLORS.cream, opacity: 0.6,
      }),
      shape({ shape: 'rect', x: 80, y: sy(376), width: w - 160, height: 2, fill: BRAND_COLORS.cream, opacity: 0.3 }),
      // "Curated picks" label
      textLayer({
        name: 'Label', text: 'CURATED PICKS',
        x: 80, y: sy(390), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 17, fontWeight: 500,
        fill: BRAND_COLORS.cream, opacity: 0.6, letterSpacing: 5,
      }),
    ]

    // 5 event rows — title width is w-258 (170px indent for number column)
    slots.forEach((slot, i) => {
      const y   = sy(ROW_START + i * ROW_H)
      const num = String(i + 1).padStart(2, '0')
      const meta = [shortDay(slot.date), slot.time, slot.venue ? shortVenue(slot.venue) : ''].filter(Boolean).join(' · ')
      const { fontSize: titleSize, text: titleText } = epilogueTitleSize(slot.title, w - 258)
      layers.push(
        textLayer({
          name: `No.${num}`, text: num,
          x: 80, y: y, width: 90,
          fontFamily: font('DM Mono'), fontSize: 30, fontWeight: 500,
          fill: BRAND_COLORS.cream, opacity: 0.62,
        }),
        textLayer({
          name: `Event ${i + 1}`, text: titleText,
          x: 170, y: y + sy(2), width: w - 258,
          fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 700,
          fill: BRAND_COLORS.cream, lineHeight: 1.05, letterSpacing: -0.5,
        }),
        ...(meta ? [textLayer({
          name: `Meta ${i + 1}`, text: meta,
          x: 170, y: y + sy(64), width: w - 258,
          fontFamily: font('Inter'), fontSize: 22, fontWeight: 400,
          fill: BRAND_COLORS.cream, opacity: 0.62, lineHeight: 1,
        })] : []),
        shape({ shape: 'rect', x: 80, y: y + sy(122), width: w - 160, height: 1, fill: BRAND_COLORS.cream, opacity: 0.25 }),
      )
    })

    // Footer
    const footerY = sy(ROW_START + 5 * ROW_H + 22)
    layers.push(
      logo(LOGO_W, Math.round((w - Math.round(52 * LOGO_R)) / 2), footerY, 52),
      textLayer({
        name: 'URL', text: 'abqunplugged.com',
        x: 80, y: footerY + sy(72), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 20, fontWeight: 400,
        fill: BRAND_COLORS.cream, opacity: 0.6, align: 'center', letterSpacing: 2,
      }),
    )

    return {
      id: uid(), name: 'Weekly five', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.terra }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── D4. Weekly Summary ─────────────────────────────────────────────────────

const weeklySummary: Template = {
  id: 'weekly-summary',
  name: 'Weekly Summary',
  description: 'One-image weekly recap with up to 6 events, date range, and quick venue details.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.cream,
    blocks: [
      { x: 0,  y: 0,  w: 100, h: 30, c: BRAND_COLORS.terra },
      { x: 7,  y: 8,  w: 28,  h: 2,  c: BRAND_COLORS.cream, o: 0.7 },
      { x: 7,  y: 14, w: 54,  h: 7,  c: BRAND_COLORS.cream },
      { x: 7,  y: 23, w: 42,  h: 2,  c: BRAND_COLORS.cream, o: 0.58 },
      { x: 78, y: 8,  w: 12,  h: 12, c: BRAND_COLORS.turquoise, o: 0.85, r: 6 },
      { x: 7,  y: 36, w: 8,   h: 3,  c: BRAND_COLORS.terra }, { x: 20, y: 36, w: 66, h: 3, c: BRAND_COLORS.ink, o: 0.8 },
      { x: 20, y: 42, w: 48,  h: 1.5, c: BRAND_COLORS.sage, o: 0.7 },
      { x: 7,  y: 49, w: 8,   h: 3,  c: BRAND_COLORS.terra }, { x: 20, y: 49, w: 58, h: 3, c: BRAND_COLORS.ink, o: 0.8 },
      { x: 20, y: 55, w: 42,  h: 1.5, c: BRAND_COLORS.sage, o: 0.7 },
      { x: 7,  y: 62, w: 8,   h: 3,  c: BRAND_COLORS.terra }, { x: 20, y: 62, w: 70, h: 3, c: BRAND_COLORS.ink, o: 0.8 },
      { x: 20, y: 68, w: 50,  h: 1.5, c: BRAND_COLORS.sage, o: 0.7 },
      { x: 7,  y: 75, w: 8,   h: 3,  c: BRAND_COLORS.terra }, { x: 20, y: 75, w: 54, h: 3, c: BRAND_COLORS.ink, o: 0.8 },
      { x: 7,  y: 93, w: 86,  h: 2,  c: BRAND_COLORS.terra },
      { x: 23, y: 97, w: 54,  h: 2,  c: BRAND_COLORS.terra, o: 0.55 },
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const sy = (y: number) => Math.round(y * h / 1350)
    const isStory = fmt === '9:16'
    const topSafe = isStory ? Math.round(h * 0.12) : Math.round(h * 0.08)
    const botSafe = isStory ? Math.round(h * 0.15) : Math.round(h * 0.08)

    const fmtD = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const evDates = (ctx.events ?? [])
      .map(e => e.date).filter((d): d is string => !!d).sort()
    let weekRange = ''
    if (evDates.length > 0) {
      const first = new Date(evDates[0] + 'T12:00:00')
      const last  = new Date(evDates[evDates.length - 1] + 'T12:00:00')
      weekRange = first.getTime() === last.getTime()
        ? fmtD(first)
        : `${fmtD(first)} – ${fmtD(last)}`
    } else if (ctx.postDate) {
      const first = new Date(ctx.postDate + 'T12:00:00')
      const last = new Date(first); last.setDate(first.getDate() + 6)
      weekRange = `${fmtD(first)} – ${fmtD(last)}`
    }

    const events = (ctx.events ?? []).slice(0, 6).map(e => {
      const venue = e.venue ?? ''
      return { title: resolveTitle(e.title, venue), venue, time: e.time ?? '', date: e.date }
    })
    const rowCount = Math.min(events.length, 6)
    const countLabel = `${ctx.events?.length ?? 0} thing${(ctx.events?.length ?? 0) === 1 ? '' : 's'} to do this week`
    const headerH = topSafe + sy(284)
    const rowStart = headerH + sy(38)
    const ctaY = h - botSafe - sy(48)
    const rowH = rowCount > 0
      ? Math.floor((ctaY - rowStart - sy(34)) / rowCount)
      : sy(112)

    const layers: Layer[] = [
      shape({ shape: 'rect', x: 0, y: 0, width: w, height: headerH, fill: BRAND_COLORS.terra }),
      shape({ shape: 'circle', x: w - 178, y: topSafe + sy(22), width: 118, height: 118, fill: BRAND_COLORS.turquoise, opacity: 0.85 }),
      shape({ shape: 'circle', x: w - 120, y: topSafe + sy(100), width: 54, height: 54, fill: BRAND_COLORS.sage, opacity: 0.75 }),
      logo(LOGO_W, 80, topSafe, 50),
      textLayer({
        name: 'Eyebrow', text: weekRange ? `THIS WEEK · ${weekRange.toUpperCase()}` : 'THIS WEEK',
        x: 80, y: topSafe + sy(72), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 21, fontWeight: 500,
        fill: BRAND_COLORS.cream, opacity: 0.76, letterSpacing: 5,
      }),
      textLayer({
        name: 'Headline', text: 'in Albuquerque',
        x: 80, y: topSafe + sy(106), width: w - 160,
        fontFamily: font('Epilogue'), fontSize: 104, fontWeight: 900,
        fill: BRAND_COLORS.cream, lineHeight: 0.92, letterSpacing: -2,
      }),
      textLayer({
        name: 'Count', text: countLabel,
        x: 80, y: topSafe + sy(214), width: w - 160,
        fontFamily: font('Inter'), fontSize: 28, fontWeight: 600,
        fill: BRAND_COLORS.cream, opacity: 0.8,
      }),
      shape({ shape: 'rect', x: 80, y: headerH + sy(18), width: w - 160, height: 3, fill: BRAND_COLORS.terra, opacity: 0.9 }),
    ]

    events.forEach((slot, i) => {
      const y = rowStart + i * rowH
      const num = String(i + 1)
      const meta = [shortDay(slot.date), slot.time, slot.venue ? shortVenue(slot.venue) : ''].filter(Boolean).join(' · ')
      const { fontSize: titleSize, text: titleText } = epilogueTitleSize(slot.title, w - 244)
      layers.push(
        shape({ shape: 'circle', x: 80, y: y + sy(2), width: 48, height: 48, fill: BRAND_COLORS.terra }),
        textLayer({
          name: `No.${num}`, text: num,
          x: 80, y: y + sy(10), width: 48,
          fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 500,
          fill: BRAND_COLORS.cream, align: 'center', lineHeight: 1,
        }),
        textLayer({
          name: `Event ${i + 1}`, text: titleText,
          x: 152, y: y, width: w - 244,
          fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 700,
          fill: BRAND_COLORS.ink, lineHeight: 1.05, letterSpacing: -0.5,
        }),
        ...(meta ? [textLayer({
          name: `Meta ${i + 1}`, text: meta,
          x: 152, y: y + sy(56), width: w - 244,
          fontFamily: font('DM Mono'), fontSize: 20, fontWeight: 500,
          fill: BRAND_COLORS.sage, opacity: 0.85, lineHeight: 1,
        })] : []),
        shape({ shape: 'rect', x: 80, y: y + Math.min(rowH - sy(18), sy(94)), width: w - 160, height: 1, fill: BRAND_COLORS.ink, opacity: 0.16 }),
      )
    })

    layers.push(
      shape({ shape: 'rect', x: 80, y: ctaY - sy(22), width: w - 160, height: 3, fill: BRAND_COLORS.terra }),
      textLayer({
        name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
        x: 80, y: ctaY, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 500,
        fill: BRAND_COLORS.terra, opacity: 0.86, align: 'center', letterSpacing: 2,
      }),
    )

    return {
      id: uid(), name: 'Weekly summary', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ── D5. Top 3 Picks ───────────────────────────────────────────────────────

const topThree: Template = {
  id: 'top-three',
  name: 'Top 3 Picks',
  description: 'Photo-forward three-event digest with real event images and compact date/venue details.',
  category: 'brand',
  thumb: {
    bg: BRAND_COLORS.cream,
    blocks: [
      { x: 7,  y: 6,  w: 28, h: 2,   c: BRAND_COLORS.terra, o: 0.7 },
      { x: 7,  y: 12, w: 62, h: 7,   c: BRAND_COLORS.ink },
      { x: 7,  y: 21, w: 34, h: 2,   c: BRAND_COLORS.terra, o: 0.7 },
      { x: 7,  y: 31, w: 34, h: 18,  c: BRAND_COLORS.sage, o: 0.75, r: 2 },
      { x: 45, y: 34, w: 10, h: 3,   c: BRAND_COLORS.terra },
      { x: 58, y: 34, w: 31, h: 3,   c: BRAND_COLORS.ink, o: 0.82 },
      { x: 58, y: 41, w: 24, h: 1.5, c: BRAND_COLORS.sage, o: 0.7 },
      { x: 7,  y: 54, w: 34, h: 18,  c: BRAND_COLORS.terra, o: 0.75, r: 2 },
      { x: 45, y: 57, w: 10, h: 3,   c: BRAND_COLORS.terra },
      { x: 58, y: 57, w: 28, h: 3,   c: BRAND_COLORS.ink, o: 0.82 },
      { x: 58, y: 64, w: 30, h: 1.5, c: BRAND_COLORS.sage, o: 0.7 },
      { x: 7,  y: 77, w: 34, h: 18,  c: BRAND_COLORS.turquoise, o: 0.72, r: 2 },
      { x: 45, y: 80, w: 10, h: 3,   c: BRAND_COLORS.terra },
      { x: 58, y: 80, w: 34, h: 3,   c: BRAND_COLORS.ink, o: 0.82 },
      { x: 58, y: 87, w: 22, h: 1.5, c: BRAND_COLORS.sage, o: 0.7 },
      { x: 7,  y: 111, w: 86, h: 2,  c: BRAND_COLORS.terra },
      { x: 23, y: 116, w: 54, h: 2,  c: BRAND_COLORS.terra, o: 0.55 },
    ],
  },
  build: (ctx, format) => {
    const fmt = format ?? '4:5'
    const { w, h } = CANVAS_DIMS[fmt]
    const sy = (y: number) => Math.round(y * h / 1350)
    const isStory = fmt === '9:16'
    const topSafe = isStory ? Math.round(h * 0.12) : Math.round(h * 0.08)
    const botSafe = isStory ? Math.round(h * 0.15) : Math.round(h * 0.08)

    const fmtD = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const evDates = (ctx.events ?? [])
      .slice(0, 3)
      .map(e => e.date).filter((d): d is string => !!d).sort()
    let picksRange = ''
    if (evDates.length > 0) {
      const first = new Date(evDates[0] + 'T12:00:00')
      const last  = new Date(evDates[evDates.length - 1] + 'T12:00:00')
      picksRange = first.getTime() === last.getTime()
        ? fmtD(first)
        : `${fmtD(first)} – ${fmtD(last)}`
    } else if (ctx.postDate) {
      picksRange = fmtD(new Date(ctx.postDate + 'T12:00:00'))
    }

    const events = (ctx.events ?? []).slice(0, 3).map(e => {
      const venue = e.venue ?? ''
      return {
        title: resolveTitle(e.title, venue),
        venue,
        time: e.time ?? '',
        date: e.date,
        category: e.category ?? '',
        imageUrl: e.imageUrl?.trim() ?? '',
      }
    })
    const rowCount = Math.min(events.length, 3)
    const headerH = topSafe + sy(236)
    const rowStart = headerH + sy(38)
    const ctaY = h - botSafe - sy(48)
    const footerRuleY = ctaY - sy(22)
    const rowGap = sy(22)
    const rowH = rowCount > 0
      ? Math.floor((footerRuleY - rowStart - rowGap * (rowCount - 1)) / rowCount)
      : sy(214)
    const photoW = Math.round((w - 160) * 0.4)
    const textX = 80 + photoW + 34
    const textW = w - textX - 80

    const layers: Layer[] = [
      logo(LOGO_T, 80, topSafe, 50),
      textLayer({
        name: 'Eyebrow', text: picksRange ? `TOP PICKS · ${picksRange.toUpperCase()}` : 'TOP PICKS',
        x: 80, y: topSafe + sy(74), width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 21, fontWeight: 500,
        fill: BRAND_COLORS.terra, opacity: 0.86, letterSpacing: 5,
      }),
      textLayer({
        name: 'Headline', text: 'Top 3 Picks',
        x: 80, y: topSafe + sy(108), width: w - 160,
        fontFamily: font('Epilogue'), fontSize: 104, fontWeight: 900,
        fill: BRAND_COLORS.ink, lineHeight: 0.92, letterSpacing: -2,
      }),
      shape({ shape: 'rect', x: 80, y: headerH + sy(16), width: w - 160, height: 3, fill: BRAND_COLORS.terra, opacity: 0.9 }),
    ]

    events.forEach((slot, i) => {
      const y = rowStart + i * (rowH + rowGap)
      const num = String(i + 1)
      const photoY = y
      const photoH = Math.max(sy(142), rowH - sy(14))
      const meta = [shortDay(slot.date), slot.time, slot.venue ? shortVenue(slot.venue) : ''].filter(Boolean).join(' · ')
      const { fontSize: titleSize, text: titleText } = epilogueTitleSize(slot.title, textW)
      const tag = slot.category ? slot.category.toUpperCase() : 'ABQ PICK'

      layers.push(
        ...(slot.imageUrl
          ? [imageLayer({ src: slot.imageUrl, x: 80, y: photoY, width: photoW, height: photoH, fit: 'cover', cornerRadius: 4 })]
          : [
              shape({
                shape: 'rect', x: 80, y: photoY, width: photoW, height: photoH,
                fill: i % 2 === 0 ? BRAND_COLORS.sage : BRAND_COLORS.terra,
                opacity: 0.82, cornerRadius: 4,
              }),
              shape({
                shape: 'rect', x: 80 + sy(18), y: photoY + sy(18), width: photoW - sy(36), height: 2,
                fill: BRAND_COLORS.cream, opacity: 0.42,
              }),
              textLayer({
                name: `Photo Fallback ${i + 1}`, text: 'ABQ',
                x: 80, y: photoY + Math.round(photoH / 2) - sy(22), width: photoW,
                fontFamily: font('Epilogue'), fontSize: 38, fontWeight: 900,
                fill: BRAND_COLORS.cream, opacity: 0.72, align: 'center', letterSpacing: 2,
              }),
            ]),
        shape({ shape: 'circle', x: 100, y: photoY + sy(16), width: 52, height: 52, fill: BRAND_COLORS.terra }),
        textLayer({
          name: `No.${num}`, text: num,
          x: 100, y: photoY + sy(25), width: 52,
          fontFamily: font('DM Mono'), fontSize: 23, fontWeight: 500,
          fill: BRAND_COLORS.cream, align: 'center', lineHeight: 1,
        }),
        textLayer({
          name: `Tag ${i + 1}`, text: tag,
          x: textX, y: y + sy(4), width: textW,
          fontFamily: font('DM Mono'), fontSize: 16, fontWeight: 500,
          fill: BRAND_COLORS.terra, opacity: 0.76, letterSpacing: 3,
        }),
        textLayer({
          name: `Event ${i + 1}`, text: titleText,
          x: textX, y: y + sy(34), width: textW,
          fontFamily: font('Epilogue'), fontSize: titleSize, fontWeight: 700,
          fill: BRAND_COLORS.ink, lineHeight: 1.05, letterSpacing: -0.5,
        }),
        ...(meta ? [textLayer({
          name: `Meta ${i + 1}`, text: meta,
          x: textX, y: y + sy(96), width: textW,
          fontFamily: font('DM Mono'), fontSize: 19, fontWeight: 500,
          fill: BRAND_COLORS.sage, opacity: 0.88, lineHeight: 1,
        })] : []),
      )
    })

    layers.push(
      shape({ shape: 'rect', x: 80, y: footerRuleY, width: w - 160, height: 3, fill: BRAND_COLORS.terra }),
      textLayer({
        name: 'CTA', text: ctx.cta ?? 'abqunplugged.com',
        x: 80, y: ctaY, width: w - 160,
        fontFamily: font('DM Mono'), fontSize: 22, fontWeight: 500,
        fill: BRAND_COLORS.terra, opacity: 0.86, align: 'center', letterSpacing: 2,
      }),
    )

    return {
      id: uid(), name: 'Top 3 picks', format: fmt,
      slides: [{ id: uid(), background: { type: 'color', color: BRAND_COLORS.cream }, layers }],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
  },
}

// ════════════════════════════════════════════════════════════════════════
//   EXPORTS
// ════════════════════════════════════════════════════════════════════════

export const TEMPLATES: Template[] = [
  // Event templates (10 feed + 3 story)
  poster, broadside, marquee, split, dispatch, goldenHour, paper,
  signal, stencil, terra,
  storyFullBleed, storySplit, storyTypeOnly,
  // Brand templates (7)
  statement, categorySpotlight, weekendPreview, mesa, tonightDrop, hiddenGem, blank,
  // Digest templates — multi-event (5)
  weekendDigest, tonightList, weeklyFive, weeklySummary, topThree,
]

export const EVENT_TEMPLATES  = TEMPLATES.filter(t => t.category === 'event')
export const PROMO_TEMPLATES  = TEMPLATES.filter(t => t.category === 'brand')
export const DIGEST_TEMPLATES = [weekendDigest, tonightList, weeklyFive, weeklySummary, topThree]
