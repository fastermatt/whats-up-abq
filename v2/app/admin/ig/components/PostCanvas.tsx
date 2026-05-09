'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Stage, Layer as KLayer, Rect, Text, Image as KImage, Group, Circle, Line, Transformer } from 'react-konva'
import Konva from 'konva'
import useImage from 'use-image'
import type { Slide, Layer, TextLayer, ImageLayer, ShapeLayer, CanvasFormat } from '../types'
import { CANVAS_DIMS } from '../types'
import { useEditor } from '../store'
import { proxyIfNeeded } from '../lib/image-proxy'

// Global keyboard shortcuts — Delete removes selected layer, ⌘Z/⌘⇧Z undo/redo, Escape deselects.
// Skipped when focus is inside an input/textarea/select (user is typing in the design panel).
function useCanvasKeyboard() {
  const { selectedLayerId, removeLayer, selectLayer, undo, redo } = useEditor()
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId) { e.preventDefault(); removeLayer(selectedLayerId) }
        return
      }
      if (e.key === 'Escape') {
        selectLayer(null)
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); return }
      if (mod && ((e.shiftKey && e.key === 'z') || e.key === 'y')) { e.preventDefault(); redo(); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedLayerId, removeLayer, selectLayer, undo, redo])
}

// ── Background renderer ──────────────────────────────────────────────────

function Background({ slide, w, h }: { slide: Slide; w: number; h: number }) {
  const bg = slide.background
  if (bg.type === 'color') {
    return <Rect x={0} y={0} width={w} height={h} fill={bg.color} listening={false} />
  }
  if (bg.type === 'gradient') {
    const rad = (bg.angle * Math.PI) / 180
    const dx = Math.cos(rad), dy = Math.sin(rad)
    const cx = w / 2, cy = h / 2
    const diag = Math.sqrt(w * w + h * h) / 2
    return (
      <Rect
        x={0} y={0} width={w} height={h}
        fillLinearGradientStartPoint={{ x: cx - dx * diag, y: cy - dy * diag }}
        fillLinearGradientEndPoint={{   x: cx + dx * diag, y: cy + dy * diag }}
        fillLinearGradientColorStops={[0, bg.from, 1, bg.to]}
        listening={false}
      />
    )
  }
  // image
  return <BackgroundImage slide={slide} w={w} h={h} />
}

