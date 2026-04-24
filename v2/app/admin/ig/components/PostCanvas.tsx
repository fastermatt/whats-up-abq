'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Stage, Layer as KLayer, Rect, Text, Image as KImage, Group, Circle, Line, Transformer } from 'react-konva'
import Konva from 'konva'
import useImage from 'use-image'
import type { Slide, Layer, TextLayer, ImageLayer, ShapeLayer, CanvasFormat } from '../types'
import { CANVAS_DIMS } from '../types'
import { useEditor } from '../store'

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
  const [img] = useImage(bg.src, 'anonymous')
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
  return (
    <Group listening={false}>
      <KImage image={img} x={dx} y={dy} width={dw} height={dh} />
      <Rect x={0} y={0} width={w} height={h} fill={bg.overlayColor} opacity={bg.overlayOpacity} />
    </Group>
  )
}

// ── Text layer ──────────────────────────────────────────────────────────

function TextNode({ layer, onSelect, onChange }: {
  layer: TextLayer
  onSelect: () => void
  onChange: (patch: Partial<TextLayer>) => void
}) {
  const ref = useRef<Konva.Text>(null)
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
      visible={layer.visible}
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
      onTap={onSelect}
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

// ── Image layer ─────────────────────────────────────────────────────────

function ImageNode({ layer, onSelect, onChange }: {
  layer: ImageLayer
  onSelect: () => void
  onChange: (patch: Partial<ImageLayer>) => void
}) {
  const ref = useRef<Konva.Image>(null)
  const [img] = useImage(layer.src, 'anonymous')
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
      draggable={!layer.locked}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => {
        const node = ref.current
        if (!node) return
        const sx = node.scaleX(), sy = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        onChange({
          x: node.x(),
          y: node.y(),
          width:  Math.max(20, node.width()  * sx),
          height: Math.max(20, node.height() * sy),
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

// ── Main canvas ─────────────────────────────────────────────────────────

export interface PostCanvasHandle {
  exportPng: () => Promise<string>
  exportAllSlides: () => Promise<string[]>
}

export function PostCanvas({ onExportRef }: { onExportRef?: (h: PostCanvasHandle) => void }) {
  const { design, activeSlideIndex, selectedLayerId, selectLayer, updateLayer } = useEditor()
  const slide = design.slides[activeSlideIndex]
  const { w: cW, h: cH } = CANVAS_DIMS[design.format]

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef     = useRef<Konva.Stage>(null)
  const trRef        = useRef<Konva.Transformer>(null)
  const [scale, setScale] = useState(1)

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

  // Transformer follows selected node
  useEffect(() => {
    const stage = stageRef.current
    const tr = trRef.current
    if (!stage || !tr) return
    if (!selectedLayerId) { tr.nodes([]); tr.getLayer()?.batchDraw(); return }
    const node = stage.findOne(`#${selectedLayerId}`)
    if (node) { tr.nodes([node]); tr.getLayer()?.batchDraw() }
    else      { tr.nodes([]) }
  }, [selectedLayerId, activeSlideIndex, design])

  // Expose export handle (export by temporarily restoring full scale)
  useEffect(() => {
    if (!onExportRef) return
    onExportRef({
      exportPng: async () => {
        const stage = stageRef.current
        if (!stage) return ''
        // Hide transformer during export
        trRef.current?.visible(false)
        trRef.current?.getLayer()?.batchDraw()
        const url = stage.toDataURL({ pixelRatio: 1 / scale, mimeType: 'image/png' })
        trRef.current?.visible(true)
        trRef.current?.getLayer()?.batchDraw()
        return url
      },
      exportAllSlides: async () => {
        // Export each slide by temporarily setting activeSlideIndex
        const results: string[] = []
        const state = useEditor.getState()
        const original = state.activeSlideIndex
        trRef.current?.visible(false)
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
              if (layer.type === 'text')  return <TextNode  key={layer.id} layer={layer} onSelect={onSelect} onChange={onChange as (p: Partial<TextLayer>) => void} />
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
        </Stage>
      </div>
    </div>
  )
}

// Format as-used indicator
export function CanvasFormatBadge({ format }: { format: CanvasFormat }) {
  const labels: Record<CanvasFormat, string> = { '1:1': 'Square', '4:5': 'Feed (4:5)', '9:16': 'Story (9:16)' }
  return <span className="text-xs text-white/50">{labels[format]} · {CANVAS_DIMS[format].w}×{CANVAS_DIMS[format].h}</span>
}
