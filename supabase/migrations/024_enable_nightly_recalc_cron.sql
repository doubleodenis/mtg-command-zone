-- Enables pg_cron and schedules the nightly dirty-match rating recalculation.
--
-- Migration 018 shipped the recalculate_dirty_matches() procedure but left
-- scheduling as a manual dashboard step (see comments at the bottom of that
-- file). That step was never done, so dirty matches have been accumulating
-- without a nightly recalc since 018 was applied.
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'nightly-rating-recalc',
  '0 4 * * *',
  $$call recalculate_dirty_matches(100)$$
);
