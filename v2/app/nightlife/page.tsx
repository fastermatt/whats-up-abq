/**
 * SEO landing page: Albuquerque Nightlife
 * Targets: "albuquerque nightlife", "bars in albuquerque nm", "albuquerque bars"
 * GSC: 557 impressions / 1 click (0.2% CTR) — rewritten for better snippet relevance.
 * Revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents, NormalizedEvent } from '@/lib/events'
import { createStaticClient } from '@/lib/supabase/static'
import { normalizeRow } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

// Tighter title — hits "bars albuquerque" + "nightlife" in first 55 chars
const SEO_TITLE = 'Albuquerque Nightlife: Bars, Live Music & What\'s On Tonight | ABQ Unplugged'
const SEO_DESC  = 'Sister Bar, Nob Hill, Marble Brewery, Downtown — find what\'s happening in Albuquerque tonight. Live music, comedy, taproom nights and late-night spots, all in one place.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
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
    q: 'What\'s the best area for nightlife in Albuquerque?',
    a: 'Nob Hill on Central between Girard and Carlisle. Sister Bar (rooftop + dance floor), Anodyne (dive, pool table, good jukebox), O\'Neill\'s Pub, Nob Hill Bar & Grill. Downtown has the Library Bar and the Kosmos if you want variety but it\'s more spread out.',
  },
  {
    q: 'Which Albuquerque bars have live music?',
    a: 'Sister Bar has live DJs and bands on weekends. The Launchpad on Central is the main rock/indie venue. El Rey Theater does bigger touring acts. Canteen Brewhouse has regular live music in a great taproom setting. Marble Brewery and JUNO do acoustic sets. Check this page for what\'s on tonight.',
  },
  {
    q: 'What time do bars close in Albuquerque?',
    a: 'Most bars close at 2am. Breweries typically close around 10 or 11pm. It\'s not a 4am city — start earlier, maybe 8pm, do a brewery then a bar then live music. You can have a full night by midnight.',
  },
  {
    q: 'Is there a good craft beer scene in Albuquerque?',
    a: 'Yes. Canteen Brewhouse on Jefferson has the biggest taproom and regular live events. Marble Brewery has two locations — Downtown and their main spot. La Cumbre, Tractor Brewing, JUNO brewery + cafe + art. Most have regular music nights.',
  },
  {
    q: 'Are there comedy clubs in Albuquerque?',
    a: 'Hyena\'s Comedy Nightclub is the main one — national touring acts on weekends, open mic on Thursdays. The Kiva Auditorium at the convention center hosts bigger touring comedians. Check this page for the current lineup.',
  },
]

const RELATED_LINKS = [
  { name: 'Visit Albuquerque: Music & Nightlife', url: 'https://www.visitalbuquerque.org/things-to-do/music-and-nightlife/', description: 'Official city guide to bars, clubs, and live music.' },
  { name: 'Tractor Brewing', url: 'https://www.tractorbrewing.com', description: 'Local craft brewery with two taprooms and live music.' },
  { name: 'Marble Brewery', url: 'https://www.marblebrewery.com', description: 'Original ABQ craft brewery — Downtown and main taproom.' },
  { name: 'Hyena\'s Comedy Nightclub', url: 'https://www.hyenascomedynightclub.com/albuquerque/', description: 'National touring comedians and weekly open mics.' },
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
    .or('venue_name.ilike.%brew%,venue_name.ilike.%taproom%,venue_name.ilike.%distill%,venue_name.ilike.%winery%')
    .order('event_date', { ascending: true })
    .limit(60)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => normalizeRow(row))
}

export default async function Page() {
  const [musicResult, comedyResult, foodResult, breweryEvents] = await Promise.all([
    fetchEvents({ category: 'Music',      limit: 80 }),
    fetchEvents({ category: 'Comedy',     limit: 40 }),
    fetchEvents({ category: 'Food & Drink', limit: 40 }),
    fetchBreweryEvents(),
  ])

  // Merge + dedup by id, then sort by date
  const seen = new Set<string>()
  const events = [
    ...breweryEvents,
    ...musicResult.events,
    ...comedyResult.events,
    ...foodResult.events,
  ].filter(e => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 200)

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'nightlife',
        heading: 'Albuquerque Nightlife',
        lede: `${events.length} events — bars, live music, comedy, brewery nights and late-night spots across the city.`,
        heroImage: {
          src: '/hero/nightlife-concert.jpg',
          alt: 'Live music at an Albuquerque nightlife venue',
        },
        venueStrip: [
          { name: 'Sister Bar', emoji: '🎵', href: 'https://www.sisterabq.com' },
          { name: 'Canteen Brewhouse', emoji: '🍺', href: 'https://canteenbrewhouse.com' },
          { name: 'Launchpad', emoji: '🎸', href: 'https://launchpadrocks.com' },
          { name: 'Hyena\'s Comedy', emoji: '🎤', href: 'https://www.hyenascomedynightclub.com/albuquerque/' },
          { name: 'Marble Brewery', emoji: '🍻', href: 'https://www.marblebrewery.com' },
          { name: 'El Rey Theater', emoji: '🎶' },
        ],
        intro: `Albuquerque nightlife doesn't need velvet ropes or a 4am last call to be worth your evening. The main drag is Nob Hill — Central Avenue from Girard to Carlisle — where Sister Bar anchors the strip with a rooftop, a dance floor, and a crowd that actually shows up. Anodyne is a few blocks away: darker, a pool table, a jukebox that plays The Cure. O'Neill's Irish Pub is quieter, reliable. Downtown has the Library Bar for leather chairs and low light, the Kosmos for something weirder and more community-flavored.\n\nThe craft brewery scene has quietly become the backbone of Albuquerque's social life. Canteen Brewhouse on Jefferson is the biggest taproom in the city, with regular live music most weekends. Marble Brewery runs two locations and pulls a loyal crowd. La Cumbre, Tractor, JUNO brewery + cafe + art — they all close earlier than bars, but the crowds are real and the beer is better.\n\nThe trick to a good night out in ABQ: start around 8pm. Hit a brewery first. Move to a bar by 9:30. Catch live music at 10 if there's something worth seeing. By midnight, most things are winding down, and that's fine. The city runs on sunlight. You don't need to burn until 3am to have had a good night.`,
        introExtra: 'If you only do one thing: check what\'s playing at the Launchpad on Central. It\'s the best mid-size music venue in the city — 500 capacity, good sound, no bad sight lines. Touring acts that aren\'t quite stadium-size end up there. The people who show up actually know the music. That\'s the whole thing.',
        emptyHeading: 'No nightlife events listed right now',
        emptyBody: 'We update daily. Check back later or browse all upcoming events.',
        breadcrumbLabel: 'Nightlife',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        submitUrl: '/submit',
        submitLabel: 'Know a bar or show we\'re missing? Submit it.',
      }}
    />
  )
}
