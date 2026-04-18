/**
 * Instagram Card — Square 1:1 (/events/[id]/ig)
 * Feed post format. Full-bleed image, bold title, date/venue/logo.
 */
import { IGCard } from '@/app/components/IGCard'

interface PageProps { params: Promise<{ id: string }> }

export default async function IGSquarePage({ params }: PageProps) {
  const { id } = await params
  return <IGCard id={id} format="square" />
}
