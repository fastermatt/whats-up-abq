import { supabase } from './supabase';

export async function fetchEventsFromDB(): Promise<Record<string, unknown[]>> {
  // Use local date (en-CA = YYYY-MM-DD) — toISOString() is UTC and can return
  // yesterday's date after ~5 PM MDT, causing today's events to disappear.
  const today = new Date().toLocaleDateString('en-CA');
  const { data, error } = await supabase
    .from('events')
    .select('id, source, raw, ai_enrichment, cached_photo_url, cached_thumbnail_url')
    .gte('event_date', today)
    .eq('hidden', false)          // exclude dedup-hidden and manually suppressed events
    .order('event_date', { ascending: true })
    .limit(2000);
  if (error) throw error;
  const result: Record<string, unknown[]> = {};
  for (const row of (data ?? [])) {
    const r = row as { id: string; source: string; raw: Record<string, unknown>; ai_enrichment: unknown; cached_photo_url?: string; cached_thumbnail_url?: string };
    if (!result[r.source]) result[r.source] = [];
    // Merge ai_enrichment into the raw event object so the app can read it
    const merged = { ...r.raw, _aiEnrichment: r.ai_enrichment ?? null };
    // Strip the UTC dateTime field from dates.start — it has caused display bugs
    // where the app accidentally renders UTC time instead of local.
    // localDate + localTime are the only time fields the app should ever read.
    if (merged.dates?.start && 'dateTime' in (merged.dates.start as Record<string, unknown>)) {
      const { dateTime: _dt, ...startClean } = merged.dates.start as Record<string, unknown>;
      merged.dates = { ...merged.dates, start: startClean };
    }
    // If we have a cached Supabase-hosted photo, inject it as the primary image
    // so the frontend doesn't rely on external CDNs that may return 503
    if (r.cached_photo_url) {
      const cachedImg = {
        url: r.cached_photo_url,
        width: 800,
        height: 450,
        ratio: '16_9',
        fallback: false,
      };
      const cachedThumb = r.cached_thumbnail_url ? {
        url: r.cached_thumbnail_url,
        width: 400,
        height: 225,
        ratio: '16_9',
        fallback: false,
      } : null;
      const existingImages = (merged.images as unknown[]) || [];
      // Prepend cached images so they're preferred over external CDN URLs
      merged.images = [cachedImg, ...(cachedThumb ? [cachedThumb] : []), ...existingImages];
    }
    result[r.source].push(merged);
  }
  return result;
}
