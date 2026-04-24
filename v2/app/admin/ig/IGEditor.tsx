'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { NormalizedEvent } from '@/lib/events'
import { QuickPostInput } from '@/app/admin/ig-captions/QuickPostInput'
import { Toolbar, type EditorMode } from './components/Toolbar'
import { DesignPanel } from './components/DesignPanel'
import { ElementsSidebar } from './components/ElementsSidebar'
import { SavedDesigns } from './components/SavedDesigns'
import { CaptionBuilder } from './components/CaptionBuilder'
import type { PostCanvasHandle } from './components/PostCanvas'
import { useEditor } from './store'
import { TEMPLATES } from './lib/templates'

// Konva needs to load client-side only (uses `window`)
const PostCanvas = dynamic(
  () => import('./components/PostCanvas').then(m => m.PostCanvas),
  { ssr: false, loading: () => <div className="flex-1 min-h-[420px] flex items-center justify-center bg-[#0a0a0a] rounded-xl text-white/40 text-sm">Loading canvas…</div> }
)

interface Props {
  event: NormalizedEvent | null
  image: string
  eventId: string | null
}

export function IGEditor({ event, image }: Props) {
  const { loadDesign, design } = useEditor()
  const [mode, setMode] = useState<EditorMode>(event ? 'event' : 'generic')
  const canvasRef = useRef<PostCanvasHandle | null>(null)

  // When an event is first loaded, auto-populate the Poster template with event data.
  // Only on mount / when event ID changes — never trample the user's in-progress work.
  const lastEventIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (event && lastEventIdRef.current !== event.id) {
      lastEventIdRef.current = event.id
      const poster = TEMPLATES.find(t => t.id === 'poster')
      if (poster) {
        loadDesign(poster.build({
          title: event.title,
          date: event.date,
          time: event.time ?? undefined,
          venue: event.venue ?? undefined,
          category: event.category ?? undefined,
          imageUrl: image || undefined,
          tagline: event.about ?? undefined,
          cta: 'abqunplugged.com',
        }))
        setMode('event')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, image])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Instagram Post Studio
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {mode === 'event'
            ? 'Canvas-based editor with full customization, layers, and carousel export.'
            : 'Design any promo post from scratch — templates, fonts, colors, and graphics.'}
        </p>
      </div>

      {/* Event loader */}
      <QuickPostInput />

      {/* Toolbar */}
      <Toolbar mode={mode} onModeChange={setMode} canvasRef={canvasRef} event={event} image={image} />

      {/* 3-column editor: elements | canvas | design */}
      <div className="flex flex-col lg:flex-row gap-4">
        <ElementsSidebar />
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <PostCanvas onExportRef={h => { canvasRef.current = h }} />
          <p className="text-[11px] text-white/30 text-center">
            Click an element to edit · drag to move · corner handles to resize/rotate · click empty space to deselect
          </p>
        </div>
        <DesignPanel />
      </div>

      {/* Saved designs gallery */}
      <SavedDesigns />

      {/* Captions (only when an event is loaded) */}
      {event && <CaptionBuilder event={event} />}

      {/* Footer hint */}
      <p className="text-[10px] text-white/25 text-center pt-4">
        {design.slides.length > 1 ? `Carousel: ${design.slides.length} slides · use the carousel export to download as ZIP` : 'Use Save to store this design · Download for a single PNG'}
      </p>
    </div>
  )
}
