/**
 * Root OG image — auto-discovered by Next.js for the homepage and all routes
 * that don't have their own opengraph-image.tsx.
 *
 * Outputs PNG via ImageResponse (Satori). PNG has universal support across
 * iMessage, Facebook, Twitter/X, Slack, Discord, and WhatsApp — unlike the
 * WebP hero images which break on Apple's link-preview crawler.
 *
 * Loads Epilogue 900 from Google Fonts at request time (edge-cached after
 * the first hit). Falls back to system sans-serif if the fetch fails.
 */

import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const alt         = 'ABQ Unplugged — Things to do in Albuquerque, NM'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ── Brand tokens ─────────────────────────────────────────────────────────────
const TERRA      = '#9a442d'
const CREAM      = '#fbf7f1'
const DARK       = '#1a1614'
const TERRA_PALE = 'rgba(228,170,152,0.88)' // peach for category pills on dark

// Hero image used as background texture. Served from our own Netlify CDN so
// it's always accessible from the edge function at request time.
const BG_IMAGE = 'https://abqunplugged.com/hero/hero-4.png'

// ── Font loader ───────────────────────────────────────────────────────────────
async function loadEpilogueFont(): Promise<ArrayBuffer | null> {
  try {
    // Ask for the woff2 variant — use a modern desktop UA
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Epilogue:wght@900&display=swap',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      }
    ).then(r => r.text())

    // Pull the woff2 URL out of the CSS response
    const match = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/)
    if (!match) return null

    return fetch(match[1]).then(r => r.arrayBuffer())
  } catch {
    return null // fall back to system sans-serif silently
  }
}

// ── OG image ─────────────────────────────────────────────────────────────────
export default async function OG() {
  const fontData = await loadEpilogueFont()

  const options = {
    ...size,
    ...(fontData
      ? {
          fonts: [
            {
              name:   'Epilogue',
              data:   fontData,
              weight: 900 as const,
              style:  'normal' as const,
            },
          ],
        }
      : {}),
  }

  const heading = fontData ? 'Epilogue, sans-serif' : 'sans-serif'

  return new ImageResponse(
    (
      <div
        style={{
          width:    '100%',
          height:   '100%',
          display:  'flex',
          position: 'relative',
          background: DARK,
          overflow: 'hidden',
        }}
      >
        {/* ── Background: hero illustration at low opacity ── */}
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
            opacity:   0.20,
          }}
        />

        {/* ── Gradient: heavier left → text legible; lighter right → art shows ── */}
        <div
          style={{
            position:   'absolute',
            inset:      0,
            display:    'flex',
            background: 'linear-gradient(110deg, rgba(26,22,20,0.97) 0%, rgba(26,22,20,0.88) 52%, rgba(26,22,20,0.55) 100%)',
          }}
        />

        {/* ── Content column ── */}
        <div
          style={{
            position:      'absolute',
            inset:         0,
            display:       'flex',
            flexDirection: 'column',
            justifyContent:'center',
            padding:       '0 80px',
          }}
        >
          {/* Eyebrow — location lock */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              marginBottom:   28,
            }}
          >
            <div
              style={{
                width:        8,
                height:       8,
                borderRadius: '50%',
                background:   TERRA,
                display:      'flex',
                flexShrink:   0,
              }}
            />
            <span
              style={{
                color:          TERRA,
                fontSize:       15,
                fontWeight:     700,
                letterSpacing:  '0.28em',
                textTransform:  'uppercase',
                fontFamily:     'sans-serif',
              }}
            >
              ALBUQUERQUE, NM
            </span>
          </div>

          {/* Brand name — the whole card */}
          <div
            style={{
              display:       'flex',
              color:         CREAM,
              fontSize:      88,
              fontWeight:    900,
              lineHeight:    1.0,
              letterSpacing: '-2.5px',
              marginBottom:  28,
              fontFamily:    heading,
            }}
          >
            ABQ Unplugged
          </div>

          {/* Tagline — what the site does */}
          <div
            style={{
              display:       'flex',
              color:         'rgba(251,247,241,0.62)',
              fontSize:      24,
              fontWeight:    400,
              lineHeight:    1.4,
              marginBottom:  44,
              fontFamily:    'sans-serif',
              maxWidth:      660,
            }}
          >
            Concerts, comedy, arts, food, sports — what&apos;s happening in Burque tonight.
          </div>

          {/* Category pills — show breadth */}
          <div
            style={{
              display:    'flex',
              gap:        8,
              alignItems: 'center',
            }}
          >
            {['Concerts', 'Comedy', 'Arts & Theater', 'Food & Drink', 'Sports', 'More'].map(cat => (
              <div
                key={cat}
                style={{
                  display:      'flex',
                  padding:      '6px 14px',
                  background:   'rgba(154,68,45,0.16)',
                  borderRadius: 999,
                  border:       '1px solid rgba(154,68,45,0.32)',
                  color:        TERRA_PALE,
                  fontSize:     13,
                  fontWeight:   600,
                  letterSpacing:'0.04em',
                  fontFamily:   'sans-serif',
                }}
              >
                {cat}
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom-right: site URL ── */}
        <div
          style={{
            position:      'absolute',
            bottom:        30,
            right:         48,
            display:       'flex',
            color:         'rgba(251,247,241,0.30)',
            fontSize:      17,
            fontWeight:    500,
            fontFamily:    'sans-serif',
            letterSpacing: '0.02em',
          }}
        >
          abqunplugged.com
        </div>
      </div>
    ),
    options
  )
}
