'use client'

/**
 * RoundUpCard — branded 1080×1080 Instagram image for
 * "Tonight's Picks" and "This Week in ABQ" round-up posts.
 * Exports via html-to-image at pixelRatio 2 → 1080px output.
 */

import { useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { Download, Loader2 } from 'lucide-react'

const TERRA  = '#9a442d'
const DARK   = '#1a1614'
const DARKER = '#201c1a'

const CAT_EMOJI: Record<string, string> = {
  'Music': '🎵', 'Comedy': '😂', 'Sports': '🏟️', 'Arts & Theater': '🎭',
  'Food & Drink': '🍻', 'Family': '🎡', 'Film': '🎬', 'Outdoor': '🌄',
  'Festivals': '🎪', 'Community': '🌵',
}

export interface RoundUpEvent {
  title: string
  category: string | null
  venue: string | null
  time: string | null
}

interface Props {
  type: 'tonight' | 'weekly'
  events: RoundUpEvent[]
  count: number
}

const CARD_PX = 540
const EPILOGUE: React.CSSProperties = { fontFamily: 'var(--font-epilogue), "Epilogue", Georgia, serif', fontWeight: 900 }
const INTER: React.CSSProperties    = { fontFamily: 'var(--font-inter), system-ui, sans-serif' }

export function RoundUpCard({ type, events, count }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  const handleDownload = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        skipAutoScale: true,
      })
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `abq-unplugged-${type}-roundup.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  const show       = events.slice(0, 5)
  const isTonight  = type === 'tonight'
  const headLabel  = isTonight ? '🌙  TONIGHT IN ABQ' : '📅  THIS WEEK IN ABQ'
  const headTitle  = isTonight ? "Tonight's Picks" : 'This Week in ABQ'
  const moreCount  = Math.max(0, count - show.length)

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-terra font-bold">
          {isTonight ? "Tonight's Picks" : 'Weekly Round-Up'}
        </p>
        <button
          onClick={handleDownload}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            bg-white/[0.06] text-white/50 hover:bg-terra hover:text-white
            transition-all active:scale-95 disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {busy ? 'Exporting…' : 'Download PNG'}
        </button>
      </div>

      {/* Card */}
      <div
        style={{ width: CARD_PX, height: CARD_PX, maxWidth: '100%' }}
        className="overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] self-start"
      >
        <div ref={cardRef} style={{
          width: CARD_PX, height: CARD_PX,
          background: DARK,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative',
        }}>
          {/* Accent stripe at top */}
          <div style={{ height: 4, background: TERRA, flexShrink: 0 }} />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '36px 44px 36px' }}>
            {/* Header: logo + label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-white.svg" alt="ABQ Unplugged" style={{ height: 24, objectFit: 'contain' }} />
              <p style={{
                ...INTER, color: TERRA, fontSize: 11,
                letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700,
              }}>
                {headLabel}
              </p>
            </div>

            {/* Section title */}
            <p style={{
              ...EPILOGUE, fontSize: 44, color: '#ffffff', lineHeight: 1.0, marginBottom: 20,
            }}>
              {headTitle}
            </p>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 20 }} />

            {/* Event list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              {show.length > 0 ? show.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Category dot */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(154,68,45,0.15)',
                    border: '1px solid rgba(154,68,45,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    <span style={{ fontSize: 14 }}>{CAT_EMOJI[e.category ?? ''] ?? '📍'}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      ...INTER, color: '#ffffff', fontSize: 15, fontWeight: 600, lineHeight: 1.3,
                    }}>
                      {e.title.length > 46 ? e.title.slice(0, 46) + '…' : e.title}
                    </p>
                    {(e.venue || e.time) && (
                      <p style={{
                        ...INTER, color: 'rgba(255,255,255,0.38)', fontSize: 12, marginTop: 2,
                      }}>
                        {[e.venue?.length && e.venue.length > 30 ? e.venue.slice(0, 30) + '…' : e.venue, e.time].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              )) : (
                <p style={{ ...INTER, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
                  No events found — check back soon!
                </p>
              )}
            </div>

            {/* Footer */}
            <div style={{
              marginTop: 20,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <p style={{ ...INTER, color: 'rgba(255,255,255,0.32)', fontSize: 12 }}>
                {moreCount > 0 ? `+${moreCount} more events →` : 'See all events →'}
              </p>
              <p style={{
                ...INTER, color: 'rgba(255,255,255,0.22)', fontSize: 12, letterSpacing: '0.04em',
              }}>
                abqunplugged.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
