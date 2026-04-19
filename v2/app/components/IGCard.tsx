'use client'

/**
 * IGCard — Instagram card design tool.
 *
 * A client-side design studio for generating share cards:
 *   • Three formats: 1:1 square, 4:5 portrait, 9:16 story
 *   • Live toggle controls: logo, category, date/time, venue, CTA
 *   • Overlay darkness slider
 *   • "Download PNG" button via html-to-image (1080px output)
 *
 * Data is fetched server-side by the parent page and passed as props.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { toBlob } from 'html-to-image'
import { MapPin, Clock, Download, ChevronLeft, Loader2 } from 'lucide-react'
import type { NormalizedEvent } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'

export type IGFormat = 'square' | 'portrait' | 'story'
type TitlePos = 'bottom' | 'center' | 'top'

const FORMATS: { key: IGFormat; label: string; desc: string; ratio: string }[] = [
  { key: 'portrait', label: '4:5',  desc: 'Portrait', ratio: '4 / 5'  },
  { key: 'story',    label: '9:16', desc: 'Story',    ratio: '9 / 16' },
  { key: 'square',   label: '1:1',  desc: 'Square',   ratio: '1 / 1'  },
]

// Target output width per format (height derived from aspect ratio)
const OUTPUT_WIDTH: Record<IGFormat, number> = {
  square:   1080,
  portrait: 1080,
  story:    1080,
}

// ─── Date / time helpers ────────────────────────────────────────────────────

function formatDateLong(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso)
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: 'America/Denver',
    })
  } catch { return '' }
}

function parseDateISO(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso)
}

// NOTE: event.time is already formatted by lib/events.ts formatTime() → e.g. "8:00 PM".
// Do NOT re-parse it — that would corrupt 8 PM → 8 AM by stripping the AM/PM context.

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  event: NormalizedEvent
  /** Pre-resolved image URL (imageUrl fallback already applied by the server page) */
  image: string
  initialFormat?: IGFormat
  /** When true: hides back link, removes full-screen wrapper so parent controls layout */
  embedded?: boolean
}

