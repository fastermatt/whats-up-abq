import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { venueToSlug } from '@/lib/events'

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

  // Venue slugs use the canonical venueToSlug() from lib/events (imported above)
  // so sitemap URLs exactly match what /venues/[slug] resolves — the hand-rolled
  // version diverged on special-char venues ("AT&T" → "att" vs "at-t").

  // ── Assemble sitemap ──────────────────────────────────────────────────────
  // All 10 event category pages
  const CATEGORY_SLUGS = [
    'music', 'sports', 'arts-theater', 'comedy', 'family',
    'food-drink', 'film', 'community', 'festivals', 'outdoor',
  ]

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl,                     lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${baseUrl}/events`,         lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${baseUrl}/tonight`,        lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/weekend`,        lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/this-week`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/free`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/family-friendly`,lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/date-night`,     lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/things-to-do`,       lastModified: new Date(), changeFrequency: 'daily',   priority: 0.75 },
    { url: `${baseUrl}/movies`,             lastModified: new Date(), changeFrequency: 'daily',   priority: 0.75 },
    { url: `${baseUrl}/venues`,             lastModified: new Date(), changeFrequency: 'daily',   priority: 0.75 },
    { url: `${baseUrl}/neighborhoods`,      lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.75 },
    // Keyword landing pages — auto-populate with live event data
    { url: `${baseUrl}/live-music`,              lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/comedy`,                  lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/arts`,                    lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/sports-events`,           lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/nightlife`,               lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/concerts`,                lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/balloon-fiesta`,          lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/outdoor-activities`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8  },
    { url: `${baseUrl}/food-drink-events`,       lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8  },
    { url: `${baseUrl}/festivals`,               lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8  },
    { url: `${baseUrl}/kids-activities`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8  },
    { url: `${baseUrl}/things-to-do-this-weekend`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8  },
    // Tonight pages — high-intent, time-sensitive keyword targets
    { url: `${baseUrl}/live-music-tonight`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    { url: `${baseUrl}/comedy-tonight`,             lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8  },
    // Today page — "things to do in albuquerque today" (~1,500/mo)
    { url: `${baseUrl}/things-to-do-today`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    // Date night ideas guide — "albuquerque date night ideas" (~1,600/mo)
    { url: `${baseUrl}/albuquerque-date-night-ideas`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    // Free events guide — evergreen high-volume keyword
    { url: `${baseUrl}/free-events-albuquerque`,    lastModified: new Date(), changeFrequency: 'daily',   priority: 0.85 },
    // Niche landing pages — lower volume but high conversion intent
    { url: `${baseUrl}/christian-music-albuquerque`, lastModified: new Date(), changeFrequency: 'daily',  priority: 0.75 },
    { url: `${baseUrl}/brewery-concerts`,           lastModified: new Date(), changeFrequency: 'daily',  priority: 0.85 },
    { url: `${baseUrl}/art-events-albuquerque`,     lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8 },
    { url: `${baseUrl}/farmers-markets-albuquerque`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.75 },
    // Geo-modified landing pages — target "{category} albuquerque" / "albuquerque {category}" queries
    { url: `${baseUrl}/things-to-do-in-albuquerque`,      lastModified: new Date(), changeFrequency: 'daily',  priority: 0.9  },
    { url: `${baseUrl}/concerts-albuquerque`,             lastModified: new Date(), changeFrequency: 'daily',  priority: 0.85 },
    { url: `${baseUrl}/comedy-shows-albuquerque`,         lastModified: new Date(), changeFrequency: 'daily',  priority: 0.85 },
    { url: `${baseUrl}/family-events-albuquerque`,        lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8  },
    { url: `${baseUrl}/outdoor-activities-albuquerque`,   lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8  },
    { url: `${baseUrl}/arts-theater-albuquerque`,         lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8  },
    { url: `${baseUrl}/welcome`,        lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/about`,          lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    // Category pages — high SEO value
    ...CATEGORY_SLUGS.map(slug => ({
      url: `${baseUrl}/categories/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
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
