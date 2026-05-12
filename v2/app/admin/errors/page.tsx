'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2, RefreshCw, AlertTriangle, AlertCircle, Info, Check,
  ChevronDown, ChevronRight, Trash2,
} from 'lucide-react'

interface ErrorRow {
  id:          string
  created_at:  string
  source:      string
  severity:    string
  message:     string
  location:    string | null
  context:     Record<string, unknown> | null
  digest:      string | null
  resolved_at: string | null
}

const SEVERITY_STYLES: Record<string, string> = {
  error:   'text-red-300 bg-red-500/10 border-red-500/30',
  warning: 'text-amber-200 bg-amber-500/10 border-amber-500/30',
  info:    'text-blue-200 bg-blue-500/10 border-blue-500/30',
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  error:   <AlertCircle size={12} />,
  warning: <AlertTriangle size={12} />,
  info:    <Info size={12} />,
}

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso)
  const s = Math.round(diff / 1000)
  if (s < 60)      return `${s}s ago`
  if (s < 3600)    return `${Math.round(s / 60)}m ago`
  if (s < 86400)   return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver',
  })
}

export default function AdminErrorsPage() {
  const [rows, setRows] = useState<ErrorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/admin/error-log?limit=200${showResolved ? '&resolved=1' : ''}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Failed to load')
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [showResolved])

  useEffect(() => { load() }, [load])

  /** Group entries by digest to dedupe noisy repeat errors. */
  const grouped = useMemo(() => {
    const m = new Map<string, { rows: ErrorRow[]; first: ErrorRow; count: number }>()
    for (const r of rows) {
      const key = r.digest || r.id
      const g = m.get(key)
      if (g) {
        g.rows.push(r)
        g.count += 1
      } else {
        m.set(key, { rows: [r], first: r, count: 1 })
      }
    }
    return Array.from(m.values()).sort((a, b) =>
      Date.parse(b.first.created_at) - Date.parse(a.first.created_at)
    )
  }, [rows])

  async function resolveGroup(digest: string | null, id: string) {
    setResolvingId(id)
    try {
      await fetch('/api/admin/error-log', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(digest ? { resolveDigest: digest } : { id }),
      })
      await load()
    } finally {
      setResolvingId(null)
    }
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const counts = useMemo(() => ({
    total:    rows.length,
    error:    rows.filter(r => r.severity === 'error').length,
    warning:  rows.filter(r => r.severity === 'warning').length,
    info:     rows.filter(r => r.severity === 'info').length,
  }), [rows])

  return (
    <div className="min-h-[80vh]">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Error log</h1>
          <p className="text-sm text-white/45 mt-0.5">
            Centralized record of site breakages — client error boundaries, API exceptions, cron failures.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-white/55">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
              className="accent-[#9a442d]"
            />
            Include resolved
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded border border-white/10 text-xs text-white/65 hover:text-white hover:border-white/30 disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Severity counters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-[11px] text-white/45">
          {counts.total} entr{counts.total === 1 ? 'y' : 'ies'} total
        </span>
        {counts.error > 0 && (
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${SEVERITY_STYLES.error}`}>
            {counts.error} error{counts.error === 1 ? '' : 's'}
          </span>
        )}
        {counts.warning > 0 && (
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${SEVERITY_STYLES.warning}`}>
            {counts.warning} warning{counts.warning === 1 ? '' : 's'}
          </span>
        )}
        {counts.info > 0 && (
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${SEVERITY_STYLES.info}`}>
            {counts.info} info
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300 mb-4">
          {error}
        </div>
      )}

      {loading && rows.length === 0 && (
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-center py-16 text-white/55">
          <Check size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">All clear — no {showResolved ? '' : 'open '}errors logged.</p>
        </div>
      )}

      <div className="space-y-2">
        {grouped.map(g => {
          const isOpen = expanded.has(g.first.id)
          return (
            <div
              key={g.first.id}
              className={`bg-[#111] border rounded-xl p-3 transition-colors ${
                g.first.resolved_at ? 'border-white/[0.04] opacity-60' : 'border-white/[0.08]'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggle(g.first.id)}
                  className="shrink-0 mt-0.5 text-white/45 hover:text-white"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${SEVERITY_STYLES[g.first.severity] ?? SEVERITY_STYLES.info}`}>
                      {SEVERITY_ICON[g.first.severity] ?? SEVERITY_ICON.info}
                      {g.first.severity}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-white/55">
                      {g.first.source}
                    </span>
                    {g.count > 1 && (
                      <span className="text-[10px] font-semibold text-white/85 bg-white/[0.08] px-1.5 py-0.5 rounded">
                        ×{g.count}
                      </span>
                    )}
                    <span className="text-[11px] text-white/45" title={formatAbsolute(g.first.created_at)}>
                      {relativeTime(g.first.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-white/85 font-mono leading-snug break-words">
                    {g.first.message}
                  </p>
                  {g.first.location && (
                    <p className="text-[11px] text-white/45 mt-1 font-mono">
                      {g.first.location}
                    </p>
                  )}
                </div>
                {!g.first.resolved_at && (
                  <button
                    onClick={() => resolveGroup(g.first.digest, g.first.id)}
                    disabled={resolvingId === g.first.id}
                    title={g.count > 1 ? `Mark all ${g.count} matching entries resolved` : 'Mark resolved'}
                    className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-[11px] text-white/55 hover:text-green-300 hover:bg-green-500/10 transition-colors"
                  >
                    {resolvingId === g.first.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Resolve
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="mt-3 pl-7 space-y-2">
                  {g.first.context && (
                    <details>
                      <summary className="text-[11px] text-white/55 cursor-pointer hover:text-white">
                        Context
                      </summary>
                      <pre className="mt-2 p-2 bg-black/30 rounded text-[10px] text-white/65 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                        {JSON.stringify(g.first.context, null, 2)}
                      </pre>
                    </details>
                  )}
                  {g.count > 1 && (
                    <details>
                      <summary className="text-[11px] text-white/55 cursor-pointer hover:text-white">
                        Other occurrences ({g.count - 1})
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {g.rows.slice(1, 21).map(r => (
                          <li key={r.id} className="text-[10px] text-white/45 font-mono">
                            {relativeTime(r.created_at)} · {r.location ?? '—'}
                          </li>
                        ))}
                        {g.rows.length > 21 && (
                          <li className="text-[10px] text-white/35 italic">…and {g.rows.length - 21} more</li>
                        )}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
