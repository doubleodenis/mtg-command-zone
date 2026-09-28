# Runbook — Database Restore

**Applies to:** Supabase project `command-zone` (`kpctqljfxegrmaijjlyb`), region
`us-west-2`, Postgres 17.
**Last exercised:** 2026-09-23 (full restore into a scratch Supabase, verified
against production row and object counts).

The project is on the **free plan, which has no automated backups and no
point-in-time recovery**. The nightly dump in S3 is the only copy. That is the
whole reason this pipeline and this document exist.

> **Read this first.** A restore is not finished when the data loads.
> Migrations **027 and 028 must be re-applied afterwards** or the restored
> database comes back with every rating and notification RPC executable by
> `anon`. See [Step 5](#step-5-re-apply-the-security-migrations-do-not-skip).
> This is not theoretical — it was observed during the 2026-09-23 drill.

---

## 1. What the backup is

| | |
|---|---|
| Produced by | `.github/workflows/backup.yml`, nightly at 08:00 UTC + `workflow_dispatch` |
| Location | `s3://command-zone-db-dumps-usw2/command-zone/` |
| Naming | `backup-YYYY-MM-DDTHH-MM-SSZ.tar.gz` |
| Retention | 14 days, enforced by an S3 lifecycle rule on the `command-zone/` prefix |
| Size | ~35 KB compressed as of 2026-09-23 |

### The schedule is best-effort — know your real RPO

GitHub delays scheduled workflows when its runner pool is busy, and **can skip
a run entirely**. Observed on 2026-09-24: the `0 8 * * *` job actually started
at **13:01 UTC**, a ~5 hour delay. On-the-hour slots are the most contended, so
moving the cron to an odd minute (e.g. `37 8 * * *`) would reduce this.

Practical consequences:

- The worst-case data loss window is **more than 24 hours**, not exactly 24.
- **Absence of last night's archive is not automatically an incident** — check
  `gh run list --workflow backup.yml` before assuming the pipeline broke.
- Before anything risky (a migration, a bulk edit, a playtest), trigger a run
  by hand rather than trusting that the nightly landed:
  `gh workflow run backup.yml --ref main`

The archive holds three files, produced by three separate `supabase db dump`
invocations (the default dump contains neither data nor roles):

| File | Made with | Contents |
|---|---|---|
| `roles.sql` | `--role-only` | custom roles and their grants |
| `schema.sql` | *(default)* | tables, functions, policies, triggers, indexes |
| `data.sql` | `--use-copy --data-only` | `COPY` blocks for `public`, `auth` and `storage` |

### What it can and cannot restore into

`supabase db dump` deliberately **excludes the `auth` and `storage` schema
definitions** — Supabase owns them — while `--data-only` still dumps their
*rows*. So `data.sql` inserts into `auth.users` but `schema.sql` never creates
`auth.users`.

**Consequence: this archive restores into a Supabase instance, not into bare
Postgres.** A plain Postgres target will fail on every `auth.*`/`storage.*`
block. That is by design; do not "fix" it by adding those schemas to the dump.

---

## 2. Prerequisites

- **Docker running.** The Supabase CLI runs `pg_dump`/`psql` in containers
  matched to the server's Postgres version.
- **Supabase CLI** — `npx supabase@latest` is fine, no global install needed.
- **AWS credentials that can READ the bucket.** The CI user
  `command-zone-ci-backup` is deliberately **write-only**; it cannot download.
  Use your own admin credentials (IAM user `denis`) for a restore.
- On **Windows / Git Bash**, prefix `docker` commands with `MSYS_NO_PATHCONV=1`
  or Git Bash rewrites container paths like `/tmp/schema.sql` into
  `C:\tmp\schema.sql` and the copy silently targets the wrong place.

---

## Step 1 — Choose and fetch the archive

```bash
aws s3 ls s3://command-zone-db-dumps-usw2/command-zone/ --human-readable
aws s3 cp s3://command-zone-db-dumps-usw2/command-zone/backup-<TIMESTAMP>.tar.gz .
mkdir -p restore && tar -xzf backup-<TIMESTAMP>.tar.gz -C restore
ls -l restore/   # expect roles.sql, schema.sql, data.sql
```

Sanity-check before trusting it — a 0-byte or truncated `data.sql` is the
failure mode worth catching now rather than mid-restore:

```bash
grep -c '^COPY '        restore/data.sql    # expect ~48
grep -c 'CREATE TABLE'  restore/schema.sql  # expect ~15
```

## Step 2 — Prepare the target

**For a real recovery:** create a new Supabase project (same region,
`us-west-2`) and take its connection string from Project Settings → Database.

**For a drill:** run a throwaway local stack. Remap the ports if you already
have a Supabase stack running for this repo, or the drill will collide with it:

```bash
mkdir restore-drill && cd restore-drill
npx supabase@latest init
# edit supabase/config.toml: shift 543xx ports to 545xx
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase@latest start \
  -x gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` avoids ghcr.io's anonymous-pull
rate limit; `-x` starts only Postgres, which is all a restore needs.

## Step 3 — Load the dump, in order

Order matters: roles, then schema, then data.

```bash
PSQL="psql postgresql://postgres:postgres@127.0.0.1:54522/postgres"   # drill
# PSQL="psql <your new project's connection string>"                  # recovery

$PSQL -v ON_ERROR_STOP=0 -f restore/roles.sql
$PSQL -v ON_ERROR_STOP=0 -f restore/schema.sql
$PSQL -v ON_ERROR_STOP=0 -f restore/data.sql
```

`ON_ERROR_STOP=0` is deliberate — some errors below are expected. **Read the
output; do not trust the exit code.** A restore that emits 200 errors and exits
0 is a failed restore.

### Expected, harmless errors

| Error | Why |
|---|---|
| `"supabase_admin" is a reserved role, only superusers can modify it` (roles.sql) | Supabase manages this role; the target already has it |
| `relation "auth.scim_users" does not exist`, `column "expires_at" of relation "one_time_tokens" does not exist`, `permission denied for table vector_indexes`, `column "lifecycle_configuration" ... does not exist` (data.sql) | Version skew between the source project's `auth`/`storage` schema and the target's. These tables were empty; `auth.users` restores fine. Fewer of these the closer the target's Supabase version is to production |

### Errors that mean STOP

- **Anything from `schema.sql`.** It applied with **zero** errors on
  2026-09-23. Any error means the dump or the target is wrong.
- Failures on `public.*` tables in `data.sql`.
- Foreign-key violations — data loads after constraints exist, so a clean load
  is itself proof of referential integrity.

## Step 4 — Verify the data landed

Compare against production (or against the numbers recorded at the bottom of
this file if production is gone — which is the case you're probably in).

```sql
select relname, n_live_tup from pg_stat_user_tables
where schemaname='public' order by relname;

select count(*) from auth.users;
```

```sql
-- schema objects
select 'functions='||count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all select 'rls_policies='||count(*) from pg_policies where schemaname='public'
union all select 'fkeys='||count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'
union all select 'triggers='||count(*) from pg_trigger t join pg_class cl on cl.oid=t.tgrelid join pg_namespace n on n.oid=cl.relnamespace where n.nspname='public' and not t.tgisinternal
union all select 'indexes='||count(*) from pg_indexes where schemaname='public'
union all select 'rls_enabled='||count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity;
```

## Step 5 — Re-apply the security migrations (DO NOT SKIP)

**A restored database is wide open until this runs.**

Postgres grants `EXECUTE` to `PUBLIC` on every `CREATE FUNCTION`, and Supabase
projects additionally carry `ALTER DEFAULT PRIVILEGES` granting `EXECUTE` to
`anon`. Re-creating the functions from `schema.sql` therefore hands `anon` a
**direct** grant — and the dump's own `REVOKE ... FROM PUBLIC` does not remove
a direct grant. Observed on 2026-09-23: `apply_rating_change` came back
`anon=true` in the restored database despite migration 026 being present in the
dump.

Both migrations are written to be idempotent for exactly this reason.

```bash
$PSQL -v ON_ERROR_STOP=1 -f supabase/migrations/027_lock_down_all_function_grants.sql
$PSQL -v ON_ERROR_STOP=1 -f supabase/migrations/028_add_ownership_checks.sql
```

027 ends with a verification block that **raises** if anything outside the
allowlist is still `anon`-executable, so a silent failure here is not possible.
If it raises, stop and read the function names it lists.

> If you restored by running the full migration chain (`supabase db push`)
> rather than loading `schema.sql`, 027 and 028 are already in that chain and
> this step is redundant — but running them again is harmless.

## Step 6 — Verify the security posture

```sql
select 'anon='  ||count(*) filter (where has_function_privilege('anon',p.oid,'EXECUTE'))
    || ' auth=' ||count(*) filter (where has_function_privilege('authenticated',p.oid,'EXECUTE'))
    || ' public='||count(*) filter (where has_function_privilege('public',p.oid,'EXECUTE'))
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind in ('f','p');
```

**Required: `public=0`.** A non-zero `PUBLIC` count means Step 5 did not run.

```sql
-- must return exactly the six public-page / RLS-helper functions
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and has_function_privilege('anon',p.oid,'EXECUTE')
order by 1;
```

For a real recovery, also run the attack cases TC-SEC-10..19 from
`docs/test-cases.md` before putting the database back in front of users.

## Step 7 — Cut over (real recovery only)

1. Update `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   Netlify to the new project.
2. Update the GitHub Actions secrets: `SUPABASE_DB_URL` (use the **session
   pooler** string — GitHub runners have no outbound IPv6 and the direct host
   resolves IPv6-only), `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`.
3. Re-check Auth settings — providers, redirect URLs, and any password-strength
   settings — these live in project config, **not** in the dump.
4. Re-enable the `pg_cron` nightly recalc if the new project lacks it
   (migration 024).
5. Trigger `backup.yml` manually and confirm an archive lands from the *new*
   project.

## Step 8 — Tear down a drill

```bash
cd restore-drill && npx supabase@latest stop --no-backup
```

---

## Reference: production snapshot, 2026-09-23

Recorded so a future restore can be verified even if production is
unavailable. Expect these to drift as the app grows — treat them as a shape
check, not exact equality.

| Metric | Value |
|---|---|
| `public` tables | 15 |
| functions / policies / FKs | 47 / 46 / 30 |
| triggers / indexes / RLS-enabled tables | 9 / 72 / 15 |
| `auth.users` | 1 |
| After 027+028: anon / authenticated / PUBLIC | 6 / 16 / 0 |

`anon`-executable allowlist: `get_leaderboard`, `get_user_stats`,
`get_deck_stats`, `is_collection_member`, `is_collection_owner`,
`is_collection_public`.

---

## Drill cadence

A backup nobody has restored is a hope, not a backup. Re-run Steps 1–4 and 6
against a local scratch stack **whenever the schema changes materially**, and
at minimum before any playtest or launch. The full drill takes about ten
minutes.

Open gap: this is manual. Automating it in CI is tracked as **P2-3** in
`docs/superpowers/specs/2026-09-23-playtest-hardening-design.md` and needs read
access added to the S3 IAM user, which is currently write-only by design.
