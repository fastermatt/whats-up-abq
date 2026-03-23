import { supabase } from './supabase';

export async function fetchEventsFromDB() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('raw')
    .gte('event_date', today)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: { raw: unknown }) => row.raw);
}

export async function fetchPlacesFromDB() {
  const { data, error } = await supabase
    .from('places')
    .select('raw');

  if (error) throw error;
  return (data ?? []).map((row: { raw: unknown }) => row.raw);
}
