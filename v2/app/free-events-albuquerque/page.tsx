/**
 * SEO landing page: Free Events in Albuquerque
 * Targets "free things to do in Albuquerque today/this weekend" — high volume.
 * Different from /free (filtered event list) — this is a richer guide.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Free Events in Albuquerque — Things to Do for Free | ABQ Unplugged'
const SEO_DESC =
  'Find free events in Albuquerque — concerts, festivals, farmers markets, museum free days, outdoor activities, and community events. No cover, no ticket price.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/free-events-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Free Events in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/free-events-albuquerque' },
}

const FAQS = [
  {
    q: "What free things are there to do in Albuquerque?",
    a: "Albuquerque has more free events than most cities its size. The ABQ BioPark has free days, Old Town has free historical tours, the Petroglyph National Monument is free to walk, and the city's library system hosts free events weekly including concerts, art shows, and lectures. Outdoor concerts at Civic Plaza, brewery live music nights, and the Sunday BioPark Botanic Garden trail are all free.",
  },
  {
    q: "Are there free events in Albuquerque this weekend?",
    a: "Yes — most weekends in Albuquerque include free outdoor events, farmers markets, art walks, and community festivals. First Fridays in the Downtown and Nob Hill arts district features free gallery openings. The South Valley Growers Market is free to attend. Browse the upcoming free events above for this weekend's specific listings.",
  },
  {
    q: "What is free at the Albuquerque Museum?",
    a: "The Albuquerque Museum offers free Sunday mornings (9am–1pm) and free admission the first Friday of each month after 5pm. New Mexico residents also get discounted admission many days. Check their current schedule for free event programming.",
  },
  {
    q: "Are Albuquerque library events free?",
    a: "Yes — all Bernalillo County and City of Albuquerque library events are free and open to the public. Libraries host concerts, art shows, lectures, film screenings, storytime sessions, and workshops. ABQ Unplugged pulls these into the listings above automatically.",
  },
  {
    q: "Where are free outdoor concerts in Albuquerque?",
    a: "Civic Plaza hosts free outdoor concerts and festivals throughout the summer. The New Mexico State Fair and Balloon Fiesta Park both have free general admission. Tractor Brewing, Marble Brewery, and La Cumbre regularly host free live music on their patios.",
  },
]

const RELATED_LINKS = [
  { name: 'Free Events (Filtered List)', url: 'https://abqunplugged.com/free', description: 'Quick-filter view of all free upcoming events in ABQ.' },
  { name: 'Family-Friendly Events', url: 'https://abqunplugged.com/family-friendly', description: 'Kid-friendly events, many of which are also free.' },
  { name: 'Things to Do This Weekend', url: 'https://abqunplugged.com/things-to-do-this-weekend', description: "What's happening in ABQ this weekend across all categories." },
  { name: 'Bernalillo County Library Events', url: 'https://www.bernco.gov/library/events/', description: 'Free library programming across all Bernalillo County branches.' },
  { name: 'City of ABQ Parks & Rec Events', url: 'https://www.cabq.gov/parksandrecreation/recreation/events', description: 'Free and low-cost city-run events and programs.' },
]

export default async function Page() {
  const { events } = await fetchEvents({
    freeOnly: true,
    timeFilter: 'upcoming',
    limit: 200,
  })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'free-events-albuquerque',
        heading: 'Free Events in Albuquerque',
        lede: `${events.length} upcoming free events in Albuquerque — concerts, festivals, markets, and more. No ticket price required.`,
        intro:
          "The best things in Albuquerque don't cost anything. The Petroglyph National Monument is free to walk. The Bosque trail is free. The library jazz series is free. The Albuquerque Museum gives away Sunday mornings for free. First Fridays in Nob Hill is a gallery walk where you can spend the whole evening on free wine and free art if you time it right. This city has a deep tradition of public life — outdoor concerts at Civic Plaza, fiestas in Old Town, community markets in the South Valley. None of it requires a ticket. ABQ Unplugged pulls free events from every source we track: Ticketmaster (yes, free events show up there), Eventbrite, SeatGeek, local libraries, community centers, and volunteer organizations. The list above is everything free that we know about, sorted by date. Filter by category or neighborhood to find what's near you. No upsells. No sponsored listings. Just the actual free stuff.",
        emptyHeading: "No free events listed right now",
        emptyBody: "Our sources update daily — check back soon. You can also browse all upcoming events and filter by price.",
        breadcrumbLabel: 'Free Events in Albuquerque',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
