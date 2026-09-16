# Match Confirmation & Rating Application Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the currently-reverted "auto-confirm and rate everyone at match creation" behavior with a friendship-gated confirmation model — the reporter and their friends confirm+rate immediately, everyone else stays pending until they confirm themselves or become friends with the reporter — implemented as one shared rating-application function used by every entry point, with the abandoned lock-window infrastructure removed and the source-of-truth docs updated to match.

**Architecture:** A new `applyParticipantRating()` in `src/lib/supabase/ratings.ts` becomes the single place that calculates and writes a rating for one participant, reusing the existing `get_rating_before_match` SQL function (no new schema) to snapshot ratings as of the match's `played_at`. `logMatch()`, `confirmMatch()`, both claim-approval code paths, and a new friend-acceptance sweep all become thin callers of it, deciding only *whether* and *when* to call it via a friendship check. Dead lock-window SQL/TS is removed in the same pass so the codebase can't mislead the next reader the way it misled this one.

**Tech Stack:** Next.js 16 Server Actions, Supabase Postgres (SQL migrations + RPC), TypeScript, Vitest for pure-function tests.

**Spec:** `docs/superpowers/specs/2026-09-15-match-confirmation-redesign-design.md`

## Global Constraints

- This codebase has no integration/DB test harness today (`ROADMAP.md` Phase 11 lists "Integration tests for critical paths" as not yet started; only pure functions in `src/lib/rating.ts` have Vitest coverage). Tasks that touch Supabase are verified manually (local `supabase start` + `npm run dev` + direct SQL checks via `psql`), matching how every existing server action in this codebase is verified today. Only the one new pure function in this plan gets a real Vitest TDD cycle.
- Test credentials for manual verification: local Supabase seeded users `player1@gmail.com` / `player2@gmail.com` (see `scripts/seed.ts`); reset their passwords locally if needed with `UPDATE auth.users SET encrypted_password = crypt('<pw>', gen_salt('bf')) WHERE email = '...'` via `psql -h 127.0.0.1 -p 54322 -U postgres -d postgres`.
- Every migration file goes in `supabase/migrations/`, numbered after the highest existing one (`020_delete_rating_history_function.sql` is the current highest — this plan's migration is `021_...`). Apply locally with `supabase db reset` (re-runs all migrations + seed) or `supabase migration up` for just the new one, per `supabase:supabase` skill conventions.
- After any migration that adds/removes/changes an RPC function signature, regenerate `src/types/database.types.ts` per `CLAUDE.md`: `npx supabase gen types typescript --local > src/types/database.types.ts` (local project) — **never hand-edit this file**.
- `RATING_CONFIG.defaultBracket` (`2`) and `RATING_CONFIG.defaultRating` (`1000`) live in `src/types/rating.ts` — use these constants, don't hardcode the numbers.
- Commit after each task.

---

### Task 1: Pure friendship-confirmation-policy helper

**Files:**
- Create: `src/lib/confirmation.ts`
- Test: `src/lib/__tests__/confirmation.test.ts`

**Interfaces:**
- Produces: `shouldAutoConfirmParticipant(params: { reporterId: string; participantUserId: string; friendshipStatus: FriendshipStatus | null }): boolean` — consumed by Tasks 5, 7, 8.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/confirmation.test.ts
import { describe, it, expect } from 'vitest'
import { shouldAutoConfirmParticipant } from '@/lib/confirmation'

describe('shouldAutoConfirmParticipant', () => {
  it('always auto-confirms the reporter, regardless of friendship status', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-a',
        friendshipStatus: null,
      })
    ).toBe(true)
  })

  it('auto-confirms an accepted friend of the reporter', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: 'accepted',
      })
    ).toBe(true)
  })

  it('does not auto-confirm a non-friend', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: null,
      })
    ).toBe(false)
  })

  it('does not auto-confirm a pending (not-yet-accepted) friend request', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: 'pending',
      })
    ).toBe(false)
  })

  it('does not auto-confirm a blocked relationship', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: 'blocked',
      })
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/__tests__/confirmation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/confirmation'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/confirmation.ts
import type { FriendshipStatus } from '@/types/friendship'

/**
 * A participant is auto-confirmed (and rated) immediately if they're the
 * match reporter, or already an accepted friend of the reporter. Everyone
 * else stays pending until they confirm themselves or become friends with
 * the reporter later.
 */
