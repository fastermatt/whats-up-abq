-- Keep every existing maintenance job daily, but avoid the previous 03:00-04:30
-- startup cluster on the Nano database. Minute 10 also avoids top-of-hour load.

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'nightly-image-backfill'),
  schedule := '10 3 * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'purge-old-events'),
  schedule := '10 7 * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'rollup-analytics-daily'),
  schedule := '10 11 * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'purge-old-analytics'),
  schedule := '10 15 * * *'
);
