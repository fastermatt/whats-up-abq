/**
 * SEO landing page: Things to Do with Kids in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Things to Do with Kids in Albuquerque, NM | ABQ Unplugged'
const SEO_DESC = 'Find family-friendly events in Albuquerque — BioPark, Explora, outdoor activities, and events that keep kids AND parents happy.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/family-friendly',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Things to Do with Kids in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/family-friendly' },
}

const FAQS = [
  {
    q: 'Best free activity for kids?',
    a: 'Tingley Beach. The playground, the train, the ducks. Also the Rio Grande Nature Center has free admission and a small pond with turtles.',
  },
  {
    q: 'What about rainy day options?',
    a: 'Explora Museum. Hands down. Also the Indian Pueblo Cultural Center has nice indoor exhibits. Or just go to the mall with a play area.',
  },
  {
    q: 'Are there any hiking trails suitable for young kids?',
    a: 'The Elena Gallegos Picnic Area has easy short trails. The Bosque Trail is flat and wide. Stroller friendly? Yes, the paved Bosque Trail is fine.',
  },
]

const RELATED_LINKS = [
  { name: 'ABQ BioPark', url: 'https://www.cabq.gov/abqbiopark', description: 'Zoo, aquarium, botanic garden, and Tingley Beach — the full family day package.' },
  { name: 'Explora Science Museum', url: 'https://www.explora.us', description: 'Hands-on science museum for kids — they will want to touch everything.' },
  { name: 'City of ABQ: Family Programs', url: 'https://www.cabq.gov/parksandrecreation', description: 'City-run youth programs, splash pads, and community events.' },
  { name: 'NM Museum of Natural History', url: 'https://www.nmnaturalhistory.org', description: 'Dinosaurs, planetarium shows, and rotating science exhibits near Old Town.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Family', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'family-friendly',
        heading: 'Things to Do with Kids in Albuquerque',
        lede: `${events.length} family-friendly events coming up — things kids actually want to do.`,
        intro: 'Keeping kids AND parents happy is the real trick. Albuquerque actually has stuff that works for both. Explora Science Center and Children\'s Museum is the big one. It\'s hands-on, interactive, and the kids won\'t want to leave. But it\'s loud and crowded on weekends. Go on a Tuesday morning if you can. The Albuquerque BioPark has the zoo, the aquarium, and the botanic garden. You can spend a whole day. The zoo has a newish elephant exhibit. The aquarium is small but the shark tunnel is cool. The botanic garden has a train set that kids love. Then there\'s the ABQ Uptown area for a shopping break? Not really family fun. Instead, go to the Tingley Beach. It\'s a small artificial lake near the Bosque. You can fish, walk, ride the little train. It\'s free. The kids can run around. There\'s also Hinkle Family Fun Center – go-karts, mini-golf, arcade. That\'s a pay-per-activity place. And for a real treat, take them to the Sandia Tram. It\'s expensive but the ride up is amazing for kids. They\'ll remember it. The key to family fun here is mixing outdoor stuff with indoor stuff. Don\'t overschedule. Leave time for ice cream. The best family days are the ones with no plan, just a direction. ABQ is small enough that you can improvise.',
        introExtra: 'I\'m not a parent, but I\'ve been the uncle who takes kids out for a day. We went to the Petroglyph National Monument. I thought they\'d be bored. Nope. They loved climbing the rocks and finding the carvings. We made a game of it. Then we got shaved ice from a truck. That was the whole day. Cost almost nothing. They talked about it for weeks. The magic is in the simple stuff.',
        emptyHeading: 'No family events listed right now',
        emptyBody: 'New events added daily — check back soon.',
        breadcrumbLabel: 'Family-Friendly',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
