'use client'

/**
 * EventSpotlightCard — branded Instagram image for individual events.
 * Three templates, all with text + photo in separate zones — works for any
 * event image (professional photo, flat graphic, low-res flyer, etc.).
 *
 * Exports via html-to-image at 1080px output width.
 * Image routed through /api/image-proxy for same-origin CORS-safe capture.
 */

import { useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { Download, Loader2 } from 'lucide-react'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const CREAM = '#fbf7f1'
const TERRA = '#9a442d'
const INK   = '#1a1614'

const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='0.3'/%3E%3C/svg%3E")`

const CAT_EMOJI: Record<string, string> = {
  'Music': '🎵', 'Comedy': '😂', 'Sports': '🏟️', 'Arts & Theater': '🎭',
  'Food & Drink': '🍻', 'Family': '🎡', 'Film': '🎬', 'Outdoor': '🌄',
  'Festivals': '🎪', 'Community': '🌵',
}

// ── Shared style helpers ───────────────────────────────────────────────────────
const EPILOGUE: React.CSSProperties = {
  fontFamily: 'var(--font-epilogue), "Epilogue", Georgia, serif',
  fontWeight: 900,
}
const INTER: React.CSSProperties = {
  fontFamily: 'var(--font-inter), system-ui, sans-serif',
}

// ── Types ─────────────────────────────────────────────────────────────────────
type IGFormat   = '4:5' | '9:16' | '1:1'
type IGTemplate = 'broadside' | 'stub' | 'frame'

const ASPECT: Record<IGFormat, string>       = { '4:5': '4/5', '9:16': '9/16', '1:1': '1/1' }
const OUTPUT_WIDTH: Record<IGFormat, number> = { '4:5': 1080,  '9:16': 1080,   '1:1': 1080 }

// ── Props (unchanged from old version — no data-layer changes needed) ─────────
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

// ── Shared sub-components ─────────────────────────────────────────────────────

function GrainOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
      backgroundImage: GRAIN_BG,
      opacity: 0.5,
      mixBlendMode: 'overlay' as const,
    }} />
  )
}

