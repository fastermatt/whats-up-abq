'use client'

import { useState } from 'react'

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

export function EventImage({
  src,
  fallback,
  alt,
  className,
  loading = 'lazy',
}: {
  src: string
  fallback: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  const [currentSrc, setCurrentSrc] = useState(() => proxyIfNeeded(src))
  const [loaded, setLoaded] = useState(false)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
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
