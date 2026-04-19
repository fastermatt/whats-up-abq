/**
 * Instagram Card — Story 9:16 (/events/[id]/ig3)
 * Server Component: fetches event, passes to client design tool.
 */
import { notFound } from 'next/navigation'
import { fetchEventById } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { IGCardClient } from '@/app/components/IGCard'

interface PageProps { params: Promise<{ id: string }> }

export default async function IGStoryPage({ params }: PageProps) {
  const { id } = await params
  const event = await fetchEventById(id)
  if (!event) notFound()

  const image = event.imageUrl || getCategoryFallback(event.category ?? undefined, id)
  return <IGCardClient event={event} image={image} initialFormat="story" />
}
