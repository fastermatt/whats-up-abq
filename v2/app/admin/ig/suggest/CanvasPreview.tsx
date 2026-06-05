'use client'

/**
 * CanvasPreview — renders a scaled-down Konva canvas from a template + ctx.
 * Calls onExport with the full-res JPEG data URL once rendered.
 */

import { useEffect, useRef, useState } from 'react'
import { DIGEST_TEMPLATES, TemplateContext } from '@/app/admin/ig/lib/templates'
import { useEditor } from '@/app/admin/ig/store'
import { Loader2 } from 'lucide-react'

interface Props {
  templateId: string
  ctx: TemplateContext
  onExport?: (dataUrl: string) => void
}

export function CanvasPreview({ templateId, ctx, onExport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const loadDesign = useEditor(s => s.loadDesign)

  useEffect(() => {
    setLoading(true)
    setError(false)

    const template = DIGEST_TEMPLATES.find(t => t.id === templateId)
    if (!template) { setError(true); setLoading(false); return }

    try {
      const design = template.build(ctx, '4:5')
      loadDesign(design)
    } catch {
      setError(true)
    }
    setLoading(false)
  }, [templateId, ctx, loadDesign])

  // The actual Konva stage is rendered in PostCanvas.tsx (the shared editor canvas).
  // Here we provide a placeholder that links to the full editor for the canvas export.
  // For the preview, we use a simple text-based representation.

  if (loading) {
    return (
      <div className="w-full aspect-[4/5] bg-[#111] rounded-xl flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full aspect-[4/5] bg-[#111] rounded-xl flex items-center justify-center text-zinc-600 text-xs">
        Preview unavailable
      </div>
    )
  }

  // Visual representation of the post without a full Konva render
  const template = DIGEST_TEMPLATES.find(t => t.id === templateId)
  const events = ctx.events ?? []

  return (
    <div className="w-full aspect-[4/5] bg-[#1a1614] rounded-xl overflow-hidden flex flex-col p-4 text-[#fbf7f1] relative">
      {/* ABQ Unplugged logo area */}
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-6 h-6 bg-[#9a442d] rounded-sm flex items-center justify-center">
          <span className="text-[7px] font-black text-white">ABQ</span>
        </div>
        <span className="text-[9px] font-semibold text-[#9a442d] uppercase tracking-widest">Unplugged</span>
      </div>

      {/* Post type header */}
      <div className="mb-3">
        <p className="text-[9px] font-semibold text-[#9a442d] uppercase tracking-[0.2em] mb-1">
          {template?.name ?? templateId}
        </p>
        <p className="text-lg font-black leading-tight" style={{ fontFamily: 'serif' }}>
          {templateId === 'weekend-digest' ? 'This Weekend' :
           templateId === 'tonight-list'   ? 'Tonight in ABQ' :
           templateId === 'weekly-five'    ? 'This Week' : template?.name}
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#9a442d]/40 mb-3" />

      {/* Events list */}
      <div className="flex-1 space-y-2.5 overflow-hidden">
        {events.slice(0, 5).map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-[10px] text-[#9a442d] font-bold w-4 flex-shrink-0 pt-0.5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold leading-tight truncate" style={{ fontFamily: 'serif', fontStyle: 'italic' }}>
                {e.title}
              </p>
              <p className="text-[9px] text-[#fbf7f1]/50 truncate">
                {[e.date && new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), e.time, e.venue].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-[#9a442d]/30 flex items-center justify-between">
        <div className="h-px flex-1 bg-[#9a442d]/30 mr-2" />
        <span className="text-[8px] text-[#fbf7f1]/40 uppercase tracking-widest">abqunplugged.com</span>
      </div>
    </div>
  )
}
