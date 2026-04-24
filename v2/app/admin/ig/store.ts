'use client'

import { create } from 'zustand'
import type {
  Design, Slide, Layer, TextLayer, ImageLayer, ShapeLayer,
  CanvasFormat, BackgroundFill,
} from './types'
import { CANVAS_DIMS, DEFAULT_BACKGROUND } from './types'

const uid = () => Math.random().toString(36).slice(2, 10)

const emptySlide = (): Slide => ({
  id: uid(),
  background: DEFAULT_BACKGROUND,
  layers: [],
})

const emptyDesign = (format: CanvasFormat = '4:5'): Design => ({
  id: uid(),
  name: 'Untitled',
  format,
  slides: [emptySlide()],
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

interface EditorState {
  design: Design
  activeSlideIndex: number
  selectedLayerId: string | null

  // ── Design actions
  newDesign: (format?: CanvasFormat) => void
  loadDesign: (d: Design) => void
  renameDesign: (name: string) => void
  setFormat: (format: CanvasFormat) => void

  // ── Slide actions
  addSlide: () => void
  removeSlide: (index: number) => void
  setActiveSlide: (index: number) => void
  setBackground: (bg: BackgroundFill) => void

  // ── Layer actions
  addLayer: (layer: Omit<Layer, 'id' | 'name'> & { name?: string }) => string
  updateLayer: (id: string, patch: Partial<Layer>) => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  reorderLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void
  selectLayer: (id: string | null) => void

  // ── Helpers
  getSelectedLayer: () => Layer | null
  getActiveSlide: () => Slide
}

export const useEditor = create<EditorState>((set, get) => ({
  design: emptyDesign(),
  activeSlideIndex: 0,
  selectedLayerId: null,

  newDesign: (format = '4:5') =>
    set({ design: emptyDesign(format), activeSlideIndex: 0, selectedLayerId: null }),

  loadDesign: (d) =>
    set({ design: { ...d, updatedAt: Date.now() }, activeSlideIndex: 0, selectedLayerId: null }),

  renameDesign: (name) =>
    set(state => ({ design: { ...state.design, name, updatedAt: Date.now() } })),

  setFormat: (format) =>
    set(state => ({ design: { ...state.design, format, updatedAt: Date.now() } })),

  addSlide: () =>
    set(state => {
      const slides = [...state.design.slides, emptySlide()]
      return {
        design: { ...state.design, slides, updatedAt: Date.now() },
        activeSlideIndex: slides.length - 1,
      }
    }),

  removeSlide: (index) =>
    set(state => {
      if (state.design.slides.length <= 1) return state
      const slides = state.design.slides.filter((_, i) => i !== index)
      const activeSlideIndex = Math.max(0, Math.min(state.activeSlideIndex, slides.length - 1))
      return {
        design: { ...state.design, slides, updatedAt: Date.now() },
        activeSlideIndex,
      }
    }),

  setActiveSlide: (index) => set({ activeSlideIndex: index, selectedLayerId: null }),

  setBackground: (bg) =>
    set(state => {
      const slides = state.design.slides.map((s, i) =>
        i === state.activeSlideIndex ? { ...s, background: bg } : s
      )
      return { design: { ...state.design, slides, updatedAt: Date.now() } }
    }),

  addLayer: (partial) => {
    const id = uid()
    const defaultName = partial.type === 'text'  ? 'Text'
                      : partial.type === 'image' ? 'Image'
                      : 'Shape'
    const layer = { id, name: partial.name ?? defaultName, ...partial } as Layer
    set(state => {
      const slides = state.design.slides.map((s, i) =>
        i === state.activeSlideIndex ? { ...s, layers: [...s.layers, layer] } : s
      )
      return {
        design: { ...state.design, slides, updatedAt: Date.now() },
        selectedLayerId: id,
      }
    })
    return id
  },

  updateLayer: (id, patch) =>
    set(state => {
      const slides = state.design.slides.map((s, i) => {
        if (i !== state.activeSlideIndex) return s
        return {
          ...s,
          layers: s.layers.map(l => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
        }
      })
      return { design: { ...state.design, slides, updatedAt: Date.now() } }
    }),

  removeLayer: (id) =>
    set(state => {
      const slides = state.design.slides.map((s, i) =>
        i === state.activeSlideIndex
          ? { ...s, layers: s.layers.filter(l => l.id !== id) }
          : s
      )
      return {
        design: { ...state.design, slides, updatedAt: Date.now() },
        selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId,
      }
    }),

  duplicateLayer: (id) =>
    set(state => {
      const slide = state.design.slides[state.activeSlideIndex]
      const src = slide.layers.find(l => l.id === id)
      if (!src) return state
      const copy = { ...src, id: uid(), x: src.x + 20, y: src.y + 20 } as Layer
      const slides = state.design.slides.map((s, i) =>
        i === state.activeSlideIndex ? { ...s, layers: [...s.layers, copy] } : s
      )
      return {
        design: { ...state.design, slides, updatedAt: Date.now() },
        selectedLayerId: copy.id,
      }
    }),

  reorderLayer: (id, direction) =>
    set(state => {
      const slides = state.design.slides.map((s, i) => {
        if (i !== state.activeSlideIndex) return s
        const layers = [...s.layers]
        const idx = layers.findIndex(l => l.id === id)
        if (idx === -1) return s
        const [layer] = layers.splice(idx, 1)
        if (direction === 'up')         layers.splice(Math.min(idx + 1, layers.length), 0, layer)
        else if (direction === 'down')  layers.splice(Math.max(idx - 1, 0), 0, layer)
        else if (direction === 'top')   layers.push(layer)
        else                             layers.unshift(layer)
        return { ...s, layers }
      })
      return { design: { ...state.design, slides, updatedAt: Date.now() } }
    }),

  selectLayer: (id) => set({ selectedLayerId: id }),

  getSelectedLayer: () => {
    const s = get()
    if (!s.selectedLayerId) return null
    const slide = s.design.slides[s.activeSlideIndex]
    return slide.layers.find(l => l.id === s.selectedLayerId) ?? null
  },

  getActiveSlide: () => {
    const s = get()
    return s.design.slides[s.activeSlideIndex]
  },
}))

// ── Layer factories ────────────────────────────────────────────────────────

export function makeTextLayer(partial: Partial<TextLayer> = {}): Omit<TextLayer, 'id' | 'name'> {
  return {
    type: 'text',
    text: partial.text ?? 'Your text here',
    x: partial.x ?? 100,
    y: partial.y ?? 100,
    width: partial.width ?? 600,
    rotation: partial.rotation ?? 0,
    opacity: partial.opacity ?? 1,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    fontFamily: partial.fontFamily ?? 'var(--font-epilogue), Epilogue, sans-serif',
    fontSize: partial.fontSize ?? 80,
    fontWeight: partial.fontWeight ?? 900,
    fontStyle: partial.fontStyle ?? 'normal',
    fill: partial.fill ?? '#1a1614',
    align: partial.align ?? 'left',
    letterSpacing: partial.letterSpacing ?? 0,
    lineHeight: partial.lineHeight ?? 1.1,
    shadow: partial.shadow ?? { enabled: false, color: 'rgba(0,0,0,0.5)', blur: 8, offsetX: 0, offsetY: 2 },
    stroke: partial.stroke ?? { enabled: false, color: '#000', width: 2 },
    uppercase: partial.uppercase ?? false,
  }
}

export function makeImageLayer(partial: Partial<ImageLayer> = {}): Omit<ImageLayer, 'id' | 'name'> {
  return {
    type: 'image',
    src: partial.src ?? '',
    x: partial.x ?? 100,
    y: partial.y ?? 100,
    width: partial.width ?? 400,
    height: partial.height ?? 400,
    rotation: partial.rotation ?? 0,
    opacity: partial.opacity ?? 1,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    cornerRadius: partial.cornerRadius ?? 0,
  }
}

export function makeShapeLayer(partial: Partial<ShapeLayer> = {}): Omit<ShapeLayer, 'id' | 'name'> {
  return {
    type: 'shape',
    shape: partial.shape ?? 'rect',
    x: partial.x ?? 100,
    y: partial.y ?? 100,
    width: partial.width ?? 200,
    height: partial.height ?? 200,
    rotation: partial.rotation ?? 0,
    opacity: partial.opacity ?? 1,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    fill: partial.fill ?? '#9a442d',
    stroke: partial.stroke ?? 'transparent',
    strokeWidth: partial.strokeWidth ?? 0,
    cornerRadius: partial.cornerRadius ?? 0,
  }
}

// ── Canvas sizing helpers
export { CANVAS_DIMS }
