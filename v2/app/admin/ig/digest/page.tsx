'use client'

/**
 * /admin/ig/digest — Multi-event digest post builder
 *
 * Fetches the top N events for tonight / this weekend / this week and
 * renders them into a digest template (Weekend Digest, Tonight in ABQ,
 * Weekly Five). One click to download as JPEG or push to the IG queue.
 *
 * Canvas rendering works identically to the week planner:
 *   loadDesign() → Zustand store → PostCanvas rerenders → exportPng()
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Calendar, Clock, Download, Loader2, MapPin, RefreshCw,
  Send, Check, AlertCircle, Sparkles,
} from 'lucide-react'
import type { DigestEvent } from '@/app/api/admin/ig/digest-events/route'
import type { TemplateContext } from '../lib/templates'
import { DIGEST_TEMPLATES } from '../lib/templates'
import type { PostCanvasHandle } from '../components/PostCanvas'
import { useEditor } from '../store'
import { IGSubNav } from '../components/IGSubNav'

// Konva requires client-only render
const PostCanvas = dynamic(
  () => import('../components/PostCanvas').then(m => m.PostCanvas),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#111] rounded-xl animate-pulse" /> }
)

// ─── Types ────────────────────────────────────────────────────────────────

type Period = 'tonight' | 'this-weekend' | 'this-week'
type UploadStatus = 'idle' | 'rendering' | 'uploading' | 'scheduled' | 'failed'

const PERIOD_OPTIONS: { id: Period; label: string; sub: string; suggestedTemplate: string }[] = [
  {
    id:                'tonight',
    label:             'Tonight',
    sub:               "What's on today",
    suggestedTemplate: 'tonight-list',
  },
  {
    id:                'this-weekend',
    label:             'This Weekend',
    sub:               'Sat & Sun picks',
    suggestedTemplate: 'weekend-digest',
  },
  {
    id:                'this-week',
    label:             'This Week',
    sub:               '7-day top picks',
    suggestedTemplate: 'weekly-five',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

async function pngToJpeg(pngDataUrl: string, quality = 0.93): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No 2d context')); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = pngDataUrl
  })
}

function formatTime(time: string | null | undefined): string | null {
  if (!time) return null
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(time)) return time
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
  }
  return time
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'America/Denver',
  })
}

function defaultScheduleTime(period: Period): string {
  const d = new Date()
  if (period === 'tonight') {
    // Schedule for ~5 PM today
    d.setHours(17, 0, 0, 0)
  } else {
    // Schedule for next morning
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
  }
  // datetime-local format: YYYY-MM-DDTHH:MM
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-') + 'T' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join(':')
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DigestPage() {
  const { loadDesign } = useEditor()
  const canvasRef = useRef<PostCanvasHandle | null>(null)

  const [period,     setPeriod]     = useState<Period>('this-weekend')
  const [templateId, setTemplateId] = useState<string>('weekend-digest')
  const [events,     setEvents]     = useState<DigestEvent[]>([])
  const [loading,    setLoading]    = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [status,     setStatus]     = useState<UploadStatus>('idle')
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const [scheduledAt, setScheduledAt] = useState(() => defaultScheduleTime('this-weekend'))

  // Auto-suggest template when period changes
  useEffect(() => {
    const opt = PERIOD_OPTIONS.find(o => o.id === period)
    if (opt) setTemplateId(opt.suggestedTemplate)
    setScheduledAt(defaultScheduleTime(period))
  }, [period])

  const template = useMemo(
    () => DIGEST_TEMPLATES.find(t => t.id === templateId) ?? DIGEST_TEMPLATES[0],
    [templateId]
  )

  // Build TemplateContext from fetched events
  const ctx: TemplateContext = useMemo(() => ({
    events: events.map(e => ({
      title:    e.title,
      date:     e.date,
      time:     formatTime(e.time) ?? undefined,
      venue:    e.venue ?? undefined,
      category: e.category ?? undefined,
      imageUrl: e.imageUrl ?? undefined,
    })),
  }), [events])

  // Load the design into the Konva canvas whenever template or events change
  useEffect(() => {
    const design = template.build(ctx, '4:5')
    loadDesign(design)
  }, [template, ctx, loadDesign])

  // ── Fetch events ──────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch(`/api/admin/ig/digest-events?period=${period}&limit=5`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { events: DigestEvent[] }
      setEvents(data.events)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [period])

  // Auto-fetch when period changes
  useEffect(() => { fetchEvents() }, [fetchEvents])

  // ── Export helpers ────────────────────────────────────────────────────

  async function renderJpeg(): Promise<string> {
    if (!canvasRef.current) throw new Error('Canvas not ready')
    // Give Konva an extra frame to finish rendering after design load
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    await new Promise(r => setTimeout(r, 400))
    const png = await canvasRef.current.exportPng()
    return pngToJpeg(png)
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
    setStatus('rendering')
    setErrorMsg(null)
    try {
      const jpeg = await renderJpeg()

      setStatus('uploading')
      const caption = [
        period === 'tonight'
          ? '🌆 Tonight in ABQ — here\'s what\'s happening:'
          : period === 'this-weekend'
            ? '📅 This weekend in Albuquerque!'
            : '📅 5 picks for this week in ABQ:',
        '',
        ...events.slice(0, 5).map((e, i) => {
          const t = formatTime(e.time)
          return `${i + 1}. ${e.title}${t ? ' · ' + t : ''}${e.venue ? ' @ ' + e.venue : ''}`
        }),
        '',
        'Full lineup → abqunplugged.com',
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

      setStatus('scheduled')
      setTimeout(() => setStatus('idle'), 4000)
    } catch (e) {
      setStatus('failed')
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, period, scheduledAt])

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">

        <IGSubNav active="digest" className="mb-4" />

        <div className="mb-5">
          <h1
            className="text-xl font-black text-white mb-0.5"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Digest Builder
          </h1>
          <p className="text-sm text-white/40">
            Auto-populates top events into a multi-event post — great for saves
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

          {/* ── Left: controls ─────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Period picker */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                Period
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPeriod(opt.id)}
                    className={[
                      'p-3 rounded-xl border text-left transition-all',
                      period === opt.id
                        ? 'bg-[#9a442d]/15 border-[#9a442d]/50 text-[#e8a898]'
                        : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/25',
                    ].join(' ')}
                  >
                    <p className="text-xs font-bold leading-tight">{opt.label}</p>
                    <p className="text-[10px] opacity-60 mt-0.5 leading-tight">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Template picker */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                Template
              </p>
              <div className="space-y-1.5">
                {DIGEST_TEMPLATES.map(t => {
                  const isSuggested = PERIOD_OPTIONS.find(o => o.id === period)?.suggestedTemplate === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTemplateId(t.id)}
                      className={[
                        'w-full p-3 rounded-xl border text-left transition-all',
                        templateId === t.id
                          ? 'bg-[#9a442d]/15 border-[#9a442d]/50'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/25',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${templateId === t.id ? 'text-[#e8a898]' : 'text-white/80'}`}>
                          {t.name}
                        </span>
                        {isSuggested && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#9a442d]/30 text-[#e8a898] font-bold">
                            suggested
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/35 mt-0.5 leading-snug">
                        {t.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Event list */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold">
                  Events ({events.length}/5)
                </p>
                <button
                  onClick={fetchEvents}
                  disabled={loading}
                  className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/70 transition-colors"
                >
                  {loading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />
                  }
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
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 bg-white/[0.04] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : events.length === 0 && !fetchError ? (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-center text-white/30 text-xs">
                  No events found for this period
                </div>
              ) : (
                <div className="space-y-1.5">
                  {events.map((e, i) => (
                    <div
                      key={e.id}
                      className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.07] flex gap-2.5"
                    >
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#9a442d]/30 flex items-center justify-center text-[10px] font-bold text-[#e8a898] mt-0.5">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white/90 leading-tight truncate">
                          {e.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                          {e.time && (
                            <span className="flex items-center gap-1 text-[10px] text-[#9a442d]">
                              <Clock className="w-2.5 h-2.5" />
                              {formatTime(e.time)}
                            </span>
                          )}
                          {e.venue && (
                            <span className="flex items-center gap-1 text-[10px] text-white/30 truncate max-w-[150px]">
                              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                              {e.venue}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/20 mt-0.5">
                          {fmtDate(e.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Schedule time */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                Schedule For
              </p>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                <Calendar className="w-4 h-4 text-white/30 flex-shrink-0" />
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white/80 focus:outline-none"
                />
              </div>
            </section>

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={handleSchedule}
                disabled={
                  status === 'rendering' ||
                  status === 'uploading' ||
                  events.length === 0
                }
                className={[
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all',
                  status === 'scheduled'
                    ? 'bg-green-600 text-white'
                    : status === 'failed'
                      ? 'bg-red-700 text-white'
                      : 'bg-[#9a442d] text-white hover:bg-[#7d3725] disabled:opacity-40 disabled:cursor-not-allowed',
                ].join(' ')}
              >
                {status === 'rendering' && <><Loader2 className="w-4 h-4 animate-spin" /> Rendering…</>}
                {status === 'uploading' && <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling…</>}
                {status === 'scheduled' && <><Check className="w-4 h-4" /> Scheduled!</>}
                {status === 'failed'    && <><AlertCircle className="w-4 h-4" /> Failed — retry</>}
                {status === 'idle'      && <><Send className="w-4 h-4" /> Schedule Post</>}
              </button>

              {errorMsg && (
                <p className="text-xs text-red-400 text-center">{errorMsg}</p>
              )}

              <button
                onClick={handleDownload}
                disabled={events.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/15 text-sm text-white/55 hover:text-white hover:border-white/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold">
                Preview
              </p>
            </div>

            {/* Canvas container — PostCanvas auto-scales to fill this box */}
            <div
              className="relative rounded-2xl overflow-hidden bg-[#111] shadow-2xl"
              style={{ aspectRatio: '4/5', width: '100%', maxWidth: 480 }}
            >
              <PostCanvas onExportRef={h => { canvasRef.current = h }} />
            </div>

            <p className="text-[10px] text-white/20">
              Exports at 1080×1350px (Instagram 4:5 feed)
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
