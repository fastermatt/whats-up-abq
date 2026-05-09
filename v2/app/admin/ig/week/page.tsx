'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  Calendar, Clock, Loader2, Send, Check, X, Edit3, Sparkles, MapPin,
  RefreshCw, AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import type { WeekDay, WeekEvent } from '@/app/api/admin/ig/week-events/route'
import { useEditor } from '../store'
import { TEMPLATES } from '../lib/templates'
import type { TemplateContext } from '../lib/templates'
import type { PostCanvasHandle } from '../components/PostCanvas'
import { buildCaptions } from '../components/CaptionBuilder'
import type { NormalizedEvent } from '@/lib/events'

// Konva stage must load client-side only
const PostCanvas = dynamic(
  () => import('../components/PostCanvas').then(m => m.PostCanvas),
  { ssr: false, loading: () => <div /> }
)

// ─── Types ────────────────────────────────────────────────────────────────

type RowStatus = 'idle' | 'rendering' | 'uploading' | 'scheduled' | 'failed'

interface RowState {
  date:        string
  time:        string         // HH:MM in local Mountain time
  caption:     string
  captionEdited: boolean
  status:      RowStatus
  errorMsg:    string | null
  postId:      string | null  // schedule-row id, not IG post id
}

// Smart default time slots, rotating across the week so we don't always post
// at the same time. Tuned for ABQ Instagram audience: late morning + early
// evening tend to perform better. Sat/Sun lean late morning.
const DEFAULT_TIME_BY_DOW: Record<number, string> = {
  0: '11:00',  // Sun
  1: '10:00',  // Mon
  2: '11:00',  // Tue
  3: '12:00',  // Wed
  4: '17:00',  // Thu — pre-weekend hype
  5: '11:00',  // Fri
  6: '10:00',  // Sat
}

function dowFromIso(iso: string): number {
  return new Date(iso + 'T12:00:00').getDay()
}

function defaultTimeFor(date: string): string {
  return DEFAULT_TIME_BY_DOW[dowFromIso(date)] ?? '12:00'
}

function fmtDayHeader(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: 'America/Denver',
  })
}

