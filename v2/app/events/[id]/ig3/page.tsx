/**
 * Instagram Card — Story 9:16 (/events/[id]/ig3)
 * Full-screen vertical story format.
 */
import { IGCard } from '@/app/components/IGCard'

interface PageProps { params: Promise<{ id: string }> }

export default async function IGStoryPage({ params }: PageProps) {
  const { id } = await params
  return <IGCard id={id} format="story" />
}
