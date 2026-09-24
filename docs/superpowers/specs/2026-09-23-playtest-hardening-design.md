# Playtest Hardening — Design

**Date:** 2026-09-23
**Branch:** `fix/lock-down-function-grants` (P0 items), follow-ups TBD
**Status:** P0 implemented but uncommitted; P1+ not started

## Motivation

Closing the gap between "works locally" and "safe to let real people touch"
before the playtest. An audit of all 48 routines in `public`, plus a genuine
restore of a production backup into a scratch Supabase, turned up one
vulnerability class repeated in several places and a handful of smaller gaps.

The through-line: **migrations 025 and 026 fixed 11 functions by name, and
enumerating by hand is why the other 37 were missed.** Everything in P0 is
written to be exhaustive by construction instead.

Two findings drive the priority order:

1. Until 027/028 land, any signed-in user can set **any** player's rating to
   **any** value (`apply_rating_change` took a `p_user_id` and a
   `p_new_rating` and checked neither), and any unauthenticated caller could
   reach 21 `SECURITY DEFINER` functions over `/rest/v1/rpc/`. For an ELO
   tracker, rating integrity is the product.
2. A restore of a backup **silently re-opens** everything 025/026/027 close.
   Supabase projects carry `ALTER DEFAULT PRIVILEGES` granting EXECUTE to
   `anon`, so re-creating a function from a dump hands `anon` a *direct*
   grant that the dump's own `REVOKE ... FROM PUBLIC` does not remove.
   Verified live: `apply_rating_change` came back `anon=true` after restore
   despite 026.

---

## P0 — Blocks the playtest

### P0-1. Deny-by-default EXECUTE on every routine
**Status:** implemented, uncommitted — `supabase/migrations/027_lock_down_all_function_grants.sql`

21 `SECURITY DEFINER` functions were executable by `anon`, including
`create_notification`, `mark_notifications_read/seen`,
`dismiss_notifications`, `mark_ratings_applied` and `get_or_create_rating`.
`SECURITY DEFINER` bypasses RLS, so an unauthenticated caller could write
rows for any user.

Iterates `pg_proc` rather than listing signatures: revokes from
`PUBLIC`/`anon`/`authenticated` across the board, then re-grants only what an
allowlist names. Routines added later are locked by default. Ends with a
verification block that raises if anything outside the allowlist is still
`anon`-executable.

- Must cover `prokind IN ('f','p')` — `recalculate_dirty_matches` is a
  PROCEDURE and a `'f'`-only filter silently skips it.
- `is_collection_member/owner/public` must stay granted to `anon`: they are
  referenced by RLS policies on `collections`/`collection_members`, and policy
  expressions are evaluated as the *calling* role.
- `upsert_rating_history`, `update_user_rating`, `clear_match_dirty_flag` and
  `get_match_participants_for_recalc` are service_role-only. Their only
  non-script caller is `/api/debug/recalculate`, which 403s unless
  `NODE_ENV=development`.

**Acceptance:** `anon=6`, `authenticated=16`, `PUBLIC=0` over all 48 routines.

### P0-2. Caller-ownership checks on SECURITY DEFINER functions
**Status:** implemented, uncommitted — `supabase/migrations/028_add_ownership_checks.sql`

P0-1 decides *who* may call; it does not constrain *what* they may pass. Each
function below took a target id straight from the caller:

| Function | Pre-fix exposure |
|---|---|
| `apply_rating_change` | set any player's rating to any value |
| `mark_notifications_read` / `_seen` / `dismiss_notifications` | mutate any user's notifications |
| `get_unread_notification_count` / `get_unseen_notification_count` | read any user's notification state |
| `mark_ratings_applied` / `mark_match_dirty` | flip rating bookkeeping on any match |

`ratings` and `rating_history` have RLS enabled with **no write policies at
all**, so these functions are the only write path — the checks belong here,
not in table policies.

Design constraints discovered while implementing:

- **Bypass when `auth.uid() IS NULL`.** That is service_role (maintenance
  scripts run with `SUPABASE_SECRET_KEY`) and pg_cron.
- **The rating check is "both caller and target are participants of this
  match", not "target = auth.uid()".** `logMatch` auto-confirms accepted
  friends and rates them from the *reporter's* session; a self-only check
  breaks that feature.
- `CREATE OR REPLACE` cannot drop parameter defaults —
  `mark_notifications_read`/`dismiss_notifications` must keep
  `p_notification_ids DEFAULT NULL`.

Also adds a `BEFORE UPDATE` trigger on `match_participants`: the "Participant
can confirm own slot" policy is `USING (auth.uid() = user_id)` with no column
restriction, and RLS cannot express one, so a player could flip their own
`is_winner` and have a rating applied off it. The trigger allows the creator
to edit the result, allows the `NULL -> auth.uid()` claim transition
(`claimSlotWithAutoApproval` is run by the claimer, not the creator), and
blocks everything else.

