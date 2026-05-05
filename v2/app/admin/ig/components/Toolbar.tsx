'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Save, Layers as LayersIcon, RotateCcw, RotateCw } from 'lucide-react'
import { useEditor } from '../store'
import { EVENT_TEMPLATES, PROMO_TEMPLATES } from '../lib/templates'
import type { Template, TemplateContext, TemplateThumbnail } from '../lib/templates'
import { saveDesign } from '../lib/storage'
import type { PostCanvasHandle } from './PostCanvas'
import JSZip from 'jszip'
import type { NormalizedEvent } from '@/lib/events'

export type EditorMode = 'event' | 'generic'

interface ToolbarProps {
  mode: EditorMode
  onModeChange: (m: EditorMode) => void
  canvasRef: React.MutableRefObject<PostCanvasHandle | null>
  event: NormalizedEvent | null
  image: string
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

/** Scale a PNG data-URL down to maxWidth px, returns a JPEG thumbnail. */
async function scaledThumbnail(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(1, maxWidth / img.width)
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) { resolve(dataUrl); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const r = await fetch(dataUrl)
  return r.blob()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

// ── Template thumbnail SVG ────────────────────────────────────────────────

function gradientPoints(angle: number) {
  const rad = (angle * Math.PI) / 180
  const sin = Math.sin(rad)
  const cos = Math.cos(rad)
  return {
    x1: `${(0.5 - sin * 0.5) * 100}%`,
    y1: `${(0.5 + cos * 0.5) * 100}%`,
    x2: `${(0.5 + sin * 0.5) * 100}%`,
    y2: `${(0.5 - cos * 0.5) * 100}%`,
  }
}

function TemplateSwatch({ thumb, id }: { thumb: TemplateThumbnail; id: string }) {
  const gId = `tg-${id}`
  const pts = thumb.gradient ? gradientPoints(thumb.gradient.angle) : null
  return (
    <svg
      width={64} height={80}
      viewBox="0 0 100 125"
      className="rounded block flex-shrink-0"
      style={{ display: 'block' }}
    >
      <defs>
        {pts && thumb.gradient && (
          <linearGradient id={gId} x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}>
            <stop offset="0%" stopColor={thumb.gradient.from} />
            <stop offset="100%" stopColor={thumb.gradient.to} />
          </linearGradient>
        )}
      </defs>
      <rect width={100} height={125} fill={thumb.gradient ? `url(#${gId})` : (thumb.bg ?? '#fbf7f1')} />
      {thumb.blocks.map((b, i) => (
        <rect
          key={i}
          x={b.x} y={b.y} width={b.w} height={b.h}
          fill={b.c}
          opacity={b.o ?? 1}
          rx={b.r ?? 1}
        />
      ))}
    </svg>
  )
}

// ── Template gallery panel ────────────────────────────────────────────────

function TemplateGallery({
  activeTab, onTabChange, onApply, hasEvent,
}: {
  activeTab: 'event' | 'brand'
  onTabChange: (t: 'event' | 'brand') => void
  onApply: (t: Template) => void
  hasEvent: boolean
}) {
  const list = activeTab === 'event' ? EVENT_TEMPLATES : PROMO_TEMPLATES

  return (
    <div className="w-full bg-[#111] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-white/[0.08]">
        <button
          onClick={() => onTabChange('event')}
          className={`flex-1 py-2.5 text-xs font-bold tracking-wide transition-colors ${
            activeTab === 'event' ? 'bg-[#9a442d]/20 text-[#9a442d]' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Event Templates (6)
        </button>
        <div className="w-px bg-white/[0.08]" />
        <button
          onClick={() => onTabChange('brand')}
          className={`flex-1 py-2.5 text-xs font-bold tracking-wide transition-colors ${
            activeTab === 'brand' ? 'bg-[#9a442d]/20 text-[#9a442d]' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Brand Posts (7)
        </button>
      </div>

      {/* Note for event tab without event loaded */}
      {activeTab === 'event' && !hasEvent && (
        <p className="text-[11px] text-white/40 text-center px-4 py-2 bg-white/[0.03]">
          Load an event above to auto-fill event data
        </p>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-px bg-white/[0.05] p-px">
        {list.map(t => (
          <button
            key={t.id}
            onClick={() => onApply(t)}
            className="group bg-[#111] hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors p-3 sm:p-2.5 flex flex-col items-center gap-2 text-left touch-manipulation"
          >
            <div className="rounded overflow-hidden ring-1 ring-white/[0.08] group-hover:ring-[#9a442d]/60 transition-all group-hover:scale-[1.03]">
              <TemplateSwatch thumb={t.thumb} id={t.id} />
            </div>
            <div className="w-full">
              <p className="text-[11px] font-bold text-white/90 truncate leading-tight">{t.name}</p>
              <p className="text-[10px] text-white/40 leading-snug mt-0.5 line-clamp-2 hidden sm:block">{t.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main toolbar ──────────────────────────────────────────────────────────

export function Toolbar({ mode, onModeChange, canvasRef, event, image }: ToolbarProps) {
  const { design, loadDesign, renameDesign, undo, redo, canUndo, canRedo, showSafeZone, toggleSafeZone } = useEditor()
  const [showGallery, setShowGallery] = useState(false)
  // galleryTab defaults from mode but can be overridden by user clicking the tabs
  const [galleryTabOverride, setGalleryTabOverride] = useState<'event' | 'brand' | null>(null)
  const galleryTab = galleryTabOverride ?? (mode === 'event' ? 'event' : 'brand')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const galleryRef = useRef<HTMLDivElement>(null)

  // Close gallery on outside click
  useEffect(() => {
    if (!showGallery) return
    const handler = (e: MouseEvent) => {
      if (galleryRef.current && !galleryRef.current.contains(e.target as Node)) {
        setShowGallery(false)
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGallery(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [showGallery])

  const eventCtx = (): TemplateContext => ({
    title: event?.title, date: event?.date ?? undefined, time: event?.time ?? undefined,
    venue: event?.venue ?? undefined, category: event?.category ?? undefined,
    imageUrl: image || undefined,
    tagline: event?.about ?? undefined,
    cta: 'abqunplugged.com',
  })

  const applyTemplate = (t: Template) => {
    const ctx: TemplateContext = mode === 'event' && event ? eventCtx() : {}
    loadDesign(t.build(ctx, design.format))
    if (t.category === 'brand') onModeChange('generic')
    else onModeChange('event')
    setShowGallery(false)
  }

  const doSave = async () => {
    setSaveState('saving')
    try {
      let thumb: string | undefined
      if (canvasRef.current) {
        // Export full-res, then scale down to a thumbnail (~300px wide) so
        // localStorage doesn't hit the 5 MB quota with full-resolution PNGs.
        const fullUrl = await canvasRef.current.exportPng()
        thumb = await scaledThumbnail(fullUrl, 300)
      }
      saveDesign(design, thumb)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('idle')
    }
  }

  const exportPng = async () => {
    if (!canvasRef.current) return
    const url = await canvasRef.current.exportPng()
    const blob = await dataUrlToBlob(url)
    downloadBlob(blob, `${slugify(design.name || 'abq-post')}_${design.format.replace(':', 'x')}.png`)
  }

  const exportAllSlides = async () => {
    if (!canvasRef.current) return
    const urls = await canvasRef.current.exportAllSlides()
    if (urls.length === 1) return exportPng()
    const zip = new JSZip()
    for (let i = 0; i < urls.length; i++) {
      const blob = await dataUrlToBlob(urls[i])
      zip.file(`${slugify(design.name || 'abq-post')}_${i + 1}.png`, blob)
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(zipBlob, `${slugify(design.name || 'abq-post')}_carousel.zip`)
  }

  return (
    <div ref={galleryRef} className="space-y-2">
      {/* Control row — 3 logical groups separated by dividers */}
      <div className="bg-[#0d0d0d] border border-white/[0.07] rounded-xl px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">

        {/* Group 1: Mode + Templates (context controls) */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#0a0807]/60 rounded-lg p-0.5 touch-manipulation">
            <button
              onClick={() => onModeChange('event')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors touch-manipulation ${
                mode === 'event' ? 'bg-[#9a442d] text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >Event</button>
            <button
              onClick={() => onModeChange('generic')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors touch-manipulation ${
                mode === 'generic' ? 'bg-[#9a442d] text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >Brand</button>
          </div>

          <button
            onClick={() => setShowGallery(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs font-semibold transition-colors touch-manipulation ${
              showGallery
                ? 'bg-[#9a442d]/20 border-[#9a442d]/50 text-[#9a442d]'
                : 'bg-white/[0.05] hover:bg-white/[0.09] border-white/[0.09] text-white/70'
            }`}
          >
            Templates {showGallery ? '↑' : '↓'}
          </button>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-white/[0.08] mx-1" />

        {/* Group 2: Name + Undo/Redo (edit history) */}
        <div className="flex items-center gap-2 flex-1 sm:flex-none">
          <input
            value={design.name}
            onChange={e => renameDesign(e.target.value)}
            placeholder="Untitled"
            aria-label="Design name"
            className="bg-[#0a0807]/50 border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white/90 focus:outline-none focus:ring-1 focus:ring-[#9a442d]/50 focus:border-[#9a442d]/60 w-32 sm:w-28"
          />
          <div className="flex gap-1">
            <button
              onClick={undo}
              disabled={!canUndo()}
              title="Undo (⌘Z)"
              aria-label="Undo"
              className="flex items-center justify-center w-8 h-8 rounded bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.09] text-white/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <RotateCcw size={13} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              title="Redo (⌘⇧Z)"
              aria-label="Redo"
              className="flex items-center justify-center w-8 h-8 rounded bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.09] text-white/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <RotateCw size={13} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-white/[0.08] mx-1" />

        {/* Group 3: Save + Safe Zone + slide info + Download (output) */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-[11px] text-white/30 hidden md:inline tabular-nums">
            {design.slides.length}s · {design.format}
          </span>

          <button
            onClick={toggleSafeZone}
            title="Toggle safe zone guides"
            className={`px-2.5 py-1.5 border rounded text-xs font-semibold transition-colors touch-manipulation hidden sm:flex items-center gap-1 ${
              showSafeZone
                ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                : 'bg-white/[0.04] border-white/[0.07] text-white/35 hover:text-white/60 hover:bg-white/[0.07]'
            }`}
          >
            Safe Zone
          </button>

          <button
            onClick={doSave}
            disabled={saveState === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded text-xs font-semibold text-white/75 disabled:opacity-40 touch-manipulation"
          >
            <Save size={12} />
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save'}
          </button>

          {design.slides.length > 1 ? (
            <button
              onClick={exportAllSlides}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9a442d] hover:bg-[#b85535] rounded text-xs font-bold text-white touch-manipulation"
            >
              <LayersIcon size={12} /> Export ZIP
            </button>
          ) : (
            <button
              onClick={exportPng}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9a442d] hover:bg-[#b85535] rounded text-xs font-bold text-white touch-manipulation"
            >
              <Download size={12} /> Download
            </button>
          )}
        </div>
      </div>

      {/* Template gallery */}
      {showGallery && (
        <TemplateGallery
          activeTab={galleryTab}
          onTabChange={setGalleryTabOverride}
          onApply={applyTemplate}
          hasEvent={!!event}
        />
      )}
    </div>
  )
}