export function IGCardClient({ event, image, initialFormat = 'portrait', embedded = false }: Props) {
  const [format, setFormat]             = useState<IGFormat>(initialFormat)
  const [showLogo, setShowLogo]         = useState(true)
  const [showCategory, setShowCategory] = useState(true)
  const [showDateTime, setShowDateTime] = useState(true)
  const [showVenue, setShowVenue]       = useState(true)
  const [showCTA, setShowCTA]           = useState(false)
  const [showBigDate, setShowBigDate]   = useState(true)
  const [showSafeZone, setShowSafeZone] = useState(false)
  const [titlePos, setTitlePos]         = useState<TitlePos>('bottom')
  const [overlayPct, setOverlayPct]     = useState(55)
  const [downloading, setDownloading]   = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Image with onError fallback to category image — matches EventImage behavior so
  // the IG card and the public event page never diverge when an image 404s.
  // (Added 2026-04-19 as part of image-system overhaul — before this, IGCard
  // would just show a broken image when the source URL failed.)
  const categoryFallback = getCategoryFallback(event.category ?? undefined, event.id)
  const [imgSrc, setImgSrc] = useState(image)
  useEffect(() => { setImgSrc(image) }, [image])
  const proxiedSrc = imgSrc.startsWith('http')
    ? `/api/image-proxy?url=${encodeURIComponent(imgSrc)}`
    : imgSrc

  // Admin "Reject image" state
  const [rejecting, setRejecting] = useState(false)
  const [rejected, setRejected]   = useState(false)

  const isStory   = format === 'story'
  const isPortrait = format === 'portrait'
  const fmt       = FORMATS.find(f => f.key === format)!
  const dateStr   = formatDateLong(event.date)
  const timeStr   = event.time ?? ''   // already formatted: "8:00 PM", "7:30 PM", etc.
  const category  = event.category ?? ''
  const venue     = event.venue ?? 'Albuquerque, NM'

  // Title font size — smaller for long titles
  const titleLen  = event.title.length
  const titleSize = isStory
    ? (titleLen > 50 ? '1.8rem' : titleLen > 30 ? '2.4rem' : '3rem')
    : (titleLen > 50 ? '1.2rem' : titleLen > 30 ? '1.5rem' : '1.9rem')

  // Dynamic overlay values from slider
  const baseAlpha = overlayPct / 100

  // ── Download handler ──────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!cardRef.current || downloading) return
    setDownloading(true)
    try {
      const node = cardRef.current
      // Cap pixel ratio at 3× to avoid Mobile Safari memory pressure
      const naturalRatio = OUTPUT_WIDTH[format] / node.offsetWidth
      const pixelRatio = Math.min(naturalRatio, 3)
      // All display images are already routed through /api/image-proxy (same-origin),
      // so html-to-image can fetch them without any CORS issues — no pre-processing needed.
      const blob = await toBlob(node, { pixelRatio, cacheBust: false })
      if (!blob) throw new Error('toBlob returned null')
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
      a.download = `abq-${slug}-${format}.png`
      a.href = objectUrl
      a.click()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
    } catch (err) {
      console.error('[IGCard] download failed:', err)
      alert('Download failed — try screenshotting the card instead.')
    } finally {
      setDownloading(false)
    }
  }, [cardRef, format, event.title, downloading])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`flex flex-col select-none ${embedded ? '' : 'min-h-screen bg-[#0d0d0d]'}`}
      style={{ fontFamily: 'var(--font-epilogue, Epilogue, sans-serif)' }}
    >

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.07] shrink-0">

        {/* Back link — hidden when embedded */}
        {!embedded && (
          <Link
            href={`/events/${event.id}`}
            className="flex items-center gap-1 text-white/35 hover:text-white/65 text-sm transition-colors shrink-0"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Back</span>
          </Link>
        )}

        {/* Format switcher */}
        <div className="flex items-center gap-0.5 bg-white/[0.06] rounded-xl p-1">
          {FORMATS.map(f => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all
                ${format === f.key
                  ? 'bg-[#9a442d] text-white shadow-sm'
                  : 'text-white/35 hover:text-white/65 hover:bg-white/[0.04]'
                }
              `}
            >
              {f.label}
              <span className={`hidden sm:inline ml-1 text-[10px] font-normal ${format === f.key ? 'opacity-75' : 'opacity-50'}`}>
                {f.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Reject image (admin only — only shown when embedded in /admin/ig).
            One-click fix for wrong images from TM/SG/EB: sets image_status='rejected'
            so normalizeRow forces imageUrl=null → category fallback everywhere.
            See /api/admin/reject-image. */}
        {embedded && (
          <button
            onClick={async () => {
              if (rejecting || rejected) return
              if (!confirm('Reject this image? The event will use a category fallback photo on every page of the site until you manually upload a replacement.')) return
              setRejecting(true)
              try {
                const res = await fetch('/api/admin/reject-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: event.id, status: 'rejected' }),
                })
                if (!res.ok) throw new Error(await res.text())
                setRejected(true)
                setImgSrc(categoryFallback)
              } catch (err) {
                console.error('[IGCard] reject failed:', err)
                alert('Reject failed — check console.')
              } finally {
                setRejecting(false)
              }
            }}
            disabled={rejecting || rejected}
            title={rejected ? 'Image rejected — now using category fallback' : 'Mark this image as wrong'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              rejected
                ? 'bg-green-600/20 text-green-300 border border-green-600/30 cursor-not-allowed'
                : 'bg-red-600/15 text-red-300 hover:bg-red-600/25 border border-red-600/25 active:scale-95'
            }`}
          >
            {rejecting ? <Loader2 size={14} className="animate-spin" /> : <span className="text-base leading-none">{rejected ? '✓' : '🚫'}</span>}
            <span className="hidden sm:inline">
              {rejected ? 'Rejected' : 'Wrong image?'}
            </span>
          </button>
        )}

        {/* Download */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-[#9a442d] text-white text-sm font-semibold hover:bg-[#b5502f] active:scale-95 transition-all disabled:opacity-50 shrink-0"
        >
          {downloading
            ? <Loader2 size={15} className="animate-spin" />
            : <Download size={15} />
          }
          <span className="hidden sm:inline">
            {downloading ? 'Generating…' : 'Download PNG'}
          </span>
        </button>
      </div>

      {/* ── Card preview ── */}
      {/* embedded: flex-1 collapses to 0 in unconstrained parent — use plain div instead */}
      <div className={embedded
        ? 'flex items-center justify-center p-4'
        : 'flex-1 flex items-center justify-center p-5 sm:p-8 overflow-auto'
      }>
        <div
          ref={cardRef}
          id="ig-card"
          className="relative bg-black overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7)] shrink-0"
          style={{
            aspectRatio: fmt.ratio,
            borderRadius: '2px', // tiny radius looks pro but doesn't affect Instagram crop
            // All formats use explicit width + height:auto so mobile Safari correctly
            // fills the absolute-positioned background image (width:auto + height:fixed
            // causes w-full→0 on the img in some mobile browsers).
            width: isStory
              ? 'min(65vw, 340px)'    // 9:16 → height auto-derived (≈600px at 340px)
              : isPortrait
              ? 'min(82vw, 380px)'    // 4:5
              : 'min(88vw, 460px)',   // 1:1
            height: 'auto',
          }}
        >
          {/* Background image — always routed through same-origin proxy for reliable loading.
              No crossOrigin attr needed (proxy is same-origin, no CORS preflight).
              onError → swap to category fallback so the card never shows a broken image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxiedSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: `brightness(${Math.max(0.35, 1 - overlayPct * 0.0032)})` }}
            onError={() => {
              if (imgSrc !== categoryFallback) setImgSrc(categoryFallback)
            }}
          />

          {/* Gradient overlay — intensity driven by slider */}
          <div
            className="absolute inset-0"
            style={{
              background: isStory
                ? `linear-gradient(to bottom,
                    rgba(0,0,0,${(baseAlpha * 0.28).toFixed(2)}) 0%,
                    rgba(0,0,0,${(baseAlpha * 0.08).toFixed(2)}) 28%,
                    rgba(0,0,0,${(baseAlpha * 0.80).toFixed(2)}) 68%,
                    rgba(0,0,0,${Math.min(baseAlpha * 0.97, 0.97).toFixed(2)}) 100%)`
                : `linear-gradient(to bottom,
                    rgba(0,0,0,${(baseAlpha * 0.08).toFixed(2)}) 0%,
                    rgba(0,0,0,${(baseAlpha * 0.12).toFixed(2)}) 38%,
                    rgba(0,0,0,${Math.min(baseAlpha * 0.97, 0.97).toFixed(2)}) 100%)`,
            }}
          />

          {/* ── Top bar: logo + category ── */}
          {/* Story safe zone: Instagram overlays profile/timer in top 13% (250/1920px).
              14% padding pushes our logo just below that overlay.
              Feed posts: 1rem top margin is fine — UI is above the image in the feed. */}
          <div
            className="absolute top-0 left-0 right-0 flex items-start justify-between"
            style={{ padding: isStory ? '14% 1.2rem 0' : '1rem 1rem 0' }}
          >
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/logo-white.svg"
                alt="ABQ Unplugged"
                style={{ height: isStory ? '1.9rem' : '1.2rem', width: 'auto', flexShrink: 0 }}
              />
            ) : <div />}

            {showCategory && category && (
              <div
                className="bg-[#9a442d] text-white font-bold uppercase tracking-wide rounded-full"
                style={{
                  fontSize: isStory ? '0.78rem' : '0.62rem',
                  padding: isStory ? '0.32rem 0.85rem' : '0.18rem 0.6rem',
                  marginLeft: '0.5rem',
                }}
              >
                {category}
              </div>
            )}
          </div>

          {/* ── Story: large date centrepiece ── */}
          {/* Centered within the safe zone (14%–86%), not the full card,
              so it stays visible between Instagram's top and bottom UI. */}
          {isStory && showBigDate && (
            <div className="absolute flex items-center justify-center pointer-events-none"
              style={{ top: '14%', bottom: '14%', left: 0, right: 0 }}>
              <div className="text-center px-8">
                <p className="text-white/40 text-xs uppercase tracking-[0.22em] mb-1">
                  {parseDateISO(event.date)
                    .toLocaleDateString('en-US', { month: 'long', timeZone: 'America/Denver' })
                    .toUpperCase()}
                </p>
                <p
                  className="text-white font-black"
                  style={{ fontSize: '6rem', lineHeight: 1, textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
                >
                  {parseDateISO(event.date)
                    .toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Denver' })}
                </p>
                <p className="text-white/55 text-sm uppercase tracking-widest mt-1">
                  {parseDateISO(event.date)
                    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Denver' })}
                </p>
              </div>
            </div>
          )}

          {/* ── Safe zone overlay (toggleable) ── */}
          {showSafeZone && (
            <div className="absolute inset-0 pointer-events-none z-20">
              {/* Top safe zone — 14% for story, 8% for feed */}
              <div
                className="absolute left-0 right-0 top-0 border-b-2 border-dashed border-yellow-400/70"
                style={{ height: isStory ? '14%' : '8%', background: 'rgba(250,204,21,0.08)' }}
              />
              {/* Bottom safe zone */}
              <div
                className="absolute left-0 right-0 bottom-0 border-t-2 border-dashed border-yellow-400/70"
                style={{ height: isStory ? '14%' : '8%', background: 'rgba(250,204,21,0.08)' }}
              />
              {/* Side margins */}
              <div className="absolute top-0 bottom-0 left-0 border-r-2 border-dashed border-yellow-400/40"
                style={{ width: '5%', background: 'rgba(250,204,21,0.04)' }} />
              <div className="absolute top-0 bottom-0 right-0 border-l-2 border-dashed border-yellow-400/40"
                style={{ width: '5%', background: 'rgba(250,204,21,0.04)' }} />
              {/* Label */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 text-yellow-300 text-[9px] font-bold uppercase tracking-widest bg-black/60 rounded px-1.5 py-0.5">
                safe zone
              </div>
            </div>
          )}

          {/* ── Bottom content block ── */}
          {/* Story: 14% bottom padding keeps content above Instagram's reply bar (bottom 13%).
              Feed: 1rem bottom margin keeps text from the very edge. */}
          <div
            className="absolute left-0 right-0"
            style={{
              ...(titlePos === 'bottom'
                ? { bottom: 0, padding: isStory ? '0 1.2rem 14%' : '0 1rem 1rem' }
                : titlePos === 'top'
                ? { top: 0, padding: isStory ? '14% 1.2rem 0' : '3.5rem 1rem 0' }
                : { top: '50%', transform: 'translateY(-50%)', padding: '0 1.2rem' }
              ),
            }}
          >
            {/* Title */}
            <h1
              className="text-white font-black leading-tight"
              style={{
                fontSize: titleSize,
                lineHeight: 1.05,
                textShadow: '0 2px 14px rgba(0,0,0,0.65)',
                marginBottom: (showDateTime || showVenue) ? (isStory ? '0.75rem' : '0.5rem') : 0,
              }}
            >
              {event.title}
            </h1>

            {/* Date + time */}
            {showDateTime && (
              <div className="flex items-center gap-1.5 text-white/90" style={{ marginBottom: showVenue ? '0.35rem' : 0 }}>
                <Clock
                  className="flex-shrink-0 text-[#e8a898]"
                  style={{ width: isStory ? '1rem' : '0.78rem', height: isStory ? '1rem' : '0.78rem' }}
                />
                <span
                  className="font-semibold"
                  style={{ fontSize: isStory ? '0.92rem' : '0.75rem' }}
                >
                  {timeStr ? `${dateStr} · ${timeStr}` : dateStr}
                </span>
              </div>
            )}

            {/* Venue */}
            {showVenue && (
              <div className="flex items-center gap-1.5 text-white/70" style={{ marginBottom: showCTA ? (isStory ? '0.75rem' : '0.45rem') : 0 }}>
                <MapPin
                  className="flex-shrink-0 text-[#e8a898]"
                  style={{ width: isStory ? '1rem' : '0.78rem', height: isStory ? '1rem' : '0.78rem' }}
                />
                <span style={{ fontSize: isStory ? '0.88rem' : '0.72rem' }}>
                  {venue}
                </span>
              </div>
            )}

            {/* CTA strip */}
            {showCTA && (
              <div
                className="flex items-center justify-between"
                style={{ borderTop: '1px solid rgba(255,255,255,0.16)', paddingTop: isStory ? '0.65rem' : '0.4rem' }}
              >
                <span className="text-white/45 font-medium" style={{ fontSize: isStory ? '0.72rem' : '0.58rem' }}>
                  Tickets &amp; info
                </span>
                <span className="text-white font-bold tracking-wide" style={{ fontSize: isStory ? '0.82rem' : '0.62rem' }}>
                  abqunplugged.com
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Controls panel ── */}
      <div className="border-t border-white/[0.07] px-4 py-4 space-y-3 shrink-0">

        {/* Label row */}
        <p className="text-white/20 text-[10px] uppercase tracking-[0.18em]">Customize</p>

        {/* Toggle chips */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { label: 'Logo',       val: showLogo,     set: setShowLogo },
              { label: 'Category',   val: showCategory, set: setShowCategory },
              ...(isStory ? [{ label: 'Big Date', val: showBigDate, set: setShowBigDate }] : []),
              { label: 'Date & Time',val: showDateTime, set: setShowDateTime },
              { label: 'Venue',      val: showVenue,    set: setShowVenue },
              { label: 'CTA',        val: showCTA,      set: setShowCTA },
            ] as { label: string; val: boolean; set: (v: boolean) => void }[]
          ).map(({ label, val, set }) => (
            <button
              key={label}
              onClick={() => set(!val)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${val
                  ? 'bg-[#9a442d] text-white'
                  : 'bg-white/[0.07] text-white/30 hover:text-white/55 hover:bg-white/[0.1]'
                }
              `}
            >
              {label}
            </button>
          ))}
          {/* Safe zone toggle — separate style (yellow) */}
          <button
            onClick={() => setShowSafeZone(v => !v)}
            className={`
              px-3 py-1.5 rounded-full text-xs font-semibold transition-all
              ${showSafeZone
                ? 'bg-yellow-500 text-black'
                : 'bg-white/[0.07] text-white/30 hover:text-white/55 hover:bg-white/[0.1]'
              }
            `}
          >
            Safe Zone
          </button>
        </div>

        {/* Title position presets */}
        <div className="flex items-center gap-3">
          <span className="text-white/25 text-[10px] uppercase tracking-[0.12em] w-[4.5rem] shrink-0">
            Text pos
          </span>
          <div className="flex gap-1.5">
            {(['bottom', 'center', 'top'] as TitlePos[]).map(pos => (
              <button
                key={pos}
                onClick={() => setTitlePos(pos)}
                className={`
                  px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize
                  ${titlePos === pos
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.05] text-white/30 hover:text-white/55 hover:bg-white/[0.08]'
                  }
                `}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Overlay darkness slider */}
        <div className="flex items-center gap-3">
          <span className="text-white/25 text-[10px] uppercase tracking-[0.12em] w-[4.5rem] shrink-0">
            Darkness
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={overlayPct}
            onChange={e => setOverlayPct(Number(e.target.value))}
            className="flex-1 accent-[#9a442d]"
            style={{ height: '2px' }}
          />
          <span className="text-white/35 text-xs tabular-nums w-8 text-right shrink-0">
            {overlayPct}%
          </span>
        </div>

        {/* Hint */}
        <p className="text-white/15 text-[10px]">
          Tip: toggle CTA off to keep the card clean — or on to show abqunplugged.com
        </p>
      </div>
    </div>
  )
}
