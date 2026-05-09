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

const MAX_HISTORY = 20

interface EditorState {
  design: Design
  activeSlideIndex: number
  selectedLayerId: string | null
  past: Design[]
  future: Design[]
  showSafeZone: boolean
  // Last template the user applied (id + clean baseline). Used to power "Reset
  // to template" — visible only after the user has diverged from the baseline.
  lastTemplateId: string | null
  lastTemplateBaseline: Design | null

  // ── Design actions
  newDesign: (format?: CanvasFormat) => void
  loadDesign: (d: Design) => void
  applyTemplateDesign: (templateId: string, d: Design) => void
  renameDesign: (name: string) => void
  setFormat: (format: CanvasFormat) => void

  // ── History
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

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

  // ── UI state
  toggleSafeZone: () => void

  // ── Helpers
  getSelectedLayer: () => Layer | null
  getActiveSlide: () => Slide
}

// Inline snapshot helper — used inside set() calls for structural mutations
const pushHistory = (design: Design, past: Design[]): Design[] =>
  [...past.slice(-(MAX_HISTORY - 1)), design]

export const useEditor = create<EditorState>((set, get) => ({
  design: emptyDesign(),
  activeSlideIndex: 0,
  selectedLayerId: null,
  past: [],
  future: [],
  showSafeZone: false,
  lastTemplateId: null,
  lastTemplateBaseline: null,

  // ── History ──────────────────────────────────────────────────────────────

  undo: () =>
    set(state => {
      if (state.past.length === 0) return state
      const prev = state.past[state.past.length - 1]
      return {
        design: prev,
        past: state.past.slice(0, -1),
        future: [state.design, ...state.future.slice(0, MAX_HISTORY - 1)],
        selectedLayerId: null,
      }
    }),

  redo: () =>
    set(state => {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        design: next,
        past: pushHistory(state.design, state.past),
        future: state.future.slice(1),
        selectedLayerId: null,
      }
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  // ── Design actions ────────────────────────────────────────────────────────

  newDesign: (format = '4:5') =>
    set(state => ({
      past: pushHistory(state.design, state.past),
      future: [],
      design: emptyDesign(format),
      activeSlideIndex: 0,
      selectedLayerId: null,
    })),

  loadDesign: (d) =>
    set(state => ({
      past: pushHistory(state.design, state.past),
      future: [],
      design: { ...d, updatedAt: Date.now() },
      activeSlideIndex: 0,
      selectedLayerId: null,
      // Loading an arbitrary design clears any tracked template baseline.
      lastTemplateId: null,
      lastTemplateBaseline: null,
    })),

  // Template application: same as loadDesign, but also records the baseline
  // so the "Reset to template" button can offer a one-click revert.
  applyTemplateDesign: (templateId, d) =>
    set(state => ({
      past: pushHistory(state.design, state.past),
      future: [],
      design: { ...d, updatedAt: Date.now() },
      activeSlideIndex: 0,
      selectedLayerId: null,
      lastTemplateId: templateId,
      lastTemplateBaseline: d,
    })),

  // renameDesign is NOT undoable — it's an administrative action
  renameDesign: (name) =>
    set(state => ({ design: { ...state.design, name, updatedAt: Date.now() } })),

  setFormat: (format) =>
    set(state => ({
      past: pushHistory(state.design, state.past),
      future: [],
      design: { ...state.design, format, updatedAt: Date.now() },
    })),

  // ── Slide actions ─────────────────────────────────────────────────────────

  addSlide: () =>
    set(state => {
      const slides = [...state.design.slides, emptySlide()]
      return {
        past: pushHistory(state.design, state.past),
        future: [],
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
        past: pushHistory(state.design, state.past),
        future: [],
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
      return {
        past: pushHistory(state.design, state.past),
        future: [],
        design: { ...state.design, slides, updatedAt: Date.now() },
      }
    }),

  // ── Layer actions ─────────────────────────────────────────────────────────

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
        past: pushHistory(state.design, state.past),
        future: [],
        design: { ...state.design, slides, updatedAt: Date.now() },
        selectedLayerId: id,
      }
    })
    return id
  },

  // updateLayer is NOT individually undoable — too fine-grained (fired on every keystroke).
  // Users get undo for structural actions (add/remove/duplicate/reorder/load).
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
        past: pushHistory(state.design, state.past),
        future: [],
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
        past: pushHistory(state.design, state.past),
        future: [],
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
      return {
        past: pushHistory(state.design, state.past),
        future: [],
        design: { ...state.design, slides, updatedAt: Date.now() },
      }
    }),

  selectLayer: (id) => set({ selectedLayerId: id }),

  // ── UI state ──────────────────────────────────────────────────────────────

  toggleSafeZone: () => set(state => ({ showSafeZone: !state.showSafeZone })),

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
    // NOTE: no var(--font-*) prefix — canvas 2D does not resolve CSS custom properties
    fontFamily: partial.fontFamily ?? 'Epilogue, sans-serif',
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
