/**
 * SEO landing page: Albuquerque Balloon Fiesta
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'
import { ScheduleTable } from './ScheduleTable'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Albuquerque Balloon Fiesta 2026: Events, Schedule & What to Know | ABQ Unplugged'
const SEO_DESC = 'Find Balloon Fiesta 2026 events, schedules, and insider tips. Mass ascensions, glows, concerts. Don\'t just say you\'ll go. Actually go.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/balloon-fiesta',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Albuquerque Balloon Fiesta' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/balloon-fiesta' },
}

const FAQS = [
  {
    q: 'When is the 2026 Albuquerque International Balloon Fiesta?',
    a: 'It runs for nine days in early October. Exact dates are announced by the official Balloon Fiesta site around March. Historically it runs from the first Saturday of October through the following Sunday: nine days total.',
  },
  {
    q: 'Do I need tickets for Balloon Fiesta?',
    a: 'General admission to the launch field requires a ticket; it\'s not free. Adult tickets run around $15 to $20 per day. Some special events like the Evening Glow or the Music Fiesta require separate tickets and sell out fast. Buy in advance at balloonfiesta.com.',
  },
  {
    q: 'Where do I park for Balloon Fiesta?',
    a: 'Official parking is at Balloon Fiesta Park (8401 Balloon Museum Dr NE). A better option: take the park-and-ride buses from designated lots around the city. They run before dawn for the mass ascensions and drop you at the entrance. The city posts the park-and-ride locations each year at cabq.gov. Lots fill before 5am on peak days, so plan accordingly.',
  },
  {
    q: 'What are the best viewing spots for Balloon Fiesta?',
    a: 'Inside the field is the real experience: you\'re walking among hundreds of balloons inflating at ground level. But free viewing from the west mesa gives you a spectacular skyline shot with the Sandia Mountains behind the balloons. Paseo del Norte along the Rio Grande is popular. For the evening glow, being inside the field is worth the ticket. Balloons lit from within against a dark sky is something you have to see.',
  },
  {
    q: 'What should I wear and bring to Balloon Fiesta?',
    a: 'October mornings in Albuquerque are cold (35 to 45°F at launch time). Layer up: base layer, fleece, windbreaker. Wear comfortable walking shoes since the field is large and partly grass/dirt. Bring cash for food vendors. Earplugs for the propane burners (surprisingly loud). A light rain layer just in case. Leave large bags at home; security lines move slowly. And bring a camera (obvious, but necessary).',
  },
  {
    q: 'What\'s the best day to go to Balloon Fiesta?',
    a: 'Weekday mornings (Tuesday through Thursday) are less crowded and the mass ascensions happen regardless of day. Saturday and Sunday are packed but the energy is at its peak. If you can only go once, the first Saturday opening day is electric, but arrive by 4:30am if you want to park. The Special Shapes Rodeo (usually Wednesday and Saturday) is a fan favorite.',
  },
]

const RELATED_LINKS = [
  { name: 'Balloon Fiesta Official Site', url: 'https://www.balloonfiesta.com', description: 'Official source for schedules, tickets, and visitor info for the nine-day event.' },
  { name: 'Visit Albuquerque: Balloon Fiesta', url: 'https://www.visitalbuquerque.org/balloon-fiesta/', description: 'Tourism board guide with lodging, transport, and local tips for fiesta week.' },
  { name: 'City of ABQ: Balloon Fiesta Park', url: 'https://www.cabq.gov/parksandrecreation/parks/balloon-fiesta-park', description: 'Park info, parking, and year-round events at the Balloon Fiesta grounds.' },
  { name: 'NM Tourism: Balloon Fiesta', url: 'https://www.newmexico.org/balloon-fiesta/', description: 'State tourism overview of the world\'s largest balloon festival.' },
]

export default async function Page() {
  // search matches venue_name too, which would pull in any unrelated event
  // just held at "Balloon Fiesta Park" (e.g. an April food truck festival) —
  // require the event's own title to actually name Balloon Fiesta.
  const { events: searchResults } = await fetchEvents({ search: 'balloon fiesta', limit: 200 })
  const events = searchResults.filter((e) => e.title.toLowerCase().includes('balloon fiesta'))

  return (
    <CuratedListPage
      events={events}
      extraSection={<ScheduleTable events={events} />}
      config={{
        slug: 'balloon-fiesta',
        heading: 'Albuquerque Balloon Fiesta',
        lede: `Find ${events.length} Balloon Fiesta events: mass ascensions, evening glows, and everything in between.`,
        intro: 'Look, every Albuquerque local has that friend who swears they\'ll go to Balloon Fiesta "next year." Next year comes. They don\'t go. Don\'t be that person. The Albuquerque International Balloon Fiesta is nine days in October, and it\'s the reason people move here. The sky fills with hundreds of balloons, the Field of Dreams turns into a walking rainbow, and the smell of breakfast burritos mixes with propane. It\'s chaotic, cold in the morning, and totally worth it. The official Balloon Fiesta site posts the full schedule, but we break it down into what\'s actually worth your time. Mass ascensions at dawn? Yes, even if it means waking up at 4am. The evening glow? Magical. And the special shapes rodeo is for the weirdos (I say that affectionately). We list dates, times, parking info, and tips from people who\'ve done this a dozen times. Don\'t scroll past this. Get your crew together and make it happen. One week a year, Albuquerque becomes the center of the ballooning world. Be there.',
        introExtra: 'Let\'s be real: Balloon Fiesta can feel overwhelming. Thousands of people, early mornings, traffic. But the payoff is unreal. We\'ve linked to the official Balloon Fiesta site for the hard numbers, and we also pull from Visit Albuquerque\'s essential visitor guide for logistics. Plus, the City of Albuquerque\'s events page has the lowdown on road closures and park-and-ride spots. Our goal is to cut through the noise and give you the one thing you need: a clear plan to actually go. No excuses.',
        venueStrip: [
          { name: 'Balloon Fiesta Park',   emoji: '🎈', href: 'https://www.balloonfiesta.com' },
          { name: 'Visit Albuquerque',     emoji: '🗺️', href: 'https://www.visitalbuquerque.org/balloon-fiesta/' },
          { name: 'Old Town ABQ',          emoji: '⛪', href: 'https://oldtownalbuquerqueabq.com' },
          { name: 'Canteen Brewhouse',     emoji: '🍺', href: 'https://canteenbrewhouse.com' },
          { name: 'NHCC',                  emoji: '🎭', href: 'https://nhccnm.org' },
        ],
        emptyHeading: 'No balloon fiesta listings right now',
        emptyBody: 'Check back as October approaches. Events get added daily. The official Balloon Fiesta site starts releasing specific times in late summer.',
        breadcrumbLabel: 'Balloon Fiesta',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
