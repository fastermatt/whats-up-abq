'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, XCircle, SkipForward, ChevronRight,
  RefreshCw, Zap, MessageSquare, Calendar, Clock,
  TrendingUp, Loader2, AlertCircle, Beer, Tv2, Sun, Star,
} from 'lucide-react'
import { TemplateContext } from '@/app/admin/ig/lib/templates'
import { CanvasPreview } from './CanvasPreview'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EventSnap {
  id: string
  title: string
  date: string
  time: string | null
  venue: string | null
  category: string | null
  imageUrl: string | null
  popularityScore: number
}

export interface Suggestion {
  id: string
  post_type: 'WeeklyFive' | 'BreweryNights' | 'WeekendDigest' | 'SingleEvent' | 'Tonight'
  template_id: string
  event_ids: string[]
  event_data: EventSnap[]
  caption: string | null
  scheduled_for: string
  status: 'pending' | 'accepted' | 'rejected' | 'skipped' | 'posted' | 'failed'
  rejection_reason: string | null
  caption_edited: boolean
  strategy_notes: string | null
}

interface Stats {
  pending?: number
  accepted?: number
  rejected?: number
  skipped?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const POST_TYPE_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  WeeklyFive:    { label: 'Weekly Five',     Icon: Calendar,   color: '#6366f1' },
  BreweryNights: { label: 'Brewery Nights',  Icon: Beer,       color: '#f59e0b' },
  WeekendDigest: { label: 'Weekend Digest',  Icon: Sun,        color: '#10b981' },
  SingleEvent:   { label: 'Single Event',    Icon: Star,       color: '#ec4899' },
  Tonight:       { label: 'Tonight in ABQ',  Icon: Tv2,        color: '#8b5cf6' },
}

function fmtScheduled(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver',
  }) + ' MDT'
}

function statusBadge(status: Suggestion['status']) {
  switch (status) {
    case 'accepted': return <span className="text-[10px] font-semibold text-emerald-400">✓ Accepted</span>
    case 'rejected': return <span className="text-[10px] font-semibold text-red-400">✗ Rejected</span>
    case 'skipped':  return <span className="text-[10px] font-semibold text-zinc-500">— Skipped</span>
    case 'posted':   return <span className="text-[10px] font-semibold text-blue-400">↑ Posted</span>
    default:         return null
  }
}

// ── Suggestion Card ───────────────────────────────────────────────────────────

