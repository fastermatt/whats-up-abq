/**
 * SEO landing page: family-friendly things to do in Albuquerque with kids.
 * Targets "things to do with kids in albuquerque", "family activities albuquerque",
 * "kid friendly events albuquerque".
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'

export const revalidate = 3600

const SEO_TITLE = 'Things to Do with Kids in Albuquerque'
const SEO_DESC =
  'Family-friendly events, kids activities, story times, museum days, and ' +
  'family festivals in Albuquerque, NM. Updated daily on ABQ Unplugged.'

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: `${SEO_TITLE} — ABQ Unplugged`,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/family-friendly',
  },
  alternates: { canonical: 'https://abqunplugged.com/family-friendly' },
}

export default async function FamilyFriendlyPage() {
  const { events } = await fetchEvents({ category: 'Family', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'family-friendly',
        heading: 'Things to Do with Kids in Albuquerque',
        lede: `${events.length} family-friendly events coming up across the metro.`,
        intro:
          'Looking for things to do with kids in Albuquerque? This is a curated list of ' +
          'family-friendly events across the metro — story times at every public library ' +
          'branch, kids classes at the BioPark, hands-on workshops at Explora and the ' +
          'New Mexico Museum of Natural History, family days at the Albuquerque Museum, ' +
          'and free outdoor festivals at the city parks. Many events are free or ' +
          'low-cost, and they’re sorted by category so it’s easy to find something for ' +
          'your kid’s age and interests. Updated daily.',
        emptyHeading: 'No family events listed right now',
        emptyBody: 'New family events are added daily — check back tomorrow.',
        breadcrumbLabel: 'Family-Friendly',
      }}
    />
  )
}
