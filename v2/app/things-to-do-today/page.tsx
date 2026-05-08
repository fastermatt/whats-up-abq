/**
 * SEO landing page: Things to Do in Albuquerque Today
 * Targets "things to do in albuquerque today" — ~1,500/mo, high intent.
 * Revalidates every 30 minutes — today's events change as the day unfolds.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 1800 // 30 min

const SEO_TITLE = 'Things to Do in Albuquerque Today — Events Happening Now | ABQ Unplugged'
const SEO_DESC =
  "Find things to do in Albuquerque today. Live music, comedy, family events, outdoor activities, and free things to do — all happening today in ABQ."

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/things-to-do-today',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Things to Do in Albuquerque Today' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/things-to-do-today' },
}

const FAQS = [
  {
    q: "What is there to do in Albuquerque today?",
    a: "Albuquerque has live music, comedy shows, free outdoor events, library programming, community markets, arts openings, and family activities happening most days. ABQ Unplugged pulls from every major ticketing source and local community calendars — browse the listings above for today's specific events across all categories.",
  },
  {
    q: "What free things are there to do in Albuquerque today?",
    a: "Free options in ABQ today often include library events (Bernalillo County library system has free programming daily), outdoor activities at the Bosque Trail and Petroglyph National Monument, brewery patio music at Tractor Brewing, Marble, or La Cumbre, and arts walks in Nob Hill and Old Town. Use the Free filter above to see no-cover events today.",
  },
  {
    q: "What outdoor activities are available in Albuquerque today?",
    a: "The Bosque Trail along the Rio Grande is free and open year-round — 16 miles of paved path through cottonwood groves. The Tramway to Sandia Peak runs daily (weather permitting). Petroglyph National Monument is free to walk. Elena Gallegos Open Space has hiking with views of the city and Sandia Mountains.",
  },
  {
    q: "What is there to do in Albuquerque with kids today?",
    a: "Family options today include the ABQ BioPark (Aquarium, Botanical Garden, Zoo), the Explora science museum in the Sawmill District, library storytimes, and the Balloon Museum near Balloon Fiesta Park. Many of these have discounted or free days — check their websites before you go.",
  },
  {
    q: "What's happening in Albuquerque tonight?",
    a: "Tonight's live music and evening events are listed on our /live-music-tonight and /tonight pages — these update hourly as venues post their lineups. Comedy shows, sports events, and film screenings are also searchable from the main events page.",
  },
]

const RELATED_LINKS = [
  { name: 'Tonight in Albuquerque', url: 'https://abqunplugged.com/tonight', description: "Tonight's full event listing across all categories." },
  { name: 'Live Music Tonight', url: 'https://abqunplugged.com/live-music-tonight', description: "Live music shows happening tonight in ABQ." },
  { name: 'Free Events in ABQ', url: 'https://abqunplugged.com/free-events-albuquerque', description: 'Complete guide to free things to do in Albuquerque.' },
  { name: 'Family-Friendly Events', url: 'https://abqunplugged.com/family-friendly', description: 'Kid-friendly events happening in Albuquerque.' },
  { name: 'ABQ BioPark', url: 'https://www.cabq.gov/artsculture/biopark', description: 'Zoo, Aquarium, Botanic Garden, and Tingley Beach — all on one ticket.' },
  { name: 'Bernalillo County Library Events', url: 'https://www.bernco.gov/library/events/', description: 'Free programming at all county library branches today.' },
]

export default async function Page() {
  const { events } = await fetchEvents({
    timeFilter: 'today',
    limit: 200,
  })

  const count = events.length

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'things-to-do-today',
        heading: 'Things to Do in Albuquerque Today',
        lede:
          count > 0
            ? `${count} events happening in Albuquerque today — across music, arts, outdoor, family, and more.`
            : "Check back throughout the day — events get added as venues confirm their lineups.",
        intro:
          "The nice thing about Albuquerque is that something is almost always happening. Not in a New York way, where the options are so overwhelming you end up staying home. In an ABQ way — where there are enough things going on that you can actually find something, go to it, and feel like you made a good call. Today's list is what we know about right now. It updates throughout the day as venues post lineups, as libraries confirm their afternoon programs, as last-minute show announcements hit Eventbrite and Ticketmaster. The morning usually starts with outdoor stuff — the Bosque Trail, the Petroglyph trailheads, Elena Gallegos if you want a real hike. By afternoon, the museum and library circuit opens up. By evening, the music and comedy venues come alive. We track all of it: Ticketmaster, SeatGeek, Eventbrite, local community calendars, library systems, volunteer-organized events. If it's happening in Albuquerque today and it's worth your time, it's above. Use the category chips to filter down to what matters to you — whether that's live music, something free, family-friendly, or a sports event.",
        emptyHeading: "No events posted yet for today",
        emptyBody: "Our sources update throughout the morning — check back in a few hours. You can also browse tonight's events or the full upcoming calendar.",
        breadcrumbLabel: 'Things to Do Today',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