function fmtScheduledFor(date: string, time: string): string {
  try {
    const d = new Date(`${date}T${time}:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver',
    })
  } catch { return '' }
}

function pad2(n: number): string { return String(n).padStart(2, '0') }

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function plusDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const CAT_EMOJI: Record<string, string> = {
  'Music': '🎵', 'Comedy': '😂', 'Sports': '🏟️', 'Arts & Theater': '🎭',
  'Food & Drink': '🍻', 'Family': '🎡', 'Film': '🎬', 'Outdoor': '🌄',
  'Festivals': '🎪', 'Community': '🌵',
}

// PNG → JPEG (Instagram needs JPEG, not PNG)
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

// Convert WeekEvent → NormalizedEvent shape just enough for buildCaptions()
function toNormalized(evt: WeekEvent): NormalizedEvent {
  return {
    id:        evt.id,
    title:     evt.title,
    date:      evt.date,
    time:      evt.time,
    venue:     evt.venue,
    category:  evt.category,
    imageUrl:  evt.imageUrl,
    about:     evt.about,
    price:     evt.price,
    // The remaining fields aren't used by buildCaptions — fill with sensible defaults
    address:           null,
    sourceUrl:         null,
    source:            null,
    cached_photo_url:  evt.imageUrl,
    isFree:            evt.price?.toLowerCase().includes('free') ?? false,
    description:       null,
    tags:              [],
    raw:               null,
  } as unknown as NormalizedEvent
}

function buildPosterContext(evt: WeekEvent): TemplateContext {
  return {
    title:    evt.title,
    date:     evt.date,
    time:     evt.time ?? undefined,
    venue:    evt.venue ?? undefined,
    category: evt.category ?? undefined,
    imageUrl: evt.imageUrl ?? undefined,
    tagline:  evt.about ?? undefined,
    cta:      'link in bio',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function WeekSchedulerPage() {
  const { loadDesign } = useEditor()
  const canvasRef = useRef<PostCanvasHandle | null>(null)

  const [start, setStart]       = useState<string>(plusDays(todayIso(), 1))
  const [days, setDays]         = useState<WeekDay[]>([])
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState<string | null>(null)

  // Per-row state, keyed by `${date}::${eventId}` so different events on the
  // same day get distinct entries.
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const rowKey = (date: string, eventId: string) => `${date}::${eventId}`

  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null)

  // ── Fetch week data ───────────────────────────────────────────────────
  const fetchWeek = useCallback(async (s: string) => {
    setLoading(true)
    setErr(null)
    try {
      const res  = await fetch(`/api/admin/ig/week-events?start=${s}&per_day=1`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Load failed')
      setDays(data)

      // Initialize row state from the response, preserving any existing
      // edits / scheduled rows that match by key.
      setRows(prev => {
        const next: Record<string, RowState> = {}
        for (const day of data as WeekDay[]) {
          for (const evt of day.events) {
            const key = rowKey(day.date, evt.id)
            if (prev[key]) { next[key] = prev[key]; continue }
            const cap = buildCaptions(toNormalized(evt))[0]?.text ?? ''
            next[key] = {
              date:           day.date,
              time:           defaultTimeFor(day.date),
              caption:        cap,
              captionEdited:  false,
              status:         'idle',
              errorMsg:       null,
              postId:         null,
            }
          }
        }
        return next
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWeek(start) }, [start, fetchWeek])

  // ── Single-row scheduling ─────────────────────────────────────────────
  const scheduleRow = useCallback(async (evt: WeekEvent): Promise<boolean> => {
    const key = rowKey(evt.date, evt.id)
    const row = rows[key]
    if (!row || row.status === 'scheduled') return false

    setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'rendering', errorMsg: null } }))

    // 1. Build the Poster design from this event's context
    const poster = TEMPLATES.find(t => t.id === 'poster')
    if (!poster) {
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'failed', errorMsg: 'Poster template missing' } }))
      return false
    }
    const design = poster.build(buildPosterContext(evt))
    loadDesign(design)

    // 2. Wait one paint frame so the Konva stage rerenders the new design
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    // Plus a bit more for image loading, since the bg uses an Img element
    await new Promise(r => setTimeout(r, 600))

    if (!canvasRef.current) {
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'failed', errorMsg: 'Canvas not ready' } }))
      return false
    }

    // 3. Export PNG → JPEG and submit
    try {
      const png  = await canvasRef.current.exportPng()
      const jpeg = await pngToJpeg(png)
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'uploading' } }))

      const scheduledFor = new Date(`${row.date}T${row.time}:00`).toISOString()
      const res  = await fetch('/api/admin/ig/schedule', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          imageDataUrl: jpeg,
          caption:      row.caption,
          mediaType:    'FEED',
          scheduledFor,
          eventId:      evt.id,
        }),
        signal: AbortSignal.timeout(90_000),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'failed', errorMsg: data.error ?? `HTTP ${res.status}` } }))
        return false
      }
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'scheduled', postId: data.id } }))
      return true
    } catch (e) {
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'failed', errorMsg: e instanceof Error ? e.message : 'Unknown error' } }))
      return false
    }
  }, [rows, loadDesign])

  // ── Schedule entire week ──────────────────────────────────────────────
  const scheduleAll = useCallback(async () => {
    if (batchRunning) return
    const queued = days.flatMap(d =>
      d.events
        .map(evt => ({ d, evt }))
        .filter(({ evt }) => {
          const r = rows[rowKey(evt.date, evt.id)]
          return r && r.status !== 'scheduled'
        })
    )
    if (queued.length === 0) return

    setBatchRunning(true)
    setBatchProgress({ done: 0, total: queued.length })
    let done = 0
    for (const { evt } of queued) {
      // Sequential — both to keep Konva renders in-order and to avoid
      // hitting Supabase Storage with parallel uploads.
      // eslint-disable-next-line no-await-in-loop
      await scheduleRow(evt)
      done += 1
      setBatchProgress({ done, total: queued.length })
    }
    setBatchRunning(false)
    setTimeout(() => setBatchProgress(null), 4000)
  }, [batchRunning, days, rows, scheduleRow])

  const updateRow = (key: string, patch: Partial<RowState>) =>
    setRows(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  // ── Stats for header ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = Object.values(rows)
    return {
      total:     all.length,
      scheduled: all.filter(r => r.status === 'scheduled').length,
      failed:    all.filter(r => r.status === 'failed').length,
    }
  }, [rows])

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/ig" className="text-[11px] text-white/40 hover:text-white/70 uppercase tracking-widest mb-1 block">
            ← Back to Editor
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold">Schedule a Week of Posts</h1>
              <p className="text-sm text-white/40 mt-0.5">
                One top event per day, auto-generated Poster + caption. Edit any row, then schedule the whole week.
              </p>
            </div>
            <Link
              href="/admin/ig/queue"
              className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded border border-white/10 hover:border-white/30 transition-colors flex items-center gap-1.5"
            >
              <Calendar size={12} /> View Queue
            </Link>
          </div>
        </div>

        {/* Date range stepper */}
        <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 mb-4">
          <button
            onClick={() => setStart(plusDays(start, -7))}
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/[0.05] transition-colors"
          >
            <ChevronLeft size={13} /> Prev 7 days
          </button>
          <p className="text-sm font-semibold">
            {fmtDayHeader(start)} → {fmtDayHeader(plusDays(start, 6))}
          </p>
          <button
            onClick={() => setStart(plusDays(start, 7))}
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/[0.05] transition-colors"
          >
            Next 7 days <ChevronRight size={13} />
          </button>
        </div>

        {/* Schedule-all action */}
        <div className="flex items-center justify-between bg-[#9a442d]/10 border border-[#9a442d]/30 rounded-xl px-4 py-3 mb-6">
          <div>
            <p className="text-sm font-bold text-[#e8a898]">
              {stats.scheduled === 0
                ? `Ready to schedule ${stats.total - stats.scheduled} post${stats.total - stats.scheduled === 1 ? '' : 's'}`
                : `${stats.scheduled} of ${stats.total} scheduled`}
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              Each post renders the Poster template with the event&apos;s photo + the Standard caption.
            </p>
          </div>
          {batchRunning && batchProgress ? (
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Loader2 size={14} className="animate-spin" />
              {batchProgress.done} / {batchProgress.total}
            </div>
          ) : (
            <button
              onClick={scheduleAll}
              disabled={stats.total === stats.scheduled}
              className="flex items-center gap-2 px-4 py-2 bg-[#9a442d] hover:bg-[#b5502f] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-bold transition-colors"
            >
              <Send size={14} />
              Schedule entire week
            </button>
          )}
        </div>

        {/* Errors */}
        {err && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300 mb-4 flex items-center gap-2">
            <AlertCircle size={14} /> {err}
            <button onClick={() => fetchWeek(start)} className="ml-auto text-xs underline">retry</button>
          </div>
        )}

        {loading && days.length === 0 && (
          <div className="flex items-center justify-center py-16 text-white/40">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading week…
          </div>
        )}

        {/* Day rows */}
        <div className="space-y-3">
          {days.map(day => (
            <div key={day.date}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Calendar size={11} className="text-white/30" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                  {fmtDayHeader(day.date)}
                </p>
                {day.events.length === 0 && (
                  <span className="text-[10px] text-white/30 ml-2">No events</span>
                )}
              </div>
              {day.events.map(evt => {
                const key = rowKey(day.date, evt.id)
                const row = rows[key]
                if (!row) return null
                return (
                  <DayRow
                    key={key}
                    evt={evt}
                    row={row}
                    onUpdate={patch => updateRow(key, patch)}
                    onSchedule={() => scheduleRow(evt)}
                    onReset={() => updateRow(key, { status: 'idle', errorMsg: null, postId: null })}
                    disabled={batchRunning}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Refresh */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => fetchWeek(start)}
            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw size={11} /> Refresh week data
          </button>
        </div>

        {/* Hidden Konva canvas — used to render each row's Poster before
            export. Off-screen so users don't see designs flickering. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left:     '-100000px',
            top:      0,
            width:    1080,
            height:   1350,
            opacity:  0.001,
            pointerEvents: 'none',
          }}
        >
          <PostCanvas onExportRef={h => { canvasRef.current = h }} />
        </div>

      </div>
    </div>
  )
}

// ─── DayRow ──────────────────────────────────────────────────────────────

function DayRow({
  evt, row, onUpdate, onSchedule, onReset, disabled,
}: {
  evt: WeekEvent
  row: RowState
  onUpdate:    (patch: Partial<RowState>) => void
  onSchedule:  () => void
  onReset:     () => void
  disabled:    boolean
}) {
  const [editingCaption, setEditingCaption] = useState(false)
  const isBusy = row.status === 'rendering' || row.status === 'uploading'
  const scoreStr = evt.popularityScore == null ? '—' : evt.popularityScore.toFixed(1)
  const scoreTier = (evt.popularityScore ?? 0) >= 8.5 ? 'high'
                  : (evt.popularityScore ?? 0) >= 7.0 ? 'mid' : 'low'
  const scoreCol = scoreTier === 'high' ? 'text-orange-300 bg-orange-500/20 border-orange-500/30'
                : scoreTier === 'mid'  ? 'text-yellow-300 bg-yellow-500/15 border-yellow-500/25'
                : 'text-white/40 bg-white/[0.06] border-white/10'

  return (
    <div className={`bg-[#111] border rounded-xl p-3 mb-2 ${
      row.status === 'scheduled' ? 'border-green-500/30 bg-green-500/[0.04]'
        : row.status === 'failed' ? 'border-red-500/30'
        : 'border-white/[0.07]'
    }`}>
      <div className="flex gap-3 items-start">
        {/* Thumbnail */}
        <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-white/[0.05] flex items-center justify-center">
          {evt.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={evt.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">{CAT_EMOJI[evt.category ?? ''] ?? '📍'}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-white font-semibold truncate flex-1 min-w-0">{evt.title}</p>
            <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${scoreCol}`}>
              {scoreStr}
            </div>
            {evt.featured && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#9a442d]/40 bg-[#9a442d]/10 text-[#e8a898] uppercase tracking-wider">
                ⭐ Featured
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-white/40">
            {evt.category && <span>{evt.category}</span>}
            {evt.time && <span className="flex items-center gap-1"><Clock size={9} />{evt.time}</span>}
            {evt.venue && (
              <span className="flex items-center gap-1 truncate max-w-[200px]">
                <MapPin size={9} />{evt.venue}
              </span>
            )}
          </div>
        </div>

        {/* Schedule time + status */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <input
            type="time"
            value={row.time}
            onChange={e => onUpdate({ time: e.target.value })}
            disabled={isBusy || disabled || row.status === 'scheduled'}
            className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white/90 focus:outline-none focus:border-[#9a442d] [color-scheme:dark] disabled:opacity-50 w-[100px]"
          />
          <span className="text-[10px] text-white/30 whitespace-nowrap">
            {fmtScheduledFor(row.date, row.time)}
          </span>
        </div>
      </div>

      {/* Caption preview / edit */}
      <div className="mt-3 flex gap-2 items-start">
        <button
          onClick={() => setEditingCaption(v => !v)}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white transition-colors"
        >
          <Edit3 size={10} />
          {editingCaption ? 'Hide' : 'Caption'}
        </button>
        {!editingCaption && (
          <p className="text-[11px] text-white/40 line-clamp-2 flex-1 min-w-0">
            {row.caption.split('\n').slice(0, 3).join(' · ')}
          </p>
        )}
      </div>
      {editingCaption && (
        <textarea
          value={row.caption}
          onChange={e => onUpdate({ caption: e.target.value, captionEdited: true })}
          rows={6}
          disabled={isBusy || disabled || row.status === 'scheduled'}
          className="mt-2 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-white/85 text-[11px] leading-relaxed font-mono resize-y focus:outline-none focus:border-[#9a442d]/60 disabled:opacity-50"
        />
      )}

      {/* Action row */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Link
          href={`/admin/ig?id=${evt.id}`}
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
        >
          Open in editor →
        </Link>
        <div className="flex-1" />

        {/* Status indicator */}
        {row.status === 'scheduled' && (
          <span className="text-[11px] font-semibold text-green-400 flex items-center gap-1">
            <Check size={11} /> Scheduled
            <button onClick={onReset} className="ml-1 text-white/30 hover:text-white/60" title="Mark as unscheduled (UI only)">
              <X size={10} />
            </button>
          </span>
        )}
        {row.status === 'failed' && (
          <span className="text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle size={11} /> {row.errorMsg ?? 'Failed'}
          </span>
        )}

        {/* Per-row schedule button */}
        {row.status !== 'scheduled' && (
          <button
            onClick={onSchedule}
            disabled={isBusy || disabled}
            className="px-3 py-1.5 bg-[#9a442d] hover:bg-[#b5502f] disabled:opacity-40 rounded text-[11px] font-bold text-white transition-colors flex items-center gap-1.5"
          >
            {isBusy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {row.status === 'rendering'  ? 'Rendering…'
              : row.status === 'uploading' ? 'Uploading…'
              : 'Schedule'}
          </button>
        )}
      </div>
    </div>
  )
}
