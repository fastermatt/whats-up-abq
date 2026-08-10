/**
 * SEO landing page: Farmers Markets in Albuquerque
 * Targets: "albuquerque farmers market", "rail yards market albuquerque",
 *           "downtown growers market albuquerque"
 * Markets are recurring weekly events; the page leans on evergreen market
 * info plus any live market listings from the DB.
 */
import type { Metadata } from 'next'
import { normalizeRow, NormalizedEvent } from '@/lib/events'
import { createStaticClient } from '@/lib/supabase/static'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Albuquerque Farmers Markets — Rail Yards, Downtown Growers & More | ABQ Unplugged'
const SEO_DESC  = 'Where and when to find farmers markets in Albuquerque: the Rail Yards Market, Downtown Growers’ Market, and neighborhood markets. Days, seasons, and what to expect.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/farmers-markets-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Albuquerque farmers markets' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/farmers-markets-albuquerque' },
}

const FAQS = [
  {
    q: 'When is the Rail Yards Market in Albuquerque?',
    a: 'The Rail Yards Market runs Sundays, roughly 10am to 2pm, from early May through late October, inside the historic Barelas locomotive shops just south of Downtown. Admission is free. It mixes local farmers and food vendors with makers, live music, and the dramatic industrial setting.',
  },
  {
    q: 'When is the Downtown Growers’ Market?',
    a: 'The Downtown Growers’ Market is held Saturday mornings, about 8am to noon, from April through November at Robinson Park (8th & Central). It is a true grower-focused market: produce, eggs, honey, plants, plus prepared food and a steady lineup of local musicians.',
  },
  {
    q: 'Are there year-round farmers markets in Albuquerque?',
    a: 'Most outdoor markets are seasonal (spring through fall). Some move indoors or run smaller winter editions. The Sawmill Market (a permanent food hall near Old Town) and various neighborhood markets help fill the colder months. Check this page for what is currently active.',
  },
  {
    q: 'What can you buy at Albuquerque farmers markets?',
    a: 'Local produce (famous green chile in late summer), eggs, honey, bread, roasted chile in season, plants and seedlings, prepared food, coffee, and crafts from local makers. Many markets accept SNAP/EBT and offer Double Up Food Bucks to stretch produce dollars.',
  },
]

const RELATED_LINKS = [
  { name: 'Rail Yards Market', url: 'https://www.railyardsmarket.org', description: 'Sundays, May–Oct, in the historic Barelas Rail Yards.' },
  { name: 'Downtown Growers’ Market', url: 'https://www.downtowngrowers.org', description: 'Saturdays, Apr–Nov, at Robinson Park.' },
  { name: 'NM Farmers’ Marketing Association', url: 'https://www.farmersmarketsnm.org', description: 'Statewide directory of certified farmers markets.' },
  { name: 'Sawmill Market', url: 'https://www.sawmillmarket.com', description: 'Year-round food hall near Old Town.' },
]

async function fetchMarketEvents(): Promise<NormalizedEvent[]> {
  const supabase = createStaticClient()
  const today = new Date().toISOString().slice(0, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, pinned_last, neighborhood, venue_slug, category, venue_name, submitted_by, image_status')
    .eq('hidden', false)
    .gte('event_date', today)
    .or('venue_name.ilike.%market%,raw->>name.ilike.%market%,raw->>title.ilike.%market%,raw->>name.ilike.%farmers%,raw->>title.ilike.%farmers%,raw->>name.ilike.%growers%,raw->>title.ilike.%growers%')
    .order('event_date', { ascending: true })
    .limit(40)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .map(normalizeRow)
    .filter((e): e is NormalizedEvent => e !== null)
}

export default async function Page() {
  const events = await fetchMarketEvents()

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'farmers-markets-albuquerque',
        heading: 'Albuquerque Farmers Markets',
        lede: 'Where and when to find local produce, green chile, and makers — the Rail Yards Market, Downtown Growers’ Market, and neighborhood markets.',
        venueStrip: [
          { name: 'Rail Yards Market',     emoji: '🚂', href: 'https://www.railyardsmarket.org' },
          { name: 'Downtown Growers’', emoji: '🥬', href: 'https://www.downtowngrowers.org' },
          { name: 'Sawmill Market',        emoji: '🍴', href: 'https://www.sawmillmarket.com' },
          { name: 'Los Ranchos',           emoji: '🌽' },
        ],
        intro: `Albuquerque\'s farmers markets are some of the best free weekend outings in the city, and in green-chile season they\'re essential. Two anchor the calendar. The Rail Yards Market runs Sundays from May through October inside the cavernous, beautifully decayed Barelas locomotive shops just south of Downtown: local farmers and food vendors share the floor with makers and live music, and the setting alone is worth the trip. The Downtown Growers’ Market runs Saturday mornings from April through November at Robinson Park on Central, a tighter, grower-focused market with produce, eggs, honey, plants, and a reliable rotation of local musicians.\n\nBeyond those two, neighborhood markets pop up across the metro through the warm months, and the Sawmill Market near Old Town keeps a permanent food hall going year-round when the outdoor markets pause for winter. Most markets are free, many accept SNAP/EBT with Double Up Food Bucks, and late summer brings the thing everyone waits for: fresh-roasted green chile, sold by the bag with that unmistakable smell drifting across the lot.\n\nThis page lists upcoming market dates we\'re tracking, plus the evergreen details (days, seasons, locations) so you can plan a Saturday or Sunday morning around one.`,
        introExtra: 'Go early. The best produce and the shortest lines are in the first hour, and in summer the shade and the temperature both disappear by mid-morning. Bring cash and a tote, though most vendors now take cards and the market info booths can swipe SNAP/EBT for tokens.',
        emptyHeading: 'Market season is mostly spring through fall',
        emptyBody: 'Outdoor markets run roughly April through October. Check the links below for the current schedule, or browse all upcoming events.',
        breadcrumbLabel: 'Farmers Markets',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        submitUrl: '/submit',
        submitLabel: 'Run a market we’re missing? Submit it.',
      }}
    />
  )
}
