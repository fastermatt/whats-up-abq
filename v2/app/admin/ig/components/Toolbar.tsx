'use client'

import { useState } from 'react'
import { Download, Save, FileText, Layers as LayersIcon } from 'lucide-react'
import { useEditor } from '../store'
import { TEMPLATES, EVENT_TEMPLATES, PROMO_TEMPLATES } from '../lib/templates'
import type { TemplateContext } from '../lib/templates'
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

export function Toolbar({ mode, onModeChange, canvasRef, event, image }: ToolbarProps) {
  const { design, loadDesign, renameDesign } = useEditor()
  const [showTemplates, setShowTemplates] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const eventCtx = (): TemplateContext => ({
    title: event?.title, date: event?.date ?? undefined, time: event?.time ?? undefined,
    venue: event?.venue ?? undefined, category: event?.category ?? undefined,
    imageUrl: image || undefined,
    tagline: event?.about ?? undefined,
    cta: 'abqunplugged.com',
  })

  const applyTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find(t => t.id === templateId)
    if (!tpl) return
    const ctx: TemplateContext = mode === 'event' && event ? eventCtx() : {}
    loadDesign(tpl.build(ctx))
    setShowTemplates(false)
  }

  const doSave = async () => {
    setSaveState('saving')
    try {
      const thumb = canvasRef.current ? await canvasRef.current.exportPng() : undefined
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

  const relevantTemplates = mode === 'event' ? EVENT_TEMPLATES : PROMO_TEMPLATES

  return (
    <div className="bg-[#0d0d0d] border border-white/[0.07] rounded-xl p-3 flex items-center gap-3 flex-wrap">
      {/* Mode toggle */}
      <div className="flex bg-black/30 rounded-lg p-0.5">
        <button
          onClick={() => onModeChange('event')}
          className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
            mode === 'event' ? 'bg-[#9a442d] text-white' : 'text-white/60 hover:text-white'
          }`}
        >Event Post</button>
        <button
          onClick={() => onModeChange('generic')}
          className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
            mode === 'generic' ? 'bg-[#9a442d] text-white' : 'text-white/60 hover:text-white'
          }`}
        >Generic Promo</button>
      </div>

      {/* Design name */}
      <input
        value={design.name}
        onChange={e => renameDesign(e.target.value)}
        placeholder="Design name"
        className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white/90 focus:outline-none focus:border-[#9a442d] w-36"
      />

      {/* Templates */}
      <div className="relative">
        <button onClick={() => setShowTemplates(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded text-xs font-semibold text-white/80">
          <FileText size={13} /> Templates
        </button>
        {showTemplates && (
          <div className="absolute top-full left-0 mt-1 w-80 bg-[#151515] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-2 max-h-96 overflow-y-auto">
              {relevantTemplates.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t.id)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-white/[0.06] text-white">
                  <p className="text-sm font-bold">{t.name}</p>
                  <p className="text-[11px] text-white/50 mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status + actions */}
      <span className="text-[11px] text-white/40">{design.slides.length} slide{design.slides.length > 1 ? 's' : ''} · {design.format}</span>
      <span className="flex-1" />

      <button onClick={doSave} disabled={saveState === 'saving'}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded text-xs font-semibold text-white/80 disabled:opacity-50">
        <Save size={13} /> {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save'}
      </button>

      <button onClick={exportPng}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded text-xs font-semibold text-white/80">
        <Download size={13} /> PNG
      </button>

      {design.slides.length > 1 && (
        <button onClick={exportAllSlides}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9a442d] hover:bg-[#b85535] rounded text-xs font-bold text-white">
          <LayersIcon size={13} /> Export carousel ZIP
        </button>
      )}
      {design.slides.length === 1 && (
        <button onClick={exportPng}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9a442d] hover:bg-[#b85535] rounded text-xs font-bold text-white">
          <Download size={13} /> Download
        </button>
      )}
    </div>
  )
}
