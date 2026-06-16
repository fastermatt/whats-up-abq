'use client'

/**
 * /admin/ig/digest — Multi-event digest post builder
 *
 * Pick a date, date range, or quick preset → auto-selects template and
 * schedule time → fetches events for that window → toggle which 5 appear.
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
import { verifyRenderedPng } from '../lib/verifyRender'

const PostCanvas = dynamic(
  () => import('../components/PostCanvas').then(m => m.PostCanvas),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#111] rounded-xl animate-pulse" /> }
)

// ─── Types ────────────────────────────────────────────────────────────────

type Preset = 'today' | 'this-weekend' | 'this-week' | 'next-weekend' | 'next-week'
type ActionStatus = 'idle' | 'rendering' | 'uploading' | 'scheduled' | 'failed'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today',        label: 'Today'         },
  { id: 'this-weekend', label: 'This Weekend'  },
  { id: 'this-week',    label: 'This Week'     },
  { id: 'next-weekend', label: 'Next Weekend'  },
  { id: 'next-week',    label: 'Next Week'     },
]

const CAT_COLORS: Record<string, string> = {
  'Music':         'bg-terra/20 text-[#c97a5a]',
  'Comedy':        'bg-sage/20 text-[#7a9a74]',
  'Arts & Theater':'bg-turq/20 text-[#4aa89e]',
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

/** YYYY-MM-DD today in MDT */
function todayMDT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' })
}

/** Add N days to a YYYY-MM-DD string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

function getPresetDates(preset: Preset): { start: string; end: string } {
  const today = todayMDT()
  const dow   = new Date(today + 'T12:00:00').getDay() // 0=Sun…6=Sat

  if (preset === 'today') return { start: today, end: today }

  if (preset === 'this-weekend') {
    const daysToSat = dow === 6 ? 0 : (6 - dow + 7) % 7 || 7
    const sat = addDays(today, daysToSat)
    return { start: sat, end: addDays(sat, 1) }
  }

  if (preset === 'this-week') {
    return { start: today, end: addDays(today, 6) }
  }

  if (preset === 'next-weekend') {
    const daysToSat = ((6 - dow + 7) % 7 || 7) + 7
    const sat = addDays(today, daysToSat)
    return { start: sat, end: addDays(sat, 1) }
  }

  if (preset === 'next-week') {
    const daysToMon = (8 - dow) % 7 || 7
    const mon = addDays(today, daysToMon)
    return { start: mon, end: addDays(mon, 6) }
  }

  return { start: today, end: today }
}

/** Choose template automatically from date span */
function templateForSpan(start: string, end: string): string {
  if (start === end) return 'tonight-list'
  const days = Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000
  ) + 1
  return days <= 2 ? 'weekend-digest' : 'weekly-five'
}

