/**
 * SEO landing page: Christian Music in Albuquerque
 * Targets "christian concerts albuquerque", "christian bands albuquerque", etc.
 *
 * Events are auto-tagged by scripts/tag-christian-music.mjs which runs
 * after each ingestion pass and matches titles against a curated artist list.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600 // 1 hr — Christian events don't change that fast

const SEO_TITLE = 'Christian Music Concerts in Albuquerque | ABQ Unplugged'
const SEO_DESC =
  'Find Christian music concerts, worship nights, and gospel events in Albuquerque, NM. Updated daily from Ticketmaster, Eventbrite, and local venues.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/christian-music-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Christian Music in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/christian-music-albuquerque' },
}

const FAQS = [
  {
    q: 'Where do Christian bands and artists play in Albuquerque?',
    a: 'Larger touring Christian acts typically play Kiva Auditorium, Popejoy Hall, or Route 66 Casino Hotel. Mid-size shows land at Sunshine Theater, El Rey Theater, or Revel Entertainment Center. Worship nights and local Christian artists often perform at Sagebrush Church, Calvary Church, Casa del Rey, and other Albuquerque congregations.',
  },
  {
    q: 'How often do Christian concerts come to Albuquerque?',
    a: 'Albuquerque sees several major Christian touring acts per year — Winter Jam, K-LOVE Fan Awards tours, and individual artists like TobyMac, Casting Crowns, and Lauren Daigle have all made stops here. Worship nights and local gospel events happen much more frequently throughout the year.',
  },
  {
    q: 'Are there free Christian music events in Albuquerque?',
    a: 'Yes. Many local churches host free worship concerts, gospel nights, and praise events open to the community. Check this page for no-cost options, or browse local listings at Sagebrush Church and Calvary Church ABQ.',
  },
  {
    q: 'What is the difference between CCM, Christian rock, and worship music?',
    a: "Contemporary Christian Music (CCM) is the broad commercial genre — artists like TobyMac, Casting Crowns, and Lauren Daigle. Christian rock skews harder, with bands like Skillet, Switchfoot, and Newsboys. Worship music is specifically written for congregational singing — Hillsong United, Elevation Worship, and Bethel Music are the big names. All three show up in Albuquerque's Christian music scene.",
  },
  {
    q: 'How does ABQ Unplugged find Christian music events?',
    a: "We cross-reference every upcoming event title against a list of 150+ known Christian artists. When there's a match, the event gets tagged and shows up here. We also pull from church-adjacent venues directly. If you know of a Christian event we're missing, use the Submit an Event button.",
  },
]

const RELATED_LINKS = [
  { name: 'All Live Music in Albuquerque', url: 'https://abqunplugged.com/live-music', description: 'The full upcoming music calendar across all genres.' },
  { name: 'Concerts in Albuquerque', url: 'https://abqunplugged.com/concerts', description: 'Larger ticketed concerts and headlining acts.' },
  { name: 'Family-Friendly Events', url: 'https://abqunplugged.com/family-friendly', description: 'All-ages events great for families in Albuquerque.' },
  { name: 'Sagebrush Church Events', url: 'https://www.sagebruschurch.com', description: 'One of Albuquerque\'s largest churches, regularly hosts worship events.' },
  { name: 'K-LOVE Concert Finder', url: 'https://www.klove.com/experiences/tours', description: 'National Christian radio station with a full tour calendar.' },
]

export default async function Page() {
  const { events } = await fetchEvents({
    christianMusic: true,
    limit: 200,
  })

  const count = events.length

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'christian-music-albuquerque',
        heading: 'Christian Music in Albuquerque',
        lede:
          count > 0
            ? `${count} upcoming Christian music event${count === 1 ? '' : 's'} in Albuquerque.`
            : "No Christian music events currently listed — check back soon or browse all live music.",
        intro:
          "From sold-out worship nights at Sagebrush to TobyMac stopping through on a national tour, Albuquerque has a real Christian music scene. It doesn't always make the front page of event sites because it lives in a different ecosystem — church announcements, K-LOVE, word of mouth. We track it anyway. This page pulls together every Christian concert, worship event, and gospel show we can find in the Albuquerque area, from national CCM acts to local praise bands to Latin Christian artists. Updated daily. If something is missing, hit the Submit an Event button at the bottom of the page.",
        emptyHeading: 'No Christian music events currently listed',
        emptyBody:
          'Check back soon — we update daily as new events are announced. You can also browse all upcoming live music or submit an event we might have missed.',
        breadcrumbLabel: 'Christian Music',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
