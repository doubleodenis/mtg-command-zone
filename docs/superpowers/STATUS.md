# Playtest Follow-up — Status

**Last updated:** 2026-10-02
**Source spec:** `docs/superpowers/specs/2026-09-30-playtest-feedback-design.md`
**Read this first** if you are picking the work up in a new session or with a
different model. Update it whenever a plan finishes, a branch merges, or
something is deployed.

## Branches (stacked, none pushed or merged)

Each branch is cut from the one above it. Merging a branch brings in every
row above it, so the top row is the base and merges first.

| Branch | Head | Contents |
|---|---|---|
| `docs/playtest-feedback-2026-09-30` | `b4e53d3` | Spec + step 1 plan |
| `fix/match-details-nav-participants` | `44992c8` | Step 1: match details nav, clickable participants, per-participant bracket |
| `fix/plan-a-display-fixes` | `bd0d2f8` | Plan A: Top Commanders, Compared to You copy, notifications (+ migration 029), rapid-round backlog |
| `fix/plan-b-rating-correctness` | `a81f92f` | Plan B: rating correctness. ✅ Done (final review clean). |

## Plans

| Plan | File | State | Review |
|---|---|---|---|
| Step 1: Match details nav + participants (B1, F5) | `plans/2026-09-30-match-details-nav-and-participants.md` | ✅ Done | Final review: 0 Critical/Important; 2 of 3 minors fixed (`44992c8`), 1 → rapid round R10 |
| Plan A: Display fixes (B3, B4, F6) | `plans/2026-10-01-plan-a-display-fixes.md` | ✅ Done | Final review: 2 Important fixed (`bab875e`), 9 minors → rapid round R1–R9 |
| Plan B: Rating correctness (B2, F4) | `plans/2026-10-01-plan-b-rating-correctness.md` | ✅ Done | Fable review after every task (Tasks 2 and 4 needed one fix round); final review: 3 Important fixed in one fix wave, re-review clean. Deferred minors listed below |
| Plan C: Match editing (F2, F3) | not written | Ready to plan | — |
| Plan D: Comments + avatars (F1, F7) | not written | Not started | — |
| Rapid round (14 small fixes) | `specs/2026-10-01-rapid-round-feedback.md` | Backlog (R14 done) | — |

Plan checkboxes are not ticked retroactively. This table is the source of
truth for whether a plan is done.

## Deploy prerequisites (in order)

1. **Migration 029** (`mark_notifications_seen` by ID) must reach production
   **before** the Plan A app code. App-first breaks mark-seen (PGRST202).
   Failures report to Sentry.
2. **Plan B** (full steps: `docs/runbooks/rating-recalc.md`, "First-run
   sequence"):
   1. Create a Supabase secret key and add it as the GitHub repo secret
      `SUPABASE_SECRET_KEY`.
   2. Merge the PR. CI's **Deploy Migrations to Production** job applies 030
      and 031 (030 also unschedules the old pg_cron job); wait for it to go
      green before relying on the new app behaviour.
   3. Run **Nightly Rating Recalc** manually with **force** + **dry_run**. It
      reads production and writes nothing; review the per-player diff.
   4. Set the repo variable `RATING_REPLAY_WRITE_ENABLED` = `true`.
   5. Run **Nightly Database Backup** (`backup.yml`) manually and wait for it
      to go green: the first write replaces every confirm-time
      `rating_history` snapshot irreversibly.
   6. Run the workflow manually with **force** only (no dry_run): the first
      real write. It also serves as the one-time repair of the playtest match
      whose dirty flag the broken SQL recalc cleared. From then on the
      schedule writes too (a full replay every night, not only when a match
      is dirty).

## Decisions (user)

- **2026-09-30:**
  - Backfill collection ratings for members who join late.
  - Top Commanders ranks by win rate with a 3-game minimum, grouped by
    commander.
  - Comments: participants plus collection members.
  - Auto-confirm skips Unknown Deck.
  - Edit window is 5 days, with no confirmation reset; only rating-affecting
    edits trigger recalc.
  - Collection ratings require membership.
- **2026-10-01:**
  - The empty "Top Commander" card says "Needs a commander with 3+ games".
  - Smaller issues go to a rapid-round file.
  - Nightly recalc is the TS replay run from a GitHub Action, and the SQL
    procedure is retired.
  - Collection actions only flag matches; the nightly replay writes
    collection ratings ("updates overnight"). No admin key in the app.
  - Auto-confirm is a full confirm.
  - Plan B runs with Fable implementers and reviewers, a review after every
    task, and reviewers suggesting improvements to the ratings flow.

## Implementer rulings (decisions made during execution)

- **Step 1:**
  - Worked on a feature branch rather than a worktree.
  - The browser check ran against a prod build on :3002, because the user's
    :3001 dev server had crashed.
  - Lint ran per task, with a full lint at the end.
- **Plan A:**
  - Strengthened the bracket-null test: as written it passed before the
    implementation existed.
  - Imported the empty-card label from the `@/lib/services` barrel.
  - The Task 5 gate excluded one test that is intentionally red until Task 6.
  - The plan's original deploy note was backwards, and was corrected in
    `709bcc3`.
- **Plan B:**
  - Every implementer and reviewer ran on Fable (user directive).
  - Task 2: history `created_at` = the match's `played_at` (the plan would have
    collapsed all history to one instant). Also promoted into the fix round:
    payload/consistency checks inside the swap, and a table lock plus a
    re-count of confirmations so a confirm during the run can't be erased.
    `apply_rating_replay` therefore takes `p_expected_confirmed`.
  - Task 4: scheduled writes are gated behind the repo variable
    `RATING_REPLAY_WRITE_ENABLED`, not just documented; `permissions:
    contents: read`.
  - Final review: the schedule does a **full** replay every night (dirty
    flags alone missed self-confirm collection drift, removals, deck edits
    and tampered values). The script refuses non-dry writes to a non-local
    host outside CI unless `--confirm-host=<host>`.
  - Not done (follow-up): wiring the nightly job into `ci-failure-triage`.
    The triage is CI-specific and could paste per-player diffs into a public
    issue.
  - Recovered from a power cut mid-Task 2: the branch ref and the git index
    were corrupted; restored from the reflog, `fsck` clean, no work lost.
  - SQL check scripts for 029–031 are now kept in `supabase/tests/`
    (manual, local-only).

