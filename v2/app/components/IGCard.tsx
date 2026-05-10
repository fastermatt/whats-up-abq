'use client'

/**
 * IGCard — Instagram card design tool (v3).
 *
 * Three templates, each with separated photo + text zones:
 *   A. "Broadside"  — cream text panel above, photo below
 *   B. "Stub"       — dark text panel left, photo right (portrait/square) / dark top + photo bottom (story)
 *   C. "Dark Frame" — dark card, photo in a bounded inset, text on dark panels above/below
 *
 * Constraint: NO text overlaid on the event photo. Works for any image quality.
 *
 * Formats: 4:5 portrait, 9:16 story, 1:1 square
 * Fonts:   Epilogue 900 (default) | Inter (Grotesk option) | Inter 700
 * Export:  html-to-image → 1080px PNG download
 */

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import Link from 'next/link'
import { toBlob } from 'html-to-image'
import { Download, ChevronLeft, Loader2 } from 'lucide-react'
import type { NormalizedEvent } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'

// ─── Types ────────────────────────────────────────────────────────────────────

export type IGFormat   = 'square' | 'portrait' | 'story'
export type IGTemplate = 'broadside' | 'stub' | 'darkframe'
export type IGFont     = 'epilogue' | 'space-grotesk' | 'inter'

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMATS: { key: IGFormat; label: string; desc: string; ratio: string }[] = [
  { key: 'portrait', label: '4:5',  desc: 'Feed',    ratio: '4 / 5'  },
  { key: 'story',    label: '9:16', desc: 'Story',   ratio: '9 / 16' },
  { key: 'square',   label: '1:1',  desc: 'Square',  ratio: '1 / 1'  },
]

const TEMPLATES: { key: IGTemplate; label: string; desc: string }[] = [
  { key: 'broadside', label: 'Broadside', desc: 'Cream header, photo below'       },
  { key: 'stub',      label: 'Stub',      desc: 'Dark left panel, photo right'    },
  { key: 'darkframe', label: 'Frame',     desc: 'Dark card, photo in inset frame' },
]

const FONTS: { key: IGFont; label: string; css: string }[] = [
  { key: 'epilogue',      label: 'Epilogue',    css: 'var(--font-epilogue), Epilogue, Georgia, serif'     },
  { key: 'space-grotesk', label: 'Grotesk',     css: 'var(--font-inter), system-ui, sans-serif' },
  { key: 'inter',         label: 'Inter',       css: 'var(--font-inter), Inter, system-ui, sans-serif'   },
]

const OUTPUT_WIDTH: Record<IGFormat, number> = { square: 1080, portrait: 1080, story: 1080 }

// Brand palette
const CREAM  = '#fbf7f1'
const TERRA  = '#9a442d'
const INK    = '#1a1614'
const INK_MID = '#4a3f3a'
const SAND   = '#f0e4cc'

// Grain SVG as a tiling background (URL-encoded for inline use)
const GRAIN_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)' opacity='0.3'/%3E%3C/svg%3E")`

const CAT_EMOJI: Record<string, string> = {
  'Music': '🎵', 'Comedy': '😂', 'Sports': '🏟️', 'Arts & Theater': '🎭',
  'Food & Drink': '🍻', 'Family': '🎡', 'Film': '🎬', 'Outdoor': '🌄',
  'Festivals': '🎪', 'Community': '🌵',
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

function formatDateLong(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'long', day: 'numeric', timeZone: 'America/Denver',
    })
  } catch { return '' }
}

function formatMonthDay(iso: string): { month: string; day: string; weekday: string } {
  try {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso)
    return {
      month:   d.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/Denver' }).toUpperCase(),
      day:     d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Denver' }),
      weekday: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Denver' }).toUpperCase(),
    }
  } catch { return { month: '', day: '', weekday: '' } }
}

// ─── Title font sizing ────────────────────────────────────────────────────────

function titlePx(len: number, isStory: boolean): number {
  // Calibrated for story 47% panel (~284px), portrait 47% panel (~224px), ~340/380px card widths
  // Body ≈ panel - 44px safe zone - 20px padding - 28px header - 62px footer - 24px gaps = ~106px story
  // 3-line target for 38-60 chars: 26px × 3 = 78px (fits in ~78px body after price label)
  if (isStory) {
    if (len > 60) return 20
    if (len > 50) return 23
    if (len > 38) return 26  // "Free Sunday Mornings at Albuquerque Museum" → 26px, 3 lines
    if (len > 25) return 34
    if (len > 15) return 46
    return 56
  }
  // Portrait / square — slightly wider panel, no safe-zone eating
  if (len > 60) return 17
  if (len > 50) return 20
  if (len > 38) return 24
  if (len > 25) return 31
  if (len > 15) return 42
  return 52
}

/**
 * Letter spacing anchored to DESIGN.md display spec: -1.5px at 34-58px.
 * Pass the computed font-size in px for accurate mechanical tracking.
 */
function titleTracking(pxSize: number): string {
  if (pxSize >= 48) return '-2px'
  if (pxSize >= 34) return '-1.4px'
  if (pxSize >= 26) return '-1px'
  return '-0.6px'
}

/**
 * Auto-fits the title font size to fill available height without clipping.
 * Starts from the maximum possible size and steps down 1px at a time until
 * the title bottom sits within the container bottom.
 */