function BackgroundImage({ slide, w, h }: { slide: Slide; w: number; h: number }) {
  const bg = slide.background as Extract<Slide['background'], { type: 'image' }>
  const { setBackground, selectLayer } = useEditor()
  const [img] = useImage(proxyIfNeeded(bg.src), 'anonymous')
  const imageRef = useRef<Konva.Image>(null)

  const brightness = bg.brightness ?? 0
  const contrast   = bg.contrast   ?? 0
  const saturation = bg.saturation ?? 0
  const blur       = bg.blur       ?? 0

  // Re-cache image when source changes — cache is the pixel buffer filters operate on
  useEffect(() => {
    const node = imageRef.current
    if (!node || !img) return
    node.cache()
    node.filters([Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL, Konva.Filters.Blur])
    node.getLayer()?.batchDraw()
  }, [img])

  // Apply filter values on every slider change (cheap — no re-cache)
  useEffect(() => {
    const node = imageRef.current
    if (!node) return
    // Konva filter attrs are dynamic — use base Node.setAttr to bypass typed ImageConfig
    const n = node as Konva.Node
    n.setAttr('brighten', brightness / 100)
    n.setAttr('contrast', contrast)
    n.setAttr('saturation', saturation / 100)
    n.setAttr('blurRadius', blur)
    node.getLayer()?.batchDraw()
  }, [brightness, contrast, saturation, blur])

  if (!img) return <Rect x={0} y={0} width={w} height={h} fill="#222" listening={false} />

  const ar = img.width / img.height
  const target = w / h
  let dw = w, dh = h, dx = 0, dy = 0
  if (bg.fit === 'cover') {
    if (ar > target) { dh = h; dw = h * ar; dx = (w - dw) / 2 }
    else             { dw = w; dh = w / ar; dy = (h - dh) / 2 }
  } else {
    if (ar > target) { dw = w; dh = w / ar; dy = (h - dh) / 2 }
    else             { dh = h; dw = h * ar; dx = (w - dw) / 2 }
  }

  // Apply zoom from center of the computed image rect
  const sc = bg.scale ?? 1
  if (sc !== 1) {
    const cx = dx + dw / 2
    const cy = dy + dh / 2
    dw *= sc; dh *= sc
    dx = cx - dw / 2
    dy = cy - dh / 2
  }

  // Apply pan offset accumulated from drags
  dx += bg.offsetX ?? 0
  dy += bg.offsetY ?? 0

  return (
    <Group>
      {/*
        Draggable image group. x/y are explicit so react-konva resets the group
        position back to (0,0) on each re-render — this avoids a flicker on dragEnd
        because the image's dx/dy already include the new offset from the store update.
      */}
      <Group
        x={0} y={0}
        draggable
        onDragEnd={e => {
          const gx = e.target.x()
          const gy = e.target.y()
          const stage = e.target.getStage()
          if (stage) stage.container().style.cursor = 'grab'
          setBackground({ ...bg, offsetX: (bg.offsetX ?? 0) + gx, offsetY: (bg.offsetY ?? 0) + gy })
        }}
        onClick={() => selectLayer(null)}
        onTap={() => selectLayer(null)}
        onMouseEnter={e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'grab' }}
        onDragStart={e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'grabbing' }}
        onMouseLeave={e => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default' }}
      >
        <KImage ref={imageRef} image={img} x={dx} y={dy} width={dw} height={dh} />
      </Group>
      {/* Overlay stays fixed over the full canvas — not part of the draggable group */}
      <Rect x={0} y={0} width={w} height={h} fill={bg.overlayColor} opacity={bg.overlayOpacity} listening={false} />
    </Group>
  )
}

// ── Text layer ──────────────────────────────────────────────────────────

function TextNode({ layer, isEditing, onSelect, onChange, onBeginEdit }: {
  layer: TextLayer
  isEditing: boolean
  onSelect: () => void
  onChange: (patch: Partial<TextLayer>) => void
  onBeginEdit: () => void
}) {
  const ref = useRef<Konva.Text>(null)
  // Long-press timer for mobile inline-edit (touch & hold ≈ 500ms).
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  return (
    <Text
      ref={ref}
      id={layer.id}
      name={layer.name}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      rotation={layer.rotation}
      opacity={layer.opacity}
      // Hidden while inline-editing; the contenteditable overlay shows the live text.
      visible={layer.visible && !isEditing}
      text={layer.uppercase ? layer.text.toUpperCase() : layer.text}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      fontStyle={`${layer.fontStyle === 'italic' ? 'italic ' : ''}${layer.fontWeight}`}
      fill={layer.fill}
      align={layer.align}
      letterSpacing={layer.letterSpacing}
      lineHeight={layer.lineHeight}
      shadowEnabled={layer.shadow.enabled}
      shadowColor={layer.shadow.color}
      shadowBlur={layer.shadow.blur}
      shadowOffsetX={layer.shadow.offsetX}
      shadowOffsetY={layer.shadow.offsetY}
      stroke={layer.stroke.enabled ? layer.stroke.color : undefined}
      strokeWidth={layer.stroke.enabled ? layer.stroke.width : 0}
      fillAfterStrokeEnabled={layer.stroke.enabled}
      draggable={!layer.locked}
      onClick={onSelect}
      // Cursor hints — text cursor signals "double-click to edit". This is the
      // single biggest discoverability fix for the inline-edit feature.
      onMouseEnter={(e) => {
        if (layer.locked) return
        const s = e.target.getStage()
        if (s) s.container().style.cursor = 'text'
      }}
      onMouseLeave={(e) => {
        const s = e.target.getStage()
        if (s) s.container().style.cursor = 'default'
      }}
      onTap={(e) => {
        // If the long-press already opened inline edit, swallow the trailing tap.
        if (longPressFired.current) {
          longPressFired.current = false
          e.cancelBubble = true
          return
        }
        onSelect()
      }}
      onDblClick={(e) => {
        if (layer.locked) return
        e.cancelBubble = true
        onSelect()
        onBeginEdit()
      }}
      onDblTap={(e) => {
        if (layer.locked) return
        e.cancelBubble = true
        onSelect()
        onBeginEdit()
      }}
      onTouchStart={() => {
        if (layer.locked) return
        longPressFired.current = false
        clearLongPress()
        longPressTimer.current = setTimeout(() => {
          longPressFired.current = true
          onSelect()
          onBeginEdit()
        }, 500)
      }}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onDragStart={clearLongPress}
      onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current
        if (!node) return
        const scaleX = node.scaleX()
        const newWidth = Math.max(80, node.width() * scaleX)
        node.scaleX(1); node.scaleY(1)
        onChange({
          x: node.x(),
          y: node.y(),
          width: newWidth,
          rotation: node.rotation(),
        })
      }}
    />
  )
}

