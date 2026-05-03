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
 * Fonts:   Epilogue 900 (default) | Space Grotesk 700 | Inter 700
 * Export:  html-to-image → 1080px PNG download
 */

import { useState, useRef, useCallback, useEffect } from 'react'
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
  { key: 'space-grotesk', label: 'Grotesk',     css: 'var(--font-space-grotesk), "Space Grotesk", system-ui, sans-serif' },
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
  title, category, dateStr, timeStr, venue, price, imgSrc, format, fontCss, showLogo,
  showCategory, showDateTime, showVenue, showCTA, showSafeZone,
}: CardContentProps) {
  const isStory = format === 'story'
  const isSquare = format === 'square'
  const dateParts = formatMonthDay(dateStr || '')

  // Panel split — how much goes to text vs photo
  // Story needs 47% because 13% safe-zone padding (CSS % = card width) consumes ~44px of the 254px panel
  const textPct  = isStory ? 47 : isSquare ? 50 : 47
  const photoPct = 100 - textPct

  const pxText = titlePx(title.length, isStory)
  const emoji  = CAT_EMOJI[category ?? ''] ?? '📍'

  // Story safe-zone paddings
  const topSafe = isStory ? '13%' : '1.25rem'
  const botSafe = isStory ? '13%' : '1.25rem'

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: CREAM, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── TEXT PANEL (top) ── */}
      <div style={{
        flex: `0 0 ${textPct}%`,
        background: CREAM,
        display: 'flex', flexDirection: 'column',
        padding: isStory ? `${topSafe} 2rem 1.25rem` : '1.5rem 1.75rem 1.25rem',
        position: 'relative',
        zIndex: 2,
        overflow: 'hidden', // prevents content from bleeding past panel & crossing the terra line
      }}>
        {/* Logo + category — pinned to top, never shrinks */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          {showLogo && <Logo dark={false} size={isStory ? 22 : 18} />}
          {showCategory && category && (
            <div style={{
              background: TERRA, color: '#fff',
              fontFamily: INTER, fontWeight: 600, fontSize: isStory ? 10 : 8,
              letterSpacing: '0.20em', textTransform: 'uppercase',
              padding: isStory ? '5px 13px' : '4px 10px', borderRadius: 100,
            }}>
              {emoji} {category}
            </div>
          )}
        </div>

        {/* Title body — grows to fill space; spacer pushes price+title toward footer */}
        <div style={{
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          paddingTop: '0.25rem',
        }}>
          {/* Spacer: absorbs leftover space, anchoring title block near the footer */}
          <div style={{ flex: 1 }} />

          {price && (
            <div style={{
              color: price.toLowerCase().includes('free') ? '#4f6249' : TERRA,
              fontFamily: INTER, fontWeight: 700, fontSize: isStory ? 11 : 9,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              marginBottom: isStory ? 8 : 6, flexShrink: 0,
            }}>
              {price.toLowerCase().includes('free') ? '✓ Free' : price}
            </div>
          )}
          <p style={{
            fontFamily: fontCss, fontWeight: 900,
            fontSize: pxText, lineHeight: 1.05,
            letterSpacing: titleTracking(pxText),
            color: INK,
            margin: 0, flexShrink: 0,
            display: '-webkit-box',
            WebkitLineClamp: isStory ? 5 : 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {title}
          </p>
        </div>

        {/* Date / Venue strip — pinned to bottom, never shrinks */}
        <div style={{ flexShrink: 0, marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1.5px solid ${SAND}` }}>
          {showDateTime && dateParts.day && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
              <span style={{
                fontFamily: fontCss, fontWeight: 900,
                fontSize: isStory ? 22 : 18, color: TERRA, lineHeight: 1,
              }}>{dateParts.day}</span>
              <span style={{
                fontFamily: 'var(--font-inter), system-ui', fontWeight: 600,
                fontSize: isStory ? 12 : 10, color: INK_MID, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>{dateParts.month}{timeStr ? ` · ${timeStr}` : ''}</span>
            </div>
          )}
          {showVenue && venue && (
            <p style={{
              fontFamily: 'var(--font-inter), system-ui', fontWeight: 500,
              fontSize: isStory ? 12 : 10, color: INK_MID,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              margin: 0,
            }}>
              {venue}
            </p>
          )}
          {showCTA && (
            <p style={{
              fontFamily: 'var(--font-inter), system-ui', fontWeight: 700,
              fontSize: isStory ? 11 : 9, color: TERRA, letterSpacing: '0.08em',
              marginTop: 4, marginBottom: 0,
            }}>
              abqunplugged.com
            </p>
          )}
        </div>
      </div>

      {/* ── PHOTO PANEL (bottom) ── */}
      <div style={{ flex: `0 0 ${photoPct}%`, position: 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }}
        />
        {/* Subtle vignette at top to merge with cream panel */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to bottom, ${CREAM} 0%, transparent 14%)`,
          pointerEvents: 'none',
        }} />
        {/* Story: bottom safe zone bump */}
        {isStory && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '14%', background: `linear-gradient(to top, rgba(0,0,0,0.55), transparent)`,
          }} />
        )}
      </div>

      {/* Terra thin divider line */}
      <div style={{
        position: 'absolute', left: 0, right: 0,
        top: `${textPct}%`, height: 3,
        background: TERRA, zIndex: 5,
      }} />

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
  title, category, dateStr, timeStr, venue, price, imgSrc, format, fontCss, showLogo,
  showCategory, showDateTime, showVenue, showCTA, showSafeZone,
}: CardContentProps) {
  const isStory = format === 'story'
  const dateParts = formatMonthDay(dateStr || '')
  const pxText = titlePx(title.length, isStory)
  const emoji  = CAT_EMOJI[category ?? ''] ?? '📍'

  if (isStory) {
    // Story: vertical split — dark top 42%, photo bottom 58%
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: INK, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Text panel */}
        <div style={{
          flex: '0 0 40%',
          background: INK,
          padding: '13% 2rem 1.5rem',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          position: 'relative', zIndex: 2,
        }}>
          {showLogo && (
            <div style={{ position: 'absolute', top: '13%', left: '2rem' }}>
              <Logo dark size={20} />
            </div>
          )}
          {showCategory && category && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: TERRA, color: '#fff',
              fontFamily: INTER, fontWeight: 600, fontSize: 9,
              letterSpacing: '0.20em', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: 100, marginBottom: 10, alignSelf: 'flex-start',
            }}>
              {emoji} {category}
            </div>
          )}
          <p style={{
            fontFamily: fontCss, fontWeight: 900,
            fontSize: pxText, lineHeight: 1.05,
            letterSpacing: titleTracking(pxText), color: CREAM,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{title}</p>
        </div>

        {/* Divider */}
        <div style={{ flex: '0 0 3px', background: TERRA, zIndex: 5 }} />

        {/* Photo panel */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* Bottom meta overlay (venue/date on dark strip at bottom) */}
          {(showDateTime || showVenue || showCTA) && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.60) 40%, transparent 100%)',
              padding: '3rem 2rem 13%',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              {showDateTime && dateParts.day && (
                <p style={{ fontFamily: INTER, fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.9)', margin: 0, letterSpacing: '0.04em' }}>
                  {dateParts.weekday} {dateParts.month} {dateParts.day}{timeStr ? ` · ${timeStr}` : ''}
                </p>
              )}
              {showVenue && venue && (
                <p style={{ fontFamily: 'var(--font-inter), system-ui', fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {venue}
                </p>
              )}
              {showCTA && (
                <p style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 700, fontSize: 10,
                  color: '#e8a898', letterSpacing: '0.08em', marginTop: 2 }}>
                  abqunplugged.com
                </p>
              )}
            </div>
          )}
        </div>

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
        flex: `0 0 ${leftPct}%`,
        background: INK,
        display: 'flex', flexDirection: 'column',
        padding: '1.75rem 1.5rem 1.5rem',
        position: 'relative', zIndex: 2,
      }}>
        {showLogo && <Logo dark size={18} />}
        {showCategory && category && (
          <div style={{
            display: 'inline-flex', marginTop: '1.25rem',
            background: TERRA, color: '#fff',
            fontFamily: INTER, fontWeight: 600, fontSize: 8,
            letterSpacing: '0.20em', textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: 100, alignSelf: 'flex-start',
          }}>
            {emoji} {category}
          </div>
        )}

        {/* Big title */}
        <p style={{
          fontFamily: fontCss, fontWeight: 900,
          fontSize: pxText, lineHeight: 1.05,
          letterSpacing: '-0.02em', color: CREAM,
          marginTop: showCategory ? '0.75rem' : '1.25rem',
          display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          flexGrow: 1,
        }}>{title}</p>

        {/* Bottom meta */}
        <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          {showDateTime && dateParts.day && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 3 }}>
              <span style={{ fontFamily: fontCss, fontWeight: 900, fontSize: 18, color: TERRA, lineHeight: 1 }}>
                {dateParts.day}
              </span>
              <span style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 600,
                fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {dateParts.month}{timeStr ? ` · ${timeStr}` : ''}
              </span>
            </div>
          )}
          {showVenue && venue && (
            <p style={{ fontFamily: 'var(--font-inter), system-ui', fontSize: 9,
              color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {venue}
            </p>
          )}
          {showCTA && (
            <p style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 700, fontSize: 8,
              color: '#e8a898', letterSpacing: '0.08em', marginTop: 4 }}>
              abqunplugged.com
            </p>
          )}
        </div>
      </div>

      {/* Terra divider */}
      <div style={{ flex: '0 0 3px', background: TERRA, zIndex: 5 }} />

      {/* Right: photo panel */}
      <div style={{ flex: `0 0 calc(${rightPct}% - 3px)`, position: 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
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
  title, category, dateStr, timeStr, venue, price, imgSrc, format, fontCss, showLogo,
  showCategory, showDateTime, showVenue, showCTA, showSafeZone,
}: CardContentProps) {
  const isStory  = format === 'story'
  const isSquare = format === 'square'
  const pxText   = titlePx(title.length, isStory)
  const emoji    = CAT_EMOJI[category ?? ''] ?? '📍'
  const dateParts = formatMonthDay(dateStr || '')

  // Photo inset dimensions (% of card)
  const photoTop    = isStory ? 38 : isSquare ? 34 : 40
  const photoHeight = isStory ? 34 : isSquare ? 38 : 35
  const photoSideGap = 7 // % from each side

  // Adjust story to respect safe zones
  const topContentStart = isStory ? '14%' : '1.5rem'

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: INK, overflow: 'hidden' }}>

      {/* ── Logo + category ── */}
      <div style={{
        position: 'absolute', top: topContentStart, left: 0, right: 0,
        padding: '0 1.75rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 3,
      }}>
        {showLogo && <Logo dark size={isStory ? 22 : 18} />}
        {showCategory && category && (
          <div style={{
            background: TERRA, color: '#fff',
            fontFamily: INTER, fontWeight: 600, fontSize: isStory ? 10 : 8,
            letterSpacing: '0.20em', textTransform: 'uppercase',
            padding: isStory ? '5px 14px' : '4px 11px', borderRadius: 100,
          }}>
            {emoji} {category}
          </div>
        )}
      </div>

      {/* ── Title (above photo) ── */}
      <div style={{
        position: 'absolute', left: '1.75rem', right: '1.75rem',
        top: isStory ? `calc(14% + ${isStory ? 2.5 : 2}rem)` : '3.5rem',
        zIndex: 3,
      }}>
        {price && (
          <div style={{
            color: price.toLowerCase().includes('free') ? '#4f6249' : '#e8a898',
            fontFamily: INTER, fontWeight: 700,
            fontSize: isStory ? 11 : 9, letterSpacing: '0.2em', textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            {price.toLowerCase().includes('free') ? '✓ Free' : price}
          </div>
        )}
        <p style={{
          fontFamily: fontCss, fontWeight: 900,
          fontSize: pxText, lineHeight: 1.05,
          letterSpacing: titleTracking(pxText), color: CREAM,
          display: '-webkit-box',
          WebkitLineClamp: isStory ? 3 : 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {title}
        </p>
      </div>

      {/* ── Photo inset ── */}
      <div style={{
        position: 'absolute',
        top: `${photoTop}%`,
        height: `${photoHeight}%`,
        left: `${photoSideGap}%`,
        right: `${photoSideGap}%`,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
        zIndex: 2,
        border: `2px solid rgba(255,255,255,0.07)`,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {/* ── Date + venue (below photo) ── */}
      <div style={{
        position: 'absolute',
        top: `${photoTop + photoHeight + 2}%`,
        bottom: isStory ? '14%' : '1.5rem',
        left: '1.75rem', right: '1.75rem',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        gap: 4, zIndex: 3,
      }}>
        {/* Terra rule */}
        <div style={{ width: 32, height: 2.5, background: TERRA, borderRadius: 2, marginBottom: 4 }} />

        {showDateTime && dateParts.day && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: fontCss, fontWeight: 900,
              fontSize: isStory ? 26 : 20, color: CREAM, lineHeight: 1 }}>
              {dateParts.day}
            </span>
            <span style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 600,
              fontSize: isStory ? 12 : 10, color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {dateParts.weekday} {dateParts.month}{timeStr ? ` · ${timeStr}` : ''}
            </span>
          </div>
        )}
        {showVenue && venue && (
          <p style={{ fontFamily: 'var(--font-inter), system-ui', fontSize: isStory ? 13 : 10,
            color: 'rgba(255,255,255,0.35)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
            {venue}
          </p>
        )}
        {showCTA && (
          <p style={{ fontFamily: 'var(--font-inter), system-ui', fontWeight: 700,
            fontSize: isStory ? 12 : 9, color: '#e8a898', letterSpacing: '0.08em', marginTop: 2 }}>
            abqunplugged.com
          </p>
        )}
      </div>

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
  const [showLogo,     setShowLogo]     = useState(true)
  const [showCategory, setShowCategory] = useState(true)
  const [showDateTime, setShowDateTime] = useState(true)
  const [showVenue,    setShowVenue]    = useState(true)
  const [showCTA,      setShowCTA]      = useState(false)
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
        {/* Hidden image to track load state */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={proxiedSrc} alt="" className="absolute opacity-0 pointer-events-none w-0 h-0"
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
          Toggle CTA off for cleaner cards · Safe Zone shows Instagram&apos;s content boundaries
        </p>
      </div>
    </div>
  )
}
