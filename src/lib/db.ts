import { supabase } from './supabase';

export async function fetchEventsFromDB(): Promise<Record<string, unknown[]>> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('id, source, raw, ai_enrichment, cached_photo_url, cached_thumbnail_url')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(2000);
  if (error) throw error;
  const result: Record<string, unknown[]> = {};
  for (const row of (data ?? [])) {
    const r = row as { id: string; source: string; raw: Record<string, unknown>; ai_enrichment: unknown; cached_photo_url?: string; cached_thumbnail_url?: string };
    if (!result[r.source]) result[r.source] = [];
    // Merge ai_enrichment into the raw event object so the app can read it
    const merged = { ...r.raw, _aiEnrichment: r.ai_enrichment ?? null };
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
