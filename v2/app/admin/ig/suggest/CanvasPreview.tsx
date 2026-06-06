'use client'

/**
 * CanvasPreview — the actual image published to Instagram from the suggestion
 * queue (exported via html-to-image in the accept flow).
 *
 * Brand system (kept in-DOM so html-to-image captures it):
 *   - Display/headlines/titles: Epilogue (var(--font-epilogue), globally loaded)
 *   - Meta/eyebrows/body:       Inter   (var(--font-inter), globally loaded)
 *   Fraunces/DM Mono are NOT loaded on this route, so they're intentionally
 *   avoided here — they would fall back to serif/mono in the export.
 *
 * Two render modes:
 *   - Digest (tonight-list / weekend-digest / weekly-five): dark ink editorial list
 *   - Event (poster / split / golden-hour / broadside): photo or typographic hero
 */

import { useRef, useEffect, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { TemplateContext } from '@/app/admin/ig/lib/templates'

const DIGEST_TEMPLATE_IDS = new Set(['tonight-list', 'weekend-digest', 'weekly-five'])

// Brand tokens (literal hex — this DOM is rasterized, not Tailwind-purged).
const C = {
  cream: '#fbf7f1', terra: '#9a442d', terraDeep: '#7d3725', ink: '#1a1614',
  inkMid: '#4a3f3a', sand: '#ddc9a3', sandLt: '#f0e4cc', card: '#fffdf9', gold: '#c99b3b',
}
const HEAD = 'var(--font-epilogue), system-ui, sans-serif'
const BODY = 'var(--font-inter), system-ui, sans-serif'

/** Route external images through the same-origin proxy so html-to-image can
 *  capture them without tainting the canvas. Same-origin / data URLs pass through. */
function proxyImage(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('data:') || url.startsWith('/')) return url
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-[5px]" style={{ fontFamily: HEAD }}>
      <span style={{ width: 13, height: 13, background: C.terra, borderRadius: 3, display: 'inline-block' }} />
      <span
        className="text-[10px] font-extrabold uppercase"
        style={{ letterSpacing: '0.2em', color: light ? C.cream : C.ink }}
      >
        ABQ <span style={{ color: C.terra }}>Unplugged</span>
      </span>
    </div>
  )
}

