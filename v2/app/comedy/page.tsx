/**
 * SEO landing page: Comedy in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Comedy Shows in Albuquerque, NM | ABQ Unplugged'
const SEO_DESC = 'Find comedy shows and open mics in Albuquerque — from Laff\'s national headliners to basement open mics. Your local laugh guide.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/comedy',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Comedy in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/comedy' },
}

const FAQS = [
  {
    q: 'What\'s the best comedy club in town?',
    a: 'Laff\'s if you want a guaranteed show with known talent. Comedy Room if you want a cozier vibe. But honestly, the best comedy in ABQ is at an open mic. Check out the one at Rio Bravo Brewing on Tuesdays or Back Alley Draft House on Mondays.',
  },
  {
    q: 'Are there any free comedy shows?',
    a: 'Yeah, most open mics are free. You might need to buy a drink. The Marble Brewery downtown hosts a free comedy night sometimes. Follow @abqcomedy on Facebook for the latest. The scene moves fast.',
  },
  {
    q: 'Can I see a famous comedian here?',
    a: 'Sometimes. Laff\'s and the Comedy Room book national acts. Also Popejoy Hall gets bigger names. But don\'t expect a weekly lineup. The famous ones come through maybe once a month. The rest of the time you\'re supporting local. That\'s fine.',
  },
]

const RELATED_LINKS = [
  { name: 'Laff\'s Comedy Club', url: 'https://laffsmusicrooms.com', description: 'ABQ\'s main comedy club, booking national headliners on weekends.' },
  { name: 'Visit Albuquerque: Nightlife', url: 'https://www.visitalbuquerque.org/things-to-do/music-and-nightlife/', description: 'Tourism board guide to bars, clubs, and nighttime entertainment.' },
  { name: 'KiMo Theatre', url: 'https://www.cabq.gov/culturalservices/kimo', description: 'Historic 1927 Pueblo Deco theater hosting comedy, film, and performance.' },
  { name: 'Popejoy Hall at UNM', url: 'https://popejoypresents.com', description: 'UNM\'s performing arts center, occasionally hosting big-name comedy acts.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Comedy', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'comedy',
        heading: 'Comedy in Albuquerque',
        lede: `${events.length} comedy events — clubs, open mics, and acts you won't see coming.`,
        intro: 'Albuquerque has two real comedy clubs. Laff\'s on Juan Tabo is the big one. It\'s got the national headliners, the two-drink minimum, the whole deal. Then there\'s the Comedy Room near Old Town. Smaller, darker, feels like a joint that\'s seen some things. Both are fine. But the real comedy scene in this town happens at open mics. I\'m talking about the basement of a brewpub on a Monday night where a 22-year-old delivers a killer set about dating apps followed by a retired guy who does five minutes on his cat. That\'s the good stuff. That\'s where you find the comics who aren\'t polished yet, who are still figuring out their voice. And you know what? Those shows are often better than the clubs. There\'s no pressure. The audience is half-drunk and supportive. The comics are hungry. I\'ve seen sets at Rio Bravo Brewing that made me cry laughing. I\'ve seen sets at the Launchpad open mic that fell flat, but the comic bounced back. That\'s the thing about comedy here – it\'s real. It\'s not some Netflix special. It\'s a person on a stool with a mic, trying to make you forget your day. Give it a shot. You might find the next big thing. Or you might find a guy in a Breaking Bad shirt bomb for ten minutes. Either way, it\'s a story.',
        introExtra: 'One night I went to Laff\'s to see a comic I\'d never heard of. Expensive ticket. Mid crowd. The guy was fine. Then a friend dragged me to a free mic at a pizza joint on Central. The pizza was terrible. The comedy was electric. I stayed for three hours. The host was a woman who worked at a car dealership by day. She killed. That\'s the discrepancy. The paid clubs get you a name you recognize from TV. The free mics get you a future star. Or at least a good laugh and a slice of bad pizza.',
        emptyHeading: 'No comedy listings right now',
        emptyBody: 'New shows added daily — check back soon.',
        breadcrumbLabel: 'Comedy',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
