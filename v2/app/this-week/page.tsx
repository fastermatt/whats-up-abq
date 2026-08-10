/**
 * SEO landing page: things to do in Albuquerque this week.
 * Targets "things to do in albuquerque this week", "albuquerque events this week".
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Things to Do in Albuquerque This Week'
const SEO_DESC =
  'Everything happening in Albuquerque this week — concerts, comedy, arts, ' +
  'sports, food and drink, family events. Updated daily on ABQ Unplugged.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: `${SEO_TITLE} — ABQ Unplugged`,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/this-week',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SEO_TITLE }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/this-week' },
}

const THIS_WEEK_FAQS = [
  {
    q: "What's happening in Albuquerque this week?",
    a: 'This week in ABQ, catch a show at Popejoy Hall or the historic KiMo Theatre, both offering live performances. Head to Civic Plaza for community events, browse local vendors at the Rail Yards Market, or take a walking tour through Old Town.',
  },
  {
    q: 'What are the best things to do in Albuquerque this week?',
    a: 'Top weekly activities include concerts and plays at Popejoy Hall, film screenings at KiMo Theatre, and free outdoor events at Civic Plaza. Nob Hill art walks, Old Town cultural museums, and the Rail Yards Market on weekends are also worth checking out.',
  },
  {
    q: 'Where can I find weekly events in Albuquerque?',
    a: "ABQ Unplugged curates this week's events across the city — performances at Popejoy Hall and KiMo Theatre, public gatherings at Civic Plaza, and the Rail Yards Sunday market. Nob Hill and Old Town also host recurring art walks, live music, and seasonal festivals.",
  },
]

export default async function ThisWeekPage() {
  const { events } = await fetchEvents({ timeFilter: 'this-week', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'this-week',
        heading: 'This Week in Albuquerque',
        lede: `${events.length} events happening over the next seven days.`,
        intro:
          'Looking for things to do in Albuquerque this week? This is the full ' +
          'next-seven-days lineup — every concert, comedy show, theater date, sports ' +
          'event, family activity, and food/drink event we\'re tracking, ranked editorially ' +
          'and grouped by category. Want something more specific? Check the Tonight, ' +
          'This Weekend, Free, Family, and Date Night lists. Updated continuously as ' +
          'new events are added.',
        introExtra:
          'This list updates daily and covers every neighborhood from Nob Hill to the West Side. ' +
          'Free events are always included, so you can find something for any budget.',
        emptyHeading: 'Quiet week ahead',
        emptyBody: 'New events get added daily — check back, or look further out.',
        breadcrumbLabel: 'This Week',
        faqs: THIS_WEEK_FAQS,
      }}
    />
  )
}