const fmtDay = (d?: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null

export function CanvasPreview({ templateId, ctx, onExport }: { templateId: string; ctx: TemplateContext; onExport?: (dataUrl: string) => void }) {
  const events   = ctx.events ?? []
  const isDigest = DIGEST_TEMPLATE_IDS.has(templateId)
  const event    = events[0] ?? null
  const imageUrl = event?.imageUrl ?? ctx.imageUrl ?? null
  const proxiedImageUrl = proxyImage(imageUrl)

  // ── Export the rendered card to a PNG data URL for the accept/publish flow ──
  const cardRef = useRef<HTMLDivElement>(null)
  const ctxKey = JSON.stringify({ templateId, events, imageUrl })
  const exportNow = useCallback(async () => {
    const node = cardRef.current
    if (!node || !onExport) return
    try {
      const imgs = Array.from(node.querySelectorAll('img'))
      await Promise.all(imgs.map(img =>
        img.complete ? Promise.resolve()
          : new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r() })
      ))
      // pixelRatio ~4.2 → 260px card renders ~1090px wide (IG-ready).
      const dataUrl = await toPng(node, { pixelRatio: 4.2, cacheBust: true })
      onExport(dataUrl)
    } catch (err) {
      console.error('[CanvasPreview] export failed:', err)
    }
  }, [onExport])
  useEffect(() => {
    const t = setTimeout(exportNow, 200)
    return () => clearTimeout(t)
  }, [ctxKey, exportNow])

  const CARD = 'w-[260px] flex-shrink-0 aspect-[4/5] rounded-xl overflow-hidden shadow-2xl relative'

  // ── Event templates ────────────────────────────────────────────────────────
  if (!isDigest) {
    const isSplit  = templateId === 'split'
    const isGolden = templateId === 'golden-hour'
    const isType   = templateId === 'broadside' || !imageUrl
    const title    = event?.title ?? 'Event Name'
    const titleSize = title.length > 42 ? 'text-[19px]' : title.length > 24 ? 'text-[23px]' : 'text-[27px]'

    // Typographic hero (no photo) — letterpress-poster energy on cream.
    if (isType) {
      return (
        <div className="flex justify-center">
          <div ref={cardRef} className={CARD} style={{ background: C.cream }}>
            <div className="absolute inset-0 flex flex-col p-6">
              <Wordmark />
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-[10px] font-semibold uppercase mb-3" style={{ fontFamily: BODY, letterSpacing: '0.2em', color: C.terra }}>
                  {event?.category ?? 'Albuquerque'}
                </p>
                <p className={`${titleSize} font-black leading-[0.95] mb-4`} style={{ fontFamily: HEAD, color: C.ink, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {title}
                </p>
                <div style={{ width: 44, height: 3, background: C.terra }} />
                <div className="mt-4 space-y-1" style={{ fontFamily: BODY }}>
                  {fmtDay(event?.date) && <p className="text-[13px] font-bold" style={{ color: C.ink }}>{fmtDay(event?.date)}</p>}
                  {event?.time && <p className="text-[11px]" style={{ color: C.inkMid }}>{event.time}</p>}
                  {event?.venue && <p className="text-[11px]" style={{ color: C.inkMid }}>{event.venue}</p>}
                </div>
              </div>
              <p className="text-[8px] font-semibold uppercase" style={{ fontFamily: BODY, letterSpacing: '0.22em', color: C.terra }}>abqunplugged.com</p>
            </div>
          </div>
        </div>
      )
    }

    // Split — photo top, editorial info panel on cream below.
    if (isSplit) {
      return (
        <div className="flex justify-center">
          <div ref={cardRef} className={CARD} style={{ background: C.card }}>
            <div className="absolute inset-0 flex flex-col">
              {/* Photo half — gradient fallback when image fails to load (broken URL, proxy error, etc.)
                  so the card always looks intentional rather than showing a torn-image icon. */}
              <div className="h-[55%] relative overflow-hidden" style={{ background: `linear-gradient(155deg, ${C.terraDeep} 0%, ${C.terra} 55%, ${C.inkMid} 100%)` }}>
                {proxiedImageUrl && (
                  <img src={proxiedImageUrl} crossOrigin="anonymous" alt=""
                    className="w-full h-full object-cover object-top"
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(26,22,20,0.28), rgba(26,22,20,0))' }} />
                <div className="absolute top-3 left-4"><Wordmark light /></div>
              </div>
              <div className="flex-1 flex flex-col p-4">
                <p className="text-[9px] font-semibold uppercase mb-1.5" style={{ fontFamily: BODY, letterSpacing: '0.2em', color: C.terra }}>
                  {event?.category ?? 'Event'}
                </p>
                <p className="text-[19px] font-black leading-[0.98]" style={{ fontFamily: HEAD, color: C.ink, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {title}
                </p>
                <div className="mt-2 space-y-0.5" style={{ fontFamily: BODY }}>
                  {fmtDay(event?.date) && <p className="text-[10px] font-bold" style={{ color: C.ink }}>{fmtDay(event?.date)}{event?.time ? ` · ${event.time}` : ''}</p>}
                  {event?.venue && <p className="text-[10px] truncate" style={{ color: C.inkMid }}>{event.venue}</p>}
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <div className="flex-1 h-px" style={{ background: C.sand }} />
                  <span className="text-[8px] font-semibold uppercase" style={{ fontFamily: BODY, letterSpacing: '0.2em', color: C.terra }}>abqunplugged.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Golden-hour — warm ABQ-sunset gradient with a framed photo.
    if (isGolden) {
      return (
        <div className="flex justify-center">
          <div ref={cardRef} className={CARD} style={{ background: `linear-gradient(155deg, ${C.terraDeep} 0%, ${C.terra} 42%, ${C.ink} 100%)` }}>
            <div className="absolute inset-0 flex flex-col p-4">
              <Wordmark light />
              <div className="flex-1 rounded-lg overflow-hidden my-3 relative" style={{ boxShadow: '0 6px 20px rgba(26,22,20,0.4)' }}>
                {/* object-top: event photos usually have the subject (performer, sign) at
                    the top — center-crop cuts heads off. Top-anchored is almost always right. */}
                <img src={proxiedImageUrl ?? undefined} crossOrigin="anonymous" alt="" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(26,22,20,0.35), rgba(26,22,20,0))' }} />
              </div>
              <p className="text-[9px] font-semibold uppercase mb-1" style={{ fontFamily: BODY, letterSpacing: '0.2em', color: C.gold }}>
                {event?.category ?? 'Event'}
              </p>
              <p className="text-[20px] font-black leading-[0.98]" style={{ fontFamily: HEAD, color: C.cream, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {title}
              </p>
              <div className="mt-1.5 text-[10px] flex gap-2" style={{ fontFamily: BODY, color: 'rgba(251,247,241,0.75)' }}>
                {fmtDay(event?.date) && <span className="font-semibold">{fmtDay(event?.date)}</span>}
                {event?.time && <span>{event.time}</span>}
                {event?.venue && <span className="truncate">· {event.venue}</span>}
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Poster — full-bleed photo, warm ink gradient, terra furniture.
    return (
      <div className="flex justify-center">
        <div ref={cardRef} className={CARD} style={{ background: C.ink }}>
          <img src={proxiedImageUrl ?? undefined} crossOrigin="anonymous" alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(26,22,20,0.94) 0%, rgba(26,22,20,0.45) 42%, rgba(26,22,20,0.05) 72%)' }} />
          <div className="absolute top-3 left-4 right-3 flex items-start justify-between">
            <Wordmark light />
            {event?.category && (
              <span className="text-[8px] font-bold uppercase px-2 py-1 rounded-full" style={{ fontFamily: BODY, letterSpacing: '0.12em', background: C.terra, color: C.cream }}>
                {event.category}
              </span>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div style={{ width: 22, height: 2, background: C.terra }} />
              {fmtDay(event?.date) && <span className="text-[9px] font-semibold uppercase" style={{ fontFamily: BODY, letterSpacing: '0.16em', color: C.gold }}>{fmtDay(event?.date)}</span>}
            </div>
            <p className={`${titleSize} font-black leading-[0.95]`} style={{ fontFamily: HEAD, color: C.cream, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {title}
            </p>
            <div className="mt-2 text-[10px] flex items-center gap-1.5" style={{ fontFamily: BODY, color: 'rgba(251,247,241,0.7)' }}>
              {event?.time && <span className="font-semibold">{event.time}</span>}
              {event?.venue && <span className="truncate">{event.time ? '· ' : ''}{event.venue}</span>}
            </div>
            <p className="mt-3 text-[8px] font-semibold uppercase" style={{ fontFamily: BODY, letterSpacing: '0.22em', color: 'rgba(251,247,241,0.45)' }}>abqunplugged.com</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Digest templates (dark editorial list) ──────────────────────────────────
  const headline =
    templateId === 'weekend-digest' ? { a: 'This ', b: 'Weekend' } :
    templateId === 'weekly-five'    ? { a: 'The Week ', b: 'Ahead' } :
                                      { a: 'Tonight ', b: 'in ABQ' }
  const kicker =
    templateId === 'weekend-digest' ? 'Weekend Guide' :
    templateId === 'weekly-five'    ? 'Five Picks This Week' :
                                      "What's On Tonight"

  return (
    <div className="flex justify-center">
      {/* padding tighter than event templates so 5 rows always fit */}
      <div ref={cardRef} className={CARD} style={{ background: C.ink, padding: '16px 16px 12px', display: 'flex', flexDirection: 'column' }}>
        <Wordmark light />

        <div className="mt-3">
          <p className="text-[8px] font-semibold uppercase mb-1" style={{ fontFamily: BODY, letterSpacing: '0.2em', color: C.terra }}>
            {kicker}
          </p>
          {/* 23px keeps the headline to 2 lines without overflowing into the list */}
          <p className="text-[23px] font-black leading-[0.92]" style={{ fontFamily: HEAD, color: C.cream }}>
            {headline.a}<span style={{ color: C.terra }}>{headline.b}</span>
          </p>
        </div>

        <div className="mt-2 flex-1 flex flex-col">
          {events.slice(0, 5).map((e, i) => (
            <div key={i} className="flex gap-2 items-baseline py-1.5" style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(154,68,45,0.22)' }}>
              <span className="text-[11px] font-black tabular-nums flex-shrink-0" style={{ fontFamily: HEAD, color: C.terra, width: 14 }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                {/* Always clamp to 1 line — long titles (e.g. "Luke Bryan with…") must truncate
                    rather than expand the row and push item 5 off the bottom of the card */}
                <p className="text-[11.5px] font-bold leading-[1.1] truncate" style={{ fontFamily: HEAD, color: C.cream }}>
                  {e.title}
                </p>
                <p className="text-[8.5px] truncate" style={{ fontFamily: BODY, color: 'rgba(251,247,241,0.5)', marginTop: 1 }}>
                  {[fmtDay(e.date), e.time, e.venue].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${C.terra}` }}>
          <span className="text-[7.5px] font-bold uppercase" style={{ fontFamily: BODY, letterSpacing: '0.16em', color: C.gold }}>Save this</span>
          <div className="flex-1" />
          <span className="text-[7.5px] font-semibold uppercase" style={{ fontFamily: BODY, letterSpacing: '0.18em', color: 'rgba(251,247,241,0.5)' }}>abqunplugged.com</span>
        </div>
      </div>
    </div>
  )
}
