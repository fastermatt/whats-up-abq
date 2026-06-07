/**
 * SEO landing page: Concerts Albuquerque
 * Targets "concerts albuquerque", "albuquerque concerts 2026", "upcoming concerts albuquerque".
 * Different from /concerts which targets "concerts in albuquerque" + venue-specific queries.
 * This page is the comprehensive concert scene guide: venues, tips, how-to, live listings.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Concerts Albuquerque 2026 — Upcoming Shows & Concert Guide | ABQ Unplugged'
const SEO_DESC =
  'Find upcoming concerts in Albuquerque, from Isleta Amphitheater and Tingley Coliseum to intimate shows at Launchpad and El Rey. Your Albuquerque concert guide, updated daily.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/concerts-albuquerque',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Concerts in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/concerts-albuquerque' },
}

const FAQS = [
  {
    q: 'What concerts are coming to Albuquerque in 2026?',
    a: 'The listings above update daily with every confirmed Albuquerque concert — from national touring acts at Isleta Amphitheater and Tingley Coliseum to local and regional shows at Launchpad, El Rey Theater, and Sunshine Theater. Larger tours typically announce 3–6 months in advance; local and indie shows can appear days before they happen.',
  },
  {
    q: 'What is the biggest concert venue in Albuquerque?',
    a: 'Isleta Amphitheater holds around 15,000 for outdoor shows — it\'s the premier venue for major summer tours, with the Sandia Mountains as a backdrop. Tingley Coliseum at Expo New Mexico seats around 11,000 indoors for arena shows. Popejoy Hall at UNM seats 2,000 and has excellent acoustics for orchestral, Broadway, and mid-size touring acts.',
  },
  {
    q: 'Where should I buy concert tickets in Albuquerque?',
    a: 'Buy from the venue\'s official box office whenever possible — it avoids third-party markups. Isleta\'s official site, Tingley\'s official ticketing page, and Popejoy\'s box office all sell tickets directly. For smaller shows at Launchpad or Sister Bar, the venue\'s website or door tickets are usually the cheapest options. Avoid third-party resellers unless the show is sold out.',
  },
  {
    q: 'Are there free outdoor concerts in Albuquerque?',
    a: 'Yes. Civic Plaza hosts free outdoor concerts and community events throughout the summer. Canteen Brewhouse has regular free live music on their patio. Tractor Brewing, Marble Brewery, and La Cumbre all run free taproom music nights. The ABQ BioPark occasionally hosts free music events. We list all of these when they\'re announced.',
  },
  {
    q: 'What music venues are in Albuquerque?',
    a: 'Large venues: Isleta Amphitheater (15,000), Tingley Coliseum (11,000), Kiva Auditorium (2,300), Popejoy Hall (2,000). Mid-size: Sunshine Theater (800), El Rey Theater (700), National Hispanic Cultural Center Roy E. Disney Center. Small/independent: Launchpad (500), Sister Bar, The Box Performance Space, Outpost Performance Space (jazz + world music). Brewpub stages: Canteen Brewhouse, Marble Brewery, Tractor Brewing.',
  },
  {
    q: 'What\'s the best time of year for concerts in Albuquerque?',
    a: 'Summer and fall. Isleta Amphitheater runs its outdoor season from May through October. Balloon Fiesta week in early October typically brings big concert acts to the area. The indoor venues run year-round. January through March tends to have lighter touring schedules nationally, so the big acts thin out — but local venues stay active.',
  },
]

const RELATED_LINKS = [
  {
    name: 'Isleta Amphitheater',
    url: 'https://www.isletaamphitheater.net',
    description: '15,000-seat outdoor venue — the home of big summer concerts in ABQ.',
  },
  {
    name: 'Tingley Coliseum',
    url: 'https://www.tingleycoliseum.com',
    description: '11,000-seat indoor arena at Expo New Mexico for arena-scale shows.',
  },
  {
    name: 'Popejoy Hall',
    url: 'https://popejoypresents.com',
    description: 'UNM\'s 2,000-seat performing arts center — Broadway, orchestra, mid-size concerts.',
  },
  {
    name: 'AMP Concerts',
    url: 'https://ampconcerts.org',
    description: 'Albuquerque\'s main independent promoter booking indie and alternative acts.',
  },
  {
    name: 'Sunshine Theater',
    url: 'https://sunshinetheaterlive.com',
    description: 'Central Ave venue for 800-capacity shows — touring indie, rock, and alternative.',
  },
  {
    name: 'Visit ABQ: Music & Nightlife',
    url: 'https://www.visitalbuquerque.org/things-to-do/music-and-nightlife/',
    description: 'Official guide to live music venues and the ABQ music scene.',
  },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Music', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'concerts-albuquerque',
        heading: 'Concerts in Albuquerque',
        lede: `${events.length} upcoming concerts — arena tours at Isleta and Tingley to local shows at Launchpad and Sister Bar.`,
        venueStrip: [
          { name: 'Isleta Amphitheater',  emoji: '🎶', href: 'https://www.isletaamphitheater.net' },
          { name: 'Tingley Coliseum',     emoji: '🏟️', href: 'https://www.tingleycoliseum.com' },
          { name: 'Popejoy Hall',         emoji: '🎭', href: 'https://popejoypresents.com' },
          { name: 'Sunshine Theater',     emoji: '🎸', href: 'https://sunshinetheaterlive.com' },
          { name: 'Launchpad',            emoji: '🚀', href: 'https://launchpadrocks.com' },
          { name: 'El Rey Theater',       emoji: '👑' },
        ],
        intro:
          "Albuquerque's concert scene runs the full spectrum. On one end you have Isleta Amphitheater — a 15,000-seat outdoor venue at the foot of the Sandia Mountains, where the summers bring country megastars, classic rock tours, and the occasional hip-hop headliner. The mountain backdrop behind the stage is genuinely exceptional; sunset shows here are the kind of thing people mention for years.\n\nOn the other end you have Launchpad on Central — a 500-person room where the floor is sticky, the sound is loud, and the bands are playing because they want to be there. AMP Concerts is the local indie promoter that books Launchpad, El Rey, and the Sunshine Theater. If you're looking for acts you've heard of but can't see in an arena, check AMP's calendar.\n\nIn the middle: Sunshine Theater (800 capacity), El Rey Theater (700), Popejoy Hall at UNM (2,000 with acoustics built for orchestral work — it's where the New Mexico Philharmonic plays and where Broadway tours land). The National Hispanic Cultural Center has a performing arts complex that books jazz, world music, and cultural programming that doesn't show up on mainstream ticketing sites.",
        introExtra:
          "One thing Albuquerque gets right: you can still get close. At Launchpad, 'good seats' means standing 15 feet from the stage. At the El Rey, there isn't a bad spot. Even Sunshine Theater is small enough that you can hear the actual guitars instead of just the PA. That intimacy is harder to find in larger markets. Take advantage of it while you can — these venues are genuinely underpriced relative to what you get.",
        emptyHeading: 'No concerts listed right now',
        emptyBody: 'Concert schedules vary by season — check back soon or browse all live music events.',
        breadcrumbLabel: 'Concerts in Albuquerque',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