function useFitTitle(
  title: string,
  format: IGFormat,
  fontCss: string,
  titleWeight: number,
  titleItalic: boolean,
) {
  const isStory = format === 'story'
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef     = useRef<HTMLParagraphElement>(null)
  const maxPx = isStory ? 60 : 56
  const [fittedSize, setFittedSize] = useState(() => titlePx(title.length, isStory))

  useLayoutEffect(() => {
    const container = containerRef.current
    const el        = titleRef.current
    if (!container || !el) return
    let s = maxPx
    el.style.fontSize     = s + 'px'
    el.style.letterSpacing = titleTracking(s)
    void el.offsetHeight // force reflow
    while (s > 14) {
      const cRect = container.getBoundingClientRect()
      const tRect = el.getBoundingClientRect()
      if (tRect.bottom <= cRect.bottom + 1) break
      s -= 1
      el.style.fontSize      = s + 'px'
      el.style.letterSpacing = titleTracking(s)
    }
    setFittedSize(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, format, fontCss, titleWeight, titleItalic, maxPx])

  return { containerRef, titleRef, fittedSize }
}

/**
 * Returns the natural width/height ratio of an image src. Null while loading.
 * Used to size story photo insets so the image fits without cropping.
 */
function useImageRatio(src: string): number | null {
  const [ratio, setRatio] = useState<number | null>(null)
  useEffect(() => {
    if (!src) { setRatio(null); return }
    const img = new window.Image()
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
    }
    img.onerror = () => setRatio(null)
    img.src = src
  }, [src])
  return ratio
}

// 9:16 story: photo inset is 90% of card width.
// As a fraction of card height: 0.90 × (9/16) = 0.50625
// photo_height_pct = 50.625 / imgRatio
const STORY_PHOTO_W_FRAC = 0.90 * (9 / 16)

const INTER = 'var(--font-inter), Inter, system-ui, sans-serif'

// ─── Grain overlay ────────────────────────────────────────────────────────────

function GrainOverlay({ opacity = 0.55 }: { opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
        backgroundImage: GRAIN_BG,
        opacity,
        mixBlendMode: 'overlay',
      }}
    />
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo({ dark, size = 20 }: { dark?: boolean; size?: number }) {
  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={dark ? '/logo-white.svg' : '/logo-terra.svg'}
      alt="ABQ Unplugged"
      style={{ height: size, width: 'auto', display: 'block', flexShrink: 0 }}
    />
  )
}

// ─── Category badge — absolutely positioned just inside the safe zone ─────────

function CategoryBadge({
  category, emoji, format, showCategory,
}: {
  category: string | null
  emoji: string
  format: IGFormat
  showCategory: boolean
}) {
  if (!showCategory || !category) return null
  // Story: badge bleeds into top safe zone (3%); portrait: just inside 6% safe zone
  const topPct  = format === 'story' ? 3 : 6
  const sidePct = 5
  return (
    <div style={{
      position: 'absolute',
      top:  `calc(${topPct}% + 5px)`,
      left: `calc(${sidePct}% + 4px)`,
      zIndex: 20,
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: TERRA, color: '#fff',
      fontFamily: INTER, fontWeight: 600, fontSize: 7,
      letterSpacing: '0.18em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 100,
      pointerEvents: 'none',
    }}>
      {emoji}&nbsp;{category}
    </div>
  )
}

// ─── Safe zone indicator ──────────────────────────────────────────────────────

function SafeZone({ format }: { format: IGFormat }) {
  const topPct  = format === 'story' ? 13 : 6
  const botPct  = format === 'story' ? 13 : 6
  const sidePct = 5
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${topPct}%`,
        borderBottom: '2px dashed rgba(250,204,21,0.7)', background: 'rgba(250,204,21,0.06)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${botPct}%`,
        borderTop: '2px dashed rgba(250,204,21,0.7)', background: 'rgba(250,204,21,0.06)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${sidePct}%`,
        borderRight: '1px dashed rgba(250,204,21,0.35)', background: 'rgba(250,204,21,0.03)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${sidePct}%`,
        borderLeft: '1px dashed rgba(250,204,21,0.35)', background: 'rgba(250,204,21,0.03)' }} />
      <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.65)', color: 'rgba(250,204,21,0.9)', fontSize: 9, fontWeight: 700,
        letterSpacing: '0.15em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4 }}>
        safe zone
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE A — BROADSIDE
// Cream text panel top · photo panel bottom (or full dark story variant)
// ═══════════════════════════════════════════════════════════════════════════════

