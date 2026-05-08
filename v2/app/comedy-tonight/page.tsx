/**
 * SEO landing page: Comedy in Albuquerque Tonight
 * Targets "comedy Albuquerque tonight" — high-intent local query.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 900 // 15 min

const SEO_TITLE = "Comedy Shows in Albuquerque Tonight — Stand-Up & Improv | ABQ Unplugged"
const SEO_DESC =
  "Find comedy shows happening in Albuquerque tonight. Stand-up at Hyena's and Laffs, improv at The Box, open mics — all of tonight's laughs in one place."

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/comedy-tonight',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Comedy in Albuquerque Tonight' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/comedy-tonight' },
}

const FAQS = [
  {
    q: "What comedy shows are happening in Albuquerque tonight?",
    a: "ABQ Unplugged tracks stand-up, improv, and open mic comedy across Albuquerque. The list above updates daily. Hyena's Comedy Nightclub on Louisiana hosts touring national acts most nights, while Laffs Comedy Caffe on Menaul has both touring and local headliners.",
  },
  {
    q: "Where can I see stand-up comedy in Albuquerque tonight?",
    a: "The main venues for stand-up tonight are Hyena's Comedy Nightclub and Laffs Comedy Caffe. For improv, check The Box Performance Space in Nob Hill. Many breweries and bars also host open mic nights — check the listings above for the full picture.",
  },
  {
    q: "Do I need to buy comedy tickets in advance?",
    a: "For headlining acts at Hyena's and Laffs, buy online — popular shows sell out. Open mics and smaller shows are usually walk-in with a one or two drink minimum. Check each listing for the door policy.",
  },
]

const RELATED_LINKS = [
  { name: 'All Comedy in Albuquerque', url: 'https://abqunplugged.com/comedy', description: 'Browse all upcoming comedy shows in ABQ.' },
  { name: "Hyena's Comedy Nightclub", url: 'https://www.hyenascomedynightclub.com/albuquerque', description: 'Touring national acts on Louisiana Blvd.' },
  { name: 'Laffs Comedy Caffe', url: 'https://www.laffs.com', description: 'Stand-up comedy on Menaul with local and touring headliners.' },
]

export default async function Page() {
  const { events } = await fetchEvents({
    category: 'Comedy',
    timeFilter: 'tonight',
    limit: 200,
  })

  const count = events.length

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'comedy-tonight',
        heading: 'Comedy in Albuquerque Tonight',
        lede:
          count > 0
            ? `${count} comedy show${count === 1 ? '' : 's'} happening in Albuquerque tonight.`
            : "No comedy shows posted yet for tonight — check back after noon.",
        intro:
          "Albuquerque's comedy scene punches above its weight. Hyena's brings in national touring acts weekly. Laffs has been a fixture since before most of us were adults. The Box does improv that's actually funny — and that's a rare thing to be able to say about improv. Then there's the open mic circuit, which is where you find the city's best-kept secret comedians — the ones who are three years away from being famous and right now are doing sets at a brewery on a Tuesday. Tonight's listings are all above. If you're going to a club show, get there early — the two-drink minimum goes down easier when you're not rushing. If you're doing an open mic, sit in the back and tip your server. The comedian on stage is watching you.",
        emptyHeading: "No comedy shows listed yet for tonight",
        emptyBody: "Venues post their lineups throughout the day. Check the full comedy calendar or browse tonight's events across all categories.",
        breadcrumbLabel: 'Comedy Tonight',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
