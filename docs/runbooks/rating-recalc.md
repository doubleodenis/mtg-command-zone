# Runbook — Nightly Rating Recalc

Ratings are rebuilt by replaying every confirmed match in order
(`src/lib/rating-replay.ts`). The **Nightly Rating Recalc** GitHub Action runs it
at 04:00 UTC whenever a match is dirty and swaps the result in atomically
(`apply_rating_replay`, migration 030). Collection ratings for late joiners,
newly added/approved matches and auto-confirmed members only appear after
this run.

## One-time setup (before merging Plan B)
1. Supabase → Project Settings → API Keys → create a **secret** key.
2. GitHub → Settings → Secrets and variables → Actions → add
   `SUPABASE_SECRET_KEY`. (`NEXT_PUBLIC_SUPABASE_URL` already exists.)
3. Deploy migrations 030 and 031 **before** the app. The app calls 031's
   functions; 030 unschedules the old pg_cron job.

## First run against production: dry run first
Before the first real write, run the workflow manually with **force** and
**dry_run** ticked. It reads production and prints every rating that would
change, largest first, and writes nothing. Review it: changes should be
explainable (confirm-time approximations corrected, late joiners gaining
collection ratings). Only then let the schedule (or a non-dry run) write.

## Run it now
GitHub → Actions → Nightly Rating Recalc → Run workflow (tick **force** to
replay even with nothing dirty). Locally against a project:
`npx tsx scripts/recalculate-ratings.ts --dry-run` first, then without it.

## If it fails
Nothing was changed: the swap is one transaction. The job log names the
step. A "Refusing to swap: loaded X of Y" error means the data load came back
short. Re-run; if it repeats, investigate before forcing anything.

A "confirmations changed since the replay snapshot (expected X, found Y)"
error means a player confirmed a match while the replay was running.
Nothing was changed (dirty flags stay set too), so the next scheduled run
handles it; or re-run the workflow manually now (tick **force** if nothing
was dirty to begin with).

## One-time data repair (playtest match, 2026-09-30)
The old SQL recalc cleared the dirty flag on the playtest match without
recalculating it. After setup above, flag any match and run the workflow;
the replay is global, so every rating, including that match, is rebuilt:

    update matches set is_dirty = true
    where id = (select id from matches order by played_at desc limit 1);

Then run the workflow and check the collection leaderboard.
