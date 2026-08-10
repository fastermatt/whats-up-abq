/**
 * SEO landing page: Comedy Shows Albuquerque
 * Targets "comedy shows albuquerque", "albuquerque comedy", "comedy club albuquerque".
 * Different from /comedy (event list) — this is the venue guide + scene primer + live listings.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Comedy Shows in Albuquerque, NM — Clubs, Open Mics & Headliners | ABQ Unplugged'
const SEO_DESC =
  "Find comedy shows in Albuquerque — from Hyena's Comedy Nightclub headliners to free open mics at local breweries. ABQ's full comedy guide, updated daily."

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/comedy-shows-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Comedy Shows in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/comedy-shows-albuquerque' },
}

const FAQS = [
  {
    q: 'Where can I see stand-up comedy in Albuquerque?',
    a: "Hyena's Comedy Nightclub (formerly Laff's) on Juan Tabo Blvd is ABQ's main comedy club — national headliners on weekends, a dedicated room, two-drink minimum. The Kiva Auditorium and Popejoy Hall host bigger names on tour. For smaller rooms: The Box Performance Space, some of the comedy nights at Marble Brewery Downtown, and the rotating open mic nights at breweries and bars around the city.",
  },
  {
    q: "Is there an open mic comedy night in Albuquerque?",
    a: "Yes, several. Open mic nights rotate through venues around the city — look for listings at Rio Bravo Brewing, Back Alley Draft House, and occasionally at Launchpad. The scene moves fast and venues change, so the best way to find current open mics is to follow @abqcomedy on Facebook or check the comedy listings on this page. Most are free or just require a drink purchase.",
  },
  {
    q: "Do any famous comedians come to Albuquerque?",
    a: "Yes, on a regular rotation. Hyena's brings national headliners you'd recognize from Netflix specials or late-night TV most weekends. The Kiva Auditorium and Popejoy Hall get bigger touring comedians a few times a year. Albuquerque is a common stop on Southwest regional comedy tours — acts often play here between LA and Phoenix. Check the listings above for who's coming.",
  },
  {
    q: "What is the best comedy club in Albuquerque?",
    a: "Hyena's Comedy Nightclub is the main dedicated comedy venue. It has a proper stage, tiered seating, and consistent national booking. For a more bar-like atmosphere with occasional comedy, Marble Brewery Downtown and some of the Nob Hill spots host pop-up shows. Popejoy Hall is the right answer for bigger names touring full theaters.",
  },
  {
    q: "Are there free comedy shows in Albuquerque?",
    a: "Yes. Most open mic nights are free or ask only for a drink purchase. Rio Bravo Brewing has hosted free comedy nights. Some of the craft brewery comedy nights are no-cover. Check the listings on this page — free events are labeled. The trade-off is that free shows are where the talent is still developing, not where you'll see the polished touring comics.",
  },
]

const RELATED_LINKS = [
  {
    name: "Hyena's Comedy Nightclub",
    url: 'https://www.hyenascomedynightclub.com/albuquerque/',
    description: "ABQ's main comedy club — national touring headliners on weekends, open mic Thursdays.",
  },
  {
    name: 'Kiva Auditorium',
    url: 'https://www.kivaauditorium.com',
    description: '2,300-seat downtown venue that hosts big-name touring comedians.',
  },
  {
    name: 'Popejoy Hall at UNM',
    url: 'https://popejoypresents.com',
    description: "UNM's 2,000-seat performing arts center — occasional major comedy tours.",
  },
  {
    name: 'Visit ABQ: Nightlife',
    url: 'https://www.visitalbuquerque.org/things-to-do/music-and-nightlife/',
    description: 'Official guide to Albuquerque bars, comedy, and live entertainment.',
  },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Comedy', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'comedy-shows-albuquerque',
        heading: 'Comedy Shows in Albuquerque',
        lede: `${events.length} upcoming comedy events — national headliners, local acts, and open mics across ABQ.`,
        venueStrip: [
          { name: "Hyena's Comedy Nightclub", emoji: '😂', href: 'https://www.hyenascomedynightclub.com/albuquerque/' },
          { name: 'Kiva Auditorium',          emoji: '🎤', href: 'https://www.kivaauditorium.com' },
          { name: 'Popejoy Hall',             emoji: '🎭', href: 'https://popejoypresents.com' },
          { name: 'The Box Performance Space', emoji: '📦' },
          { name: 'Marble Brewery Downtown',  emoji: '🍺', href: 'https://www.marblebrewery.com' },
        ],
        intro:
          "Albuquerque's comedy scene has two registers and they're worth knowing about separately. The first is Hyena's Comedy Nightclub on Juan Tabo Blvd — the proper comedy club setup. Tiered seating, a dedicated stage, a two-drink minimum, and national touring comics on a regular schedule. You'll recognize names from Netflix specials and late-night talk shows. It's a real comedy club experience, at a fraction of what you'd pay in a major market.\n\nThe second is the open mic circuit, which is harder to track but often more surprising. Rio Bravo Brewing has hosted comedy nights. Launchpad occasionally has comedy on the bill. There are pop-ups in Nob Hill bars. The local ABQ comedy community is small but active — if you find yourself at an open mic night on a Monday, you might be watching someone who's going to be very good in three years. That's a real thing. The local talent pipeline is real.\n\nFor bigger names: Popejoy Hall and the Kiva Auditorium book full theater comedy tours a handful of times a year. These are the 2,000-seat productions with light shows and merchandise tables. Worth it for the right comedian.",
        introExtra:
          "One observation about comedy in Albuquerque: the audiences are good. Albuquerque crowds are quick and dry. The sense of humor here has a Southwest edge — dark-ish, self-deprecating about the city's reputation, and surprisingly sophisticated about New Mexico-specific references. Visiting comedians often mention it. If you're a fan of deadpan or dark comedy, you're in the right city.",
        emptyHeading: 'No comedy shows listed right now',
        emptyBody: 'New shows get added daily — check back soon. You can also browse all upcoming events.',
        breadcrumbLabel: 'Comedy Shows in Albuquerque',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        submitUrl: '/submit',
        submitLabel: 'Know of a comedy show or open mic we\'re missing? Submit it.',
      }}
    />
  )
}