// Contenteditable overlay positioned over a Konva Text node for inline editing.
// Mirrors the Konva Text's font / color / alignment so the in-place experience
// looks identical to the rendered canvas. Blur saves; Escape cancels.
function InlineTextEditor({
  layer, scale, onCommit, onCancel,
}: {
  layer: TextLayer
  scale: number
  onCommit: (text: string) => void
  onCancel: () => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const initialTextRef = useRef(layer.text)
  const cancelledRef = useRef(false)

  // Mount: focus + select all so the user can start typing immediately.
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [])

  const commit = () => {
    if (cancelledRef.current) return
    const el = editorRef.current
    if (!el) return
    // innerText preserves visible newlines; trim trailing newline added by contentEditable.
    const next = el.innerText.replace(/\n$/, '')
    if (next === initialTextRef.current) {
      onCancel()
    } else {
      onCommit(next)
    }
  }

  const cancel = () => {
    cancelledRef.current = true
    onCancel()
  }

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Edit text"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
        // Allow Enter for newlines (titles wrap). Cmd/Ctrl+Enter commits early.
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLElement).blur()
        }
        // Stop the canvas keyboard handler from snatching Backspace/Delete
        // (it would delete the layer otherwise — same reason inputs are skipped).
        e.stopPropagation()
      }}
      style={{
        position: 'absolute',
        // Konva layer x/y are in canvas coords — multiply by scale for screen px.
        left: layer.x * scale,
        top: layer.y * scale,
        width: layer.width * scale,
        // Match Konva text rendering as closely as possible.
        transformOrigin: 'top left',
        transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
        fontFamily: layer.fontFamily,
        fontSize: layer.fontSize * scale,
        fontWeight: layer.fontWeight,
        fontStyle: layer.fontStyle,
        color: layer.fill,
        textAlign: layer.align,
        letterSpacing: `${layer.letterSpacing}px`,
        lineHeight: layer.lineHeight,
        textTransform: layer.uppercase ? 'uppercase' : 'none',
        // Keep the box visually distinct so it's obvious editing is active.
        outline: '2px solid #9a442d',
        outlineOffset: '2px',
        background: 'rgba(255,255,255,0.04)',
        padding: 0,
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        cursor: 'text',
        zIndex: 50,
        // Don't show the browser caret-color override; default looks fine.
      }}
    >
      {initialTextRef.current}
    </div>
  )
}

// ── Image layer ─────────────────────────────────────────────────────────

