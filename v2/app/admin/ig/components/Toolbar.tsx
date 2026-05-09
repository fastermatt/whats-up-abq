'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Save, Layers as LayersIcon, RotateCcw, RotateCw, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useEditor } from '../store'
import { EVENT_TEMPLATES, PROMO_TEMPLATES, TEMPLATES } from '../lib/templates'
import type { Template, TemplateContext, TemplateThumbnail } from '../lib/templates'
import { saveDesign, saveUserTemplate, listUserTemplates, deleteUserTemplate } from '../lib/storage'
import type { Design } from '../types'
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

type GalleryTab = 'event' | 'brand' | 'user'

function TemplateGallery({
  activeTab, onTabChange, onApply, onApplyUserTemplate, onDeleteUserTemplate,
  hasEvent, userTemplates,
}: {
  activeTab: GalleryTab
  onTabChange: (t: GalleryTab) => void
  onApply: (t: Template) => void
  onApplyUserTemplate: (d: Design) => void
  onDeleteUserTemplate: (id: string) => void
  hasEvent: boolean
  userTemplates: Design[]
}) {
  const builtInList = activeTab === 'event' ? EVENT_TEMPLATES : activeTab === 'brand' ? PROMO_TEMPLATES : []

  return (
    <div className="w-full bg-[#111] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* Tabs — My Templates sits between Event and Brand so user-saved
          templates are the first thing the user reaches when they open the gallery. */}
      <div className="flex border-b border-white/[0.08]">
        <button
          onClick={() => onTabChange('event')}
          className={`flex-1 py-2.5 text-xs font-bold tracking-wide transition-colors ${
            activeTab === 'event' ? 'bg-[#9a442d]/20 text-[#9a442d]' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Event Templates ({EVENT_TEMPLATES.length})
        </button>
        <div className="w-px bg-white/[0.08]" />
        <button
          onClick={() => onTabChange('user')}
          className={`flex-1 py-2.5 text-xs font-bold tracking-wide transition-colors ${
            activeTab === 'user' ? 'bg-[#9a442d]/20 text-[#9a442d]' : 'text-white/50 hover:text-white/80'
          }`}
        >
          My Templates ({userTemplates.length})
        </button>
        <div className="w-px bg-white/[0.08]" />
        <button
          onClick={() => onTabChange('brand')}
          className={`flex-1 py-2.5 text-xs font-bold tracking-wide transition-colors ${
            activeTab === 'brand' ? 'bg-[#9a442d]/20 text-[#9a442d]' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Brand Posts ({PROMO_TEMPLATES.length})
        </button>
      </div>

      {/* Note for event tab without event loaded */}
      {activeTab === 'event' && !hasEvent && (
        <p className="text-[11px] text-white/40 text-center px-4 py-2 bg-white/[0.03]">
          Load an event above to auto-fill event data
        </p>
      )}

      {/* User templates empty state */}
      {activeTab === 'user' && userTemplates.length === 0 && (
        <p className="text-[11px] text-white/40 text-center px-4 py-6 bg-white/[0.03]">
          No saved templates yet. Tick &ldquo;Save as reusable template&rdquo; when saving a design to add one here.
        </p>
      )}

      {/* Template grid — built-in templates */}
      {activeTab !== 'user' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-px bg-white/[0.05] p-px">
          {builtInList.map(t => (
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
      )}

      {/* Template grid — user-saved templates */}
      {activeTab === 'user' && userTemplates.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-px bg-white/[0.05] p-px">
          {userTemplates.map(d => (
            <div
              key={d.id}
              className="group relative bg-[#111] hover:bg-white/[0.05] transition-colors p-3 sm:p-2.5"
            >
              <button
                onClick={() => onApplyUserTemplate(d)}
                className="w-full flex flex-col items-center gap-2 text-left touch-manipulation"
              >
                <div className="w-16 h-20 rounded overflow-hidden ring-1 ring-white/[0.08] group-hover:ring-[#9a442d]/60 transition-all bg-black flex items-center justify-center">
                  {d.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.thumbnail} alt={d.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-white/30 text-[9px]">No preview</span>
                  )}
                </div>
                <div className="w-full">
                  <p className="text-[11px] font-bold text-white/90 truncate leading-tight">{d.name || 'Untitled'}</p>
                  <p className="text-[10px] text-white/40 leading-snug mt-0.5">{d.slides.length} slide{d.slides.length > 1 ? 's' : ''} · {d.format}</p>
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteUserTemplate(d.id) }}
                title="Delete template"
                aria-label="Delete template"
                className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded bg-black/70 text-white/70 hover:text-white hover:bg-red-500/70 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main toolbar ──────────────────────────────────────────────────────────

export function Toolbar({ mode, onModeChange, canvasRef, event, image }: ToolbarProps) {
  const {
    design, loadDesign, applyTemplateDesign, renameDesign, undo, redo, canUndo, canRedo,
    showSafeZone, toggleSafeZone, lastTemplateId, lastTemplateBaseline,
  } = useEditor()
  const [showGallery, setShowGallery] = useState(false)
  // galleryTab defaults from mode but can be overridden by user clicking the tabs
  const [galleryTabOverride, setGalleryTabOverride] = useState<GalleryTab | null>(null)
  const galleryTab: GalleryTab = galleryTabOverride ?? (mode === 'event' ? 'event' : 'brand')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [userTemplates, setUserTemplates] = useState<Design[]>([])
  // Refresh user templates whenever the gallery opens or the My Templates tab is active.
  useEffect(() => { setUserTemplates(listUserTemplates()) }, [showGallery, galleryTab])
  const galleryRef = useRef<HTMLDivElement>(null)

  // Has the canvas diverged from the last applied template?
  // Compare slides arrays via JSON equality. Cheap enough; design is bounded.
  const hasDivergedFromTemplate =
    !!lastTemplateBaseline &&
    JSON.stringify(design.slides) !== JSON.stringify(lastTemplateBaseline.slides)

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
    applyTemplateDesign(t.id, t.build(ctx, design.format))
    if (t.category === 'brand') onModeChange('generic')
    else onModeChange('event')
    setShowGallery(false)
  }

  // Apply a user-saved template — same flow as built-ins but the template
  // already contains its own layers (no re-build with event ctx).
  const applyUserTemplate = (d: Design) => {
    // Use a synthetic id (`user:<id>`) so resetToTemplate knows it can't rebuild.
    const id = `user:${d.id}`
    applyTemplateDesign(id, {
      ...d,
      // New design id so further saves don't mutate the template entry.
      id: Math.random().toString(36).slice(2, 10),
    })
    setShowGallery(false)
  }

  const deleteUserTemplateById = (id: string) => {
    deleteUserTemplate(id)
    setUserTemplates(listUserTemplates())
  }

  // Reset the canvas to the last applied template's baseline.
  // For built-in templates we re-run build() with current event context so the
  // event details refresh too. For user templates we just reload the baseline.
  const resetToTemplate = () => {
    if (!lastTemplateId || !lastTemplateBaseline) return
    if (lastTemplateId.startsWith('user:')) {
      applyTemplateDesign(lastTemplateId, lastTemplateBaseline)
      return
    }
    const tmpl = TEMPLATES.find(t => t.id === lastTemplateId)
    if (!tmpl) {
      applyTemplateDesign(lastTemplateId, lastTemplateBaseline)
      return
    }
    const ctx: TemplateContext = mode === 'event' && event ? eventCtx() : {}
    applyTemplateDesign(tmpl.id, tmpl.build(ctx, design.format))
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
      // If the user opted in, also stash a copy under user-templates so it
      // shows up in the Templates gallery for re-use.
      if (saveAsTemplate) {
        saveUserTemplate(design, thumb)
        setUserTemplates(listUserTemplates())
        // Reset the checkbox so the next Save doesn't accidentally create
        // another template (sticky checkbox would lead to template proliferation).
        setSaveAsTemplate(false)
      }
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
          <div className="flex bg-[#0a0807]/60 rounded-lg p-0.5 touch-manipulation" role="radiogroup" aria-label="Editor mode">
            <button
              onClick={() => onModeChange('event')}
              role="radio"
              aria-checked={mode === 'event'}
              className={`min-h-[40px] px-3.5 text-xs font-bold rounded transition-colors touch-manipulation ${
                mode === 'event' ? 'bg-[#9a442d] text-white' : 'text-white/65 hover:text-white'
              }`}
            >Event</button>
            <button
              onClick={() => onModeChange('generic')}
              role="radio"
              aria-checked={mode === 'generic'}
              className={`min-h-[40px] px-3.5 text-xs font-bold rounded transition-colors touch-manipulation ${
                mode === 'generic' ? 'bg-[#9a442d] text-white' : 'text-white/65 hover:text-white'
              }`}
            >Brand</button>
          </div>

          {/* Templates is the most-used control once an event is loaded —
              promoted to a primary terra-filled action so visual weight
              matches frequency-of-use (round-2 critique #1). */}
          <button
            onClick={() => setShowGallery(v => !v)}
            aria-expanded={showGallery}
            className={`flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-lg text-xs font-bold transition-colors touch-manipulation ${
              showGallery
                ? 'bg-[#9a442d]/25 border border-[#9a442d]/60 text-[#e8a898]'
                : 'bg-[#9a442d] hover:bg-[#b5502f] text-white border border-[#9a442d]'
            }`}
          >
            <LayersIcon size={13} /> Templates
            {showGallery ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Reset to template — only visible after the user has diverged
              from a template baseline. Re-runs build() with the current event ctx. */}
          {lastTemplateId && hasDivergedFromTemplate && (
            <button
              onClick={resetToTemplate}
              title="Reset canvas to the last applied template"
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs font-semibold transition-colors touch-manipulation bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.09] text-white/60 hover:text-white"
            >
              <RefreshCw size={12} />
              <span className="hidden sm:inline">Reset to template</span>
              <span className="sm:hidden">Reset</span>
            </button>
          )}
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
            className="bg-[#0a0807]/50 border border-white/[0.08] rounded px-2.5 min-h-[40px] text-xs text-white/90 focus:outline-none focus:ring-1 focus:ring-[#9a442d]/50 focus:border-[#9a442d]/60 w-32 sm:w-28"
          />
          <div className="flex gap-1">
            <button
              onClick={undo}
              disabled={!canUndo()}
              title="Undo (⌘Z)"
              aria-label="Undo"
              className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.09] text-white/65 disabled:opacity-25 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              title="Redo (⌘⇧Z)"
              aria-label="Redo"
              className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.09] text-white/65 disabled:opacity-25 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <RotateCw size={14} />
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
            title={showSafeZone ? 'Hide safe-zone guides' : 'Show safe-zone guides'}
            aria-label="Toggle safe zone guides"
            aria-pressed={showSafeZone}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded border text-xs font-semibold transition-colors touch-manipulation ${
              showSafeZone
                ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                : 'bg-white/[0.04] border-white/[0.07] text-white/55 hover:text-white hover:bg-white/[0.07]'
            }`}
          >
            {/* Square-with-corners glyph as the affordance — much less visual
                noise than a "Safe Zone" pill that drew the eye away from
                Templates and Download. */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2"/>
              <rect x="5" y="5" width="6" height="6" rx="1" strokeDasharray="1 1.5"/>
            </svg>
          </button>

          {/* Save group: tickbox + button. Tickbox lets the user opt-in to
              also storing the design under user-templates so it appears in
              the gallery's "My Templates" tab. */}
          <label
            title="Also store this design under My Templates so you can re-use it as a starting point"
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] text-white/55 hover:text-white/80 cursor-pointer select-none transition-colors"
          >
            <input
              type="checkbox"
              checked={saveAsTemplate}
              onChange={e => setSaveAsTemplate(e.target.checked)}
              className="accent-[#9a442d] w-3 h-3"
            />
            <span className="hidden sm:inline">Save as template</span>
            <span className="sm:hidden">Template</span>
          </label>

          <button
            onClick={doSave}
            disabled={saveState === 'saving'}
            className="flex items-center gap-1.5 min-h-[40px] px-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded text-xs font-semibold text-white/85 disabled:opacity-40 touch-manipulation"
          >
            <Save size={13} />
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? (saveAsTemplate ? 'Saved + Template ✓' : 'Saved ✓') : 'Save'}
          </button>

          {design.slides.length > 1 ? (
            <button
              onClick={exportAllSlides}
              className="flex items-center gap-1.5 min-h-[40px] px-3.5 bg-[#9a442d] hover:bg-[#b85535] rounded text-xs font-bold text-white touch-manipulation"
            >
              <LayersIcon size={13} /> Export ZIP
            </button>
          ) : (
            <button
              onClick={exportPng}
              className="flex items-center gap-1.5 min-h-[40px] px-3.5 bg-[#9a442d] hover:bg-[#b85535] rounded text-xs font-bold text-white touch-manipulation"
            >
              <Download size={13} /> Download
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
          onApplyUserTemplate={applyUserTemplate}
          onDeleteUserTemplate={deleteUserTemplateById}
          hasEvent={!!event}
          userTemplates={userTemplates}
        />
      )}
    </div>
  )
}
