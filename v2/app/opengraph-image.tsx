/**
 * Root OG image — auto-discovered by Next.js for the homepage and all routes
 * that don't have their own opengraph-image.tsx.
 *
 * Outputs PNG via ImageResponse (Satori). PNG has universal support across
 * iMessage, Facebook, Twitter/X, Slack, Discord, and WhatsApp.
 *
 * Design reflects the current site: cream/terra/dark brand palette, full event
 * breadth (music, comedy, arts, food, family, free, neighborhoods, and more).
 */

import { ImageResponse } from 'next/og'
import { COLORS } from '@/lib/colors'

export const runtime     = 'edge'
export const alt         = 'ABQ Unplugged — Things to do in Albuquerque, NM'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ── Brand tokens (from the single source in lib/colors.ts) ────────────────────
const TERRA   = COLORS.terra
const CREAM   = COLORS.cream
const DARK    = COLORS.ink
const SAGE    = COLORS.sage
const MUTED   = 'rgba(251,247,241,0.55)'
const PILL_BG = 'rgba(154,68,45,0.14)'
const PILL_BD = 'rgba(154,68,45,0.28)'
const PILL_TX = 'rgba(228,170,152,0.9)'

// Hero image — right-side visual zone
const BG_IMAGE = 'https://abqunplugged.com/hero/hero-4.png'

// ── Font loader ───────────────────────────────────────────────────────────────
async function loadEpilogueFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Epilogue:wght@900&display=swap',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      }
    ).then(r => r.text())
    const match = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/)
    if (!match) return null
    return fetch(match[1]).then(r => r.arrayBuffer())
  } catch {
    return null
  }
}

// ── Chip component ────────────────────────────────────────────────────────────
function Chip({ label }: { label: string }) {
  return (
    <div
      style={{
        display:       'flex',
        padding:       '5px 13px',
        background:    PILL_BG,
        borderRadius:  999,
        border:        `1px solid ${PILL_BD}`,
        color:         PILL_TX,
        fontSize:      13,
        fontWeight:    600,
        letterSpacing: '0.03em',
        fontFamily:    'sans-serif',
        whiteSpace:    'nowrap',
      }}
    >
      {label}
    </div>
  )
}

// ── OG image ─────────────────────────────────────────────────────────────────
export default async function OG() {
  const fontData = await loadEpilogueFont()

  const options = {
    ...size,
    ...(fontData
      ? { fonts: [{ name: 'Epilogue', data: fontData, weight: 900 as const, style: 'normal' as const }] }
      : {}),
  }

  const heading = fontData ? 'Epilogue, sans-serif' : 'sans-serif'

  return new ImageResponse(
    (
      <div
        style={{
          width:      '100%',
          height:     '100%',
          display:    'flex',
          background: DARK,
          overflow:   'hidden',
          position:   'relative',
        }}
      >
        {/* ── Right-side hero image ── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BG_IMAGE}
          alt=""
          width={1200}
          height={630}
          style={{
            position:  'absolute',
            inset:     0,
            width:     '100%',
            height:    '100%',
            objectFit: 'cover',
            opacity:   0.18,
          }}
        />

        {/* ── Gradient: fully opaque left, fades right to reveal image texture ── */}
        <div
          style={{
            position:   'absolute',
            inset:      0,
            display:    'flex',
            background: `linear-gradient(105deg, ${DARK} 0%, ${DARK} 42%, rgba(26,22,20,0.82) 62%, rgba(26,22,20,0.45) 100%)`,
          }}
        />

        {/* ── Terra accent bar — left edge ── */}
        <div
          style={{
            position:   'absolute',
            left:       0,
            top:        0,
            bottom:     0,
            width:      5,
            background: TERRA,
            display:    'flex',
          }}
        />

        {/* ── Main content ── */}
        <div
          style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            flexDirection:  'column',
            justifyContent: 'center',
            padding:        '0 72px 0 80px',
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         10,
              marginBottom: 22,
            }}
          >
            <div
              style={{
                width:        7,
                height:       7,
                borderRadius: '50%',
                background:   TERRA,
                flexShrink:   0,
                display:      'flex',
              }}
            />
            <span
              style={{
                color:         TERRA,
                fontSize:      13,
                fontWeight:    700,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                fontFamily:    'sans-serif',
              }}
            >
              ALBUQUERQUE, NEW MEXICO
            </span>
          </div>

          {/* Brand name — "ABQ" cream, "Unplugged" terra */}
          <div
            style={{
              display:       'flex',
              alignItems:    'baseline',
              gap:           0,
              lineHeight:    1.0,
              marginBottom:  20,
              fontFamily:    heading,
              fontWeight:    900,
              letterSpacing: '-2px',
            }}
          >
            <span style={{ color: CREAM, fontSize: 92 }}>ABQ</span>
            <span style={{ color: TERRA, fontSize: 92, marginLeft: 16 }}>Unplugged</span>
          </div>

          {/* Tagline */}
          <div
            style={{
              display:       'flex',
              color:         MUTED,
              fontSize:      22,
              fontWeight:    400,
              lineHeight:    1.45,
              marginBottom:  36,
              fontFamily:    'sans-serif',
              maxWidth:      620,
            }}
          >
            Live music, comedy, arts, food, family events & more — your daily guide to what&apos;s happening in Burque.
          </div>

          {/* Category chips — two rows showing full breadth */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'nowrap' }}>
              {['Tonight', 'Free Events', 'Live Music', 'Comedy', 'Family'].map(c => (
                <Chip key={c} label={c} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'nowrap' }}>
              {['Arts & Theater', 'Food & Drink', 'Festivals', 'Outdoor', 'Neighborhoods'].map(c => (
                <Chip key={c} label={c} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div
          style={{
            position:       'absolute',
            bottom:         0,
            left:           5,
            right:          0,
            height:         44,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '0 48px 0 76px',
            background:     'rgba(26,22,20,0.6)',
            borderTop:      '1px solid rgba(251,247,241,0.07)',
          }}
        >
          <span
            style={{
              color:      `rgba(251,247,241,0.28)`,
              fontSize:   14,
              fontFamily: 'sans-serif',
            }}
          >
            abqunplugged.com
          </span>
          <span
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        6,
              color:      `rgba(79,98,73,0.9)`,
              fontSize:   13,
              fontFamily: 'sans-serif',
            }}
          >
            <div
              style={{
                width:        6,
                height:       6,
                borderRadius: '50%',
                background:   SAGE,
                display:      'flex',
              }}
            />
            Updated daily
          </span>
        </div>
      </div>
    ),
    options
  )
}
