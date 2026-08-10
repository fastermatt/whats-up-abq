/**
 * SEO landing page: Live Music in Albuquerque
 * Auto-populates from live event data, revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 10800 // 3h
const SEO_TITLE = 'Live Music in Albuquerque, NM, Concerts & Shows | ABQ Unplugged'
const SEO_DESC = 'Find live music in Albuquerque, from intimate sets at Sister Bar to headliners at Sunshine Theater. Your local gig guide.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/live-music',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Live Music in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/live-music' },
}

const FAQS = [
  {
    q: 'Where\'s the best place for live music on a weeknight?',
    a: 'Look, it depends on the week. But Sister Bar on Central is usually a safe bet. Launchpad has a solid midweek lineup sometimes. And don\'t sleep on the breweries – Tractor, Marble, La Cumbre all have random nights. Your best bet is to check their Instagram the day of.',
  },
  {
    q: 'Do I need tickets in advance?',
    a: 'Mostly no. For the small venues, pay at the door. Cash is still king at some spots. For bigger acts at Sunshine Theater or El Rey, yeah, get a ticket online. But if you\'re hitting a dive bar on a Wednesday, just show up with $10 and a good attitude.',
  },
  {
    q: 'Is there a local music scene worth knowing about?',
    a: 'Absolutely. It\'s not huge, but it\'s real. Follow @abqlivemusic on Instagram. Go see bands like The Quilties, Fancy Gap, or the Lonely Days. They\'re not famous, but they\'re good. And they\'ll talk to you after the set.',
  },
]

const RELATED_LINKS = [
  { name: 'Visit Albuquerque: Music & Nightlife', url: 'https://www.visitalbuquerque.org/things-to-do/music-and-nightlife/', description: 'Official tourism guide to ABQ\'s live music venues and nightlife picks.' },
  { name: 'Sunshine Theater', url: 'https://www.sunshinetheaterlive.com', description: 'Downtown ABQ venue for touring national acts and local headliners.' },
  { name: 'Launchpad', url: 'https://www.launchpadrocks.com', description: 'Central Ave staple for rock, punk, metal, and hip-hop shows.' },
  { name: 'Popejoy Hall at UNM', url: 'https://popejoypresents.com', description: 'UNM\'s 2,000-seat hall for concerts, Broadway, and orchestra.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Music', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'live-music',
        heading: 'Live Music in Albuquerque',
        lede: `${events.length} upcoming live music events in Albuquerque, indie rock at Launchpad to big concerts at Tingley Coliseum.`,
        intro: "The real ABQ music scene breathes on a Wednesday. That's when the local acts play, the covers are cheap or nonexistent, and the crowd is there because they actually want to be. But there's something happening every night of the week — weekends included.\n\nI've walked into Launchpad on a Tuesday and caught a local band that had no business being that tight. Sister Bar on a Wednesday night is a lottery ticket. Sometimes you get a DJ who thinks they're at Coachella. Other times you get a punk trio that reminds you why you moved here.\n\nThe best shows don't have a cover. They don't have a listing on some polished website. They're on a chalkboard outside a bar on Central. Or they're at a house venue that you swear is someone's garage but it's got a PA system and a fridge full of PBR.\n\nThe thing about Albuquerque music? It's scrappy. It's loud when it wants to be. It's quiet when it's a solo acoustic set at the Cellar Door. You learn to follow the local booking pages on Instagram. You learn that Sunday afternoon at Back Alley Draft House is actually a secret jazz brunch. And you learn that if you wait for the weekend, you'll miss half the good stuff.\n\nDon't wait. Go on a Wednesday. You might even find me there, nursing a beer and nodding along.",
        introExtra: 'I used to think you needed a plan to find live music in this town. Then I realized that\'s the wrong approach. You just show up. A friend texted me once at 8pm: \'Band at Tractor Brewing in 20 minutes.\' I dropped everything. That band was terrible. But the night turned into a thing. Someone pulled out a harmonica. A guy in the corner started a story about a coyote. That\'s not going to happen at a TickPick event. That\'s not going to happen at a venue that charges an arm and a leg. That\'s Albuquerque music. It\'s messy. It\'s personal. And it\'s worth the gamble every time.',
        emptyHeading: 'No live music listings right now',
        emptyBody: 'New shows added daily, check back soon.',
        breadcrumbLabel: 'Live Music',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
