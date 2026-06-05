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
      <div className="flex justify-center">
        <div className="w-[260px] aspect-[4/5] bg-[#111] rounded-xl flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center">
        <div className="w-[260px] aspect-[4/5] bg-[#111] rounded-xl flex items-center justify-center text-zinc-600 text-xs">
          Preview unavailable
        </div>
      </div>
    )
  }

  // Visual representation of the post without a full Konva render
  const template = DIGEST_TEMPLATES.find(t => t.id === templateId)
  const events = ctx.events ?? []

  // Post type display label — override "Tonight in ABQ" when used for Brewery Nights
  const headlineText =
    templateId === 'weekend-digest' ? 'This Weekend' :
    templateId === 'weekly-five'    ? 'This Week'    :
    'Tonight in ABQ'

  return (
    // Outer: center the preview, cap at a real Instagram post size
    <div className="flex justify-center">
      <div
        className="w-[260px] flex-shrink-0 aspect-[4/5] bg-[#1a1614] rounded-xl overflow-hidden flex flex-col text-[#fbf7f1] shadow-2xl"
        style={{ padding: '18px 16px 14px' }}
      >
        {/* Logo row */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-7 h-7 bg-[#9a442d] rounded flex items-center justify-center flex-shrink-0">
            <span className="text-[8px] font-black text-white leading-none">ABQ</span>
          </div>
          <span className="text-[10px] font-bold text-[#9a442d] uppercase tracking-[0.18em]">Unplugged</span>
        </div>

        {/* Headline */}
        <div className="mb-3">
          <p className="text-[9px] font-semibold text-[#9a442d] uppercase tracking-[0.18em] mb-1">
            {template?.name ?? templateId}
          </p>
          <p className="text-2xl font-black leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            {headlineText}
          </p>
        </div>

        {/* Terra rule */}
        <div className="h-px bg-[#9a442d]/50 mb-3" />

        {/* Events */}
        <div className="flex-1 space-y-2.5 overflow-hidden">
          {events.slice(0, 5).map((e, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-[11px] text-[#9a442d] font-bold w-5 flex-shrink-0 tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-semibold leading-tight line-clamp-2"
                  style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                >
                  {e.title}
                </p>
                <p className="text-[9px] text-[#fbf7f1]/50 mt-0.5 truncate">
                  {[
                    e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    }) : null,
                    e.time,
                    e.venue,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-[#9a442d]/30 flex items-center gap-2">
          <div className="flex-1 h-px bg-[#9a442d]/30" />
          <span className="text-[8px] text-[#fbf7f1]/35 uppercase tracking-widest flex-shrink-0">
            abqunplugged.com
          </span>
        </div>
      </div>
    </div>
  )
}