interface PhotoPanelProps {
  src: string | null
  alt: string
  style?: React.CSSProperties
}
function PhotoPanel({ src, alt, style }: PhotoPanelProps) {
  if (!src) {
    return (
      <div style={{ background: `linear-gradient(135deg, ${TERRA} 0%, #6b2d1a 100%)`, ...style,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 64 }}>📍</span>
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} style={{ objectFit: 'cover', objectPosition: 'center', ...style }} />
}

// ── Template A: Broadside ─────────────────────────────────────────────────────
// Cream top panel (logo, category, title, date, venue) + terra divider + photo bottom

interface TemplateProps {
  format: IGFormat
  title: string
  catLabel: string
  emoji: string
  metaLine: string
  dateLabel: string | null
  time: string | null
  venue: string | null
  price: string | null
  proxied: string | null
}

/** Extract day number from "Sunday, May 3" → "3" */
function extractDay(dateLabel: string | null): string {
  return dateLabel?.match(/\d+/)?.[0] ?? ''
}
/** "Sunday, May 3" + "11:00 AM" → "MAY · 11:00 AM" (the part after the day number) */
function extractDateRest(dateLabel: string | null, time: string | null): string {
  if (!dateLabel) return time ?? ''
  // Remove weekday and day number, keep "May 3" → "May" then add time
  const month = dateLabel.replace(/^[A-Za-z]+,?\s*/, '').replace(/\s*\d+$/, '').trim()
  return [month.toUpperCase(), time].filter(Boolean).join(' · ')
}

function TemplateBroadside({ format, title, catLabel, emoji, metaLine, dateLabel, time, venue, price, proxied }: TemplateProps) {
  const isStory = format === '9:16'
  // story: text 38% / photo 62%; feed+square: text 42% / photo 58%
  const textPct  = isStory ? 38 : 42
  const titleMax = isStory ? 52 : 60
  const displayTitle = title.length > titleMax ? title.slice(0, titleMax - 1) + '…' : title
  const titleFontSize = displayTitle.length > 40 ? 28 : displayTitle.length > 28 ? 34 : 40

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: CREAM, display: 'flex', flexDirection: 'column' }}>
      <GrainOverlay />

      {/* Text panel */}
      <div style={{
        height: `${textPct}%`, padding: '6% 8%',
        display: 'flex', flexDirection: 'column',
        background: CREAM,
        flexShrink: 0,
      }}>
        {/* Logo + category row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-terra.svg" alt="ABQ Unplugged" style={{ height: 18, objectFit: 'contain' }} />
          <div style={{
            ...INTER, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            color: '#ffffff', background: TERRA,
            padding: '4px 12px', borderRadius: 100,
          }}>
            {emoji} {catLabel.toUpperCase()}
          </div>
        </div>

        {/* Title */}
        <p style={{
          ...EPILOGUE, fontSize: titleFontSize,
          color: INK, lineHeight: 1.05, letterSpacing: '-0.02em',
          flex: 1, overflow: 'hidden',
        }}>
          {displayTitle}
        </p>

        {/* Terra rule */}
        <div style={{ width: '100%', height: 3, background: TERRA, borderRadius: 2, margin: '5% 0 4%' }} />

        {/* Date / meta */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...EPILOGUE, fontSize: 28, color: TERRA, lineHeight: 1 }}>
            {extractDay(dateLabel)}
          </span>
          <span style={{ ...INTER, fontSize: 12, color: INK, opacity: 0.6 }}>
            {extractDateRest(dateLabel, time)}
          </span>
        </div>
        {venue && (
          <p style={{ ...INTER, fontSize: 11, color: INK, opacity: 0.5, marginTop: 4 }}>
            {venue.length > 40 ? venue.slice(0, 39) + '…' : venue}
          </p>
        )}
        {price && (
          <p style={{ ...INTER, fontSize: 11, color: TERRA, fontWeight: 700, marginTop: 4 }}>{price}</p>
        )}
      </div>

      {/* Photo panel */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <PhotoPanel
          src={proxied}
          alt={title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

// ── Template B: Stub ──────────────────────────────────────────────────────────
// Portrait/Square: dark left panel + terra divider + photo right
// Story: dark top + terra divider + photo bottom

function TemplateStub({ format, title, catLabel, emoji, metaLine, dateLabel, time, venue, price, proxied }: TemplateProps) {
  const isStory = format === '9:16'
  const displayTitle = title.length > 60 ? title.slice(0, 59) + '…' : title
  const titleFontSize = displayTitle.length > 36 ? 22 : displayTitle.length > 24 ? 28 : 34

  if (isStory) {
    // Vertical split: dark top 45% + divider + photo bottom 55%
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: INK }}>
        <GrainOverlay />

        {/* Dark text panel */}
        <div style={{ height: '44%', padding: '8% 8% 5%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.svg" alt="ABQ Unplugged" style={{ height: 16, objectFit: 'contain', opacity: 0.7, marginBottom: '8%' }} />
            <div style={{ ...INTER, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: TERRA, marginBottom: '6%' }}>
              {emoji} {catLabel.toUpperCase()}
            </div>
            <p style={{ ...EPILOGUE, fontSize: titleFontSize, color: '#ffffff', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
              {displayTitle}
            </p>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <p style={{ ...INTER, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{metaLine}</p>
            {venue && <p style={{ ...INTER, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{venue.length > 36 ? venue.slice(0, 35) + '…' : venue}</p>}
            {price && <p style={{ ...INTER, fontSize: 12, color: TERRA, fontWeight: 700, marginTop: 4 }}>{price}</p>}
          </div>
        </div>

        {/* Terra divider */}
        <div style={{ height: 4, background: TERRA, flexShrink: 0 }} />

        {/* Photo panel */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <PhotoPanel src={proxied} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <div style={{
            position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(26,22,20,0.6) 100%)',
          }} />
          <p style={{ position: 'absolute', bottom: '6%', left: '6%', ...INTER, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>abqunplugged.com</p>
        </div>
      </div>
    )
  }

  // Horizontal split: dark left 48% + divider + photo right
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', background: INK }}>
      <GrainOverlay />

      {/* Dark text panel */}
      <div style={{ width: '48%', padding: '8% 6%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.svg" alt="ABQ Unplugged" style={{ height: 14, objectFit: 'contain', opacity: 0.7, marginBottom: '10%' }} />
          <div style={{ ...INTER, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: TERRA, marginBottom: '8%', textTransform: 'uppercase' }}>
            {emoji} {catLabel}
          </div>
          <p style={{ ...EPILOGUE, fontSize: titleFontSize, color: '#ffffff', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            {displayTitle}
          </p>
        </div>
        <div>
          {/* Terra rule */}
          <div style={{ width: '100%', height: 2, background: TERRA, marginBottom: '8%' }} />
          <p style={{ ...INTER, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{metaLine}</p>
          {venue && <p style={{ ...INTER, fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{venue.length > 28 ? venue.slice(0, 27) + '…' : venue}</p>}
          {price && <p style={{ ...INTER, fontSize: 11, color: TERRA, fontWeight: 700, marginTop: 4 }}>{price}</p>}
        </div>
      </div>

      {/* Terra vertical divider */}
      <div style={{ width: 4, background: TERRA, flexShrink: 0 }} />

      {/* Photo panel */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <PhotoPanel src={proxied} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}

// ── Template C: Frame ─────────────────────────────────────────────────────────
// Dark INK background, photo as bounded inset rectangle, text above + below

function TemplateFrame({ format, title, catLabel, emoji, metaLine, dateLabel, time, venue, price, proxied }: TemplateProps) {
  const isStory  = format === '9:16'
  const displayTitle = title.length > 64 ? title.slice(0, 62) + '…' : title
  const titleFontSize = displayTitle.length > 40 ? 24 : displayTitle.length > 28 ? 30 : 36
  const photoH = isStory ? '46%' : '52%'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: INK, display: 'flex', flexDirection: 'column', padding: '7% 8%', boxSizing: 'border-box' }}>
      <GrainOverlay />

      {/* Top: logo + category */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.svg" alt="ABQ Unplugged" style={{ height: 16, objectFit: 'contain', opacity: 0.7 }} />
        <div style={{
          ...INTER, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          color: '#ffffff', background: TERRA, padding: '4px 12px', borderRadius: 100,
        }}>
          {emoji} {catLabel.toUpperCase()}
        </div>
      </div>

      {/* Title */}
      <p style={{ ...EPILOGUE, fontSize: titleFontSize, color: '#ffffff', lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '5%', flex: isStory ? 'none' : undefined }}>
        {displayTitle}
      </p>

      {/* Photo inset */}
      <div style={{
        height: photoH, borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        flexShrink: 0, position: 'relative',
      }}>
        <PhotoPanel src={proxied} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* Terra rule */}
      <div style={{ width: 40, height: 3, background: TERRA, borderRadius: 2, margin: '5% 0 3%' }} />

      {/* Date + venue */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ ...EPILOGUE, fontSize: 26, color: '#ffffff', lineHeight: 1 }}>
          {extractDay(dateLabel)}
        </span>
        <span style={{ ...INTER, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          {extractDateRest(dateLabel, time)}
        </span>
      </div>
      {venue && (
        <p style={{ ...INTER, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          {venue.length > 44 ? venue.slice(0, 43) + '…' : venue}
        </p>
      )}
      {price && (
        <p style={{ ...INTER, fontSize: 12, color: TERRA, fontWeight: 700, marginTop: 4 }}>{price}</p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function EventSpotlightCard({
  title, category, dateLabel, time, venue, price, imageUrl, eventId,
}: EventSpotlightProps) {
  const cardRef             = useRef<HTMLDivElement>(null)
  const [busy, setBusy]     = useState(false)
  const [format, setFormat] = useState<IGFormat>('4:5')
  const [template, setTemplate] = useState<IGTemplate>('broadside')

  const proxied = imageUrl?.startsWith('http')
    ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
    : imageUrl ?? null

  const handleDownload = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      const node = cardRef.current
      const pixelRatio = OUTPUT_WIDTH[format] / node.offsetWidth
      const blob = await toBlob(node, { pixelRatio, cacheBust: true, skipAutoScale: true })
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `abq-${eventId}-${template}-${format.replace(':', 'x')}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  const emoji    = CAT_EMOJI[category ?? ''] ?? '📍'
  const catLabel = category ?? 'Event'
  const metaLine = [dateLabel, time].filter(Boolean).join(' · ')

  const templateProps: TemplateProps = { format, title, catLabel, emoji, metaLine, dateLabel, time, venue, price, proxied }

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-2">
        {/* Format picker */}
        <div className="flex bg-black/25 p-0.5 rounded-lg gap-0.5">
          {(['4:5', '9:16', '1:1'] as IGFormat[]).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide transition-colors ${
                format === f ? 'bg-terra text-white' : 'text-white/35 hover:text-white/70'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Template picker */}
        <div className="flex bg-black/25 p-0.5 rounded-lg gap-0.5">
          {([['broadside', 'Cream top'], ['stub', 'Dark split'], ['frame', 'Dark frame']] as [IGTemplate, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTemplate(t)}
              className={`px-2 py-1 rounded text-[10px] font-bold tracking-wide transition-colors ${
                template === t ? 'bg-terra text-white' : 'text-white/35 hover:text-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={busy}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            bg-white/[0.06] text-white/50 hover:bg-terra hover:text-white
            transition-all active:scale-95 disabled:opacity-40
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra
            focus-visible:ring-offset-2 focus-visible:ring-offset-ink-deep"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {busy ? 'Exporting…' : `Download ${format}`}
        </button>
      </div>

      {/* Card preview */}
      <div
        style={{ width: 320, aspectRatio: ASPECT[format], maxWidth: '100%' }}
        className="overflow-hidden rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] self-start"
      >
        <div
          ref={cardRef}
          style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
        >
          {template === 'broadside' && <TemplateBroadside {...templateProps} />}
          {template === 'stub'      && <TemplateStub      {...templateProps} />}
          {template === 'frame'     && <TemplateFrame     {...templateProps} />}
        </div>
      </div>
    </div>
  )
}