function TemplateBroadside({
  title, category, dateStr, timeStr, venue, price, imgSrc, format, fontCss, titleWeight, titleItalic,
  showLogo, showCategory, showDateTime, showVenue, showCTA, showSafeZone,
}: CardContentProps) {
  const isStory  = format === 'story'
  const isSquare = format === 'square'
  const dateParts = formatMonthDay(dateStr || '')
  const { containerRef, titleRef, fittedSize } = useFitTitle(title, format, fontCss, titleWeight, titleItalic)
  const imgRatio = useImageRatio(imgSrc)

  // Panel split (portrait/square only — story uses absolute layout below)
  const textPct  = isSquare ? 50 : 47
  const photoPct = 100 - textPct
  const emoji    = CAT_EMOJI[category ?? ''] ?? '📍'

  // ── STORY: photo full-width between text and date/venue sections ──
  if (isStory) {
    const splitPct = 46 // % where title section ends and photo begins
    // Full-width photo: width = 100% of card = (9/16) of card height
    const fullWFrac = 9 / 16
    const maxPhotoBotPct = 78  // leave at least 9% for date/venue above safe zone
    const photoH   = imgRatio ? Math.min((fullWFrac / imgRatio) * 100, maxPhotoBotPct - splitPct) : maxPhotoBotPct - splitPct
    const photoBot = splitPct + photoH
    const imgFit   = photoH < (maxPhotoBotPct - splitPct) ? 'contain' : 'cover'
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: CREAM, overflow: 'hidden' }}>

        {/* Logo + category — bleed into top safe zone at 3% */}
        <div style={{
          position: 'absolute', top: '3%', left: '2rem', right: '2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 5,
        }}>
          {showCategory && category ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: TERRA, color: '#fff',
              fontFamily: INTER, fontWeight: 600, fontSize: 7,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 100,
            }}>
              {emoji}&nbsp;{category}
            </div>
          ) : <div />}
          {showLogo && <Logo dark={false} size={33} />}
        </div>

        {/* Title section — 13% to split, anchors to top */}
        <div ref={containerRef} style={{
          position: 'absolute',
          top: '13%', bottom: `${100 - splitPct}%`,
          left: '2rem', right: '2rem',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {price && (
            <div style={{ color: price.toLowerCase().includes('free') ? '#4f6249' : TERRA, fontFamily: INTER, fontWeight: 700, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8, flexShrink: 0 }}>
              {price.toLowerCase().includes('free') ? '✓ Free' : price}
            </div>
          )}
          <p ref={titleRef} style={{ fontFamily: fontCss, fontWeight: titleWeight, fontStyle: titleItalic ? 'italic' : 'normal', fontSize: fittedSize, lineHeight: 1.05, letterSpacing: titleTracking(fittedSize), color: INK, margin: 0, flexShrink: 0 }}>
            {title}
          </p>
        </div>

        {/* Terra divider — full width at split */}
        <div style={{ position: 'absolute', top: `${splitPct}%`, left: 0, right: 0, height: 3, background: TERRA, zIndex: 5 }} />

        {/* Photo — full width, sized to image natural ratio */}
        <div style={{
          position: 'absolute',
          top: `calc(${splitPct}% + 3px)`,
          bottom: `${100 - photoBot}%`,
          left: 0, right: 0,
          overflow: 'hidden', zIndex: 2,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgSrc} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: imgFit, objectPosition: 'center' }} />
        </div>

        {/* Date + venue — below photo on cream, above safe zone */}
        {(showDateTime || showVenue) && (
          <div style={{
            position: 'absolute',
            top: `${photoBot + 1}%`,
            bottom: '13%',
            left: '2rem', right: '2rem',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3,
            zIndex: 3,
          }}>
            {showDateTime && dateParts.day && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: fontCss, fontWeight: 900, fontSize: 26, color: TERRA, lineHeight: 1 }}>{dateParts.day}</span>
                <span style={{ fontFamily: INTER, fontWeight: 600, fontSize: 13, color: INK_MID, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{dateParts.month}{timeStr ? ` · ${timeStr}` : ''}</span>
              </div>
            )}
            {showVenue && venue && (
              <p style={{ fontFamily: INTER, fontWeight: 500, fontSize: 12, color: INK_MID, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {venue}
              </p>
            )}
          </div>
        )}

        {/* URL in bottom safe zone */}
        {showCTA && (
          <div style={{ position: 'absolute', bottom: '3%', left: 0, right: 0, textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
            <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: 11, color: TERRA, letterSpacing: '0.08em' }}>abqunplugged.com</span>
          </div>
        )}

        <GrainOverlay opacity={0.5} />
        {showSafeZone && <SafeZone format={format} />}
      </div>
    )
  }

  // ── PORTRAIT / SQUARE: flex layout ───────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: CREAM, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── TEXT PANEL (top) ── */}
      <div style={{
        flex: `0 0 ${textPct}%`,
        background: CREAM,
        display: 'flex', flexDirection: 'column',
        padding: '1.5rem 1.75rem 1.25rem',
        position: 'relative', zIndex: 2,
        overflow: 'hidden',
      }}>
        {/* Header: category LEFT (small), logo RIGHT */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 }}>
          {showCategory && category ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: TERRA, color: '#fff',
              fontFamily: INTER, fontWeight: 600, fontSize: 7,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 100,
            }}>
              {emoji}&nbsp;{category}
            </div>
          ) : <div />}
          {showLogo && <Logo dark={false} size={27} />}
        </div>

        {/* Title body — containerRef bounds the fit-text measurement */}
        <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: '0.25rem' }}>
          <div style={{ flex: 1 }} />
          {price && (
            <div style={{ color: price.toLowerCase().includes('free') ? '#4f6249' : TERRA, fontFamily: INTER, fontWeight: 700, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, flexShrink: 0 }}>
              {price.toLowerCase().includes('free') ? '✓ Free' : price}
            </div>
          )}
          <p ref={titleRef} style={{ fontFamily: fontCss, fontWeight: titleWeight, fontStyle: titleItalic ? 'italic' : 'normal', fontSize: fittedSize, lineHeight: 1.05, letterSpacing: titleTracking(fittedSize), color: INK, margin: 0, flexShrink: 0, overflow: 'hidden' }}>
            {title}
          </p>
        </div>

        {/* Date / Venue strip */}
        <div style={{ flexShrink: 0, marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1.5px solid ${SAND}` }}>
          {showDateTime && dateParts.day && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
              <span style={{ fontFamily: fontCss, fontWeight: 900, fontSize: 20, color: TERRA, lineHeight: 1 }}>{dateParts.day}</span>
              <span style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 600, fontSize: 12, color: INK_MID, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{dateParts.month}{timeStr ? ` · ${timeStr}` : ''}</span>
            </div>
          )}
          {showVenue && venue && (
            <p style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 500, fontSize: 12, color: INK_MID, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {venue}
            </p>
          )}
          {showCTA && (
            <p style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 700, fontSize: 11, color: TERRA, letterSpacing: '0.08em', margin: '5px 0 0' }}>
              abqunplugged.com
            </p>
          )}
        </div>
      </div>

      {/* ── PHOTO PANEL (bottom) — full bleed cover ── */}
      <div style={{ flex: `0 0 ${photoPct}%`, position: 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      </div>

      {/* Terra thin divider line */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${textPct}%`, height: 3, background: TERRA, zIndex: 5 }} />

      <GrainOverlay opacity={0.5} />
      {showSafeZone && <SafeZone format={format} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE B — STUB
// Portrait/Square: dark left text panel, photo right panel
// Story: dark top text block, photo bottom block
// ═══════════════════════════════════════════════════════════════════════════════

function TemplateStub({
  title, category, dateStr, timeStr, venue, price, imgSrc, format, fontCss, titleWeight, titleItalic,
  showLogo, showCategory, showDateTime, showVenue, showCTA, showSafeZone,
}: CardContentProps) {
  const isStory  = format === 'story'
  const dateParts = formatMonthDay(dateStr || '')
  const emoji    = CAT_EMOJI[category ?? ''] ?? '📍'
  const { containerRef, titleRef, fittedSize } = useFitTitle(title, format, fontCss, titleWeight, titleItalic)
  const imgRatio = useImageRatio(imgSrc)

  if (isStory) {
    const splitPct = 44
    // Photo height sized to fit image naturally. Cap at 76% to leave room for date/venue below.
    const maxPhotoH = 76 - splitPct
    const photoH    = imgRatio ? Math.min((STORY_PHOTO_W_FRAC / imgRatio) * 100, maxPhotoH) : maxPhotoH
    const photoBot  = splitPct + photoH
    const imgFit    = photoH < maxPhotoH ? 'contain' : 'cover'
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: INK, overflow: 'hidden' }}>

        {/* Logo + category — bleed into top safe zone at 3% */}
        <div style={{
          position: 'absolute', top: '3%', left: '2rem', right: '2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 5,
        }}>
          {showCategory && category ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: TERRA, color: '#fff',
              fontFamily: INTER, fontWeight: 600, fontSize: 7,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 100,
            }}>
              {emoji}&nbsp;{category}
            </div>
          ) : <div />}
          {showLogo && <Logo dark size={28} />}
        </div>

        {/* Title — rides the 13% safe zone line */}
        <div ref={containerRef} style={{
          position: 'absolute',
          top: '13%', bottom: `${100 - splitPct}%`,
          left: '2rem', right: '2rem',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ flex: 1 }} />
          <p ref={titleRef} style={{
            fontFamily: fontCss, fontWeight: titleWeight, fontStyle: titleItalic ? 'italic' : 'normal',
            fontSize: fittedSize, lineHeight: 1.05,
            letterSpacing: titleTracking(fittedSize), color: CREAM,
            margin: 0, flexShrink: 0,
          }}>{title}</p>
        </div>

        {/* Terra divider at split */}
        <div style={{ position: 'absolute', top: `${splitPct}%`, left: 0, right: 0, height: 3, background: TERRA, zIndex: 5 }} />

        {/* Photo inset — sized to fit image naturally, no text overlay */}
        <div style={{
          position: 'absolute',
          top: `calc(${splitPct}% + 3px)`,
          bottom: `${100 - photoBot}%`,
          left: '5%', right: '5%',
          borderRadius: 8, overflow: 'hidden', zIndex: 2,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgSrc} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: imgFit, objectPosition: 'center' }} />
        </div>

        {/* Date + venue — below the photo, never overlaid */}
        {(showDateTime || showVenue) && (
          <div style={{
            position: 'absolute',
            top: `${photoBot + 1}%`,
            bottom: '13%',
            left: '2rem', right: '2rem',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, zIndex: 3,
          }}>
            {showDateTime && dateParts.day && (
              <p style={{ fontFamily: INTER, fontWeight: 700, fontSize: 13, color: CREAM, margin: 0, letterSpacing: '0.04em' }}>
                {dateParts.weekday} {dateParts.month} {dateParts.day}{timeStr ? ` · ${timeStr}` : ''}
              </p>
            )}
            {showVenue && venue && (
              <p style={{ fontFamily: INTER, fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {venue}
              </p>
            )}
          </div>
        )}

        {/* URL in bottom safe zone */}
        {showCTA && (
          <div style={{ position: 'absolute', bottom: '3%', left: 0, right: 0, textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
            <span style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 700, fontSize: 11, color: '#e8a898', letterSpacing: '0.08em' }}>abqunplugged.com</span>
          </div>
        )}

        <GrainOverlay opacity={0.5} />
        {showSafeZone && <SafeZone format={format} />}
      </div>
    )
  }

  // Portrait / Square: horizontal split — dark left 48%, photo right 52%
  const leftPct  = 48
  const rightPct = 100 - leftPct

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: INK, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>

      {/* Left: dark text panel */}
      <div style={{
        flex: `0 0 ${leftPct}%`, background: INK,
        display: 'flex', flexDirection: 'column',
        padding: '1.75rem 1.5rem 1.5rem',
        position: 'relative', zIndex: 2,
      }}>
        {/* Header: category LEFT (small), logo RIGHT */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 6 }}>
          {showCategory && category ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: TERRA, color: '#fff',
              fontFamily: INTER, fontWeight: 600, fontSize: 7,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 100,
            }}>
              {emoji}&nbsp;{category}
            </div>
          ) : <div />}
          {showLogo && <Logo dark size={27} />}
        </div>

        {/* Title — fills remaining space between header and meta */}
        <div ref={containerRef} style={{
          flex: 1, minHeight: 0, overflow: 'hidden',
          paddingTop: '0.75rem',
        }}>
          <p ref={titleRef} style={{
            fontFamily: fontCss, fontWeight: titleWeight, fontStyle: titleItalic ? 'italic' : 'normal',
            fontSize: fittedSize, lineHeight: 1.05,
            letterSpacing: titleTracking(fittedSize), color: CREAM,
            margin: 0, overflow: 'hidden',
          }}>{title}</p>
        </div>

        {/* Bottom meta — bigger for readability */}
        <div style={{ flexShrink: 0, paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          {showDateTime && dateParts.day && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 3 }}>
              <span style={{ fontFamily: fontCss, fontWeight: 900, fontSize: 20, color: TERRA, lineHeight: 1 }}>
                {dateParts.day}
              </span>
              <span style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 600,
                fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {dateParts.month}{timeStr ? ` · ${timeStr}` : ''}
              </span>
            </div>
          )}
          {showVenue && venue && (
            <p style={{ fontFamily: 'var(--font-inter), system-ui', fontSize: 11,
              color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 0 5px' }}>
              {venue}
            </p>
          )}
          {showCTA && (
            <p style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 700, fontSize: 10,
              color: '#e8a898', letterSpacing: '0.08em', margin: 0 }}>
              abqunplugged.com
            </p>
          )}
        </div>
      </div>

      {/* Terra divider */}
      <div style={{ flex: '0 0 3px', background: TERRA, zIndex: 5 }} />

      {/* Right: photo panel — full bleed cover */}
      <div style={{ flex: `0 0 calc(${rightPct}% - 3px)`, position: 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
      </div>

      <GrainOverlay opacity={0.5} />
      {showSafeZone && <SafeZone format={format} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE C — DARK FRAME
// Near-black card; photo sits in a defined rectangular inset.
// Text floats above and below on the dark surface.
// ═══════════════════════════════════════════════════════════════════════════════

function TemplateDarkFrame({
  title, category, dateStr, timeStr, venue, price, imgSrc, format, fontCss, titleWeight, titleItalic,
  showLogo, showCategory, showDateTime, showVenue, showCTA, showSafeZone,
}: CardContentProps) {
  const isStory  = format === 'story'
  const isSquare = format === 'square'
  const emoji    = CAT_EMOJI[category ?? ''] ?? '📍'
  const dateParts = formatMonthDay(dateStr || '')
  const { containerRef, titleRef, fittedSize } = useFitTitle(title, format, fontCss, titleWeight, titleItalic)
  // Photo inset slot — fixed dimensions, objectFit: contain shows full image.
  // "Bars" (if any) are invisible — they're INK colour on an INK card.
  const photoTop    = isStory ? 38 : isSquare ? 34 : 40
  const photoHeight = isStory ? 34 : isSquare ? 41 : 37
  const maxPhotoW   = 86  // % of card width (7% gap each side)
  const photoLeft   = (100 - maxPhotoW) / 2

  // Story: logo/badge bleed into top safe zone (3%); portrait: normal margin
  const topContentStart = isStory ? '3%' : '1.5rem'

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: INK, overflow: 'hidden' }}>

      {/* ── Logo RIGHT — category is now an absolute badge ── */}
      <div style={{
        position: 'absolute', top: topContentStart, left: 0, right: 0,
        padding: '0 1.75rem',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        zIndex: 3,
      }}>
        {showLogo && <Logo dark size={isStory ? 33 : 27} />}
      </div>

      {/* ── Title (above photo) — anchors to top so useFitTitle detects bottom overflow ── */}
      <div ref={containerRef} style={{
        position: 'absolute', left: '1.75rem', right: '1.75rem',
        top: isStory ? '14%' : '3.5rem',
        bottom: `${100 - photoTop + 1}%`, // hard boundary at photo top
        overflow: 'hidden',
        zIndex: 3, display: 'flex', flexDirection: 'column',
      }}>
        {price && (
          <div style={{
            color: price.toLowerCase().includes('free') ? '#4f6249' : '#e8a898',
            fontFamily: INTER, fontWeight: 700,
            fontSize: isStory ? 11 : 9, letterSpacing: '0.2em', textTransform: 'uppercase',
            marginBottom: 8, flexShrink: 0,
          }}>
            {price.toLowerCase().includes('free') ? '✓ Free' : price}
          </div>
        )}
        <p ref={titleRef} style={{
          fontFamily: fontCss, fontWeight: titleWeight, fontStyle: titleItalic ? 'italic' : 'normal',
          fontSize: fittedSize, lineHeight: 1.05,
          letterSpacing: titleTracking(fittedSize), color: CREAM,
          margin: 0, flexShrink: 0,
        }}>
          {title}
        </p>
      </div>

      {/* ── Photo inset — full slot, contain so full image shows; bars invisible on dark card ── */}
      <div style={{
        position: 'absolute',
        top: `${photoTop}%`,
        height: `${photoHeight}%`,
        left: `${photoLeft}%`,
        width: `${maxPhotoW}%`,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        zIndex: 2,
        border: `2px solid rgba(255,255,255,0.07)`,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc} alt="" crossOrigin="anonymous" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} />
      </div>

      {/* ── Date + venue (below photo) — URL moved to bottom safe zone ── */}
      <div style={{
        position: 'absolute',
        top: `${photoTop + photoHeight + 2}%`,  // slot bottom, not display bottom
        bottom: isStory ? '13%' : '1.5rem',
        left: '1.75rem', right: '1.75rem',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        gap: 6, zIndex: 3, overflow: 'visible',
      }}>
        {/* Terra rule */}
        <div style={{ width: isStory ? 56 : 40, height: 2.5, background: TERRA, borderRadius: 2 }} />

        {showDateTime && dateParts.day && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: fontCss, fontWeight: 900,
              fontSize: isStory ? 26 : 22, color: CREAM, lineHeight: 1 }}>
              {dateParts.day}
            </span>
            <span style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 600,
              fontSize: isStory ? 13 : 12, color: 'rgba(255,255,255,0.55)',
              letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {dateParts.weekday} {dateParts.month}{timeStr ? ` · ${timeStr}` : ''}
            </span>
          </div>
        )}
        {showVenue && venue && (
          <p style={{ fontFamily: 'var(--font-inter), system-ui', fontSize: isStory ? 13 : 12,
            color: 'rgba(255,255,255,0.40)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
            {venue}
          </p>
        )}
        {/* Portrait only — story URL is pinned to bottom safe zone */}
        {!isStory && showCTA && (
          <p style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 700,
            fontSize: 9, color: '#e8a898', letterSpacing: '0.08em', margin: 0 }}>
            abqunplugged.com
          </p>
        )}
      </div>

      {/* Story: URL pinned inside bottom safe zone */}
      {isStory && showCTA && (
        <div style={{
          position: 'absolute', bottom: '3%', left: 0, right: 0,
          textAlign: 'center', zIndex: 10, pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: 'var(--font-inter), system-ui', fontWeight: 700,
            fontSize: 11, color: '#e8a898', letterSpacing: '0.08em',
          }}>abqunplugged.com</span>
        </div>
      )}

      {/* Category badge — absolute, bleeds into top safe zone (story) */}
      <CategoryBadge category={category} emoji={emoji} format={format} showCategory={showCategory} />
      <GrainOverlay opacity={0.45} />
      {showSafeZone && <SafeZone format={format} />}
    </div>
  )
}