function SuggestionCard({
  s,
  selected,
  onSelect,
  onAction,
}: {
  s: Suggestion
  selected: boolean
  onSelect: () => void
  onAction: (id: string, action: 'accept' | 'reject' | 'skip', reason?: string, caption?: string) => Promise<void>
}) {
  const [rejecting, setRejecting]   = useState(false)
  const [reason, setReason]         = useState('')
  const [acting, setActing]         = useState(false)
  const meta = POST_TYPE_META[s.post_type] ?? POST_TYPE_META.Tonight
  const { Icon, color, label } = meta

  const isPending  = s.status === 'pending'
  const isAccepted = s.status === 'accepted'
  const isRejected = s.status === 'rejected'

  const ringColor = isAccepted ? 'ring-1 ring-emerald-500/40 bg-emerald-950/20'
    : isRejected ? 'ring-1 ring-red-500/30 bg-red-950/20'
    : selected ? 'ring-1 ring-terra/60 bg-[#1a0e0a]'
    : 'ring-1 ring-white/5 bg-[#161616] hover:bg-[#1c1c1c]'

  async function handle(action: 'accept' | 'reject' | 'skip') {
    setActing(true)
    await onAction(s.id, action, action === 'reject' ? reason : undefined)
    setActing(false)
    if (action === 'reject') setRejecting(false)
  }

  return (
    <div
      className={`rounded-xl transition-all duration-150 cursor-pointer ${ringColor}`}
      onClick={onSelect}
    >
      <div className="p-3 flex gap-3">
        {/* Type icon */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: color + '22' }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
            {statusBadge(s.status)}
            <ChevronRight className={`w-3 h-3 text-zinc-600 ml-auto transition-transform ${selected ? 'rotate-90' : ''}`} />
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            {fmtScheduled(s.scheduled_for)}
          </p>

          {/* Event list */}
          <div className="mt-1.5 space-y-0.5">
            {s.event_data.slice(0, 2).map(e => (
              <p key={e.id} className="text-xs text-zinc-300 leading-tight truncate">
                {e.title}
              </p>
            ))}
            {s.event_data.length > 2 && (
              <p className="text-[10px] text-zinc-500">+{s.event_data.length - 2} more events</p>
            )}
          </div>

          {/* Caption snippet */}
          {s.caption && (
            <p className="mt-1.5 text-[10px] text-zinc-500 leading-relaxed line-clamp-1 italic">
              "{s.caption.slice(0, 70)}…"
            </p>
          )}

          {/* Rejection reason */}
          {isRejected && s.rejection_reason && (
            <div className="mt-1.5 flex items-start gap-1 text-[10px] text-red-400/70">
              <MessageSquare className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
              <span>{s.rejection_reason}</span>
            </div>
          )}

          {/* Action buttons — only for pending */}
          {isPending && (
            <div
              className="mt-2 flex items-center gap-2"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => handle('accept')}
                disabled={acting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
              >
                {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Accept
              </button>

              <button
                onClick={() => setRejecting(r => !r)}
                disabled={acting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-40"
              >
                <XCircle className="w-3 h-3" />
                Reject
              </button>

              <button
                onClick={() => handle('skip')}
                disabled={acting}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-500 text-[11px] hover:text-zinc-400 transition-colors disabled:opacity-40"
              >
                <SkipForward className="w-3 h-3" />
                Skip
              </button>
            </div>
          )}

          {/* Inline reject form */}
          {rejecting && (
            <div
              className="mt-2 space-y-1.5"
              onClick={e => e.stopPropagation()}
            >
              <textarea
                autoFocus
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Why reject? (teaches the system)"
                rows={2}
                className="w-full text-xs bg-[#111] border border-red-500/30 rounded-lg px-2.5 py-1.5 text-zinc-300 placeholder:text-zinc-600 resize-none focus-visible:outline-none focus:border-red-500/60"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handle('reject')}
                  disabled={acting}
                  className="px-3 py-1 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-semibold hover:bg-red-500/25 transition-colors"
                >
                  Confirm reject
                </button>
                <button
                  onClick={() => setRejecting(false)}
                  className="px-3 py-1 rounded-lg text-zinc-500 text-[11px] hover:text-zinc-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Right panel — full preview ─────────────────────────────────────────────────

function PreviewPanel({
  s,
  onAccept,
}: {
  s: Suggestion | null
  onAccept: (id: string, caption: string, imageDataUrl: string) => Promise<void>
}) {
  const [caption, setCaption] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)

  useEffect(() => {
    setCaption(s?.caption ?? '')
    setImageDataUrl(null)
  }, [s?.id])

  if (!s) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
        <Tv2 className="w-10 h-10" />
        <p className="text-sm">Select a suggestion to preview</p>
      </div>
    )
  }

  const meta = POST_TYPE_META[s.post_type]

  // For event templates (poster, split, golden-hour, broadside…), pass the
  // primary event's fields at the top level of ctx so the preview renders
  // the hero image + title correctly.
  const isEventTemplate = !['tonight-list', 'weekend-digest', 'weekly-five'].includes(s.template_id)
  const primaryEvent = s.event_data[0]

  const ctx: TemplateContext = {
    postDate:  primaryEvent?.date,
    // Always include events[] (digest templates need it)
    events: s.event_data.map(e => ({
      title:    e.title,
      date:     e.date,
      time:     e.time ?? undefined,
      venue:    e.venue ?? undefined,
      category: e.category ?? undefined,
      imageUrl: e.imageUrl ?? undefined,
    })),
    // Also pass top-level fields for event templates (image hero, title overlay)
    ...(isEventTemplate && primaryEvent ? {
      title:    primaryEvent.title,
      date:     primaryEvent.date,
      time:     primaryEvent.time ?? undefined,
      venue:    primaryEvent.venue ?? undefined,
      category: primaryEvent.category ?? undefined,
      imageUrl: primaryEvent.imageUrl ?? undefined,
    } : {}),
  }

  async function handleAccept() {
    if (!imageDataUrl) return
    setAccepting(true)
    await onAccept(s!.id, caption, imageDataUrl)
    setAccepting(false)
  }

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: meta?.color + '22' }}
        >
          {meta && <meta.Icon className="w-4 h-4" style={{ color: meta.color }} />}
        </div>
        <div>
          <p className="text-sm font-bold text-zinc-200">{meta?.label}</p>
          <p className="text-[11px] text-zinc-500">{fmtScheduled(s.scheduled_for)}</p>
        </div>
        <Link
          href={`/admin/ig/digest?events=${s.event_ids.join(',')}`}
          className="ml-auto text-[11px] text-terra hover:text-terra-mid transition-colors"
        >
          Edit in Digest →
        </Link>
      </div>

      {/* Canvas preview */}
      <div className="flex-shrink-0">
        <CanvasPreview
          templateId={s.template_id}
          ctx={ctx}
          onExport={setImageDataUrl}
        />
      </div>

      {/* Strategy note */}
      {s.strategy_notes && (
        <div className="flex items-start gap-2 bg-[#1a1a1a] rounded-lg p-2.5">
          <TrendingUp className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-500 leading-relaxed">{s.strategy_notes}</p>
        </div>
      )}

      {/* Caption editor */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Caption — edit before accepting
        </label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={5}
          className="w-full text-xs bg-[#111] border border-white/8 rounded-xl px-3 py-2.5 text-zinc-300 placeholder:text-zinc-600 resize-none focus-visible:outline-none focus:border-terra/50 leading-relaxed"
          placeholder="AI-generated caption will appear here…"
        />
        <p className="text-[10px] text-zinc-600">{caption.length} chars</p>
      </div>

      {/* Accept CTA */}
      {s.status === 'pending' && (
        <button
          onClick={handleAccept}
          disabled={accepting || !imageDataUrl}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-terra text-white text-sm font-semibold hover:bg-terra-hover transition-colors disabled:opacity-40"
        >
          {accepting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling…</>
            : !imageDataUrl
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Rendering canvas…</>
              : <><CheckCircle2 className="w-4 h-4" /> Accept &amp; Schedule</>
          }
        </button>
      )}

      {/* Events list */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Events in this post</p>
        {s.event_data.map(e => (
          <div key={e.id} className="flex items-start gap-2 py-1.5 border-b border-white/5">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 font-medium truncate">{e.title}</p>
              <p className="text-[10px] text-zinc-500">
                {e.date} {e.time ? `· ${e.time}` : ''} {e.venue ? `· ${e.venue}` : ''}
              </p>
            </div>
            <span className="flex-shrink-0 text-[10px] text-zinc-600 font-mono">{e.popularityScore}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  initial: Suggestion[]
  initialStats: Stats
}

export function SuggestionQueue({ initial, initialStats }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initial)
  const [stats, setStats]             = useState<Stats>(initialStats)
  const [selected, setSelected]       = useState<Suggestion | null>(initial[0] ?? null)
  const [generating, setGenerating]   = useState(false)
  const [genMsg, setGenMsg]           = useState<string | null>(null)
  const [filter, setFilter]           = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const [autoPost, setAutoPost]       = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const filtered = suggestions.filter(s => filter === 'all' || s.status === filter)
  const pending  = suggestions.filter(s => s.status === 'pending').length
  const accepted = suggestions.filter(s => s.status === 'accepted').length
  const rejected = suggestions.filter(s => s.status === 'rejected').length
  const total    = suggestions.filter(s => s.status !== 'skipped').length
  const acceptRate = total > 0 ? Math.round((accepted / total) * 100) : 0

  const reload = useCallback(async () => {
    const res = await fetch('/api/admin/ig/suggestions')
    if (!res.ok) return
    const data = await res.json()
    setSuggestions(data.suggestions ?? [])
    setStats(data.stats ?? {})
  }, [])

  async function generate() {
    setGenerating(true)
    setGenMsg(null)
    const res = await fetch('/api/admin/ig/suggestions/generate', { method: 'POST' })
    const data = await res.json()
    setGenerating(false)
    if (res.ok) {
      setGenMsg(`Generated ${data.generated} suggestions for ${data.weekStart} → ${data.weekEnd}`)
      await reload()
    } else {
      setGenMsg(`Error: ${data.error}`)
    }
  }

  async function handleAction(
    id: string,
    action: 'accept' | 'reject' | 'skip',
    reason?: string,
    caption?: string,
  ) {
    const body: Record<string, unknown> = { action, reason, caption }
    // For accept, pass imageDataUrl from the preview panel state
    const res = await fetch(`/api/admin/ig/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return

    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'skipped', rejection_reason: reason ?? null } : s)
    )

    // Auto-advance selection to next pending
    const nextPending = suggestions.find(s => s.id !== id && s.status === 'pending')
    if (nextPending) setSelected(nextPending)
  }

  async function handleAccept(id: string, caption: string, imageDataUrl: string) {
    const res = await fetch(`/api/admin/ig/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', caption, imageDataUrl }),
    })
    if (!res.ok) return

    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, status: 'accepted', caption } : s)
    )

    const nextPending = suggestions.find(s => s.id !== id && s.status === 'pending')
    if (nextPending) setSelected(nextPending)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#0e0e0e]">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 border-b border-white/5 px-5 py-3 flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-bold text-zinc-100">Suggestion Queue</h1>
          <p className="text-[11px] text-zinc-500">
            {pending} pending · {accepted} accepted · {rejected} rejected
            {total > 0 && ` · ${acceptRate}% acceptance`}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Filter tabs */}
          {(['all','pending','accepted','rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors capitalize',
                filter === f
                  ? 'bg-terra/20 text-terra'
                  : 'text-zinc-500 hover:text-zinc-400',
              ].join(' ')}
            >
              {f}
              {f === 'pending' && pending > 0 && (
                <span className="ml-1 bg-terra text-white text-[9px] px-1 rounded-full">{pending}</span>
              )}
            </button>
          ))}

          {/* Auto-post toggle */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/8">
            <span className="text-[11px] text-zinc-500">Auto-post</span>
            <button
              onClick={() => {
                if (!autoPost && !confirm('Enable fully automated posting? Posts will go live without review.')) return
                setAutoPost(v => !v)
              }}
              className={[
                'w-9 h-5 rounded-full transition-colors relative',
                autoPost ? 'bg-terra' : 'bg-zinc-700',
              ].join(' ')}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoPost ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-terra text-white text-[11px] font-semibold hover:bg-terra-hover transition-colors disabled:opacity-50"
          >
            {generating
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
              : <><Zap className="w-3.5 h-3.5" /> Generate next week</>
            }
          </button>

          <button onClick={reload} className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {genMsg && (
          <div className="w-full flex items-center gap-2 text-[11px] text-zinc-400 bg-[#1a1a1a] rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {genMsg}
          </div>
        )}
      </div>

      {/* ── Body: two-panel ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: scrollable queue */}
        <div className="w-[360px] flex-shrink-0 overflow-y-auto border-r border-white/5 p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-600 gap-3">
              <Zap className="w-8 h-8" />
              <p className="text-sm">No suggestions yet.</p>
              <button
                onClick={generate}
                disabled={generating}
                className="text-xs text-terra hover:text-terra-mid transition-colors"
              >
                Generate next week →
              </button>
            </div>
          ) : (
            filtered.map(s => (
              <SuggestionCard
                key={s.id}
                s={s}
                selected={selected?.id === s.id}
                onSelect={() => setSelected(s)}
                onAction={handleAction}
              />
            ))
          )}
        </div>

        {/* Right: sticky preview */}
        <div className="flex-1 min-w-0 overflow-y-auto p-5">
          <PreviewPanel
            s={selected ?? null}
            onAccept={handleAccept}
          />
        </div>
      </div>
    </div>
  )
}