## Production facts (read-only checks, 2026-09-30 / 10-01)

- **The nightly SQL recalc never succeeded:** 15 runs since 2026-09-17, 0
  successes. Cause: swapped arguments in `recalculate_dirty_matches()` →
  `upsert_rating_history`. Each failing user rolled back, so no ratings were
  corrupted, but the dirty flags were still cleared.
- **No non-member collection rating rows exist.** Nothing to clean up.
- **Production is small:** 2 matches, 3 confirmed participations, 3
  collection members (2026-10-01). A full replay takes milliseconds.
- **The member-add notification is created correctly.** The navbar dropdown
  just never showed it. Fixed in Plan A.

## Open questions / risks (not in any plan yet)

Raised by the Plan B reviewers, priority first. Full lists are in git history
for this file. The per-task notes were in the deleted Plan B workspace.

**Needs a decision from you:**
- **Bracket modifier direction.** All 8 reviewers agree it's inverted for
  losses. `calculateRating` multiplies the whole delta by the modifier, so a
  lower-bracket player loses *more* when they lose (−13 instead of −11 in the
  golden test). That contradicts the "reduced penalty on loss" docstring in
  `rating.ts`. Options:
  - (a) Apply the modifier M to gains and 1/M to losses.
  - (b) Recommended by the final reviewer: drop the multiplier and fold the
    bracket into the expected score as a rating offset,
    `r_eff = r + β·(bracket − 2)` with β≈50–100. This is zero-sum, standard
    Elo, and calibrated with a dry-run diff.

  Either way: bump `ALGORITHM_VERSION`, re-derive the golden test, and roll
  out as one full replay.
- **`apply_rating_change` trusts the caller's `p_new_rating`.** Any signed-in
  participant can set their own rating via REST until the next nightly replay
  overwrites it. Now that the replay is canonical, the cleanest fix is for
  confirming to write only `confirmed_at`, with the UI showing "rating updates
  tonight". The alternative is computing `before + delta` on the server under
  the replay's lock, which also fixes the confirm-during-swap double-apply.
- **Collection auto-confirm consent.** It's a full confirm that moves
  **global** ratings. Any member can trigger it on any approved match in a
  collection with `auto_approve_members` on (the default). Cheapest
  mitigation: store `participant_status = 'auto_confirmed'` (the value
  already exists). Alternatives: default auto-approve off, or count
  auto-confirmed rows only in collection scope.

**Follow-ups (no decision needed):**
- **Replay checks:**
  - The swap guard counts confirmations; a fingerprint (md5 of id +
    confirmed_at) would also catch unconfirm-then-confirm.
  - Add a completeness check on the `collection_members` load.
  - Add a change-size guardrail: refuse a swap with a huge |Δ| unless forced.
- **Ratings table:**
  - Delete ratings rows the replay no longer produces. They're reset to
    1000/0 and hidden by `get_leaderboard`, but still exist.
  - Enforce one global ratings row per user/format (`UNIQUE NULLS NOT
    DISTINCT`).
- **Collection scope:** remove the fallback cliff. When no other member
  played, skip the collection rating instead of rating against non-members'
  global ratings.
- **Observability:**
  - Show "last successful replay" in the app.
  - Alert when no completed run happens in 26h.
  - Store diff stats in `recalculation_log`.
  - Wire failure alerts in safely; sanitise before reusing ci-failure-triage.
- **Confirm paths:**
  - Guard confirm UPDATEs with `.is('confirmed_at', null)`.
  - Move confirm + rate into one RPC.
  - Prompt claimants to pick a deck.
  - Check deck ownership in `confirmMatch`, which is pre-existing but matters
    now.
- **Leftovers:**
  - The dev-only `/api/debug/recalculate` still uses the old SQL helpers.
  - `matches.last_recalculated_at` is no longer written.
  - Fix the stale "nightly = --if-dirty" comments in
    `scripts/recalculate-ratings.ts:10` and `ROADMAP.md:165`.
- **Scale:** PostgREST's local statement/lock timeout is 8s, so watch the
  swap time as history grows.
- **Stacked unmerged branches.** Merge order matters: the top of the branch
  table goes first (or merge the lowest branch you want, which includes the
  rest).