export function shouldAutoConfirmParticipant(params: {
  reporterId: string
  participantUserId: string
  friendshipStatus: FriendshipStatus | null
}): boolean {
  if (params.participantUserId === params.reporterId) return true
  return params.friendshipStatus === 'accepted'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/__tests__/confirmation.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/confirmation.ts src/lib/__tests__/confirmation.test.ts
git commit -m "feat: add friendship-based auto-confirm policy helper"
```

---

### Task 2: Migration — remove abandoned lock-window infra, fix mark_match_dirty guard

**Files:**
- Create: `supabase/migrations/021_remove_lock_window.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `mark_match_dirty(p_match_id uuid)` now guards on `ratings_applied_at IS NOT NULL` instead of `locks_at <= NOW()` — consumed unchanged by `src/app/actions/match.ts:updateMatchParticipantDeck` (no TS change needed, same RPC name/args).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/021_remove_lock_window.sql

-- ============================================
-- Remove Abandoned Lock-Window Infrastructure
-- ============================================
--
-- migrations/013_match_lock_window.sql introduced a "universal lock window"
-- design (auto-lock 24h after creation, ratings applied then) that was
-- implemented once and then reverted in application code without anyone
-- updating these functions or the docs. This migration removes the parts of
-- that design that are dead from the application's perspective, replacing
-- it with a friendship-gated confirmation model implemented entirely in
-- TypeScript (see src/lib/supabase/ratings.ts:applyParticipantRating).
--
-- matches.locks_at the COLUMN is left in place (nullable, simply no longer
-- auto-populated) rather than dropped -- it's harmless historical data on
-- existing rows and dropping columns isn't worth the risk here.

-- Stop auto-populating locks_at on insert.
DROP TRIGGER IF EXISTS trg_set_match_locks_at ON matches;
DROP FUNCTION IF EXISTS set_match_locks_at();

-- Dead: only referenced by the abandoned lock-window design, never called
-- from application code.
DROP FUNCTION IF EXISTS is_match_locked(UUID);
DROP FUNCTION IF EXISTS get_lock_window_hours();
DROP FUNCTION IF EXISTS auto_confirm_match_participants(UUID);
DROP FUNCTION IF EXISTS process_expired_lock_windows();

-- Fix a latent bug uncovered while removing the above: mark_match_dirty()
-- only flagged a match dirty if its (now-removed) 24h lock window had
-- already passed, so editing a deck's bracket within the first day after
-- logging a match silently failed to flag it for recalculation even though
-- a rating may have already been applied (friend auto-confirm can apply a
-- rating within seconds of creation). The condition that actually matters
-- is whether a rating was ever applied, not how old the match is.
CREATE OR REPLACE FUNCTION mark_match_dirty(p_match_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE matches
  SET is_dirty = TRUE
  WHERE id = p_match_id
    AND ratings_applied_at IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_match_dirty(UUID) TO authenticated;

-- Drop the now-unused lock_window_hours key from match_settings, keep
-- backdate_limit_days (still read by editMatch()).
UPDATE app_settings
SET value = value - 'lock_window_hours'
WHERE key = 'match_settings';
```

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db reset` (rebuilds the local DB from all migrations + seed) or, if you don't want to lose local test data, `supabase migration up`.
Expected: no errors; migration `021_remove_lock_window` appears when you run `supabase migration list`.

- [ ] **Step 3: Verify the mark_match_dirty fix manually**

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
  SELECT mark_match_dirty(id) FROM matches
  WHERE ratings_applied_at IS NOT NULL LIMIT 1;
"
```
Expected: returns `t` (true) for a match that already has `ratings_applied_at` set, regardless of how recently it was created — previously this would have returned `false` for anything logged in the last 24h.

- [ ] **Step 4: Regenerate database types**

Run: `npx supabase gen types typescript --local > src/types/database.types.ts`
Expected: diff shows `mark_match_dirty` return type unchanged (still `boolean`), and `is_match_locked` / `get_lock_window_hours` / `auto_confirm_match_participants` / `process_expired_lock_windows` entries removed from the generated `Functions` map.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/021_remove_lock_window.sql src/types/database.types.ts
git commit -m "fix: remove abandoned lock-window SQL infra, fix mark_match_dirty guard"
```

---

### Task 3: `applyParticipantRating()` — the shared rating-application function

**Files:**
- Modify: `src/lib/supabase/ratings.ts`

**Interfaces:**
- Consumes: `getRating`, `applyRatingChange`, `updateCollectionRatings` (all already in this file); `getMatchCollections`, `getUserMemberCollections` from `@/lib/supabase/collections`; `calculateRating`, `ALGORITHM_VERSION` from `@/lib/rating`; `RATING_CONFIG` from `@/types/rating`.
- Produces: `applyParticipantRating(client, participantId: string): Promise<Result<{ delta: number; alreadyApplied: boolean }>>` — consumed by Tasks 5, 6, 7, 8, 10.

- [ ] **Step 1: Add the RPC type shim and private helper for `get_rating_before_match`**

Add near the existing `ApplyRatingChangeArgs`/`applyRatingChange` block (this RPC isn't in the generated types either, for the same reason `apply_rating_change` isn't — see the existing comment above `ApplyRatingChangeArgs`):

```typescript
// In src/lib/supabase/ratings.ts, after the applyRatingChange function

type GetRatingBeforeMatchArgs = {
  p_user_id: string
  p_format_id: string
  p_collection_id: string | null
  p_match_played_at: string
}

/**
 * Reconstruct a user's rating as of a specific match's played_at time,
 * via the existing get_rating_before_match SQL function (built for the
 * dirty-match recalculation job). Used so rating math stays fair regardless
 * of when a participant actually confirms relative to when the match was
 * played — see REQUIREMENTS.md §3.2.
 */
async function getRatingBeforeMatch(
  client: SupabaseClient<Database>,
  params: {
    userId: string
    formatId: string
    collectionId: string | null
    matchPlayedAt: string
  }
): Promise<number> {
  type RpcShim = {
    rpc(
      fn: 'get_rating_before_match',
      args: GetRatingBeforeMatchArgs
    ): Promise<{ data: number | null; error: { message: string } | null }>
  }

  const { data, error } = await (client as unknown as RpcShim).rpc(
    'get_rating_before_match',
    {
      p_user_id: params.userId,
      p_format_id: params.formatId,
      p_collection_id: params.collectionId,
      p_match_played_at: params.matchPlayedAt,
    }
  )

  if (error || data == null) {
    return RATING_CONFIG.defaultRating
  }

  return data
}
```

- [ ] **Step 2: Add the `applyParticipantRating` function**

```typescript
// In src/lib/supabase/ratings.ts, at the end of the file

/**
 * Calculate and apply a single participant's rating change (global scope,
 * plus every collection they're a member of that the match belongs to),
 * using each player's rating as of the match's played_at time rather than
 * live -- so the math is fair no matter when each participant confirms.
 *
 * Idempotent: if this participant already has a rating_history row for
 * this match (global scope), returns the existing delta and does nothing
 * else. Safe to call unconditionally from any confirmation entry point.
 *
 * Placeholders (no user_id, on either side) are excluded -- from being
 * rated themselves, and from appearing as anyone else's opponent.
 */
export async function applyParticipantRating(
  client: SupabaseClient<Database>,
  participantId: string
): Promise<Result<{ delta: number; alreadyApplied: boolean }>> {
  const { data: participant, error: participantError } = await client
    .from('match_participants')
    .select(`
      id,
      match_id,
      user_id,
      is_winner,
      deck:decks!match_participants_deck_id_fkey(bracket),
      match:matches!inner(format_id, played_at)
    `)
    .eq('id', participantId)
    .single()

  if (participantError || !participant) {
    return { success: false, error: 'Participant not found' }
  }

  if (!participant.user_id) {
    return {
      success: false,
      error: 'Cannot apply a rating to a placeholder participant',
    }
  }

  const match = participant.match as { format_id: string; played_at: string }

  const { data: existingHistory } = await client
    .from('rating_history')
    .select('delta')
    .eq('user_id', participant.user_id)
    .eq('match_id', participant.match_id)
    .eq('format_id', match.format_id)
    .is('collection_id', null)
    .maybeSingle()

  if (existingHistory) {
    return {
      success: true,
      data: { delta: existingHistory.delta, alreadyApplied: true },
    }
  }

  const { data: others, error: othersError } = await client
    .from('match_participants')
    .select(`
      user_id,
      deck:decks!match_participants_deck_id_fkey(bracket)
    `)
    .eq('match_id', participant.match_id)
    .not('user_id', 'is', null)
    .neq('id', participantId)

  if (othersError) {
    return { success: false, error: othersError.message }
  }

  const { calculateRating } = await import('@/lib/rating')

  const playerBracket = (participant.deck?.bracket ??
    RATING_CONFIG.defaultBracket) as Bracket

  const playerRatingBefore = await getRatingBeforeMatch(client, {
    userId: participant.user_id,
    formatId: match.format_id,
    collectionId: null,
    matchPlayedAt: match.played_at,
  })

  const opponents: Array<{ rating: number; bracket: Bracket }> = []
  for (const opp of others ?? []) {
    if (!opp.user_id) continue
    const oppRatingBefore = await getRatingBeforeMatch(client, {
      userId: opp.user_id,
      formatId: match.format_id,
      collectionId: null,
      matchPlayedAt: match.played_at,
    })
    opponents.push({
      rating: oppRatingBefore,
      bracket: (opp.deck?.bracket ?? RATING_CONFIG.defaultBracket) as Bracket,
    })
  }

  // Live matches_played is used for K-factor -- an accepted approximation,
  // see spec's Non-goals (matches the existing dirty-recalc endpoint).
  const currentRatingResult = await getRating(
    client,
    participant.user_id,
    match.format_id
  )
  const matchesPlayed = currentRatingResult.success
    ? currentRatingResult.data.matchesPlayed
    : 0

  const ratingCalc = calculateRating({
    playerId: participant.user_id,
    playerRating: playerRatingBefore,
    playerBracket,
    playerMatchCount: matchesPlayed,
    isWinner: participant.is_winner,
    opponents,
    formatId: match.format_id,
    collectionId: null,
  })

  const newRating = playerRatingBefore + ratingCalc.delta
  const applyResult = await applyRatingChange(client, {
    userId: participant.user_id,
    matchId: participant.match_id,
    formatId: match.format_id,
    newRating,
    delta: ratingCalc.delta,
    isWin: participant.is_winner,
    playerBracket,
    opponentAvgRating: ratingCalc.opponentAvgRating,
    opponentAvgBracket: ratingCalc.opponentAvgBracket,
    kFactor: ratingCalc.kFactor,
    algorithmVersion: ALGORITHM_VERSION,
  })

  if (!applyResult.success) {
    return { success: false, error: applyResult.error }
  }

  const { getMatchCollections, getUserMemberCollections } = await import(
    '@/lib/supabase/collections'
  )
  const matchCollectionsResult = await getMatchCollections(
    client,
    participant.match_id
  )
  if (matchCollectionsResult.success && matchCollectionsResult.data.length > 0) {
    const userMemberCollectionsResult = await getUserMemberCollections(
      client,
      participant.user_id,
      matchCollectionsResult.data
    )
    if (
      userMemberCollectionsResult.success &&
      userMemberCollectionsResult.data.length > 0
    ) {
      await updateCollectionRatings(client, {
        userId: participant.user_id,
        matchId: participant.match_id,
        formatId: match.format_id,
        playerBracket,
        isWinner: participant.is_winner,
        opponents,
        collectionIds: userMemberCollectionsResult.data,
        algorithmVersion: ALGORITHM_VERSION,
      })
    }
  }

  type MarkAppliedShim = {
    rpc(
      fn: 'mark_ratings_applied',
      args: { p_match_id: string }
    ): Promise<{ error: { message: string } | null }>
  }
  await (client as unknown as MarkAppliedShim).rpc('mark_ratings_applied', {
    p_match_id: participant.match_id,
  })

  return {
    success: true,
    data: { delta: ratingCalc.delta, alreadyApplied: false },
  }
}
```

Add `ALGORITHM_VERSION` to the existing `import { RATING_CONFIG } from '@/types/rating'`-adjacent imports — it needs `import { ALGORITHM_VERSION } from '@/lib/rating'` added as a static top-level import (safe: `rating.ts` imports nothing from `ratings.ts`, no cycle).

- [ ] **Step 2: Manual verification — global rating snapshot correctness**

With the local stack running (`supabase start`, `npm run dev`), pick a real match id from a previous QA pass or seed data, e.g.:

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
  SELECT id, format_id, played_at FROM matches LIMIT 1;
"
```

Note the `format_id`/`played_at`, then in the Next.js dev server (or a scratch script run with `npx tsx`), call `applyParticipantRating` directly against a participant id from that match that has no existing `rating_history` row, and confirm via SQL that a `rating_history` row now exists with `rating_before` equal to whatever `get_rating_before_match` would have returned for that user/format/played_at (verify with the same RPC call directly):

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
  SELECT get_rating_before_match(
    '<user_id>'::uuid, '<format_id>'::uuid, NULL, '<played_at>'::timestamptz
  );
"
```

Expected: the value matches `rating_before` on the newly-written `rating_history` row.

- [ ] **Step 3: Manual verification — idempotency**

Call `applyParticipantRating` a second time for the same participant id.
Expected: returns `{ success: true, data: { delta: <same value>, alreadyApplied: true } }`, and `rating_history`/`ratings` are unchanged (no duplicate row, no double-counted `matches_played`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/ratings.ts
git commit -m "feat: add applyParticipantRating, the shared per-participant rating writer"
```

---

### Task 4: Stop double-writing `confirmed_at` in `createMatch()`

**Files:**
- Modify: `src/lib/supabase/matches.ts:508-516`

**Interfaces:**
- Consumes: nothing new.
- Produces: `match_participants` rows now always insert with `confirmed_at: null` and the DB-default `participant_status = 'pending'` — `logMatch()` (Task 5) becomes the single place that decides confirmation at creation time.

- [ ] **Step 1: Remove the insert-time auto-confirm**

In `createMatch()`, the registered-participant branch currently does:

```typescript
    if (p.type === "registered") {
      return {
        ...baseParticipant,
        user_id: p.userId,
        deck_id: p.deckId,
        placeholder_name: null,
        // Creator auto-confirms their own participation
        confirmed_at: p.userId === userId ? new Date().toISOString() : null,
      };
```

Change to:

```typescript
    if (p.type === "registered") {
      return {
        ...baseParticipant,
        user_id: p.userId,
        deck_id: p.deckId,
        placeholder_name: null,
        confirmed_at: null,
      };
```

(Every participant, including the creator, is inserted unconfirmed; `logMatch()` immediately after creation is now the sole place that sets `confirmed_at`/`participant_status` and applies ratings — see Task 5.)

- [ ] **Step 2: Manual verification**

This function has no standalone caller other than `logMatch()`, so verify as part of Task 5's manual pass rather than in isolation.

- [ ] **Step 3: Commit**

Commit together with Task 5 (same logical change) — see Task 5, Step 5.

---

### Task 5: Rewrite `logMatch()` to be friendship-gated

**Files:**
- Modify: `src/app/actions/match.ts:39-317`

**Interfaces:**
- Consumes: `shouldAutoConfirmParticipant` (Task 1), `applyParticipantRating` (Task 3), `getFriendshipStatus` (already imported), `createMatch` (Task 4's change).
- Produces: `logMatch(payload): Promise<Result<{ matchId: string; delta: number }>>` — unchanged signature, so no callers need updating.

- [ ] **Step 1: Replace the function body**

Replace the whole `logMatch` function (`src/app/actions/match.ts:51-317`) with:

```typescript
/**
 * Log a new match with participants.
 *
 * This action:
 * 1. Creates the match and participant records
 * 2. Adds the match to any selected collections
 * 3. Auto-confirms and rates the reporter, plus any other real participant
 *    who is already an accepted friend of the reporter (see
 *    shouldAutoConfirmParticipant / REQUIREMENTS.md §3.2). Everyone else
 *    stays pending -- they confirm themselves later (confirmMatch), or the
 *    match resolves automatically when they become friends with the
 *    reporter (see acceptFriendRequest's pending-match sweep).
 * 4. Returns the reporter's actual rating delta.
 *
 * Winner cannot be changed after match creation.
 * Deck updates are allowed but will trigger dirty-match recalculation if
 * a rating was already applied.
 */
export async function logMatch(payload: {
  formatId: string;
  playedAt?: string;
  notes?: string | null;
  matchData: MatchData;
  participants: ParticipantInput[];
  winnerIndices: number[];
  collectionIds?: string[];
}): Promise<Result<{ matchId: string; delta: number }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const matchResult = await createMatch(
    supabase,
    user.id,
    payload as CreateMatchPayload,
  );
  if (!matchResult.success) {
    return { success: false, error: matchResult.error };
  }

  const match = matchResult.data;

  // Add match to selected collections BEFORE applying ratings, so
  // applyParticipantRating (which reads getMatchCollections) sees them.
  if (payload.collectionIds && payload.collectionIds.length > 0) {
    for (const collectionId of payload.collectionIds) {
      const memberCheck = await isCollectionMember(
        supabase,
        collectionId,
        user.id,
      );
      if (!memberCheck.success || !memberCheck.data) {
        continue;
      }

      const collectionResult = await getCollectionById(supabase, collectionId);
      if (!collectionResult.success) {
        continue;
      }

      const collection = collectionResult.data;
      const isOwner = collection.ownerId === user.id;
      const permission = collection.matchAddPermission;

      if (permission === "owner_only" && !isOwner) {
        continue;
      }

      let approvalStatus: ApprovalStatus = "approved";
      if (!isOwner && permission === "any_member_approval_required") {
        approvalStatus = "pending";
      }

      await addMatchToCollection(
        supabase,
        collectionId,
        match.id,
        user.id,
        approvalStatus,
      );
      revalidatePath(`/collections/${collectionId}`);
    }
  }

  // Get all real participants (not placeholders)
  const { data: participants, error: participantsError } = await supabase
    .from("match_participants")
    .select("id, user_id")
    .eq("match_id", match.id)
    .not("user_id", "is", null);

  if (participantsError) {
    return {
      success: false,
      error: `Failed to fetch participants: ${participantsError.message}`,
    };
  }

  const now = new Date().toISOString();
  let creatorDelta = 0;

  for (const participant of participants ?? []) {
    if (!participant.user_id) continue;

    const isReporter = participant.user_id === user.id;
    let friendshipStatus: FriendshipStatus | null = null;

    if (!isReporter) {
      const friendshipResult = await getFriendshipStatus(
        supabase,
        user.id,
        participant.user_id,
      );
      friendshipStatus =
        friendshipResult.success && friendshipResult.data
          ? friendshipResult.data.status
          : null;
    }

    const shouldConfirm = shouldAutoConfirmParticipant({
      reporterId: user.id,
      participantUserId: participant.user_id,
      friendshipStatus,
    });

    if (!shouldConfirm) continue; // stays 'pending' -- notification already fires via DB trigger

    await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: now,
      })
      .eq("id", participant.id);

    const applyResult = await applyParticipantRating(supabase, participant.id);
    if (applyResult.success && isReporter) {
      creatorDelta = applyResult.data.delta;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/matches");
  revalidatePath(`/match/${match.id}`);

  return {
    success: true,
    data: {
      matchId: match.id,
      delta: creatorDelta,
    },
  };
}
```

Add `FriendshipStatus` to the type-only import block at the top of the file
(`import type { ..., FriendshipStatus } from "@/types"` — confirm it's
re-exported from `@/types/index.ts`; if not, import it directly from
`@/types/friendship`), and add `shouldAutoConfirmParticipant` and
`applyParticipantRating` to the value imports:

```typescript
import { shouldAutoConfirmParticipant } from "@/lib/confirmation";
import {
  getRating,
  applyRatingChange,
  applyParticipantRating,
  updateCollectionRatings,
} from "@/lib/supabase/ratings";
```

(`getRating`/`applyRatingChange`/`updateCollectionRatings` may no longer be
directly referenced elsewhere in this file once Tasks 6-8 land — leave the
imports for now and let the Task 9 cleanup step remove whichever end up
unused, `calculateRating` and `Bracket` likewise.)

- [ ] **Step 2: Manual verification — friend auto-confirms instantly**

With `player1` and `player2` as friends (seed data default), sign in as
`player1` and log a 1v1 match against `player2` via `/matches/new`.

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
  SELECT user_id, participant_status, confirmed_at
  FROM match_participants WHERE match_id = '<new match id>';
"
```
Expected: both rows `confirmed`, both with `confirmed_at` set to the same
timestamp.

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
  SELECT user_id, delta FROM rating_history WHERE match_id = '<new match id>';
"
```
Expected: a `rating_history` row for both `player1` and `player2`.

- [ ] **Step 3: Manual verification — non-friend stays pending**

Remove the `player1`↔`player2` friendship (`/friends`, Remove), then log
another match between them the same way.

Expected: `player1`'s row is `confirmed` with a `rating_history` entry;
`player2`'s row is `participant_status = 'pending'`, `confirmed_at IS NULL`,
and **no** `rating_history` row exists for `player2` on this match. On
`/match/[id]`, `player2`'s row shows an "Estimated" delta (computed live for
display, not yet persisted) and, when signed in as `player2`, a confirm
action. Re-add the friendship afterward if continuing to the next tasks'
manual checks.

- [ ] **Step 4: Commit (together with Task 4)**

```bash
git add src/lib/supabase/matches.ts src/app/actions/match.ts
git commit -m "feat: gate match-creation auto-confirm on friendship with the reporter"
```

---

### Task 6: Rewrite `confirmMatch()` to actually apply a rating

**Files:**
- Modify: `src/app/actions/match.ts:319-427`

**Interfaces:**
- Consumes: `applyParticipantRating` (Task 3).
- Produces: `confirmMatch(participantId, deckId?): Promise<Result<{ delta: number }>>` — unchanged signature.

- [ ] **Step 1: Replace the function body**

Replace lines 329-427 (the `confirmMatch` function) with:

```typescript
/**
 * Confirm a participant's own match participation, applying their rating.
 *
 * Safe to call even if the participant was already auto-confirmed and
 * rated elsewhere (e.g. logMatch's friend auto-confirm, or a claim
 * approval) -- applyParticipantRating is idempotent.
 */
export async function confirmMatch(
  participantId: string,
  deckId?: string,
): Promise<Result<{ delta: number }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: participant, error: participantError } = await supabase
    .from("match_participants")
    .select("id, user_id, match_id, participant_status, deck_id")
    .eq("id", participantId)
    .single();

  if (participantError || !participant) {
    return { success: false, error: "Participant not found" };
  }

  if (participant.user_id !== user.id) {
    return {
      success: false,
      error: "You can only update your own participation",
    };
  }

  if (deckId && deckId !== participant.deck_id) {
    const updateResult = await updateParticipantDeck(
      supabase,
      participantId,
      deckId,
    );
    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }
  }

  if (participant.participant_status === "pending") {
    await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", participantId);
  }

  const applyResult = await applyParticipantRating(supabase, participantId);
  const delta = applyResult.success ? applyResult.data.delta : 0;

  revalidatePath("/dashboard");
  revalidatePath("/matches");
  revalidatePath(`/match/${participant.match_id}`);
  revalidatePath("/notifications");

  return {
    success: true,
    data: { delta },
  };
}
```

- [ ] **Step 2: Manual verification — this fixes bug #2 from the QA pass**

Using the non-friend pending participant from Task 5 Step 3 (or redo that
setup), sign in as the pending participant and confirm via the match
detail page's "Update Deck & Confirm" action (create a deck first if they
have none).

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
  SELECT user_id, delta FROM rating_history WHERE match_id = '<match id>';
"
```
Expected: **both** participants now have a `rating_history` row — this was
previously missing for the confirming participant (the exact bug from
`docs/acceptance-criteria.md` §11).

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/match.ts
git commit -m "fix: confirmMatch now actually applies the confirming participant's rating"
```

---

### Task 7: Friendship-gate `approveClaimRequest()`

**Files:**
- Modify: `src/app/actions/match.ts:1309-1368` (line numbers will have shifted after Tasks 5-6's edits — locate by function name `approveClaimRequest`)

**Interfaces:**
- Consumes: `shouldAutoConfirmParticipant` (Task 1), `applyParticipantRating` (Task 3).
- Produces: `approveClaimRequest(participantId): Promise<Result<null>>` — unchanged signature.

- [ ] **Step 1: Add the friendship check and conditional confirm+apply**

After the existing `const result = await approveSlotClaim(supabase, participantId);` / success check, and before the `revalidatePath` calls, insert:

```typescript
  const friendshipResult = await getFriendshipStatus(
    supabase,
    participant.claimed_by!,
    match.created_by,
  );
  const friendshipStatus =
    friendshipResult.success && friendshipResult.data
      ? friendshipResult.data.status
      : null;

  const shouldConfirm = shouldAutoConfirmParticipant({
    reporterId: match.created_by,
    participantUserId: participant.claimed_by!,
    friendshipStatus,
  });

  if (shouldConfirm) {
    await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", participantId);

    await applyParticipantRating(supabase, participantId);
  }
  // else: stays pending -- the claimant confirms themselves via confirmMatch()
```

(`participant.claimed_by` is already selected earlier in this function's
existing `select` — confirm the field is present in that query; add it if
not.)

- [ ] **Step 2: Manual verification — friend claimant auto-confirms**

Repeat the claim-flow QA scenario (guest placeholder in a match → new
account → search `/matches/claim` → submit claim → creator approves), but
first make the claiming account a friend of the match creator *before*
approval.

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
  SELECT participant_status, confirmed_at FROM match_participants
  WHERE id = '<claimed participant id>';
"
```
Expected: `confirmed`, `confirmed_at` set immediately on approval, with a
matching `rating_history` row already present (no separate confirm step
needed).

- [ ] **Step 3: Manual verification — non-friend claimant still needs to confirm**

Same flow, but the claiming account is *not* a friend of the creator.
Expected: after approval, `participant_status` stays `pending`
(reproduces the original bug-#2 scenario from the QA pass), and Task 6's
fix makes the claimant's own confirm action actually apply their rating.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/match.ts
git commit -m "fix: friendship-gate claim approval auto-confirm"
```

---

### Task 8: Simplify `claimSlotWithAutoApproval()`

**Files:**
- Modify: `src/app/actions/match.ts` (function `claimSlotWithAutoApproval`, currently spanning roughly lines 881-1304 before this plan's earlier edits shift line numbers — locate by name)

**Interfaces:**
- Consumes: `shouldAutoConfirmParticipant` (Task 1), `applyParticipantRating` (Task 3).
- Produces: same return type as today (`matchId`, `matchCreatorId`, `matchCreatorUsername`, `isAlreadyFriend`, `hasPendingFriendRequest`, `collections`) — no caller-facing change.

- [ ] **Step 1: Move the friendship check earlier and delete the revert-and-recalc block**

This function currently (a) auto-approves the claim, (b) if the match
*already* had `ratings_applied_at` set, deletes and rebuilds `rating_history`
for every participant to fold the new claimant in as an opponent, then (c)
computes `isAlreadyFriend`/`hasPendingFriendRequest` near the end purely for
UI display. Per the spec's "Decisions" section, (b) is removed entirely —
claiming rates only the newly-real participant, using whoever is real *now*
as opponents, without reopening already-applied participants' numbers.

Replace the whole block from the auto-approve update through the
`isAlreadyFriend`/`hasPendingFriendRequest` computation (i.e. everything
between `.is("user_id", null); // Safety check` and the
`// Get collections this match belongs to` comment) with:

```typescript
  const { error: updateError } = await supabase
    .from("match_participants")
    .update({
      user_id: user.id,
      claimed_by: user.id,
      claim_status: "approved",
      placeholder_name: null,
    })
    .eq("id", participantId)
    .is("user_id", null);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Check friendship status with match creator -- decides both whether to
  // auto-confirm+rate below, and what the post-claim UI shows.
  let isAlreadyFriend = false;
  let hasPendingFriendRequest = false;

  if (match.creator.id !== user.id) {
    const friendshipResult = await getFriendshipStatus(
      supabase,
      user.id,
      match.creator.id,
    );
    if (friendshipResult.success && friendshipResult.data) {
      isAlreadyFriend = friendshipResult.data.status === "accepted";
      hasPendingFriendRequest = friendshipResult.data.status === "pending";
    }
  } else {
    isAlreadyFriend = true;
  }

  const shouldConfirm = shouldAutoConfirmParticipant({
    reporterId: match.created_by,
    participantUserId: user.id,
    friendshipStatus: isAlreadyFriend ? "accepted" : null,
  });

  if (shouldConfirm) {
    await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", participantId);

    await applyParticipantRating(supabase, participantId);
  }
```

The `match.ratings_applied_at` field is no longer read in this function
after this change — it can stay in the earlier `select` (harmless) or be
removed from it; either is fine, but if removed, also drop the
`ratings_applied_at: string | null` field from the inline `match` cast type
a few lines above.

- [ ] **Step 2: Manual verification**

Repeat the invite-link claim flow (if one exists in the current UI) or call
`claimSlotWithAutoApproval` directly for a placeholder in a match whose
other participants already have `rating_history` rows. Confirm those other
participants' `rating_history`/`ratings` rows are **untouched** (same
`delta`/`rating_after` as before the claim), and the newly-claimed
participant gets their own new `rating_history` row if they're a friend of
the creator, or stays `pending` if not.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/match.ts
git commit -m "simplify: claiming a slot no longer reopens other participants' ratings"
```

---

### Task 9: Delete dead `applyMatchRatings()` and prune unused imports

**Files:**
- Modify: `src/app/actions/match.ts`

**Interfaces:**
- Consumes: none.
- Produces: none (pure deletion).

- [ ] **Step 1: Confirm it's still unreferenced**

Run: `grep -rn "applyMatchRatings" src/`
Expected: only the function's own definition in `src/app/actions/match.ts` —
if anything else shows up, stop and investigate before deleting.

- [ ] **Step 2: Delete the function**

Remove the entire `applyMatchRatings` function (its doc comment through its
closing `}` — the block starting `/** * Apply ratings for a match when the
lock window has expired. ... */` and `export async function
applyMatchRatings(...)`).

- [ ] **Step 3: Prune now-unused imports**

Run: `npx tsc --noEmit` and `npm run lint` — fix any now-unused import
errors in `src/app/actions/match.ts` (likely candidates: `getRating`,
`Bracket`, depending on what Tasks 5-8 left in place; `calculateRating` is
probably still used by `claimSlotWithAutoApproval`'s remaining code paths —
check before removing).

Expected: both commands pass clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/match.ts
git commit -m "chore: remove dead applyMatchRatings (cron-driven lock-window action, never called)"
```

