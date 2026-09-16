# Match Confirmation & Rating Application — Design

**Date:** 2026-09-15
**Branch:** `player-picker-sidebar` (or a follow-up branch off it)
**Status:** Approved

## Motivation

A QA pass (`docs/acceptance-criteria.md`) found that confirming a match doesn't
gate rating changes the way `REQUIREMENTS.md` §3.2 and the app's own UI copy
say it should. Tracing the git history showed this isn't a documented
product decision drifting out of sync with the code — it's the reverse: a
deliberate "universal lock window" redesign (`supabase/migrations/
013_match_lock_window.sql`, commit `23d3e96`) was correctly implemented once,
then reverted by a later commit (`accd6a2`, "add debugging tools and fixed
dirty match rating recalculation") back to auto-confirming and rating every
real participant synchronously at match creation — apparently as an
unintentional side effect, since nothing in that commit's stated purpose
explains the change. Nobody updated `REQUIREMENTS.md` or the migration
comments to match either version, which is exactly how this regression went
unnoticed.

Two confirmed bugs fall out of this:

1. **Confirmation doesn't gate anything for normal match logging.** Every
   real participant is auto-confirmed and rated the instant the match is
   created — there's no "pending" state to confirm.
2. **Confirming a claimed placeholder slot never applies a rating.**
   `confirmMatch()`'s own doc comment says *"since ratings are now applied
   immediately on match creation, this function is primarily for updating
   deck selection / confirming if somehow still pending"* — it was never
   taught to actually calculate and write a rating for someone who becomes a
   real participant after creation.

Rather than resurrect the original universal 24h lock-window design (which,
even working as designed, only delivers "your rating changes when you
confirm, or automatically tomorrow if you don't" — a weaker promise than
what's documented, at the cost of a cron dependency this project has
struggled to keep configured even in local dev), this spec replaces it with
a simpler, friendship-gated model suited to a casual friend-group tracker.

## Goals

- A participant's rating only changes when it's genuinely appropriate to
  apply it immediately (a friend of the reporter — trust is already
  established) or when they've personally confirmed (a non-friend, or a
  claimed placeholder from a non-friend).
- No scheduled job / cron dependency for the base rating-application path.
  (The nightly dirty-match recalculation job for post-hoc bracket edits is
  unrelated and stays as-is.)
- Becoming friends with someone retroactively resolves any of their pending
  matches logged by/with the other party — casual players shouldn't have to
  remember to go confirm a month-old game once they add each other.
- One shared code path for "apply this participant's rating," used by match
  creation, explicit confirmation, both claim-approval flows, and the
  friend-acceptance sweep — not four different reimplementations with
  different bugs (which is the current state).
- Update `REQUIREMENTS.md`, `CLAUDE.md`, and `ROADMAP.md` so this design is
  the documented one, not an undocumented implementation detail — this is
  explicitly what let the regression go unnoticed for as long as it did.

## Non-goals

- A full dispute/flag-for-review feature. `disputeMatchParticipation()` in
  `src/lib/supabase/matches.ts` is an existing unused stub (just clears
  `confirmed_at`, doesn't touch an already-applied rating or notify anyone)
  — it stays unused. Today, "disputing" an auto-confirmed friend match means
  the creator manually deletes/edits it (`deleteMatch`/`editMatch`, both
  already gated to creator-only). A real dispute flow is a follow-up, and
  `ROADMAP.md` Phase 12 should keep tracking it explicitly so it isn't lost
  again.
- Precise historical K-factor reconstruction. Using the player's *live*
  `matches_played` count at application time (rather than reconstructing
  "matches played strictly before this one" for every possible confirmation
  order) is an approximation the codebase already accepts elsewhere (the
  existing dirty-recalc endpoint does the same `matches_played - 1` trick).
  Not worth solving precisely here.
- Precise snapshotting for collection-scoped ratings. Global ratings get the
  careful "value as of this match's `played_at`" treatment (see below);
  collection-scoped ratings keep reusing the existing `updateCollectionRatings()`
  helper, which uses each participant's *live* collection rating at
  application time. This is unchanged behavior, not a new regression — just
  not worth the added complexity of extending the snapshot treatment to
  every collection a match might belong to.
- Retroactively recalculating *other* participants' already-applied ratings
  when a placeholder is later claimed and joins the table. See "Decisions"
  below.

## The model

**Auto-confirm rule:** a participant is confirmed (and rated) immediately,
without waiting for their own action, when:
- they're the match reporter (the person logging it), or
- they're already an accepted friend of the reporter at the moment the
  relevant event happens (match creation, or claim approval).

Everyone else's participant row is left `pending` (the existing DB default —
no change needed there). They can confirm later themselves
(`confirmMatch()`), or the match resolves automatically the moment they
become friends with the reporter (see the friend-acceptance sweep below).

