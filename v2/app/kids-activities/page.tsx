/**
 * SEO landing page: Kids Activities in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Kids Activities in Albuquerque — Things to Do with Kids | ABQ Unplugged'
const SEO_DESC = 'Find real things to do with kids in Albuquerque. BioPark, Explora, hidden playgrounds, and family events that aren\'t boring.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/kids-activities',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Kids Activities in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/kids-activities' },
}

const FAQS = [
  {
    q: 'What\'s the best free kids activity in Albuquerque?',
    a: 'The City of Albuquerque runs free splash pads and community pool days in summer. Check the Parks and Recreation page for schedules. Also, the Rio Grande Zoo has free days a few times a year.',
  },
  {
    q: 'Is Explora good for toddlers?',
    a: 'Absolutely. The early childhood area has soft play and sensory activities. Older kids love the water and air exhibits. Check Explora\'s events page for toddler-specific mornings.',
  },
  {
    q: 'What do I do with kids on a rainy day?',
    a: 'Explora, the Children\'s Museum, and the ABQ BioPark aquarium are all indoors. The National Museum of Nuclear Science & History is also surprisingly fun for older kids. Book tickets online to save time.',
  },
]

const RELATED_LINKS = [
  { name: 'ABQ BioPark', url: 'https://www.cabq.gov/abqbiopark', description: 'Zoo, aquarium, botanic garden, and Tingley Beach — the definitive ABQ family day.' },
  { name: 'Explora Science Museum', url: 'https://www.explora.us', description: 'Hands-on exhibits where kids can build, experiment, and make a mess.' },
  { name: 'City of ABQ: Parks & Rec', url: 'https://www.cabq.gov/parksandrecreation', description: 'Free splash pads, playgrounds, community pools, and seasonal kids programs.' },
  { name: 'NM Museum of Natural History', url: 'https://www.nmnaturalhistory.org', description: 'Dinosaur skeletons, a planetarium, and exhibits kids actually love.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Family', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'kids-activities',
        heading: 'Kids Activities in Albuquerque',
        lede: `Discover ${events.length} things to do with kids in Albuquerque — from the BioPark to pop-up events that save your weekend.`,
        intro: 'You\'ve got kids. You need to get them out of the house before you lose your mind. Albuquerque is surprisingly great for that. The BioPark has the zoo, aquarium, and botanic garden all in one spot — plus a train that connects them. Explora is the hands-on science museum where kids can touch everything and you can drink coffee while they learn. The Children\'s Museum at Alameda and Eubank is another solid option for little ones. But here\'s the thing: you already know about those. What you might not know are the pop-up events — free splash pad days, Saturday morning story times at local libraries, or the occasional kite festival at Balloon Fiesta Park. We pull from the City of Albuquerque\'s Parks and Recreation events page for the latest free outdoor activities. Also, the ABQ BioPark\'s official site updates their daily schedule. And Explora\'s events calendar has workshops and late-night play nights. We filter out the fluff — no boring museum exhibits, just stuff that\'ll make your kids say "again!" and you\'ll survive.',
        introExtra: 'Not every kid activity needs to be a big production. Sometimes it\'s a free bike rodeo at a community center or a nature walk at the Rio Grande Nature Center. We check the Bernalillo County Parks and Recreation calendar and the Albuquerque Public Schools community events page for those hidden gems. And for rainy days, Explora and the Children\'s Museum are always solid backups. Just pick something, put on shoes, and go — your couch can wait.',
        emptyHeading: 'No kids activities listed right now',
        emptyBody: 'New kids events get added all the time. Check back soon — especially on weekends and school holidays.',
        breadcrumbLabel: 'Kids Activities',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
