# Playtest Follow-up — Status

**Last updated:** 2026-10-01
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
| `fix/plan-b-rating-correctness` | see `git log` | Plan B: rating correctness. Implemented; final-review fixes applied. |

## Plans

| Plan | File | State | Review |
|---|---|---|---|
| Step 1: Match details nav + participants (B1, F5) | `plans/2026-09-30-match-details-nav-and-participants.md` | ✅ Done | Final review: 0 Critical/Important; 2 of 3 minors fixed (`44992c8`), 1 → rapid round R10 |
| Plan A: Display fixes (B3, B4, F6) | `plans/2026-10-01-plan-a-display-fixes.md` | ✅ Done | Final review: 2 Important fixed (`bab875e`), 9 minors → rapid round R1–R9 |
| Plan B: Rating correctness (B2, F4) | `plans/2026-10-01-plan-b-rating-correctness.md` | ✅ Implemented; final-review fixes applied | Reviewed after every task; final review: 3 Important + minors fixed in the final fix wave |
| Plan C: Match editing (F2, F3) | not written | Waiting on Plan B | — |
| Plan D: Comments + avatars (F1, F7) | not written | Not started | — |
| Rapid round (14 small fixes) | `specs/2026-10-01-rapid-round-feedback.md` | Backlog | — |

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

## Production facts (read-only checks, 2026-09-30 / 10-01)

- **The nightly SQL recalc never succeeded:** 15 runs since 2026-09-17, 0
  successes. Cause: swapped arguments in `recalculate_dirty_matches()` →
  `upsert_rating_history`. Each failing user rolled back, so no ratings were
  corrupted, but the dirty flags were still cleared.
- **No non-member collection rating rows exist.** Nothing to clean up.
- **The member-add notification is created correctly.** The navbar dropdown
  just never showed it. Fixed in Plan A.

## Open questions / risks (not in any plan yet)

- **Bracket modifier direction.** `calculateRating` multiplies the *whole*
  delta, losses included, by the modifier. A player in a lower bracket than
  their opponents therefore loses **more** when they lose (e.g. −13 instead of
  −11). A player in a higher bracket loses less to weaker decks. This looks
  inverted for losses. Changing it is a formula change: it needs a decision,
  an `ALGORITHM_VERSION` bump, and a full replay. Plan B's hand-computed
  golden test pins the current behaviour.
- **`apply_rating_change` trusts the caller's `p_new_rating`.** A signed-in
  participant could set their own rating via REST. Fixing it means either
  server-side rating math or routing all rating writes through the replay.
- **Stacked unmerged branches.** Merge order matters: top of the branch
  table first (or merge the lowest branch you want, which includes the rest).
