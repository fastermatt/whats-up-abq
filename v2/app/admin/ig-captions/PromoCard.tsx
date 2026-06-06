'use client'

/**
 * PromoCard — renders one of 6 distinct visual Instagram card designs
 * for ABQ Unplugged site-promo posts. Exports at 1080×1080px via html-to-image.
 *
 * All card content uses inline styles so html-to-image captures them faithfully.
 * Logos are loaded from /public/ as <img> tags — html-to-image fetches and embeds them.
 */

import { useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { Download, Loader2 } from 'lucide-react'

// ─── Brand colours ────────────────────────────────────────────────────────────
const TERRA  = '#9a442d'
const CREAM  = '#fbf7f1'
const DARK   = '#1a1614'
const DARKER = '#201c1a'
const SAND   = '#ddc9a3'
const TURQ   = '#006a62'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PromoVariant = 0 | 1 | 2 | 3 | 4 | 5

interface TonightEvent {
  title: string
  category: string | null
  venue: string | null
  time: string | null
}

interface Props {
  variant: PromoVariant
  label: string
  count: number
  tonightCount: number
  tonightEvents: TonightEvent[]
}

// ─── Category data ────────────────────────────────────────────────────────────

const ALL_CATS: [string, string][] = [
  ['Music',          '🎵'],
  ['Comedy',         '😂'],
  ['Sports',         '🏟️'],
  ['Arts & Theater', '🎭'],
  ['Food & Drink',   '🍻'],
  ['Family',         '🎡'],
  ['Film',           '🎬'],
  ['Outdoor',        '🌄'],
  ['Festivals',      '🎪'],
  ['Community',      '🌵'],
]

function catEmoji(c: string | null) {
  return ALL_CATS.find(([name]) => name === c)?.[1] ?? '📍'
}

// ─── Shared typography helpers ────────────────────────────────────────────────

const EPILOGUE: React.CSSProperties = {
  fontFamily: 'var(--font-epilogue), "Epilogue", Georgia, serif',
  fontWeight: 900,
}
const INTER: React.CSSProperties = {
  fontFamily: 'var(--font-inter), system-ui, sans-serif',
}

// ─── Logo component (rendered inside the captured area) ───────────────────────
// Use white logo on dark/terra bgs, black logo on cream bgs

function LogoImg({ variant: bg = 'white', height = 28 }: { variant?: 'white' | 'black' | 'color'; height?: number }) {
  const src = bg === 'black' ? '/logo-black.svg' : bg === 'color' ? '/logo-color.svg' : '/logo-white.svg'
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="ABQ Unplugged"
      style={{ height, objectFit: 'contain', display: 'block' }}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const CARD_PX = 540   // CSS px — exports at 1080×1080 (pixelRatio:2)

export function PromoCard({ variant, label, count, tonightCount, tonightEvents }: Props) {
  const cardRef   = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  const handleDownload = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,       // 540 × 2 = 1080 px output
        cacheBust: true,
        skipAutoScale: true,
      })
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `abq-unplugged-promo-v${variant + 1}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-terra font-bold">{label}</p>
        <button
          onClick={handleDownload}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
            bg-white/[0.06] text-white/50 hover:bg-terra hover:text-white
            transition-all active:scale-95 disabled:opacity-40
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra
            focus-visible:ring-offset-2 focus-visible:ring-offset-ink-deep"
        >
          {busy
            ? <Loader2 size={12} className="animate-spin" />
            : <Download size={12} />}
          {busy ? 'Exporting…' : 'Download PNG'}
        </button>
      </div>

      {/* Card preview */}
      <div
        style={{ width: CARD_PX, height: CARD_PX, maxWidth: '100%', flexShrink: 0 }}
        className="overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] self-start"
      >
        <div ref={cardRef} style={{ width: CARD_PX, height: CARD_PX }}>
          {variant === 0 && <V0BigStat      count={count} />}
          {variant === 1 && <V1CategoryGrid count={count} />}
          {variant === 2 && <V2Tonight      events={tonightEvents} count={tonightCount} />}
          {variant === 3 && <V3BoldType     count={count} />}
          {variant === 4 && <V4Desert       count={count} />}
          {variant === 5 && <V5Minimal      count={count} />}
        </div>
      </div>
    </div>
  )
}

// ─── Variant 0: Big Stat ─────────────────────────────────────────────────────
// Terra background · logo · huge event count · URL

function V0BigStat({ count }: { count: number }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: TERRA,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 52,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle concentric circles */}
      <div style={{
        position: 'absolute', width: 580, height: 580, bottom: -180, right: -180,
        borderRadius: '50%', border: '1px solid rgba(255,255,255,0.07)',
      }} />
      <div style={{
        position: 'absolute', width: 420, height: 420, bottom: -120, right: -120,
        borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)',
      }} />
      <div style={{
        position: 'absolute', width: 260, height: 260, bottom: -60, right: -60,
        borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)',
      }} />

      {/* Logo */}
      <LogoImg variant="white" height={30} />

      {/* Center stat */}
      <div>
        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.5)', fontSize: 12,
          letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700,
          marginBottom: 8,
        }}>
          Upcoming Events in ABQ
        </p>
        <p style={{
          ...EPILOGUE, fontSize: 140, lineHeight: 1,
          color: '#ffffff', marginBottom: 0,
        }}>
          {count}+
        </p>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.2)',
        paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.45)', fontSize: 13,
          letterSpacing: '0.06em',
        }}>
          abqunplugged.com
        </p>
        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.35)', fontSize: 12,
        }}>
          Albuquerque, NM
        </p>
      </div>
    </div>
  )
}

// ─── Variant 1: Category Grid ─────────────────────────────────────────────────
// Dark bg · logo · 2×5 emoji grid of categories

function V1CategoryGrid({ count }: { count: number }) {
  const leftCats  = ALL_CATS.slice(0, 5)
  const rightCats = ALL_CATS.slice(5, 10)

  return (
    <div style={{
      width: '100%', height: '100%',
      background: DARK,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '40px 44px',
    }}>
      {/* Header: logo + tagline */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <LogoImg variant="white" height={30} />
        </div>
        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.3)', fontSize: 11,
          letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 8,
        }}>
          Your guide to Albuquerque
        </p>
      </div>

      {/* Category grid */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {[leftCats, rightCats].map((col, ci) => (
          <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {col.map(([name, emoji]) => (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 10, padding: '10px 16px',
                border: '1px solid rgba(255,255,255,0.07)',
                minWidth: 168,
              }}>
                <span style={{ fontSize: 18 }}>{emoji}</span>
                <span style={{
                  ...INTER, color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: 500,
                }}>{name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center' }}>
        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500,
          marginBottom: 4,
        }}>
          {count}+ events · All in one place.
        </p>
        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.2)', fontSize: 12,
          letterSpacing: '0.04em',
        }}>
          abqunplugged.com
        </p>
      </div>
    </div>
  )
}

// ─── Variant 2: Tonight's Picks ───────────────────────────────────────────────
// Dark bg · logo · live event list

function V2Tonight({ events, count }: { events: TonightEvent[]; count: number }) {
  const show = events.slice(0, 5)
  return (
    <div style={{
      width: '100%', height: '100%',
      background: DARKER,
      display: 'flex', flexDirection: 'column',
      padding: '44px',
    }}>
      {/* Header: logo + label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <LogoImg variant="white" height={26} />
        <p style={{
          ...INTER, color: TERRA, fontSize: 11,
          letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700,
        }}>
          🌙 Tonight in ABQ
        </p>
      </div>

      {/* Title */}
      <p style={{
        ...EPILOGUE, fontSize: 38, color: '#ffffff', lineHeight: 1.1, marginBottom: 20,
      }}>
        What&apos;s On Tonight
      </p>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 20 }} />

      {/* Events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {show.length > 0 ? show.map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 18, lineHeight: 1.4, flexShrink: 0 }}>{catEmoji(e.category)}</span>
            <div>
              <p style={{
                ...INTER, color: '#ffffff', fontSize: 15, fontWeight: 600, lineHeight: 1.3,
              }}>
                {e.title.length > 44 ? e.title.slice(0, 44) + '…' : e.title}
              </p>
              {(e.venue || e.time) && (
                <p style={{
                  ...INTER, color: 'rgba(255,255,255,0.38)', fontSize: 12, marginTop: 2,
                }}>
                  {[e.venue, e.time].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
        )) : (
          <p style={{ ...INTER, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Check back tonight for events!
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ ...INTER, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          {count > 0 ? `${count} events tonight` : 'See all events'}
        </p>
        <p style={{ ...INTER, color: 'rgba(255,255,255,0.2)', fontSize: 12, letterSpacing: '0.04em' }}>
          abqunplugged.com
        </p>
      </div>
    </div>
  )
}

// ─── Variant 3: Bold Typography ───────────────────────────────────────────────
// Cream background · black logo · giant dark text

function V3BoldType({ count }: { count: number }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: CREAM,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      padding: 52,
    }}>
      {/* Logo (black on cream) */}
      <LogoImg variant="black" height={28} />

      {/* Big text */}
      <div>
        {['WHAT\'S', 'HAPPEN-', 'ING IN', 'ABQ?'].map((line, i) => (
          <p key={i} style={{
            ...EPILOGUE, fontSize: 88, color: i === 3 ? TERRA : '#1a1614',
            lineHeight: 0.9, letterSpacing: '-0.02em',
          }}>{line}</p>
        ))}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `2px solid ${TERRA}`, paddingTop: 20 }}>
        <p style={{
          ...INTER, color: '#4a3f3a', fontSize: 14, fontWeight: 500, marginBottom: 4,
        }}>
          {count}+ events · Find yours at
        </p>
        <p style={{ ...EPILOGUE, fontSize: 20, color: TERRA }}>
          abqunplugged.com
        </p>
      </div>
    </div>
  )
}

// ─── Variant 4: Desert / Gradient ─────────────────────────────────────────────
// Terra-to-dark diagonal gradient · logo · ABQ big · centered

function V4Desert({ count }: { count: number }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(140deg, ${TERRA} 0%, #6b2d1a 45%, ${DARK} 100%)`,
      display: 'flex', flexDirection: 'column',
      padding: 52, position: 'relative', overflow: 'hidden',
    }}>
      {/* Diagonal texture lines */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.018) 40px, rgba(255,255,255,0.018) 41px)',
      }} />

      {/* Logo top */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <LogoImg variant="white" height={30} />
      </div>

      {/* Center text */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{
          ...EPILOGUE, fontSize: 120, color: '#ffffff',
          lineHeight: 0.85, letterSpacing: '-0.03em', marginBottom: 4,
        }}>
          ABQ
        </p>
        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.55)',
          fontSize: 15, letterSpacing: '0.32em', fontWeight: 600, marginBottom: 32,
        }}>
          UNPLUGGED
        </p>

        <div style={{ width: 48, height: 1, background: 'rgba(255,255,255,0.25)', marginBottom: 28 }} />

        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: 500, marginBottom: 4,
        }}>
          {count}+ upcoming events
        </p>
        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.4)', fontSize: 12,
          letterSpacing: '0.04em',
        }}>
          in Albuquerque, NM · Updated daily
        </p>
      </div>

      {/* URL */}
      <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
        <p style={{
          ...INTER, color: 'rgba(255,255,255,0.3)', fontSize: 12,
          letterSpacing: '0.06em',
        }}>
          abqunplugged.com
        </p>
      </div>
    </div>
  )
}

