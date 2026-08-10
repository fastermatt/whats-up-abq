/**
 * SEO landing page: Family Events Albuquerque
 * Targets "family events albuquerque", "albuquerque family activities", "things to do with kids in albuquerque".
 * Different from /family-friendly (event list) — this is the comprehensive family guide.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Family Events in Albuquerque, NM — Things to Do with Kids | ABQ Unplugged'
const SEO_DESC =
  "Family-friendly events and activities in Albuquerque — BioPark, Explora, outdoor adventures, and events that keep kids and parents happy. Updated daily."

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/family-events-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Family Events in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/family-events-albuquerque' },
}

const FAQS = [
  {
    q: 'What are the best family activities in Albuquerque?',
    a: "Top family picks in ABQ: the ABQ BioPark (zoo + aquarium + botanic garden + Tingley Beach — plan a full day), Explora Science Center and Children's Museum (hands-on science, always a hit), the Petroglyph National Monument (free, easy hiking through ancient rock carvings), the Sandia Peak Aerial Tramway (kids remember this for years), and the NM Museum of Natural History and Science (dinosaurs and planetarium shows). For events, check the listings above — we filter for family-appropriate events automatically.",
  },
  {
    q: 'Are there free family events in Albuquerque?',
    a: "Yes, quite a few. The Petroglyph National Monument is free to enter (small parking fee). Tingley Beach is free to walk. The ABQ BioPark has free admission days for city residents. The Albuquerque Museum has free Sunday mornings. Many library branches host free children's programming including storytime, craft workshops, and film screenings. The city's community centers run free seasonal events. Check the Free Events filter on our listings for current no-cost family options.",
  },
  {
    q: 'What is Explora like for kids?',
    a: "Explora Science Center (900 Museum St, Old Town area) is genuinely great for kids. It's an interactive, hands-on museum where kids can build, experiment, and explore. Plan for 2-3 hours minimum. It gets crowded on weekend mornings — arriving when it opens or on a weekday is much better. There's a dedicated early childhood section for younger kids. Admission is around $9–12 depending on age.",
  },
  {
    q: 'Can I take young kids hiking in Albuquerque?',
    a: "Yes. The Bosque Trail along the Rio Grande is flat, paved, and stroller-friendly — kids can ride bikes or walk. The Elena Gallegos Picnic Area in the foothills has easy short trails suitable for younger children. The Volcanoes Day Use Area at Petroglyph NM has wide flat paths among volcanic rock. For older kids (8+), the Pino Trail in the Sandias is a solid moderate hike with great views.",
  },
  {
    q: 'What is there to do in Albuquerque on a rainy day with kids?',
    a: "Rainy day options: Explora Science Center (best answer), the NM Museum of Natural History and Science (dinosaurs, planetarium, good for all ages), the Indian Pueblo Cultural Center (interactive exhibits on Pueblo culture), the National Museum of Nuclear Science (rockets, history, surprisingly engaging for kids), and Meow Wolf Omega Mart (unconventional but memorable — geared more for older kids and teens). The library system also runs indoor programming.",
  },
  {
    q: 'Is Albuquerque good for a family trip?',
    a: "Yes, especially as a Southwest road trip stop. Albuquerque is cheaper than Santa Fe, more centrally located, and has genuine family infrastructure — multiple museums, a world-class biopark, accessible mountains, and cultural sites. Balloon Fiesta in October (if the timing works) is a bucket-list family experience. The food alone — green chile cheeseburgers, sopapillas, real New Mexican cuisine — is worth the trip.",
  },
]

const RELATED_LINKS = [
  {
    name: 'ABQ BioPark',
    url: 'https://www.cabq.gov/abqbiopark',
    description: 'Zoo, aquarium, botanic garden, and Tingley Beach — the full Albuquerque family day.',
  },
  {
    name: 'Explora Science Center',
    url: 'https://www.explora.us',
    description: "Hands-on interactive science museum for kids — they'll want to stay all day.",
  },
  {
    name: 'NM Museum of Natural History',
    url: 'https://www.nmnaturalhistory.org',
    description: 'Dinosaurs, a planetarium, and rotating science exhibits near Old Town.',
  },
  {
    name: 'Petroglyph National Monument',
    url: 'https://www.nps.gov/petr/index.htm',
    description: 'Free (small parking fee) — ancient rock carvings, easy family hiking on the west side.',
  },
  {
    name: 'City of ABQ: Youth Programs',
    url: 'https://www.cabq.gov/parksandrecreation/recreation/youth',
    description: 'City-run youth programs, summer camps, sports leagues, and free community events.',
  },
  {
    name: 'Albuquerque Public Library: Events',
    url: 'https://abqlibrary.org/events',
    description: 'Free library programming for all ages — storytime, workshops, film screenings.',
  },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Family', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'family-events-albuquerque',
        heading: 'Family Events in Albuquerque',
        lede: `${events.length} upcoming family-friendly events — activities, shows, and outdoor experiences for all ages.`,
        venueStrip: [
          { name: 'ABQ BioPark',          emoji: '🦒', href: 'https://www.cabq.gov/abqbiopark' },
          { name: 'Explora',              emoji: '🔬', href: 'https://www.explora.us' },
          { name: 'NM Museum Nat. History', emoji: '🦕', href: 'https://www.nmnaturalhistory.org' },
          { name: 'Petroglyph NM',        emoji: '🪨', href: 'https://www.nps.gov/petr/index.htm' },
          { name: 'Balloon Fiesta Park',  emoji: '🎈', href: 'https://www.balloonfiesta.com' },
          { name: 'Indian Pueblo Cultural Ctr', emoji: '🏺', href: 'https://www.indianpueblo.org' },
        ],
        intro:
          "Albuquerque is an underrated family city. The outdoor access alone puts it ahead of most places — you're 30 minutes from a pine forest, 20 minutes from ancient petroglyphs, and five minutes from a river trail that kids can bike or walk for miles. The Sandia Mountains are where elementary school field trips go. Balloon Fiesta in October is on the bucket list for families nationwide. These things are right here.\n\nThe institution piece is solid too. The ABQ BioPark is the city's crown jewel for family visits — the zoo, aquarium, botanic garden, and Tingley Beach are all combined into one campus, and you can realistically spend a full day. Explora Science Center near Old Town is the best children's museum in New Mexico. The NM Museum of Natural History has a planetarium and enough dinosaurs to satisfy any 8-year-old.\n\nFor live events, the NHCC (National Hispanic Cultural Center) programs family performances year-round. The library system runs free events at branches across the city. KiMo Theatre occasionally books family-appropriate shows. And yes, the Albuquerque International Balloon Fiesta in October is as magical as it looks in photos — if your kids have never seen 500 hot air balloons inflating at dawn, this is the year.",
        introExtra:
          "Age-specific quick picks: under 5 — Tingley Beach playground + the duck pond is an easy half-day. Ages 6-10 — Explora or Petroglyph (they love the rock art), then shaved ice. Ages 11+ — the Sandia Tram at sunset, or an Isotopes baseball game in summer (cheap tickets, Sandia Mountain backdrop, it's a great first baseball experience). For teens — Meow Wolf Omega Mart is surreal and memorable, or a live concert at one of the smaller venues where you can actually see the stage.",
        emptyHeading: 'No family events listed right now',
        emptyBody: 'New events get added daily — check back soon. You can also browse all upcoming events.',
        breadcrumbLabel: 'Family Events in Albuquerque',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        submitUrl: '/submit',
        submitLabel: 'Know of a family event we\'re missing? Submit it.',
      }}
    />
  )
}
