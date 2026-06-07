/**
 * SEO landing page: Outdoor Activities Albuquerque
 * Targets "outdoor activities albuquerque", "albuquerque outdoors", "hiking albuquerque".
 * Different from /outdoor-activities (event list) — this is the comprehensive outdoors guide.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Outdoor Activities in Albuquerque, NM — Hiking, Biking & Events | ABQ Unplugged'
const SEO_DESC =
  'Outdoor activities in Albuquerque — Sandia Mountains hiking, Bosque Trail biking, Petroglyph National Monument, and outdoor events. Your ABQ outdoors guide, updated daily.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/outdoor-activities-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Outdoor Activities in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/outdoor-activities-albuquerque' },
}

const FAQS = [
  {
    q: 'What outdoor activities are there in Albuquerque?',
    a: 'The Sandia Mountains are the main draw — Cibola National Forest starts at the city\'s eastern edge. The La Luz Trail ascends to Sandia Crest (10,678 ft) through mixed forest. The Sandia Peak Aerial Tramway is the easy version, with a 2.7-mile tram ride to the summit. The Bosque Trail along the Rio Grande is 16+ miles of flat paved path through cottonwood groves — perfect for biking or walking. Petroglyph National Monument on the west side has ancient volcanic rock carvings on easy walking trails. And the Rio Grande Nature Center is a free wetland preserve in the city.',
  },
  {
    q: 'What are the best hiking trails near Albuquerque?',
    a: 'For easy trails: the Rinconada Canyon Trail at Petroglyph NM (2.2 miles, flat), Elena Gallegos Picnic Area trails (various lengths, easy to moderate), and the Bosque Trail (flat, as long as you want). Moderate: the Pino Trail on the Sandia foothills (4.8 miles round trip, good views). Challenging: La Luz Trail to Sandia Crest (15 miles round trip, 3,700-ft elevation gain — not for beginners). The Cibola National Forest website has full trail maps and conditions.',
  },
  {
    q: 'Can I bike in Albuquerque?',
    a: 'Yes. The Paseo del Bosque Trail is the signature ride — a wide paved path running along the Rio Grande through the city. It\'s flat, shaded by cottonwoods, and accessible at multiple points (Alameda, Montaño, Rio Bravo). There are also mountain biking trails on the Sandia foothills, the most popular being the Rinconada Trail system on the west side of the mountains.',
  },
  {
    q: 'Is Petroglyph National Monument worth visiting?',
    a: 'Yes, and it\'s free. The Petroglyph National Monument on the West Mesa has over 24,000 images carved into volcanic basalt by Indigenous peoples and early Spanish settlers over the past 700 years. The Rinconada Canyon Trail is the most accessible loop (2.2 miles, relatively flat). Best time: morning or late afternoon to avoid the heat. The visitor center is on Unser Blvd NW.',
  },
  {
    q: 'What is the best time of year for outdoor activities in Albuquerque?',
    a: 'Spring (March-May) and fall (September-November) are ideal — moderate temperatures, good wildflower displays in spring, golden cottonwood trees in fall. Summer is hot in the city but comfortable in the Sandia Mountains at elevation. Winter allows for skiing at Ski Santa Fe (1 hour north) and Sandia Peak Ski Area on the east side of the Sandias — both have consistent snow.',
  },
]

const RELATED_LINKS = [
  {
    name: 'Cibola National Forest',
    url: 'https://www.fs.usda.gov/cibola',
    description: 'Official site for Sandia Mountains hiking, camping, and trail conditions.',
  },
  {
    name: 'Petroglyph National Monument',
    url: 'https://www.nps.gov/petr/index.htm',
    description: 'Free entry — ancient rock carvings, easy trails on the ABQ west side.',
  },
  {
    name: 'Sandia Peak Aerial Tramway',
    url: 'https://sandiapeak.com',
    description: 'Ride to 10,378 feet in 15 minutes — the world\'s longest aerial tramway.',
  },
  {
    name: 'City of ABQ: Bosque Trail',
    url: 'https://www.cabq.gov/parksandrecreation/open-space/lands/bosque-trail',
    description: 'Official guide to the Paseo del Bosque Trail — maps, access points, and conditions.',
  },
  {
    name: 'NM Tourism: Outdoor Adventures',
    url: 'https://www.newmexico.org/things-to-do/outdoor-adventures/',
    description: 'Statewide guide to hiking, biking, rafting, and outdoor activities across New Mexico.',
  },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Outdoor', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'outdoor-activities-albuquerque',
        heading: 'Outdoor Activities in Albuquerque',
        lede: `${events.length} outdoor events — plus hiking, biking, and the outdoor access that makes living here worth it.`,
        venueStrip: [
          { name: 'Sandia Peak Tramway',   emoji: '🚡', href: 'https://sandiapeak.com' },
          { name: 'Bosque Trail',          emoji: '🚲', href: 'https://www.cabq.gov/parksandrecreation/open-space/lands/bosque-trail' },
          { name: 'Petroglyph NM',         emoji: '🪨', href: 'https://www.nps.gov/petr/index.htm' },
          { name: 'Cibola National Forest', emoji: '🌲', href: 'https://www.fs.usda.gov/cibola' },
          { name: 'Rio Grande Nature Ctr', emoji: '🦅', href: 'https://www.cabq.gov/parksandrecreation/open-space/rio-grande-nature-center-state-park' },
        ],
        intro:
          "The thing about Albuquerque's outdoor scene is the proximity. The Sandia Mountains aren't in the background — they're right there. The crest is 10,678 feet, and you can be on a trail in the forest in 30 minutes from downtown. The La Luz Trail is one of the more demanding hikes in New Mexico. The Sandia Peak Aerial Tramway is the easy version — 15 minutes to the summit, panoramic views of five states on a clear day.\n\nWest of the city: the Petroglyph National Monument on the West Mesa. Seventeen miles of volcanic escarpment with over 24,000 petroglyphs carved by Ancestral Pueblo people and early Spanish settlers. The Rinconada Canyon Trail is two miles of flat walking through the lava rock. It's free, it's strange, and it's consistently one of the most underrated things in Albuquerque.\n\nRunning through the middle of the city: the Bosque. The cottonwood forest along the Rio Grande. The Paseo del Bosque Trail runs 16 miles from Alameda Boulevard south through the city. Flat, paved, multi-use. In October the cottonwoods turn yellow and the light through the leaves is genuinely beautiful. The Rio Grande Nature Center State Park on Candelaria NW is the easiest access point — free parking, a small pond with turtles, and a loop trail through the wetlands.",
        introExtra:
          "Altitude note: Albuquerque sits at 5,300 feet. The Sandia Crest is 10,678. The elevation change affects people differently — if you're coming from sea level, give yourself a day to adjust before hitting the harder trails. Drink more water than you think you need. The desert air is drier than you're used to, and the sun at this elevation is intense. Start early on summer days — it's easier on the body and the parking lots fill up.",
        emptyHeading: 'No outdoor events listed right now',
        emptyBody: 'Outdoor events peak in spring and fall. Check back — we update daily.',
        breadcrumbLabel: 'Outdoor Activities in Albuquerque',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
