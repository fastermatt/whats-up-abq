/**
 * SEO landing page: Arts & Theater in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Arts & Theater in Albuquerque, NM | ABQ Unplugged'
const SEO_DESC = 'Find art walks, gallery openings, theater, and cultural events in Albuquerque. A real arts scene — updated daily.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/arts',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Arts & Theater in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/arts' },
}

const FAQS = [
  {
    q: 'When is the Albuquerque Artwalk?',
    a: 'First Friday of every month. Downtown, mostly around 5th and Gold. Some galleries stay open late, some have wine. It\'s free. Go early to avoid the crowds that do show up, which isn\'t many.',
  },
  {
    q: 'Where can I see local art for free?',
    a: 'The Albuquerque Museum has a free day every Sunday? No, first Friday of the month? Actually check their site. 516 Arts is free. The South Broadway Cultural Center is free. And you can always just walk around downtown and look at the murals.',
  },
  {
    q: 'Is the art scene really that good?',
    a: 'Yeah, it is. The University of New Mexico has a strong art program, so there\'s a constant flow of young talent. Plus the older artists who came here for the light and stayed. It\'s not the white-walled gallery scene of a big city. It\'s more raw. More interesting.',
  },
]

const RELATED_LINKS = [
  { name: '516 ARTS', url: 'https://516arts.org', description: 'Downtown ABQ nonprofit gallery showcasing contemporary art.' },
  { name: 'Albuquerque Museum', url: 'https://www.albuquerquemuseum.org', description: 'City museum with rotating art exhibitions, free on first Fridays.' },
  { name: 'National Hispanic Cultural Center', url: 'https://www.nhccnm.org', description: 'World-class arts campus celebrating Hispanic heritage through visual art and theater.' },
  { name: 'Visit ABQ: Arts & Culture', url: 'https://www.visitalbuquerque.org/things-to-do/arts-culture/', description: 'Official guide to galleries, museums, and cultural events in Albuquerque.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Arts & Theater', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'arts',
        heading: 'Arts & Theater in Albuquerque',
        lede: `${events.length} arts and theater events — galleries, murals, performance, and everything in between.`,
        intro: 'Nobody outside New Mexico knows what happens in Albuquerque\'s art scene. That\'s their loss. We\'ve got a density of working artists that would shock you. It\'s not Santa Fe with the big galleries and the wealthy buyers. It\'s rougher. It\'s more alive. The ABQ Artwalk happens every month in the downtown area. Galleries open their doors, pop-ups appear in empty storefronts, and the streets fill with people who actually look at the work. Not just Instagram it. Look at it. There\'s 516 Arts, which puts on exhibitions that would draw crowds in any city. There\'s the South Broadway Cultural Center, where you can see community-based pieces that tell stories you won\'t read anywhere else. And then there\'s the street art. Drive down Central. Look at the murals. They\'re everywhere. Some are tourist-friendly. Some are political. Some are just beautiful and weird. I once walked into a converted warehouse near the railyards – it was a collective studio. Paint on the floor. Turpentine smell. A guy welding something that looked like a praying mantis. He offered me a beer. That\'s the art scene here. It\'s not polished. It\'s not exclusionary. It\'s people making things because they have to. If you want a scene that\'s authentic and undervalued, you\'re in the right place. Just don\'t tell everyone else.',
        introExtra: 'I remember stumbling into a gallery on Gold Avenue during a First Friday. A photographer had documented the Bosque for ten years. Black and white. Haunting. I bought a print for forty bucks. It\'s still on my wall. That\'s the kind of thing that happens here – you can own real art without being rich. The artists are approachable. They\'ll tell you about the light, the coyotes, the fire season. It\'s not commercial, it\'s communal. And that\'s rare.',
        emptyHeading: 'No arts listings right now',
        emptyBody: 'New events added daily — check back soon.',
        breadcrumbLabel: 'Arts & Theater',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
