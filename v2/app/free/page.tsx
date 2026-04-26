/**
 * SEO landing page: free things to do in Albuquerque.
 * Targets queries like "free things to do in albuquerque", "free events albuquerque",
 * "free things to do in albuquerque this weekend".
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'

export const revalidate = 3600

const SEO_TITLE = 'Free Things to Do in Albuquerque'
const SEO_DESC =
  'Free events in Albuquerque, NM — concerts, family activities, museum days, ' +
  'gallery openings, and more. Updated daily on ABQ Unplugged.'

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: `${SEO_TITLE} — ABQ Unplugged`,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/free',
  },
  alternates: { canonical: 'https://abqunplugged.com/free' },
}

export default async function FreeEventsPage() {
  const { events } = await fetchEvents({ freeOnly: true, limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'free',
        heading: 'Free Things to Do in Albuquerque',
        lede: `${events.length} free events coming up — concerts, art openings, family activities, and more.`,
        intro:
          'Looking for free things to do in Albuquerque? We pull events from local venues, ' +
          'community organizations, museums, and city sources to surface every free event ' +
          'happening across the metro — Old Town, Nob Hill, Downtown, Northeast Heights, the ' +
          'West Side, and beyond. From First Friday gallery walks to free outdoor concerts, ' +
          'kids storytimes at the public library, volunteer events, and farmers markets, ' +
          'this list updates daily as new events are added. Bookmark it and share with a friend who ' +
          'always says there’s nothing to do here.',
        emptyHeading: 'No free events listed right now',
        emptyBody:
          'Our list refreshes daily. Check back tomorrow or browse all upcoming events.',
        breadcrumbLabel: 'Free Events',
      }}
    />
  )
}