---

### Task 10: Friend-acceptance sweep for pending matches

**Files:**
- Modify: `src/lib/supabase/ratings.ts` (new function)
- Modify: `src/app/actions/friend.ts:11-52` (`acceptFriendRequest`)

**Interfaces:**
- Consumes: `applyParticipantRating` (Task 3).
- Produces: `resolvePendingMatchesForNewFriends(client, userId1: string, userId2: string): Promise<Result<{ resolvedCount: number }>>` — consumed by `acceptFriendRequest`.

- [ ] **Step 1: Add the sweep function**

```typescript
// In src/lib/supabase/ratings.ts, after applyParticipantRating

/**
 * When two users become friends, resolve any of their still-pending match
 * participations where the OTHER party is the match's reporter -- these
 * would have auto-confirmed at creation time if the friendship had already
 * existed then. Applies in played_at order so each match's rating math
 * builds on the previous one correctly for players with several pending
 * matches against the same now-friend.
 */
export async function resolvePendingMatchesForNewFriends(
  client: SupabaseClient<Database>,
  userId1: string,
  userId2: string
): Promise<Result<{ resolvedCount: number }>> {
  const { data: pending, error } = await client
    .from('match_participants')
    .select(`
      id,
      match:matches!inner(played_at, created_by)
    `)
    .in('user_id', [userId1, userId2])
    .eq('participant_status', 'pending')

  if (error) {
    return { success: false, error: error.message }
  }

  type PendingRow = {
    id: string
    match: { played_at: string; created_by: string } | null
  }

  const eligible = (pending as unknown as PendingRow[])
    .filter((row) => {
      const createdBy = row.match?.created_by
      return createdBy === userId1 || createdBy === userId2
    })
    .sort(
      (a, b) =>
        new Date(a.match!.played_at).getTime() -
        new Date(b.match!.played_at).getTime()
    )

  let resolvedCount = 0

  for (const row of eligible) {
    await client
      .from('match_participants')
      .update({
        participant_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    const applyResult = await applyParticipantRating(client, row.id)
    if (applyResult.success && !applyResult.data.alreadyApplied) {
      resolvedCount++
    }
  }

  return { success: true, data: { resolvedCount } }
}
```

