/**
 * SEO landing page: Live Music in Albuquerque Tonight
 * Targets "live music Albuquerque tonight" — high-intent local query.
 * Revalidates every 15 minutes (tonight's lineup changes throughout the day).
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 900 // 15 min — tonight's events change fast

const SEO_TITLE = 'Live Music in Albuquerque Tonight — Shows & Concerts | ABQ Unplugged'
const SEO_DESC =
  "Find live music happening in Albuquerque tonight. From Sister Bar and Launchpad to Sunshine Theater — tonight's shows, times, and tickets in one place."

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/live-music-tonight',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Live Music in Albuquerque Tonight' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/live-music-tonight' },
}

const FAQS = [
  {
    q: "What live music is happening in Albuquerque tonight?",
    a: "ABQ Unplugged pulls live music from Ticketmaster, Eventbrite, SeatGeek, and local venues updated daily. Tonight's lineup above shows every show we know about — filter by neighborhood or venue to narrow it down.",
  },
  {
    q: "Do I need tickets in advance for tonight's shows?",
    a: "Smaller venues like Sister Bar, Launchpad, and Tractor Brewing usually sell at the door — show up with cash or card. For bigger acts at Sunshine Theater, El Rey, or Kiva Auditorium, buy online. Same-day tickets sell out by 7pm for popular shows.",
  },
  {
    q: "What time do most live music shows start in Albuquerque?",
    a: "Doors typically open at 7pm, with openers at 8pm and headliners at 9–9:30pm for club shows. All-ages and early shows (like at the BioPark or outdoor venues) often start at 5–6pm. Check each event listing for exact times.",
  },
  {
    q: "Where is the best live music in Albuquerque?",
    a: "Depends on the vibe. For touring national acts: Sunshine Theater (cap 750) and El Rey Theater (cap 900). For local originals: Sister Bar on Central, Launchpad on Central, and Back Alley Draft House. For jazz: Babydoll's House of Jazz. For classical and Broadway: Popejoy Hall at UNM.",
  },
  {
    q: "Is there free live music in Albuquerque tonight?",
    a: "Yes — Tractor Brewing, Marble Brewery, and La Cumbre regularly host free live music nights. Local restaurants like the Range Cafe sometimes have acoustic sets. Check the filter above and select 'Free' to see no-cover shows tonight.",
  },
]

const RELATED_LINKS = [
  { name: 'All Live Music in Albuquerque', url: 'https://abqunplugged.com/live-music', description: 'Browse the full upcoming live music calendar — not just tonight.' },
  { name: 'Concerts in Albuquerque', url: 'https://abqunplugged.com/concerts', description: 'Larger concerts and headlining acts coming to ABQ.' },
  { name: 'Nightlife in Albuquerque', url: 'https://abqunplugged.com/nightlife', description: "Bars, clubs, and late-night spots — ABQ's after-dark scene." },
  { name: 'Sunshine Theater', url: 'https://www.sunshinetheaterlive.com', description: 'Downtown ABQ venue for touring acts and local headliners.' },
  { name: 'Launchpad', url: 'https://www.launchpadrocks.com', description: 'Central Ave staple for rock, punk, metal, and hip-hop.' },
]

export default async function Page() {
  const { events } = await fetchEvents({
    category: 'Music',
    timeFilter: 'tonight',
    limit: 200,
  })

  const count = events.length

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'live-music-tonight',
        heading: 'Live Music in Albuquerque Tonight',
        lede:
          count > 0
            ? `${count} live music show${count === 1 ? '' : 's'} happening in Albuquerque tonight.`
            : "Check back after noon — tonight's shows get added throughout the day.",
        intro:
          "The best Albuquerque nights don't start with a plan. They start with someone saying \"there's a show at Sister Bar tonight\" at 6pm. Then you scramble, you text the group chat, and two hours later you're front row to a band you'd never heard of and you're all in. That's the Albuquerque live music experience. It's not polished. It's real. The venues are small. The bartenders remember your name. The band sets up ten feet from where you're standing. We track every show in Albuquerque tonight — from the tiny jazz sets at Babydoll's to the big rock nights at Sunshine Theater. No cover, $5 cover, $30 tickets — all of it. The list above updates throughout the day as venues post their lineups. Bookmark this page. Check it before you decide tonight is a \"stay in\" night. It probably isn't.",
        emptyHeading: "No music shows listed yet for tonight",
        emptyBody:
          "Venues post their lineups throughout the day — check back after noon. You can also browse all upcoming live music or check the full tonight page for non-music events.",
        breadcrumbLabel: 'Live Music Tonight',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
