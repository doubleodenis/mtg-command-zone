# Playtest Feedback — Design

**Date:** 2026-09-30
**Branch:** `docs/playtest-feedback-2026-09-30`
**Status:** Triage + direction only. No code changed yet. Root causes for the
four bugs are traced in code (not reproduced against the DB). Feature items
have a suggested shape; open questions are marked **OPEN**.

Source: feedback from a real game session (owner + one friend), 2026-09-30.

### At a glance

| # | Item | Kind | Root cause / state | Direction |
|---|---|---|---|---|
| B1 | Navbar links missing on `/match/[id]` | Bug | No `layout.tsx`; page renders `Navbar` but never `TabNav` | Add layout (decided) |
| B2 | New collection member missing from leaderboard | Bug | Collection ratings are never backfilled for members who join after a match was rated | Backfill on join (decided) |
| B3 | Top Commanders ranks a 0% WR commander #1 | Bug | Sorts by games only; scans 10 arbitrary decks; counts unconfirmed/unapproved matches | Win rate + min games, by commander (decided) |
| B4 | "Compared to You" shows 0 / 3 despite a shared game | Bug (copy) | "/3" is the chart unlock threshold; a meeting needs both players confirmed | Copy + pending-count hint |
| F1 | Replace Notes with Comments | Feature | — | Participants + collection members (decided) |
| F2 | Owner kicks a wrongly claimed slot | Feature | — | Suggested below |
| F3 | Owner edit grace period | Feature | — | Suggested below, **OPEN** window length |
| F4 | Deck required to confirm | Feature | — | Auto-confirm skips Unknown Deck (decided) |
| F5 | Clickable participants | Feature | — | Link registered users only |
| F6 | Notify on member add | Feature | Member-add *already* notifies; request is likely about auto-confirm | **OPEN** clarify |
| F7 | Custom avatar upload | Feature | No Storage buckets exist yet | Suggested below |

---

## Bugs

### B1 — Navbar links missing on Match Details

**Cause.** Every other top-level route (`matches/`, `player/`, `decks/`, …) has a
`layout.tsx` that renders `<Navbar />` + `<TabNav items={AUTHENTICATED_NAV} />`.
`src/app/match/[id]/` has no layout. The page renders `<Navbar />` inline
(`src/app/match/[id]/page.tsx:91`) but never `TabNav`, which is the component
holding the Home / Matches / … links. `not-found.tsx` does the same, and
`loading.tsx` has a comment expecting a layout that doesn't exist.

**Fix.** Add `src/app/match/layout.tsx` mirroring `src/app/matches/layout.tsx`.
Remove the inline `Navbar` from `page.tsx` and `not-found.tsx`, and the
placeholder from `loading.tsx`.

**Note.** `/match/[id]` is public. `player/layout.tsx` already shows
`AUTHENTICATED_NAV` to logged-out viewers, so this matches existing behavior.
Whether public pages should show a logged-out nav is a separate question.

### B2 — New collection member missing from the collection leaderboard

**Cause.** The collection leaderboard (`get_leaderboard`, migration 011) only
lists users with a `ratings` row for that collection and `matches_played > 0`.
Collection rating rows are written in exactly three places:

1. `applyParticipantRating` → `updateCollectionRatings` (`src/lib/supabase/ratings.ts:1003`).
   This runs when a participant confirms and rates only collections they are
   **already a member of**, for matches **already approved** in that collection.
2. `addMatchToCollection` → `applyMatchCollectionRatings` (`src/app/actions/collection.ts:394`).
   This runs when a match is added and rates only participants who are
   **already confirmed and already members**.
3. `approveCollectionMatch`: the same as #2, at approval time.

`inviteCollectionMember` (`src/app/actions/collection.ts:24`) inserts the
`collection_members` row and does nothing else. So if the friend confirmed the
match **before** being added to the collection, no path ever creates their
collection rating. Re-confirming does nothing either, because
`applyParticipantRating` short-circuits on the existing global
`rating_history` row. The nightly `recalculate_dirty_matches()` won't fix it
because the match isn't dirty.

If the friend **hasn't** confirmed yet, path #1 will pick them up when they
do. So the planned "re-check tomorrow after they confirm" only helps in that
case.

**Why Top Commanders still shows their commander.** `getTopCommanders` reads raw
`match_participants` with no confirmation, membership or approval filter (see B3).

**Direction (decided): backfill on join.** When a member is added (by invite
or an approved join request), rebuild their collection rating from the
collection's approved matches that they've confirmed.

- Replay in `played_at` order so K-factor and rating progression stay correct.
- Opponent ratings should come from the historical collection rating each
  opponent had at that match. `rating_history` already snapshots
  `rating_before` per scope, so it can supply these. Only fall back to the
  default rating when an opponent has no row.
- Stamp `ALGORITHM_VERSION`. Note that `addMatchToCollection` and
  `approveCollectionMatch` pass a hard-coded `algorithmVersion: 1` today
  (`collection.ts:397`, `:497`). Replace both with the constant while here.
