/**
 * SEO landing page: free things to do in Albuquerque.
 * Targets queries like "free things to do in albuquerque", "free events albuquerque",
 * "free things to do in albuquerque this weekend".
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'

export const revalidate = 3600

const SEO_TITLE = 'Free Things to Do in Albuquerque, NM'
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

const FREE_FAQS = [
  {
    q: 'What free events are available in Albuquerque?',
    a: 'Albuquerque offers many free events including the Rail Yards Market on Sundays, concerts at Civic Plaza, and art walks in Old Town and Nob Hill. Check ABQ Unplugged\'s free events calendar for updated listings.',
  },
  {
    q: 'How can I find free events in Albuquerque?',
    a: 'Use ABQ Unplugged\'s filter for free events or browse categories like music, markets, and community festivals. Every listing shows location, time, and whether admission is free.',
  },
  {
    q: 'Are there free events this weekend in Albuquerque?',
    a: 'Most weekends feature free activities such as live music at Civic Plaza, outdoor movie nights, and neighborhood festivals. Visit ABQ Unplugged\'s weekend section and filter by free to find specific options.',
  },
]

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
          'always says there\'s nothing to do here.',
        introExtra:
          'Popular free venues include the Rail Yards Market, Civic Plaza, and the Albuquerque BioPark on ' +
          'select days. Check out Nob Hill\'s monthly art walk for gallery openings and street ' +
          'performances without an admission fee.',
        emptyHeading: 'No free events listed right now',
        emptyBody:
          'Our list refreshes daily. Check back tomorrow or browse all upcoming events.',
        breadcrumbLabel: 'Free Events',
        faqs: FREE_FAQS,
      }}
    />
  )
}
