/**
 * Canonical weekly roundup: This Weekend in Albuquerque
 * Auto-populates from the live this-weekend event window and revalidates hourly.
 */
import type { Metadata } from 'next'
import { fetchEvents } from '@/lib/events'
import { CuratedListPage } from '@/app/components/CuratedListPage'
import { OG_IMAGE } from '@/lib/fallback-images'

export const revalidate = 3600

const SEO_TITLE = 'Things to Do This Weekend in Albuquerque | ABQ Unplugged'
const SEO_DESC =
  'This Weekend in Albuquerque: concerts, comedy, family events, markets, sports, and local things to do. Updated hourly from ABQ Unplugged.'
const CANONICAL_URL = 'https://abqunplugged.com/weekend-in-albuquerque'

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: SEO_DESC,
  openGraph: {
    title: SEO_TITLE,
    description: SEO_DESC,
    url: CANONICAL_URL,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'This Weekend in Albuquerque events roundup',
      },
    ],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  alternates: { canonical: CANONICAL_URL },
}

const FAQS = [
  {
    q: 'What are the best things to do this weekend in Albuquerque?',
    a: 'The list above updates hourly with live events for this weekend. It includes concerts, comedy, theater, family activities, sports, markets, festivals, and community events across Albuquerque.',
  },
  {
    q: 'Does this page include free weekend events?',
    a: 'Yes. Free and low-cost events appear alongside ticketed shows, with price details shown on each event card when available.',
  },
  {
    q: 'How often is this weekend roundup updated?',
    a: 'The page refreshes every hour, so new events and changes can appear throughout the week without needing a new link.',
  },
  {
    q: 'Can venues or organizers submit weekend events?',
    a: 'Yes. Use the submit link to send events we missed. Albuquerque venues, community groups, artists, markets, and neighborhood organizers are welcome.',
  },
]

export default async function Page() {
  const { events } = await fetchEvents({ timeFilter: 'this-weekend', limit: 60 })

  return (
    <CuratedListPage
      events={events}
      config={{
        slug: 'weekend-in-albuquerque',
        heading: 'This Weekend in Albuquerque',
        lede: `${events.length} things to do this weekend in Albuquerque, updated hourly.`,
        venueStrip: [
          { name: 'Tingley Coliseum', emoji: '🏟️', href: 'https://www.tingleycoliseum.com' },
          { name: 'Isleta Amphitheater', emoji: '🎵', href: 'https://www.isletaamphitheater.net' },
          { name: 'KiMo Theatre', emoji: '🎭', href: 'https://cabq.gov/culturalservices/kimo' },
          { name: 'Explora', emoji: '🧒', href: 'https://www.explora.us' },
          { name: 'ABQ BioPark', emoji: '🌳', href: 'https://www.cabq.gov/artsculture/biopark' },
          { name: 'Rail Yards Market', emoji: '🛍️', href: 'https://www.railyardsmarket.org' },
        ],
        intro:
          "This is the always-fresh weekend link for Albuquerque. Bookmark it, text it to the group chat, or use it when Friday arrives and nobody wants to search ten calendars. We pull the weekend window into one place, from touring shows and theater nights to family programs, markets, comedy sets, sports, festivals, and smaller local events that usually get buried.",
        introExtra:
          "The roundup is built for quick decisions. Scan by category, check the date and time on each card, save anything worth coming back to, then open the event page for venue details and ticket links. It updates hourly, so the same link keeps working every week without stale picks or a manually rebuilt newsletter.",
        emptyHeading: 'No weekend events listed yet',
        emptyBody: 'Check back soon. The weekend roundup refreshes hourly as new Albuquerque events come in.',
        breadcrumbLabel: 'This Weekend in Albuquerque',
        faqs: FAQS,
        submitUrl: '/submit',
        submitLabel: "Know of a weekend event we're missing? Send it in and we'll review it.",
      }}
    />
  )
}
