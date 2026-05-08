/**
 * Instagram Card — Square 1:1 (/events/[id]/ig)
 * Server Component: fetches event, passes to client design tool.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
import { fetchEventById } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { IGCardClient } from '@/app/components/IGCard'

interface PageProps { params: Promise<{ id: string }> }

export default async function IGSquarePage({ params }: PageProps) {
  const { id } = await params
  const event = await fetchEventById(id)
  if (!event) notFound()

  const image = event.imageUrl || getCategoryFallback(event.category ?? undefined, id)
  return <IGCardClient event={event} image={image} initialFormat="square" />
}
