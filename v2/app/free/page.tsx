/**
 * SEO landing page: Free Things to Do in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Free Things to Do in Albuquerque, NM | ABQ Unplugged'
const SEO_DESC = 'Free events in Albuquerque, NM — concerts, family activities, museum days, gallery openings, and more. Updated daily.'

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/free',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Free Things to Do in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/free' },
}

const FAQS = [
  {
    q: 'What\'s the best free thing to do on a weekend?',
    a: 'Hike the La Luz Trail? No, that\'s not free? Actually it\'s free – you just park. Or go to the Artwalk on Friday. Or check the city events page for free concerts.',
  },
  {
    q: 'Are museums ever free?',
    a: 'Yes. The Albuquerque Museum is free first Fridays. The Indian Pueblo Cultural Center has free admission on certain holidays. The Natural History Museum? Not usually free. But the library has free passes you can check out to some museums.',
  },
  {
    q: 'Where can I find a list of free events?',
    a: 'The city\'s website has a calendar. Also the ABQ Free Stuff Facebook group is active. Or just walk around downtown – there\'s always something posted on the community board at the library.',
  },
]

const RELATED_LINKS = [
  { name: 'City of ABQ: Events Calendar', url: 'https://www.cabq.gov/calendar', description: 'Official city calendar for free concerts, festivals, and community events.' },
  { name: 'ABQ BioPark', url: 'https://www.cabq.gov/abqbiopark', description: 'Zoo, aquarium, and botanic garden — some days have reduced or free admission.' },
  { name: 'Visit ABQ: Free Things to Do', url: 'https://www.visitalbuquerque.org/things-to-do/free/', description: 'Tourism board curated list of free activities in Albuquerque.' },
  { name: 'NM State Parks', url: 'https://www.emnrd.nm.gov/spd/', description: 'State parks — many within an hour of ABQ and free or low-cost.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ freeOnly: true, limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'free',
        heading: 'Free Things to Do in Albuquerque',
        lede: `${events.length} free events coming up — concerts, art openings, family activities, and more.`,
        intro: 'Albuquerque has a genuinely impressive free events calendar. Most residents don\'t even know about it. We\'ve been sleeping on our own city. Example: the Summerfest concert series at the Civic Plaza. Free live music every week. Salsa dancing, rock bands, local acts. You bring a blanket, you sit on the concrete, you listen. Also free. The Albuquerque Museum is free on the first Friday of the month. The Indian Pueblo Cultural Center is free on certain days? Check that. The Petroglyph National Monument is free – just park on the street. We\'ve got the Rail Yards Market in the summer, free entry, local vendors. The Artwalk is free. The zoo is not free, but the zoo\'s parking is free if you know the trick (park across the street). The Rio Grande Nature Center is free on weekends. And then there\'s the whole outdoors – hiking the Sandias, walking the Bosque, that\'s zero dollars. The city runs free fitness classes in parks. Free yoga at the Balloon Fiesta Park? I\'ve heard. I\'m telling you, you don\'t need money to have a good day in Albuquerque. You just need a little curiosity. And maybe a water bottle. The sun is relentless. But the free stuff is real. I\'ve spent entire weekends without spending a dime. Just exploring the trails, the neighborhoods, the events. Most people don\'t bother. Their loss.',
        introExtra: 'A few years ago, I was broke. Flat broke. I set a challenge: have a weekend with zero spending. I did it. Started Saturday at the Downtown Growers Market – just walked around, didn\'t buy anything. Then I hiked the Embudo Trail. Then I watched a free concert at Civic Plaza. Sunday I went to the Artwalk. I had packed sandwiches. It was one of the best weekends I\'ve had. Proof that fun and money are not connected.',
        emptyHeading: 'No free events listed right now',
        emptyBody: 'Our list refreshes daily. Check back tomorrow or browse all upcoming events.',
        breadcrumbLabel: 'Free Events',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
