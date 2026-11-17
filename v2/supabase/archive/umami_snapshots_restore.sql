-- Restores the Umami snapshot refresh retired on 2026-11-10
-- (migration 20261110174326_retire_umami_snapshots). Not a migration: run it by
-- hand only if Umami analytics should come back.
--
-- Before running:
--  1. Umami Cloud -> Settings -> API keys: create a reader key.
--  2. Supabase -> Edge Functions -> Secrets: set UMAMI_API_KEY to that key.
--  3. Redeploy edge function `umami-proxy` as a relay to https://api.umami.is/v1
--     that reads Deno.env.get("UMAMI_API_KEY") ONLY (never a key in source) and
--     allows only /websites/66fc7cf5-0ae2-4027-9f36-3bf077b96955/(stats|pageviews|metrics).
--     The function below calls it from the database, so the relay must accept
--     that call (the retired version had verify_jwt off).

create or replace view public.umami_latest with (security_invoker = true) as
  select id, captured_at, stats_7d, stats_7d_prev, stats_30d, stats_30d_prev,
         series_30d, top_pages_30d, top_refs_30d, error
  from public.umami_snapshots
  order by captured_at desc
  limit 1;

CREATE OR REPLACE FUNCTION public.refresh_umami_snapshot()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  proxy        text := 'https://bsmvfutebmbkjvlrhiyq.supabase.co/functions/v1/umami-proxy';
  website_id   text := '66fc7cf5-0ae2-4027-9f36-3bf077b96955';
  day_ms       bigint := 86400::bigint * 1000::bigint;
  now_ms       bigint := (extract(epoch from now()) * 1000)::bigint;
  d7_ms        bigint := now_ms - 7::bigint  * day_ms;
  d14_ms       bigint := now_ms - 14::bigint * day_ms;
  d30_ms       bigint := now_ms - 30::bigint * day_ms;
  d60_ms       bigint := now_ms - 60::bigint * day_ms;
  stats7 jsonb; stats7p jsonb; stats30 jsonb; stats30p jsonb;
  series jsonb; top_pages jsonb; top_refs jsonb;
  snapshot_id bigint; err_msg text;
  u_stats text; u_stats_p text; u_s30 text; u_s30_p text; u_series text; u_pages text; u_refs text;
BEGIN
  u_stats    := proxy || '?path=/websites/' || website_id || '/stats&startAt='     || d7_ms  || '&endAt=' || now_ms;
  u_stats_p  := proxy || '?path=/websites/' || website_id || '/stats&startAt='     || d14_ms || '&endAt=' || d7_ms;
  u_s30      := proxy || '?path=/websites/' || website_id || '/stats&startAt='     || d30_ms || '&endAt=' || now_ms;
  u_s30_p    := proxy || '?path=/websites/' || website_id || '/stats&startAt='     || d60_ms || '&endAt=' || d30_ms;
  u_series   := proxy || '?path=/websites/' || website_id || '/pageviews&startAt=' || d30_ms || '&endAt=' || now_ms || '&unit=day&timezone=America/Denver';
  u_pages    := proxy || '?path=/websites/' || website_id || '/metrics&startAt='   || d30_ms || '&endAt=' || now_ms || '&type=url&limit=10';
  u_refs     := proxy || '?path=/websites/' || website_id || '/metrics&startAt='   || d30_ms || '&endAt=' || now_ms || '&type=referrer&limit=10';
  BEGIN
    SELECT content::jsonb INTO stats7     FROM extensions.http_get(u_stats);
    SELECT content::jsonb INTO stats7p    FROM extensions.http_get(u_stats_p);
    SELECT content::jsonb INTO stats30    FROM extensions.http_get(u_s30);
    SELECT content::jsonb INTO stats30p   FROM extensions.http_get(u_s30_p);
    SELECT content::jsonb INTO series     FROM extensions.http_get(u_series);
    SELECT content::jsonb INTO top_pages  FROM extensions.http_get(u_pages);
    SELECT content::jsonb INTO top_refs   FROM extensions.http_get(u_refs);
    INSERT INTO public.umami_snapshots (stats_7d, stats_7d_prev, stats_30d, stats_30d_prev, series_30d, top_pages_30d, top_refs_30d)
    VALUES (stats7, stats7p, stats30, stats30p, series, top_pages, top_refs)
    RETURNING id INTO snapshot_id;
    RETURN snapshot_id;
  EXCEPTION WHEN OTHERS THEN
    err_msg := SQLERRM;
    INSERT INTO public.umami_snapshots (error) VALUES (err_msg) RETURNING id INTO snapshot_id;
    RETURN snapshot_id;
  END;
END;
$function$;
revoke execute on function public.refresh_umami_snapshot() from public, anon, authenticated;

-- The retired setup let anyone with the public key read stats; restore that only
-- if a public dashboard needs it:
--   create policy umami_snapshots_read on public.umami_snapshots for select to anon, authenticated using (true);
--   grant select on public.umami_snapshots, public.umami_latest to anon, authenticated;

-- Hourly refresh (pg_cron):
select cron.schedule('umami-refresh-hourly', '7 * * * *', $$select public.refresh_umami_snapshot()$$);
