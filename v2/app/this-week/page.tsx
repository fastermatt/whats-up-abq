/**
 * SEO landing page: things to do in Albuquerque this week.
 * Targets "things to do in albuquerque this week", "albuquerque events this week".
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'

export const revalidate = 3600

const SEO_TITLE = 'Things to Do in Albuquerque This Week'
const SEO_DESC =
  'Everything happening in Albuquerque this week — concerts, comedy, arts, ' +
  'sports, food and drink, family events. Updated daily on ABQ Unplugged.'

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: `${SEO_TITLE} — ABQ Unplugged`,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/this-week',
  },
  alternates: { canonical: 'https://abqunplugged.com/this-week' },
}

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
          'event, family activity, and food/drink event we’re tracking, ranked editorially ' +
          'and grouped by category. Want something more specific? Check the Tonight, ' +
          'This Weekend, Free, Family, and Date Night lists. Updated continuously as ' +
          'new events are added.',
        emptyHeading: 'Quiet week ahead',
        emptyBody: 'New events get added daily — check back, or look further out.',
        breadcrumbLabel: 'This Week',
      }}
    />
  )
}
