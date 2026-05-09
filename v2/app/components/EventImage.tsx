'use client'

import { useEffect, useRef, useState } from 'react'
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
 *   1. proxyIfNeeded(src)   — route CAPTCHA-blocked domains through /api/image-proxy
 *   2. netlifyImageUrl(...)  — wrap remainder in Netlify Image CDN for AVIF conversion
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
}) {
  const [currentSrc, setCurrentSrc] = useState(() => netlifyImageUrl(proxyIfNeeded(src), width))
  // Priority images skip the fade-in so they're immediately visible for LCP measurement
  const [loaded, setLoaded] = useState(fetchPriority === 'high')
  const imgRef = useRef<HTMLImageElement>(null)

  // Cached images load before onLoad fires — check .complete on mount
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      loading={loading}
      // eslint-disable-next-line react/no-unknown-property
      fetchPriority={fetchPriority}
      decoding="async"
      className={`${className ?? ''} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (currentSrc !== fallback) {
          setLoaded(false)
          setCurrentSrc(fallback)
        }
      }}
    />
  )
}
