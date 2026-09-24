# CommandZone — Operation Test Cases

Test cases grouped by **operation**, because most operations in this app span
several tables plus a trigger and an RPC. Logging a match, for example, writes
`matches` and `match_participants`, fires notification triggers, applies
ratings through a `SECURITY DEFINER` function, and stamps confirmation state —
a case that only asserts "the match row exists" proves almost nothing.

Each operation lists the surface it touches so a reviewer can see what a case
is meant to cover.

**Status legend**
- `[verified]` — executed against a production dump restored into a scratch
  Supabase during the 2026-09-23 hardening pass; result recorded below.
  **This is not the same as verified in production** — migrations 027 and 028
  have not been applied to the live database yet.
- `[ ]` — specified, not yet executed.
- `[deferred]` — consciously not being done; the reason is recorded inline.

**Actors** — `anon` (logged out), `owner` (match creator / resource owner),
`participant` (in the match, not the creator), `stranger` (signed in,
unrelated), `service_role` (maintenance scripts, pg_cron).

Companion spec: `docs/superpowers/specs/2026-09-23-playtest-hardening-design.md`.

---

## 1. Auth & profile creation

**Touches:** `auth.users`, `profiles`, trigger `handle_new_user`

| ID | Case | Expected |
|---|---|---|
| TC-AUTH-01 | `[ ]` Sign up with email | `auth.users` row created; `handle_new_user` creates matching `profiles` row |
| TC-AUTH-02 | `[ ]` Display name entered at signup | Persisted to `profiles.display_name` (regression: was dropped, see acceptance-criteria §1) |
| TC-AUTH-03 | `[ ]` Email containing `+` | `profiles.username` sanitized; `/player/[username]` resolves (regression: 404'd) |
| TC-AUTH-04 | `[ ]` Password shorter than the configured minimum, or missing a required character class | Rejected (free-plan password strength settings, P0-3) |
| TC-AUTH-04b | `[deferred]` Password on the HaveIBeenPwned list | **Not testable — Pro-plan feature, deferred 2026-09-24.** Accepted risk: breached passwords are not rejected |
| TC-AUTH-04c | `[ ]` Existing user whose password predates tightened rules | Can still sign in; receives `WeakPasswordError` explaining why |
| TC-AUTH-05 | `[ ]` Auth-required route while logged out | Redirect to `/login` preserving `?redirectTo=` |

---

## 2. Deck management

**Touches:** `decks`, `match_participants.deck_id`, `matches.is_dirty`, RPC `mark_match_dirty`

| ID | Case | Expected |
|---|---|---|
| TC-DECK-01 | `[ ]` Owner creates/edits/deletes own deck | Succeeds; RLS `auth.uid() = owner_id` |
| TC-DECK-02 | `[ ]` `stranger` edits someone else's deck | Blocked by RLS, 0 rows |
| TC-DECK-03 | `[ ]` Change bracket on a deck used in a **rated** match | `mark_match_dirty` sets `matches.is_dirty = true` |
| TC-DECK-04 | `[ ]` Change bracket on a deck in an **unrated** match | Not marked dirty (`ratings_applied_at IS NULL` guard) |
| TC-DECK-05 | `[verified]` `stranger` calls `mark_match_dirty` for a match they are not in | Raises `not authorized: caller is not a participant of this match` |

---

## 3. Logging a match

The widest operation in the app.

**Touches:** `matches`, `match_participants`, `notifications` (via triggers
`notify_match_participants`, `check_user_not_already_participant`,
`check_played_at_limit`), `ratings`, `rating_history`, `collection_matches`;
RPCs `apply_rating_change`, `mark_ratings_applied`, `get_or_create_rating`,
`get_rating_before_match`

| ID | Case | Expected |
|---|---|---|
| TC-LOG-01 | `[ ]` Log a match in each active format (FFA, 1v1, Pentagram) | `matches` + one `match_participants` row per seat |
| TC-LOG-02 | `[ ]` Submit with no winner | Rejected before write |
| TC-LOG-03 | `[ ]` Reporter's own slot | Auto-confirmed: `participant_status='confirmed'`, `confirmed_at` set |
| TC-LOG-04 | `[ ]` Participant who **is** an accepted friend | Auto-confirmed **and rated** at creation (friendship-gated auto-confirm) |
| TC-LOG-05 | `[ ]` Participant who is **not** a friend | Stays `pending`; no rating applied; receives `match_pending_confirmation` notification |
| TC-LOG-06 | `[ ]` Placeholder (guest) seat | `user_id IS NULL`, `placeholder_name` set, no notification, no rating |
| TC-LOG-07 | `[ ]` Stale notification cleanup for auto-confirmed friend | Notification removed — **currently fails, P2-1**: no DELETE policy on `notifications`, delete affects 0 rows silently |
| TC-LOG-08 | `[ ]` Same user seated twice | Blocked by `check_user_not_already_participant` |
| TC-LOG-09 | `[ ]` `played_at` outside the allowed window | Blocked by `check_played_at_limit` |
| TC-LOG-10 | `[ ]` Rating written for each rated participant | `rating_history` row per (user, match, format, collection) with full algorithm snapshot incl. `algorithm_version` |
| TC-LOG-11 | `[ ]` Match belonging to N collections | Global rating **and** one collection-scoped rating per collection the user is a member of |
| TC-LOG-12 | `[ ]` Re-running rating application for the same match | Idempotent — `rating_history` existence check short-circuits; no double-apply |
| TC-LOG-13 | `[verified]` Reporter rates another participant (auto-confirm path) | Allowed — both are participants of the match |
| TC-LOG-14 | `[ ]` `matches.created_by` forged to another user | Blocked by RLS `WITH CHECK (auth.uid() = created_by)` |

---

## 4. Match confirmation

**Touches:** `match_participants`, `matches.ratings_applied_at`, `ratings`,
`rating_history`; RPCs `apply_rating_change`, `mark_ratings_applied`

| ID | Case | Expected |
|---|---|---|
| TC-CONF-01 | `[verified]` Participant confirms own slot | `participant_status='confirmed'`, `confirmed_at` set |
| TC-CONF-02 | `[ ]` Confirming applies rating to global **and** every collection scope | Deltas written; `ratings.matches_played` incremented once per scope |
| TC-CONF-03 | `[ ]` Out-of-order confirmation (older match confirmed after newer) | Delta applied on top of **live** rating, not replayed from snapshot — intervening progress preserved |
| TC-CONF-04 | `[ ]` Confirm twice | Idempotent; no second `rating_history` row |
| TC-CONF-05 | `[ ]` Partially confirmed match | Unconfirmed participants still show pending; their ratings unmoved |
| TC-CONF-06 | `[verified]` Participant backfills own `deck_id` | Allowed |
| TC-CONF-07 | `[verified]` Participant flips own `is_winner` | Raises `only the match creator can change the match result` |
| TC-CONF-08 | `[verified]` Match creator sets `is_winner` | Allowed |
| TC-CONF-09 | `[ ]` Creator flips `is_winner` **after** ratings applied | **Known gap, P1-2:** succeeds and does *not* mark the match dirty; ratings silently disagree with the result |

---

## 5. Placeholder claim

**Touches:** `match_participants` (`user_id`, `claimed_by`, `claim_status`,
`placeholder_name`), `notifications` (`notify_claim_request`,
`notify_claim_accepted`), ratings on approval

| ID | Case | Expected |
|---|---|---|
| TC-CLAIM-01 | `[ ]` `submitClaimRequest` on an unclaimed placeholder | `claim_status='pending'`, `claimed_by=auth.uid()`, owner notified |
| TC-CLAIM-02 | `[verified]` `claimSlotWithAutoApproval` — claimer takes an empty slot | Allowed: `user_id` goes `NULL -> auth.uid()`, `placeholder_name` cleared |
| TC-CLAIM-03 | `[verified]` Reassign an **occupied** slot to a third party | Raises `not authorized: cannot reassign a participant slot` |
| TC-CLAIM-04 | `[verified]` Steal an occupied slot for yourself | Blocked (no RLS policy matches; 0 rows, row unchanged) |
| TC-CLAIM-05 | `[ ]` Owner approves a pending claim | Slot becomes real participant; claimant sits `pending` until they confirm |
| TC-CLAIM-06 | `[ ]` Owner rejects a claim | Slot returns to placeholder state |
| TC-CLAIM-07 | `[ ]` Claim a slot in a match you are already in | Blocked by `check_user_not_already_participant` |

---

## 6. Friends

**Touches:** `friends`, `notifications` (`notify_friend_request`,
`notify_friend_accepted`), backlog resolution into `match_participants`/ratings

| ID | Case | Expected |
|---|---|---|
| TC-FRIEND-01 | `[ ]` Send request | `friends` row, requester = `auth.uid()`; addressee notified |
| TC-FRIEND-02 | `[ ]` Forge `requester_id` | Blocked by RLS `WITH CHECK` |
| TC-FRIEND-03 | `[ ]` Addressee accepts | Status `accepted`; requester notified |
| TC-FRIEND-04 | `[ ]` Third party tries to accept | Blocked — only addressee may update |
| TC-FRIEND-05 | `[ ]` Accepting resolves the pending-match backlog | `resolvePendingMatchesForNewFriends` auto-confirms and rates prior pending matches between the two |
| TC-FRIEND-06 | `[ ]` Either party deletes the friendship | Allowed for requester or addressee only |

---

## 7. Collections

**Touches:** `collections`, `collection_members`, `collection_matches`,
`notifications` (`notify_collection_invite`), collection-scoped `ratings`;
RPCs `is_collection_member`, `is_collection_owner`, `is_collection_public`

| ID | Case | Expected |
|---|---|---|
| TC-COLL-01 | `[ ]` Create collection | `owner_id = auth.uid()` enforced |
| TC-COLL-02 | `[ ]` Owner invites / removes members | Allowed; non-owner blocked |
| TC-COLL-03 | `[ ]` Member leaves | Allowed for self; owner may remove others |
| TC-COLL-04 | `[ ]` Add match under `owner_only` | Only owner succeeds |
| TC-COLL-05 | `[ ]` Add match under `any_member` | Any member succeeds; non-member blocked |
| TC-COLL-06 | `[ ]` Add match under `any_member_approval_required` | Enters pending; owner approves |
| TC-COLL-07 | `[ ]` Add a match you did not participate in | Blocked — INSERT policy requires an owning `match_participants` row |
| TC-COLL-08 | `[verified]` `anon` reads a **private** collection | 0 rows; `is_collection_public` returns false |
| TC-COLL-09 | `[ ]` `anon` reads a **public** collection | Visible via `is_collection_public` in the RLS policy |
| TC-COLL-10 | `[ ]` Collection-scoped rating diverges from global | Separate `ratings` rows per (format, collection) |

---

## 8. Notifications

**Touches:** `notifications`; RPCs `mark_notifications_read`,
`mark_notifications_seen`, `dismiss_notifications`,
`get_unread_notification_count`, `get_unseen_notification_count`,
`create_notification`, `cleanup_expired_notifications`

| ID | Case | Expected |
|---|---|---|
| TC-NOTIF-01 | `[verified]` Own unread/unseen counts | Returns own counts |
| TC-NOTIF-02 | `[verified]` Own mark-read / mark-seen / dismiss | Succeeds |
| TC-NOTIF-03 | `[ ]` Mark-read with explicit id list vs omitted arg | Omitted means "all" — the `DEFAULT NULL` parameter must survive any function rewrite |
| TC-NOTIF-04 | `[ ]` Realtime subscription delivers new notification | Appears without refresh |
| TC-NOTIF-05 | `[ ]` `cleanup_expired_notifications` past TTL | Expired rows removed; service_role only |

---

## 9. Dirty-match recalculation

**Touches:** `matches.is_dirty` / `last_recalculated_at`, `rating_history`,
`ratings`, `recalculation_log`; routines `get_dirty_matches_batch`,
`start_recalculation_log`, `complete_recalculation_log`,
`reset_ratings_for_recalculation`, `upsert_rating_history`,
`update_user_rating`, `clear_match_dirty_flag`, procedure
`recalculate_dirty_matches`

| ID | Case | Expected |
|---|---|---|
| TC-RECALC-01 | `[ ]` `npm run ratings:recalculate-dirty` | Only dirty matches reprocessed; `is_dirty` cleared; `recalculation_log` opened and completed |
| TC-RECALC-02 | `[ ]` `npm run ratings:recalculate` | Full rebuild reproduces current ratings from `rating_history` inputs |
| TC-RECALC-03 | `[ ]` Every written row stamped `algorithm_version` | True for `apply_rating_change`, the scripts, and `recalculate_dirty_matches` |
| TC-RECALC-04 | `[ ]` pg_cron job at 04:00 UTC | Runs as service_role; `auth.uid()` NULL so ownership checks bypass |
| TC-RECALC-05 | `[verified]` service_role bypasses every ownership check | `apply_rating_change`, `update_user_rating`, `mark_notifications_read` all succeed with `auth.uid() IS NULL` |
| TC-RECALC-06 | `[ ]` Scripts refuse to run without `SUPABASE_SECRET_KEY` | Hard failure, no partial writes |

---

## 10. Public (logged-out) surface

**Touches:** `profiles`, `matches`, `match_participants`, `ratings`,
`formats`; RPCs `get_leaderboard`, `get_user_stats`, `get_deck_stats`

| ID | Case | Expected |
|---|---|---|
| TC-PUB-01 | `[verified]` `anon` reads `formats`, `profiles`, `matches` | Readable |
| TC-PUB-02 | `[verified]` `anon` calls `get_leaderboard` | Executes (no permission error) |
| TC-PUB-03 | `[verified]` `anon` calls `get_user_stats` | Executes and returns a row |
| TC-PUB-04 | `[ ]` `/player/[username]` logged out | Renders; **must not create rating rows** (the discarded `getRating()` call was removed for exactly this) |
| TC-PUB-05 | `[ ]` `/leaderboards`, `/match/[id]`, `/collections/[id]` logged out | Render without error |

---

## 11. Permissions & security

Cases that guard P0-1 and P0-2. All `[verified]` results below were produced
against a restored production dump with a simulated JWT
(`set role authenticated; set_config('request.jwt.claims', ...)`).

### Grant surface

| ID | Case | Expected |
|---|---|---|
| TC-SEC-01 | `[verified]` Count routines executable by each role | `anon=6`, `authenticated=16`, `PUBLIC=0`, total 48 |
| TC-SEC-02 | `[verified]` `anon`-executable allowlist | Exactly `get_leaderboard`, `get_user_stats`, `get_deck_stats`, `is_collection_member`, `is_collection_owner`, `is_collection_public` |
| TC-SEC-03 | `[verified]` Migration 027's own verification block | Raises if anything outside the allowlist is `anon`-executable (this caught `recalculate_dirty_matches`, a PROCEDURE) |
| TC-SEC-04 | `[verified]` 027 and 028 re-applied twice | Idempotent |
| TC-SEC-05 | `[ ]` Newly added function gets no grant by default | Locked until explicitly allowlisted |

### Attack cases — all must raise or affect 0 rows

| ID | Actor | Case | Expected | Result |
|---|---|---|---|---|
| TC-SEC-10 | stranger | `apply_rating_change` to rewrite a victim's rating | raise | `[verified]` `caller is not a participant of this match` |
| TC-SEC-11 | stranger | `get_unread_notification_count(victim)` | raise | `[verified]` `not authorized to read another user's notifications` |
| TC-SEC-12 | stranger | `mark_notifications_read(victim)` | raise | `[verified]` blocked |
| TC-SEC-13 | stranger | `dismiss_notifications(victim)` | raise | `[verified]` blocked |
| TC-SEC-14 | stranger | `mark_ratings_applied` on an unrelated match | raise | `[verified]` blocked |
| TC-SEC-15 | stranger | `mark_match_dirty` on an unrelated match | raise | `[verified]` blocked |
| TC-SEC-16 | participant | flip own `is_winner` | raise | `[verified]` blocked |
| TC-SEC-17 | participant | reassign an occupied slot to a third party | raise | `[verified]` blocked |
| TC-SEC-18 | participant | steal an occupied slot | 0 rows | `[verified]` row unchanged |
| TC-SEC-19 | anon | any locked RPC over `/rest/v1/rpc/` | permission denied | `[verified]` on `mark_notifications_seen` |
| TC-SEC-20 | participant | `apply_rating_change` with an arbitrary `p_new_rating` for a **co-participant** | **still succeeds — P1-1** | `[verified]` known residual risk |

### Regression guards for legitimate flows

| ID | Case | Result |
|---|---|---|
| TC-SEC-30 | `[verified]` Friend auto-confirm: reporter rates another participant | Allowed, rating written |
| TC-SEC-31 | `[verified]` Self-confirm own slot | Allowed |
| TC-SEC-32 | `[verified]` Backfill own `deck_id` | Allowed |
| TC-SEC-33 | `[verified]` Creator sets the result | Allowed |
| TC-SEC-34 | `[verified]` Claimer takes an empty placeholder slot | Allowed |
| TC-SEC-35 | `[verified]` service_role full bypass | Allowed |
| TC-SEC-36 | `[ ]` `anon` reads a public collection through the RLS helper functions | Must still work — revoking `is_collection_*` from `anon` breaks public collection reads |

---

## 12. Backup & restore

**Touches:** whole database; `.github/workflows/backup.yml`, S3 bucket
`command-zone-db-dumps-usw2`

| ID | Case | Expected |
|---|---|---|
| TC-BAK-01 | `[verified]` Nightly workflow run | `.tar.gz` lands under `s3://command-zone-db-dumps-usw2/command-zone/` |
| TC-BAK-02 | `[verified]` Archive contents | `roles.sql`, `schema.sql`, `data.sql`; 15 tables, 46 functions, 48 `COPY` blocks |
| TC-BAK-03 | `[verified]` Restore into a scratch Supabase | `schema.sql` applies with zero errors |
| TC-BAK-04 | `[verified]` Row counts vs production | Identical across all 15 `public` tables plus `auth.users` |
| TC-BAK-05 | `[verified]` Schema objects vs production | 47 functions / 46 policies / 30 FKs / 9 triggers / 72 indexes / 15 RLS-enabled — identical |
| TC-BAK-06 | `[verified]` Grants after restore **without** re-applying 027/028 | **Re-opens `anon` access** — restore is not complete until both are re-applied (P0-4) |
| TC-BAK-07 | `[ ]` Restore into bare (non-Supabase) Postgres | Expected to fail — `data.sql` targets `auth.*`/`storage.*` schemas the dump excludes; document, do not "fix" |
| TC-BAK-08 | `[ ]` S3 lifecycle rule | Objects older than 14 days expire |

---

## Coverage gaps worth naming

- **No E2E harness yet.** Sections 3–7 are written as integration cases; today
  they are manual. Playwright is on the roadmap and not started.
- **Section 11 has no automated runner.** The verified results came from ad-hoc
  SQL against a scratch stack. The highest-value next step is turning
  TC-SEC-10..20 into a checked-in SQL fixture so a restore or a new migration
  re-proves them, rather than relying on this document.
- **Vitest today covers pure logic only** (`rating`, `confirmation`,
  `match-participants`, `dirty-match-recalc`, `head-to-head-meetings`) — 81
  tests, no database.
