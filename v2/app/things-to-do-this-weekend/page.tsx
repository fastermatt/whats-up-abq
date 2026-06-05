/**
 * SEO landing page: Things to Do This Weekend in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Things to Do in Albuquerque This Weekend — Events & Activities | ABQ Unplugged'
const SEO_DESC = 'Stuck in the Friday night scroll? Find real things to do this weekend in Albuquerque — free, cheap, or worth the splurge.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/things-to-do-this-weekend',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Things to Do This Weekend in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/things-to-do-this-weekend' },
}

const FAQS = [
  {
    q: 'What free events happen in Albuquerque this weekend?',
    a: 'Free events vary by week. Check Visit Albuquerque\'s weekend guide for the latest. Common freebies: outdoor concerts at Civic Plaza, art walks in the OBG, and community market days.',
  },
  {
    q: 'How far in advance should I buy tickets for weekend events?',
    a: 'Popular concerts and festivals sell out weeks ahead. For casual stuff like a museum or a movie, day-of is fine. We note sell-out risks in our listings.',
  },
  {
    q: 'What if I don\'t see anything I like?',
    a: 'Browse our other pages — Balloon Fiesta, festivals, concerts, or kids activities. Something will click. Albuquerque rarely has a boring weekend.',
  },
]

const RELATED_LINKS = [
  { name: 'Visit ABQ: Events', url: 'https://www.visitalbuquerque.org/events/', description: 'Official tourism board events calendar — updated weekly with the best bets.' },
  { name: 'City of ABQ: Events', url: 'https://www.cabq.gov/calendar', description: 'City-run and city-permitted events, free concerts, and community happenings.' },
  { name: 'National Hispanic Cultural Center', url: 'https://www.nhccnm.org', description: 'Weekend performances, art exhibitions, and film screenings in the South Valley.' },
  { name: 'NM Tourism: Weekend Guide', url: 'https://www.newmexico.org/things-to-do/events/', description: 'Statewide weekend event picks worth the short drive from ABQ.' },
]

export default async function Page() {
  const results = await Promise.all([
    fetchEvents({ category: 'Music', limit: 60 }),
    fetchEvents({ category: 'Arts & Theater', limit: 60 }),
    fetchEvents({ category: 'Comedy', limit: 60 }),
    fetchEvents({ category: 'Family', limit: 60 }),
    fetchEvents({ category: 'Food & Drink', limit: 60 }),
    fetchEvents({ category: 'Outdoor', limit: 60 }),
  ])
  const events = results
    .flatMap(r => r.events)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 200)

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'things-to-do-this-weekend',
        heading: 'Things to Do This Weekend in Albuquerque',
        lede: `Find ${events.length} things happening in Albuquerque this weekend — concerts, festivals, family fun, and stuff you'd actually enjoy.`,
        venueStrip: [
          { name: 'Tingley Coliseum',       emoji: '🏟️', href: 'https://www.tingleycoliseum.com' },
          { name: 'Isleta Amphitheater',    emoji: '🎶', href: 'https://www.isletaamphitheater.net' },
          { name: 'KiMo Theatre',           emoji: '🎭', href: 'https://cabq.gov/culturalservices/kimo' },
          { name: 'Explora',                emoji: '🔬', href: 'https://www.explora.us' },
          { name: 'ABQ BioPark',            emoji: '🦒', href: 'https://www.cabq.gov/artsculture/biopark' },
          { name: 'Rail Yards Market',      emoji: '🌿', href: 'https://www.railyardsmarket.org' },
        ],
        intro: 'It\'s Friday afternoon. You\'re staring at your phone, thinking "there\'s nothing to do." Wrong. Albuquerque always has something happening. The problem isn\'t a lack of events — it\'s finding them without clicking through ten different websites. That\'s why this page exists. We curate everything happening this weekend: concerts at Tingley or Isleta, festivals in Old Town or the fairgrounds, family stuff at Explora or the BioPark, even random things like a craft beer pop-up or a film screening at the KiMo. We pull from Ticketmaster, SeatGeek, Eventbrite, NHCC, and local community sources — all combined in one place. Whether your budget is zero or unlimited, you\'ll find something here. Stop scrolling. Pick something. Go.',
        introExtra: 'Your weekend is precious. Don\'t waste it debating where to go. This page updates daily with the best bets for Friday, Saturday, and Sunday — a mix of free stuff (art openings, chalk festivals, library programs) and ticketed shows. We also pull in stuff at the National Hispanic Cultural Center, the Rail Yards Market, and neighborhood events that don\'t get much press. You\'ll find something.',
        emptyHeading: 'No events this weekend',
        emptyBody: 'Check back soon — we update daily with the best weekend events. Or browse all upcoming events.',
        breadcrumbLabel: 'This Weekend',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
