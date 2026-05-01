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
import type { TemplateContext } from './lib/templates'

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
  const [showSidebar, setShowSidebar] = useState(false)

  // Tracks the last event ID we auto-loaded, so we don't clobber in-progress work
  const lastEventIdRef = useRef<string | null>(null)
  // Pending load: set when a new event arrives but the user has canvas work in progress
  const [pendingLoad, setPendingLoad] = useState<{ event: NormalizedEvent; image: string } | null>(null)

  const buildEventCtx = (evt: NormalizedEvent, img: string): TemplateContext => ({
    title: evt.title,
    date: evt.date ?? undefined,
    time: evt.time ?? undefined,
    venue: evt.venue ?? undefined,
    category: evt.category ?? undefined,
    imageUrl: img || undefined,
    tagline: evt.about ?? undefined,
    cta: 'abqunplugged.com',
  })

  const doLoadEvent = (evt: NormalizedEvent, img: string) => {
    const poster = TEMPLATES.find(t => t.id === 'poster')
    if (poster) {
      loadDesign(poster.build(buildEventCtx(evt, img)))
      setMode('event')
    }
  }

  // When an event is first loaded, auto-populate the Poster template.
  // If the canvas has in-progress work, ask before overwriting.
  useEffect(() => {
    if (!event) return
    if (lastEventIdRef.current === event.id) return

    const hasWork = design.slides.some(s => s.layers.length > 0)
    const isFirstLoad = lastEventIdRef.current === null

    if (hasWork && !isFirstLoad) {
      // Canvas has content from a previous session — confirm before replacing
      setPendingLoad({ event, image })
    } else {
      lastEventIdRef.current = event.id
      doLoadEvent(event, image)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, image])

  const confirmPendingLoad = () => {
    if (!pendingLoad) return
    lastEventIdRef.current = pendingLoad.event.id
    doLoadEvent(pendingLoad.event, pendingLoad.image)
    setPendingLoad(null)
  }

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
            : 'Design any promo post from scratch — brand templates, fonts, colors, and graphics.'}
        </p>
      </div>

      {/* Event loader */}
      <QuickPostInput />

      {/* Pending load confirmation */}
      {pendingLoad && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-amber-200 flex-1 min-w-0">
            Load <span className="font-semibold">&ldquo;{pendingLoad.event.title}&rdquo;</span> into the Poster template?
            {' '}This replaces your current canvas work.
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={confirmPendingLoad}
              className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded font-bold transition-colors"
            >
              Replace
            </button>
            <button
              onClick={() => { lastEventIdRef.current = pendingLoad.event.id; setPendingLoad(null) }}
              className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded transition-colors"
            >
              Keep current
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <Toolbar mode={mode} onModeChange={setMode} canvasRef={canvasRef} event={event} image={image} />

      {/* Mobile sidebar toggle — desktop always shows sidebar in its column */}
      <button
        onClick={() => setShowSidebar(v => !v)}
        className={`lg:hidden flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border text-xs font-bold tracking-wide transition-colors touch-manipulation ${
          showSidebar
            ? 'bg-white/[0.1] border-white/20 text-white'
            : 'bg-white/[0.04] border-white/[0.08] text-white/50'
        }`}
      >
        {showSidebar ? '↑ Hide Layers & Elements' : '↓ Layers & Elements'}
      </button>

      {/* 3-column editor: elements | canvas | design */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar — hidden by default on mobile, always visible on desktop */}
        <div className={showSidebar ? 'block' : 'hidden lg:block'}>
          <ElementsSidebar />
        </div>

        {/* Canvas — first in DOM on desktop, rendered first on mobile */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <PostCanvas onExportRef={h => { canvasRef.current = h }} />
          <p className="text-[11px] text-white/30 text-center hidden sm:block">
            Click to select · drag to move · corner handles to resize/rotate · Delete key removes selected · ⌘Z undo
          </p>
          <p className="text-[11px] text-white/30 text-center sm:hidden">
            Tap to select · drag to move · handles to resize
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
        {design.slides.length > 1
          ? `Carousel: ${design.slides.length} slides · use Export ZIP to download all slides`
          : 'Use Save to store this design · Download for a single PNG'}
      </p>
    </div>
  )
}
