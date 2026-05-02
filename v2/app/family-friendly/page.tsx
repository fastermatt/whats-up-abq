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

const FAMILY_FAQS = [
  {
    q: 'What are the top indoor attractions for kids in Albuquerque?',
    a: 'Explora Science Center offers hands-on exhibits for all ages, while the New Mexico Museum of Natural History features dinosaur skeletons and a planetarium. The Albuquerque Museum also has family-friendly art activities and interactive spaces.',
  },
  {
    q: 'Are there free or low-cost kids activities in the city?',
    a: 'Yes, many public library branches host free story times for young children throughout the week. Balloon Fiesta Park is free to explore when no events are scheduled, offering wide open spaces for picnics and kite flying.',
  },
  {
    q: 'What outdoor activities are best for families with children?',
    a: "The ABQ BioPark includes a zoo, aquarium, and botanic garden with train rides. Cliff's Amusement Park offers thrill rides and a water park section for older kids, while Balloon Fiesta Park is great for biking or flying kites.",
  },
]

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
          "low-cost, and they're sorted by category so it's easy to find something for " +
          "your kid's age and interests. Updated daily.",
        introExtra:
          'Let kids marvel at Explora Science Center in Old Town, then explore the ABQ BioPark ' +
          'where the zoo, aquarium, and botanical garden all await. When summer heat arrives, ' +
          "cool off with classic rides at Cliff's Amusement Park.",
        emptyHeading: 'No family events listed right now',
        emptyBody: 'New family events are added daily — check back tomorrow.',
        breadcrumbLabel: 'Family-Friendly',
        faqs: FAMILY_FAQS,
      }}
    />
  )
}