// ─── Shared props type ────────────────────────────────────────────────────────

interface CardContentProps {
  title:        string
  category:     string | null
  dateStr:      string
  timeStr:      string
  venue:        string
  price:        string | null
  imgSrc:       string
  format:       IGFormat
  fontCss:      string
  titleWeight:  number
  titleItalic:  boolean
  showLogo:     boolean
  showCategory: boolean
  showDateTime: boolean
  showVenue:    boolean
  showCTA:      boolean
  showSafeZone: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
  event: NormalizedEvent
  image: string
  initialFormat?:   IGFormat
  initialTemplate?: IGTemplate
  embedded?:        boolean
}

export function IGCardClient({
  event,
  image,
  initialFormat   = 'portrait',
  initialTemplate = 'broadside',
  embedded        = false,
}: Props) {
  const [format,       setFormat]       = useState<IGFormat>(initialFormat)
  const [template,     setTemplate]     = useState<IGTemplate>(initialTemplate)
  const [fontKey,      setFontKey]      = useState<IGFont>('epilogue')
  const [titleWeight,  setTitleWeight]  = useState<number>(900)
  const [titleItalic,  setTitleItalic]  = useState<boolean>(false)
  const [showLogo,     setShowLogo]     = useState(true)
  const [showCategory, setShowCategory] = useState(true)
  const [showDateTime, setShowDateTime] = useState(true)
  const [showVenue,    setShowVenue]    = useState(true)
  const [showCTA,      setShowCTA]      = useState(true)
  const [showSafeZone, setShowSafeZone] = useState(false)
  const [downloading,  setDownloading]  = useState(false)
  const [imgSrc,       setImgSrc]       = useState(image)
  const [imageLoaded,  setImageLoaded]  = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const imgRef  = useRef<HTMLImageElement>(null)

  const categoryFallback = getCategoryFallback(event.category ?? undefined, event.id)
  useEffect(() => { setImgSrc(image); setImageLoaded(false) }, [image])

  const proxiedSrc = imgSrc.startsWith('http')
    ? `/api/image-proxy?url=${encodeURIComponent(imgSrc)}`
    : imgSrc

  // Catch cached image already loaded before React attached listener
  useEffect(() => {
    const el = imgRef.current
    if (el?.complete && el.naturalWidth > 0) setImageLoaded(true)
  }, [proxiedSrc])

  const isStory   = format === 'story'
  const isPortrait = format === 'portrait'
  const fmt       = FORMATS.find(f => f.key === format)!
  const font      = FONTS.find(f => f.key === fontKey)!
  const dateStr   = event.date ? (event.date) : ''
  const timeStr   = event.time ?? ''
  const category  = event.category ?? null
  const venue     = event.venue ?? ''

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (!cardRef.current || downloading) return
    setDownloading(true)
    try {
      const node = cardRef.current
      // Wait for every <img> inside the card to fully decode before capture.
      // Without this, mobile Safari starts toBlob mid-stream and the photo
      // panel comes back empty (the bug Matt screenshotted 2026-05-10 —
      // text + chrome captured fine, photo area blank). decode() resolves
      // when the image is decoded into pixel data ready to draw to canvas.
      const imgs = Array.from(node.querySelectorAll('img'))
      await Promise.all(
        imgs.map(img =>
          (img.complete && img.naturalWidth > 0)
            ? img.decode().catch(() => undefined)
            : new Promise<void>(resolve => {
                const done = () => resolve()
                img.addEventListener('load', done, { once: true })
                img.addEventListener('error', done, { once: true })
                // Hard cap so a stuck image doesn't lock the download forever
                setTimeout(done, 4000)
              }).then(() => img.decode().catch(() => undefined))
        )
      )
      const naturalRatio = OUTPUT_WIDTH[format] / node.offsetWidth
      const pixelRatio = Math.min(naturalRatio, 3)
      const blob = await toBlob(node, { pixelRatio, cacheBust: false })
      if (!blob) throw new Error('toBlob returned null')
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
      a.download = `abq-${slug}-${template}-${format}.png`
      a.href = objectUrl
      a.click()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
    } catch (err) {
      console.error('[IGCard] download failed:', err)
      alert('Download failed — try screenshotting the card instead.')
    } finally {
      setDownloading(false)
    }
  }, [cardRef, format, template, event.title, downloading])

  // ── Admin reject ─────────────────────────────────────────────────────────

  const [rejecting, setRejecting] = useState(false)
  const [rejected,  setRejected]  = useState(false)

  const handleReject = async () => {
    if (rejecting || rejected) return
    if (!confirm('Reject this image? The event will use a category fallback until you upload a replacement.')) return
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
  }

  // ── Shared card content props ─────────────────────────────────────────────

  const contentProps: CardContentProps = {
    title:        event.title,
    category,
    dateStr,
    timeStr,
    venue,
    price:        event.price ?? null,
    imgSrc:       proxiedSrc,
    format,
    fontCss:      font.css,
    titleWeight,
    titleItalic,
    showLogo,
    showCategory,
    showDateTime,
    showVenue,
    showCTA,
    showSafeZone,
  }

  // ── Hidden preload image (for imageLoaded tracking) ───────────────────────

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col select-none ${embedded ? '' : 'min-h-screen bg-[#0d0d0d]'}`}
      style={{ fontFamily: 'var(--font-epilogue, Epilogue, sans-serif)' }}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.07] shrink-0 flex-wrap">

        {/* Back link */}
        {!embedded && (
          <Link href={`/events/${event.id}`}
            className="flex items-center gap-1 text-white/35 hover:text-white/65 text-sm transition-colors shrink-0">
            <ChevronLeft size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Back</span>
          </Link>
        )}

        {/* Format switcher */}
        <div className="flex items-center gap-0.5 bg-white/[0.06] rounded-xl p-1">
          {FORMATS.map(f => (
            <button key={f.key} onClick={() => setFormat(f.key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
                format === f.key ? 'bg-[#9a442d] text-white shadow-sm' : 'text-white/35 hover:text-white/65 hover:bg-white/[0.04]'
              }`}>
              {f.label}
              <span className={`hidden sm:inline ml-1 text-[10px] font-normal ${format === f.key ? 'opacity-75' : 'opacity-50'}`}>
                {f.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Admin reject */}
        {embedded && (
          <button onClick={handleReject} disabled={rejecting || rejected}
            title={rejected ? 'Rejected' : 'Mark wrong image'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              rejected
                ? 'bg-green-600/20 text-green-300 border border-green-600/30 cursor-not-allowed'
                : 'bg-red-600/15 text-red-300 hover:bg-red-600/25 border border-red-600/25 active:scale-95'
            }`}>
            {rejecting ? <Loader2 size={14} className="animate-spin" /> : <span className="text-base leading-none">{rejected ? '✓' : '🚫'}</span>}
            <span className="hidden sm:inline">{rejected ? 'Rejected' : 'Wrong image?'}</span>
          </button>
        )}

        {/* Download */}
        <button onClick={handleDownload} disabled={downloading || !imageLoaded}
          title={!imageLoaded ? 'Waiting for image…' : undefined}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-[#9a442d] text-white text-sm font-semibold hover:bg-[#b5502f] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
          {downloading ? <Loader2 size={15} className="animate-spin" />
            : !imageLoaded ? <Loader2 size={15} className="animate-spin opacity-60" />
            : <Download size={15} />}
          <span className="hidden sm:inline">
            {downloading ? 'Generating…' : !imageLoaded ? 'Loading…' : 'Download PNG'}
          </span>
        </button>
      </div>

      {/* ── Card preview ── */}
      <div className={embedded
        ? 'flex items-center justify-center p-4'
        : 'flex-1 flex items-center justify-center p-5 sm:p-8 overflow-auto'
      }>
        {/* Hidden image to track load state. crossOrigin must match the
            visible img's setting — otherwise the browser can fetch the
            same URL twice (once tainted, once not). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={proxiedSrc} alt="" crossOrigin="anonymous" className="absolute opacity-0 pointer-events-none w-0 h-0"
          onLoad={() => setImageLoaded(true)}
          onError={() => { if (imgSrc !== categoryFallback) { setImgSrc(categoryFallback); setImageLoaded(false) } }} />

        <div
          ref={cardRef}
          id="ig-card"
          className="relative overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.7)] shrink-0"
          style={{
            aspectRatio: fmt.ratio,
            borderRadius: '2px',
            width: isStory
              ? 'min(65vw, 340px)'
              : isPortrait
              ? 'min(82vw, 380px)'
              : 'min(88vw, 460px)',
            height: 'auto',
          }}
        >
          {template === 'broadside' && <TemplateBroadside {...contentProps} />}
          {template === 'stub'      && <TemplateStub      {...contentProps} />}
          {template === 'darkframe' && <TemplateDarkFrame  {...contentProps} />}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="border-t border-white/[0.07] px-4 py-4 space-y-4 shrink-0">

        {/* Template picker */}
        <div className="space-y-1.5">
          <p className="text-white/20 text-[10px] uppercase tracking-[0.18em]">Template</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map(t => (
              <button key={t.key} onClick={() => setTemplate(t.key)}
                className={`flex flex-col items-start px-3 py-2 rounded-xl text-xs transition-all ${
                  template === t.key
                    ? 'bg-[#9a442d] text-white'
                    : 'bg-white/[0.06] text-white/35 hover:text-white/65 hover:bg-white/[0.1]'
                }`}>
                <span className="font-bold">{t.label}</span>
                <span className={`text-[9px] ${template === t.key ? 'text-white/70' : 'text-white/20'}`}>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font picker */}
        <div className="space-y-1.5">
          <p className="text-white/20 text-[10px] uppercase tracking-[0.18em]">Font</p>
          <div className="flex gap-1.5">
            {FONTS.map(f => (
              <button key={f.key} onClick={() => setFontKey(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  fontKey === f.key ? 'bg-white/20 text-white' : 'bg-white/[0.05] text-white/30 hover:text-white/55 hover:bg-white/[0.08]'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          {/* Weight + italic */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex gap-1">
              {([{ w: 900, label: 'Black' }, { w: 700, label: 'Bold' }, { w: 400, label: 'Light' }] as { w: number; label: string }[]).map(({ w, label }) => (
                <button key={w} onClick={() => setTitleWeight(w)}
                  className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${
                    titleWeight === w ? 'bg-white/20 text-white' : 'bg-white/[0.05] text-white/30 hover:text-white/55 hover:bg-white/[0.08]'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setTitleItalic(v => !v)}
              className={`px-2.5 py-1 rounded-md text-[11px] italic transition-all ${
                titleItalic ? 'bg-white/20 text-white' : 'bg-white/[0.05] text-white/30 hover:text-white/55 hover:bg-white/[0.08]'
              }`}>
              Italic
            </button>
          </div>
        </div>

        {/* Toggle chips */}
        <div className="space-y-1.5">
          <p className="text-white/20 text-[10px] uppercase tracking-[0.18em]">Show / hide</p>
          <div className="flex flex-wrap gap-2">
            {([
              { label: 'Logo',       val: showLogo,     set: setShowLogo     },
              { label: 'Category',   val: showCategory, set: setShowCategory },
              { label: 'Date & Time',val: showDateTime, set: setShowDateTime },
              { label: 'Venue',      val: showVenue,    set: setShowVenue    },
              { label: 'CTA URL',    val: showCTA,      set: setShowCTA      },
            ] as { label: string; val: boolean; set: (v: boolean) => void }[]).map(({ label, val, set }) => (
              <button key={label} onClick={() => set(!val)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  val ? 'bg-[#9a442d] text-white' : 'bg-white/[0.07] text-white/30 hover:text-white/55 hover:bg-white/[0.1]'
                }`}>
                {label}
              </button>
            ))}
            <button onClick={() => setShowSafeZone(v => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                showSafeZone ? 'bg-yellow-500 text-black' : 'bg-white/[0.07] text-white/30 hover:text-white/55 hover:bg-white/[0.1]'
              }`}>
              Safe Zone
            </button>
          </div>
        </div>

        <p className="text-white/15 text-[10px]">
          Safe Zone shows Instagram&apos;s content boundaries
        </p>
      </div>
    </div>
  )
}
