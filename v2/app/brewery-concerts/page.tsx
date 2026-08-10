/**
 * SEO landing page: Brewery Concerts Albuquerque
 * Targets: "brewery concerts albuquerque", "live music at breweries abq",
 *           "brewery events albuquerque", "taproom live music albuquerque"
 * Revalidates every hour.
 */
import type { Metadata } from 'next'
import { normalizeRow, NormalizedEvent } from '@/lib/events'
import { createStaticClient } from '@/lib/supabase/static'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Brewery Concerts Albuquerque — Live Music at ABQ Taprooms | ABQ Unplugged'
const SEO_DESC  = 'Canteen Brewhouse, Marble Brewery, JUNO, Rio Bravo and more. All the live music, trivia nights and taproom events at Albuquerque\'s craft breweries — updated daily.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/brewery-concerts',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Live music at Albuquerque brewery' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/brewery-concerts' },
}

const FAQS = [
  {
    q: 'Which Albuquerque breweries have live music?',
    a: 'Canteen Brewhouse on Jefferson has the most consistent live music schedule — multiple shows per week across a big outdoor patio and indoor taproom. Marble Brewery hosts acoustic sets and events at both their locations. JUNO brewery + cafe + art is a smaller spot in Nob Hill with an art-forward crowd. Rio Bravo Brewing does occasional music nights.',
  },
  {
    q: 'Is Canteen Brewhouse the best brewery for live music in ABQ?',
    a: 'It\'s the most active. Canteen has a huge taproom, regular outdoor shows, and enough space to actually enjoy the music without being on top of the stage. They do everything from acoustic solo sets to full bands. Check their calendar on this page.',
  },
  {
    q: 'Do I need tickets for brewery concerts in Albuquerque?',
    a: 'Most regular taproom music nights are free — just walk in. Some featured shows or private events require tickets. Each event listing on this page will tell you if there\'s a cost and link you to tickets if so.',
  },
  {
    q: 'What\'s the brewery scene like in Albuquerque overall?',
    a: 'Strong and local. ABQ has over 30 craft breweries — more per capita than most cities its size. Beyond Canteen and Marble, there\'s La Cumbre (known for Elevated IPA), Tractor Brewing (two taprooms, food trucks), Ex Novo, Ponderosa Brewing, and more. Most are family-friendly during the day and more bar-like in the evening.',
  },
  {
    q: 'What time do Albuquerque breweries close?',
    a: 'Most taprooms close between 9pm and 11pm, earlier than bars. Canteen sometimes runs later on show nights. If you want to extend the evening, head from a brewery to a bar — Sister Bar, Anodyne, or the Launchpad on Central.',
  },
]

const RELATED_LINKS = [
  { name: 'Canteen Brewhouse', url: 'https://canteenbrewhouse.com', description: 'ABQ\'s biggest taproom — consistent live music schedule, patio, food.' },
  { name: 'Marble Brewery', url: 'https://www.marblebrewery.com', description: 'Original ABQ craft brewery with two locations and regular events.' },
  { name: 'JUNO brewery + cafe + art', url: 'https://www.junobrewery.com', description: 'Nob Hill neighborhood spot with music and rotating art exhibitions.' },
  { name: 'New Mexico Brewers Guild', url: 'https://nmbeer.org', description: 'Guide to all craft breweries across New Mexico.' },
]

async function fetchBreweryEvents(): Promise<NormalizedEvent[]> {
  const supabase = createStaticClient()
  const today = new Date().toISOString().slice(0, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .schema('public')
    .from('events')
    .select('id, source, raw, event_date, cached_photo_url, ai_enrichment, featured, hidden, pinned_last, neighborhood, venue_slug, category, venue_name, submitted_by, image_status')
    .eq('hidden', false)
    .gte('event_date', today)
    .or('venue_name.ilike.%brew%,venue_name.ilike.%taproom%,venue_name.ilike.%distill%,venue_name.ilike.%winery%,venue_name.ilike.%cellar%')
    .order('event_date', { ascending: true })
    .limit(100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => normalizeRow(row))
}

export default async function Page() {
  const events = await fetchBreweryEvents()

  const count = events.length
  const venueCount = new Set(events.map(e => e.venue).filter(Boolean)).size

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'brewery-concerts',
        heading: 'Brewery Concerts in Albuquerque',
        lede: `${count} upcoming events across ${venueCount} ABQ breweries and taprooms — live music, trivia nights, and more.`,
        heroImage: {
          src: '/hero/brewery-concerts.png',
          alt: 'Live music at an Albuquerque brewery taproom',
        },
        venueStrip: [
          { name: 'Canteen Brewhouse',  emoji: '🍺', href: 'https://canteenbrewhouse.com' },
          { name: 'Marble Brewery',     emoji: '🍻', href: 'https://www.marblebrewery.com' },
          { name: 'JUNO brewery + art', emoji: '🎨', href: 'https://www.junobrewery.com' },
          { name: 'Rio Bravo Brewing',  emoji: '🎸' },
          { name: 'Hollow Spirits',     emoji: '🥃' },
        ],
        intro: `Albuquerque's craft brewery scene and its live music scene overlap more than most people realize. The best nights out in this city often start — and sometimes end — at a taproom. Canteen Brewhouse on Jefferson runs the most active music calendar: a big indoor/outdoor space with shows most weekends, a rotating cast of local and regional acts, and cold beer that doesn't require you to shout over a DJ to order it. It's the kind of place where you show up for a Tuesday pint and end up staying three hours.\n\nMarble Brewery, one of the originals, does events at both their Downtown and main locations — quieter sets, a loyal crowd of regulars who've been coming since Marble opened in 2008. JUNO brewery + cafe + art is the Nob Hill option: smaller, art-forward, the kind of spot where the walls have rotating exhibitions and the bartender knows the artists. Rio Bravo Brewing does occasional music nights on their patio.\n\nWhat makes brewery concerts different from bar shows: the crowd is there to actually listen. There's no bottle service, no VIP section, no one trying to impress anyone. Just people who like beer and live music in the same room. That's the whole pitch. Canteen does it best and most often, but any of these venues on a show night will give you a good evening.`,
        introExtra: 'Pro tip: Canteen\'s outdoor patio is best on a warm evening. Arrive early — the good spots fill up fast on weekends. Marble Downtown is the pick if you want walkable access to Old Town and easy parking. JUNO is worth a visit on its own merits regardless of what\'s playing.',
        emptyHeading: 'No brewery events right now',
        emptyBody: 'Brewery schedules fill up fast. Check back soon or browse all live music events.',
        breadcrumbLabel: 'Brewery Concerts',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        submitUrl: '/submit',
        submitLabel: 'Know of a taproom show we\'re missing? Submit it.',
      }}
    />
  )
}