Note: the `match:matches!inner(played_at, created_by)` embed syntax matches
what `applyParticipantRating` (Task 3) already uses successfully for the
same `match_participants` → `matches` relationship — if this query errors
about an ambiguous relationship, compare against that function's select and
copy its exact FK-qualified form (e.g. `match:matches!match_participants_match_id_fkey(...)`).

- [ ] **Step 2: Wire it into `acceptFriendRequest`**

In `src/app/actions/friend.ts`, after the existing
`const result = await respondToFriendRequest(supabase, friendshipId, 'accepted')`
success check and before the `revalidatePath` calls, add:

```typescript
  const { resolvePendingMatchesForNewFriends } = await import(
    '@/lib/supabase/ratings'
  )
  await resolvePendingMatchesForNewFriends(
    supabase,
    friendship.addressee_id,
    result.data.requesterId,
  )
```

(`result.data` is the `Friendship` row returned by `respondToFriendRequest`,
which includes `requesterId` per `src/types/friendship.ts` — confirm the
exact field name via `mapFriendshipRow` in `database-mappers.ts` before
wiring this in.)

- [ ] **Step 3: Manual verification**

Remove the `player1`↔`player2` friendship, log 2-3 matches between them as
`player1` (all should land `player2` in `pending`, per Task 5's behavior),
then send and accept a new friend request between them.

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
  SELECT mp.id, mp.participant_status, mp.confirmed_at, m.played_at
  FROM match_participants mp JOIN matches m ON m.id = mp.match_id
  WHERE mp.user_id = '<player2 id>' AND m.created_by = '<player1 id>'
  ORDER BY m.played_at;
"
```
Expected: all rows now `confirmed`, and a `rating_history` row exists for
each — verify the deltas differ appropriately across the matches (i.e. the
second match's `rating_before` reflects the first match's `rating_after`,
not the same starting rating for both).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/ratings.ts src/app/actions/friend.ts
git commit -m "feat: resolve pending matches automatically when participants become friends"
```

---

### Task 11: Update source-of-truth docs

**Files:**
- Modify: `REQUIREMENTS.md` (§3.2 Rating Confirmation Model, around line 310-315)
- Modify: `CLAUDE.md` (Rating System section)
- Modify: `ROADMAP.md` (Phase 8 / Known Issues, Phase 12)
- Modify: `docs/acceptance-criteria.md` (§3, §4, §11 findings)

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing (documentation only).

- [ ] **Step 1: Update `REQUIREMENTS.md` §3.2**

Replace the existing bullet list under "3.2 Rating Confirmation Model" with:

```markdown
### 3.2 Rating Confirmation Model

- **A player's rating only updates when it's appropriate to apply it.** The
  reporter is always auto-confirmed on creation. Any other real participant
  who is already an accepted friend of the reporter at that moment is also
  auto-confirmed and rated immediately -- trust is already established.
  Everyone else stays pending until they personally confirm, or until they
  become friends with the reporter (at which point any of their pending
  matches with that reporter resolve automatically, oldest first).
- A match can be in a **partially-confirmed state** -- some participants
  rated, others still pending -- indefinitely. There is no lock window or
  scheduled job that force-applies a rating for someone who never confirms;
  this is intentional, not a gap.
- Rating deltas are calculated against each player's rating **snapshotted at
  the time the match was played**, not at confirmation time -- so the order
  in which participants confirm doesn't affect the math. This is
  reconstructed via `get_rating_before_match()` at the moment each
  participant's rating is applied, not stored separately.
- When a placeholder slot is claimed and approved, the same friendship rule
  applies: if the claimant is already a friend of the match's reporter, they
  auto-confirm immediately; otherwise they confirm themselves afterward,
  same as any other non-friend participant.
```

- [ ] **Step 2: Update `CLAUDE.md`'s Rating System section**

Add, directly under the existing "Rating scope" bullet list:

```markdown
**Confirmation model** — friendship-gated, not a lock window. The reporter
and any already-accepted-friend participants confirm and get rated
immediately at match creation (or claim approval); everyone else stays
pending until they confirm themselves or become friends with the reporter.
See `docs/superpowers/specs/2026-09-15-match-confirmation-redesign-design.md`
for the full design and rationale. The **only** remaining cron dependency
for ratings is the nightly dirty-match recalculation job (bracket edits
after a rating was already applied) -- there is no separate job for base
rating application.
```

- [ ] **Step 3: Update `ROADMAP.md`**

Under "Known Issues", replace the two existing bullet points with:

```markdown
- [x] Match confirmation model was reverted from friendship-gated per-participant
      confirmation back to auto-confirm-everyone-at-creation at some point without
      updating docs -- fixed 2026-09-15, see
      `docs/superpowers/specs/2026-09-15-match-confirmation-redesign-design.md`
- [ ] Match details page missing bracket level visual for individual participant decks
- [ ] Updating deck with different bracket isn't recalculating ratings correctly
      (re-verify against the `mark_match_dirty` guard fix from the same date)
```

Under Phase 12 — Future Considerations, add:

```markdown
- [ ] Match disputes (flag incorrect results) -- `disputeMatchParticipation()` in
      `src/lib/supabase/matches.ts` is an existing unused stub (only clears
      `confirmed_at`, doesn't notify anyone or touch an already-applied rating).
      Needed as the safety net for friendship-gated auto-confirm now that most
      matches apply instantly with no confirmation window.
```

- [ ] **Step 4: Update `docs/acceptance-criteria.md`**

In §3 ("Match Creation"), replace the bullet about `logMatch()` auto-confirming
everyone with a note that this is now fixed per this plan/spec, referencing
the new friendship rule. In §4 ("Match Confirmation & Rating"), same update
for the two sub-bullets describing the missing pending-state and the
recalc-guard bug. In §11 ("Placeholder & Claim"), update the "partial" claim
bullet to reflect that confirming a claimed slot now applies a rating.
Keep the original bug descriptions in place as history (don't delete them),
appending a `**Fixed 2026-09-15:**` note under each rather than rewriting
the finding away, so the document stays an accurate record of what was
found and when it was addressed.

- [ ] **Step 5: Commit**

```bash
git add REQUIREMENTS.md CLAUDE.md ROADMAP.md docs/acceptance-criteria.md
git commit -m "docs: document the friendship-gated confirmation model, close out the QA findings it fixes"
```

---

## Self-Review Notes

- **Spec coverage:** every behavior in the spec's "The model" table has a
  task (creation → Task 5, explicit confirm → Task 6, both claim paths →
  Tasks 7-8, friend-acceptance sweep → Task 10). The snapshot mechanism →
  Task 3. Dead-code removal → Tasks 2, 9. Docs → Task 11.
- **Known risk to watch during execution:** Task 10's join alias syntax is
  flagged in its own step as something to verify against Supabase's actual
  PostgREST embed resolution rather than assumed correct — this is the one
  piece of genuinely new query shape in the plan (everywhere else reuses an
  existing, already-proven select shape from `applyParticipantRating` or the
  functions it replaces).
- **Ordering:** Tasks 1-3 have no dependencies on each other and could be
  done in parallel; Tasks 4-9 must be sequential (each touches overlapping
  regions of `match.ts`); Task 10 depends on Task 3 only; Task 11 should be
  last so it accurately describes what actually shipped.
