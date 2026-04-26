import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://abqunplugged.com'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // ── Events ───────────────────────────────────────────────────────────────
  const { data: events } = await supabase
    .schema('public')
    .from('events')
    .select('id, updated_at')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: false })
    .limit(2000)

  // ── Venues — top by event count ───────────────────────────────────────────
  const { data: venueRows } = await supabase
    .schema('public')
    .from('events')
    .select('venue_name')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .not('venue_name', 'is', null)
    .limit(5000)

  // Count and deduplicate venues
  const venueCounts: Record<string, number> = {}
  for (const row of (venueRows ?? []) as { venue_name: string }[]) {
    if (row.venue_name) venueCounts[row.venue_name] = (venueCounts[row.venue_name] ?? 0) + 1
  }
  const topVenues = Object.entries(venueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([name]) => name)

  // ── Neighborhoods ─────────────────────────────────────────────────────────
  const { data: neighborhoodRows } = await supabase
    .schema('public')
    .from('events')
    .select('neighborhood_slug')
    .eq('hidden', false)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .not('neighborhood_slug', 'is', null)
    .limit(5000)

  const neighborhoodSlugs = [
    ...new Set(
      (neighborhoodRows ?? [])
        .map((r: { neighborhood_slug: string }) => r.neighborhood_slug)
        .filter(Boolean)
    ),
  ] as string[]

  // ── Venue slug helper ─────────────────────────────────────────────────────
  const venueToSlug = (name: string) =>
    encodeURIComponent(
      name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
    )

  // ── Assemble sitemap ──────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,                     lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/events`,         lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${baseUrl}/tonight`,        lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/weekend`,        lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/this-week`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/free`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.75 },
    { url: `${baseUrl}/family-friendly`,lastModified: new Date(), changeFrequency: 'daily',   priority: 0.75 },
    { url: `${baseUrl}/date-night`,     lastModified: new Date(), changeFrequency: 'daily',   priority: 0.75 },
    { url: `${baseUrl}/venues`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 0.7 },
    { url: `${baseUrl}/neighborhoods`,  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${baseUrl}/about`,          lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]

  const eventPages: MetadataRoute.Sitemap = (events ?? []).map(
    (e: { id: string; updated_at?: string }) => ({
      url: `${baseUrl}/events/${e.id}`,
      lastModified: e.updated_at ? new Date(e.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })
  )

  const venuePages: MetadataRoute.Sitemap = topVenues.map((name) => ({
    url: `${baseUrl}/venues/${venueToSlug(name)}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.65,
  }))

  const neighborhoodPages: MetadataRoute.Sitemap = neighborhoodSlugs.map((slug) => ({
    url: `${baseUrl}/neighborhoods/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.65,
  }))

  return [...staticPages, ...eventPages, ...venuePages, ...neighborhoodPages]
}
