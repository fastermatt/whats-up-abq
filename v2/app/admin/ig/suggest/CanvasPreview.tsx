'use client'

/**
 * CanvasPreview — visual mockup of an Instagram post suggestion.
 *
 * Two render modes:
 *   - Digest templates (tonight-list, weekend-digest, weekly-five):
 *     Numbered event list on dark background.
 *   - Event templates (poster, golden-hour, split, broadside, etc.):
 *     Hero image fill with title overlay — mirrors the actual canvas output.
 */

import { useRef, useEffect, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { DIGEST_TEMPLATES, TemplateContext } from '@/app/admin/ig/lib/templates'

const DIGEST_TEMPLATE_IDS = new Set(['tonight-list', 'weekend-digest', 'weekly-five'])

/** Route external images through the same-origin proxy so html-to-image can
 *  capture them without tainting the canvas (cross-origin images would blank
 *  the export). Same-origin / data URLs pass through untouched. */
function proxyImage(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('data:') || url.startsWith('/')) return url
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

interface Props {
  templateId: string
  ctx: TemplateContext
  onExport?: (dataUrl: string) => void
}

export function CanvasPreview({ templateId, ctx, onExport }: Props) {
  const template  = DIGEST_TEMPLATES.find(t => t.id === templateId)
  const events    = ctx.events ?? []
  const isDigest  = DIGEST_TEMPLATE_IDS.has(templateId)

  // Single event context (for image-based event templates)
  const event = events[0] ?? null
  const imageUrl = event?.imageUrl ?? ctx.imageUrl ?? null
  const proxiedImageUrl = proxyImage(imageUrl)

  // ── Export the rendered card to a PNG data URL for the accept/publish flow ──
  const cardRef = useRef<HTMLDivElement>(null)
  const ctxKey = JSON.stringify({ templateId, events, imageUrl })
  const exportNow = useCallback(async () => {
    const node = cardRef.current
    if (!node || !onExport) return
    try {
      // Wait for any images inside the card to finish loading first.
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

  // Headline for digest posts
  const headlineText =
    templateId === 'weekend-digest' ? 'This Weekend' :
    templateId === 'weekly-five'    ? 'This Week'    : 'Tonight in ABQ'

  // ── Image-based event template preview ─────────────────────────────────────
  if (!isDigest) {
    const isPoster    = templateId === 'poster'
    const isSplit     = templateId === 'split'
    const isGolden    = templateId === 'golden-hour'
    const isBroadside = templateId === 'broadside'

    return (
      <div className="flex justify-center">
        <div ref={cardRef} className="w-[260px] flex-shrink-0 aspect-[4/5] rounded-xl overflow-hidden shadow-2xl relative">
          {isBroadside || !imageUrl ? (
            // ── Typographic / no-photo template ────────────────────────────
            <div className="absolute inset-0 bg-cream flex flex-col justify-center p-6">
              <div className="text-[9px] font-bold text-terra uppercase tracking-[0.2em] mb-2">
                ABQ Unplugged
              </div>
              <div className="h-px bg-terra mb-4" />
              <p
                className="text-xl font-black text-ink leading-tight mb-3"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {event?.title ?? 'Event Name'}
              </p>
              <div className="space-y-1 text-[10px] text-ink-mid">
                {event?.date && (
                  <p>{new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                )}
                {event?.time && <p>{event.time}</p>}
                {event?.venue && <p>{event.venue}</p>}
              </div>
              <div className="mt-auto pt-4 text-[8px] text-terra uppercase tracking-widest">
                abqunplugged.com
              </div>
            </div>
          ) : isSplit ? (
            // ── Split: photo top half, text bottom ─────────────────────────
            <div className="absolute inset-0 flex flex-col bg-cream">
              {/* Photo top */}
              <div className="h-[52%] relative overflow-hidden">
                <img src={proxiedImageUrl ?? undefined} crossOrigin="anonymous" alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <div className="w-5 h-5 bg-terra rounded flex items-center justify-center">
                    <span className="text-[6px] font-black text-white">ABQ</span>
                  </div>
                </div>
              </div>
              {/* Text bottom */}
              <div className="flex-1 p-4 flex flex-col justify-center">
                <p className="text-[9px] font-semibold text-terra uppercase tracking-[0.18em] mb-1">
                  {event?.category ?? 'Event'}
                </p>
                <p
                  className="text-base font-black text-ink leading-tight line-clamp-3"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {event?.title ?? 'Event Name'}
                </p>
                <div className="mt-2 text-[9px] text-ink-light space-y-0.5">
                  {event?.time && <p>{event.time}</p>}
                  {event?.venue && <p className="truncate">{event.venue}</p>}
                </div>
                <p className="mt-auto pt-2 text-[8px] text-terra/60 uppercase tracking-widest">
                  abqunplugged.com
                </p>
              </div>
            </div>
          ) : isGolden ? (
            // ── Golden Hour: warm gradient + photo inset ───────────────────
            <div className="absolute inset-0 flex flex-col p-4" style={{ background: 'linear-gradient(160deg, #2d1a0c 0%, #7a3a1a 50%, #1a0e06 100%)' }}>
              <div className="flex items-center gap-1.5 mb-4">
                <div className="w-6 h-6 bg-terra rounded flex items-center justify-center">
                  <span className="text-[7px] font-black text-white">ABQ</span>
                </div>
                <span className="text-[9px] text-[#e8c89a] uppercase tracking-wider font-semibold">Unplugged</span>
              </div>
              {/* Photo inset */}
              <div className="flex-1 rounded-lg overflow-hidden mb-3 relative">
                <img src={proxiedImageUrl ?? undefined} crossOrigin="anonymous" alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20" />
              </div>
              {/* Event info */}
              <div>
                <p className="text-[9px] text-[#e8c89a]/70 uppercase tracking-[0.18em] mb-1">
                  {event?.category ?? 'Event'}
                </p>
                <p
                  className="text-sm font-black text-cream leading-tight line-clamp-2"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {event?.title ?? 'Event Name'}
                </p>
                <div className="mt-1.5 text-[9px] text-[#e8c89a]/60 flex gap-2">
                  {event?.time && <span>{event.time}</span>}
                  {event?.venue && <span className="truncate">{event.venue}</span>}
                </div>
              </div>
            </div>
          ) : (
            // ── Poster: full-bleed photo with title overlay (default) ──────
            <div className="absolute inset-0">
              <img src={proxiedImageUrl ?? undefined} crossOrigin="anonymous" alt="" className="w-full h-full object-cover" />
              {/* Dark gradient overlay */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.15) 100%)' }} />
              {/* Logo top-left */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <div className="w-6 h-6 bg-terra rounded flex items-center justify-center">
                  <span className="text-[7px] font-black text-white">ABQ</span>
                </div>
                <span className="text-[9px] text-white/80 uppercase tracking-wider font-semibold">Unplugged</span>
              </div>
              {/* Category chip */}
              {event?.category && (
                <div className="absolute top-3 right-3 bg-terra/80 text-white text-[8px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {event.category}
                </div>
              )}
              {/* Bottom text */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p
                  className="text-base font-black text-white leading-tight mb-1.5 line-clamp-3"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {event?.title ?? 'Event Name'}
                </p>
                <div className="flex items-center gap-2 text-[9px] text-white/70">
                  {event?.date && (
                    <span>{new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  )}
                  {event?.time && <span>· {event.time}</span>}
                </div>
                {event?.venue && (
                  <p className="text-[9px] text-white/50 mt-0.5 truncate">{event.venue}</p>
                )}
                <p className="text-[8px] text-white/30 mt-2 uppercase tracking-widest">abqunplugged.com</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Digest template preview (numbered list) ─────────────────────────────────
  return (
    <div className="flex justify-center">
      <div
        ref={cardRef}
        className="w-[260px] flex-shrink-0 aspect-[4/5] bg-ink rounded-xl overflow-hidden flex flex-col text-cream shadow-2xl"
        style={{ padding: '18px 16px 14px' }}
      >
        {/* Logo row */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-7 h-7 bg-terra rounded flex items-center justify-center flex-shrink-0">
            <span className="text-[8px] font-black text-white leading-none">ABQ</span>
          </div>
          <span className="text-[10px] font-bold text-terra uppercase tracking-[0.18em]">Unplugged</span>
        </div>

        {/* Headline */}
        <div className="mb-3">
          <p className="text-[9px] font-semibold text-terra uppercase tracking-[0.18em] mb-1">
            {template?.name ?? templateId}
          </p>
          <p className="text-2xl font-black leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            {headlineText}
          </p>
        </div>

        {/* Terra rule */}
        <div className="h-px bg-terra/50 mb-3" />

        {/* Events */}
        <div className="flex-1 space-y-2.5 overflow-hidden">
          {events.slice(0, 5).map((e, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-[11px] text-terra font-bold w-5 flex-shrink-0 tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-semibold leading-tight line-clamp-2"
                  style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
                >
                  {e.title}
                </p>
                <p className="text-[9px] text-cream/50 mt-0.5 truncate">
                  {[
                    e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                    }) : null,
                    e.time,
                    e.venue,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-terra/30 flex items-center gap-2">
          <div className="flex-1 h-px bg-terra/30" />
          <span className="text-[8px] text-cream/35 uppercase tracking-widest flex-shrink-0">
            abqunplugged.com
          </span>
        </div>
      </div>
    </div>
  )
}
