import { fetchEvents } from '@/lib/events'

export const revalidate = 3600

const SITE_URL = 'https://abqunplugged.com'

function eventDatePublished(date: string) {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : date
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

export async function GET() {
  const { events } = await fetchEvents({ timeFilter: 'upcoming', limit: 50 })
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date))

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'ABQ Unplugged Events',
    home_page_url: SITE_URL,
    feed_url: `${SITE_URL}/api/feed.json`,
    description: 'Upcoming Albuquerque events from ABQ Unplugged.',
    items: sortedEvents.map((event) => {
      const url = `${SITE_URL}/events/${encodeURIComponent(event.id)}`
      const description = event.about ?? event.description ?? ''

      return {
        id: event.id,
        url,
        title: event.title,
        content_text: description,
        date_published: eventDatePublished(event.date),
        tags: event.category ? [event.category] : [],
      }
    }),
  }

  return Response.json(feed, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
