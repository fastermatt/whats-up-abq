import { supabase } from './supabase';

export async function fetchEventsFromDB(): Promise<Record<string, unknown[]>> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('source, raw')
    .gte('event_date', today)
    .order('event_date', { ascending: true });
  if (error) throw error;
  const result: Record<string, unknown[]> = {};
  for (const row of (data ?? [])) {
    const src = (row as { source: string; raw: unknown }).source;
    const raw = (row as { source: string; raw: unknown }).raw;
    if (!result[src]) result[src] = [];
    result[src].push(raw);
  }
  return result;
}

export async function fetchPlacesFromDB(): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('places')
    .select('raw');
  if (error) throw error;
  return (data ?? []).map((row: { raw: unknown }) => row.raw);
}
