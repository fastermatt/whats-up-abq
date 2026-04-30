/**
 * Type definitions for the IG post editor.
 * A Design = canvas format + one or more slides (slides > 1 is a carousel).
 * Each slide contains layered elements (background + layers).
 */

export type CanvasFormat = '1:1' | '4:5' | '9:16'

export const CANVAS_DIMS: Record<CanvasFormat, { w: number; h: number }> = {
  '1:1':  { w: 1080, h: 1080 },
  '4:5':  { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
}

export type BackgroundFill =
  | { type: 'color';    color: string }
  | { type: 'gradient'; from: string; to: string; angle: number }
  | { type: 'image';    src: string; fit: 'cover' | 'contain'; overlayColor: string; overlayOpacity: number }

export interface BaseLayer {
  id: string
  name: string
  x: number
  y: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
}

export interface TextLayer extends BaseLayer {
  type: 'text'
  text: string
  width: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  fill: string
  align: 'left' | 'center' | 'right'
  letterSpacing: number
  lineHeight: number
  shadow: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number }
  stroke: { enabled: boolean; color: string; width: number }
  uppercase: boolean
}

export interface ImageLayer extends BaseLayer {
  type: 'image'
  src: string
  width: number
  height: number
  cornerRadius: number
  fit?: 'cover' | 'contain' | 'stretch'
}

export interface ShapeLayer extends BaseLayer {
  type: 'shape'
  shape: 'rect' | 'circle' | 'line'
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
}

export type Layer = TextLayer | ImageLayer | ShapeLayer

export interface Slide {
  id: string
  background: BackgroundFill
  layers: Layer[]
}

export interface Design {
  id: string
  name: string
  format: CanvasFormat
  slides: Slide[]
  createdAt: number
  updatedAt: number
  thumbnail?: string
}

export const DEFAULT_BACKGROUND: BackgroundFill = { type: 'color', color: '#fbf7f1' }

export const BRAND_COLORS = {
  cream: '#fbf7f1',
  terra: '#9a442d',
  sage: '#4f6249',
  turquoise: '#006a62',
  sandstone: '#e8d6b7',
  ink: '#1a1614',
  sunsetOrange: '#d96a34',
  mesaBrown: '#6b3a22',
  skyGold: '#c99b3b',
  night: '#11141f',
  white: '#ffffff',
  black: '#000000',
}

export const BRAND_FONTS = [
  // NOTE: Canvas 2D does not support CSS custom properties (var(--font-*)).
  // Use plain font names only — Next.js registers fonts under their real names ("Epilogue" etc).
  { name: 'Epilogue',    stack: 'Epilogue, sans-serif',             weights: [400, 700, 900] },
  { name: 'Inter',       stack: 'Inter, sans-serif',                weights: [400, 600, 800] },
  { name: 'Fraunces',    stack: '"Fraunces", Georgia, serif',       weights: [400, 600, 900] },
  { name: 'Bebas Neue',  stack: '"Bebas Neue", Impact, sans-serif', weights: [400] },
  { name: 'DM Mono',     stack: '"DM Mono", "IBM Plex Mono", monospace', weights: [400, 500] },
  { name: 'Space Grotesk', stack: '"Space Grotesk", sans-serif',   weights: [400, 600, 700] },
] as const

export type BrandFontName = (typeof BRAND_FONTS)[number]['name']
