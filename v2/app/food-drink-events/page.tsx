/**
 * SEO landing page: Food & Drink Events in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Food & Drink Events in Albuquerque, NM | ABQ Unplugged'
const SEO_DESC = 'Wine festivals, food trucks, farmers markets, beer fests — find food and drink events in Albuquerque. Updated daily.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/food-drink-events',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Food & Drink Events in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/food-drink-events' },
}

const FAQS = [
  {
    q: 'When is the New Mexico Wine Festival?',
    a: 'Usually in late September or early October. Check the Expo New Mexico calendar. It\'s a weekend thing, tickets are about $30 includes a tasting glass.',
  },
  {
    q: 'Best food festival for green chile lovers?',
    a: 'The Fiery Foods & BBQ Festival in March. You\'ll find everything with heat. Also the New Mexico State Fair has a green chile cheeseburger contest that\'s worth attending.',
  },
  {
    q: 'Are there any free food events?',
    a: 'The Farmers Markets are free to enter. The Downtown Growers Market on Saturdays has free samples often. Some beer festivals have free admission if you just want to walk around.',
  },
]

const RELATED_LINKS = [
  { name: 'Visit ABQ: Food & Drink', url: 'https://www.visitalbuquerque.org/things-to-do/food-and-drink/', description: 'Official guide to Albuquerque\'s restaurant and food event scene.' },
  { name: 'Downtown Growers Market', url: 'https://www.downtowngrowers.org', description: 'Saturday morning farmers market in downtown ABQ — food, music, and local vendors.' },
  { name: 'New Mexico Restaurant Association', url: 'https://www.nmrestaurants.org', description: 'Industry association with a calendar of food events and tastings across the state.' },
  { name: 'Expo NM', url: 'https://www.exponm.com', description: 'State fairgrounds hosting major food festivals, fairs, and specialty events year-round.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Food & Drink', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'food-drink-events',
        heading: 'Food & Drink Events in Albuquerque',
        lede: `${events.length} food and drink events — tastings, festivals, markets, and events worth eating your way through.`,
        intro: 'Let\'s make this clear: green chile is not a food festival. It\'s a way of life. But the food event scene in Albuquerque goes way beyond that. We have the New Mexico Wine Festival at the fairgrounds every fall. Local wineries, most of which you\'ve never heard of. The wines are sweet, mostly. But the vibe is good. Then there\'s the Tamalada – a tamale-making event that\'s more of a community thing than a public festival, but you can find versions of it. The Albuquerque Food Truck Festival happens a few times a year. That\'s where you can try everything from Korean tacos to fried mac and cheese. The Farmers Markets are huge – the one at Downtown on Saturdays, the one at Los Ranchos. They\'re not just produce. They\'re food events. You can eat breakfast, listen to a band, buy honey. The Brewers Festival at the Expo New Mexico is a big deal, too. Dozens of breweries, local and regional, with samples. It gets crowded. But it\'s worth it. And let\'s not forget the Fiery Foods & BBQ Festival – that\'s all about heat. Hot sauces, salsa, spicy everything. You\'ll sweat. You\'ll love it. The food scene here is not about white tablecloths. It\'s about flavor. About chile. About people who eat well and don\'t apologize for it.',
        introExtra: 'I went to the Wine Festival last year. It was hot. The wine was mostly bad. But I sat on a blanket with friends, we bought a bottle of something called \'Pecos River Red,\' and we laughed. That\'s the point. Food events here are about the people, not the cuisine. Same at the Tamale Festival – the tamales are good but the real show is the families making them together. It\'s a culture thing. You get a glimpse into why people stay here.',
        emptyHeading: 'No food or drink events listed right now',
        emptyBody: 'New events added daily — check back soon.',
        breadcrumbLabel: 'Food & Drink Events',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
