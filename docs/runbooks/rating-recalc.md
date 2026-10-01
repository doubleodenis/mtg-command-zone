# Runbook — Nightly Rating Recalc

Ratings are rebuilt by replaying every confirmed match in order
(`src/lib/rating-replay.ts`). The **Nightly Rating Recalc** GitHub Action runs it
at 04:00 UTC whenever a match is dirty and swaps the result in atomically
(`apply_rating_replay`, migration 030). Collection ratings for late joiners,
newly added/approved matches and auto-confirmed members only appear after
this run.

**Write gate.** Scheduled runs only write when the repo variable
`RATING_REPLAY_WRITE_ENABLED` is `true`. Until it is set, every scheduled run
is a dry run: it logs the diff and writes nothing. Manual runs ignore the
variable and do exactly what their **force** / **dry_run** inputs say.

## First-run sequence (Plan B rollout)
1. Supabase → Project Settings → API Keys → create a **secret** key.
2. GitHub → Settings → Secrets and variables → Actions → Secrets → add
   `SUPABASE_SECRET_KEY`. (`NEXT_PUBLIC_SUPABASE_URL` already exists.)
3. Merge the PR. Migrations reach production through CI, not by hand: on
   every push to `main`, the **Deploy Migrations to Production** job in
   `.github/workflows/ci.yml` runs `supabase db push --include-all`, which
   applies 030 and 031 (030 also unschedules the old pg_cron job). The app
   calls 031's functions, so wait for that job to go green before relying on
   the new app behaviour. If the app must never run without 031, apply the
   migrations from the branch with `supabase db push` before merging; CI's
   push is then a no-op.
4. GitHub → Actions → Nightly Rating Recalc → Run workflow with **force** and
   **dry_run** ticked. It reads production and prints the ratings that would
   change, largest first: the top 50, then "… and N more". It writes nothing.
5. Review the diff. Changes should be explainable (confirm-time
   approximations corrected, late joiners gaining collection ratings).
6. GitHub → Settings → Secrets and variables → Actions → Variables → add
   `RATING_REPLAY_WRITE_ENABLED` = `true`.
7. Run the workflow manually with **force** ticked (and **dry_run** not
   ticked). This is the first real write. From now on the schedule writes too.

Alternative to step 4, before merging: run a local dry run against
production. Export the production URL and secret key in the shell only
(never write them to `.env.local` or any other file):

    export NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
    export SUPABASE_SECRET_KEY=<secret key>
    npx tsx scripts/recalculate-ratings.ts --dry-run

## Run it now
GitHub → Actions → Nightly Rating Recalc → Run workflow (tick **force** to
replay even with nothing dirty). Locally against a project:
`npx tsx scripts/recalculate-ratings.ts --dry-run` first, then without it.

## If it fails
The swap is one transaction, so a failed swap changes nothing. The job log
names the step. A "Refusing to swap: loaded X of Y" error means the data
load came back short. Re-run; if it repeats, investigate before forcing
anything.

A "confirmations changed since the replay snapshot (expected X, found Y)"
error means a player confirmed a match while the replay was running.
Nothing changed (dirty flags stay set too), so the next scheduled run
handles it. You can also re-run the workflow manually now (tick **force** if
nothing was dirty to begin with).

**Timeout or cancel during "Replay ratings".** If the job timed out or was
cancelled while that step was running, the swap may still have committed
on the database side. Before assuming nothing changed, check the latest
`recalculation_log` row: if its `completed_at` is set and falls inside the
run, the swap went through.

    select started_at, completed_at, triggered_by, matches_processed
    from recalculation_log order by started_at desc limit 1;

**Failure notifications.** By default, GitHub emails a scheduled-workflow
failure only to the user who last edited the cron line in the workflow file.
Check your Actions notification settings (GitHub → Settings →
Notifications → Actions) so that failures reach whoever owns this job.

## One-time data repair (playtest match, 2026-09-30)
The old SQL recalc cleared the dirty flag on the playtest match without
recalculating it. No SQL is needed: the replay is global, so the first
forced, non-dry run in the first-run sequence (step 7) rebuilds every
rating, including that match. Afterwards, check the collection
leaderboard.
