/**
 * SEO landing page: date night ideas in Albuquerque.
 * Targets "date night albuquerque", "date night ideas albuquerque",
 * "romantic things to do albuquerque".
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'

export const revalidate = 3600

const SEO_TITLE = 'Date Night Ideas in Albuquerque'
const SEO_DESC =
  'Date-night-perfect events in Albuquerque — concerts, comedy shows, ' +
  'wine and beer tastings, theater, and more. Updated daily on ABQ Unplugged.'

const DATE_CATEGORIES = ['Music', 'Comedy', 'Food & Drink', 'Arts & Theater', 'Film']

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: `${SEO_TITLE} — ABQ Unplugged`,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/date-night',
  },
  alternates: { canonical: 'https://abqunplugged.com/date-night' },
}

export default async function DateNightPage() {
  // Fetch a wider net then filter to date-friendly categories
  const results = await Promise.all(
    DATE_CATEGORIES.map(c => fetchEvents({ category: c, limit: 50 }))
  )
  const events = results
    .flatMap(r => r.events)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 120)

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'date-night',
        heading: 'Date Night Ideas in Albuquerque',
        lede: `${events.length} hand-curated events that work for a great night out.`,
        intro:
          'Need date night ideas in Albuquerque? This list is curated from upcoming ' +
          'concerts at Sunshine Theater, El Rey, and Launchpad, comedy at Hyena’s, ' +
          'theater at the KiMo and Popejoy, brewery and wine events across the metro, ' +
          'and one-of-a-kind film screenings at the Guild and Cocina Azul. Whether you ' +
          'want a low-key craft beer tasting in Nob Hill or a marquee touring show ' +
          'downtown, there’s something here that’ll make a memorable night. Updated daily.',
        emptyHeading: 'Nothing on the date-night list right now',
        emptyBody: 'New events are added daily — check back tomorrow.',
        breadcrumbLabel: 'Date Night',
      }}
    />
  )
}
