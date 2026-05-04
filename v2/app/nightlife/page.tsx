/**
 * SEO landing page: Albuquerque Nightlife
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Albuquerque Nightlife — Bars, Clubs & Things to Do at Night | ABQ Unplugged'
const SEO_DESC = 'Explore Albuquerque nightlife: bars in Nob Hill and Downtown, live music at Sister Bar, comedy shows, and late-night eats.'

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/nightlife',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Albuquerque Nightlife' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/nightlife' },
}

const FAQS = [
  {
    q: 'What\'s the best area for nightlife?',
    a: 'Nob Hill, hands down. Central between Girard and Carlisle. Sister Bar, Anodyne, O\'Neill\'s, plus food options. Downtown is good if you want variety but it\'s spread out.',
  },
  {
    q: 'Do bars close early?',
    a: 'Yeah, most close by 2am. Some earlier. Breweries close around 10 or 11. It\'s not a late-night town. You get used to it.',
  },
  {
    q: 'Is there a dance club scene?',
    a: 'Sort of. Sister Bar has a dance floor. Effex Nightclub near downtown exists, but I\'ve never been. If you want to dance, check who\'s playing at the Launchpad or go to a DJ night at Sister.',
  },
]

const RELATED_LINKS = [
  { name: 'Visit Albuquerque: Music & Nightlife', url: 'https://www.visitalbuquerque.org/things-to-do/music-and-nightlife/', description: 'Official guide to bars, clubs, and live music across Albuquerque.' },
  { name: 'City of ABQ: Cultural Services', url: 'https://www.cabq.gov/culturalservices', description: 'City-run venues and events — KiMo, Civic Plaza, and more.' },
  { name: 'Tractor Brewing', url: 'https://www.tractorbrewing.com', description: 'Local craft brewery with two taprooms and regular live music nights.' },
  { name: 'Marble Brewery', url: 'https://www.marblebrewery.com', description: 'One of ABQ\'s original craft breweries with events and live music.' },
]

export default async function Page() {
  const results = await Promise.all([
    fetchEvents({ category: 'Music', limit: 100 }),
    fetchEvents({ category: 'Comedy', limit: 100 }),
    fetchEvents({ category: 'Food & Drink', limit: 100 }),
  ])
  const events = results
    .flatMap(r => r.events)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 200)

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'nightlife',
        heading: 'Albuquerque Nightlife',
        lede: `${events.length} nightlife events — bars, live music, comedy, and late nights across the city.`,
        intro: 'Albuquerque nightlife isn\'t Vegas. The lights don\'t flash all night. The clubs don\'t have velvet ropes. But there\'s a thing here. It\'s more about the bar you end up at, the conversation you have, the band you stumble into. Nob Hill is the main drag. Central Avenue from about Girard to Carlisle. You\'ve got Sister Bar, which is a two-level bar with a dance floor downstairs and a rooftop. It gets packed on weekends. You\'ve got the Anodyne, a dive with a pool table and a jukebox that plays The Cure. You\'ve got O\'Neill\'s Pub for a quieter Irish vibe. Then there\'s Downtown. Less polished. More unpredictable. The Library Bar is a dark, cozy spot with leather chairs. The Kosmos is a venue that doubles as a community space. Then there\'s the breweries – La Cumbre, Marble, Tractor – they close early, but the taprooms have a loyal crowd. The trick to ABQ nightlife is to start early. Go out around 8. Do a brewery, then a bar, then maybe live music. By 11, things are winding down. That\'s fine. You don\'t need a 4am closing time to have a good night. You need a good bar stool and someone to talk to. I\'ve had nights that started with a single beer at the Nob Hill Bar & Grill and ended with new friends, a slice of pizza, and a story about a cat that somehow got into the bar. That\'s the nightlife here. Low key. Real. You\'ll like it.',
        introExtra: 'I once went out on a Tuesday. That\'s stupid, I know. But I found myself at the Barley Room on Central. It was almost empty. The bartender knew my name by the end of the night. We talked about the music playing – this obscure soul album. She gave me a free shot. That doesn\'t happen in a club. That\'s Albuquerque. You\'re not a number. You\'re a regular waiting to happen.',
        emptyHeading: 'No nightlife listings right now',
        emptyBody: 'New events added daily — check back soon.',
        breadcrumbLabel: 'Nightlife',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
