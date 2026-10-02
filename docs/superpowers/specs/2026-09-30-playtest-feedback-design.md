# Playtest Feedback — Design

**Date:** 2026-09-30
**Branch:** `docs/playtest-feedback-2026-09-30`
**Status:** Direction decided for every item. Implementation progress is
tracked in `docs/superpowers/STATUS.md`.

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
| F3 | Owner edit grace period | Feature | — | 5 days, no confirmation reset, recalc only on rating edits (decided) |
| F4 | Deck required to confirm | Feature | — | Auto-confirm skips Unknown Deck (decided) |
| F5 | Clickable participants | Feature | — | Link registered users only |
| F6 | Member-add notification "didn't arrive" | Bug | Row was created; the dropdown never shows realtime inserts, and "seen" blanket-marks unshown rows | Wire realtime into the dropdown, mark seen by ID, fix copy |
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
`rating_history` row.

If the friend **hasn't** confirmed yet, path #1 will pick them up when they
do.

**Confirmed against prod data (2026-09-30).** For the shared match ("Match A"),
with the friend as "Player F" and the collection as "Collection G":

| Event | Relative time |
|---|---|
| Match A added to Collection G (approved) | 2 days earlier |
| Player F confirmed Match A | T |
| Player F added to Collection G | T + ~13 min |

Player F has a global FFA rating (1 match) and no Collection G rating. That is
exactly the late-joiner gap.

**It will "fix itself" tonight, by accident.** Match A is `is_dirty = true`,
so the 4am recalc will rebuild Player F's history. `recalculate_dirty_matches()`
(migration 018, ~line 314) writes a collection rating for **every approved
collection a match is in, without checking membership**. So Player F will
appear on the Collection G leaderboard tomorrow. Don't read that as B2 being
fixed.

**Related inconsistency: two rating paths disagree on membership.** The app
paths (`applyMatchCollectionRatings`, `updateCollectionRatings`) only rate
collection *members*. The SQL recalc rates every confirmed participant. Any
recalc therefore adds non-members to collection leaderboards and changes
members' collection ratings, because non-member opponents count, the
member-only filter on opponents disappears, and the default rating is 1000.
The recalc also hard-codes algorithm version `1`. **Direction:** make recalc
membership-aware so both paths produce identical results. A recalc should
never change what a fresh confirm would have written. See the membership rule
below.

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
- **Simplest correct implementation:** after the recalc is made
  membership-aware, have the join path mark the collection's matches that
  include the new member as `is_dirty`. The nightly recalc then does the
  backfill, and the member appears the next day. If they should appear
  immediately, call the recalc for just that user inline.
- Symmetric case to decide during planning: `removeCollectionMember` should
  probably leave history intact and just drop them from the leaderboard.

**The membership rule (decided 2026-09-30): collection ratings require
membership.** Only collection members get a collection rating, and only
member opponents count toward it. This matches the app paths.
`recalculate_dirty_matches()` must be changed to agree:
- Only write collection ratings for users in `collection_members` for that
  collection.
- Build opponents from other confirmed members only. Fall back to the
  default-rating behavior of `applyMatchCollectionRatings` when no other
  member is present.
- Stamp the current algorithm version instead of a literal `1`.
- Add a parity test: for a fixture match, the app confirm path and the SQL
  recalc must produce identical collection `rating_history` rows.

