/**
 * OG image for /l — the IG growth landing page.
 *
 * Design: terra background (warm, stands out on Instagram).
 * Shows real weekend event count for FOMO. Regenerates every 5 min via ISR.
 * Distinct from the dark homepage OG so the link preview feels fresh.
 */

import { ImageResponse } from 'next/og'
import { fetchEvents } from '@/lib/events'

export const runtime     = 'edge'
export const alt         = 'ABQ Unplugged — What\'s happening in Albuquerque'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Load Epilogue 900 from Google Fonts
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

export default async function OG() {
  const [fontData, weekendResult, tonightResult] = await Promise.all([
    loadEpilogueFont(),
    fetchEvents({ timeFilter: 'this-weekend', limit: 1 }),
    fetchEvents({ timeFilter: 'tonight', limit: 1 }),
  ])

  const tonightCount = tonightResult.total
  const weekendCount = weekendResult.total
  const count        = tonightCount >= 10 ? tonightCount : weekendCount
  const countLabel   = tonightCount >= 10 ? 'events tonight' : 'events this weekend'
  const countStr     = count > 0 ? count.toLocaleString() : '900+'

  const heading = fontData ? 'Epilogue, sans-serif' : 'sans-serif'
  const options = {
    ...size,
    ...(fontData
      ? { fonts: [{ name: 'Epilogue', data: fontData, weight: 900 as const, style: 'normal' as const }] }
      : {}),
  }

  return new ImageResponse(
    (
      <div
        style={{
          width:           '100%',
          height:          '100%',
          display:         'flex',
          background:      '#9a442d',
          overflow:        'hidden',
          position:        'relative',
        }}
      >
        {/* ── Dot-grid texture overlay ── */}
        <div
          style={{
            position:   'absolute',
            inset:      0,
            display:    'flex',
            background: 'radial-gradient(circle at 1px 1px, rgba(251,247,241,0.09) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* ── Right fade to darker terra ── */}
        <div
          style={{
            position:   'absolute',
            inset:      0,
            display:    'flex',
            background: 'linear-gradient(105deg, rgba(90,36,22,0) 0%, rgba(90,36,22,0.55) 100%)',
          }}
        />

        {/* ── Cream accent bar — right edge ── */}
        <div
          style={{
            position:   'absolute',
            right:      0,
            top:        0,
            bottom:     0,
            width:      6,
            background: '#fbf7f1',
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
            padding:        '0 80px',
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         10,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width:        8,
                height:       8,
                borderRadius: '50%',
                background:   'rgba(251,247,241,0.5)',
                display:      'flex',
              }}
            />
            <span
              style={{
                color:         'rgba(251,247,241,0.65)',
                fontSize:      14,
                fontWeight:    700,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                fontFamily:    'sans-serif',
              }}
            >
              ALBUQUERQUE, NEW MEXICO
            </span>
          </div>

          {/* Big count */}
          <div
            style={{
              display:       'flex',
              alignItems:    'baseline',
              gap:           0,
              marginBottom:  4,
              fontFamily:    heading,
              fontWeight:    900,
              letterSpacing: '-3px',
              lineHeight:    1.0,
            }}
          >
            <span style={{ color: '#fbf7f1', fontSize: 148 }}>{countStr}</span>
          </div>

          {/* Count label */}
          <div
            style={{
              display:      'flex',
              color:        'rgba(251,247,241,0.82)',
              fontSize:     36,
              fontWeight:    900,
              fontFamily:   heading,
              letterSpacing: '-0.5px',
              marginBottom:  32,
            }}
          >
            {countLabel} in ABQ
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'nowrap' }}>
            {['Concerts', 'Comedy', 'Art', 'Food', 'Free events', 'Family'].map(label => (
              <div
                key={label}
                style={{
                  display:       'flex',
                  padding:       '7px 16px',
                  background:    'rgba(251,247,241,0.13)',
                  borderRadius:  999,
                  border:        '1px solid rgba(251,247,241,0.22)',
                  color:         'rgba(251,247,241,0.88)',
                  fontSize:      14,
                  fontWeight:    600,
                  letterSpacing: '0.02em',
                  fontFamily:    'sans-serif',
                  whiteSpace:    'nowrap',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div
          style={{
            position:       'absolute',
            bottom:         0,
            left:           0,
            right:          6,
            height:         52,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '0 80px',
            background:     'rgba(90,36,22,0.4)',
            borderTop:      '1px solid rgba(251,247,241,0.12)',
          }}
        >
          <span
            style={{
              color:         '#fbf7f1',
              fontSize:      18,
              fontWeight:    900,
              fontFamily:    heading,
              letterSpacing: '-0.5px',
            }}
          >
            ABQ Unplugged
          </span>
          <span
            style={{
              color:      'rgba(251,247,241,0.50)',
              fontSize:   14,
              fontFamily: 'sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            abqunplugged.com/l
          </span>
        </div>
      </div>
    ),
    options
  )
}
