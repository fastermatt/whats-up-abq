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
import { IGSubNav } from '../components/IGSubNav'
import type { NormalizedEvent } from '@/lib/events'

// Konva stage must load client-side only
const PostCanvas = dynamic(
  () => import('../components/PostCanvas').then(m => m.PostCanvas),
  { ssr: false, loading: () => <div /> }
)

// ─── Types ────────────────────────────────────────────────────────────────

type RowStatus = 'idle' | 'previewing' | 'rendering' | 'uploading' | 'scheduled' | 'failed'

interface RowState {
  date:        string
  time:        string         // HH:MM in local Mountain time
  caption:     string
  captionEdited: boolean
  status:      RowStatus
  errorMsg:    string | null
  postId:      string | null  // schedule-row id, not IG post id
  /** 300px JPEG thumbnail of the rendered Poster — generated on demand. */
  previewUrl:  string | null
  /** Per-row template override (default 'poster' when unset) — populated
   *  from the quick-edit drawer. Persists in localStorage. */
  templateId?: string
  /** Per-row image override — paste a URL or upload a file in the quick-
   *  edit drawer. When set, overrides evt.imageUrl for rendering. */
  customImageUrl?: string
  /** Per-row full Design override — set when the user opens the full editor
   *  via "Edit fully", makes changes, and clicks "Apply to week row".
   *  Supersedes templateId + customImageUrl when present. */
  customDesign?: import('../types').Design
}

// ─── localStorage persistence for per-row overrides ─────────────────────
const OVERRIDES_KEY = 'ig-week-overrides-v1'
interface RowOverrides {
  templateId?: string
  customImageUrl?: string
  customDesign?: import('../types').Design
}
function loadOverrides(): Record<string, RowOverrides> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function saveOverrides(map: Record<string, RowOverrides>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map)) }
  catch { /* quota — ignore */ }
}
function persistRowOverride(key: string, patch: RowOverrides) {
  const map = loadOverrides()
  // Strip undefined / empty fields so the stored map stays small
  const merged = { ...map[key], ...patch }
  const cleaned: RowOverrides = {}
  if (merged.templateId)     cleaned.templateId = merged.templateId
  if (merged.customImageUrl) cleaned.customImageUrl = merged.customImageUrl
  if (merged.customDesign)   cleaned.customDesign = merged.customDesign
  if (Object.keys(cleaned).length === 0) delete map[key]
  else map[key] = cleaned
  saveOverrides(map)
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

/** The 7 event-category templates exposed in the quick-edit picker.
 *  Brand/story templates are hidden — they don't make sense for the
 *  poster-style scheduled-feed flow. */
const QUICK_EDIT_TEMPLATE_IDS = ['poster', 'broadside', 'marquee', 'split', 'dispatch', 'golden-hour', 'paper'] as const

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

/**
 * Scale a PNG data-URL down to a thumbnail at the given max dimension,
 * returning a JPEG. Used for inline row previews so users can SEE the
 * composed Poster before they schedule a week of posts.
 */
async function pngToThumbnail(pngDataUrl: string, maxDim = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No 2d context')); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = reject
    img.src = pngDataUrl
  })
}