function ImageNode({ layer, onSelect, onChange }: {
  layer: ImageLayer
  onSelect: () => void
  onChange: (patch: Partial<ImageLayer>) => void
}) {
  const ref = useRef<Konva.Image>(null)
  const [img] = useImage(proxyIfNeeded(layer.src), 'anonymous')

  // Cover crop: compute which portion of the source image to show so it fills
  // the layer rect without stretching, cropping to center (same math as BackgroundImage).
  let coverCrop: { x: number; y: number; width: number; height: number } | undefined
  if (img && layer.fit === 'cover') {
    const imgAr  = img.width / img.height
    const layerAr = layer.width / layer.height
    if (imgAr > layerAr) {
      // image is wider than the box — crop left/right, keep full height
      const cropH = img.height
      const cropW = img.height * layerAr
      coverCrop = { x: (img.width - cropW) / 2, y: 0, width: cropW, height: cropH }
    } else {
      // image is taller than the box — crop top/bottom, keep full width
      const cropW = img.width
      const cropH = img.width / layerAr
      coverCrop = { x: 0, y: (img.height - cropH) / 2, width: cropW, height: cropH }
    }
  }

  return (
    <KImage
      ref={ref}
      id={layer.id}
      name={layer.name}
      image={img}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      cornerRadius={layer.cornerRadius}
      crop={coverCrop}
      draggable={!layer.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current
        if (!node) return
        const scaleX = node.scaleX(), scaleY = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        onChange({
          x: node.x(),
          y: node.y(),
          width:  Math.max(20, node.width()  * scaleX),
          height: Math.max(20, node.height() * scaleY),
          rotation: node.rotation(),
        })
      }}
    />
  )
}

// ── Shape layer ─────────────────────────────────────────────────────────

function ShapeNode({ layer, onSelect, onChange }: {
  layer: ShapeLayer
  onSelect: () => void
  onChange: (patch: Partial<ShapeLayer>) => void
}) {
  const ref = useRef<Konva.Node>(null)
  const common = {
    id: layer.id, name: layer.name,
    x: layer.x, y: layer.y, rotation: layer.rotation,
    opacity: layer.opacity, visible: layer.visible,
    fill: layer.fill, stroke: layer.stroke === 'transparent' ? undefined : layer.stroke,
    strokeWidth: layer.strokeWidth,
    draggable: !layer.locked,
    onClick: onSelect, onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: () => {
      const node = ref.current
      if (!node) return
      const sx = node.scaleX(), sy = node.scaleY()
      node.scaleX(1); node.scaleY(1)
      onChange({
        x: node.x(),
        y: node.y(),
        width:  Math.max(8, (node as Konva.Rect).width?.()  * sx || layer.width * sx),
        height: Math.max(8, (node as Konva.Rect).height?.() * sy || layer.height * sy),
        rotation: node.rotation(),
      })
    },
  }
  if (layer.shape === 'rect') {
    return <Rect ref={ref as React.RefObject<Konva.Rect>} {...common} width={layer.width} height={layer.height} cornerRadius={layer.cornerRadius} />
  }
  if (layer.shape === 'circle') {
    return <Circle ref={ref as React.RefObject<Konva.Circle>} {...common} radius={Math.min(layer.width, layer.height) / 2} />
  }
  // line
  return <Line ref={ref as React.RefObject<Konva.Line>} {...common} points={[0, 0, layer.width, 0]} strokeWidth={Math.max(1, layer.height)} stroke={layer.fill} />
}

// ── Safe zone overlay ────────────────────────────────────────────────────
// Shows the areas that Instagram's UI overlays (not exported — hidden before toDataURL).
//
// Safe zones by format:
//   4:5 / 1:1 feed: 8% top & bottom, 5% sides
//   9:16 story:    12% top, 15% bottom, 5% sides