This rule gets evaluated at three separate moments, because a participant
can go from "not a real user" / "not a friend" to "real and a friend" at
different times:

| Event | Where | Behavior |
|---|---|---|
| Match created | `logMatch()` | Reporter always confirms+rates. Each other real participant confirms+rates now if already a friend of the reporter, else stays `pending`. |
| Participant explicitly confirms | `confirmMatch()` | Always confirms+rates (idempotent — safe even if they were already rated via one of the other paths). |
| A placeholder slot is claimed and approved | `approveClaimRequest()` / `claimSlotWithAutoApproval()` | If the claimant is already a friend of the match's reporter, confirm+rate immediately. Otherwise stays `pending` for the claimant to confirm themselves. |
| Two users become friends | `acceptFriendRequest()` | Sweep both directions for any `pending` participant rows where the match's reporter is the other party of the new friendship, and confirm+rate each one, oldest `played_at` first. |

### Rating snapshot — reusing existing infrastructure

To keep the math fair regardless of *when* each participant's confirmation
actually happens (REQUIREMENTS.md §3.2: *"Rating deltas are calculated
against each player's rating snapshotted at the time the match was played,
not at confirmation time"*), rating application must not read anyone's
*live* rating for the global scope. It already doesn't need to — this
project has an existing SQL function, `get_rating_before_match(user_id,
format_id, collection_id, played_at)` (`supabase/migrations/
017_dirty_match_recalculation.sql`), built for the dirty-match recalc job,
that reconstructs exactly this: the most recent `rating_history.rating_after`
for that user/format/collection from a match with an earlier `played_at`, or
the default rating if none exists. No new schema is needed — this same
function is reused for both the confirming participant's own rating and
every opponent's rating when building the `opponents` array for
`calculateRating()`.

Deck bracket does **not** need snapshotting the same way: it's already
pinned per-participant via `deck_id`, and the existing dirty-match-recalc
system (`is_dirty` / `mark_match_dirty()`) already exists specifically to
correct an already-applied rating if someone changes their deck afterward.
That mechanism is unrelated to this change and stays as-is — see the "found
along the way" bug below, though.

### One shared function: `applyParticipantRating()`

New function in `src/lib/supabase/ratings.ts`, alongside `applyRatingChange`
and `updateCollectionRatings` which it composes. Given a `match_participants`
row:

1. Idempotency guard — if a `rating_history` row already exists for
   `(user_id, match_id, format_id, collection_id IS NULL)`, return the
   existing delta and do nothing else. This makes every caller safe to
   invoke unconditionally rather than needing to track "did I already do
   this" themselves.
2. Build the opponents array from every other real (non-placeholder)
   participant, using `get_rating_before_match()` for each one's rating and
   their deck's live bracket.
3. Get the confirming participant's own rating via `get_rating_before_match()`
   too, and their live `matches_played` (from `getRating()`) for K-factor.
4. `calculateRating()` → `applyRatingChange()` for the global scope.
5. Reuse the existing `updateCollectionRatings()` for every collection this
   participant is a member of that the match belongs to (unchanged,
   live-rating behavior — see Non-goals).
6. Call the existing (currently unused from app code) `mark_ratings_applied()`
   RPC, which idempotently stamps `matches.ratings_applied_at` the first
   time any participant on a match gets rated.

Every call site below is a thin wrapper around this one function deciding
*whether* to call it and *when* to flip `participant_status`/`confirmed_at` —
none of them reimplement the rating math themselves anymore.

## Decisions worth flagging explicitly

**Claiming a placeholder does not retroactively touch other participants'
already-applied ratings.** The current `claimSlotWithAutoApproval()` does an
expensive dance today: delete the match's `rating_history`, revert every
already-rated participant's base rating by subtracting their old delta, then
recalculate everyone from scratch including the new claimant as an opponent.
This spec removes that. Placeholders are already excluded from other
participants' opponent pools when their ratings apply (existing behavior,
noted in code comments as intentional) — claiming later just rates the
newly-real participant using whoever is real *at that moment*, without
reopening everyone else's already-settled numbers. This is slightly less
mathematically precise (early-rated participants' opponent pool is missing
someone who joins later) but avoids retroactively perturbing ratings players
have already seen and moved on from, which is confusing in a way that
doesn't fit a casual tracker. Flagging this because it's a real behavior
change from what `claimSlotWithAutoApproval()` does today, not just a
refactor.