**Acceptance:** see TC-SEC-* in `docs/test-cases.md`. All attack cases raise;
all legitimate flows (friend auto-confirm, self-confirm, deck backfill,
placeholder claim, service_role) still pass.

### P0-3. Password security settings
**Status:** not started. Dashboard → Authentication → Sign In / Providers →
Email → **Password Security**
(`/dashboard/project/kpctqljfxegrmaijjlyb/auth/providers?provider=Email`).

The security advisor flags leaked-password protection as disabled. Note that
**it is a Pro-plan feature and the `devbydenis` org is on `free`**, so this one
is not a free toggle — it needs an upgrade, not a click.

Available on free in the same panel, and worth doing regardless:

- Minimum password length >= 8.
- Required character classes: digits, lower and uppercase, symbols.

Existing users with weaker passwords can still sign in but receive a
`WeakPasswordError` on `signInWithPassword`, so tightening this mid-playtest
is visible to testers rather than silently locking anyone out.

Treat the free strength settings as the pre-playtest action and HIBP as a
"when we upgrade" item.

### P0-4. Restore runbook
**Status:** not started.

The backup pipeline works and a restore has been verified once by hand, but
nothing records the two facts that make a restore correct:

1. **Re-apply 027 and 028 after every restore** (both are idempotent for
   exactly this reason), or the restored database is wide open.
2. The archive restores into **a Supabase project, not bare Postgres** —
   `data.sql` carries `auth.*`/`storage.*` rows whose schemas the dump
   deliberately excludes because Supabase owns them.

---

## P1 — Should land before real ratings matter

### P1-1. Client-supplied `p_new_rating`
P0-2 stops a user touching strangers, but a player can still pass an arbitrary
`p_new_rating` for someone they genuinely played with. The function cannot
validate a number it did not compute.

Options: recompute the delta in the database (conflicts with CLAUDE.md's
"rating algorithm lives entirely in `rating.ts` as pure functions"), or move
the write behind a server-only path that the client cannot call directly.
**Needs a product decision before implementation.**

### P1-2. Result edits after ratings are applied
The match creator can flip `is_winner` after `ratings_applied_at` is set, and
that does **not** mark the match dirty (only bracket changes do). Ratings then
silently disagree with the recorded result. Pre-existing, not introduced by
P0-2's trigger. Fix is likely to extend the dirty-match trigger to result
columns.

### P1-3. Pin `search_path` on the remaining routines
38 of 48 still have a mutable `search_path` (advisor lint 0011). On a
`SECURITY DEFINER` function this is a privilege-escalation vector: a caller
who can create objects in an earlier schema on the path can shadow a name and
have it run as the owner. 028 pins the 9 it already rewrites; the rest need
`ALTER FUNCTION ... SET search_path = public, pg_temp`, which needs its own
restore test since it changes name resolution for every function.

---

## P2 — Correctness and confidence

### P2-1. `notifications` has no DELETE policy
`logMatch` deletes another user's stale `match_pending_confirmation`
notification, but with no DELETE policy that statement silently affects 0 rows
today. Result: stale "needs your confirmation" notifications persist for
auto-confirmed friends. Not a security issue — a latent product bug.

### P2-2. `get_or_create_rating` has no ownership check
Deliberately left open to `authenticated`: the confirm path legitimately
fetches opponents' ratings. It only creates default rows, so the impact is row
spam rather than rating manipulation. Revisit with P1-1.

### P2-3. Automate the restore test
A backup is only proven by a restore. Today that is a manual exercise. A CI
job that pulls the newest archive and restores it into a scratch Supabase
would verify every backup. Needs read access added to the S3 IAM user (it is
currently write-only by design) plus a new secret.

### P2-4. Investigate local lint noise
`npm run lint` reports ~25,600 problems locally and is identical with all
current changes stashed, yet CI lint passes. Likely local build artifacts
being linted. Pre-existing; worth resolving so lint output is usable.

---

## P3 — Known gaps, non-blocking

- Match detail page never renders per-participant deck bracket
  (`participant-list.tsx` fetches `deck.bracket` and does not display it).
- No `.env.example`.
- No `robots.txt` / `sitemap.ts`.

---

## Out of scope

Table RLS was audited during this work and is in good shape: every write
policy on `collections`, `collection_members`, `collection_matches`, `decks`,
`friends`, `matches`, `match_participants`, `match_invite_tokens`,
`notifications` and `profiles` is scoped to `auth.uid()`. The two gaps found
are P0-2's column guard and P2-1, both listed above. No blanket RLS rewrite is
proposed.
