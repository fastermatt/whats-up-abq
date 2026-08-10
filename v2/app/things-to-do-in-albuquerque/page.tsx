/**
 * SEO landing page: Things to Do in Albuquerque
 * Targets "things to do in albuquerque" — likely the highest-volume query for the site.
 * Different from /things-to-do (static places directory) and /things-to-do-this-weekend
 * (weekend-scoped). This is the evergreen comprehensive guide with live event data.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Things to Do in Albuquerque, NM — Events & Activities | ABQ Unplugged'
const SEO_DESC =
  'The best things to do in Albuquerque right now — live music, outdoor adventures, festivals, comedy, and events worth leaving the house for. Updated daily.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/things-to-do-in-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Things to Do in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/things-to-do-in-albuquerque' },
}

const FAQS = [
  {
    q: 'What are the best things to do in Albuquerque right now?',
    a: 'Check the live event listings above for what\'s actually happening today and this week. For always-available options: the Sandia Peak Aerial Tramway for mountain views, the ABQ BioPark for a full day (zoo + aquarium + botanic garden + Tingley Beach), Old Town for history and green chile, and the Bosque Trail along the Rio Grande for hiking and biking. The KiMo Theatre has performances most weekends, and Nob Hill on Central Ave has bars, restaurants, and galleries.',
  },
  {
    q: 'What is Albuquerque best known for?',
    a: 'The Albuquerque International Balloon Fiesta in October — it\'s the world\'s largest hot air balloon festival. The Sandia Mountains rising over the east side of the city. Breaking Bad (and Better Call Saul) filming locations scattered throughout. World-class New Mexican cuisine, specifically green and red chile that you can\'t get anywhere else. And a creative, arts-forward community that punches well above its population.',
  },
  {
    q: 'Is Albuquerque worth visiting?',
    a: 'Yes, especially if you\'re expecting Santa Fe prices. ABQ is half the cost and twice as real. It has genuine neighborhoods, a working arts scene, a beer culture that\'s earned its reputation, and outdoor access most cities would kill for. Petroglyph National Monument is free. The Bosque is free. Most of the good stuff costs almost nothing.',
  },
  {
    q: 'What\'s the best neighborhood to explore in Albuquerque?',
    a: 'Nob Hill on Central Avenue is the most walkable — bars, restaurants, vintage shops, and the occasional gallery opening. Old Town is history and food tourism in equal measure. The EDo district (East Downtown) is the creative hub: murals, craft breweries, artist studios. For a local residential vibe, check out the South Valley for authentic New Mexican culture.',
  },
  {
    q: 'What are some free things to do in Albuquerque?',
    a: 'Petroglyph National Monument is free to enter (parking fee). The Bosque Trail along the Rio Grande is free and beautiful. The Albuquerque Museum has free Sunday mornings and First Friday evenings. First Fridays in the Nob Hill arts district is a monthly free gallery walk. The ABQ Artwalk on Central Ave happens the first Friday of each month. Many library branches host free concerts, lectures, and film screenings.',
  },
  {
    q: 'What events are happening in Albuquerque this week?',
    a: 'The live event listings at the top of this page update daily with everything happening this week — concerts, comedy shows, sports, arts events, and community happenings. You can also filter by category, neighborhood, or date. For the week ahead, check the This Weekend and This Week sections.',
  },
]

const RELATED_LINKS = [
  {
    name: 'Visit Albuquerque',
    url: 'https://www.visitalbuquerque.org/things-to-do/',
    description: 'Official tourism board guide to Albuquerque attractions, dining, and events.',
  },
  {
    name: 'ABQ BioPark',
    url: 'https://www.cabq.gov/abqbiopark',
    description: 'Zoo, aquarium, botanic garden, and Tingley Beach — the classic Albuquerque family day.',
  },
  {
    name: 'Sandia Peak Aerial Tramway',
    url: 'https://sandiapeak.com',
    description: 'The world\'s longest aerial tramway, sunset rides offer spectacular views over the city and mountains.',
  },
  {
    name: 'NM Tourism Department',
    url: 'https://www.newmexico.org/things-to-do/',
    description: 'Statewide guide to activities, from ABQ day trips to northern New Mexico adventures.',
  },
  {
    name: 'City of ABQ: Parks & Recreation',
    url: 'https://www.cabq.gov/parksandrecreation',
    description: 'Free city parks, trails, pools, golf courses, and the Bosque Trail system.',
  },
  {
    name: 'National Hispanic Cultural Center',
    url: 'https://nhccnm.org',
    description: 'World-class arts campus in the South Valley — visual art, theater, and film year-round.',
  },
]

export default async function Page() {
  const results = await Promise.all([
    fetchEvents({ category: 'Music',        limit: 60 }),
    fetchEvents({ category: 'Arts & Theater', limit: 40 }),
    fetchEvents({ category: 'Comedy',       limit: 30 }),
    fetchEvents({ category: 'Family',       limit: 30 }),
    fetchEvents({ category: 'Food & Drink', limit: 30 }),
    fetchEvents({ category: 'Outdoor',      limit: 30 }),
    fetchEvents({ category: 'Festivals',    limit: 30 }),
    fetchEvents({ category: 'Sports',       limit: 20 }),
  ])

  const events = results
    .flatMap(r => r.events)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 300)

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'things-to-do-in-albuquerque',
        heading: 'Things to Do in Albuquerque',
        lede: `${events.length} upcoming events — concerts, festivals, comedy, outdoor activities, and everything else happening in ABQ right now.`,
        venueStrip: [
          { name: 'Isleta Amphitheater',     emoji: '🎶', href: 'https://www.isletaamphitheater.net' },
          { name: 'Sandia Peak Tramway',     emoji: '🚡', href: 'https://sandiapeak.com' },
          { name: 'ABQ BioPark',             emoji: '🦒', href: 'https://www.cabq.gov/abqbiopark' },
          { name: 'KiMo Theatre',            emoji: '🎭', href: 'https://cabq.gov/culturalservices/kimo' },
          { name: 'Balloon Fiesta Park',     emoji: '🎈', href: 'https://www.balloonfiesta.com' },
          { name: 'Old Town Albuquerque',    emoji: '⛪', href: 'https://oldtownalbuquerqueabq.com' },
        ],
        intro:
          "The first thing people ask is: is there actually stuff to do in Albuquerque? The answer is yes, and it's embarrassingly obvious once you start looking. The problem is no one aggregates it. You have Ticketmaster for the big shows, Eventbrite for the community stuff, NHCC for their programming, the library calendar for free events, and a dozen Facebook groups for everything else. It's scattered.\n\nWe pull from all of it. The listings above update daily with everything from Ringo Starr at Isleta Amphitheater to a free Saturday jazz set at the Barelas Community Center. Big concerts and basement shows. Latin dance nights and brewery trivia. Family events at the BioPark and 21+ comedy at Laff's. It's all here.\n\nAlbuquerque has roughly 900,000 people in the metro area. That's enough critical mass for a real arts scene, a serious music program at UNM, a craft brewery landscape that rivals cities twice its size, and enough quirky independent venues to keep things interesting. What it doesn't have is the self-promotion machine that makes cities like Denver or Austin look more happening than they actually are. ABQ just does the thing without making a big deal of it.",
        introExtra:
          "A few things worth knowing: the outdoor stuff is always underrated here. The Bosque Trail along the Rio Grande is a flat, multi-use path that goes for miles through cottonwood groves. The Sandia Mountains are directly east of the city — you can hike to 10,000 feet in under an hour from the trailhead. The Petroglyph National Monument on the west side has ancient volcanic rock carvings and free walking trails.\n\nFor events with purchase decisions (concerts, theater, sports), book in advance. Tingley Coliseum, Isleta Amphitheater, and Popejoy Hall at UNM get touring acts that sell out. But most of what's good here doesn't require a reservation. Show up.",
        emptyHeading: 'Nothing listed right now',
        emptyBody: 'We update daily — check back soon. Or browse all upcoming events and filter by what you\'re in the mood for.',
        breadcrumbLabel: 'Things to Do in Albuquerque',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        submitUrl: '/submit',
        submitLabel: 'Know of something happening we\'re not listing? Submit it.',
      }}
    />
  )
}
