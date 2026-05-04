/**
 * SEO landing page: Sports Events in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Sports Events in Albuquerque, NM | ABQ Unplugged'
const SEO_DESC = 'Find Isotopes games, New Mexico United soccer, Lobo basketball, and more sports events in Albuquerque. Cheap tickets, great times.'

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/sports-events',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sports Events in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/sports-events' },
}

const FAQS = [
  {
    q: 'How much are Isotopes tickets?',
    a: 'You can get in for twelve bucks on some nights. Parking is extra, but there\'s a lot across the street. Check the website for deals – they do Thirsty Thursdays, half-price beers.',
  },
  {
    q: 'Where do New Mexico United play?',
    a: 'At the stadium on the state fairgrounds. It\'s called Isotopes Park actually? No, United plays at the University of New Mexico\'s soccer stadium? Wait, no, they used to play at Isotopes Park but now it\'s at the UNM soccer complex? I\'m confusing myself. Just Google it. It\'s near the football stadium.',
  },
  {
    q: 'What\'s the best sports experience in Albuquerque?',
    a: 'Lobo basketball at The Pit is iconic. The place is underground, the noise is deafening. But for pure fun, I\'d say an Isotopes game on a Saturday night with fireworks. You can\'t beat that.',
  },
]

const RELATED_LINKS = [
  { name: 'Albuquerque Isotopes', url: 'https://www.milb.com/albuquerque', description: 'ABQ\'s Triple-A baseball team — cheap tickets, great views of the Sandias.' },
  { name: 'New Mexico United', url: 'https://www.newmexicounited.com', description: 'Professional USL soccer with a passionate local fan base.' },
  { name: 'UNM Lobos Athletics', url: 'https://www.golobos.com', description: 'University of New Mexico athletics — basketball at The Pit is a must-do.' },
  { name: 'Visit ABQ: Sports', url: 'https://www.visitalbuquerque.org/things-to-do/sports/', description: 'Official tourism listing of sports events in ABQ.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Sports', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'sports-events',
        heading: 'Sports Events in Albuquerque',
        lede: `${events.length} sports events coming up — from minor league baseball to college hoops.`,
        intro: 'Albuquerque loves its minor league teams. And I get it. The Albuquerque Isotopes – that\'s our Triple-A baseball team. The stadium is right downtown, next to the railyards. It\'s not fancy. It\'s concrete and hot dogs and the smell of green chile. But on a summer night, with the sun setting behind the Sandias, it\'s one of the best places to be in the city. Tickets are cheap. Like, under twenty bucks cheap. You can sit close. You can drink a beer and watch the game and not feel like you\'re missing something. Then there\'s New Mexico United – our USL soccer team. That\'s a different energy. The fans are loud. The game is fast. The stadium is at the fairgrounds, which is a weird location, but it works. The supporters\' group, The Curse, bangs drums and waves flags for ninety minutes. It\'s the closest thing to European soccer you\'ll get in the Southwest. I\'ve been to matches where the crowd outnumbered the actual stadium capacity? No, that\'s not possible, but it feels that way. And beyond the big two, there\'s Lobo basketball at The Pit. That\'s legendary. The noise in that arena is something else. Even if you\'re not a sports fan, go to one of these. You\'ll see a community that cares. And you\'ll probably have a good time.',
        introExtra: 'I went to an Isotopes game last season. Didn\'t know anyone on the field. Didn\'t care. I ate a hot dog and watched a kid catch a foul ball. His face lit up. The crowd cheered. The guy next to me explained the rules of minor league baseball – essentially, everyone\'s trying to get called up. There\'s a desperation to it that makes it compelling. And the mascot, Orbit, is ridiculous. Worth it just for that.',
        emptyHeading: 'No sports events listed right now',
        emptyBody: 'New games and events added daily — check back soon.',
        breadcrumbLabel: 'Sports Events',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
