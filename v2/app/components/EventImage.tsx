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

/** Domains that CAPTCHA/hotlink-block direct browser loads */
const PROXY_DOMAINS = [
  'abqtodo.com',
  'nhccnm.org',
  'do505.com',
  'lovenm.org',
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => {
        if (currentSrc !== fallback) setCurrentSrc(fallback)
      }}
    />
  )
}