function SafeZoneOverlay({ format, w, h }: { format: CanvasFormat; w: number; h: number }) {
  const isStory = format === '9:16'
  const topUnsafe  = isStory ? Math.round(h * 0.12) : Math.round(h * 0.08)
  const botUnsafe  = isStory ? Math.round(h * 0.15) : Math.round(h * 0.08)
  const sideUnsafe = Math.round(w * 0.05)
  const YELLOW = 'rgba(250,204,21,0.65)'
  const FILL   = 'rgba(250,204,21,0.09)'
  const DASH: number[] = [14, 8]

  return (
    <Group listening={false}>
      {/* Unsafe top zone */}
      <Rect x={0} y={0} width={w} height={topUnsafe} fill={FILL} listening={false} />
      <Line points={[0, topUnsafe, w, topUnsafe]} stroke={YELLOW} strokeWidth={2} dash={DASH} listening={false} />
      {/* Unsafe bottom zone */}
      <Rect x={0} y={h - botUnsafe} width={w} height={botUnsafe} fill={FILL} listening={false} />
      <Line points={[0, h - botUnsafe, w, h - botUnsafe]} stroke={YELLOW} strokeWidth={2} dash={DASH} listening={false} />
      {/* Side margins */}
      <Rect x={0} y={0} width={sideUnsafe} height={h} fill="rgba(250,204,21,0.04)" listening={false} />
      <Rect x={w - sideUnsafe} y={0} width={sideUnsafe} height={h} fill="rgba(250,204,21,0.04)" listening={false} />
      {/* Label */}
      <Text
        text={isStory ? 'SAFE ZONE  (12% top · 15% bottom · 5% sides)' : 'SAFE ZONE  (8% top & bottom · 5% sides)'}
        x={0} y={topUnsafe + 10}
        width={w} align="center"
        fill="rgba(250,204,21,0.75)"
        fontSize={22} fontFamily="Inter, sans-serif"
        listening={false}
      />
    </Group>
  )
}

// ── Main canvas ─────────────────────────────────────────────────────────

export interface PostCanvasHandle {
  exportPng: () => Promise<string>
  exportAllSlides: () => Promise<string[]>
}

// Preload all fonts needed for canvas rendering.
// Canvas 2D does NOT support CSS variables — fonts must be loaded under their plain name.
const CANVAS_FONTS = [
  '900 10px Epilogue', '700 10px Epilogue', '400 10px Epilogue',
  '800 10px Inter', '600 10px Inter', '400 10px Inter',
  '700 10px "Space Grotesk"', '400 10px "Space Grotesk"',
  '900 10px Fraunces', '800 10px Fraunces', '600 10px Fraunces', '400 10px Fraunces',
  'italic 900 10px Fraunces', 'italic 800 10px Fraunces', 'italic 400 10px Fraunces',
  '400 10px "Bebas Neue"',
  '500 10px "DM Mono"', '400 10px "DM Mono"',
]

// Google Fonts stylesheet for canvas-only fonts (not in the root Next.js layout).
// Injected lazily so it only loads when the canvas editor is visited.
const CANVAS_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;0,9..144,900;1,9..144,400;1,9..144,600&family=Bebas+Neue&family=DM+Mono:wght@400;500&display=block'

