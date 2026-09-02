-- Bounded event retention + durable image-quality metadata.
--
-- The previous purge_old_events() used DELETE ... RETURNING 1 INTO a scalar.
-- It failed whenever more than one event qualified, so the daily cron never
-- reduced the table. Keep a 30-day grace period for recently shared links and
-- cap each run at 500 rows to avoid another burst-I/O incident.

alter table public.events
  add column if not exists image_width integer,
  add column if not exists image_height integer,
  add column if not exists image_bytes integer,
  add column if not exists image_hash text,
  add column if not exists image_quality text;

alter table public.events
  drop constraint if exists events_image_quality_check;

alter table public.events
  add constraint events_image_quality_check
  check (image_quality is null or image_quality in ('compact', 'standard', 'high', 'rejected'));

comment on column public.events.image_width is
  'Intrinsic width of the accepted source image before ABQ optimization.';
comment on column public.events.image_height is
  'Intrinsic height of the accepted source image before ABQ optimization.';
comment on column public.events.image_bytes is
  'Optimized object size in bytes.';
comment on column public.events.image_hash is
  'SHA-256 prefix of optimized image bytes; used for deterministic object names.';
comment on column public.events.image_quality is
  'Display tier: compact, standard, high, or rejected. Compact images must not be used as oversized heroes.';

create or replace function public.purge_old_events()
returns integer
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  deleted_count integer := 0;
begin
  with expired as (
    select id
    from public.events
    where event_date < current_date - interval '30 days'
    order by event_date, id
    limit 500
  )
  delete from public.events e
  using expired
  where e.id = expired.id;

  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    insert into public.analytics (event_type, data)
    values (
      'system_purge',
      jsonb_build_object(
        'deleted_count', deleted_count,
        'cutoff_date', (current_date - interval '30 days')::text,
        'purged_at', now()::text
      )
    );
  end if;

  return deleted_count;
end;
$$;

-- Keep the legacy RPC name compatible with old operational tooling, but make
-- it obey the same 30-day/bounded policy rather than deleting yesterday's URLs.
create or replace function public.purge_past_events()
returns integer
language sql
security invoker
set search_path = public, pg_catalog
as $$
  select public.purge_old_events();
$$;

revoke all on function public.purge_old_events() from public, anon, authenticated;
revoke all on function public.purge_past_events() from public, anon, authenticated;
grant execute on function public.purge_old_events() to service_role;
grant execute on function public.purge_past_events() to service_role;