**`mark_match_dirty()`'s existing guard is itself a latent bug, fixed as
part of this cleanup.** It currently only flags a match dirty if
`locks_at <= NOW()` — i.e., only 24+ hours after creation, because
`locks_at` defaults to `created_at + 24h`. Since ratings can now apply
immediately (friend path) well before that 24h mark, editing a deck's
bracket in the first day after logging a match would silently fail to flag
the match dirty even though its rating was already applied and is now
stale. The guard is changed to check `ratings_applied_at IS NOT NULL`
instead, which is the condition that actually matters and is exactly what
the calling code (`updateMatchParticipantDeck`) already checks in
TypeScript before calling it.

## What gets removed

The abandoned universal-lock-window infrastructure, once nothing references
it:
- `applyMatchRatings()` server action (`src/app/actions/match.ts`) — dead
  code, never called from anywhere; was the cron/edge-function entry point
  for the old design.
- SQL functions `is_match_locked()`, `get_lock_window_hours()`,
  `auto_confirm_match_participants()`, `process_expired_lock_windows()` —
  all unused from application code, all specific to the abandoned design.
- The `trg_set_match_locks_at` trigger and its `set_match_locks_at()`
  function — stop auto-populating `matches.locks_at` on insert.
- The `lock_window_hours` key inside the `match_settings` row in
  `app_settings` (the `backdate_limit_days` key in the same row stays —
  still used by `editMatch()`).

`matches.locks_at` the **column** stays (nullable, simply unpopulated for
new rows going forward) rather than being dropped — it's harmless dead data
on existing rows and dropping columns needlessly is exactly the kind of
migration risk not worth taking here. `is_dirty`, `ratings_applied_at`,
`last_recalculated_at`, and everything in the dirty-match-recalculation
system stay untouched and fully in use.

## Docs to update as part of this work

- **`REQUIREMENTS.md` §3.2 (Rating Confirmation Model):** already describes
  "reporter auto-confirmed, others confirm separately" correctly — add the
  friendship-based auto-confirm rule and the friend-acceptance sweep
  behavior, and explicitly state there is no lock window / scheduled job in
  the base rating-application path.
- **`CLAUDE.md`** Rating System section: same addition, plus a note that the
  nightly dirty-match recalculation cron is the *only* remaining cron
  dependency for ratings (not two).
- **`ROADMAP.md`**: note under Phase 8 / Known Issues that the confirmation
  model is friendship-gated (not lock-window), and add an explicit Phase 12
  line for the still-missing dispute flow so it doesn't get silently
  dropped again.
- **`docs/acceptance-criteria.md`**: once implemented, update the two
  findings this fixes (§3's auto-confirm-everyone bug, §11's claim-confirm
  not-rating bug) from "confirmed bug" to reflect the new intended/verified
  behavior.
