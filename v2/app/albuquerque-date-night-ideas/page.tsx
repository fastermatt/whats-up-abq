/**
 * SEO landing page: Albuquerque Date Night Ideas
 * Targets "albuquerque date night ideas" (~1,600/mo) — a guide, not just a filtered list.
 * Different from /date-night (filtered event list) — this is a curated recommendation page.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Albuquerque Date Night Ideas — Romantic Things to Do in ABQ | ABQ Unplugged'
const SEO_DESC =
  'The best date night ideas in Albuquerque — live music at Sister Bar, dinner in Nob Hill, concerts at El Rey, Old Town walks, rooftop views. Real ideas from an ABQ local.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/albuquerque-date-night-ideas',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Date Night Ideas in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/albuquerque-date-night-ideas' },
}

const FAQS = [
  {
    q: "What are the best date night ideas in Albuquerque?",
    a: "Top date night options in ABQ: catch a show at the El Rey Theater (intimate venue, great sound), walk Old Town at night (historic, free, underrated), take the Sandia Peak Tramway at sunset, do the Nob Hill restaurant + bar crawl (Central Ave between Girard and Washington), or attend a live music show at Launchpad or Sister Bar. For something unique, Popejoy Hall at UNM has ballet, opera, and Broadway shows.",
  },
  {
    q: "What are cheap date ideas in Albuquerque?",
    a: "Free or low-cost dates in ABQ: the Bosque Trail walk along the Rio Grande (sunset is gorgeous), First Fridays gallery walk in Nob Hill (free wine at many galleries), Petroglyph National Monument at dusk, brewery patio nights at Marble or Tractor Brewing (free live music some nights), Old Town plaza, or the ABQ BioPark if you catch a free admission day.",
  },
  {
    q: "What is there to do on a date night in Albuquerque?",
    a: "Dinner + show is the classic formula: grab green chile at Casa de Benavidez or El Pinto, then head to a Sunshine Theater or El Rey show. Or try the Nob Hill restaurant district (Frenchish, Juniper, Vernon's Jazz Club) then walk to whatever's playing at The Box. For something different: Explora science museum has evening events. The National Hispanic Cultural Center has performances. The Albuquerque Museum has late-night events periodically.",
  },
  {
    q: "Where is the most romantic spot in Albuquerque?",
    a: "The Sandia Peak Tramway at sunset is hard to beat — the Sandias turn watermelon pink and the city lights up below. Old Town at night with the adobe architecture and string lights is genuinely romantic. The rooftop at Hotel Chaco in Old Town has exceptional views. The Bosque at golden hour during cottonwood fall (October) is one of the most beautiful things in New Mexico.",
  },
  {
    q: "What restaurants are good for a date in Albuquerque?",
    a: "For a special occasion: Los Poblanos Historic Inn (farm-to-table in a lavender field — book early), Frenchish in Nob Hill (French-influenced, excellent wine list), Vernon's Jazz Club (dinner with live jazz), Juniper in Nob Hill (New American, intimate room), or Antiquity Restaurant in Old Town (white tablecloths, romantic basement dining since 1972). For something more casual but still great: Duran's Central Pharmacy has incredible homestyle New Mexican food.",
  },
]

const RELATED_LINKS = [
  { name: 'Date Night Events Filter', url: 'https://abqunplugged.com/date-night', description: 'Browse upcoming date-worthy events in Albuquerque.' },
  { name: 'Live Music in Albuquerque', url: 'https://abqunplugged.com/live-music', description: 'Full live music calendar — great for date nights.' },
  { name: 'Comedy Shows in ABQ', url: 'https://abqunplugged.com/comedy', description: "Comedy shows make great dates — check Hyena's and Laffs." },
  { name: 'Sandia Peak Tramway', url: 'https://sandiapeak.com', description: 'The world\'s longest aerial tramway — sunset rides are unforgettable.' },
  { name: 'Visit ABQ: Date Night Guide', url: 'https://www.visitalbuquerque.org/things-to-do/date-night/', description: 'Tourism board recommendations for romantic activities in ABQ.' },
]

export default async function Page() {
  const { events } = await fetchEvents({
    timeFilter: 'upcoming',
    limit: 60,
  })

  // Filter for events with romantic/date-night appeal
  const dateNightEvents = events.filter(e => {
    const cat = e.category ?? ''
    return ['Music', 'Arts & Theater', 'Comedy', 'Film', 'Food & Drink'].includes(cat)
  }).slice(0, 40)

  const count = dateNightEvents.length

  return (
    <CuratedListPage
      events={dateNightEvents}
      config={{
        slug: 'albuquerque-date-night-ideas',
        heading: 'Albuquerque Date Night Ideas',
        lede: `${count} upcoming events worth putting on date night — music, arts, comedy, and food in ABQ.`,
        intro:
          "Albuquerque date nights have a certain flavor. It's not New York or LA. You're not fighting for a reservation three weeks out or spending eighty bucks a head just to feel like you went somewhere. ABQ has a different register. You pick a show at the El Rey — an intimate venue where the sound actually reaches you and the sightlines are excellent from anywhere. You get dinner on Central in Nob Hill beforehand, nothing fancy, maybe Frenchish if you want to try. Walk back to the car afterward, see the Sandia Mountains lit pink, say something about how you should do this more often. That's the date night formula here. The trick is knowing what's worth going to. The calendar above is everything we know about: live music at Sister Bar, comedy at Hyena's, theater at Popejoy, art openings on First Fridays, Isotopes games on a warm summer evening. Real venues, real shows, with the prices and times. Filter by what you're into. If you need a restaurant recommendation, the FAQ section has that covered. The main thing is: go somewhere. ABQ has more going on than most people realize. Use it.",
        introExtra:
          "A note on the date-night restaurant question: everyone asks where to eat. Los Poblanos is the answer for special occasions — it's a farm, a lavender field, and a restaurant all in one. Book weeks out. For something more spontaneous, the Nob Hill stretch of Central has Frenchish, Vernon's for jazz and dinner, and Juniper. Old Town has Antiquity, which has been a date restaurant for fifty years and hasn't needed to change. For green chile — because you're in New Mexico and you should eat green chile — go to Casa de Benavidez on Fourth Street. It's not a romantic setting but the food is the point.",
        emptyHeading: 'No upcoming events right now',
        emptyBody: 'New events get added daily. Browse the full events calendar or check back tomorrow.',
        breadcrumbLabel: 'Albuquerque Date Night Ideas',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
