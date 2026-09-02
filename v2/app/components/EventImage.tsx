'use client'

import { useState } from 'react'
import { proxyIfNeeded, netlifyImageUrl } from '@/lib/image-url'

/**
 * Event image with graceful fallback. Some community events have
 * `cached_photo_url` pointing at external WordPress sites (abqtodo.com,
 * nhccnm.org, lovenm.org etc.) that CAPTCHA-block direct browser loads.
 * Those URLs are automatically routed through /api/image-proxy so the
 * image is fetched server-side from Netlify's IP, which is not blocked.
 *
 * Server components should compute `fallback` via `getCategoryFallback()` and
 * pass it in. This component just handles the swap.
 *
 * URL resolution order:
 *   1. Netlify-optimized real image
 *   2. Raw/proxied real image
 *   3. Netlify-optimized category fallback
 *   4. Raw/proxied category fallback
 * The same logic lives in lib/image-url.ts so server components can compute
 * matching preload URLs without duplicating code.
 */

export function EventImage({
  src,
  fallback,
  alt,
  className,
  loading = 'lazy',
  fetchPriority,
  width = 600,
  sizes,
  decoding,
}: {
  src: string
  fallback: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'auto' | 'low'
  /** Target width in CSS pixels. Smaller widths cut bytes proportionally —
   *  pass card-rendered width, not 2x. Defaults to 600. */
  width?: number
  /** Optional `sizes` attribute. Currently unused (single-resolution AVIF) but
   *  forwarded so callers can opt in to responsive selection later. */
  sizes?: string
  /** Decoding hint. Defaults to 'sync' for the LCP candidate (fetchPriority='high')
   *  so paint isn't deferred behind background decode work, and 'async' otherwise. */
  decoding?: 'sync' | 'async' | 'auto'
}) {
  const rawPrimary = proxyIfNeeded(src || fallback)
  const rawFallback = proxyIfNeeded(fallback)
  const candidates = Array.from(new Set([
    netlifyImageUrl(rawPrimary, width),
    rawPrimary,
    netlifyImageUrl(rawFallback, width),
    rawFallback,
  ]))
  const candidateKey = `${src}\u0000${fallback}\u0000${width}`
  const [failure, setFailure] = useState({ key: '', index: 0 })
  const activeIndex = failure.key === candidateKey
    ? Math.min(failure.index, candidates.length - 1)
    : 0
  const currentSrc = candidates[activeIndex]

  const resolvedDecoding = decoding ?? (fetchPriority === 'high' ? 'sync' : 'async')

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      sizes={sizes}
      fetchPriority={fetchPriority}
      decoding={resolvedDecoding}
      className={className}
      onError={() => {
        if (activeIndex < candidates.length - 1) {
          setFailure({ key: candidateKey, index: activeIndex + 1 })
        }
      }}
    />
  )
}
