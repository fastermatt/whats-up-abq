/**
 * SEO landing page: Date Night Ideas in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Date Night Ideas in Albuquerque, NM | ABQ Unplugged'
const SEO_DESC = 'Date-night-perfect events in Albuquerque — concerts, comedy, wine tastings, theater, and more. Updated daily.'

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/date-night',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Date Night Ideas in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/date-night' },
}

const FAQS = [
  {
    q: 'What\'s a good first date spot?',
    a: 'The Sawmill Market is perfect. Lots of choices, casual, you can sit outside. Or the rooftop at Sister Bar if you want a view.',
  },
  {
    q: 'Any free date night ideas?',
    a: 'Sunset hike at the Sandias. Bring a blanket and snacks. Or walk the Bosque Trail. Or go to the Artwalk. All free.',
  },
  {
    q: 'Is dinner and a movie really that bad?',
    a: 'It\'s not bad, it\'s just uninspired. You can do better. Even a cheap dinner at a food truck and then a walk beats a chain restaurant and a Marvel movie.',
  },
]

const RELATED_LINKS = [
  { name: 'Visit ABQ: Romantic Things to Do', url: 'https://www.visitalbuquerque.org/things-to-do/romance/', description: 'Official tourism guide to romantic experiences in Albuquerque.' },
  { name: 'Popejoy Hall', url: 'https://popejoypresents.com', description: 'Elegant performing arts venue — a proper date-night destination.' },
  { name: 'Hotel Albuquerque', url: 'https://www.hotelabq.com', description: 'Historic Old Town hotel with a rooftop bar and regular evening events.' },
  { name: 'Guild Cinema', url: 'https://www.guildcinema.com', description: 'Independent art house cinema in Nob Hill — perfect for an indie movie date.' },
]

export default async function Page() {
  const DATE_CATEGORIES = ['Music', 'Comedy', 'Food & Drink', 'Arts & Theater', 'Film']
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
        lede: `${events.length} date-night events — concerts, comedy, theater, and spots worth showing up to.`,
        intro: 'I\'ll tell you about a real date night in Albuquerque. Not \'dinner and a movie.\' That\'s boring. Try this: start at the La Cumbre Brewing taproom. It\'s in a warehouse-y area near downtown. The beer is good, the space is loud, but there\'s a patio outside. Grab a flight. Share it. Talk. Don\'t look at your phone. Then walk over to the Sawmill Market – it\'s a food hall with tons of options. Get something from a stall you\'ve never tried. The ramen place is solid. The tacos are okay. But the point is picking together. After that, walk west to the Rio Grande. There\'s a path along the river. It\'s dark, but it\'s safe. The stars are visible. You can hear the water. It\'s quiet. Not romantic in a cheesy way. Romantic in a \'we\'re alive and this is real\' way. Then end at the Hotel Albuquerque\'s bar, or just go home. I did this once with someone. We didn\'t plan it, it just happened. That\'s the best kind of date night. One where you follow the vibe. Albuquerque is good for that – you can bounce around cheaply. No reservations needed. No pressure. You just need a sense of adventure and maybe a jacket. The nights get cold here. Even in summer. So bring one. Share it. That\'s already a date move.',
        introExtra: 'Another date idea: hit the Nob Hill area. Start at the Bookworks bookstore – browse for a while, pick a book for each other. Then go to the neighbor bar for a drink. The point is connection, not production. The romantic thing about Albuquerque is that you don\'t have to try so hard. The city does the work for you – the light, the sky, the quiet. You just show up.',
        emptyHeading: 'Nothing on the date-night list right now',
        emptyBody: 'New events added daily — check back tomorrow.',
        breadcrumbLabel: 'Date Night',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
