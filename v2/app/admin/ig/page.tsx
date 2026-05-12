import { fetchEventById } from '@/lib/events'
import { getCategoryFallback } from '@/lib/fallback-images'
import { IGEditor } from './IGEditor'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ id?: string; returnTo?: string; rowKey?: string }>
}

export default async function IGAdminPage({ searchParams }: PageProps) {
  const { id, returnTo, rowKey } = await searchParams

  let event = null
  let image = ''

  if (id) {
    event = await fetchEventById(id)
    if (event) {
      image = event.imageUrl || getCategoryFallback(event.category ?? undefined, id)
    }
  }

  return (
    <IGEditor
      event={event}
      image={image}
      eventId={id ?? null}
      returnTo={returnTo ?? null}
      rowKey={rowKey ?? null}
    />
  )
}
