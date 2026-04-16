import { NextRequest } from 'next/server'
import { fetchEventById } from '@/lib/events'
import { buildIcs } from '@/lib/ics'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const event = await fetchEventById(id)

  if (!event) {
    return new Response('Event not found', { status: 404 })
  }

  const ics = buildIcs(event)

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(event.title.slice(0, 60)).replace(/%20/g, '-')}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