export function PostCanvas({ onExportRef }: { onExportRef?: (h: PostCanvasHandle) => void }) {
  const { design, activeSlideIndex, selectedLayerId, selectLayer, updateLayer, showSafeZone } = useEditor()
  useCanvasKeyboard()
  const slide = design.slides[activeSlideIndex]
  const { w: cW, h: cH } = CANVAS_DIMS[design.format]

  // Inline text editor state — id of the text layer currently being edited.
  // Cleared when the editor commits or cancels, or when the active slide changes.
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  useEffect(() => { setInlineEditId(null) }, [activeSlideIndex])
  const editingLayer = inlineEditId
    ? (slide.layers.find(l => l.id === inlineEditId && l.type === 'text') as TextLayer | undefined)
    : undefined

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef     = useRef<Konva.Stage>(null)
  const trRef        = useRef<Konva.Transformer>(null)
  const [scale, setScale] = useState(1)
  // Tracks whether all canvas fonts are loaded. When true, Konva redraws
  // so templates render Fraunces/Bebas Neue/DM Mono instead of the fallback.
  const [fontsReady, setFontsReady] = useState(false)

  // Inject Google Fonts stylesheet for Fraunces/Bebas Neue/DM Mono (not in root layout),
  // then preload all brand fonts. After they resolve, set fontsReady → triggers a Konva
  // redraw so the canvas shows the correct typefaces instead of Georgia/Impact fallbacks.
  useEffect(() => {
    const loadFonts = async () => {
      await Promise.allSettled(CANVAS_FONTS.map(f => document.fonts.load(f)))
      setFontsReady(true)
      // Force Konva to redraw all layers with the now-loaded fonts
      stageRef.current?.getLayers().forEach(l => l.batchDraw())
    }
    const LINK_ID = 'canvas-editor-fonts'
    if (!document.getElementById(LINK_ID)) {
      const link = document.createElement('link')
      link.id = LINK_ID
      link.rel = 'stylesheet'
      link.href = CANVAS_FONT_HREF
      link.onload = () => { loadFonts() }
      document.head.appendChild(link)
    } else {
      loadFonts()
    }
  }, [])

  // Responsive scaling — fit canvas in container
  const fitToContainer = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const pad = 24
    const availW = el.clientWidth  - pad * 2
    const availH = el.clientHeight - pad * 2
    const s = Math.min(availW / cW, availH / cH, 1)
    setScale(s > 0 ? s : 0.2)
  }, [cW, cH])

  useEffect(() => {
    // Measure once on mount; ResizeObserver handles subsequent changes.
    // This legitimately sets state in response to DOM sizing — ResizeObserver is an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fitToContainer()
    const ro = new ResizeObserver(fitToContainer)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [fitToContainer])

  // Transformer follows selected node — but never attaches while inline-editing,
  // so the resize handles don't sit on top of the contenteditable overlay.
  useEffect(() => {
    const stage = stageRef.current
    const tr = trRef.current
    if (!stage || !tr) return
    if (!selectedLayerId || inlineEditId) { tr.nodes([]); tr.getLayer()?.batchDraw(); return }
    const node = stage.findOne(`#${selectedLayerId}`)
    if (node) { tr.nodes([node]); tr.getLayer()?.batchDraw() }
    else      { tr.nodes([]) }
  }, [selectedLayerId, activeSlideIndex, design, inlineEditId])

  // Ref for the safe-zone overlay layer so we can hide it during export
  const safeZoneLayerRef = useRef<Konva.Layer>(null)

  // Keep a ref to the current showSafeZone so exports restore the right state.
  // Without this, exportPng always called visible(true) regardless of toggle state,
  // causing the overlay to reappear after every export even when turned off.
  const showSafeZoneRef = useRef(showSafeZone)
  useEffect(() => { showSafeZoneRef.current = showSafeZone }, [showSafeZone])

  // Expose export handle (export by temporarily restoring full scale)
  useEffect(() => {
    if (!onExportRef) return
    onExportRef({
      exportPng: async () => {
        const stage = stageRef.current
        if (!stage) return ''
        // Hide transformer + safe zone overlay during export
        trRef.current?.visible(false)
        safeZoneLayerRef.current?.visible(false)
        stage.batchDraw()
        const url = stage.toDataURL({ pixelRatio: 1 / scale, mimeType: 'image/png' })
        trRef.current?.visible(true)
        // Restore to whatever the toggle state actually is, not always-true
        safeZoneLayerRef.current?.visible(showSafeZoneRef.current)
        stage.batchDraw()
        return url
      },
      exportAllSlides: async () => {
        // Export each slide by temporarily setting activeSlideIndex
        const results: string[] = []
        const state = useEditor.getState()
        const original = state.activeSlideIndex
        trRef.current?.visible(false)
        safeZoneLayerRef.current?.visible(false)
        for (let i = 0; i < state.design.slides.length; i++) {
          useEditor.setState({ activeSlideIndex: i, selectedLayerId: null })
          // wait a frame for React to render + Konva to draw
          await new Promise(r => requestAnimationFrame(() => r(null)))
          await new Promise(r => requestAnimationFrame(() => r(null)))
          const stage = stageRef.current
          if (stage) results.push(stage.toDataURL({ pixelRatio: 1 / scale, mimeType: 'image/png' }))
        }
        useEditor.setState({ activeSlideIndex: original })
        trRef.current?.visible(true)
        // Restore to actual toggle state
        safeZoneLayerRef.current?.visible(showSafeZoneRef.current)
        return results
      },
    })
  }, [onExportRef, scale])

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) selectLayer(null)
  }

  return (
    <div ref={containerRef} className="flex-1 min-h-[420px] flex items-center justify-center bg-[#0a0a0a] rounded-xl overflow-hidden">
      <div
        style={{
          // `position: relative` so the inline editor overlay can pin to the stage origin.
          position: 'relative',
          width: cW * scale,
          height: cH * scale,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          borderRadius: 6,
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <Stage
          ref={stageRef}
          key={fontsReady ? 'fonts-ready' : 'fonts-loading'}
          width={cW * scale}
          height={cH * scale}
          scale={{ x: scale, y: scale }}
          onMouseDown={handleStageClick}
          onTouchStart={handleStageClick}
        >
          <KLayer>
            <Background slide={slide} w={cW} h={cH} />
            {slide.layers.map(layer => {
              const onSelect = () => selectLayer(layer.id)
              const onChange = (patch: Partial<Layer>) => updateLayer(layer.id, patch as Partial<Layer>)
              if (layer.type === 'text')  return (
                <TextNode
                  key={layer.id}
                  layer={layer}
                  isEditing={inlineEditId === layer.id}
                  onSelect={onSelect}
                  onChange={onChange as (p: Partial<TextLayer>) => void}
                  onBeginEdit={() => setInlineEditId(layer.id)}
                />
              )
              if (layer.type === 'image') return <ImageNode key={layer.id} layer={layer} onSelect={onSelect} onChange={onChange as (p: Partial<ImageLayer>) => void} />
              return <ShapeNode key={layer.id} layer={layer} onSelect={onSelect} onChange={onChange as (p: Partial<ShapeLayer>) => void} />
            })}
            <Transformer
              ref={trRef}
              rotateEnabled
              borderStroke="#9a442d"
              borderStrokeWidth={2}
              anchorFill="#fff"
              anchorStroke="#9a442d"
              anchorStrokeWidth={2}
              anchorSize={12}
              keepRatio={false}
              ignoreStroke
              boundBoxFunc={(_oldBox, newBox) => newBox.width < 20 || newBox.height < 20 ? _oldBox : newBox}
            />
          </KLayer>

          {/* Safe zone overlay — separate layer so it can be hidden during export */}
          <KLayer ref={safeZoneLayerRef} visible={showSafeZone} listening={false}>
            <SafeZoneOverlay format={design.format} w={cW} h={cH} />
          </KLayer>
        </Stage>

        {/* Inline text editor overlay — positioned over the hidden Konva text node. */}
        {editingLayer && (
          <InlineTextEditor
            layer={editingLayer}
            scale={scale}
            onCommit={(text) => { updateLayer(editingLayer.id, { text }); setInlineEditId(null) }}
            onCancel={() => setInlineEditId(null)}
          />
        )}
      </div>
    </div>
  )
}

// Format as-used indicator
export function CanvasFormatBadge({ format }: { format: CanvasFormat }) {
  const labels: Record<CanvasFormat, string> = { '1:1': 'Square', '4:5': 'Feed (4:5)', '9:16': 'Story (9:16)' }
  return <span className="text-xs text-white/50">{labels[format]} · {CANVAS_DIMS[format].w}×{CANVAS_DIMS[format].h}</span>
}