/** Auto-suggest schedule time: single day → 5 PM that day; multi → day before at 6 PM */
function autoSchedule(start: string, end: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt  = (d: Date)  => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
  const d = new Date(start + 'T12:00:00')
  if (start === end) {
    d.setHours(17, 0, 0, 0)
    return fmt(d)
  }
  d.setDate(d.getDate() - 1)
  d.setHours(18, 0, 0, 0)
  return fmt(d)
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DigestPage() {
  const { loadDesign } = useEditor()
  const canvasRef = useRef<PostCanvasHandle | null>(null)

  // ── Date range state ───────────────────────────────────────────────────
  const initPreset: Preset = 'this-weekend'
  const { start: initStart, end: initEnd } = getPresetDates(initPreset)

  const [preset,      setPreset]      = useState<Preset | null>(initPreset)
  const [startDate,   setStartDate]   = useState(initStart)
  const [endDate,     setEndDate]     = useState(initEnd)
  const [templateId,  setTemplateId]  = useState(() => templateForSpan(initStart, initEnd))
  const [scheduledAt, setScheduledAt] = useState(() => autoSchedule(initStart, initEnd))

  // ── Event pool state ───────────────────────────────────────────────────
  const [pool,         setPool]         = useState<DigestEvent[]>([])
  const [selected,     setSelected]     = useState<string[]>([])
  const [poolSort,     setPoolSort]     = useState<'score' | 'date'>('score')
  const [loading,      setLoading]      = useState(false)
  const [fetchError,   setFetchError]   = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle')
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)

  // ── Preset application ─────────────────────────────────────────────────
  function applyPreset(p: Preset) {
    const { start, end } = getPresetDates(p)
    setPreset(p)
    setStartDate(start)
    setEndDate(end)
    setTemplateId(templateForSpan(start, end))
    setScheduledAt(autoSchedule(start, end))
  }

  function handleStartChange(val: string) {
    if (!val) return
    const safeEnd = endDate >= val ? endDate : val
    setPreset(null)
    setStartDate(val)
    setEndDate(safeEnd)
    setTemplateId(templateForSpan(val, safeEnd))
    setScheduledAt(autoSchedule(val, safeEnd))
  }

  function handleEndChange(val: string) {
    if (!val) return
    const safeEnd = val >= startDate ? val : startDate
    setPreset(null)
    setEndDate(safeEnd)
    setTemplateId(templateForSpan(startDate, safeEnd))
    setScheduledAt(autoSchedule(startDate, safeEnd))
  }

  // ── Derived ────────────────────────────────────────────────────────────
  const template = useMemo(
    () => DIGEST_TEMPLATES.find(t => t.id === templateId) ?? DIGEST_TEMPLATES[0],
    [templateId]
  )

  const sortedPool = useMemo(() => {
    if (poolSort === 'date') {
      return [...pool].sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date)
        if (dateCmp !== 0) return dateCmp
        return (a.time ?? '').localeCompare(b.time ?? '')
      })
    }
    return pool // already sorted by score from API
  }, [pool, poolSort])

  const activeEvents = useMemo(() => {
    const items = selected
      .map(id => pool.find(e => e.id === id))
      .filter(Boolean) as DigestEvent[]
    return items.sort((a, b) => a.date.localeCompare(b.date))
  }, [selected, pool])

  // ── Canvas sync ────────────────────────────────────────────────────────
  const ctx: TemplateContext = useMemo(() => ({
    postDate: startDate,
    events: activeEvents.map(e => ({
      title:    e.title,
      date:     e.date,
      time:     formatTime(e.time) ?? undefined,
      venue:    e.venue ?? undefined,
      category: e.category ?? undefined,
      imageUrl: e.imageUrl ?? undefined,
    })),
  }), [activeEvents, startDate])

  useEffect(() => {
    loadDesign(template.build(ctx, '4:5'))
  }, [template, ctx, loadDesign])

  // ── Fetch pool ─────────────────────────────────────────────────────────
  const fetchPool = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    setSelected([])
    try {
      const res  = await fetch(`/api/admin/ig/digest-events?start=${startDate}&end=${endDate}&pool=12&picks=5`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as DigestResponse
      setPool(data.events)
      setSelected(data.recommended.slice(0, 5))
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { fetchPool() }, [fetchPool])

  // ── Toggle logic ───────────────────────────────────────────────────────
  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }, [])

  const removeSlot = useCallback((id: string) => {
    setSelected(prev => prev.filter(x => x !== id))
  }, [])

  // ── Export / schedule ──────────────────────────────────────────────────
  async function renderJpeg(): Promise<string> {
    if (!canvasRef.current) throw new Error('Canvas not ready')
    await canvasRef.current.waitForReady()
    const png = await canvasRef.current.exportPng()
    const verification = await verifyRenderedPng(png)
    if (!verification.ok) {
      throw new Error(verification.reasons.join(' '))
    }
    return pngToJpeg(png)
  }

  const handleDownload = useCallback(async () => {
    try {
      const jpeg = await renderJpeg()
      const a = document.createElement('a')
      a.href = jpeg
      a.download = `abq-digest-${startDate}-to-${endDate}.jpg`
      a.click()
    } catch (e) {
      alert('Export failed: ' + (e instanceof Error ? e.message : String(e)))
    }
  }, [startDate, endDate])

  const handleSchedule = useCallback(async () => {
    setActionStatus('rendering')
    setErrorMsg(null)
    try {
      const jpeg = await renderJpeg()
      setActionStatus('uploading')

      const spanDays = Math.round(
        (new Date(endDate + 'T12:00:00').getTime() - new Date(startDate + 'T12:00:00').getTime()) / 86400000
      ) + 1
      const intro = spanDays === 1
        ? `🌆 Tonight in ABQ — what's on:`
        : spanDays <= 2
          ? `📅 This weekend in Albuquerque:`
          : `📅 This week in ABQ — top picks:`

      const caption = [
        intro,
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
          imageDataUrl: jpeg,
          caption,
          scheduledFor: new Date(scheduledAt).toISOString(),
          mediaType:    'FEED',
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
  }, [activeEvents, startDate, endDate, scheduledAt])

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
            Pick a date or range — auto-selects template and schedule time
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">

          {/* ── Left: controls ─────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Date range picker */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold mb-2">Date Range</p>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={[
                      'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                      preset === p.id
                        ? 'bg-terra/15 border-terra/50 text-terra-light'
                        : 'bg-white/[0.04] border-white/10 text-white/45 hover:border-white/25 hover:text-white/70',
                    ].join(' ')}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom date inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">From</p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => handleStartChange(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white/70 focus-visible:outline-none focus:border-terra/50 transition-colors"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">To</p>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={e => handleEndChange(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white/70 focus-visible:outline-none focus:border-terra/50 transition-colors"
                  />
                </div>
              </div>
            </section>

            {/* Template — auto-selected, can override */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold">Template</p>
                <span className="text-[10px] text-white/20">auto-selected from date span</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DIGEST_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={[
                      'p-2.5 rounded-xl border text-left transition-all',
                      templateId === t.id
                        ? 'bg-terra/15 border-terra/50'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/25',
                    ].join(' ')}
                  >
                    <p className={`text-[11px] font-bold leading-tight ${templateId === t.id ? 'text-terra-light' : 'text-white/65'}`}>
                      {t.name}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* Selected slots */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold">
                  Selected <span className="text-terra">{selected.length}</span>/5
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
                    <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg bg-terra/10 border border-terra/25">
                      <span className="flex-shrink-0 text-[10px] font-bold text-terra w-4 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/85 font-medium truncate leading-tight">{e.title || e.venue || 'Event TBA'}</p>
                        <p className="text-[10px] text-white/35 leading-tight mt-0.5">{fmtDate(e.date)}</p>
                      </div>
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
                <div className="flex items-center gap-2">
                  {/* Sort toggle */}
                  <div className="flex items-center rounded-lg border border-white/10 overflow-hidden text-[10px] font-semibold">
                    <button
                      onClick={() => setPoolSort('score')}
                      className={[
                        'px-2 py-1 transition-colors',
                        poolSort === 'score' ? 'bg-white/10 text-white/75' : 'text-white/25 hover:text-white/50',
                      ].join(' ')}
                    >
                      Score
                    </button>
                    <button
                      onClick={() => setPoolSort('date')}
                      className={[
                        'px-2 py-1 transition-colors',
                        poolSort === 'date' ? 'bg-white/10 text-white/75' : 'text-white/25 hover:text-white/50',
                      ].join(' ')}
                    >
                      Date
                    </button>
                  </div>
                  <button
                    onClick={fetchPool}
                    disabled={loading}
                    className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Refresh
                  </button>
                </div>
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
                  No events found for this date range
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedPool.map(e => {
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
                            ? 'bg-terra/12 border-terra/35'
                            : atMax
                              ? 'bg-white/[0.02] border-white/[0.06] opacity-40 cursor-not-allowed'
                              : 'bg-white/[0.04] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/20 cursor-pointer',
                        ].join(' ')}
                      >
                        {/* Checkbox / slot number */}
                        <div className={[
                          'flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center mt-0.5',
                          isSelected
                            ? 'bg-terra border-terra'
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
                            <span className="flex items-center gap-1 text-[10px] text-white/50 font-medium">
                              <Calendar className="w-2.5 h-2.5" />
                              {fmtDate(e.date)}
                            </span>
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
                          <Check className="flex-shrink-0 w-3.5 h-3.5 text-terra mt-1" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Schedule */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-semibold mb-2">Schedule For</p>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
                <Calendar className="w-4 h-4 text-white/25 flex-shrink-0" />
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white/75 focus-visible:outline-none"
                />
              </div>
              <p className="text-[10px] text-white/20 mt-1 pl-1">Auto-set from date range — adjust as needed</p>
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
                  : 'bg-terra text-white hover:bg-terra-hover disabled:opacity-40 disabled:cursor-not-allowed',
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
              <Sparkles className="w-3.5 h-3.5 text-terra" />
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
