/**
 * SEO landing page: Christian & Faith Events in Albuquerque
 * Targets "christian concerts albuquerque", "christian events albuquerque", etc.
 *
 * Events are auto-tagged by scripts/tag-christian-music.mjs (artist keyword match)
 * and by scrape-lovenm.mjs (is_christian flag on lovenm.org events).
 * Both write ai_enrichment.christian_music = true.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600 // 1 hr

const SEO_TITLE = 'Christian & Faith Events in Albuquerque | ABQ Unplugged'
const SEO_DESC =
  'Find Christian concerts, worship nights, gospel shows, and faith community events in Albuquerque, NM. Updated daily from local churches, Ticketmaster, Eventbrite, and community orgs.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/christian-music-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Christian Events in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/christian-music-albuquerque' },
}

const FAQS = [
  {
    q: 'Where do Christian events happen in Albuquerque?',
    a: 'Larger touring Christian acts typically play Kiva Auditorium, Popejoy Hall, or Route 66 Casino Hotel. Mid-size shows land at Sunshine Theater, El Rey Theater, or Revel Entertainment Center. Worship nights and local Christian artists often perform at Sagebrush Church, Calvary Church, and other Albuquerque congregations. Community faith events like Freedom Celebration take place at Balloon Fiesta Park.',
  },
  {
    q: 'How often do Christian concerts come to Albuquerque?',
    a: 'Albuquerque sees several major Christian touring acts per year — Winter Jam, K-LOVE Fan Awards tours, and individual artists like TobyMac, Casting Crowns, and Lauren Daigle have all made stops here. Worship nights and local gospel events happen much more frequently throughout the year.',
  },
  {
    q: 'Are there free Christian events in Albuquerque?',
    a: 'Yes. Many local churches host free worship concerts, gospel nights, and community events open to the public — and community orgs like Love NM run free events throughout the year in Albuquerque. Check this page for no-cost options, or browse the free events calendar.',
  },
  {
    q: 'What is the difference between CCM, Christian rock, and worship music?',
    a: "Contemporary Christian Music (CCM) is the broad commercial genre — artists like TobyMac, Casting Crowns, and Lauren Daigle. Christian rock skews harder, with bands like Skillet, Switchfoot, and Newsboys. Worship music is specifically written for congregational singing — Hillsong United, Elevation Worship, and Bethel Music are the big names. All three show up in Albuquerque's Christian music scene.",
  },
  {
    q: 'How does ABQ Unplugged find Christian events?',
    a: "We cross-reference every upcoming event title against a list of 150+ known Christian artists, and we pull directly from lovenm.org — a local Christian community org that runs events in Albuquerque year-round. When there's a match, the event gets tagged and shows up here. If you know of an event we're missing, use the Submit an Event button below.",
  },
]

const RELATED_LINKS = [
  { name: 'All Live Music in Albuquerque', url: '/live-music', description: 'The full upcoming music calendar across all genres.' },
  { name: 'Concerts in Albuquerque', url: '/concerts', description: 'Larger ticketed concerts and headlining acts.' },
  { name: 'Family-Friendly Events', url: '/family-friendly', description: 'All-ages events great for families in Albuquerque.' },
  { name: 'Free Events in Albuquerque', url: '/free', description: 'No-cost events happening around the city.' },
  { name: 'K-LOVE Concert Finder', url: 'https://www.klove.com/music/concerts', description: 'National Christian radio station with a full tour calendar.' },
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
        heading: 'Christian & Faith Events in Albuquerque',
        lede:
          count > 0
            ? `${count} upcoming Christian and faith event${count === 1 ? '' : 's'} in Albuquerque.`
            : "No Christian or faith events currently listed — check back soon or browse all events.",
        intro:
          "From sold-out worship nights at Sagebrush to TobyMac stopping through on a national tour, Albuquerque has a real Christian and faith event scene. It doesn't always make the front page of mainstream event sites because it lives in a different ecosystem — church announcements, K-LOVE, word of mouth, and community organizations like Love NM.\n\nWe track it anyway. This page brings together Christian concerts, worship events, gospel shows, and faith community events across the Albuquerque area — from national CCM acts to local praise bands to free community events open to everyone. Updated daily as new events are announced.",
        emptyHeading: 'No Christian or faith events currently listed',
        emptyBody:
          'Check back soon — we update daily as new events are announced. You can also browse all upcoming events or submit one we might have missed.',
        breadcrumbLabel: 'Christian & Faith Events',
        submitUrl: '/submit',
        submitLabel: "We update daily but don't catch everything — especially local church and community events.",
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
