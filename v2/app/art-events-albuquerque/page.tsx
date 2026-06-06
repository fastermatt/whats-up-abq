/**
 * SEO landing page: Art Events in Albuquerque
 * Targets: "albuquerque art events", "abq artwalk", "albuquerque art galleries",
 *           "first friday albuquerque art"
 * Revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Art Events in Albuquerque — Galleries, ArtWalk & Openings | ABQ Unplugged'
const SEO_DESC  = 'First Friday ArtWalk in Nob Hill, gallery openings, museum exhibitions, and art markets across Albuquerque. Every upcoming art event in one place, updated daily.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/art-events-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Art events in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/art-events-albuquerque' },
}

const FAQS = [
  {
    q: 'What is the ABQ ArtWalk?',
    a: 'ABQ ArtWalk is a free, self-guided gallery walk on the first Friday of each month, centered in Nob Hill along Central Avenue. Galleries, studios, and shops stay open late with new exhibitions, artist receptions, and often live music. It is the easiest way to see a lot of local art in one evening.',
  },
  {
    q: 'Where are the main art galleries in Albuquerque?',
    a: 'Nob Hill and Old Town have the densest gallery clusters. Downtown has 516 ARTS and the galleries around Central. The Sawmill District near Old Town has the Sawmill Market and nearby studios. The National Hispanic Cultural Center and the Albuquerque Museum anchor the institutional side.',
  },
  {
    q: 'Are art events in Albuquerque free?',
    a: 'Most gallery openings and the First Friday ArtWalk are free to attend. The Albuquerque Museum offers free admission on the first Sunday of each month. Ticketed events are usually special exhibitions, workshops, or performances. Each listing here shows the price.',
  },
  {
    q: 'What is the biggest art event in Albuquerque?',
    a: 'The Rio Grande Arts & Crafts Festival draws the biggest crowds, with hundreds of juried artists across multiple weekends. Beyond that, the annual Print Crawl, Pottery & Glass shows, and the rotating exhibitions at the Albuquerque Museum and NHCC are the marquee events.',
  },
]

const RELATED_LINKS = [
  { name: '516 ARTS', url: 'https://www.516arts.org', description: 'Downtown contemporary art museum and gallery.' },
  { name: 'Albuquerque Museum', url: 'https://www.cabq.gov/museum', description: 'Art and history museum in Old Town, free first Sundays.' },
  { name: 'National Hispanic Cultural Center', url: 'https://nhccnm.org', description: 'Visual art, performances, and rotating exhibitions.' },
  { name: 'ABQ ArtWalk', url: 'https://www.abqartwalk.com', description: 'First-Friday self-guided gallery walk in Nob Hill.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Arts & Theater', limit: 120 })
  // Sort soonest first
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 100)

  return (
    <CuratedListPage
      events={sorted}
      config={{
        slug: 'art-events-albuquerque',
        heading: 'Art Events in Albuquerque',
        lede: `${sorted.length} upcoming art events — gallery openings, ArtWalk, museum exhibitions, and art markets.`,
        venueStrip: [
          { name: '516 ARTS',          emoji: '🖼️', href: 'https://www.516arts.org' },
          { name: 'ABQ Museum',        emoji: '🏛️', href: 'https://www.cabq.gov/museum' },
          { name: 'NHCC',              emoji: '🎨', href: 'https://nhccnm.org' },
          { name: 'Nob Hill ArtWalk',  emoji: '🚶', href: 'https://www.abqartwalk.com' },
          { name: 'Old Town',          emoji: '⛪' },
        ],
        intro: `Albuquerque\'s art scene is bigger and more accessible than most visitors expect, and you don\'t need a gallery membership or an art-history degree to enjoy it. The anchor is ABQ ArtWalk: the first Friday of every month, Nob Hill\'s galleries, studios, and shops along Central Avenue stay open late with new shows and artist receptions. It\'s free, it\'s walkable, and it\'s the single best night to see a lot of local work in one go.\n\nBeyond First Fridays, the city has real institutional depth. 516 ARTS downtown runs ambitious contemporary exhibitions. The Albuquerque Museum in Old Town pairs a strong permanent collection with rotating shows and free admission on the first Sunday of each month. The National Hispanic Cultural Center brings visual art together with music, dance, and theater. And the Rio Grande Arts & Crafts Festival packs hundreds of juried makers under one roof across its run.\n\nThis page pulls every upcoming art event in the metro into one place, sorted soonest-first, so you can find an opening tonight or plan around a big festival weeks out. Filter by date or neighborhood to find what\'s near you.`,
        introExtra: 'If you only do one thing: catch a First Friday ArtWalk in Nob Hill. Park once near Central and Carlisle, walk the strip, duck into whichever galleries have a crowd, and let the evening wander. Most spots have a glass of wine and an artist happy to talk. It\'s the friendliest on-ramp to the local art world there is.',
        emptyHeading: 'No art events listed right now',
        emptyBody: 'New exhibitions and openings are added daily. Check back soon or browse all upcoming events.',
        breadcrumbLabel: 'Art Events',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        submitUrl: '/submit',
        submitLabel: 'Showing work or hosting an opening? Submit it.',
      }}
    />
  )
}
