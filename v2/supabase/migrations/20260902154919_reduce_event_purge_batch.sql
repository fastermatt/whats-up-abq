-- The project reported depleted burst I/O while its old-event backlog was
-- draining. Keep the existing 30-day retention policy but reduce each daily
-- transaction from 500 rows to 100. This lets autovacuum and normal traffic
-- share the small compute instance without a cleanup spike.

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
    limit 100
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

revoke all on function public.purge_old_events() from public, anon, authenticated;
grant execute on function public.purge_old_events() to service_role;
