/**
 * SEO landing page: Albuquerque Balloon Fiesta
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Albuquerque Balloon Fiesta 2026 — Events, Schedule & What to Know | ABQ Unplugged'
const SEO_DESC = 'Find Balloon Fiesta 2026 events, schedules, and insider tips. Mass ascensions, glows, concerts — don\'t just say you\'ll go. Actually go.'

export const metadata: Metadata = {
  title: SEO_TITLE,
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
    a: 'It runs for nine days in early October. Exact dates are announced by the official Balloon Fiesta site around March. Typically it\'s the first full week of October.',
  },
  {
    q: 'Do I need tickets for Balloon Fiesta?',
    a: 'General admission to the launch field is free. Some special events like the Evening Glow or the Music Fiesta require tickets. Check the official schedule — they sell out fast.',
  },
  {
    q: 'What\'s the best day to go?',
    a: 'Weekday mornings are less crowded. Saturday and Sunday are packed but the energy is incredible. If you can swing a Tuesday or Wednesday, you\'ll thank me.',
  },
]

const RELATED_LINKS = [
  { name: 'Balloon Fiesta Official Site', url: 'https://www.balloonfiesta.com', description: 'Official source for schedules, tickets, and visitor info for the nine-day event.' },
  { name: 'Visit Albuquerque: Balloon Fiesta', url: 'https://www.visitalbuquerque.org/balloon-fiesta/', description: 'Tourism board guide with lodging, transport, and local tips for fiesta week.' },
  { name: 'City of ABQ: Balloon Fiesta Park', url: 'https://www.cabq.gov/parksandrecreation/parks/balloon-fiesta-park', description: 'Park info, parking, and year-round events at the Balloon Fiesta grounds.' },
  { name: 'NM Tourism: Balloon Fiesta', url: 'https://www.newmexico.org/balloon-fiesta/', description: 'State tourism overview of the world\'s largest balloon festival.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Festivals', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'balloon-fiesta',
        heading: 'Albuquerque Balloon Fiesta',
        lede: `Find ${events.length} Balloon Fiesta events — mass ascensions, evening glows, and everything in between.`,
        intro: 'Look, every Albuquerque local has that friend who swears they\'ll go to Balloon Fiesta "next year." Next year comes. They don\'t go. Don\'t be that person. The Albuquerque International Balloon Fiesta is nine days in October — and it\'s the reason people move here. The sky fills with hundreds of balloons, the Field of Dreams turns into a walking rainbow, and the smell of breakfast burritos mixes with propane. It\'s chaotic, cold in the morning, and totally worth it. The official Balloon Fiesta site posts the full schedule, but we break it down into what\'s actually worth your time. Mass ascensions at dawn? Yes, even if it means waking up at 4am. The evening glow? Magical. And the special shapes rodeo? That\'s for the weirdos (I say that affectionately). We list dates, times, parking info, and tips from people who\'ve done this a dozen times. Don\'t scroll past this — get your crew together and make it happen. One week a year, Albuquerque becomes the center of the ballooning world. Be there.',
        introExtra: 'Let’s be real: Balloon Fiesta can feel overwhelming. Thousands of people, early mornings, traffic. But the payoff? Unreal. We’ve linked to the official Balloon Fiesta site for the hard numbers, and we also pull from Visit Albuquerque‘s essential visitor guide for logistics. Plus, the City of Albuquerque’s events page has the lowdown on road closures and park-and-ride spots. Our goal is to cut through the noise and give you the one thing you need: a clear plan to actually go. No excuses.',
        emptyHeading: 'No balloon fiesta listings right now',
        emptyBody: 'Check back as October approaches — events get added daily. The official Balloon Fiesta site starts releasing specific times in late summer.',
        breadcrumbLabel: 'Balloon Fiesta',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
