/**
 * SEO landing page: Albuquerque Balloon Fiesta
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { ScheduleTable } from './ScheduleTable'
import { ItineraryPlanner, type PlannerEvent } from './ItineraryPlanner'
import { FiestaAtAGlance } from './FiestaAtAGlance'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Balloon Fiesta 2026 Itinerary: What to Do Before & After | ABQ Unplugged'
const SEO_DESC = 'Build your Albuquerque Balloon Fiesta day: five local itineraries for food, kids, shopping, the tram, evening glows, and weather cancellations.'
const FIESTA_IMAGE = 'https://bsmvfutebmbkjvlrhiyq.supabase.co/storage/v1/object/public/event-photos/balloon-fiesta-2026-nasa-1788286880.webp'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/balloon-fiesta',
    images: [{ url: FIESTA_IMAGE, width: 1200, height: 630, alt: 'Hot air balloons rising over Albuquerque during Balloon Fiesta' }],
  },
  twitter: { card: 'summary_large_image', images: [FIESTA_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/balloon-fiesta' },
}

const FAQS = [
  {
    q: 'When is the 2026 Albuquerque International Balloon Fiesta?',
    a: 'The 2026 Albuquerque International Balloon Fiesta runs Saturday, October 3 through Sunday, October 11, 2026: nine days total.',
  },
  {
    q: 'Do I need tickets for Balloon Fiesta?',
    a: 'Yes. General admission is $20 per person, per session (about $22.24 online with fees), and children 12 and under are free. Each day can have a morning and evening session, ticketed separately. Buy through the official Balloon Fiesta site and confirm any special-event pricing there.',
  },
  {
    q: 'Where do I park for Balloon Fiesta?',
    a: 'Balloon Fiesta Park is at 4401 Alameda Boulevard NE, Albuquerque, NM 87113. Official parking and Park & Ride are both available on service days, but Park & Ride does not run Monday through Wednesday, October 5–7; it runs only the other six days. Locations are Cottonwood Mall, Coronado Center, Hoffmantown Church, and Intel on weekends. If you drive, use Waze for live rerouting because temporary closures and Fiesta traffic patterns can make ordinary mapping rough. Always follow police directions and event signs over any app.',
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
    a: 'Weekday mornings are generally less crowded, while Saturdays and Sundays bring the biggest energy and traffic. If you can only go once, choose the official program you care about most and arrive very early. In 2026, the Special Shape Rodeo and Glowdeo are Thursday and Friday, October 8–9. Always confirm the live program and weather status in the official Fiesta app.',
  },
]

const RELATED_LINKS = [
  { name: 'Balloon Fiesta Official Site', url: 'https://www.balloonfiesta.com', description: 'Official source for schedules, tickets, and visitor info for the nine-day event.' },
  { name: 'Visit Albuquerque: Balloon Fiesta', url: 'https://www.visitalbuquerque.org/balloon-fiesta/', description: 'Tourism board guide with lodging, transport, and local tips for fiesta week.' },
  { name: 'City of ABQ: Balloon Fiesta Park', url: 'https://www.cabq.gov/parksandrecreation/parks/balloon-fiesta-park', description: 'Park info, parking, and year-round events at the Balloon Fiesta grounds.' },
  { name: 'NM Tourism: Balloon Fiesta', url: 'https://www.newmexico.org/balloon-fiesta/', description: 'State tourism overview of the world\'s largest balloon festival.' },
]

type PageProps = {
  searchParams: Promise<{ src?: string; plan?: string; date?: string }>
}

function cleanParam(value: string | undefined, fallback: string): string {
  return value && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value) ? value : fallback
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const source = cleanParam(params.src, 'direct')
  const initialPlan = cleanParam(params.plan, 'left-the-field')
  const initialDate = /^2026-10-(0[3-9]|1[01])$/.test(params.date ?? '') ? params.date! : '2026-10-03'

  // search matches venue_name too, which would pull in any unrelated event
  // just held at "Balloon Fiesta Park" (e.g. an April food truck festival) —
  // require the event's own title to actually name Balloon Fiesta.
  const [{ events: searchResults }, ...localResults] = await Promise.all([
    fetchEvents({ search: 'balloon fiesta', limit: 200 }),
    fetchEvents({ category: 'Food & Drink', limit: 200 }),
    fetchEvents({ category: 'Family', limit: 200 }),
    fetchEvents({ category: 'Arts & Theater', limit: 200 }),
  ])
  const events = searchResults.filter((e) => e.title.toLowerCase().includes('balloon fiesta'))
  const localEvents: PlannerEvent[] = localResults
    .flatMap((result) => result.events)
    .filter((event) => event.date >= '2026-10-03' && event.date <= '2026-10-11')
    .filter((event) => !event.title.toLowerCase().includes('balloon fiesta'))
    .filter((event, index, all) => all.findIndex((candidate) => candidate.id === event.id) === index)
    .map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      venue: event.venue,
      category: event.category,
      href: `/events/${event.id}`,
    }))

  const festivalJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: 'Albuquerque International Balloon Fiesta 2026',
    description: SEO_DESC,
    startDate: '2026-10-03',
    endDate: '2026-10-11',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [FIESTA_IMAGE],
    location: {
      '@type': 'Place',
      name: 'Balloon Fiesta Park',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '4401 Alameda Boulevard NE',
        addressLocality: 'Albuquerque',
        addressRegion: 'NM',
        postalCode: '87113',
        addressCountry: 'US',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: 'Albuquerque International Balloon Fiesta',
      url: 'https://www.balloonfiesta.com/',
    },
    offers: {
      '@type': 'Offer',
      url: 'https://www.balloonfiesta.com/Purchase-Tickets/',
      price: '20',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      validFrom: '2026-01-01',
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(festivalJsonLd) }} />
      <CuratedListPage
        events={events}
        extraSection={(
          <div className="space-y-8">
            <ItineraryPlanner source={source} localEvents={localEvents} initialPlan={initialPlan} initialDate={initialDate} />
            <FiestaAtAGlance source={source} />
            <ScheduleTable events={events} />
          </div>
        )}
        config={{
          slug: 'balloon-fiesta',
          heading: 'Albuquerque Balloon Fiesta 2026',
          lede: `October 3–11, 2026 · Start with the balloons. Use our local planner for everything after.`,
          intro: 'Balloon Fiesta owns the sky. ABQ Unplugged helps you plan the city around it. Pick one of five ready-made days for food, families, local shopping, the Sandia Peak Tramway, an evening glow, or a weather cancellation—then see exactly how far each stop sits from Balloon Fiesta Park.',
          introExtra: 'Use the official Balloon Fiesta schedule and app for live program names, tickets, and weather calls. Use this page when you need the answer to the next question: what should we do with the rest of our day in Albuquerque?',
          heroImage: { src: FIESTA_IMAGE, alt: 'Mass ascension at the Albuquerque International Balloon Fiesta' },
          venueStrip: [
            { name: 'Official schedule', emoji: '🎈', href: 'https://www.balloonfiesta.com/plan-your-visit/event-schedule/' },
            { name: 'Park & Ride', emoji: '🚌', href: 'https://www.balloonfiesta.com/Park-Ride' },
            { name: 'Sandia Peak Tramway', emoji: '🚠', href: 'https://sandiapeak.com/' },
            { name: 'Old Town', emoji: '🛍️', href: 'https://www.cabq.gov/artsculture/historic-old-town' },
            { name: 'Local events', emoji: '📅', href: '/events?date=2026-10-03' },
          ],
          emptyHeading: 'No Balloon Fiesta ticket listings right now',
          emptyBody: 'The itinerary planner still works. For Fiesta admission and the live program, use the official Balloon Fiesta site.',
          breadcrumbLabel: 'Balloon Fiesta',
          faqs: FAQS,
          relatedLinks: RELATED_LINKS,
        }}
      />
    </>
  )
}
