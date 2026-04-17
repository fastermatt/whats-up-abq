'use client'

import { useState } from 'react'

/**
 * Event image with graceful fallback. Some community events have
 * `cached_photo_url` pointing at external WordPress sites (lovenm.org etc.)
 * that go 503 / hotlink-block without warning. When the primary URL fails,
 * we swap to the pre-computed category illustration.
 *
 * Server components should compute `fallback` via `getCategoryFallback()` and
 * pass it in. This component just handles the swap.
 */
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
  const [currentSrc, setCurrentSrc] = useState(src)

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