- Idempotency is already enforced by `uq_rating_history_scoped` (migration 008).
- **Simplest correct implementation:** mark the collection's matches that
  include the new member as `is_dirty` and let the existing recalc path rebuild
  that collection scope. If recalc doesn't cover collection scopes, a
  per-member replay RPC is the alternative. Decide during planning after
  reading `recalculate_dirty_matches()` (migration 018).
- Symmetric case to decide during planning: `removeCollectionMember` should
  probably leave history intact and just drop them from the leaderboard.

**Also worth a data check.** Query the friend's `match_participants.confirmed_at`
and their `ratings` rows for the collection to confirm which of the two cases
this was.

### B3 — Top Commanders ranks my commander #1 at 0% WR

**Cause.** `getTopCommanders` (`src/lib/services/deck.ts:26`) has several
compounding problems:

1. **Sort key is games played only** (`deck.ts:115`). With everyone at 1 game,
   the order is arbitrary, so a 0% commander can be #1. The collection page
   then shows `topCommanders[0]` as the "Top Commander" stat card with its win
   rate (`collections/[id]/page.tsx:95`, where the comment even says "by win
   rate").
2. **It only considers 10 arbitrary decks DB-wide.** It selects `decks` with
   `.limit(limit * 2)`, with no ordering and no collection filter, and *then*
   counts participations. In a collection, commanders outside those 10 rows
   never appear at all. This will get worse as the deck table grows.
3. **No confirmation filter.** It counts every `match_participants` row,
   including unconfirmed ones and placeholder slots.
4. **No approval filter.** The collection branch reads `collection_matches`
   without `approval_status = 'approved'`, so pending-approval matches count.
5. **Grouped by deck, not commander.** Two decks with the same commander show
   as separate rows.
6. **N+1.** It runs one `collection_matches` query and one participations query
   per deck.

**Direction (decided): win rate with a minimum-games threshold, by commander.**

- Aggregate server-side (an RPC or a single query) starting from
  `match_participants`, not `decks`. Filter to `confirmed_at IS NOT NULL`, and
  in collection scope to `approval_status = 'approved'`.
- Group by commander (`commander_name` + `partner_name`).
- Rank by win rate, then games played. Require a minimum of 3 games
  (constant). Below the threshold, show commanders in a secondary "not enough
  games yet" state rather than hiding them, so small collections aren't empty.
- Keep the pure ranking/threshold logic in a unit-tested function.
- The collection "Top Commander" stat card follows the new ranking.

### B4 — "Compared to You" shows 0 / 3 rivalry matches despite one shared FFA game

**Cause.** Not a counting bug. There are two different "shared match"
definitions on the same card:

- The card is shown when `asEnemies.matchesPlayed > 0`
  (`player/[username]/page.tsx:145`). That count comes from raw shared
  `match_participants` with no confirmation filter
  (`src/lib/services/stats.ts:~370`). The shared FFA game counts here.
- The chart progress is `meetings.length / 3`. `buildMeetings`
  (`src/lib/services/head-to-head-meetings.ts`) only counts a match once
  **both** players have a global `rating_history` row for it and it isn't
  `is_dirty`. The friend hasn't confirmed (or the match is dirty), so there
  are 0 meetings.

"/3" is the unlock threshold for the chart (`player-comparison-card.tsx:75`).
FFA matches do count, so the problem isn't the format.

This shares its root with B2: the friend's confirmation state.

**Direction (suggested).**
- Change the copy so the two numbers can't be read as contradictory, e.g.
  "Rivalry chart unlocks at 3 confirmed matches · 0 / 3" plus a hint line
  "1 shared match waiting on confirmation" when shared > meetings.
- Pass the pending count (shared − meetings) into `SparseRivalryUnlock`.
- Optional: link the hint to the match so the viewer can nudge the other player.

---

## Feature changes

### F1 — Replace Notes with Comments

**Access (decided):** match participants (registered, any confirmation state)
plus members of any collection the match is in with `approval_status =
'approved'`. Everyone else who can view the match can read comments but not post.

**Suggested shape.**
- New table `match_comments (id, match_id, author_id, parent_id NULL, body,
  created_at, edited_at, deleted_at)`. Thread one level deep (reply to a
  top-level comment only), with a body cap of about 1000 chars.
- Enforce the access rule in RLS with a `SECURITY DEFINER can_comment_on_match(match_id)`
  helper, following the pattern in migration 003 to avoid recursion. Match
  read-visibility decides who can read comments.
- Authors can edit and soft-delete their own comments. The match owner can
  soft-delete any comment.
- Notify participants on new top-level comments. Realtime is optional for v1.
- **Migration of existing notes:** show the current `matches.notes` as a pinned
  first "comment" from the reporter, or migrate it into a row. Recommend
  migrating it so notes can then be dropped from `editMatch`.

### F2 — Owner/logger can kick a wrongly claimed slot

**Suggested shape.**
- New server action `revokeParticipantClaim(participantId)`. Only the match
  creator can call it, and only on slots that were claimed (not slots the
  reporter filled at creation).
- It reverts the slot to its placeholder: restores the placeholder name, sets
  `user_id = NULL`, resets the deck to "Unknown Deck", and clears
  `confirmed_at` and status.
- **Rating reversal:** if the kicked user had confirmed, their global and
  collection ratings from this match must be reversed. Because ratings are
  append-only and later matches build on them, the correct approach is to
  delete that user's `rating_history` rows for this match and mark the match
  (and that user's later matches in the format) `is_dirty` for recalculation.
  Other participants' ratings also used the kicked user as an opponent, so
  mark the whole match dirty.
- Notify the kicked user. Reopen the slot to claims.
- Needs a SECURITY DEFINER RPC for the rating-row deletion, in line with the
  grant lockdown in 027/028.

### F3 — Owner edit grace period

**Suggested shape.**
- The owner can edit winner, participants' decks and `played_at` within **N
  days of `created_at`**. After that, only the dispute flow applies
  (`disputeMatchParticipation` already exists in `src/lib/supabase/matches.ts:609`).
- Any edit to a rating-relevant field (winner, deck/bracket, participants):
  reset every other participant's confirmation, mark the match `is_dirty`,
  and send "match was edited, please re-confirm" notifications. The owner stays
  confirmed. Edits to non-rating fields (date only) don't reset confirmations.
- Enforce the window server-side in `editMatch` (`src/app/actions/match.ts:327`),
  whose doc comment currently says winner/participants can't change.
- **OPEN:** window length. Suggest **3 days**, since most reporting mistakes
  are caught the same night.
- **OPEN:** does the reset also un-apply ratings immediately, or rely on the
  dirty recalc? Suggest the dirty recalc, since it's already the mechanism
  for post-confirm changes.

### F4 — Deck required to confirm

**Suggested shape.**
- `confirmMatch` (`src/app/actions/match.ts:240`) rejects confirmation when the
  resulting deck is the "Unknown Deck" sentinel. The UI turns the confirm
  button into "Pick your deck to confirm".
- Reporter auto-confirm at `logMatch`: the reporter must pick their own deck
  in the new-match form (check the form already enforces this).
- **Auto-confirm (decided):** `autoConfirmCollectionMembers`
  (`src/lib/supabase/collections.ts:~686`) skips participants still on
  Unknown Deck. Those members get the normal confirmation notification.
- **Side finding (verify during planning):** `autoConfirmCollectionMembers`
  sets `confirmed_at` only. It doesn't set `participant_status` and doesn't
  apply the global rating, so auto-confirmed members get collection ratings but
  no global rating until they confirm manually. Decide whether auto-confirm
  should go through `applyParticipantRating`.

### F5 — Clickable participants

Wrap the avatar and name in `src/app/match/[id]/participant-list.tsx` in a
`Link` to `/player/[username]` when the participant has a `user_id`. Placeholders
and open slots stay plain text. The participant data may need `username`
added to it, because only `name` is rendered today. Bundle this with the
known issue from CLAUDE.md (per-participant bracket badge not rendered),
since it's the same component.

### F6 — Notify on member add

**Finding.** Member insert already notifies. Trigger
`on_collection_member_added` → `notify_collection_invite()` (migration 002)
creates a `collection_invite` notification for every insert except the owner.
So adding a member does notify.

**OPEN — clarify intent.** Likely readings:
1. The notification arrived but reads as an "invite" (actionable) when the
   member was actually added directly. Fix: a distinct "You were added to X"
   copy/type.
2. It's about auto-confirm: when a match is added to an `auto_approve_members`
   collection, members are auto-confirmed silently. Fix: send "Your match in X
   was auto-confirmed (+Δ)" to each auto-confirmed member.
3. The notification genuinely didn't arrive. Check the friend's
   `notifications` rows. The trigger could also be affected by the 027 grant
   lockdown if `create_notification` lost a grant it needs.

### F7 — Custom avatar upload

**Suggested shape (as proposed in the feedback).**
- Migration: create a public `avatars` bucket. Add Storage RLS so users can
  insert/update/delete only under `avatars/{auth.uid()}/*`, and anyone can read.
- Client: crop to a square, resize to 256px, encode as WebP and cap at about
  1 MB before upload. Upload to `avatars/{uid}/{timestamp}.webp` so the
  filename busts caches.
- Server action updates `profiles.avatar_url`. Add `profiles.avatar_source`
  (`oauth` | `custom`) so OAuth sync on login doesn't overwrite a custom
  upload. "Remove custom avatar" reverts to the OAuth URL.
- Add the Supabase Storage host to `next.config.ts` `images.remotePatterns` if
  avatars go through `next/image`.

---

## Suggested order

1. **B1, F5**: small, UI-only, same area of the app.
2. **B3**: self-contained service rewrite plus unit tests.
3. **B4**: copy and one prop.
4. **B2**: backfill on join. Read migration 018 first.
5. **F4**: deck required to confirm, including the auto-confirm change.
6. **F6**: after the intent is clarified.
7. **F2, F3**: both lean on dirty-recalc and confirmation reset, so design them together.
8. **F1, F7**: new tables/buckets, independent.

## Follow-up for tomorrow

- Check the friend's `confirmed_at` on the shared match and whether a
  collection `ratings` row exists. If they confirmed *before* being added,
  confirming again won't fix the leaderboard (B2).
