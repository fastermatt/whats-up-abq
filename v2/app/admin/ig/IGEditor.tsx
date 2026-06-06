'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { NormalizedEvent } from '@/lib/events'
import { EventSearch } from './components/EventSearch'
import { Toolbar, type EditorMode } from './components/Toolbar'
import { DesignPanel } from './components/DesignPanel'
import { ElementsSidebar } from './components/ElementsSidebar'
import { SavedDesigns } from './components/SavedDesigns'
import { CaptionBuilder } from './components/CaptionBuilder'
import { IGSubNav } from './components/IGSubNav'
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
  /** When set, the editor was opened from /admin/ig/week to edit a specific
   *  row. Shows a sticky "Save & return to week" button that exports the
   *  current design state to sessionStorage and navigates back. */
  returnTo?: string | null
  rowKey?: string | null
}

export function IGEditor({ event, image, returnTo, rowKey }: Props) {
  const router = useRouter()
  const { applyTemplateDesign, design } = useEditor()
  const [mode, setMode] = useState<EditorMode>(event ? 'event' : 'generic')
  const canvasRef = useRef<PostCanvasHandle | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [savingReturn, setSavingReturn] = useState(false)

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
    cta: 'link in bio',
  })

  const doLoadEvent = (evt: NormalizedEvent, img: string) => {
    const poster = TEMPLATES.find(t => t.id === 'poster')
    if (poster) {
      // Track this as the active template baseline so "Reset to template"
      // works after the user starts tweaking the auto-loaded poster.
      applyTemplateDesign(poster.id, poster.build(buildEventCtx(evt, img)))
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

  const hasLayers = design.slides.some(s => s.layers.length > 0)
  const isReturnMode = returnTo === 'week' && Boolean(rowKey)

  function saveAndReturn() {
    if (!rowKey) return
    setSavingReturn(true)
    try {
      // Bridge the current design state to the week page via sessionStorage.
      // Larger than localStorage's reasonable budget for some designs (carousel
      // slides, big base64 images), and only needed for the one navigation hop.
      sessionStorage.setItem(`ig-week-design:${rowKey}`, JSON.stringify(design))
      router.push('/admin/ig/week')
    } catch (e) {
      console.error('[IGEditor] save & return failed:', e)
      alert('Could not save the design back to the week. Try again or use Save as design.')
      setSavingReturn(false)
    }
  }

  return (
    <div className="space-y-3">

      {/* Return-to-week sticky banner — only when launched from a week row */}
      {isReturnMode && (
        <div className="sticky top-0 z-30 bg-terra border-b border-terra-hover -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => router.push('/admin/ig/week')}
            className="flex items-center gap-1.5 text-xs text-white/85 hover:text-white font-semibold"
          >
            <ArrowLeft size={14} />
            Back to week (discard)
          </button>
          <span className="text-xs text-white/65 hidden sm:inline">
            Editing design for week row {event?.title ? `"${event.title.slice(0, 40)}"` : ''}
          </span>
          <div className="flex-1" />
          <button
            onClick={saveAndReturn}
            disabled={savingReturn || !hasLayers}
            className="px-4 py-1.5 rounded-lg bg-white text-terra text-xs font-bold hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingReturn ? 'Saving…' : 'Apply to week row →'}
          </button>
        </div>
      )}

      <IGSubNav active="editor" />

      {/* Event picker — collapses to a single line after event is selected */}
      <EventSearch event={event} />

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

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setShowSidebar(v => !v)}
        aria-label={showSidebar ? 'Hide elements sidebar' : 'Show elements sidebar'}
        aria-expanded={showSidebar}
        className={`lg:hidden flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border text-xs font-bold tracking-wide transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/50 ${
          showSidebar
            ? 'bg-white/[0.1] border-white/20 text-white'
            : 'bg-white/[0.04] border-white/[0.08] text-white/50'
        }`}
      >
        {showSidebar ? '↑ Hide Layers & Elements' : '↓ Layers & Elements'}
      </button>

      {/* 3-column editor: elements | canvas | design */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Elements sidebar — hidden by default on mobile */}
        <div className={showSidebar ? 'block' : 'hidden lg:block'}>
          <ElementsSidebar />
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="relative">
            <PostCanvas onExportRef={h => { canvasRef.current = h }} />

            {/* Empty state overlay — shown when canvas has no layers and no event is being built */}
            {!hasLayers && !event && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none rounded-xl">
                <div className="text-center space-y-2 px-8">
                  <p className="text-white/55 text-sm font-semibold">Start with an event or a template</p>
                  <p className="text-white/35 text-xs">Pick an event above to auto-fill the Poster, or open Templates to choose a layout</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-white/25 text-center hidden sm:block">
            Click to select · drag to move · corner handles to resize/rotate · Delete key removes selected · ⌘Z undo
          </p>
          <p className="text-[11px] text-white/25 text-center sm:hidden">
            Tap to select · drag to move · handles to resize
          </p>
        </div>

        <DesignPanel />
      </div>

      {/* Saved designs gallery */}
      <SavedDesigns />

      {/* Caption + publish (only when an event is loaded) */}
      {event && <CaptionBuilder event={event} canvasRef={canvasRef} />}

      {/* Footer */}
      {design.slides.length > 1 && (
        <p className="text-[10px] text-white/45 text-center pt-2">
          Carousel: {design.slides.length} slides · use Export ZIP to download all
        </p>
      )}
    </div>
  )
}
