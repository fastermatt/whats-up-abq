/**
 * SEO landing page: Albuquerque Festivals
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Albuquerque Festivals 2026 — Your Year-Round Guide to Local Celebrations | ABQ Unplugged'
const SEO_DESC = 'Albuquerque has way more festivals than Balloon Fiesta. State Fair, Lavender Festival, wine fests, Green Chile Festival — find them all here.'

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/festivals',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Albuquerque Festivals' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/festivals' },
}

const FAQS = [
  {
    q: 'What\'s the biggest festival in Albuquerque besides Balloon Fiesta?',
    a: 'The New Mexico State Fair in September. It\'s huge — concerts, rodeo, agriculture exhibits, and the most insane food court you\'ll ever see. Check the official State Fair website for schedule.',
  },
  {
    q: 'Are there free festivals in Albuquerque?',
    a: 'Absolutely. The Lavender Festival, the Green Chile Festival in Old Town, and many community events run by Bernalillo County Parks are free. Some charge for parking or food, but entry is no-cost.',
  },
  {
    q: 'When do festival dates get announced?',
    a: 'Most major festivals lock in dates by early spring. We update our page as soon as they drop. Bookmark this page and check back — or follow Visit Albuquerque\'s newsletter for early notifications.',
  },
]

const RELATED_LINKS = [
  { name: 'Visit ABQ: Events Calendar', url: 'https://www.visitalbuquerque.org/events/', description: 'Official year-round calendar of festivals and events in Albuquerque.' },
  { name: 'New Mexico State Fair', url: 'https://www.exponm.com/nm-state-fair', description: 'September\'s biggest event — rodeo, concerts, midway rides, and insane food.' },
  { name: 'Expo NM', url: 'https://www.exponm.com', description: 'State fairgrounds that hosts dozens of festivals, fairs, and events annually.' },
  { name: 'NM Tourism: Festivals', url: 'https://www.newmexico.org/things-to-do/events/', description: 'Statewide festival calendar including ABQ\'s biggest annual events.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Festivals', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'festivals',
        heading: 'Albuquerque Festivals',
        lede: `Explore ${events.length} festivals in Albuquerque — from the State Fair to hidden gem events you've never heard of.`,
        intro: 'Albuquerque is a festival town. Sure, Balloon Fiesta gets the postcards, but the rest of the year is packed with things that make you love this place. The New Mexico State Fair in September? Giant fried everything and midway games. The Lavender Festival in Los Ranchos? Smells like heaven and you\'ll leave with soap for your mom. Wine festivals at the fairgrounds or up in Bernalillo? Yes, please. And the Green Chile Festival — that\'s practically a religious holiday here. The problem is finding them all without digging through twenty websites. That\'s where we come in. We track every festival that\'s worth your Saturday afternoon, from the big ones (Visit Albuquerque has the official calendar) to the quirky ones like the Albuquerque International Balloon Fiesta\'s pre-event parties. We also keep an eye on the New Mexico Tourism Department\'s events page for statewide stuff that lands in ABQ. No more scrolling through Facebook event pages. Just pick a festival, grab your sunscreen, and go.',
        introExtra: 'Not all festivals are created equal. The ones we list are the ones actual locals attend — not corporate bloated events. We cross-reference with Visit Albuquerque’s year-round calendar, the official New Mexico State Fair website, and local community center boards (Bernalillo County Parks runs a ton of free ones). If it’s on our list, it’s been vetted. And if you\'re looking for something specific like a tamale festival or a beer fest, we’ve got you. Just filter by month or type.',
        emptyHeading: 'No festivals listed right now',
        emptyBody: 'Festival season in Albuquerque runs March through November. Check back as events get announced — we update daily.',
        breadcrumbLabel: 'Festivals',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
