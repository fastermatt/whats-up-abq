/**
 * Instagram Card — Portrait 4:5 (/events/[id]/ig2)
 * Taller feed post, shows more info.
 */
import { IGCard } from '@/app/components/IGCard'

interface PageProps { params: Promise<{ id: string }> }

export default async function IGPortraitPage({ params }: PageProps) {
  const { id } = await params
  return <IGCard id={id} format="portrait" />
}