/** Best-effort caption preview — first non-empty line + remaining-line count. */
function previewCaption(caption: string): { firstLine: string; extra: number } {
  const lines = caption.split('\n').map(s => s.trim()).filter(Boolean)
  const firstLine = lines[0] ?? ''
  const extra = Math.max(0, lines.length - 1)
  return { firstLine, extra }
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
  const [perDay, setPerDay]     = useState<1 | 2 | 3>(1)
  const [days, setDays]         = useState<WeekDay[]>([])
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState<string | null>(null)

  // Per-row state, keyed by `${date}::${eventId}` so different events on the
  // same day get distinct entries.
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const rowKey = (date: string, eventId: string) => `${date}::${eventId}`

  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null)
  // Confirmation gate: irreversible bulk action requires an explicit second click
  const [confirmingBatch, setConfirmingBatch] = useState(false)
  // Track which row is currently rendering on the shared hidden canvas so we
  // serialize render requests properly across both preview + schedule paths.
  const renderLockRef = useRef<Promise<void>>(Promise.resolve())

  // ── Fetch week data ───────────────────────────────────────────────────
  const fetchWeek = useCallback(async (s: string, pd: 1 | 2 | 3) => {
    setLoading(true)
    setErr(null)
    try {
      const res  = await fetch(`/api/admin/ig/week-events?start=${s}&per_day=${pd}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Load failed')
      setDays(data)

      // Initialize row state from the response, preserving any existing
      // edits / scheduled rows that match by key. Hydrate overrides from
      // localStorage so quick-edits survive reloads.
      const overrides = loadOverrides()

      // Also pick up any designs handed off from the full editor's
      // "Apply to week row" button (sessionStorage bridge). Apply them to
      // the matching rows, persist to localStorage, and clear the temp keys.
      const sessionDesignKeys = typeof window !== 'undefined'
        ? Object.keys(sessionStorage).filter(k => k.startsWith('ig-week-design:'))
        : []
      for (const sk of sessionDesignKeys) {
        try {
          const designJson = sessionStorage.getItem(sk)
          if (!designJson) continue
          const design = JSON.parse(designJson)
          const key = sk.replace('ig-week-design:', '')
          overrides[key] = { ...(overrides[key] ?? {}), customDesign: design }
          persistRowOverride(key, { customDesign: design })
          sessionStorage.removeItem(sk)
        } catch { /* ignore corrupt entries */ }
      }

      setRows(prev => {
        const next: Record<string, RowState> = {}
        for (const day of data as WeekDay[]) {
          for (const evt of day.events) {
            const key = rowKey(day.date, evt.id)
            if (prev[key]) {
              // Even for preserved rows, layer in any freshly arrived overrides
              const ov = overrides[key] ?? {}
              next[key] = ov.customDesign
                ? { ...prev[key], customDesign: ov.customDesign, previewUrl: null }
                : prev[key]
              continue
            }
            const cap = buildCaptions(toNormalized(evt))[0]?.text ?? ''
            const ov = overrides[key] ?? {}
            next[key] = {
              date:           day.date,
              time:           defaultTimeFor(day.date),
              caption:        cap,
              captionEdited:  false,
              status:         'idle',
              errorMsg:       null,
              postId:         null,
              previewUrl:     null,
              templateId:     ov.templateId,
              customImageUrl: ov.customImageUrl,
              customDesign:   ov.customDesign,
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

  useEffect(() => { fetchWeek(start, perDay) }, [start, perDay, fetchWeek])

  /**
   * Render a single event's design on the shared hidden canvas and return
   * the exported PNG. Honors per-row overrides (templateId, customImageUrl)
   * from the quick-edit drawer when present. Serializes via renderLockRef
   * so concurrent callers (preview + schedule) don't clobber each other.
   */
  const renderEventPoster = useCallback(async (
    evt: WeekEvent,
    overrides?: RowOverrides,
  ): Promise<string> => {
    // Wait for any in-flight render to finish, then take the lock.
    let release: () => void = () => {}
    const myTurn = new Promise<void>(r => { release = r })
    const prevTurn = renderLockRef.current
    renderLockRef.current = prevTurn.then(() => myTurn)
    await prevTurn

    try {
      // Full design override wins — set when the user clicked "Apply to
      // week row" in the full editor. Skip the template build entirely.
      if (overrides?.customDesign) {
        loadDesign(overrides.customDesign)
      } else {
        const templateId = overrides?.templateId ?? 'poster'
        const tmpl = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES.find(t => t.id === 'poster')
        if (!tmpl) throw new Error(`Template ${templateId} missing and no Poster fallback`)
        const ctx = buildPosterContext(evt)
        if (overrides?.customImageUrl) ctx.imageUrl = overrides.customImageUrl
        const design = tmpl.build(ctx)
        loadDesign(design)
      }

      // Wait two paint frames so the Konva stage rerenders the new design
      await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      // Plus a bit more for image loading, since the bg uses an <img>
      await new Promise(r => setTimeout(r, 600))

      if (!canvasRef.current) throw new Error('Canvas not ready')
      return await canvasRef.current.exportPng()
    } finally {
      release()
    }
  }, [loadDesign])

  /** Generate (or refresh) the per-row preview thumbnail. Reads current
   *  overrides off the row state at render time so quick-edits apply. */
  const renderPreview = useCallback(async (evt: WeekEvent) => {
    const key = rowKey(evt.date, evt.id)
    setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'previewing', errorMsg: null } }))
    try {
      // Snapshot the current row state so the renderer sees the right overrides
      const current = rows[key]
      const overrides: RowOverrides = {
        templateId:     current?.templateId,
        customImageUrl: current?.customImageUrl,
        customDesign:   current?.customDesign,
      }
      const png   = await renderEventPoster(evt, overrides)
      const thumb = await pngToThumbnail(png, 360)
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'idle', previewUrl: thumb } }))
    } catch (e) {
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'failed', errorMsg: e instanceof Error ? e.message : 'Preview failed' } }))
    }
  }, [renderEventPoster, rows])

  // ── Single-row scheduling ─────────────────────────────────────────────
  const scheduleRow = useCallback(async (evt: WeekEvent): Promise<boolean> => {
    const key = rowKey(evt.date, evt.id)
    const row = rows[key]
    if (!row || row.status === 'scheduled') return false

    setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'rendering', errorMsg: null } }))

    try {
      // Render Poster + capture preview for the row UI. Use any per-row
      // template/image overrides set in the quick-edit drawer, or the
      // full Design captured via "Apply to week row".
      const overrides: RowOverrides = {
        templateId:     row.templateId,
        customImageUrl: row.customImageUrl,
        customDesign:   row.customDesign,
      }
      const png   = await renderEventPoster(evt, overrides)
      const jpeg  = await pngToJpeg(png)
      const thumb = await pngToThumbnail(png, 360)
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'uploading', previewUrl: thumb } }))

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
  }, [rows, renderEventPoster])

  /** Render previews for every visible row that doesn't have one yet. */
  const renderAllPreviews = useCallback(async () => {
    const queued = days.flatMap(d => d.events.filter(evt => {
      const r = rows[rowKey(evt.date, evt.id)]
      return r && !r.previewUrl && r.status !== 'scheduled'
    }))
    for (const evt of queued) {
      // eslint-disable-next-line no-await-in-loop
      await renderPreview(evt)
    }
  }, [days, rows, renderPreview])

  // ── Schedule entire week (gated by confirm step) ──────────────────────
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
    setConfirmingBatch(false)
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

  /** Retry every row currently in the failed state. */
  const retryAllFailed = useCallback(async () => {
    if (batchRunning) return
    const queued = days.flatMap(d =>
      d.events.filter(evt => rows[rowKey(evt.date, evt.id)]?.status === 'failed')
    )
    if (queued.length === 0) return
    setBatchRunning(true)
    setBatchProgress({ done: 0, total: queued.length })
    let done = 0
    for (const evt of queued) {
      // eslint-disable-next-line no-await-in-loop
      await scheduleRow(evt)
      done += 1
      setBatchProgress({ done, total: queued.length })
    }
    setBatchRunning(false)
    setTimeout(() => setBatchProgress(null), 4000)
  }, [batchRunning, days, rows, scheduleRow])

  /**
   * Real cancel — hits DELETE /api/admin/ig/schedule?id=… so the post is
   * actually removed from the queue, not just hidden in the UI.
   */
  const cancelRow = useCallback(async (key: string) => {
    const row = rows[key]
    if (!row?.postId) return
    if (!window.confirm('Cancel this scheduled post? This removes it from the queue.')) return
    setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'rendering', errorMsg: null } }))
    try {
      const res = await fetch(`/api/admin/ig/schedule?id=${row.postId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'scheduled', errorMsg: data.error ?? `Cancel failed (HTTP ${res.status})` } }))
        return
      }
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'idle', postId: null, errorMsg: null } }))
    } catch (e) {
      setRows(prev => ({ ...prev, [key]: { ...prev[key], status: 'scheduled', errorMsg: e instanceof Error ? e.message : 'Cancel failed' } }))
    }
  }, [rows])

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
  const todayStr = todayIso()
  const remainingToSchedule = stats.total - stats.scheduled
  const allPreviewed = days.every(d => d.events.every(evt => Boolean(rows[rowKey(evt.date, evt.id)]?.previewUrl)))

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">

        <IGSubNav active="week" />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold">Schedule a Week of Posts</h1>
          <p className="text-sm text-white/55 mt-0.5">
            One top event per day, auto-generated Poster + caption. Generate previews to verify, then schedule the whole week.
          </p>
        </div>

        {/* Date range + per-day controls */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setStart(plusDays(start, -7))}
            aria-label="Previous 7 days"
            className="flex items-center gap-1 min-h-[40px] text-xs text-white/70 hover:text-white px-3 rounded hover:bg-white/[0.05] transition-colors"
          >
            <ChevronLeft size={14} /> Prev
          </button>

          <label className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Starting</span>
            <input
              type="date"
              value={start}
              min={todayStr}
              onChange={e => e.target.value && setStart(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 min-h-[40px] text-sm text-white/90 focus:outline-none focus:border-[#9a442d] [color-scheme:dark]"
            />
          </label>

          <button
            onClick={() => setStart(plusDays(start, 7))}
            aria-label="Next 7 days"
            className="flex items-center gap-1 min-h-[40px] text-xs text-white/70 hover:text-white px-3 rounded hover:bg-white/[0.05] transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mr-1">Per day</span>
            {([1, 2, 3] as const).map(n => (
              <button
                key={n}
                onClick={() => setPerDay(n)}
                className={`min-h-[40px] min-w-[40px] px-3 rounded-lg text-sm font-bold transition-colors ${
                  perDay === n
                    ? 'bg-[#9a442d] text-white'
                    : 'bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white'
                }`}
                aria-pressed={perDay === n}
                title={`${n} event${n === 1 ? '' : 's'} per day`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule-all action with confirm gate */}
        <div className="bg-[#9a442d]/10 border border-[#9a442d]/30 rounded-xl px-4 py-3 mb-6 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold text-[#e8a898]">
                {stats.scheduled === 0
                  ? `Ready to schedule ${remainingToSchedule} post${remainingToSchedule === 1 ? '' : 's'}`
                  : `${stats.scheduled} of ${stats.total} scheduled`}
                {stats.failed > 0 && (
                  <span className="text-red-300 ml-2">· {stats.failed} failed</span>
                )}
              </p>
              <p className="text-[11px] text-white/55 mt-0.5">
                {allPreviewed || remainingToSchedule === 0
                  ? 'Each post renders the Poster template with the event’s photo + the Standard caption.'
                  : 'Click "Generate previews" to see what each post will look like before scheduling.'}
              </p>
            </div>
            {batchRunning && batchProgress ? (
              <div className="flex items-center gap-2 text-xs text-white/80 min-h-[40px]">
                <Loader2 size={14} className="animate-spin" />
                {batchProgress.done} / {batchProgress.total}
              </div>
            ) : confirmingBatch ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmingBatch(false)}
                  className="min-h-[40px] px-3 text-xs font-semibold rounded-lg bg-white/[0.07] text-white/70 hover:bg-white/[0.12] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={scheduleAll}
                  className="flex items-center gap-2 min-h-[40px] px-4 bg-red-500 hover:bg-red-400 rounded-lg text-sm font-bold transition-colors"
                  autoFocus
                >
                  <Send size={14} />
                  Confirm — schedule {remainingToSchedule} post{remainingToSchedule === 1 ? '' : 's'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {!allPreviewed && remainingToSchedule > 0 && (
                  <button
                    onClick={renderAllPreviews}
                    className="flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-white/85 transition-colors"
                  >
                    <Sparkles size={12} /> Generate previews
                  </button>
                )}
                {stats.failed > 0 && (
                  <button
                    onClick={retryAllFailed}
                    className="flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-200 transition-colors"
                  >
                    <RefreshCw size={12} /> Retry failed
                  </button>
                )}
                <button
                  onClick={() => setConfirmingBatch(true)}
                  disabled={remainingToSchedule === 0}
                  className="flex items-center gap-2 min-h-[40px] px-4 bg-[#9a442d] hover:bg-[#b5502f] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-bold transition-colors"
                >
                  <Send size={14} />
                  Schedule entire week
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Errors */}
        {err && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300 mb-4 flex items-center gap-2">
            <AlertCircle size={14} /> {err}
            <button onClick={() => fetchWeek(start, perDay)} className="ml-auto text-xs underline">retry</button>
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
                <Calendar size={11} className="text-white/55" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                  {fmtDayHeader(day.date)}
                </p>
                {day.events.length === 0 && (
                  <span className="text-[10px] text-white/55 ml-2">No events</span>
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
                    onPreview={() => renderPreview(evt)}
                    onCancel={() => cancelRow(key)}
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
            onClick={() => fetchWeek(start, perDay)}
            className="flex items-center gap-1.5 min-h-[40px] px-3 text-xs text-white/65 hover:text-white transition-colors"
          >
            <RefreshCw size={12} /> Refresh week data
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
  evt, row, onUpdate, onSchedule, onPreview, onCancel, disabled,
}: {
  evt: WeekEvent
  row: RowState
  onUpdate:    (patch: Partial<RowState>) => void
  onSchedule:  () => void
  onPreview:   () => void
  onCancel:    () => void
  disabled:    boolean
}) {
  const [editingCaption, setEditingCaption] = useState(false)
  const isBusy = row.status === 'rendering' || row.status === 'uploading' || row.status === 'previewing'
  const scoreStr = evt.popularityScore == null ? '—' : evt.popularityScore.toFixed(1)
  const scoreTier = (evt.popularityScore ?? 0) >= 8.5 ? 'high'
                  : (evt.popularityScore ?? 0) >= 7.0 ? 'mid' : 'low'
  const scoreCol = scoreTier === 'high' ? 'text-orange-300 bg-orange-500/20 border-orange-500/30'
                : scoreTier === 'mid'  ? 'text-yellow-300 bg-yellow-500/15 border-yellow-500/25'
                : 'text-white/55 bg-white/[0.08] border-white/15'

  const captionPreview = previewCaption(row.caption)
  const isFailed = row.status === 'failed'
  const isScheduled = row.status === 'scheduled'
  const ctaLabel = isFailed
    ? 'Retry'
    : row.status === 'rendering'
      ? 'Rendering…'
      : row.status === 'uploading'
        ? 'Uploading…'
        : row.status === 'previewing'
          ? 'Previewing…'
          : 'Schedule'

  return (
    <div className={`bg-[#111] border rounded-xl p-3 mb-2 ${
      isScheduled ? 'border-green-500/30 bg-green-500/[0.04]'
        : isFailed ? 'border-red-500/40'
        : 'border-white/[0.07]'
    }`}>
      <div className="flex gap-3 items-start">
        {/* Thumbnail — preview if rendered, else source photo, else emoji */}
        <button
          onClick={onPreview}
          disabled={isBusy || disabled || isScheduled}
          aria-label={row.previewUrl ? 'Re-render Poster preview' : 'Generate Poster preview'}
          className="shrink-0 w-16 h-20 rounded-lg overflow-hidden bg-white/[0.05] flex items-center justify-center relative group disabled:cursor-not-allowed"
          title={row.previewUrl ? 'Click to refresh preview' : 'Click to render Poster preview'}
        >
          {row.previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.previewUrl} alt="Poster preview" className="w-full h-full object-cover" />
              {!isScheduled && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                  <RefreshCw size={14} className="text-white/0 group-hover:text-white/85 transition-colors" />
                </span>
              )}
            </>
          ) : evt.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={evt.imageUrl} alt="" className="w-full h-full object-cover opacity-70 grayscale" />
              <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-[9px] font-bold uppercase tracking-wider text-white/85 px-1 text-center leading-tight">
                {row.status === 'previewing' ? <Loader2 size={12} className="animate-spin" /> : 'Render'}
              </span>
            </>
          ) : (
            <span className="text-2xl">{CAT_EMOJI[evt.category ?? ''] ?? '📍'}</span>
          )}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-white font-semibold truncate flex-1 min-w-0">{evt.title}</p>
            <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 ${scoreCol}`} title={`Popularity score: ${scoreStr} of 10`}>
              {scoreStr}
            </div>
            {evt.featured && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#9a442d]/40 bg-[#9a442d]/10 text-[#e8a898] uppercase tracking-wider">
                ⭐ Featured
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-white/55">
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
        <div className="shrink-0 flex flex-col items-end gap-1">
          <input
            type="time"
            value={row.time}
            onChange={e => onUpdate({ time: e.target.value })}
            disabled={isBusy || disabled || isScheduled}
            aria-label="Scheduled time"
            className="bg-black/40 border border-white/10 rounded-lg px-2.5 min-h-[40px] text-sm text-white/90 focus:outline-none focus:border-[#9a442d] [color-scheme:dark] disabled:opacity-50 w-[112px]"
          />
          <span className="text-[10px] text-white/45 whitespace-nowrap">
            {fmtScheduledFor(row.date, row.time)}
          </span>
        </div>
      </div>

      {/* Caption preview / edit */}
      <div className="mt-3 flex gap-2 items-start">
        <button
          onClick={() => setEditingCaption(v => !v)}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-white/[0.05] text-white/55 hover:bg-white/[0.1] hover:text-white transition-colors"
          aria-expanded={editingCaption}
        >
          <Edit3 size={10} />
          {editingCaption ? 'Hide caption' : 'Edit caption'}
        </button>
        {!editingCaption && (
          <p className="text-[11px] text-white/55 line-clamp-1 flex-1 min-w-0">
            <span className="text-white/85">{captionPreview.firstLine}</span>
            {captionPreview.extra > 0 && (
              <span className="text-white/35"> · +{captionPreview.extra} more line{captionPreview.extra === 1 ? '' : 's'}</span>
            )}
          </p>
        )}
      </div>
      {editingCaption && (
        <textarea
          value={row.caption}
          onChange={e => onUpdate({ caption: e.target.value, captionEdited: true })}
          rows={6}
          disabled={isBusy || disabled || isScheduled}
          className="mt-2 w-full bg-black/30 border border-white/[0.1] rounded-lg px-3 py-2 text-white/85 text-[11px] leading-relaxed font-mono resize-y focus:outline-none focus:border-[#9a442d]/60 disabled:opacity-50"
        />
      )}

      {/* Quick design editor — template swap + image swap inline */}
      <DesignQuickEdit
        evt={evt}
        row={row}
        disabled={isBusy || disabled || isScheduled}
        onUpdate={onUpdate}
        onApply={onPreview}
      />

      {/* Action row */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Link
          href={`/admin/ig?id=${evt.id}&returnTo=week&rowKey=${encodeURIComponent(`${row.date}::${evt.id}`)}`}
          className="text-[11px] text-white/55 hover:text-white transition-colors flex items-center gap-1"
          title="Open the full editor for this row, then click 'Apply to week row' to return"
        >
          {row.customDesign ? 'Edit design (✱ custom)' : 'Edit in full editor'} →
        </Link>
        <div className="flex-1" />

        {/* Failed state */}
        {isFailed && (
          <span className="text-[11px] text-red-300 flex items-center gap-1 max-w-[280px] truncate" title={row.errorMsg ?? 'Failed'}>
            <AlertCircle size={11} /> {row.errorMsg ?? 'Failed'}
          </span>
        )}

        {/* Scheduled state — real cancel button */}
        {isScheduled && (
          <>
            <span className="text-[11px] font-semibold text-green-300 flex items-center gap-1">
              <Check size={11} /> Scheduled
            </span>
            <button
              onClick={onCancel}
              disabled={disabled}
              className="flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg border border-red-400/25 bg-red-500/[0.06] hover:bg-red-500/15 text-[11px] font-semibold text-red-200 transition-colors"
              title="Remove from queue"
            >
              <X size={11} /> Cancel
            </button>
          </>
        )}

        {/* Per-row schedule / retry button */}
        {!isScheduled && (
          <button
            onClick={onSchedule}
            disabled={isBusy || disabled}
            className={`min-h-[40px] px-4 rounded-lg text-xs font-bold text-white transition-colors flex items-center gap-1.5 ${
              isFailed
                ? 'bg-red-500 hover:bg-red-400 disabled:opacity-40'
                : 'bg-[#9a442d] hover:bg-[#b5502f] disabled:opacity-40'
            }`}
          >
            {isBusy ? <Loader2 size={12} className="animate-spin" /> : isFailed ? <RefreshCw size={12} /> : <Sparkles size={12} />}
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── DesignQuickEdit ─────────────────────────────────────────────────────
// Inline (collapsible) panel that lets the user swap template + image for
// a single week row, then click Apply to re-render the preview. Saves the
// overrides to localStorage so they survive reloads. Designed for batch
// "scroll the week, tweak each one, schedule all" workflows where popping
// into the full Konva editor for every event is too slow.

function DesignQuickEdit({
  evt, row, disabled, onUpdate, onApply,
}: {
  evt: WeekEvent
  row: RowState
  disabled: boolean
  onUpdate: (patch: Partial<RowState>) => void
  onApply: () => void
}) {
  const [open, setOpen] = useState(false)
  // Local draft so the user can edit without re-rendering on every keystroke
  const [draftTemplate, setDraftTemplate] = useState<string>(row.templateId ?? 'poster')
  const [draftImageUrl, setDraftImageUrl] = useState<string>(row.customImageUrl ?? '')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Re-sync drafts when the row's persisted overrides change (e.g. after reload)
  useEffect(() => {
    setDraftTemplate(row.templateId ?? 'poster')
    setDraftImageUrl(row.customImageUrl ?? '')
  }, [row.templateId, row.customImageUrl])

  const key = `${row.date}::${evt.id}`
  const hasOverride = Boolean(row.templateId || row.customImageUrl || row.customDesign)
  const currentTemplate = row.templateId ?? 'poster'
  const hasCustomDesign = Boolean(row.customDesign)

  function applyAndRender() {
    const cleanedUrl = draftImageUrl.trim() || undefined
    const cleanedTpl = draftTemplate === 'poster' ? undefined : draftTemplate
    // Quick-edit overrides supersede the full-design override — switching
    // template via the picker should not preserve a stale customDesign.
    onUpdate({ templateId: cleanedTpl, customImageUrl: cleanedUrl, customDesign: undefined, previewUrl: null })
    persistRowOverride(key, { templateId: cleanedTpl, customImageUrl: cleanedUrl, customDesign: undefined })
    // Trigger preview re-render with the new overrides
    setTimeout(() => onApply(), 50)
    setOpen(false)
  }

  function reset() {
    setDraftTemplate('poster')
    setDraftImageUrl('')
    onUpdate({ templateId: undefined, customImageUrl: undefined, customDesign: undefined, previewUrl: null })
    persistRowOverride(key, { templateId: undefined, customImageUrl: undefined, customDesign: undefined })
    setTimeout(() => onApply(), 50)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Read as data URL — fits straight into the <img> src that Konva templates use
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setDraftImageUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="mt-2 flex gap-2 items-start">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
          hasOverride
            ? 'bg-[#9a442d]/20 text-[#e8a898] hover:bg-[#9a442d]/30'
            : 'bg-white/[0.05] text-white/55 hover:bg-white/[0.1] hover:text-white'
        }`}
        aria-expanded={open}
        title={hasOverride ? `Override active: ${currentTemplate}${row.customImageUrl ? ' + custom image' : ''}` : 'Swap template or image for this row'}
      >
        <Sparkles size={10} />
        {open ? 'Hide design' : hasOverride ? 'Edit design ✱' : 'Edit design'}
      </button>
      {!open && hasOverride && (
        <p className="text-[10px] text-white/55 truncate">
          {hasCustomDesign ? (
            <>Using <span className="text-white/85">custom design</span> from full editor</>
          ) : (
            <>Using <span className="text-white/85">{currentTemplate}</span>
            {row.customImageUrl ? ' · custom image' : ''}</>
          )}
        </p>
      )}

      {open && (
        <div className="flex-1 min-w-0 bg-black/30 border border-white/[0.1] rounded-lg p-3 space-y-3">
          {/* Template grid — 7 event templates */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/45 mb-2 font-semibold">Template</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {QUICK_EDIT_TEMPLATE_IDS.map(tid => {
                const isActive = draftTemplate === tid
                return (
                  <button
                    key={tid}
                    onClick={() => setDraftTemplate(tid)}
                    disabled={disabled}
                    className={`min-h-[36px] px-2.5 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                      isActive
                        ? 'bg-[#9a442d] text-white'
                        : 'bg-white/[0.06] text-white/65 hover:bg-white/[0.12] hover:text-white'
                    }`}
                  >
                    {tid.replace(/-/g, ' ')}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Image swap — URL or file upload */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/45 mb-2 font-semibold">Image override</p>
            <div className="flex gap-2 items-center">
              <input
                type="url"
                value={draftImageUrl.startsWith('data:') ? '' : draftImageUrl}
                onChange={e => setDraftImageUrl(e.target.value)}
                placeholder={draftImageUrl.startsWith('data:') ? '(uploaded file)' : 'Paste image URL, or upload →'}
                disabled={disabled}
                className="flex-1 min-w-0 bg-black/40 border border-white/[0.1] rounded px-2 py-1.5 text-[11px] text-white/85 placeholder-white/30 focus:outline-none focus:border-[#9a442d]/60 disabled:opacity-50"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFile}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="shrink-0 px-2.5 py-1.5 rounded bg-white/[0.06] text-white/75 hover:bg-white/[0.12] hover:text-white text-[10px] font-semibold transition-colors disabled:opacity-50"
              >
                Upload
              </button>
              {draftImageUrl && (
                <button
                  onClick={() => setDraftImageUrl('')}
                  disabled={disabled}
                  className="shrink-0 px-2 py-1.5 rounded text-white/45 hover:text-white text-[10px] transition-colors"
                  aria-label="Clear image"
                  title="Clear image override"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/35 mt-1">
              Default: event&apos;s photo from the site. Override to use a different image for the post only.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={applyAndRender}
              disabled={disabled}
              className="min-h-[36px] px-4 rounded-lg text-[11px] font-bold text-white bg-[#9a442d] hover:bg-[#b5502f] disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Check size={11} /> Apply &amp; re-render
            </button>
            {hasOverride && (
              <button
                onClick={reset}
                disabled={disabled}
                className="min-h-[36px] px-3 rounded-lg text-[11px] font-semibold text-white/65 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] transition-colors"
                title="Clear all overrides"
              >
                Reset
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setOpen(false)}
              className="text-[11px] text-white/55 hover:text-white px-2 py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
