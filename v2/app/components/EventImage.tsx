'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Event image with graceful fallback. Some community events have
 * `cached_photo_url` pointing at external WordPress sites (abqtodo.com,
 * nhccnm.org, lovenm.org etc.) that CAPTCHA-block direct browser loads.
 * Those URLs are automatically routed through /api/image-proxy so the
 * image is fetched server-side from Netlify's IP, which is not blocked.
 *
 * Server components should compute `fallback` via `getCategoryFallback()` and
 * pass it in. This component just handles the swap.
 */

/** Domains that CAPTCHA/hotlink-block direct browser loads, OR get blocked by
 *  common ad-blockers / corporate firewalls. Routing through our proxy makes
 *  the image load reliably from Netlify's IP regardless of the user's network. */
const PROXY_DOMAINS = [
  'abqtodo.com',
  'nhccnm.org',
  'do505.com',
  'lovenm.org',
  'seatgeekimages.com',   // ad-blockers sometimes flag SeatGeek's image CDN
  's1.ticketm.net',       // Ticketmaster CDN
  'media.ticketmaster.com',
]

function proxyIfNeeded(url: string): string {
  try {
    const host = new URL(url).hostname
    if (PROXY_DOMAINS.some(d => host === d || host.endsWith('.' + d))) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`
    }
  } catch {
    // malformed URL — return as-is
  }
  return url
}

/**
 * Route external image URLs through Netlify Image CDN for automatic WebP/AVIF
 * conversion and resizing. Skips:
 *  - data: URIs (inline images)
 *  - URLs already going through /.netlify/ (avoid double-proxying)
 *  - URLs already going through /api/image-proxy (handled by proxyIfNeeded)
 */
function netlifyImageUrl(url: string): string {
  if (
    url.startsWith('data:') ||
    url.startsWith('/.netlify/') ||
    url.startsWith('/api/image-proxy')
  ) {
    return url
  }
  return `/.netlify/images?url=${encodeURIComponent(url)}&w=600&q=75&fm=avif`
}

export function EventImage({
  src,
  fallback,
  alt,
  className,
  loading = 'lazy',
  fetchPriority,
}: {
  src: string
  fallback: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'auto' | 'low'
}) {
  const [currentSrc, setCurrentSrc] = useState(() => netlifyImageUrl(proxyIfNeeded(src)))
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
      decoding={fetchPriority === 'high' ? 'sync' : 'async'}
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
