-- Reduce avoidable Disk IO from event ingestion and obsolete analytics work.

-- The Umami bridge has been superseded by first-party analytics and currently
-- records an error snapshot every hour. Use the pg_cron API so this remains
-- compatible with Supabase's protected cron catalog.
do $$
declare
  job record;
begin
  for job in
    select jobid
    from cron.job
    where jobname = 'refresh-umami-hourly'
  loop
    perform cron.unschedule(job.jobid);
  end loop;
end;
$$;

-- No production query uses this GIN index. It was adding index writes for the
-- complete raw payload on every event insert/update.
drop index if exists public.idx_events_raw;

create or replace function public.skip_unchanged_event_update()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  old_row jsonb;
  new_row jsonb;
begin
  old_row := to_jsonb(old) - 'updated_at';
  new_row := to_jsonb(new) - 'updated_at';

  -- ABQtodo stamps every scrape. A new scrape timestamp alone is not a data
  -- change and should not rewrite the heap row or its indexes.
  if jsonb_typeof(old.raw) = 'object' then
    old_row := jsonb_set(old_row, '{raw}', old.raw - 'scraped_at');
  end if;

  if jsonb_typeof(new.raw) = 'object' then
    new_row := jsonb_set(new_row, '{raw}', new.raw - 'scraped_at');
  end if;

  if new_row = old_row then
    return null;
  end if;

  return new;
end;
$$;

revoke all on function public.skip_unchanged_event_update() from public, anon, authenticated;

drop trigger if exists zz_events_skip_unchanged_update on public.events;
create trigger zz_events_skip_unchanged_update
before update on public.events
for each row
execute function public.skip_unchanged_event_update();

comment on function public.skip_unchanged_event_update() is
  'Cancels event updates that change only updated_at or raw.scraped_at, reducing ingestion write amplification.';
