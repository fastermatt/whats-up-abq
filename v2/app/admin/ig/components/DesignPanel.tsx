'use client'

import { useEditor } from '../store'
import type { TextLayer, ImageLayer, ShapeLayer, CanvasFormat, Layer } from '../types'
import { BRAND_COLORS, BRAND_FONTS } from '../types'

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
      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white/90 focus:outline-none focus:border-[#9a442d]"
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
      className={`px-2 py-1 text-xs rounded border transition-colors ${
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
            <div>
              <Label>Fit</Label>
              <div className="flex gap-1.5">
                <Btn active={bg.fit === 'cover'}   onClick={() => setBackground({ ...bg, fit: 'cover' })}>Cover</Btn>
                <Btn active={bg.fit === 'contain'} onClick={() => setBackground({ ...bg, fit: 'contain' })}>Contain</Btn>
              </div>
            </div>
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

function ImagePanel({ layer, update }: { layer: ImageLayer; update: (p: Partial<ImageLayer>) => void }) {
  return (
    <Section title="Image">
      <UploadRow current={layer.src} onPick={u => update({ src: u })} label="Replace" />
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
    <div className="w-[320px] shrink-0 bg-[#0d0d0d] border border-white/[0.07] rounded-xl overflow-y-auto max-h-[calc(100vh-180px)]">
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
