'use client'

/**
 * EventSpotlightCard — branded Instagram image for individual events.
 * Supports 4:5 portrait (default, best for feed reach) and 1:1 square.
 * Exports via html-to-image at pixelRatio 2 → 1080px output.
 *
 * Image routed through /api/image-proxy so html-to-image can embed it
 * as a same-origin data URL (avoids CORS issues with CDN images).
 */

import { useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { Download, Loader2 } from 'lucide-react'

const TERRA = '#9a442d'
const DARK  = '#1a1614'

const CAT_EMOJI: Record<string, string> = {
  'Music': '🎵', 'Comedy': '😂', 'Sports': '🏟️', 'Arts & Theater': '🎭',
  'Food & Drink': '🍻', 'Family': '🎡', 'Film': '🎬', 'Outdoor': '🌄',
  'Festivals': '🎪', 'Community': '🌵',
}

export interface EventSpotlightProps {
  title: string
  category: string | null
  dateLabel: string | null   // e.g. "Saturday, May 3"
  time: string | null
  venue: string | null
  price: string | null
  imageUrl: string | null
  eventId: string
}

type CardFormat = '4:5' | '1:1'

const CARD_W = 540
const CARD_H: Record<CardFormat, number>        = { '4:5': 675, '1:1': 540 }
const PHOTO_H_PCT: Record<CardFormat, number>   = { '4:5': 56,  '1:1': 62 }
const BOTTOM_PAD: Record<CardFormat, number>    = { '4:5': 44,  '1:1': 38 }

const EPILOGUE: React.CSSProperties = { fontFamily: 'var(--font-epilogue), "Epilogue", Georgia, serif', fontWeight: 900 }
const INTER: React.CSSProperties    = { fontFamily: 'var(--font-inter), system-ui, sans-serif' }

export function EventSpotlightCard({
  title, category, dateLabel, time, venue, price, imageUrl, eventId,
}: EventSpotlightProps) {
  const cardRef             = useRef<HTMLDivElement>(null)
  const [busy, setBusy]     = useState(false)
  const [format, setFormat] = useState<CardFormat>('4:5')

  const cardH    = CARD_H[format]
  const photoPct = PHOTO_H_PCT[format]
  const botPad   = BOTTOM_PAD[format]

  const proxied = imageUrl?.startsWith('http')
    ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
    : imageUrl ?? null

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
      a.download = `abq-unplugged-event-${eventId}-${format.replace(':', 'x')}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  const emoji    = CAT_EMOJI[category ?? ''] ?? '📍'
  const catLabel = category ?? 'Event'
  const titleLen = title.length
  const titleSize = titleLen > 50 ? 28 : titleLen > 36 ? 34 : titleLen > 24 ? 40 : 48
  const metaLine = [dateLabel, time].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar: format toggle + download */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-black/25 p-0.5 rounded-lg gap-0.5">
          {(['4:5', '1:1'] as CardFormat[]).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wide transition-colors ${
                format === f
                  ? 'bg-[#9a442d] text-white'
                  : 'text-white/35 hover:text-white/70'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={handleDownload}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            bg-white/[0.06] text-white/50 hover:bg-[#9a442d] hover:text-white
            transition-all active:scale-95 disabled:opacity-40
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a442d]
            focus-visible:ring-offset-2 focus-visible:ring-offset-[#201c1a]"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {busy ? 'Exporting…' : `Download ${format}`}
        </button>
      </div>

      {/* Card preview */}
      <div
        style={{ width: CARD_W, height: cardH, maxWidth: '100%' }}
        className="overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] self-start"
      >
        <div ref={cardRef} style={{
          width: CARD_W, height: cardH,
          background: DARK,
          position: 'relative', overflow: 'hidden',
        }}>

          {/* Photo: full bleed, top portion */}
          {proxied ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxied}
              alt={title}
              loading="lazy"
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: `${photoPct}%`,
                objectFit: 'cover', objectPosition: 'center 30%',
              }}
            />
          ) : (
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: `${photoPct}%`,
              background: `linear-gradient(135deg, ${TERRA} 0%, #6b2d1a 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 64 }}>{emoji}</span>
            </div>
          )}

          {/* Gradient overlay: photo fades into dark */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.10) 28%, rgba(26,22,20,0.82) 50%, rgba(26,22,20,1) 66%)',
          }} />

          {/* Price badge: top right */}
          {price && (
            <div style={{
              position: 'absolute', top: 24, right: 24, zIndex: 3,
              background: TERRA, color: '#ffffff',
              ...INTER,
              fontSize: 12, fontWeight: 700,
              padding: '6px 14px', borderRadius: 100,
              letterSpacing: '0.02em',
            }}>
              {price}
            </div>
          )}

          {/* Logo watermark: top left */}
          <div style={{ position: 'absolute', top: 24, left: 28, zIndex: 3 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-white.svg"
              alt="ABQ Unplugged"
              style={{ height: 20, objectFit: 'contain', opacity: 0.7 }}
            />
          </div>

          {/* Text content: bottom section */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: `0 40px ${botPad}px`,
            display: 'flex', flexDirection: 'column',
            zIndex: 2,
          }}>
            {/* Category label */}
            <p style={{
              ...INTER,
              color: TERRA, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              {emoji} {catLabel}
            </p>

            {/* Event title */}
            <p style={{
              ...EPILOGUE,
              fontSize: titleSize,
              color: '#ffffff', lineHeight: 1.05,
              letterSpacing: '-0.01em',
              marginBottom: 14,
            }}>
              {title.length > 65 ? title.slice(0, 63) + '…' : title}
            </p>

            {/* Date + time */}
            {metaLine && (
              <p style={{
                ...INTER,
                color: 'rgba(255,255,255,0.6)', fontSize: 13,
                marginBottom: venue ? 4 : 22,
              }}>
                {metaLine}
              </p>
            )}

            {/* Venue */}
            {venue && (
              <p style={{
                ...INTER,
                color: 'rgba(255,255,255,0.45)', fontSize: 13,
                marginBottom: 22,
              }}>
                📍 {venue.length > 40 ? venue.slice(0, 40) + '…' : venue}
              </p>
            )}

            {/* Footer: logo + URL */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: 16,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-white.svg"
                alt="ABQ Unplugged"
                style={{ height: 18, objectFit: 'contain' }}
              />
              <p style={{
                ...INTER,
                color: 'rgba(255,255,255,0.28)', fontSize: 11,
                letterSpacing: '0.06em',
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
