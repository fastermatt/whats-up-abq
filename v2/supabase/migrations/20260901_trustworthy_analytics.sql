-- Trustworthy first-party traffic measurement.
-- This migration is intentionally additive except for closing the unsafe anon
-- SELECT policy and renaming the historically mislabeled session_id column.

begin;

alter table public.analytics rename column session_id to visitor_id;
alter index if exists public.analytics_session_idx rename to analytics_visitor_idx;

alter table public.analytics
  add column session_id text,
  add column is_bot boolean not null default false,
  add column suspicious boolean not null default false;

create index analytics_session_idx on public.analytics using btree (session_id);
create index analytics_is_bot_idx on public.analytics using btree (is_bot);

create or replace function public.analytics_user_agent_is_bot(user_agent text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  select lower(coalesce(user_agent, '')) = ''
    or lower(coalesce(user_agent, '')) ~
      'bot|spider|crawl|slurp|facebookexternalhit|meta-externalagent|bingpreview|pingdom|uptimerobot|ahrefsbot|semrushbot|mj12bot|petalbot|dotbot|headlesschrome|phantomjs|python-requests|go-http-client|node-fetch|okhttp|curl/|axios/|whatsapp|telegrambot|discordbot|linkedinbot|redditbot'
$function$;

create or replace function public.fn_analytics_classify_bot()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $function$
begin
  new.is_bot := public.analytics_user_agent_is_bot(new.data->>'user_agent');
  return new;
end;
$function$;

drop trigger if exists trg_analytics_classify_bot on public.analytics;
create trigger trg_analytics_classify_bot
before insert on public.analytics
for each row execute function public.fn_analytics_classify_bot();

-- Existing pageviews did not carry a user agent. Classify them with the most
-- recent session_start from the same legacy visitor ID instead.
update public.analytics as event_row
set is_bot = public.analytics_user_agent_is_bot(coalesce(
  event_row.data->>'user_agent',
  (
    select session_row.data->>'user_agent'
    from public.analytics as session_row
    where session_row.visitor_id = event_row.visitor_id
      and session_row.event_type = 'session_start'
      and session_row.data ? 'user_agent'
    order by abs(extract(epoch from session_row.created_at - event_row.created_at))
    limit 1
  )
));

-- Anyone with the public anon key could previously read all visitor IDs,
-- referrers and user agents. Admin code uses service_role and bypasses RLS.
drop policy if exists read_analytics on public.analytics;

create table public.analytics_daily_rollup (
  day date not null,
  event_type text not null,
  is_bot boolean not null,
  events bigint not null,
  distinct_visitors bigint not null,
  primary key (day, event_type, is_bot)
);
alter table public.analytics_daily_rollup enable row level security;

create or replace function public.refresh_analytics_daily_rollup()
returns void
language sql
set search_path = public, pg_catalog
as $function$
  insert into public.analytics_daily_rollup (
    day, event_type, is_bot, events, distinct_visitors
  )
  select
    (created_at at time zone 'America/Denver')::date,
    event_type,
    is_bot,
    count(*),
    count(distinct visitor_id)
  from public.analytics
  where created_at >= now() - interval '2 days'
  group by 1, 2, 3
  on conflict (day, event_type, is_bot) do update
  set events = excluded.events,
      distinct_visitors = excluded.distinct_visitors;
$function$;

create or replace function public.purge_old_analytics()
returns void
language sql
set search_path = public, pg_catalog
as $function$
  delete from public.analytics where created_at < now() - interval '30 days';
$function$;

revoke execute on function public.refresh_analytics_daily_rollup() from public, anon, authenticated;
revoke execute on function public.purge_old_analytics() from public, anon, authenticated;

select public.refresh_analytics_daily_rollup();

select cron.unschedule(jobid)
from cron.job
where jobname in ('rollup-analytics-daily', 'purge-old-analytics');

select cron.schedule(
  'rollup-analytics-daily',
  '0 4 * * *',
  $cron$select public.refresh_analytics_daily_rollup()$cron$
);
select cron.schedule(
  'purge-old-analytics',
  '30 4 * * *',
  $cron$select public.purge_old_analytics()$cron$
);

-- Migration-time classifier assertions: fail the transaction if either side
-- of the bot rule regresses.
do $assertions$
begin
  if not public.analytics_user_agent_is_bot('facebookexternalhit/1.1') then
    raise exception 'analytics bot classifier failed known-bot assertion';
  end if;
  if public.analytics_user_agent_is_bot(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36'
  ) then
    raise exception 'analytics bot classifier failed normal-browser assertion';
  end if;
end;
$assertions$;

commit;

-- Rollback (run deliberately; not executed as part of this migration):
-- select cron.unschedule(jobid) from cron.job
--   where jobname in ('rollup-analytics-daily', 'purge-old-analytics');
-- drop function if exists public.purge_old_analytics();
-- drop function if exists public.refresh_analytics_daily_rollup();
-- drop table if exists public.analytics_daily_rollup;
-- drop trigger if exists trg_analytics_classify_bot on public.analytics;
-- drop function if exists public.fn_analytics_classify_bot();
-- drop function if exists public.analytics_user_agent_is_bot(text);
-- drop index if exists public.analytics_is_bot_idx;
-- drop index if exists public.analytics_session_idx;
-- alter table public.analytics drop column if exists suspicious;
-- alter table public.analytics drop column if exists is_bot;
-- alter table public.analytics drop column if exists session_id;
-- alter index if exists public.analytics_visitor_idx rename to analytics_session_idx;
-- alter table public.analytics rename column visitor_id to session_id;
-- create policy read_analytics on public.analytics for select
--   to anon, authenticated using (true);