**Existing data.** Any recalc that has already run may have written
collection ratings for non-members. Planning should include a read-only audit
query (collection `ratings` rows whose user isn't a member) and, if any rows
turn up, a cleanup: delete them, then mark the affected matches dirty.

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

**Decided (2026-09-30).**
- The owner can edit winner, participants' decks and `played_at` within **5
  days of `created_at`**. After that, only the dispute flow applies
  (`disputeMatchParticipation` already exists in `src/lib/supabase/matches.ts:609`).
- **Confirmations are not reset.** Only the owner can edit, so re-confirming
  adds friction without adding safety.
- **Recalc only when the edit affects ratings.** Changing the winner or a
  deck/bracket marks the match `is_dirty`, which is the same path as a
  post-confirm bracket change. Edits to `played_at` or notes don't mark it
  dirty.
- Enforce the window server-side in `editMatch` (`src/app/actions/match.ts:327`),
  whose doc comment currently says winner/participants can't change.

**Suggested safeguard.** With no re-confirmation, an owner could flip the
winner to themselves and confirmed players would never know. On any
rating-affecting edit, send participants a `match_result_edited`
notification. That type already exists in the enum and the notification-list
filter. The notification links to the match, and the dispute flow stays
available to them during the window as well. It costs nothing and keeps the
edit honest.

**Planning notes.**
- Dirty matches recalc at 4am UTC, so a corrected winner shows stale deltas
  until then. That's acceptable for v1. Optionally call the recalc for that
  one match inline.
- Changing `played_at` reorders history. Strictly speaking, that affects the
  rating progression of later matches. Treat it as non-rating for v1 and note
  it.

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

### F6 — Notify on member add (reported: "didn't arrive")

**Confirmed against prod data (2026-09-30).** The notification **was
created**, but the friend almost certainly never saw it. The cause is a
client-side bug.

Player F's notifications (T = when they were added to Collection G):

| Type | Created | seen_at | read_at |
|---|---|---|---|
| `friend_accepted` | T − ~13 min | T + 14s | T + 16s |
| `collection_invite` (Collection G) | T | T + 14s | — |

The trigger is enabled, the row exists, and it isn't dismissed or expired.

**Cause: the dropdown never learns about new notifications, yet "seen" marks
all of them.**
1. `NotificationDropdown` seeds `notifications` and `unseenCount` from server
   props with `useState(initial…)` (`notification-dropdown.tsx:30-31`). Nothing
   updates that state afterwards. `useState` also ignores new props on
   re-render, so a server refresh within the same layout doesn't help either.
2. `useNotificationRealtime` (mounted in `providers.tsx:30` with only
   `{ userId }`) **only shows a toast**. It never passes the new row to the
   dropdown (`onNewNotification` is never provided).
3. When the dropdown opens with `unseenCount > 0`, it calls
   `mark_notifications_seen(p_recipient_id)`. That RPC marks **every** unseen
   row in the DB as seen, including rows the client never loaded.

Timeline: the badge was still showing the stale unseen `friend_accepted`.
The friend opened the dropdown 14s after being added. The list showed only
`friend_accepted`, which they clicked 2s later. The RPC stamped the invite as
seen, so it will never badge again. Whether the realtime toast fired can't
be recovered from the DB, but it doesn't matter: a toast is easy to miss, and
the persistent surfaces never showed the notification.

**Fix.**
- Feed realtime inserts into the dropdown. Either lift notification state
  into a context owned by the provider that the realtime hook updates, or
  pass `onNewNotification` through to the dropdown. Prepend the row and bump
  `unseenCount`.
- Make "seen" precise: `mark_notifications_seen` should take the IDs the client
  actually rendered (`p_ids uuid[]`), not blanket-mark the recipient. This
  needs a migration, and the 027 allowlist entry has to be updated for the new
  signature.
- Copy: the dropdown says "{owner} invited you to join a collection". It
  doesn't name the collection and implies an action even though they are
  already a member. Change it to "{owner} added you to **{collection_name}**"
  (`data.collection_name` is already in the payload) and link to the
  collection. The realtime toast already uses `collection_name`.
- The same staleness affects every notification type (match confirmations,
  claims), not just invites. Add a test for "realtime insert appears in the
  dropdown".

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

## Order (agreed 2026-09-30)

1. **B1, F5**: small, UI-only, same area of the app.
2. **B3**: self-contained service rewrite plus unit tests.
3. **B4**: copy and one prop.
4. **B2**: backfill on join. Read migration 018 first.
5. **F4**: deck required to confirm, including the auto-confirm change.
6. **F6**: realtime → dropdown state, precise "seen", invite copy.
7. **F2, F3**: both lean on dirty-recalc and confirmation reset, so design them together.
8. **F1, F7**: new tables/buckets, independent.

## Follow-up for tomorrow

- Check the friend's `confirmed_at` on the shared match and whether a
  collection `ratings` row exists. If they confirmed *before* being added,
  confirming again won't fix the leaderboard (B2).

---

## Findings 2026-10-01

Investigation for B2 found that the rating recalc itself was broken. These
findings drove Plan B (`docs/superpowers/plans/2026-10-01-plan-b-rating-correctness.md`).

1. **The nightly SQL recalc has never succeeded.** It ran 15 times in prod
   since 2026-09-17 with 0 successes. `recalculate_dirty_matches()` calls
   `upsert_rating_history(user, format, collection, match, …)`, but the
   function takes `(user, match, format, collection, …)`. All four are UUIDs,
   so the values land in the wrong columns, and global rows hit
   `format_id NOT NULL`. It then clears the dirty flags anyway. Reproduced
   locally. Last night it failed for 2 users and cleared the flag on the
   playtest match.
2. **The procedure's design is order-dependent too.** Each user is replayed
   against opponents' *current* ratings, which other iterations in the same
   loop are resetting.
3. **There are three recalc implementations:** the SQL procedure, the
   dirty-only TS script (doesn't cascade), and the full TS replay script. The
   full replay is closest to right, but it:
   - reads collection opponents after earlier players in the same match were
     already updated,
   - exits 0 on errors,
   - resets everything first and then writes row by row, so a failure
     mid-run leaves prod half-rebuilt.
4. **Migration 028 blocks collection rating writes.** `apply_rating_change`
   requires the caller to be in the match. `addMatchToCollection`,
   `approveCollectionMatch` and auto-confirm write ratings and update other
   players' rows from the acting user's session, so they fail silently
   whenever that user wasn't in the match.
5. **Prod has no non-member collection rating rows (checked).** No cleanup is
   needed.

### Decisions (2026-10-01, user)

- Nightly recalc = the TS full replay run by a **GitHub Action**. Retire the SQL
  procedure and pg_cron job.
- Collection-scope ratings for late joiners, newly added or approved matches
  and auto-confirmed members are written **by the nightly replay**. The app
  only flags matches. Copy tells users "updates overnight".
- Auto-confirm = **full confirm** (status + confirmed_at). Its ratings arrive
  with the nightly replay. Still skips members on Unknown Deck.
- Collection ratings require **membership** (already decided 2026-09-30).
- The self-confirm path (a player confirming their own slot) keeps writing
  global and collection ratings immediately. That's allowed under 028, and the
  nightly replay corrects any approximation.

**Status:** B2 and F4 are implemented on `fix/plan-b-rating-correctness`.
