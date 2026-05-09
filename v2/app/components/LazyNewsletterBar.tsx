'use client'

/**
 * LazyNewsletterBar — defers NewsletterBar's JS until after first paint.
 *
 * The newsletter bar lives near the bottom of every page and isn't part of
 * any LCP candidate. Loading its JS lazily keeps it out of the layout's
 * shared first-load bundle.
 */

import dynamic from 'next/dynamic'

const NewsletterBar = dynamic(
  () => import('./NewsletterBar').then(m => ({ default: m.NewsletterBar })),
  { ssr: false, loading: () => <div className="h-[140px]" aria-hidden /> },
)

export function LazyNewsletterBar() {
  return <NewsletterBar />
}
