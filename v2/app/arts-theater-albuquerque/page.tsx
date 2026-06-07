/**
 * SEO landing page: Arts & Theater Albuquerque
 * Targets "arts albuquerque", "theater albuquerque", "albuquerque arts events", "galleries albuquerque".
 * Different from /arts (event list) — this is the comprehensive arts scene guide.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Arts & Theater in Albuquerque, NM — Galleries, Performances & Events | ABQ Unplugged'
const SEO_DESC =
  'Find art shows, theater, gallery openings, and cultural events in Albuquerque. ABQ has a real arts scene — First Fridays, 516 Arts, NHCC, Popejoy. Updated daily.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/arts-theater-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Arts and Theater in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/arts-theater-albuquerque' },
}

const FAQS = [
  {
    q: 'What is the arts scene like in Albuquerque?',
    a: "Genuinely good, though undersold. Albuquerque has a density of working artists that would surprise most visitors — the UNM MFA program feeds a constant pipeline of new talent, and the affordable cost of living compared to Santa Fe and other arts cities means people actually stay. The gallery scene is concentrated in the Old Town / EDo (East Downtown) area and along the Nob Hill stretch of Central Ave. First Fridays are the main event: monthly gallery openings across the arts districts.",
  },
  {
    q: 'When is Albuquerque First Friday?',
    a: "The first Friday of every month. Galleries in Downtown and Nob Hill open late, some with wine receptions, and it's a self-guided walkable event. Free to attend everywhere except for specific ticketed performances. The Old Town / EDo district has the highest concentration of galleries. The ABQ Artwalk covers the Central Ave galleries. No central ticketing — just show up and walk.",
  },
  {
    q: 'What is the best theater in Albuquerque?',
    a: "Popejoy Hall at UNM is the flagship — 2,000 seats, excellent acoustics, Broadway tours, symphony performances, and top-tier visiting artists. The KiMo Theatre is the historic icon, a 1927 Pueblo Deco building downtown that hosts performances, film events, and community arts. For smaller theater: Aux Dog Theatre Nob Hill, South Broadway Cultural Center, and the National Hispanic Cultural Center's Roy E. Disney Center for the Performing Arts (1,000-seat state-of-the-art theater).",
  },
  {
    q: 'Where can I see free art in Albuquerque?',
    a: "516 ARTS in Downtown ABQ is a free contemporary gallery with serious programming. The Albuquerque Museum has free entry on First Fridays after 5pm and Sunday mornings. The Indian Pueblo Cultural Center has free gallery exhibitions. Street art on Central Ave (especially in the Nob Hill and EDo sections) is extensive and constantly evolving. UNM's art museum (University Art Museum) has free admission.",
  },
  {
    q: 'What cultural institutions are in Albuquerque?',
    a: "National Hispanic Cultural Center (NHCC) is the most important — it's a world-class arts campus in the South Valley with a visual arts museum, a performing arts theater, and year-round programming celebrating Hispanic heritage. The Albuquerque Museum covers the region's history and art. The Indian Pueblo Cultural Center tells the story of the 19 Pueblos of New Mexico. The NM Museum of Natural History and Science is the science counterpart.",
  },
]

const RELATED_LINKS = [
  {
    name: 'National Hispanic Cultural Center',
    url: 'https://nhccnm.org',
    description: 'World-class arts campus — visual art, theater, film, and cultural programming year-round.',
  },
  {
    name: '516 ARTS',
    url: 'https://516arts.org',
    description: 'Downtown ABQ nonprofit gallery showcasing contemporary art from the Southwest and beyond.',
  },
  {
    name: 'Popejoy Hall at UNM',
    url: 'https://popejoypresents.com',
    description: "2,000-seat performing arts center — Broadway, orchestra, and world-class visiting artists.",
  },
  {
    name: 'KiMo Theatre',
    url: 'https://www.cabq.gov/culturalservices/kimo',
    description: "Historic 1927 Pueblo Deco theater — concerts, film, community performances.",
  },
  {
    name: 'Albuquerque Museum',
    url: 'https://www.albuquerquemuseum.org',
    description: 'City museum with rotating art exhibitions and local history. Free on Sunday mornings.',
  },
  {
    name: 'Visit ABQ: Arts & Culture',
    url: 'https://www.visitalbuquerque.org/things-to-do/arts-culture/',
    description: 'Official guide to galleries, museums, and cultural events in Albuquerque.',
  },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Arts & Theater', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'arts-theater-albuquerque',
        heading: 'Arts & Theater in Albuquerque',
        lede: `${events.length} arts and theater events — gallery openings, performances, and cultural programming across ABQ.`,
        venueStrip: [
          { name: 'NHCC',              emoji: '🎭', href: 'https://nhccnm.org' },
          { name: 'Popejoy Hall',      emoji: '🎪', href: 'https://popejoypresents.com' },
          { name: 'KiMo Theatre',      emoji: '🏛️', href: 'https://www.cabq.gov/culturalservices/kimo' },
          { name: '516 ARTS',          emoji: '🎨', href: 'https://516arts.org' },
          { name: 'ABQ Museum',        emoji: '🖼️', href: 'https://www.albuquerquemuseum.org' },
          { name: 'South Broadway Ctr', emoji: '🌟' },
        ],
        intro:
          "Albuquerque's arts scene doesn't get the same press as Santa Fe's gallery row, and that's partly by design. The work here is rawer, more community-based, less oriented toward wealthy collectors. The UNM art program has produced working artists who stayed in the city. The Light Studio and Collective in the EDo district. The mural culture on Central Ave. The satellite studios in the Rail Yards. It's a working artist city, not a destination art city. The distinction matters.\n\nThe National Hispanic Cultural Center in the South Valley is the most significant cultural institution — a world-class campus with a visual arts museum, the Roy E. Disney Center for the Performing Arts (1,000 seats, technically excellent), and year-round programming that's both academically serious and community-embedded. If you see one performance in Albuquerque, make it something at the NHCC.\n\nFor theater: Popejoy Hall at UNM handles Broadway tours, symphony, and the marquee visiting artists. The KiMo Theatre on Central is the character venue — a 1927 Pueblo Deco building with original tilework, a history tied to the city's identity, and a programming calendar that's wonderfully eclectic. They show films, host music, book theater, and do community events in a building that looks like nothing else.\n\nFirst Fridays (the first Friday of every month) are the main entry point for the gallery scene. No central organization, just a collective of galleries that stay open late with wine and free entry. Start at 516 ARTS on Gold Avenue and walk from there.",
        introExtra:
          "A note on ABQ vs. Santa Fe: Santa Fe has more name galleries and higher prices. Albuquerque has more working artists. The work in ABQ galleries tends to be younger, less polished in presentation, and more experimental — which, depending on your taste, is either a feature or a bug. The artists are approachable; the prices for originals are genuinely accessible. If you want to buy actual art made by a living New Mexico artist, Albuquerque is where to find it.",
        emptyHeading: 'No arts events listed right now',
        emptyBody: 'New events get added daily — check back soon.',
        breadcrumbLabel: 'Arts & Theater in Albuquerque',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        submitUrl: '/submit',
        submitLabel: 'Know of an arts event or gallery show we\'re missing? Submit it.',
      }}
    />
  )
}
