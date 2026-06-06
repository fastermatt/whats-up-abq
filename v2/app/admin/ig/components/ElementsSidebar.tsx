'use client'

import { useEditor, makeTextLayer, makeImageLayer, makeShapeLayer } from '../store'
import { CANVAS_DIMS, BRAND_COLORS } from '../types'
import type { Layer } from '../types'
import { Type, ImageIcon, Square, Circle as CircleIcon, Minus, Eye, EyeOff, Lock, Unlock, Trash2, ChevronUp, ChevronDown, Copy } from 'lucide-react'

function LeftIcon({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label}
      className="w-full flex flex-col items-center gap-1 py-3 px-2 rounded-lg hover:bg-white/[0.06] text-white/70 hover:text-white transition-colors">
      {children}
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  )
}

export function ElementsSidebar() {
  const { design, addLayer, getActiveSlide, selectedLayerId, selectLayer, updateLayer, removeLayer, duplicateLayer, reorderLayer } = useEditor()
  const { w, h } = CANVAS_DIMS[design.format]
  const slide = getActiveSlide()

  const addText = () => addLayer(makeTextLayer({ x: w / 2 - 300, y: h / 2 - 60, width: 600, text: 'Double-click to edit', align: 'center', fontSize: 80 }))
  const addHeadline = () => addLayer(makeTextLayer({
    x: w / 2 - 400, y: h / 2 - 100, width: 800, text: 'HEADLINE',
    fontSize: 160, fontWeight: 900, fill: BRAND_COLORS.ink, align: 'center',
    fontFamily: 'Epilogue, sans-serif',  // no var() prefix — canvas 2D can't resolve CSS custom properties
  }))
  const addImage = (src: string) => addLayer(makeImageLayer({ src, x: w / 2 - 300, y: h / 2 - 300, width: 600, height: 600 }))
  const addRect = () => addLayer(makeShapeLayer({ shape: 'rect', x: w / 2 - 200, y: h / 2 - 100, width: 400, height: 200, fill: BRAND_COLORS.terra, cornerRadius: 12 }))
  const addCircle = () => addLayer(makeShapeLayer({ shape: 'circle', x: w / 2 - 150, y: h / 2 - 150, width: 300, height: 300, fill: BRAND_COLORS.turquoise }))
  const addLine = () => addLayer(makeShapeLayer({ shape: 'line', x: w / 2 - 300, y: h / 2, width: 600, height: 4, fill: BRAND_COLORS.ink }))
  // Logo aspect ratio: 1907 × 1032 → width = height × (1907/1032)
  const LOGO_R = 1907 / 1032
  const addLogoWhite = () => addLayer(makeImageLayer({ src: '/logo-white.svg', x: Math.round(w / 2 - 111), y: Math.round(h / 2 - 30), width: Math.round(60 * LOGO_R), height: 60 }))
  const addLogoTerra = () => addLayer(makeImageLayer({ src: '/logo-terra.svg', x: Math.round(w / 2 - 111), y: Math.round(h / 2 - 30), width: Math.round(60 * LOGO_R), height: 60 }))

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => addImage(String(reader.result))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="lg:w-[220px] shrink-0 bg-[#0d0d0d] border border-white/[0.07] rounded-xl flex flex-col lg:max-h-[calc(100vh-180px)]">
      {/* Add elements */}
      <div className="p-2 border-b border-white/[0.06]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-2 mb-1.5">Add</p>
        <div className="grid grid-cols-3 gap-1">
          <LeftIcon label="Text"     onClick={addText}>    <Type size={18} /></LeftIcon>
          <LeftIcon label="Headline" onClick={addHeadline}><Type size={22} strokeWidth={2.5} /></LeftIcon>
          <label className="w-full flex flex-col items-center gap-1 py-3 px-2 rounded-lg hover:bg-white/[0.06] text-white/70 hover:text-white transition-colors cursor-pointer" title="Image">
            <ImageIcon size={18} />
            <span className="text-[10px] font-semibold">Image</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <LeftIcon label="Rect"   onClick={addRect}>  <Square size={18} /></LeftIcon>
          <LeftIcon label="Circle" onClick={addCircle}><CircleIcon size={18} /></LeftIcon>
          <LeftIcon label="Line"   onClick={addLine}>  <Minus size={18} /></LeftIcon>
        </div>
        <div className="grid grid-cols-2 gap-1 mt-1">
          <LeftIcon label="Logo (dark)" onClick={addLogoWhite}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.svg" alt="" className="h-4 w-auto opacity-80" />
          </LeftIcon>
          <LeftIcon label="Logo (light)" onClick={addLogoTerra}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-terra.svg" alt="" className="h-4 w-auto opacity-80" />
          </LeftIcon>
        </div>
      </div>

      {/* Layers list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-3 pt-3 pb-1.5">Layers ({slide.layers.length})</p>
        <div className="px-2 pb-2 space-y-0.5">
          {[...slide.layers].reverse().map((layer: Layer) => {
            const selected = layer.id === selectedLayerId
            return (
              <div key={layer.id}
                onClick={() => selectLayer(layer.id)}
                className={`group flex items-center gap-1.5 px-2 py-2 rounded cursor-pointer ${
                  selected ? 'bg-terra/30 text-white' : 'hover:bg-white/[0.04] text-white/70'
                }`}>
                <button onClick={e => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }}
                  aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                  className="text-white/40 hover:text-white w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button onClick={e => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }) }}
                  aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  className="text-white/40 hover:text-white w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <span className="flex-1 text-[11px] truncate min-w-0">
                  {layer.type === 'text' ? (layer as { text: string }).text.slice(0, 18) : layer.name}
                </span>
                {/* Layer actions — always visible when selected, revealed on hover otherwise */}
                <div className={`flex items-center gap-0.5 ${selected ? 'flex' : 'hidden group-hover:flex'}`}>
                  <button onClick={e => { e.stopPropagation(); reorderLayer(layer.id, 'up') }}   aria-label="Move layer up"    className="text-white/40 hover:text-white w-6 h-6 flex items-center justify-center"><ChevronUp size={12} /></button>
                  <button onClick={e => { e.stopPropagation(); reorderLayer(layer.id, 'down') }} aria-label="Move layer down"  className="text-white/40 hover:text-white w-6 h-6 flex items-center justify-center"><ChevronDown size={12} /></button>
                  <button onClick={e => { e.stopPropagation(); duplicateLayer(layer.id) }}       aria-label="Duplicate layer"  className="text-white/40 hover:text-white w-6 h-6 flex items-center justify-center"><Copy size={12} /></button>
                  <button onClick={e => { e.stopPropagation(); removeLayer(layer.id) }}          aria-label="Delete layer"     className="text-red-400/70 hover:text-red-300 w-6 h-6 flex items-center justify-center"><Trash2 size={12} /></button>
                </div>
              </div>
            )
          })}
          {slide.layers.length === 0 && (
            <p className="text-[11px] text-white/55 italic px-2 py-3">No layers yet — use Add above.</p>
          )}
        </div>
      </div>
    </div>
  )
}
