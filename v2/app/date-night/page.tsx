/**
 * SEO landing page: date night ideas in Albuquerque.
 * Targets "date night albuquerque", "date night ideas albuquerque",
 * "romantic things to do albuquerque".
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Date Night Ideas in Albuquerque, NM'
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
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SEO_TITLE }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/date-night' },
}

const DATE_NIGHT_FAQS = [
  {
    q: 'What are the best date night ideas in Albuquerque?',
    a: 'Enjoy a romantic dinner at Old Town\'s outdoor patios then catch a show at Popejoy Hall or the KiMo Theatre. For a unique date, visit the Guild Cinema for indie films followed by drinks at Sister Bar in Nob Hill.',
  },
  {
    q: 'Is there anything to do on a date in Albuquerque?',
    a: 'Absolutely — explore the Albuquerque BioPark\'s aquarium, take a sunset tram ride up Sandia Peak, or laugh together at Laffs Comedy Club. ABQ Unplugged lists these and hundreds more date-friendly events.',
  },
  {
    q: 'What romantic events are happening in Albuquerque this weekend?',
    a: 'ABQ Unplugged curates concerts, comedy, arts, and dining events perfect for a night out. Filter by This Weekend on the date-night page to see what\'s on right now.',
  },
]

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
          'concerts at Sunshine Theater, El Rey, and Launchpad, comedy at Laffs Comedy Caffe, ' +
          'theater at the KiMo and Popejoy, brewery and wine events across the metro, ' +
          'and one-of-a-kind film screenings at the Guild Cinema. Whether you ' +
          'want a low-key craft beer tasting in Nob Hill or a marquee touring show ' +
          'downtown, there is something here that will make a memorable night. Updated daily.',
        introExtra:
          'Romantic spots include the rooftop seating at Sister Bar overlooking downtown and ' +
          'the intimate courtyard at the Albuquerque Museum. For a cultural date, the KiMo Theatre\'s ' +
          'Pueblo Deco architecture sets a stunning backdrop for performances.',
        emptyHeading: 'Nothing on the date-night list right now',
        emptyBody: 'New events are added daily — check back tomorrow.',
        breadcrumbLabel: 'Date Night',
        faqs: DATE_NIGHT_FAQS,
      }}
    />
  )
}
