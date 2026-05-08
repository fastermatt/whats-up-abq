/**
 * SEO landing page: Concerts in Albuquerque
 * Auto-populates from live event data — revalidates every hour.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Concerts in Albuquerque 2026 — Live Music at Tingley, Isleta, Popejoy | ABQ Unplugged'
const SEO_DESC = 'Find real concerts in Albuquerque — not bar shows. Tingley Coliseum, Isleta Amphitheater, Popejoy Hall. Tickets, dates, and insider tips.'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: 'https://abqunplugged.com/concerts',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Concerts in Albuquerque' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: 'https://abqunplugged.com/concerts' },
}

const FAQS = [
  {
    q: 'What\'s the biggest concert venue in Albuquerque?',
    a: 'Isleta Amphitheater holds about 15,000 for outdoor shows. Tingley Coliseum seats around 11,000 indoors. Popejoy Hall is smaller but has amazing acoustics for theater and orchestral performances.',
  },
  {
    q: 'Where can I buy tickets without huge fees?',
    a: 'Always buy from the venue\'s box office website. Tingley\'s official site and Isleta\'s official page have the lowest fees. Avoid third-party resellers unless you\'re desperate.',
  },
  {
    q: 'Are there free concerts in Albuquerque?',
    a: 'Yes! The summer concert series at Civic Plaza and the Zoo Music series are free or low-cost. Check the venues\' event calendars — we list them when they\'re announced.',
  },
]

const RELATED_LINKS = [
  { name: 'Tingley Coliseum', url: 'https://www.exponm.com/tingley-coliseum', description: '11,000-seat indoor arena at the fairgrounds for major tours and events.' },
  { name: 'Isleta Amphitheater', url: 'https://www.isleta.com/entertainment/amphitheater', description: 'Outdoor venue with a 15,000-person capacity and Sandia Mountain backdrop.' },
  { name: 'Popejoy Hall', url: 'https://popejoypresents.com', description: 'UNM\'s 2,000-seat hall for orchestral, Broadway, and theater performances.' },
  { name: 'AMP Concerts', url: 'https://ampconcerts.org', description: 'Local promoter booking indie and alternative acts at smaller ABQ venues.' },
]

export default async function Page() {
  const { events } = await fetchEvents({ category: 'Music', limit: 200 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'concerts',
        heading: 'Concerts in Albuquerque',
        lede: `See ${events.length} upcoming concerts at Albuquerque's biggest venues — Tingley, Isleta Amphitheater, Popejoy, and more.`,
        intro: 'You\'re looking for a concert. Not a DJ in a dive bar — a real show with a stage, a lawn, or at least an orchestra pit. Albuquerque has some killer venues for that. Tingley Coliseum at the fairgrounds brings in classic rock and country acts. Isleta Amphitheater is the big outdoor spot where you can feel the bass in your chest while the sun sets behind the Sandias. Popejoy Hall at UNM is where you go when you want to feel fancy — Broadway tours, symphony, comedy acts. The trick is knowing who\'s playing when, and avoiding the ticket fees that make you want to scream. We pull directly from the venue box office sites — Tingley\'s official site, Isleta\'s official site, and Popejoy\'s event calendar. No middlemen, no markups. Just the shows that are actually happening. Also worth noting: Kiva Auditorium and the National Hispanic Cultural Center often fly under the radar. We include those too. Stop scrolling, pick a date, and go hear something live. Albuquerque\'s music scene deserves your butt in a seat.',
        introExtra: 'Let\'s be honest: buying concert tickets online is a nightmare. Fees everywhere, resellers inflating prices. That\'s why we link straight to the venue box offices. Tingley Coliseum\'s site has the real inventory. Isleta Amphitheater\'s official page shows their full schedule. And Popejoy Hall\'s calendar updates as soon as new shows are announced. We also keep an eye on the New Mexico Symphony Orchestra and AMP Concerts for smaller, high-quality shows. No fluff — just shows you can actually buy tickets for right now.',
        emptyHeading: 'No concerts listed right now',
        emptyBody: 'Concert schedules vary by season. Check back often — we update as soon as venues announce new shows.',
        breadcrumbLabel: 'Concerts',
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
      }}
    />
  )
}
