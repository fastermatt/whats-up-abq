import { fetchEvents } from '@/lib/events'

export const revalidate = 3600

const SITE_URL = 'https://abqunplugged.com'

function escapeXml(value: string | null | undefined) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function eventPubDate(date: string) {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : date
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toUTCString() : parsed.toUTCString()
}

export async function GET() {
  const { events } = await fetchEvents({ timeFilter: 'upcoming', limit: 50 })
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date))
  const now = new Date().toUTCString()

  const items = sortedEvents.map((event) => {
    const url = `${SITE_URL}/events/${encodeURIComponent(event.id)}`
    const description = event.about ?? event.description ?? ''

    return [
      '    <item>',
      `      <title>${escapeXml(event.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${escapeXml(eventPubDate(event.date))}</pubDate>`,
      `      <description>${escapeXml(description)}</description>`,
      event.category ? `      <category>${escapeXml(event.category)}</category>` : '',
      '    </item>',
    ].filter(Boolean).join('\n')
  }).join('\n')

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>ABQ Unplugged Events</title>',
    `    <link>${SITE_URL}</link>`,
    '    <description>Upcoming Albuquerque events from ABQ Unplugged.</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${escapeXml(now)}</lastBuildDate>`,
    `    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />`,
    items,
    '  </channel>',
    '</rss>',
  ].join('\n')

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
