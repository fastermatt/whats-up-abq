-- Umami snapshots stopped 2026-09-02 (invalid API key); no app code reads them.
-- Keep the rows as an archive, remove the dead view/refresh function, and stop
-- exposing traffic stats to the public API key.
drop view if exists public.umami_latest;
drop function if exists public.refresh_umami_snapshot();
drop policy if exists umami_snapshots_read on public.umami_snapshots;
revoke all on public.umami_snapshots from anon, authenticated;
comment on table public.umami_snapshots is 'Archive (read-only via service role). Umami refresh retired 2026-11-10; see v2/supabase/archive/umami_snapshots_restore.sql.';
