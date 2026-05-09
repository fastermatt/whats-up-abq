'use client'

import { useState } from 'react'
import { useEditor } from '../store'
import type { TextLayer, ImageLayer, ShapeLayer, CanvasFormat, Layer, Slide, BackgroundFill } from '../types'
import { BRAND_COLORS, BRAND_FONTS } from '../types'

// ── Color schemes ────────────────────────────────────────────────────────
// A scheme defines bg/accent/text. Swapping a scheme walks every layer in
// every slide and replaces colors that match the OLD scheme's bg/accent/text
// with the NEW scheme's equivalents. Solid backgrounds and matching gradient
// stops also swap. Photo backgrounds are left alone.
//
// Hex compare is case-insensitive and trimmed; alpha-suffixed colors are
// matched on their leading 6 hex chars so e.g. "#9a442d" equals "#9a442dCC".

interface ColorScheme {
  id: string
  name: string
  bg: string
  accent: string
  text: string
}

const COLOR_SCHEMES: ColorScheme[] = [
  { id: 'cream-terra',     name: 'Cream / Terra',     bg: '#fbf7f1', accent: '#9a442d', text: '#1a1614' },
  { id: 'cream-sage',      name: 'Cream / Sage',      bg: '#fbf7f1', accent: '#4f6249', text: '#1a1614' },
  { id: 'cream-turquoise', name: 'Cream / Turquoise', bg: '#fbf7f1', accent: '#006a62', text: '#1a1614' },
  { id: 'night-cream',     name: 'Night / Cream',     bg: '#1a1614', accent: '#fbf7f1', text: '#fbf7f1' },
  { id: 'sandstone-terra', name: 'Sandstone / Terra', bg: '#eedcd0', accent: '#9a442d', text: '#1a1614' },
]

function normHex(c: string): string {
  if (!c) return ''
  const m = c.trim().toLowerCase()
  if (m.startsWith('#')) return m.slice(0, 7) // #rrggbb (drop alpha)
  return m
}

function buildColorMap(from: ColorScheme, to: ColorScheme): Record<string, string> {
  return {
    [normHex(from.bg)]:     to.bg,
    [normHex(from.accent)]: to.accent,
    [normHex(from.text)]:   to.text,
  }
}

function swap(c: string | undefined, map: Record<string, string>): string | undefined {
  if (!c) return c
  const key = normHex(c)
  if (key in map) {
    // Preserve any alpha suffix the original color carried.
    const original = c.trim()
    if (original.length > 7 && original.startsWith('#')) {
      return map[key] + original.slice(7)
    }
    return map[key]
  }
  return c
}

function swapBackground(bg: BackgroundFill, map: Record<string, string>): BackgroundFill {
  if (bg.type === 'color') {
    return { ...bg, color: swap(bg.color, map) ?? bg.color }
  }
  if (bg.type === 'gradient') {
    return { ...bg, from: swap(bg.from, map) ?? bg.from, to: swap(bg.to, map) ?? bg.to }
  }
  // Photo background — only its overlay color is swappable; leave the photo alone.
  return { ...bg, overlayColor: swap(bg.overlayColor, map) ?? bg.overlayColor }
}

function swapLayerColors(layer: Layer, map: Record<string, string>): Layer {
  if (layer.type === 'text') {
    const next: TextLayer = {
      ...layer,
      fill: swap(layer.fill, map) ?? layer.fill,
      // Don't touch shadow color (usually rgba black) or stroke unless it matches.
      stroke: { ...layer.stroke, color: swap(layer.stroke.color, map) ?? layer.stroke.color },
    }
    return next
  }
  if (layer.type === 'shape') {
    const next: ShapeLayer = {
      ...layer,
      fill: swap(layer.fill, map) ?? layer.fill,
      stroke: layer.stroke === 'transparent' ? layer.stroke : (swap(layer.stroke, map) ?? layer.stroke),
    }
    return next
  }
  return layer
}