// ─── Variant 5: Clean Minimal ─────────────────────────────────────────────────
// Near-black · centered logo · thin dividers · very restrained

function V5Minimal({ count }: { count: number }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#121010',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 64,
    }}>
      {/* Logo centered */}
      <div style={{ marginBottom: 36 }}>
        <LogoImg variant="white" height={34} />
      </div>

      {/* Divider */}
      <div style={{ width: 40, height: 1, background: `${TERRA}`, marginBottom: 36 }} />

      {/* Stat */}
      <p style={{
        ...EPILOGUE, fontSize: 80, color: '#ffffff',
        lineHeight: 1, textAlign: 'center', marginBottom: 10,
      }}>
        {count}+
      </p>
      <p style={{
        ...INTER, color: 'rgba(255,255,255,0.4)', fontSize: 14,
        fontWeight: 500, textAlign: 'center', marginBottom: 6,
      }}>
        events happening in
      </p>
      <p style={{
        ...INTER, color: 'rgba(255,255,255,0.6)', fontSize: 17,
        fontWeight: 600, textAlign: 'center', marginBottom: 44,
      }}>
        Albuquerque, NM
      </p>

      {/* Divider */}
      <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 28 }} />

      {/* URL */}
      <p style={{
        ...INTER, color: 'rgba(255,255,255,0.22)', fontSize: 12,
        letterSpacing: '0.1em',
      }}>
        abqunplugged.com
      </p>
    </div>
  )
}
