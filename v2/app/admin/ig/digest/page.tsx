'use client'

/**
 * /admin/ig/digest — Multi-event digest post builder
 *
 * Fetches a pool of top events (category-diverse by default) for the
 * chosen period and lets you toggle which 5 appear in the post.
 *
 * Canvas rendering: loadDesign() → Zustand store → PostCanvas rerenders
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Calendar, Check, Clock, Download, Loader2, MapPin,
  RefreshCw, Send, AlertCircle, Sparkles, X,
} from 'lucide-react'
import type { DigestEvent, DigestResponse } from '@/app/api/admin/ig/digest-events/route'
import type { TemplateContext } from '../lib/templates'
import { DIGEST_TEMPLATES } from '../lib/templates'
import type { PostCanvasHandle } from '../components/PostCanvas'
import { useEditor } from '../store'
import { IGSubNav } from '../components/IGSubNav'

const PostCanvas = dynamic(
  () => import('../components/PostCanvas').then(m => m.PostCanvas),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#111] rounded-xl animate-pulse" /> }
)

// ─── Types ────────────────────────────────────────────────────────────────

type Period = 'tonight' | 'this-weekend' | 'this-week'
type ActionStatus = 'idle' | 'rendering' | 'uploading' | 'scheduled' | 'failed'

const PERIODS: { id: Period; label: string; sub: string; template: string }[] = [
  { id: 'tonight',      label: 'Tonight',      sub: "What's on today",  template: 'tonight-list'   },
  { id: 'this-weekend', label: 'This Weekend',  sub: 'Sat & Sun picks',  template: 'weekend-digest' },
  { id: 'this-week',    label: 'This Week',     sub: '7-day top picks',  template: 'weekly-five'    },
]

const CAT_COLORS: Record<string, string> = {
  'Music':         'bg-[#9a442d]/20 text-[#c97a5a]',
  'Comedy':        'bg-[#4f6249]/20 text-[#7a9a74]',
  'Arts & Theater':'bg-[#006a62]/20 text-[#4aa89e]',
  'Food & Drink':  'bg-[#7d6030]/20 text-[#b89050]',
  'Sports':        'bg-[#3a3a6a]/20 text-[#7070b0]',
  'Family':        'bg-[#6a4a20]/20 text-[#b08050]',
  'Festivals':     'bg-[#6a1a6a]/20 text-[#b060b0]',
  'Film':          'bg-[#1a4a6a]/20 text-[#5090b0]',
  'Outdoor':       'bg-[#2a5a2a]/20 text-[#60a060]',
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function pngToJpeg(pngDataUrl: string, quality = 0.93): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No 2d ctx')); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = pngDataUrl
  })
}

function formatTime(t: string | null | undefined): string | null {
  if (!t) return null
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(t)) return t
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(t)) {
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }
  return t
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Denver',
  })
}

function defaultScheduleAt(period: Period): string {
  const d = new Date()
  period === 'tonight' ? d.setHours(17, 0, 0, 0) : (d.setDate(d.getDate() + 1), d.setHours(10, 0, 0, 0))
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-') + 'T' + [
    String(d.getHours()).padStart(2, '0'),
    '00',
  ].join(':')
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DigestPage() {
  const { loadDesign } = useEditor()
  const canvasRef = useRef<PostCanvasHandle | null>(null)

  // ── State ──────────────────────────────────────────────────────────────
  const [period,       setPeriod]       = useState<Period>('this-weekend')
  const [templateId,   setTemplateId]   = useState('weekend-digest')
  const [pool,         setPool]         = useState<DigestEvent[]>([])
  const [selected,     setSelected]     = useState<string[]>([])   // ordered IDs, max 5
  const [loading,      setLoading]      = useState(false)
  const [fetchError,   setFetchError]   = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle')
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)
  const [scheduledAt,  setScheduledAt]  = useState(() => defaultScheduleAt('this-weekend'))

  // Auto-sync template suggestion when period changes
  useEffect(() => {
    const opt = PERIODS.find(p => p.id === period)
    if (opt) setTemplateId(opt.template)
    setScheduledAt(defaultScheduleAt(period))
  }, [period])

  const template = useMemo(
    () => DIGEST_TEMPLATES.find(t => t.id === templateId) ?? DIGEST_TEMPLATES[0],
    [templateId]
  )

  // Ordered selected events (preserves toggle order for slot assignment)
  const activeEvents = useMemo(
    () => selected.map(id => pool.find(e => e.id === id)).filter(Boolean) as DigestEvent[],
    [selected, pool]
  )

  // ── Canvas sync ────────────────────────────────────────────────────────
  const ctx: TemplateContext = useMemo(() => ({
    events: activeEvents.map(e => ({
      title:    e.title,
      date:     e.date,
      time:     formatTime(e.time) ?? undefined,
      venue:    e.venue ?? undefined,
      category: e.category ?? undefined,
      imageUrl: e.imageUrl ?? undefined,
    })),
  }), [activeEvents])

  useEffect(() => {
    loadDesign(template.build(ctx, '4:5'))
  }, [template, ctx, loadDesign])

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchPool = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch(`/api/admin/ig/digest-events?period=${period}&pool=12&picks=5`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as DigestResponse
      setPool(data.events)
      // Pre-select recommended (diverse) picks, capped at 5
      setSelected(data.recommended.slice(0, 5))
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchPool() }, [fetchPool])

  // ── Toggle logic: click to add/remove from selection (ordered, max 5) ─
  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 5) return prev  // at max — click X to remove first
      return [...prev, id]
    })
  }, [])

  const removeSlot = useCallback((id: string) => {
    setSelected(prev => prev.filter(x => x !== id))
  }, [])

  // ── Export / schedule ──────────────────────────────────────────────────
  async function renderJpeg(): Promise<string> {
    if (!canvasRef.current) throw new Error('Canvas not ready')
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    await new Promise(r => setTimeout(r, 400))
    return pngToJpeg(await canvasRef.current.exportPng())
  }

  const handleDownload = useCallback(async () => {
    try {
      const jpeg = await renderJpeg()
      const a = document.createElement('a')
      a.href = jpeg
      a.download = `abq-digest-${period}-${new Date().toISOString().slice(0, 10)}.jpg`
      a.click()
    } catch (e) {
      alert('Export failed: ' + (e instanceof Error ? e.message : String(e)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const handleSchedule = useCallback(async () => {
    setActionStatus('rendering')
    setErrorMsg(null)
    try {
      const jpeg = await renderJpeg()
      setActionStatus('uploading')

      const caption = [
        period === 'tonight'
          ? '🌆 Tonight in ABQ — what\'s happening:'
          : period === 'this-weekend'
            ? '📅 This weekend in Albuquerque:'
            : '📅 5 picks for this week in ABQ:',
        '',
        ...activeEvents.slice(0, 5).map((e, i) => {
          const t = formatTime(e.time)
          const name = e.title || e.venue || 'Event TBA'
          return `${i + 1}. ${name}${t ? ' · ' + t : ''}${e.venue ? ' @ ' + e.venue : ''}`
        }),
        '',
        'Full details → abqunplugged.com',
        '',
        '#Albuquerque #ABQ #ABQEvents #ThingsToDoABQ',
      ].join('\n')

      const res = await fetch('/api/admin/ig/schedule', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData:   jpeg,
          caption,
          scheduledAt: new Date(scheduledAt).toISOString(),
          label:       `Digest: ${period} (${new Date().toLocaleDateString()})`,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setActionStatus('scheduled')
      setTimeout(() => setActionStatus('idle'), 4000)
    } catch (e) {
      setActionStatus('failed')
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvents, period, scheduledAt])

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">

        <IGSubNav active="digest" className="mb-4" />

        <div className="mb-5">
          <h1 className="text-xl font-black text-white mb-0.5" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Digest Builder
          </h1>
          <p className="text-sm text-white/40">
            Auto-picks a category-varied mix — tap any event to swap it in or out
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">

          {/* ── Left: controls ─────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Period */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold mb-2">Period</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PERIODS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPeriod(opt.id)}
                    className={[
                      'p-2.5 rounded-xl border text-left transition-all',
                      period === opt.id
                        ? 'bg-[#9a442d]/15 border-[#9a442d]/50 text-[#e8a898]'
                        : 'bg-white/[0.03] border-white/10 text-white/55 hover:border-white/25',
                    ].join(' ')}
                  >
                    <p className="text-xs font-bold leading-tight">{opt.label}</p>
                    <p className="text-[10px] opacity-55 mt-0.5 leading-tight">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Template */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold mb-2">Template</p>
              <div className="grid grid-cols-3 gap-1.5">
                {DIGEST_TEMPLATES.map(t => {
                  const isSuggested = PERIODS.find(p => p.id === period)?.template === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTemplateId(t.id)}
                      className={[
                        'p-2.5 rounded-xl border text-left transition-all relative',
                        templateId === t.id
                          ? 'bg-[#9a442d]/15 border-[#9a442d]/50'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/25',
                      ].join(' ')}
                    >
                      {isSuggested && (
                        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#9a442d]" />
                      )}
                      <p className={`text-[11px] font-bold leading-tight ${templateId === t.id ? 'text-[#e8a898]' : 'text-white/75'}`}>
                        {t.name}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Selected slots */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold">
                  Selected <span className="text-[#9a442d]">{selected.length}</span>/5
                </p>
                {selected.length > 0 && (
                  <button
                    onClick={() => setSelected([])}
                    className="text-[10px] text-white/25 hover:text-white/55 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {selected.length === 0 ? (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-dashed border-white/10 text-center text-white/25 text-xs">
                  Tap events below to select up to 5
                </div>
              ) : (
                <div className="space-y-1">
                  {activeEvents.map((e, i) => (
                    <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#9a442d]/10 border border-[#9a442d]/25">
                      <span className="flex-shrink-0 text-[10px] font-bold text-[#9a442d] w-4 text-center">{i + 1}</span>
                      <p className="flex-1 text-xs text-white/85 font-medium truncate leading-tight">{e.title || e.venue || 'Event TBA'}</p>
                      <button
                        onClick={() => removeSlot(e.id)}
                        className="flex-shrink-0 text-white/25 hover:text-white/60 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {selected.length < 5 && (
                    <p className="text-[10px] text-white/20 text-center pt-0.5">
                      {5 - selected.length} slot{5 - selected.length !== 1 ? 's' : ''} open — pick from pool below
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Event pool */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold">
                  Event Pool
                </p>
                <button
                  onClick={fetchPool}
                  disabled={loading}
                  className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh
                </button>
              </div>

              {fetchError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-red-300 text-xs mb-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {fetchError}
                </div>
              )}

              {loading ? (
                <div className="space-y-1.5">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-12 bg-white/[0.04] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : pool.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-center text-white/25 text-xs">
                  No events found for this period
                </div>
              ) : (
                <div className="space-y-1">
                  {pool.map(e => {
                    const isSelected = selected.includes(e.id)
                    const slotNum    = selected.indexOf(e.id) + 1
                    const catClass   = CAT_COLORS[e.category ?? ''] ?? 'bg-white/10 text-white/40'
                    const atMax      = selected.length >= 5 && !isSelected

                    return (
                      <button
                        key={e.id}
                        onClick={() => !atMax && toggle(e.id)}
                        disabled={atMax}
                        className={[
                          'w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all',
                          isSelected
                            ? 'bg-[#9a442d]/12 border-[#9a442d]/35'
                            : atMax
                              ? 'bg-white/[0.02] border-white/[0.06] opacity-40 cursor-not-allowed'
                              : 'bg-white/[0.04] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/20 cursor-pointer',
                        ].join(' ')}
                      >
                        {/* Checkbox */}
                        <div className={[
                          'flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center mt-0.5',
                          isSelected
                            ? 'bg-[#9a442d] border-[#9a442d]'
                            : 'border-white/20 bg-transparent',
                        ].join(' ')}>
                          {isSelected
                            ? <span className="text-[10px] font-black text-white leading-none">{slotNum}</span>
                            : null
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1.5 flex-wrap">
                            <p className={`text-xs font-semibold leading-tight ${isSelected ? 'text-white' : 'text-white/80'}`}>
                              {e.title || e.venue || 'Event TBA'}
                            </p>
                            {e.category && (
                              <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${catClass}`}>
                                {e.category}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                            {e.time && (
                              <span className="flex items-center gap-1 text-[10px] text-white/35">
                                <Clock className="w-2.5 h-2.5" />
                                {formatTime(e.time)}
                              </span>
                            )}
                            {e.venue && (
                              <span className="flex items-center gap-1 text-[10px] text-white/30 truncate max-w-[160px]">
                                <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                {e.venue}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="flex-shrink-0 w-3.5 h-3.5 text-[#9a442d] mt-1" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Schedule time */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold mb-2">Schedule For</p>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                <Calendar className="w-4 h-4 text-white/25 flex-shrink-0" />
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white/75 focus:outline-none"
                />
              </div>
            </section>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={handleSchedule}
                disabled={
                  actionStatus === 'rendering' ||
                  actionStatus === 'uploading' ||
                  selected.length === 0
                }
                className={[
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all',
                  actionStatus === 'scheduled' ? 'bg-green-700 text-white'
                  : actionStatus === 'failed'  ? 'bg-red-700 text-white'
                  : 'bg-[#9a442d] text-white hover:bg-[#7d3725] disabled:opacity-40 disabled:cursor-not-allowed',
                ].join(' ')}
              >
                {actionStatus === 'rendering' && <><Loader2 className="w-4 h-4 animate-spin" /> Rendering…</>}
                {actionStatus === 'uploading' && <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling…</>}
                {actionStatus === 'scheduled' && <><Check className="w-4 h-4" /> Scheduled!</>}
                {actionStatus === 'failed'    && <><AlertCircle className="w-4 h-4" /> Failed — retry</>}
                {actionStatus === 'idle'      && <><Send className="w-4 h-4" /> Schedule Post</>}
              </button>

              {errorMsg && <p className="text-xs text-red-400 text-center">{errorMsg}</p>}

              <button
                onClick={handleDownload}
                disabled={selected.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/12 text-sm text-white/50 hover:text-white hover:border-white/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Download JPEG
              </button>
            </div>

          </div>

          {/* ── Right: canvas preview ──────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#9a442d]" />
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold">Live Preview</p>
              <span className="text-[10px] text-white/20 ml-1">updates as you pick</span>
            </div>

            <div
              className="relative rounded-2xl overflow-hidden bg-[#111] shadow-2xl"
              style={{ aspectRatio: '4/5', width: '100%', maxWidth: 460 }}
            >
              <PostCanvas onExportRef={h => { canvasRef.current = h }} />
            </div>

            <p className="text-[10px] text-white/20">
              Exports at 1080×1350px — Instagram 4:5 feed format
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