function ColorSchemePicker() {
  const { design, loadDesign } = useEditor()
  const [open, setOpen] = useState(false)
  const [activeScheme, setActiveScheme] = useState<string>('cream-terra')

  const apply = (toId: string) => {
    if (toId === activeScheme) { setOpen(false); return }
    const from = COLOR_SCHEMES.find(s => s.id === activeScheme) ?? COLOR_SCHEMES[0]
    const to = COLOR_SCHEMES.find(s => s.id === toId)
    if (!to) return
    const map = buildColorMap(from, to)
    const slides: Slide[] = design.slides.map(s => ({
      ...s,
      background: swapBackground(s.background, map),
      layers: s.layers.map(l => swapLayerColors(l, map)),
    }))
    loadDesign({ ...design, slides })
    setActiveScheme(toId)
    setOpen(false)
  }

  const active = COLOR_SCHEMES.find(s => s.id === activeScheme) ?? COLOR_SCHEMES[0]

  return (
    <div>
      <Label>Color Scheme</Label>
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 bg-black/40 border border-white/10 rounded px-2 py-2 sm:py-1.5 text-xs text-white/85 hover:border-white/25 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <SchemeDots scheme={active} />
            <span className="truncate">{active.name}</span>
          </span>
          <span className="text-white/40 text-[10px]">{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-full bg-[#0d0d0d] border border-white/15 rounded shadow-lg overflow-hidden">
            {COLOR_SCHEMES.map(s => (
              <button
                key={s.id}
                onClick={() => apply(s.id)}
                className={`w-full flex items-center gap-2 px-2 py-2 text-left text-xs transition-colors ${
                  s.id === activeScheme
                    ? 'bg-[#9a442d]/25 text-white'
                    : 'text-white/75 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <SchemeDots scheme={s} />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SchemeDots({ scheme }: { scheme: ColorScheme }) {
  return (
    <span className="flex gap-0.5 flex-shrink-0">
      <span className="w-3 h-3 rounded-full border border-white/20" style={{ background: scheme.bg }} />
      <span className="w-3 h-3 rounded-full border border-white/20" style={{ background: scheme.accent }} />
      <span className="w-3 h-3 rounded-full border border-white/20" style={{ background: scheme.text }} />
    </span>
  )
}

// ── Small UI primitives ─────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1 block">{children}</span>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-white/[0.06]">
      <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-2.5">{title}</h4>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}
function NumInput({ value, onChange, min, max, step }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      value={Math.round(value)}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      min={min} max={max} step={step ?? 1}
      className="w-full bg-black/40 border border-white/10 rounded px-2 py-2 sm:py-1 text-xs text-white/90 focus:outline-none focus:border-[#9a442d]"
    />
  )
}
function TextInput({ value, onChange, rows }: { value: string; onChange: (v: string) => void; rows?: number }) {
  if (rows) {
    return (
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white/90 focus:outline-none focus:border-[#9a442d] resize-none font-mono" />
    )
  }
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white/90 focus:outline-none focus:border-[#9a442d]" />
  )
}
function Slider({ value, onChange, min, max, step }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number }) {
  return (
    <input type="range" min={min} max={max} step={step ?? 1} value={value} onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full accent-[#9a442d]" />
  )
}
function ColorInput({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5">
      <input type="color" value={value.startsWith('#') ? value : '#000000'} onChange={e => onChange(e.target.value)}
        className="w-10 h-8 rounded cursor-pointer bg-transparent border border-white/10" />
      <input value={value} onChange={e => onChange(e.target.value)}
        className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white/80 font-mono focus:outline-none focus:border-[#9a442d]" />
    </div>
  )
}
function Btn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className={`px-3 py-2 sm:px-2 sm:py-1 text-xs rounded border transition-colors touch-manipulation min-h-[36px] sm:min-h-0 ${
        active
          ? 'bg-[#9a442d] border-[#9a442d] text-white'
          : 'bg-black/30 border-white/10 text-white/70 hover:bg-black/50 hover:text-white'
      }`}>
      {children}
    </button>
  )
}
function Swatch({ color, onClick }: { color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={color}
      className="w-6 h-6 rounded-full border-2 border-white/15 hover:border-white/60 transition-colors"
      style={{ backgroundColor: color }} />
  )
}

// ── Canvas/format controls ──────────────────────────────────────────────

function CanvasControls() {
  const { design, setFormat, getActiveSlide, setBackground, addSlide, removeSlide, activeSlideIndex, setActiveSlide } = useEditor()
  const slide = getActiveSlide()
  const bg = slide.background
  const [showPosZoom, setShowPosZoom] = useState(false)

  return (
    <>
      <Section title="Canvas">
        <div>
          <Label>Format</Label>
          <div className="flex gap-1.5">
            {(['1:1', '4:5', '9:16'] as CanvasFormat[]).map(f => (
              <Btn key={f} active={design.format === f} onClick={() => setFormat(f)}>{f}</Btn>
            ))}
          </div>
        </div>
        <div>
          <Label>Slides ({design.slides.length})</Label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {design.slides.map((_, i) => (
              <button key={i} onClick={() => setActiveSlide(i)}
                className={`w-8 h-8 rounded border text-xs font-bold ${
                  activeSlideIndex === i
                    ? 'bg-[#9a442d] border-[#9a442d] text-white'
                    : 'bg-black/30 border-white/10 text-white/70'
                }`}>{i + 1}</button>
            ))}
            <button onClick={addSlide} title="Add slide"
              className="w-8 h-8 rounded border border-dashed border-white/20 text-white/50 hover:text-white hover:border-white/50 text-lg leading-none">+</button>
            {design.slides.length > 1 && (
              <button onClick={() => removeSlide(activeSlideIndex)} title="Remove current slide"
                className="px-2 h-8 rounded border border-white/10 text-red-400/80 hover:text-red-300 hover:border-red-400/40 text-xs">Remove</button>
            )}
          </div>
        </div>
      </Section>

      <Section title="Color Scheme">
        <ColorSchemePicker />
        <p className="text-[10px] text-white/35 leading-snug">
          Swaps every layer's color in one click. Photos and gradients keep their structure.
        </p>
      </Section>

      <Section title="Background">
        <div className="flex gap-1.5">
          <Btn active={bg.type === 'color'}    onClick={() => setBackground({ type: 'color', color: (bg.type === 'color' ? bg.color : BRAND_COLORS.cream) })}>Color</Btn>
          <Btn active={bg.type === 'gradient'} onClick={() => setBackground({ type: 'gradient', from: BRAND_COLORS.night, to: BRAND_COLORS.terra, angle: 135 })}>Gradient</Btn>
          <Btn active={bg.type === 'image'}    onClick={() => setBackground({ type: 'image', src: (bg as { src?: string }).src || '', fit: 'cover', overlayColor: '#000', overlayOpacity: 0.4 })}>Image</Btn>
        </div>
        {bg.type === 'color' && (
          <div>
            <Label>Fill color</Label>
            <ColorInput value={bg.color} onChange={c => setBackground({ type: 'color', color: c })} />
            <BrandColorRow onPick={c => setBackground({ type: 'color', color: c })} />
          </div>
        )}
        {bg.type === 'gradient' && (
          <>
            <div><Label>From</Label><ColorInput value={bg.from} onChange={c => setBackground({ ...bg, from: c })} /></div>
            <div><Label>To</Label>  <ColorInput value={bg.to}   onChange={c => setBackground({ ...bg, to: c })} /></div>
            <div>
              <Label>Angle ({bg.angle}°)</Label>
              <Slider value={bg.angle} onChange={v => setBackground({ ...bg, angle: v })} min={0} max={360} />
            </div>
          </>
        )}
        {bg.type === 'image' && (
          <>
            <UploadRow
              current={bg.src}
              onPick={url => setBackground({ ...bg, src: url })}
              label="Upload / paste URL"
            />
            {/* ── Photo filters ───────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label>Photo Filters</Label>
              <div>
                <div className="flex justify-between text-[10px] text-white/40 mb-0.5">
                  <span>Brightness</span><span>{bg.brightness ?? 0}</span>
                </div>
                <Slider value={bg.brightness ?? 0} onChange={v => setBackground({ ...bg, brightness: v })} min={-100} max={100} />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-white/40 mb-0.5">
                  <span>Contrast</span><span>{bg.contrast ?? 0}</span>
                </div>
                <Slider value={bg.contrast ?? 0} onChange={v => setBackground({ ...bg, contrast: v })} min={-100} max={100} />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-white/40 mb-0.5">
                  <span>Saturation</span><span>{bg.saturation ?? 0}</span>
                </div>
                <Slider value={bg.saturation ?? 0} onChange={v => setBackground({ ...bg, saturation: v })} min={-100} max={100} />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-white/40 mb-0.5">
                  <span>Blur</span><span>{bg.blur ?? 0}px</span>
                </div>
                <Slider value={bg.blur ?? 0} onChange={v => setBackground({ ...bg, blur: v })} min={0} max={20} step={0.5} />
              </div>
              {/* Reset all filters */}
              {((bg.brightness ?? 0) !== 0 || (bg.contrast ?? 0) !== 0 || (bg.saturation ?? 0) !== 0 || (bg.blur ?? 0) !== 0) && (
                <button
                  onClick={() => setBackground({ ...bg, brightness: 0, contrast: 0, saturation: 0, blur: 0 })}
                  className="text-[10px] text-[#9a442d] hover:text-white/60 transition-colors"
                >
                  Reset filters
                </button>
              )}
            </div>
            <div>
              <Label>Fit</Label>
              <div className="flex gap-1.5">
                <Btn active={bg.fit === 'cover'}   onClick={() => setBackground({ ...bg, fit: 'cover' })}>Cover</Btn>
                <Btn active={bg.fit === 'contain'} onClick={() => setBackground({ ...bg, fit: 'contain' })}>Contain</Btn>
              </div>
            </div>
            {/* Position & Zoom */}
            <div>
              <Btn active={showPosZoom} onClick={() => setShowPosZoom(s => !s)}>
                {showPosZoom ? 'Hide' : 'Show'} Position &amp; Zoom
              </Btn>
            </div>
            {showPosZoom && (
              <div className="space-y-2.5 pl-1 border-l-2 border-white/10">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Offset X</Label><NumInput value={bg.offsetX ?? 0} onChange={v => setBackground({ ...bg, offsetX: v })} min={-1080} max={1080} step={10} /></div>
                  <div><Label>Offset Y</Label><NumInput value={bg.offsetY ?? 0} onChange={v => setBackground({ ...bg, offsetY: v })} min={-1920} max={1920} step={10} /></div>
                </div>
                <div>
                  <Label>Scale ({(bg.scale ?? 1).toFixed(2)}×)</Label>
                  <Slider value={bg.scale ?? 1} onChange={v => setBackground({ ...bg, scale: v })} min={0.5} max={3} step={0.05} />
                </div>
                <Btn onClick={() => setBackground({ ...bg, offsetX: 0, offsetY: 0, scale: 1 })}>Reset</Btn>
              </div>
            )}
            <div><Label>Overlay color</Label><ColorInput value={bg.overlayColor} onChange={c => setBackground({ ...bg, overlayColor: c })} /></div>
            <div>
              <Label>Overlay opacity ({Math.round(bg.overlayOpacity * 100)}%)</Label>
              <Slider value={bg.overlayOpacity} onChange={v => setBackground({ ...bg, overlayOpacity: v })} min={0} max={1} step={0.01} />
            </div>
          </>
        )}
      </Section>
    </>
  )
}

function BrandColorRow({ onPick }: { onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {Object.values(BRAND_COLORS).map(c => <Swatch key={c} color={c} onClick={() => onPick(c)} />)}
    </div>
  )
}

function UploadRow({ current, onPick, label }: { current?: string; onPick: (url: string) => void; label: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        <label className="px-2 py-1 text-xs rounded border bg-black/30 border-white/10 text-white/70 hover:bg-black/50 hover:text-white cursor-pointer">
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => onPick(String(reader.result))
            reader.readAsDataURL(file)
          }} />
        </label>
        <input
          value={current ?? ''}
          onChange={e => onPick(e.target.value)}
          placeholder="https://…"
          className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white/80 font-mono focus:outline-none focus:border-[#9a442d]"
        />
      </div>
    </div>
  )
}

// ── Layer-specific panels ───────────────────────────────────────────────

function TextPanel({ layer, update }: { layer: TextLayer; update: (p: Partial<TextLayer>) => void }) {
  return (
    <>
      <Section title="Text">
        <div><Label>Content</Label><TextInput value={layer.text} onChange={v => update({ text: v })} rows={3} /></div>
        <div>
          <Label>Font</Label>
          <select value={layer.fontFamily} onChange={e => update({ fontFamily: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white/90 focus:outline-none focus:border-[#9a442d]">
            {BRAND_FONTS.map(f => <option key={f.name} value={f.stack}>{f.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Size</Label><NumInput value={layer.fontSize} onChange={v => update({ fontSize: Math.max(8, v) })} min={8} step={2} /></div>
          <div>
            <Label>Weight</Label>
            <select value={layer.fontWeight} onChange={e => update({ fontWeight: parseInt(e.target.value) })}
              className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white/90 focus:outline-none focus:border-[#9a442d]">
              {/* Only show weights the selected font actually supports */}
              {(BRAND_FONTS.find(f => f.stack === layer.fontFamily)?.weights ?? [400, 700, 900]).map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Btn active={layer.align === 'left'}   onClick={() => update({ align: 'left' })}>L</Btn>
          <Btn active={layer.align === 'center'} onClick={() => update({ align: 'center' })}>C</Btn>
          <Btn active={layer.align === 'right'}  onClick={() => update({ align: 'right' })}>R</Btn>
          <span className="flex-1" />
          <Btn active={layer.fontStyle === 'italic'} onClick={() => update({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' })}>I</Btn>
          <Btn active={layer.uppercase} onClick={() => update({ uppercase: !layer.uppercase })}>AA</Btn>
        </div>
        <div><Label>Fill</Label><ColorInput value={layer.fill} onChange={c => update({ fill: c })} /><BrandColorRow onPick={c => update({ fill: c })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Line h ({layer.lineHeight.toFixed(2)})</Label><Slider value={layer.lineHeight} onChange={v => update({ lineHeight: v })} min={0.7} max={2.5} step={0.05} /></div>
          <div><Label>Letter sp</Label><NumInput value={layer.letterSpacing} onChange={v => update({ letterSpacing: v })} step={0.5} /></div>
        </div>
      </Section>

      <Section title="Effects">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={layer.shadow.enabled} onChange={e => update({ shadow: { ...layer.shadow, enabled: e.target.checked } })} />
          <span className="text-xs text-white/70">Drop shadow</span>
        </div>
        {layer.shadow.enabled && (
          <>
            <div><Label>Shadow color</Label><ColorInput value={layer.shadow.color} onChange={c => update({ shadow: { ...layer.shadow, color: c } })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Blur</Label><NumInput value={layer.shadow.blur} onChange={v => update({ shadow: { ...layer.shadow, blur: v } })} /></div>
              <div><Label>X</Label><NumInput value={layer.shadow.offsetX} onChange={v => update({ shadow: { ...layer.shadow, offsetX: v } })} /></div>
              <div><Label>Y</Label><NumInput value={layer.shadow.offsetY} onChange={v => update({ shadow: { ...layer.shadow, offsetY: v } })} /></div>
            </div>
          </>
        )}
        <div className="flex items-center gap-2 pt-2">
          <input type="checkbox" checked={layer.stroke.enabled} onChange={e => update({ stroke: { ...layer.stroke, enabled: e.target.checked } })} />
          <span className="text-xs text-white/70">Outline</span>
        </div>
        {layer.stroke.enabled && (
          <>
            <div><Label>Stroke color</Label><ColorInput value={layer.stroke.color} onChange={c => update({ stroke: { ...layer.stroke, color: c } })} /></div>
            <div><Label>Stroke width</Label><NumInput value={layer.stroke.width} onChange={v => update({ stroke: { ...layer.stroke, width: v } })} step={0.5} /></div>
          </>
        )}
      </Section>
    </>
  )
}

// Logo SVG variants — switching the src file changes the path fill color.
const LOGO_VARIANTS: { src: string; label: string; canvasBg: string; dotStyle: React.CSSProperties }[] = [
  { src: '/logo-white.svg', label: 'White', canvasBg: '#1a1614', dotStyle: { background: '#ffffff' } },
  { src: '/logo-terra.svg', label: 'Terra', canvasBg: '#fbf7f1', dotStyle: { background: '#9a442d' } },
  { src: '/logo-black.svg', label: 'Black', canvasBg: '#fbf7f1', dotStyle: { background: '#1a1614' } },
  { src: '/logo-color.svg', label: 'Color', canvasBg: '#fbf7f1', dotStyle: { backgroundImage: 'linear-gradient(135deg,#9a442d 50%,#4f6249 50%)' } },
]

function ImagePanel({ layer, update }: { layer: ImageLayer; update: (p: Partial<ImageLayer>) => void }) {
  const isLogo = /\/logo(-\w+)?\.svg$/.test(layer.src)
  return (
    <Section title="Image">
      <UploadRow current={layer.src} onPick={u => update({ src: u })} label="Replace" />
      {isLogo && (
        <div>
          <Label>Logo color</Label>
          <div className="flex gap-2 flex-wrap">
            {LOGO_VARIANTS.map(v => (
              <button
                key={v.src}
                onClick={() => update({ src: v.src })}
                title={v.label}
                className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all ${
                  layer.src === v.src
                    ? 'border-[#9a442d] bg-[#9a442d]/15 text-white'
                    : 'border-white/10 bg-white/[0.04] text-white/50 hover:border-white/25 hover:text-white/70'
                }`}
              >
                {/* Mini preview: canvas swatch with logo color dot */}
                <span
                  className="w-10 h-5 rounded flex items-center justify-center"
                  style={{ background: v.canvasBg }}
                >
                  <span className="w-6 h-2 rounded-sm" style={v.dotStyle} />
                </span>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div><Label>Corner radius</Label><NumInput value={layer.cornerRadius} onChange={v => update({ cornerRadius: Math.max(0, v) })} /></div>
    </Section>
  )
}

function ShapePanel({ layer, update }: { layer: ShapeLayer; update: (p: Partial<ShapeLayer>) => void }) {
  return (
    <Section title="Shape">
      <div>
        <Label>Type</Label>
        <div className="flex gap-1.5">
          <Btn active={layer.shape === 'rect'}   onClick={() => update({ shape: 'rect' })}>Rect</Btn>
          <Btn active={layer.shape === 'circle'} onClick={() => update({ shape: 'circle' })}>Circle</Btn>
          <Btn active={layer.shape === 'line'}   onClick={() => update({ shape: 'line' })}>Line</Btn>
        </div>
      </div>
      <div><Label>Fill</Label><ColorInput value={layer.fill} onChange={c => update({ fill: c })} /><BrandColorRow onPick={c => update({ fill: c })} /></div>
      {layer.shape === 'rect' && <div><Label>Corner radius</Label><NumInput value={layer.cornerRadius} onChange={v => update({ cornerRadius: Math.max(0, v) })} /></div>}
      <div><Label>Stroke color</Label><ColorInput value={layer.stroke === 'transparent' ? '#000000' : layer.stroke} onChange={c => update({ stroke: c })} /></div>
      <div><Label>Stroke width</Label><NumInput value={layer.strokeWidth} onChange={v => update({ strokeWidth: Math.max(0, v) })} /></div>
    </Section>
  )
}

function CommonPanel({ layer, update }: { layer: Layer; update: (p: Partial<Layer>) => void }) {
  return (
    <Section title="Position & transform">
      <div className="grid grid-cols-2 gap-2">
        <div><Label>X</Label><NumInput value={layer.x} onChange={v => update({ x: v })} /></div>
        <div><Label>Y</Label><NumInput value={layer.y} onChange={v => update({ y: v })} /></div>
      </div>
      <div><Label>Rotation ({Math.round(layer.rotation)}°)</Label><Slider value={layer.rotation} onChange={v => update({ rotation: v })} min={-180} max={180} /></div>
      <div><Label>Opacity ({Math.round(layer.opacity * 100)}%)</Label><Slider value={layer.opacity} onChange={v => update({ opacity: v })} min={0} max={1} step={0.01} /></div>
    </Section>
  )
}

// ── Main design panel ───────────────────────────────────────────────────

export function DesignPanel() {
  const { getSelectedLayer, updateLayer } = useEditor()
  const selected = getSelectedLayer()

  return (
    <div className="lg:w-[320px] shrink-0 bg-[#0d0d0d] border border-white/[0.07] rounded-xl overflow-y-auto lg:max-h-[calc(100vh-180px)]">
      {selected ? (
        <>
          <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white capitalize">{selected.type} · {selected.name}</h3>
          </div>
          <CommonPanel layer={selected} update={p => updateLayer(selected.id, p)} />
          {selected.type === 'text'  && <TextPanel  layer={selected} update={p => updateLayer(selected.id, p)} />}
          {selected.type === 'image' && <ImagePanel layer={selected} update={p => updateLayer(selected.id, p)} />}
          {selected.type === 'shape' && <ShapePanel layer={selected} update={p => updateLayer(selected.id, p)} />}
        </>
      ) : (
        <CanvasControls />
      )}
    </div>
  )
}
