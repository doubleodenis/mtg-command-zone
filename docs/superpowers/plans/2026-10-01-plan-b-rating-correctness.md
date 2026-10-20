# Plan B — Rating Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ratings trustworthy:
- One correct nightly recalculation that actually runs.
- Collection ratings only for members, including members who join late (B2).
- Collection auto-confirm that really confirms.
- A deck is required before any confirmation counts (F4).

**Architecture:**
- **One rating engine.** The canonical rating computation becomes a pure,
  unit-tested `replayRatings()` in `src/lib/rating-replay.ts`. It replays every
  confirmed match chronologically, global plus membership-aware collection
  scopes, using the same `calculateRating()` the app uses.
- **The nightly job.** `scripts/recalculate-ratings.ts` loads the data, runs
  the engine, and swaps the result in with one atomic SQL call
  (`apply_rating_replay`, service-role only). A scheduled GitHub Action runs it
  nightly whenever any match is dirty. The broken SQL procedure, its pg_cron
  job and the dirty-only script are retired.
- **Collection actions only flag.** Member joins, match added or approved, and
  auto-confirm call two new SECURITY DEFINER functions that check collection
  membership in SQL and only **flag** matches dirty. Migration 028 forbids
  writing other players' ratings from a user session, so the nightly replay
  writes all collection ratings.
- **Deck required.** A DB trigger rejects any confirmation without a real deck.
  The app checks first and shows a clear message.

**Tech Stack:** TypeScript strict, Vitest (`node` project for `src/lib/**`,
`jsdom` for `src/components/**`), Supabase Postgres 17 (local on
127.0.0.1:54322), `tsx` scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-30-playtest-feedback-design.md`
(B2, F4, and the decisions recorded below)

## Background: what 2026-10-01 investigation found

These findings drive the design. They're also recorded in the spec in Task 8.

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

## Decisions (2026-10-01, user)

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

## Global Constraints

- TypeScript strict, no `any`. Don't hand-edit `src/types/database.types.ts`.
  Call new RPCs through typed shims, like `MarkSeenShim` in
  `src/lib/supabase/notifications.ts`.
- New SQL functions: `SECURITY DEFINER`, `SET search_path = public, pg_temp`,
  and explicit `REVOKE ALL … FROM PUBLIC, anon, authenticated` plus the
  intended `GRANT`. (027's lockdown ran once; new functions get default
  grants.) User-callable checks follow 028's pattern: skip when
  `auth.uid() IS NULL` (service role).
- Placeholder deck sentinel: `deck_name = 'Unknown Deck'`
  (`PLACEHOLDER_DECK_NAME`). A deck counts as "real" when `deck_id` is set and
  `deck_name IS DISTINCT FROM 'Unknown Deck'`; a NULL `deck_name` is real.
- Defaults come from `RATING_CONFIG` (`src/types/rating.ts`): rating 1000,
  bracket 2. Algorithm version comes from `ALGORITHM_VERSION`
  (`src/lib/rating.ts`).
- **Never run anything against production from this plan.** Production steps
  (secrets, migrations, data repair) go in the runbook for the user.

## Review Focus

1. **Partial data load.** If the script loads fewer participations than exist
   (pagination bug, RLS, network), the atomic swap would silently delete real
   history. The script must compare loaded confirmed participations against a
   DB count and abort on mismatch. Test in Task 3.
2. **Same output whatever the order:** reordering the input matches, or the
   participants within a match, must give identical output. Test in Task 1.
3. **A confirmation already made on Unknown Deck before this ships** must stay
   as it is. The trigger checks only the unconfirmed→confirmed transition, and
   the replay still rates those rows. Test in Task 5.
4. **A flag function called by a non-member** must raise, not silently flag.
   Test in Task 5.
5. **Two nightly runs at once** (a manual dispatch during the scheduled run)
   must not interleave writes. The workflow uses a `concurrency` group, and the
   swap is a single transaction. Checked in Task 4.
6. **The rating formula itself.** The golden test in Task 1 pins current
   behaviour, including the bracket modifier scaling losses. That looks
   inverted for a lower-bracket player who loses: they lose more. Reviewers:
   assess it and recommend; don't change it. Changing it needs the user's
   decision and an `ALGORITHM_VERSION` bump. See
   `docs/superpowers/STATUS.md` open questions.

---

### Task 1: Pure rating replay engine

**Files:**
- Create: `src/lib/rating-replay.ts`
- Test: `src/lib/__tests__/rating-replay.test.ts`

**Interfaces:**
- Produces:
  - `type ReplayParticipant = { participantId: string; userId: string | null; isWinner: boolean; confirmed: boolean; bracket: Bracket | null }`
  - `type ReplayMatch = { id: string; formatId: string; playedAt: string; participants: ReplayParticipant[]; collectionIds: string[] }` (approved collections only)
  - `type ReplayRatingRow = { userId: string; formatId: string; collectionId: string | null; rating: number; matchesPlayed: number; wins: number }`
  - `type ReplayHistoryRow = { userId: string; matchId: string; formatId: string; collectionId: string | null; ratingBefore: number; ratingAfter: number; delta: number; isWin: boolean; playerBracket: Bracket; opponentAvgRating: number; opponentAvgBracket: number; kFactor: number; algorithmVersion: number }`
  - `type MatchReplayRow` (the Supabase select shape, below) and `toReplayMatches(rows: MatchReplayRow[]): ReplayMatch[]`
  - `replayRatings(matches: ReplayMatch[], membersByCollection: ReadonlyMap<string, ReadonlySet<string>>): { ratings: ReplayRatingRow[]; history: ReplayHistoryRow[] }`

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/rating-replay.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { replayRatings, toReplayMatches } from '@/lib/rating-replay'
import type { ReplayMatch, ReplayParticipant, MatchReplayRow } from '@/lib/rating-replay'
import { calculateRating, ALGORITHM_VERSION } from '@/lib/rating'

const FFA = 'format-ffa'

function p(userId: string | null, overrides: Partial<ReplayParticipant> = {}): ReplayParticipant {
  return { participantId: `p-${userId ?? Math.random()}`, userId, isWinner: false, confirmed: true, bracket: 2, ...overrides }
}

function match(id: string, playedAt: string, participants: ReplayParticipant[], collectionIds: string[] = []): ReplayMatch {
  return { id, formatId: FFA, playedAt, participants, collectionIds }
}

const noMembers = new Map<string, Set<string>>()

function sorted<T>(rows: T[]): T[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

describe('replayRatings', () => {
  it('rates a two-player match from defaults', () => {
    const { ratings, history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B')])],
      noMembers
    )
    expect(history.map((h) => [h.userId, h.ratingBefore, h.ratingAfter])).toEqual([
      ['A', 1000, 1016],
      ['B', 1000, 984],
    ])
    expect(sorted(ratings)).toEqual(sorted([
      { userId: 'A', formatId: FFA, collectionId: null, rating: 1016, matchesPlayed: 1, wins: 1 },
      { userId: 'B', formatId: FFA, collectionId: null, rating: 984, matchesPlayed: 1, wins: 0 },
    ]))
  })

  it('replays chronologically regardless of input order', () => {
    const m1 = match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B')])
    const m2 = match('m2', '2026-01-02T00:00:00Z', [p('A'), p('B', { isWinner: true })])
    const inOrder = replayRatings([m1, m2], noMembers)
    const reversed = replayRatings([m2, m1], noMembers)
    expect(reversed).toEqual(inOrder)
    // m2 starts from m1's results: the underdog B (984) gains more than 16.
    const bInM2 = inOrder.history.find((h) => h.matchId === 'm2' && h.userId === 'B')!
    expect(bInM2.ratingBefore).toBe(984)
    expect(bInM2.delta).toBeGreaterThan(16)
  })

  it('gives the same result whatever order participants are listed in', () => {
    const people = [p('A', { isWinner: true }), p('B', { bracket: 3 }), p('C', { bracket: 1 })]
    const forward = replayRatings([match('m1', '2026-01-01T00:00:00Z', people)], noMembers)
    const backward = replayRatings([match('m1', '2026-01-01T00:00:00Z', [...people].reverse())], noMembers)
    expect(sorted(backward.history)).toEqual(sorted(forward.history))
    expect(sorted(backward.ratings)).toEqual(sorted(forward.ratings))
  })

  it('counts unconfirmed players as opponents but does not rate them', () => {
    const { history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B'), p('C', { confirmed: false })])],
      noMembers
    )
    expect(history.map((h) => h.userId).sort()).toEqual(['A', 'B'])
    const expected = calculateRating({
      playerId: 'A', playerRating: 1000, playerBracket: 2, playerMatchCount: 0, isWinner: true,
      opponents: [{ rating: 1000, bracket: 2 }, { rating: 1000, bracket: 2 }], formatId: FFA, collectionId: null,
    })
    expect(history.find((h) => h.userId === 'A')!.delta).toBe(expected.delta)
  })

  it('ignores placeholder slots entirely', () => {
    const { history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B'), p(null)])],
      noMembers
    )
    expect(history.find((h) => h.userId === 'A')!.delta).toBe(16)
  })

  it('skips a player with no registered opponents', () => {
    const { ratings, history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p(null)])],
      noMembers
    )
    expect(history).toEqual([])
    expect(ratings).toEqual([])
  })

  it('ignores matches with no confirmed players', () => {
    const { history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { confirmed: false, isWinner: true }), p('B', { confirmed: false })])],
      noMembers
    )
    expect(history).toEqual([])
  })

  it('writes collection ratings only for members', () => {
    const members = new Map([['col', new Set(['A'])]])
    const { history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B')], ['col'])],
      members
    )
    const collectionRows = history.filter((h) => h.collectionId === 'col')
    expect(collectionRows.map((h) => h.userId)).toEqual(['A'])
    // No other member played, so A is rated against the global opponents (B at 1000).
    expect(collectionRows[0].delta).toBe(16)
  })

  it('rates collection members only against other members', () => {
    const members = new Map([['col', new Set(['A', 'B'])]])
    const { history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B'), p('C')], ['col'])],
      members
    )
    const aCollection = history.find((h) => h.userId === 'A' && h.collectionId === 'col')!
    expect(aCollection.delta).toBe(16) // a 2-player game vs B, not 3-player
    const aGlobal = history.find((h) => h.userId === 'A' && h.collectionId === null)!
    expect(aGlobal.delta).not.toBe(16)
  })

  it('does not give unconfirmed members a collection rating', () => {
    const members = new Map([['col', new Set(['A', 'B'])]])
    const { history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B', { confirmed: false })], ['col'])],
      members
    )
    expect(history.filter((h) => h.collectionId === 'col').map((h) => h.userId)).toEqual(['A'])
  })

  // Golden test: expected values were computed BY HAND from the documented
  // formula (CLAUDE.md "Rating System"), not by calling calculateRating, so a
  // formula bug can't confirm itself. If this fails, check the arithmetic
  // below before touching the code.
  //
  // Match 1 (3-player FFA, everyone 1000, 0 matches → K=32, E=1/3 each):
  //   A (bracket 2) wins. Opp avg bracket (3+1)/2=2, gap 0 → mod 1.
  //     32·(1−1/3)=21.333 → 21. A=1021
  //   B (bracket 3). Opp avg (2+1)/2=1.5, gap −1.5 → mod 1−1.5^1.5·0.12=0.779546.
  //     32·(−1/3)·0.779546=−8.315 → −8. B=992
  //   C (bracket 1). Opp avg (2+3)/2=2.5, gap +1.5 → mod 1.220454.
  //     32·(−1/3)·1.220454=−13.018 → −13. C=987
  // Match 2 (1v1, A 1021 vs B 992, both 1 match → K=32), B wins:
  //   E_B = 1/(1+10^((1021−992)/400)) = 1/(1+10^0.0725) = 1/2.181686 = 0.458361; E_A = 0.541639
  //   B: gap 2−3=−1 → mod 0.88. 32·0.541639·0.88=15.253 → 15. B=1007
  //   A: gap 3−2=+1 → mod 1.12. 32·(−0.541639)·1.12=−19.412 → −19. A=1002
  // NOTE: the bracket modifier scales losses too, so C (lowest bracket) loses
  // MORE than an unmodified −11, and A loses −19 to a higher-bracket deck.
  // That is current behaviour, pinned here, and is an open question in
  // docs/superpowers/STATUS.md — not something this plan changes.
  it('matches hand-computed ratings for a two-match history', () => {
    const { ratings, history } = replayRatings(
      [
        match('m1', '2026-01-01T00:00:00Z', [
          p('A', { isWinner: true, bracket: 2 }),
          p('B', { bracket: 3 }),
          p('C', { bracket: 1 }),
        ]),
        match('m2', '2026-01-02T00:00:00Z', [p('A', { bracket: 2 }), p('B', { isWinner: true, bracket: 3 })]),
      ],
      noMembers
    )
    expect(history.map((h) => [h.matchId, h.userId, h.delta])).toEqual([
      ['m1', 'A', 21], ['m1', 'B', -8], ['m1', 'C', -13],
      ['m2', 'A', -19], ['m2', 'B', 15],
    ])
    expect(sorted(ratings.map((r) => [r.userId, r.rating, r.matchesPlayed, r.wins]))).toEqual(sorted([
      ['A', 1002, 2, 1], ['B', 1007, 2, 1], ['C', 987, 1, 0],
    ]))
  })

  it('stamps the current algorithm version', () => {
    const { history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B')])],
      noMembers
    )
    expect(history.every((h) => h.algorithmVersion === ALGORITHM_VERSION)).toBe(true)
  })
})

describe('toReplayMatches', () => {
  const row: MatchReplayRow = {
    id: 'm1',
    format_id: FFA,
    played_at: '2026-01-01T00:00:00+00:00',
    match_participants: [
      { id: 'pa', user_id: 'A', is_winner: true, confirmed_at: '2026-01-01T01:00:00+00:00', deck: { bracket: 3 } },
      { id: 'pb', user_id: 'B', is_winner: false, confirmed_at: null, deck: null },
      { id: 'pc', user_id: null, is_winner: false, confirmed_at: null, deck: { bracket: 9 } },
    ],
    collection_matches: [
      { collection_id: 'approved-col', approval_status: 'approved' },
      { collection_id: 'pending-col', approval_status: 'pending' },
    ],
  }

  it('keeps approved collections only and maps participants', () => {
    expect(toReplayMatches([row])).toEqual([
      {
        id: 'm1',
        formatId: FFA,
        playedAt: '2026-01-01T00:00:00+00:00',
        collectionIds: ['approved-col'],
        participants: [
          { participantId: 'pa', userId: 'A', isWinner: true, confirmed: true, bracket: 3 },
          { participantId: 'pb', userId: 'B', isWinner: false, confirmed: false, bracket: null },
          { participantId: 'pc', userId: null, isWinner: false, confirmed: false, bracket: null },
        ],
      },
    ])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project node src/lib/__tests__/rating-replay.test.ts`
Expected: FAIL. `@/lib/rating-replay` can't be resolved.

- [ ] **Step 3: Implement**

`src/lib/rating-replay.ts`:

```ts
/**
 * Rating Replay — Pure Functions
 *
 * The canonical rating computation: rebuilds every rating from scratch by
 * replaying confirmed matches in chronological order. The nightly job
 * (scripts/recalculate-ratings.ts) writes its output; the app's confirm-time
 * updates are an approximation that this corrects.
 *
 * Rules:
 * - Only confirmed, registered participants are rated. Unconfirmed registered
 *   participants still count as opponents; placeholder slots are ignored.
 * - Everyone in a match is rated against the same pre-match snapshot (global
 *   and per collection), so the order of participants never matters.
 * - Collection ratings exist only for members of that collection, rated
 *   against the other member participants' collection ratings. If no other
 *   member played, fall back to the global opponents.
 */

import { calculateRating, ALGORITHM_VERSION } from '@/lib/rating'
import { RATING_CONFIG } from '@/types/rating'
import type { Bracket } from '@/types/common'

export type ReplayParticipant = {
  participantId: string
  userId: string | null
  isWinner: boolean
  confirmed: boolean
  bracket: Bracket | null
}

export type ReplayMatch = {
  id: string
  formatId: string
  playedAt: string
  participants: ReplayParticipant[]
  /** Approved collections only */
  collectionIds: string[]
}

export type ReplayRatingRow = {
  userId: string
  formatId: string
  collectionId: string | null
  rating: number
  matchesPlayed: number
  wins: number
}

export type ReplayHistoryRow = {
  userId: string
  matchId: string
  formatId: string
  collectionId: string | null
  ratingBefore: number
  ratingAfter: number
  delta: number
  isWin: boolean
  playerBracket: Bracket
  opponentAvgRating: number
  opponentAvgBracket: number
  kFactor: number
  algorithmVersion: number
}

/** Shape selected by scripts/recalculate-ratings.ts */
export type MatchReplayRow = {
  id: string
  format_id: string
  played_at: string
  match_participants: Array<{
    id: string
    user_id: string | null
    is_winner: boolean
    confirmed_at: string | null
    deck: { bracket: number } | null
  }>
  collection_matches: Array<{ collection_id: string; approval_status: string }>
}

type Entry = { rating: number; matchesPlayed: number; wins: number }
type Registered = ReplayParticipant & { userId: string }
type Update = { row: ReplayRatingRow }

function toBracket(value: number | null | undefined): Bracket | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null
}

export function toReplayMatches(rows: MatchReplayRow[]): ReplayMatch[] {
  return rows.map((m) => ({
    id: m.id,
    formatId: m.format_id,
    playedAt: m.played_at,
    collectionIds: m.collection_matches
      .filter((cm) => cm.approval_status === 'approved')
      .map((cm) => cm.collection_id),
    participants: m.match_participants.map((mp) => ({
      participantId: mp.id,
      userId: mp.user_id,
      isWinner: mp.is_winner,
      confirmed: mp.confirmed_at !== null,
      bracket: mp.user_id === null ? null : toBracket(mp.deck?.bracket),
    })),
  }))
}

function key(userId: string, formatId: string, collectionId: string | null): string {
  return `${collectionId ?? 'global'}::${userId}::${formatId}`
}

export function replayRatings(
  matches: ReplayMatch[],
  membersByCollection: ReadonlyMap<string, ReadonlySet<string>>
): { ratings: ReplayRatingRow[]; history: ReplayHistoryRow[] } {
  const state = new Map<string, ReplayRatingRow>()
  const history: ReplayHistoryRow[] = []

  const get = (userId: string, formatId: string, collectionId: string | null): Entry =>
    state.get(key(userId, formatId, collectionId)) ?? {
      rating: RATING_CONFIG.defaultRating,
      matchesPlayed: 0,
      wins: 0,
    }

  const ordered = [...matches].sort(
    (a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt) || a.id.localeCompare(b.id)
  )

  for (const match of ordered) {
    const registered = match.participants.filter((p): p is Registered => p.userId !== null)
    if (!registered.some((p) => p.confirmed)) continue

    const bracketOf = (p: Registered): Bracket => p.bracket ?? RATING_CONFIG.defaultBracket
    const globalBefore = new Map(registered.map((p) => [p.participantId, get(p.userId, match.formatId, null)]))
    const updates: Update[] = []

    const rate = (
      player: Registered,
      before: Entry,
      opponents: Array<{ rating: number; bracket: Bracket }>,
      collectionId: string | null
    ) => {
      if (opponents.length === 0) return
      const result = calculateRating({
        playerId: player.userId,
        playerRating: before.rating,
        playerBracket: bracketOf(player),
        playerMatchCount: before.matchesPlayed,
        isWinner: player.isWinner,
        opponents,
        formatId: match.formatId,
        collectionId,
      })
      const ratingAfter = before.rating + result.delta
      history.push({
        userId: player.userId,
        matchId: match.id,
        formatId: match.formatId,
        collectionId,
        ratingBefore: before.rating,
        ratingAfter,
        delta: result.delta,
        isWin: player.isWinner,
        playerBracket: bracketOf(player),
        opponentAvgRating: result.opponentAvgRating,
        opponentAvgBracket: result.opponentAvgBracket,
        kFactor: result.kFactor,
        algorithmVersion: ALGORITHM_VERSION,
      })
      updates.push({
        row: {
          userId: player.userId,
          formatId: match.formatId,
          collectionId,
          rating: ratingAfter,
          matchesPlayed: before.matchesPlayed + 1,
          wins: before.wins + (player.isWinner ? 1 : 0),
        },
      })
    }

    const globalOpponentsOf = (player: Registered) =>
      registered
        .filter((o) => o.participantId !== player.participantId)
        .map((o) => ({ rating: globalBefore.get(o.participantId)!.rating, bracket: bracketOf(o) }))

    for (const player of registered.filter((p) => p.confirmed)) {
      rate(player, globalBefore.get(player.participantId)!, globalOpponentsOf(player), null)
    }

    for (const collectionId of match.collectionIds) {
      const members = membersByCollection.get(collectionId)
      if (!members) continue
      const memberParticipants = registered.filter((p) => members.has(p.userId))
      const collectionBefore = new Map(
        memberParticipants.map((p) => [p.participantId, get(p.userId, match.formatId, collectionId)])
      )
      for (const player of memberParticipants.filter((p) => p.confirmed)) {
        const memberOpponents = memberParticipants
          .filter((o) => o.participantId !== player.participantId)
          .map((o) => ({ rating: collectionBefore.get(o.participantId)!.rating, bracket: bracketOf(o) }))
        rate(
          player,
          collectionBefore.get(player.participantId)!,
          memberOpponents.length > 0 ? memberOpponents : globalOpponentsOf(player),
          collectionId
        )
      }
    }

    // Apply after every rating in this match is computed (simultaneous update).
    for (const { row } of updates) {
      state.set(key(row.userId, row.formatId, row.collectionId), row)
    }
  }

  return { ratings: Array.from(state.values()), history }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project node src/lib/__tests__/rating-replay.test.ts`
Expected: PASS, 13/13.

If the expected 1016/984 differs, compute it with `calculateRating` for two
1000-rated, bracket-2 players at 0 matches. The test values must come from the
real formula. Update the literal only if `calculateRating` disagrees, and
ledger it.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx tsc --noEmit && npx eslint src/lib/rating-replay.ts src/lib/__tests__/rating-replay.test.ts`
Expected: clean.

```bash
git add src/lib/rating-replay.ts src/lib/__tests__/rating-replay.test.ts
git commit -m "feat: add pure chronological rating replay engine"
```

---

### Task 2: Atomic replay swap; retire the SQL recalc (migration 030)

**Files:**
- Create: `supabase/migrations/030_rating_replay_swap.sql`

**Interfaces:**
- Produces: `apply_rating_replay(p_ratings jsonb, p_history jsonb, p_clear_dirty_match_ids uuid[], p_triggered_by text DEFAULT 'manual') → integer`
  (number of history rows written). Service-role only. JSON keys are
  snake_case and match the table columns:
  - ratings: `user_id, format_id, collection_id, rating, matches_played, wins`
  - history: `user_id, match_id, format_id, collection_id, rating_before, rating_after, delta, is_win, player_bracket, opponent_avg_rating, opponent_avg_bracket, k_factor, algorithm_version`

- [ ] **Step 1: Write the failing SQL check**

Save `<workspace>/check-030.sql`:

```sql
\set ON_ERROR_STOP on
BEGIN;
SELECT mp.user_id AS uid, m.id AS mid, m.format_id AS fid
  FROM match_participants mp JOIN matches m ON m.id = mp.match_id
 WHERE mp.user_id IS NOT NULL LIMIT 1 \gset
UPDATE matches SET is_dirty = TRUE, ratings_applied_at = NULL WHERE id = :'mid';
SELECT 'written=' || apply_rating_replay(
  jsonb_build_array(jsonb_build_object('user_id', :'uid', 'format_id', :'fid', 'collection_id', NULL,
    'rating', 1234, 'matches_played', 1, 'wins', 1)),
  jsonb_build_array(jsonb_build_object('user_id', :'uid', 'match_id', :'mid', 'format_id', :'fid', 'collection_id', NULL,
    'rating_before', 1000, 'rating_after', 1234, 'delta', 234, 'is_win', true, 'player_bracket', 2,
    'opponent_avg_rating', 1000, 'opponent_avg_bracket', 2, 'k_factor', 32, 'algorithm_version', 1)),
  ARRAY[:'mid']::uuid[],
  'check-030'
);
SELECT 'history_total=' || count(*) FROM rating_history;
SELECT 'rating=' || rating || ' played=' || matches_played FROM ratings
 WHERE user_id = :'uid' AND format_id = :'fid' AND collection_id IS NULL;
SELECT 'dirty=' || is_dirty || ' applied=' || (ratings_applied_at IS NOT NULL) FROM matches WHERE id = :'mid';
SELECT 'auth=' || has_function_privilege('authenticated', 'apply_rating_replay(jsonb, jsonb, uuid[], text)', 'EXECUTE')
    || ' service=' || has_function_privilege('service_role', 'apply_rating_replay(jsonb, jsonb, uuid[], text)', 'EXECUTE');
SELECT 'procedure_exists=' || EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'recalculate_dirty_matches');
SELECT 'cron_job_exists=' || EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-rating-recalc');
ROLLBACK;
```

Run: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -q -t -f <workspace>/check-030.sql`
Expected: FAIL on `function apply_rating_replay(...) does not exist`.

- [ ] **Step 2: Write the migration**

`supabase/migrations/030_rating_replay_swap.sql`:

```sql
-- ============================================
-- Nightly recalc: atomic replay swap; retire the SQL procedure
-- ============================================
--
-- recalculate_dirty_matches() (018) never succeeded in production: it calls
-- upsert_rating_history(user, format, collection, match, ...) against the
-- (user, match, format, collection, ...) signature from 012. All four are
-- UUIDs, so values land in the wrong columns and global rows violate
-- rating_history.format_id NOT NULL. It also replays each user against
-- opponents' *current* ratings, so results depended on processing order.
--
-- The canonical computation now lives in TypeScript (src/lib/rating-replay.ts),
-- run nightly by .github/workflows/nightly-rating-recalc.yml. This function
-- swaps its output in atomically: either every rating and history row is
-- replaced, or (on any error) nothing changes.
--
-- Service-role only. The jsonb keys mirror the table columns.

CREATE OR REPLACE FUNCTION apply_rating_replay(
  p_ratings JSONB,
  p_history JSONB,
  p_clear_dirty_match_ids UUID[],
  p_triggered_by TEXT DEFAULT 'manual'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_history_count INTEGER;
  v_log_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'not authorized: rating replay is a maintenance operation';
  END IF;

  INSERT INTO recalculation_log (batch_size, triggered_by)
  VALUES (jsonb_array_length(p_history), p_triggered_by)
  RETURNING id INTO v_log_id;

  DELETE FROM rating_history WHERE TRUE;
  UPDATE ratings
  SET rating = 1000, matches_played = 0, wins = 0, updated_at = NOW()
  WHERE TRUE;

  UPDATE ratings r
  SET rating = x.rating, matches_played = x.matches_played, wins = x.wins, updated_at = NOW()
  FROM jsonb_to_recordset(p_ratings) AS x(
    user_id UUID, format_id UUID, collection_id UUID,
    rating INTEGER, matches_played INTEGER, wins INTEGER
  )
  WHERE r.user_id = x.user_id
    AND r.format_id = x.format_id
    AND r.collection_id IS NOT DISTINCT FROM x.collection_id;

  INSERT INTO ratings (user_id, format_id, collection_id, rating, matches_played, wins)
  SELECT x.user_id, x.format_id, x.collection_id, x.rating, x.matches_played, x.wins
  FROM jsonb_to_recordset(p_ratings) AS x(
    user_id UUID, format_id UUID, collection_id UUID,
    rating INTEGER, matches_played INTEGER, wins INTEGER
  )
  WHERE NOT EXISTS (
    SELECT 1 FROM ratings r
    WHERE r.user_id = x.user_id
      AND r.format_id = x.format_id
      AND r.collection_id IS NOT DISTINCT FROM x.collection_id
  );

  INSERT INTO rating_history (
    user_id, match_id, format_id, collection_id, rating_before, rating_after,
    delta, is_win, player_bracket, opponent_avg_rating, opponent_avg_bracket,
    k_factor, algorithm_version, recalculated_at
  )
  SELECT
    x.user_id, x.match_id, x.format_id, x.collection_id, x.rating_before, x.rating_after,
    x.delta, x.is_win, x.player_bracket, x.opponent_avg_rating, x.opponent_avg_bracket,
    x.k_factor, x.algorithm_version, NOW()
  FROM jsonb_to_recordset(p_history) AS x(
    user_id UUID, match_id UUID, format_id UUID, collection_id UUID,
    rating_before INTEGER, rating_after INTEGER, delta INTEGER, is_win BOOLEAN,
    player_bracket SMALLINT, opponent_avg_rating NUMERIC, opponent_avg_bracket NUMERIC,
    k_factor SMALLINT, algorithm_version SMALLINT
  );
  GET DIAGNOSTICS v_history_count = ROW_COUNT;

  -- Matches confirmed only via collection auto-confirm never had ratings
  -- applied by the app; mark them applied now that they have history, so
  -- later deck edits flag them dirty (mark_match_dirty requires this).
  UPDATE matches m
  SET ratings_applied_at = COALESCE(m.ratings_applied_at, NOW())
  WHERE m.ratings_applied_at IS NULL
    AND EXISTS (SELECT 1 FROM rating_history rh WHERE rh.match_id = m.id);

  UPDATE matches SET is_dirty = FALSE WHERE id = ANY(p_clear_dirty_match_ids);

  UPDATE recalculation_log
  SET completed_at = clock_timestamp(),
      matches_processed = (SELECT COUNT(DISTINCT match_id) FROM rating_history)
  WHERE id = v_log_id;

  RETURN v_history_count;
END;
$function$;

REVOKE ALL ON FUNCTION apply_rating_replay(JSONB, JSONB, UUID[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_rating_replay(JSONB, JSONB, UUID[], TEXT) TO service_role;

-- Retire the broken SQL recalc and its schedule.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-rating-recalc') THEN
      PERFORM cron.unschedule('nightly-rating-recalc');
    END IF;
  END IF;
END $$;

DROP PROCEDURE IF EXISTS recalculate_dirty_matches(INTEGER);
```

- [ ] **Step 3: Apply locally and re-run the check**

Run: `npx supabase migration up --local`, then the psql command from Step 1.
Expected:
- `written=1`
- `history_total=1` (everything else was replaced, inside the rolled-back transaction)
- `rating=1234 played=1`
- `dirty=f applied=t`
- `auth=f service=t`
- `procedure_exists=f`
- `cron_job_exists=f`

If the local DB lacks the `cron` schema, the last line errors. Drop that line
and ledger it; CI's `supabase db reset` exercises the DO block.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/030_rating_replay_swap.sql
git commit -m "feat: atomic rating replay swap; retire broken SQL recalc"
```

---

### Task 3: Recalc script: load, replay, swap, safely

**Files:**
- Modify: `scripts/recalculate-ratings.ts` (rewrite)
- Delete: `scripts/recalculate-dirty-matches.ts`
- Modify: `package.json` (`ratings:recalculate-dirty` → `ratings:recalculate-if-dirty`)
- Create: `src/lib/rating-replay-load.ts` (pure helpers the script uses)
- Test: `src/lib/__tests__/rating-replay-load.test.ts`

**Interfaces:**
- Consumes: `toReplayMatches`, `replayRatings`, `MatchReplayRow`,
  `ReplayRatingRow`, `ReplayHistoryRow` (Task 1). Also
  `apply_rating_replay(...)` (Task 2).
- Produces:
  - `toRatingsPayload(rows: ReplayRatingRow[])` and
    `toHistoryPayload(rows: ReplayHistoryRow[])` (snake_case jsonb rows).
  - `checkCompleteLoad(loadedConfirmed: number, dbConfirmed: number): string | null`
    (an error message, or null).
  - `diffRatings(current: ReplayRatingRow[], replayed: ReplayRatingRow[]): RatingDiffRow[]`
    with `type RatingDiffRow = { userId: string; formatId: string; collectionId: string | null; before: number | null; after: number | null; change: number }`.
    It lists every (user, format, collection) whose rating would change, a
    missing row counted as 1000, sorted by |change| descending. It's printed
    by `--dry-run` so a human can review a replay before it ever writes.
  - The CLI `npx tsx scripts/recalculate-ratings.ts [--if-dirty] [--dry-run]`:
    exit 0 on success or nothing to do, 1 on any failure.

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/rating-replay-load.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toRatingsPayload, toHistoryPayload, checkCompleteLoad, diffRatings } from '@/lib/rating-replay-load'

describe('toRatingsPayload / toHistoryPayload', () => {
  it('maps to the snake_case keys apply_rating_replay expects', () => {
    expect(toRatingsPayload([{ userId: 'u', formatId: 'f', collectionId: null, rating: 1016, matchesPlayed: 1, wins: 1 }]))
      .toEqual([{ user_id: 'u', format_id: 'f', collection_id: null, rating: 1016, matches_played: 1, wins: 1 }])
    expect(toHistoryPayload([{
      userId: 'u', matchId: 'm', formatId: 'f', collectionId: 'c', ratingBefore: 1000, ratingAfter: 1016,
      delta: 16, isWin: true, playerBracket: 2, opponentAvgRating: 1000, opponentAvgBracket: 2, kFactor: 32, algorithmVersion: 1,
    }])).toEqual([{
      user_id: 'u', match_id: 'm', format_id: 'f', collection_id: 'c', rating_before: 1000, rating_after: 1016,
      delta: 16, is_win: true, player_bracket: 2, opponent_avg_rating: 1000, opponent_avg_bracket: 2, k_factor: 32, algorithm_version: 1,
    }])
  })
})

describe('diffRatings', () => {
  const row = (userId: string, rating: number, collectionId: string | null = null) =>
    ({ userId, formatId: 'f', collectionId, rating, matchesPlayed: 1, wins: 0 })

  it('lists only ratings that would change, largest change first', () => {
    expect(diffRatings(
      [row('A', 1016), row('B', 984), row('C', 1000)],
      [row('A', 1016), row('B', 1010), row('C', 960)]
    )).toEqual([
      { userId: 'C', formatId: 'f', collectionId: null, before: 1000, after: 960, change: -40 },
      { userId: 'B', formatId: 'f', collectionId: null, before: 984, after: 1010, change: 26 },
    ])
  })

  it('reports ratings that appear or disappear (e.g. a late joiner gaining a collection rating)', () => {
    expect(diffRatings([row('A', 1020)], [row('A', 1020), row('B', 1012, 'col')])).toEqual([
      { userId: 'B', formatId: 'f', collectionId: 'col', before: null, after: 1012, change: 12 },
    ])
    expect(diffRatings([row('A', 990, 'col')], [])).toEqual([
      { userId: 'A', formatId: 'f', collectionId: 'col', before: 990, after: null, change: 10 },
    ])
  })
})

describe('checkCompleteLoad', () => {
  it('passes when every confirmed participation was loaded', () => {
    expect(checkCompleteLoad(42, 42)).toBeNull()
  })

  it('refuses to swap when the load is short (would delete real history)', () => {
    expect(checkCompleteLoad(1000, 1203)).toMatch(/loaded 1000 of 1203/)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project node src/lib/__tests__/rating-replay-load.test.ts`
Expected: FAIL. Module not found.

- [ ] **Step 3: Implement the helpers**

`src/lib/rating-replay-load.ts`:

```ts
/**
 * Pure helpers for scripts/recalculate-ratings.ts: payload mapping for
 * apply_rating_replay (migration 030) and the partial-load guard.
 */

import type { ReplayHistoryRow, ReplayRatingRow } from '@/lib/rating-replay'
import { RATING_CONFIG } from '@/types/rating'

export function toRatingsPayload(rows: ReplayRatingRow[]) {
  return rows.map((r) => ({
    user_id: r.userId,
    format_id: r.formatId,
    collection_id: r.collectionId,
    rating: r.rating,
    matches_played: r.matchesPlayed,
    wins: r.wins,
  }))
}

export function toHistoryPayload(rows: ReplayHistoryRow[]) {
  return rows.map((h) => ({
    user_id: h.userId,
    match_id: h.matchId,
    format_id: h.formatId,
    collection_id: h.collectionId,
    rating_before: h.ratingBefore,
    rating_after: h.ratingAfter,
    delta: h.delta,
    is_win: h.isWin,
    player_bracket: h.playerBracket,
    opponent_avg_rating: h.opponentAvgRating,
    opponent_avg_bracket: h.opponentAvgBracket,
    k_factor: h.kFactor,
    algorithm_version: h.algorithmVersion,
  }))
}

export type RatingDiffRow = {
  userId: string
  formatId: string
  collectionId: string | null
  before: number | null
  after: number | null
  change: number
}

/**
 * Every rating the replay would change. A missing row counts as the default
 * 1000, so a new collection rating and a removed one both show up.
 */
export function diffRatings(current: ReplayRatingRow[], replayed: ReplayRatingRow[]): RatingDiffRow[] {
  const keyOf = (r: ReplayRatingRow) => `${r.collectionId ?? 'global'}::${r.userId}::${r.formatId}`
  const before = new Map(current.map((r) => [keyOf(r), r]))
  const after = new Map(replayed.map((r) => [keyOf(r), r]))
  const rows: RatingDiffRow[] = []
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    const b = before.get(k)
    const a = after.get(k)
    const change = (a?.rating ?? RATING_CONFIG.defaultRating) - (b?.rating ?? RATING_CONFIG.defaultRating)
    if (change === 0) continue
    const ref = (a ?? b)!
    rows.push({
      userId: ref.userId,
      formatId: ref.formatId,
      collectionId: ref.collectionId,
      before: b?.rating ?? null,
      after: a?.rating ?? null,
      change,
    })
  }
  return rows.sort((x, y) => Math.abs(y.change) - Math.abs(x.change) || x.userId.localeCompare(y.userId))
}

/**
 * The swap replaces ALL rating history, so replaying from a partial load
 * (pagination bug, network, RLS) would silently delete real history.
 */
export function checkCompleteLoad(loadedConfirmed: number, dbConfirmed: number): string | null {
  return loadedConfirmed === dbConfirmed
    ? null
    : `Refusing to swap: loaded ${loadedConfirmed} of ${dbConfirmed} confirmed participations`
}
```

Run: `npx vitest run --project node src/lib/__tests__/rating-replay-load.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 4: Rewrite the script**

Replace `scripts/recalculate-ratings.ts` with:

```ts
/**
 * Rating Recalculation — the nightly job
 *
 * Rebuilds every rating by replaying all confirmed matches chronologically
 * (src/lib/rating-replay.ts) and swaps the result in with ONE atomic call to
 * apply_rating_replay (migration 030): either every row is replaced or none.
 *
 * Usage:
 *   npx tsx scripts/recalculate-ratings.ts              # always replay
 *   npx tsx scripts/recalculate-ratings.ts --if-dirty   # replay only if a match is dirty (nightly)
 *   npx tsx scripts/recalculate-ratings.ts --dry-run    # compute, print counts, write nothing
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (from the environment,
 * or .env.local when run locally). The secret key is required: the swap is a
 * service-role-only maintenance operation.
 *
 * Exit code: 0 on success / nothing to do, 1 on any failure (so the GitHub
 * Action fails loudly).
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.types'
import { replayRatings, toReplayMatches } from '../src/lib/rating-replay'
import type { MatchReplayRow } from '../src/lib/rating-replay'
import { checkCompleteLoad, diffRatings, toHistoryPayload, toRatingsPayload } from '../src/lib/rating-replay-load'
import type { ReplayRatingRow } from '../src/lib/rating-replay'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY
const IF_DIRTY = process.argv.includes('--if-dirty')
const DRY_RUN = process.argv.includes('--dry-run')
const TRIGGERED_BY = process.env.GITHUB_ACTIONS ? 'github-action' : 'manual'
const PAGE = 1000

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.')
  process.exit(1)
}

// apply_rating_replay was added in migration 030; database.types.ts is
// regenerated from production, so it doesn't know it yet.
type ReplayRpc = {
  rpc(
    fn: 'apply_rating_replay',
    args: {
      p_ratings: ReturnType<typeof toRatingsPayload>
      p_history: ReturnType<typeof toHistoryPayload>
      p_clear_dirty_match_ids: string[]
      p_triggered_by: string
    }
  ): Promise<{ data: number | null; error: { message: string } | null }>
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function fail(message: string): Promise<never> {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

async function loadAllMatches(): Promise<MatchReplayRow[]> {
  const rows: MatchReplayRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id, format_id, played_at,
        match_participants ( id, user_id, is_winner, confirmed_at,
          deck:decks!match_participants_deck_id_fkey ( bracket ) ),
        collection_matches ( collection_id, approval_status )
      `)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return fail(`Failed to load matches: ${error.message}`)
    rows.push(...((data ?? []) as MatchReplayRow[]))
    if (!data || data.length < PAGE) return rows
  }
}

async function loadMembers(): Promise<Map<string, Set<string>>> {
  const members = new Map<string, Set<string>>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('collection_members')
      .select('collection_id, user_id')
      .order('collection_id', { ascending: true })
      .order('user_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return fail(`Failed to load collection_members: ${error.message}`)
    for (const m of data ?? []) {
      if (!members.has(m.collection_id)) members.set(m.collection_id, new Set())
      members.get(m.collection_id)!.add(m.user_id)
    }
    if (!data || data.length < PAGE) return members
  }
}

async function loadCurrentRatings(): Promise<ReplayRatingRow[]> {
  const rows: ReplayRatingRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ratings')
      .select('user_id, format_id, collection_id, rating, matches_played, wins')
      .gt('matches_played', 0)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return fail(`Failed to load current ratings: ${error.message}`)
    for (const r of data ?? []) {
      rows.push({
        userId: r.user_id,
        formatId: r.format_id,
        collectionId: r.collection_id,
        rating: r.rating,
        matchesPlayed: r.matches_played,
        wins: r.wins,
      })
    }
    if (!data || data.length < PAGE) return rows
  }
}

async function main() {
  const { data: dirty, error: dirtyError } = await supabase
    .from('matches')
    .select('id')
    .eq('is_dirty', true)
  if (dirtyError) return fail(`Failed to read dirty matches: ${dirtyError.message}`)
  const dirtyIds = (dirty ?? []).map((m) => m.id)

  if (IF_DIRTY && dirtyIds.length === 0) {
    console.log('No dirty matches — nothing to do.')
    return
  }

  const [matchRows, members] = await Promise.all([loadAllMatches(), loadMembers()])

  const { count: dbConfirmed, error: countError } = await supabase
    .from('match_participants')
    .select('id', { count: 'exact', head: true })
    .not('confirmed_at', 'is', null)
  if (countError) return fail(`Failed to count confirmed participations: ${countError.message}`)
  const loadedConfirmed = matchRows.reduce(
    (n, m) => n + m.match_participants.filter((p) => p.confirmed_at !== null).length,
    0
  )
  const loadProblem = checkCompleteLoad(loadedConfirmed, dbConfirmed ?? 0)
  if (loadProblem) return fail(loadProblem)

  const { ratings, history } = replayRatings(toReplayMatches(matchRows), members)
  console.log(
    `Replayed ${matchRows.length} matches → ${history.length} history rows, ` +
      `${ratings.length} rating rows; clearing ${dirtyIds.length} dirty flag(s).`
  )

  if (DRY_RUN) {
    const current = await loadCurrentRatings()
    const diff = diffRatings(current, ratings)
    console.log(`\nDry run — ${diff.length} rating(s) would change (largest first):`)
    for (const d of diff.slice(0, 50)) {
      const scope = d.collectionId ? `collection ${d.collectionId}` : 'global'
      console.log(`  ${d.userId}  ${d.formatId}  ${scope}: ${d.before ?? '—'} → ${d.after ?? '—'} (${d.change > 0 ? '+' : ''}${d.change})`)
    }
    if (diff.length > 50) console.log(`  … and ${diff.length - 50} more`)
    console.log('Nothing written.')
    return
  }

  const { data: written, error } = await (supabase as unknown as ReplayRpc).rpc('apply_rating_replay', {
    p_ratings: toRatingsPayload(ratings),
    p_history: toHistoryPayload(history),
    p_clear_dirty_match_ids: dirtyIds,
    p_triggered_by: TRIGGERED_BY,
  })
  if (error) return fail(`apply_rating_replay failed (nothing was changed): ${error.message}`)
  console.log(`✔ Swapped in ${written ?? 0} history rows.`)
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)))
```

Then:
- `git rm scripts/recalculate-dirty-matches.ts`
- In `package.json` `scripts`, replace
  `"ratings:recalculate-dirty": "tsx scripts/recalculate-dirty-matches.ts"` with
  `"ratings:recalculate-if-dirty": "tsx scripts/recalculate-ratings.ts --if-dirty"`.

- [ ] **Step 5: Run against the local DB**

Make sure `.env.local` points at local Supabase (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`)
and has a local `SUPABASE_SECRET_KEY`. The local service-role key comes from
`npx supabase status`. Don't print or commit it. If it's missing, stop and ask
the user to add it. Don't edit `.env.local` yourself.

Run, in order:
1. `npx tsx scripts/recalculate-ratings.ts --dry-run`. Expected: a "Replayed N matches → …" line, a "Dry run — K rating(s) would change" report, then "Nothing written.", exit 0. Read the report: large changes should be explainable (the old app path's approximations, or late-joiner collection ratings). Record K and the largest change in the ledger.
2. `npx tsx scripts/recalculate-ratings.ts`. Expected: "✔ Swapped in N history rows.", exit 0.
3. Run it again and compare:
   `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "select md5(string_agg(user_id||match_id||format_id||coalesce(collection_id::text,'')||rating_after, ',' order by user_id, match_id, format_id, collection_id)) from rating_history"`
   before and after the second run. Expected: identical hashes, since the
   replay is deterministic.
4. `npx tsx scripts/recalculate-ratings.ts --if-dirty` with no dirty matches.
   Expected: "No dirty matches — nothing to do.", exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/recalculate-ratings.ts package.json src/lib/rating-replay-load.ts src/lib/__tests__/rating-replay-load.test.ts
git commit -m "feat: replay script swaps ratings atomically and refuses partial loads"
```

(`git rm` already staged the deletion.)

---

### Task 4: Nightly GitHub Action + runbook

**Files:**
- Create: `.github/workflows/nightly-rating-recalc.yml`
- Create: `docs/runbooks/rating-recalc.md`

**Interfaces:**
- Consumes: `npm run ratings:recalculate-if-dirty` (Task 3).
- Repo secrets (the user adds these; this plan never touches them):
  `NEXT_PUBLIC_SUPABASE_URL` (already exists for CI) and `SUPABASE_SECRET_KEY`
  (new).

- [ ] **Step 1: Write the workflow**

`.github/workflows/nightly-rating-recalc.yml`:

```yaml
name: Nightly Rating Recalc

# Replays all confirmed matches (src/lib/rating-replay.ts) whenever any match
# is flagged dirty, and swaps the result in atomically (migration 030).
# Replaced the pg_cron job, whose SQL procedure never succeeded.

on:
  schedule:
    - cron: '0 4 * * *' # 4am UTC daily
  workflow_dispatch:
    inputs:
      force:
        description: 'Replay even if no match is dirty'
        type: boolean
        default: false
      dry_run:
        description: 'Compute and print the per-player diff; write nothing'
        type: boolean
        default: false

# One replay at a time: a manual run during the scheduled one waits.
concurrency:
  group: nightly-rating-recalc
  cancel-in-progress: false

jobs:
  recalc:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Replay ratings
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
        run: |
          ARGS=""
          if [ "${{ inputs.force }}" != "true" ]; then ARGS="--if-dirty"; fi
          if [ "${{ inputs.dry_run }}" = "true" ]; then ARGS="$ARGS --dry-run"; fi
          npx tsx scripts/recalculate-ratings.ts $ARGS
```

Match `actions/checkout` / `actions/setup-node` versions to `ci.yml`. Open it
and use the same major versions it uses.

- [ ] **Step 2: Validate the workflow file**

Run: `npx --yes @action-validator/cli .github/workflows/nightly-rating-recalc.yml`.
If that tool can't be fetched, run
`node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/nightly-rating-recalc.yml','utf8'))"`
(if `yaml` is installed), or ledger that only manual review was possible.
Expected: no schema or YAML errors.

- [ ] **Step 3: Write the runbook**

`docs/runbooks/rating-recalc.md`:

```markdown
# Runbook — Nightly Rating Recalc

Ratings are rebuilt by replaying every confirmed match in order
(`src/lib/rating-replay.ts`). The **Nightly Rating Recalc** GitHub Action runs it
at 04:00 UTC whenever a match is dirty and swaps the result in atomically
(`apply_rating_replay`, migration 030). Collection ratings for late joiners,
newly added/approved matches and auto-confirmed members only appear after
this run.

## One-time setup (before merging Plan B)
1. Supabase → Project Settings → API Keys → create a **secret** key.
2. GitHub → Settings → Secrets and variables → Actions → add
   `SUPABASE_SECRET_KEY`. (`NEXT_PUBLIC_SUPABASE_URL` already exists.)
3. Deploy migrations 030 and 031 **before** the app. The app calls 031's
   functions; 030 unschedules the old pg_cron job.

## First run against production: dry run first
Before the first real write, run the workflow manually with **force** and
**dry_run** ticked. It reads production and prints every rating that would
change, largest first, and writes nothing. Review it: changes should be
explainable (confirm-time approximations corrected, late joiners gaining
collection ratings). Only then let the schedule (or a non-dry run) write.

## Run it now
GitHub → Actions → Nightly Rating Recalc → Run workflow (tick **force** to
replay even with nothing dirty). Locally against a project:
`npx tsx scripts/recalculate-ratings.ts --dry-run` first, then without it.

## If it fails
Nothing was changed: the swap is one transaction. The job log names the
step. A "Refusing to swap: loaded X of Y" error means the data load came back
short. Re-run; if it repeats, investigate before forcing anything.

## One-time data repair (playtest match, 2026-09-30)
The old SQL recalc cleared the dirty flag on the playtest match without
recalculating it. After setup above, flag any match and run the workflow;
the replay is global, so every rating, including that match, is rebuilt:

    update matches set is_dirty = true
    where id = (select id from matches order by played_at desc limit 1);

Then run the workflow and check the collection leaderboard.
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/nightly-rating-recalc.yml docs/runbooks/rating-recalc.md
git commit -m "ci: run nightly rating replay from GitHub Actions"
```

---

### Task 5: Collection flagging, auto-confirm, deck-required trigger (migration 031)

**Files:**
- Create: `supabase/migrations/031_collection_recalc_flags_and_deck_rule.sql`

**Interfaces:**
- Produces (authenticated-callable, the caller must be a member of the collection):
  - `mark_collection_matches_dirty(p_collection_id uuid, p_user_id uuid DEFAULT NULL, p_match_id uuid DEFAULT NULL) → integer`:
    flags approved collection matches that have a confirmed registered
    participant. Narrow it with `p_user_id` (matches that user confirmed) or
    `p_match_id`.
  - `auto_confirm_collection_members(p_match_id uuid, p_collection_id uuid) → integer`:
    when the collection has `auto_approve_members` and the match is approved
    in it, it confirms the unconfirmed registered members **with a real
    deck** and flags the match dirty. Returns how many it confirmed.
- Produces: the `trg_confirmation_requires_deck` trigger on
  `match_participants`. It rejects any NULL→non-NULL `confirmed_at` (or an
  insert with `confirmed_at` set) for a registered participant without a real
  deck.

- [ ] **Step 1: Write the failing SQL check**

Save `<workspace>/check-031.sql`:

```sql
\set ON_ERROR_STOP off
-- Expected failures below must not abort the transaction: roll back each
-- failing statement on its own (implicit per-statement savepoints).
\set ON_ERROR_ROLLBACK on
BEGIN;
-- Fixture: a collection owned by A, B a member, C not; a match in it with A, B, C.
SELECT id AS a FROM profiles ORDER BY created_at LIMIT 1 OFFSET 0 \gset
SELECT id AS b FROM profiles ORDER BY created_at LIMIT 1 OFFSET 1 \gset
SELECT id AS c FROM profiles ORDER BY created_at LIMIT 1 OFFSET 2 \gset
SELECT id AS fmt FROM formats ORDER BY name LIMIT 1 \gset
INSERT INTO collections (id, name, owner_id, auto_approve_members) VALUES ('00000000-0000-0000-0000-00000000c031', 'check-031', :'a', true);
INSERT INTO collection_members (collection_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000c031', :'a', 'owner'),
  ('00000000-0000-0000-0000-00000000c031', :'b', 'member');
INSERT INTO decks (id, owner_id, commander_name, deck_name, bracket) VALUES
  ('00000000-0000-0000-0000-00000000d0a1', :'a', 'Atraxa', 'Real A', 2),
  ('00000000-0000-0000-0000-00000000d0b1', :'b', 'Unknown', 'Unknown Deck', 2);
INSERT INTO matches (id, format_id, created_by, played_at) VALUES ('00000000-0000-0000-0000-00000000e031', :'fmt', :'a', NOW());
INSERT INTO match_participants (match_id, user_id, deck_id, is_winner) VALUES
  ('00000000-0000-0000-0000-00000000e031', :'a', '00000000-0000-0000-0000-00000000d0a1', true),
  ('00000000-0000-0000-0000-00000000e031', :'b', '00000000-0000-0000-0000-00000000d0b1', false),
  ('00000000-0000-0000-0000-00000000e031', :'c', NULL, false);
INSERT INTO collection_matches (collection_id, match_id, added_by, approval_status) VALUES
  ('00000000-0000-0000-0000-00000000c031', '00000000-0000-0000-0000-00000000e031', :'a', 'approved');

-- 1. Deck rule: B (Unknown Deck) and C (no deck) can't be confirmed; A can.
UPDATE match_participants SET confirmed_at = NOW() WHERE match_id = '00000000-0000-0000-0000-00000000e031' AND user_id = :'b';
UPDATE match_participants SET confirmed_at = NOW() WHERE match_id = '00000000-0000-0000-0000-00000000e031' AND user_id = :'c';

-- 2. Auto-confirm as A: confirms only A (real deck), flags the match dirty.
SELECT set_config('request.jwt.claims', json_build_object('sub', :'a', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT 'auto_confirmed=' || auto_confirm_collection_members('00000000-0000-0000-0000-00000000e031', '00000000-0000-0000-0000-00000000c031');
SELECT 'flagged=' || mark_collection_matches_dirty('00000000-0000-0000-0000-00000000c031', :'a');
RESET ROLE;
SELECT 'confirmed=' || string_agg(user_id::text, ',' ORDER BY user_id) FROM match_participants
 WHERE match_id = '00000000-0000-0000-0000-00000000e031' AND confirmed_at IS NOT NULL;
SELECT 'dirty=' || is_dirty FROM matches WHERE id = '00000000-0000-0000-0000-00000000e031';

-- 3. Non-member C may not flag or auto-confirm.
SELECT set_config('request.jwt.claims', json_build_object('sub', :'c', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT mark_collection_matches_dirty('00000000-0000-0000-0000-00000000c031');
SELECT auto_confirm_collection_members('00000000-0000-0000-0000-00000000e031', '00000000-0000-0000-0000-00000000c031');
RESET ROLE;
ROLLBACK;

-- 4. Grandfathering: an existing confirmed-on-Unknown-Deck row can be updated (deck change) without error.
BEGIN;
SELECT mp.id AS pid FROM match_participants mp WHERE mp.confirmed_at IS NOT NULL AND mp.user_id IS NOT NULL LIMIT 1 \gset
UPDATE match_participants SET confirmed_at = confirmed_at WHERE id = :'pid';
SELECT 'grandfathered_ok';
ROLLBACK;
```

Run: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -q -t -f <workspace>/check-031.sql`
Expected now: the B and C updates **succeed** (no trigger yet), and the
function calls fail with "does not exist". That's RED.

Before running, adjust the fixture to the real column lists:
`collections` (`owner_id`?), `matches` (`created_by`, `played_at`, others
NOT NULL?), `collection_matches` (`added_by`?). Check them with
`\d collections`, `\d matches`, `\d collection_matches`, and ledger any
change.

- [ ] **Step 2: Write the migration**

`supabase/migrations/031_collection_recalc_flags_and_deck_rule.sql`:

```sql
-- ============================================
-- Collection recalc flags, real auto-confirm, and "deck required to confirm"
-- ============================================
--
-- Migration 028 requires the caller of apply_rating_change to be a
-- participant of the match, and only the match creator may update other
-- players' match_participants rows. Collection actions (a member joining,
-- a match added/approved, auto-confirm) act on OTHER players' matches, so
-- from the actor's session they failed silently whenever the actor wasn't in
-- the match. Collection-scope ratings are now written by the nightly replay
-- (migration 030, .github/workflows/nightly-rating-recalc.yml); these
-- functions only confirm and flag, after checking collection membership here.
--
-- The deck rule (playtest feedback F4): a confirmation only counts with a real
-- deck. Enforced as a trigger so every path — confirmMatch, friend
-- auto-confirm, claims, collection auto-confirm, direct REST — obeys it. Only
-- the unconfirmed→confirmed transition is checked, so rows confirmed before
-- this migration are left as they are.

CREATE OR REPLACE FUNCTION mark_collection_matches_dirty(
  p_collection_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_match_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM collection_members
    WHERE collection_id = p_collection_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized: caller is not a member of this collection';
  END IF;

  UPDATE matches m
  SET is_dirty = TRUE
  WHERE m.id IN (
      SELECT cm.match_id FROM collection_matches cm
      WHERE cm.collection_id = p_collection_id
        AND cm.approval_status = 'approved'
        AND (p_match_id IS NULL OR cm.match_id = p_match_id)
    )
    AND EXISTS (
      SELECT 1 FROM match_participants mp
      WHERE mp.match_id = m.id
        AND mp.user_id IS NOT NULL
        AND mp.confirmed_at IS NOT NULL
        AND (p_user_id IS NULL OR mp.user_id = p_user_id)
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION auto_confirm_collection_members(
  p_match_id UUID,
  p_collection_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM collection_members
    WHERE collection_id = p_collection_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized: caller is not a member of this collection';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM collections WHERE id = p_collection_id AND auto_approve_members) THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM collection_matches
    WHERE collection_id = p_collection_id AND match_id = p_match_id AND approval_status = 'approved'
  ) THEN
    RETURN 0;
  END IF;

  UPDATE match_participants mp
  SET participant_status = 'confirmed', confirmed_at = NOW()
  FROM decks d
  WHERE mp.match_id = p_match_id
    AND mp.user_id IS NOT NULL
    AND mp.confirmed_at IS NULL
    AND d.id = mp.deck_id
    AND d.deck_name IS DISTINCT FROM 'Unknown Deck'
    AND EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = p_collection_id AND cm.user_id = mp.user_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE matches SET is_dirty = TRUE WHERE id = p_match_id;
  END IF;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION enforce_confirmation_requires_deck()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL
     AND NEW.confirmed_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.confirmed_at IS NULL)
     AND NOT EXISTS (
       SELECT 1 FROM decks d
       WHERE d.id = NEW.deck_id AND d.deck_name IS DISTINCT FROM 'Unknown Deck'
     ) THEN
    RAISE EXCEPTION 'confirmation requires a deck: pick your deck before confirming'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_confirmation_requires_deck ON match_participants;
CREATE TRIGGER trg_confirmation_requires_deck
  BEFORE INSERT OR UPDATE OF confirmed_at ON match_participants
  FOR EACH ROW
  EXECUTE FUNCTION enforce_confirmation_requires_deck();

REVOKE ALL ON FUNCTION mark_collection_matches_dirty(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_collection_matches_dirty(UUID, UUID, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION auto_confirm_collection_members(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION auto_confirm_collection_members(UUID, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION enforce_confirmation_requires_deck() FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 3: Apply locally and re-run the check**

Run: `npx supabase migration up --local`, then the psql command from Step 1.
Expected:
- Section 1: both UPDATEs for B and C error with
  `confirmation requires a deck`.
- Section 2: `auto_confirmed=1`, `flagged=1`, `confirmed=<a's id>` only,
  `dirty=t`.
- Section 3: both calls error with
  `not authorized: caller is not a member of this collection`.
- Section 4: `grandfathered_ok`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/031_collection_recalc_flags_and_deck_rule.sql
git commit -m "feat: collection recalc flags, real auto-confirm, deck required to confirm"
```

---

### Task 6: Collection actions use the new functions

**Files:**
- Modify: `src/lib/supabase/collections.ts`. Replace `autoConfirmCollectionMembers`
  (~line 686) with RPC wrappers `markCollectionMatchesDirty` and
  `autoConfirmCollectionMembers`.
- Modify: `src/lib/supabase/ratings.ts`. Delete `applyMatchCollectionRatings`
  (~lines 718-850).
- Modify: `src/lib/supabase/index.ts`. Update the exports.
- Modify: `src/app/actions/collection.ts`: `inviteCollectionMember` (~line 24),
  `addMatchToCollection` (~386-399), `approveCollectionMatch` (~481-500).
- Modify: `src/app/collections/[id]/leaderboard/page.tsx` (the "updates overnight" note).
- Test: `src/lib/__tests__/collection-recalc-rpc.test.ts`

**Interfaces:**
- Consumes: the SQL functions from Task 5.
- Produces:
  - `markCollectionMatchesDirty(client, { collectionId: string; userId?: string; matchId?: string }): Promise<Result<number>>`
  - `autoConfirmCollectionMembers(client, matchId: string, collectionId: string): Promise<Result<number>>` (same name; new signature and behavior)

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/collection-recalc-rpc.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { markCollectionMatchesDirty, autoConfirmCollectionMembers } from '@/lib/supabase/collections'

function clientReturning(result: { data: number | null; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result)
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

describe('markCollectionMatchesDirty', () => {
  it('flags a joining member\'s matches', async () => {
    const { client, rpc } = clientReturning({ data: 2, error: null })
    expect(await markCollectionMatchesDirty(client, { collectionId: 'c', userId: 'u' })).toEqual({ success: true, data: 2 })
    expect(rpc).toHaveBeenCalledWith('mark_collection_matches_dirty', { p_collection_id: 'c', p_user_id: 'u', p_match_id: null })
  })

  it('surfaces an authorization error instead of swallowing it', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'not authorized: caller is not a member of this collection' } })
    expect(await markCollectionMatchesDirty(client, { collectionId: 'c', matchId: 'm' }))
      .toEqual({ success: false, error: 'not authorized: caller is not a member of this collection' })
  })
})

describe('autoConfirmCollectionMembers', () => {
  it('delegates to the SECURITY DEFINER function', async () => {
    const { client, rpc } = clientReturning({ data: 1, error: null })
    expect(await autoConfirmCollectionMembers(client, 'm', 'c')).toEqual({ success: true, data: 1 })
    expect(rpc).toHaveBeenCalledWith('auto_confirm_collection_members', { p_match_id: 'm', p_collection_id: 'c' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project node src/lib/__tests__/collection-recalc-rpc.test.ts`
Expected: FAIL. `markCollectionMatchesDirty` isn't exported, and the old
`autoConfirmCollectionMembers` uses `.from()`, not `.rpc()`.

- [ ] **Step 3: Implement the wrappers**

In `src/lib/supabase/collections.ts`, delete the existing
`autoConfirmCollectionMembers` function and its doc comment (the one at
~line 686 whose body selects unconfirmed participants and updates
`confirmed_at`). Add:

```ts
// mark_collection_matches_dirty / auto_confirm_collection_members were added
// in migration 031; database.types.ts is regenerated from production, so it
// doesn't know them until 031 is deployed.
type CollectionRecalcShim = {
  rpc(
    fn: 'mark_collection_matches_dirty',
    args: { p_collection_id: string; p_user_id: string | null; p_match_id: string | null }
  ): Promise<{ data: number | null; error: { message: string } | null }>
  rpc(
    fn: 'auto_confirm_collection_members',
    args: { p_match_id: string; p_collection_id: string }
  ): Promise<{ data: number | null; error: { message: string } | null }>
}

/**
 * Flag a collection's approved matches for the nightly rating replay, which
 * writes collection-scope ratings (028 forbids writing other players' ratings
 * from a user session). Narrow with userId (a joining member) or matchId.
 */
export async function markCollectionMatchesDirty(
  client: SupabaseClient<Database>,
  params: { collectionId: string; userId?: string; matchId?: string }
): Promise<Result<number>> {
  const { data, error } = await (client as unknown as CollectionRecalcShim).rpc('mark_collection_matches_dirty', {
    p_collection_id: params.collectionId,
    p_user_id: params.userId ?? null,
    p_match_id: params.matchId ?? null,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? 0 }
}

/**
 * Confirm the collection's members in an approved match (members with a real
 * deck only) and flag it for the nightly replay. No-op unless the collection
 * has auto_approve_members.
 */
export async function autoConfirmCollectionMembers(
  client: SupabaseClient<Database>,
  matchId: string,
  collectionId: string
): Promise<Result<number>> {
  const { data, error } = await (client as unknown as CollectionRecalcShim).rpc('auto_confirm_collection_members', {
    p_match_id: matchId,
    p_collection_id: collectionId,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? 0 }
}
```

In `src/lib/supabase/index.ts`, add `markCollectionMatchesDirty` next to the
`autoConfirmCollectionMembers` export, and remove `applyMatchCollectionRatings`.
In `src/lib/supabase/ratings.ts`, delete `applyMatchCollectionRatings` and its
doc comment entirely.

Run: `npx vitest run --project node src/lib/__tests__/collection-recalc-rpc.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 4: Update the collection actions**

`src/app/actions/collection.ts`:

1. Remove `import { applyMatchCollectionRatings } from '@/lib/supabase/ratings'`,
   and add `markCollectionMatchesDirty` to the `@/lib/supabase/collections`
   import that already brings in `autoConfirmCollectionMembers`.

2. In `inviteCollectionMember`, after the successful insert and before the
   `revalidatePath` calls:

```ts
  // Their past matches in this collection get collection ratings from the
  // nightly replay; flag them so it runs.
  const flagResult = await markCollectionMatchesDirty(supabase, { collectionId, userId })
  if (!flagResult.success) {
    console.error(`[RATING] inviteCollectionMember: failed to flag matches for recalc - ${flagResult.error}`)
  }
```

3. In `addMatchToCollection`, replace

```ts
  // If the match was directly approved, apply collection-scoped ratings immediately
  if (approvalStatus === 'approved') {
    // Auto-confirm collection members who are unconfirmed participants
    if (collection.autoApproveMembers) {
      await autoConfirmCollectionMembers(supabase, matchId, collectionId)
    }

    await applyMatchCollectionRatings(supabase, {
      matchId,
      collectionId,
      algorithmVersion: 1,
    })
  }
```

with

```ts
  // Collection ratings come from the nightly replay. Auto-confirm (when the
  // collection allows it) and flag the match so the replay picks it up.
  if (approvalStatus === 'approved') {
    await queueCollectionMatchForRecalc(supabase, matchId, collectionId, collection.autoApproveMembers)
  }
```

4. In `approveCollectionMatch`, replace the equivalent block, from the
   `// Now that the match is approved` comment through the
   `applyMatchCollectionRatings(...)` call. Keep the `collectionMatch` lookup
   it uses:

```ts
  if (collectionMatch) {
    await queueCollectionMatchForRecalc(
      supabase,
      collectionMatch.match_id,
      collectionId,
      collectionResult.data.autoApproveMembers
    )
  }
```

   Read the current block first and keep its existing variable names. If it's
   shaped differently from this, ledger the adaptation.

5. Add this helper at the bottom of the file (not exported, so not a server action):

```ts
async function queueCollectionMatchForRecalc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matchId: string,
  collectionId: string,
  autoApproveMembers: boolean
): Promise<void> {
  if (autoApproveMembers) {
    const confirmResult = await autoConfirmCollectionMembers(supabase, matchId, collectionId)
    if (!confirmResult.success) {
      console.error(`[RATING] auto-confirm failed for match ${matchId} in ${collectionId} - ${confirmResult.error}`)
    }
  }
  const flagResult = await markCollectionMatchesDirty(supabase, { collectionId, matchId })
  if (!flagResult.success) {
    console.error(`[RATING] failed to flag match ${matchId} in ${collectionId} for recalc - ${flagResult.error}`)
  }
}
```

   `'use server'` files may only export async functions. A non-exported
   helper is fine; check that the file starts with `'use server'` and that the
   helper isn't exported.

- [ ] **Step 5: "Updates overnight" note on the collection leaderboard**

In `src/app/collections/[id]/leaderboard/page.tsx`, wrap the returned `<Card>`
in a fragment and add a note below it:

```tsx
  return (
    <>
      <Card>
        <CardContent className="p-0">
          <LeaderboardWithFilter entries={leaderboard} />
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-text-3">
        New members and newly added matches count toward this leaderboard after the nightly update.
      </p>
    </>
  );
```

- [ ] **Step 6: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npx eslint src/lib/supabase src/app/actions/collection.ts "src/app/collections/[id]/leaderboard/page.tsx" && npx vitest run --project node`
Expected: clean, and every node test passes.
`grep -rn "applyMatchCollectionRatings" src` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/collections.ts src/lib/supabase/ratings.ts src/lib/supabase/index.ts src/app/actions/collection.ts "src/app/collections/[id]/leaderboard/page.tsx" src/lib/__tests__/collection-recalc-rpc.test.ts
git commit -m "fix: collection actions flag matches for the nightly replay"
```

---

### Task 7: Deck required to confirm (app side)

**Files:**
- Modify: `src/lib/confirmation.ts` (add `hasConfirmableDeck`; deck-aware `shouldAutoConfirmParticipant`)
- Test: `src/lib/__tests__/confirmation.test.ts` (extend)
- Modify: `src/app/actions/match.ts`: `logMatch` friend auto-confirm (~line 168),
  `claimSlotWithAutoApproval` (~line 655), `approveClaimRequest` (~line 822),
  `confirmMatch` (~line 240)
- Modify: `src/lib/services/match.ts` (~lines 417, 445, 493: `hasDeckAssigned` uses the deck name)
- Modify: `src/components/features/pending-confirmation-card.tsx` (remove "Confirm Anyway")
- Modify: `src/components/match/update-deck-modal.tsx` (exclude placeholder decks; no placeholder preselect)
- Test: `src/components/match/update-deck-modal.test.tsx`

**Interfaces:**
- Produces:
  - `hasConfirmableDeck(deck: { deckName: string | null } | null): boolean`
  - `shouldAutoConfirmParticipant({ reporterId, participantUserId, friendshipStatus, deck })`.
    `deck` is required, and the function returns false without a confirmable deck.
  - The `confirmMatch` error message `"Pick your deck before confirming this match."`

- [ ] **Step 1: Write the failing unit tests**

Append to `src/lib/__tests__/confirmation.test.ts`:

```ts
describe('hasConfirmableDeck', () => {
  it('accepts a real deck, including one with no name', () => {
    expect(hasConfirmableDeck({ deckName: 'Superfriends' })).toBe(true)
    expect(hasConfirmableDeck({ deckName: null })).toBe(true)
  })

  it('rejects no deck and the Unknown Deck placeholder', () => {
    expect(hasConfirmableDeck(null)).toBe(false)
    expect(hasConfirmableDeck({ deckName: 'Unknown Deck' })).toBe(false)
  })
})

describe('shouldAutoConfirmParticipant — deck rule', () => {
  it('does not auto-confirm an accepted friend still on Unknown Deck', () => {
    expect(shouldAutoConfirmParticipant({
      reporterId: 'r', participantUserId: 'f', friendshipStatus: 'accepted', deck: { deckName: 'Unknown Deck' },
    })).toBe(false)
  })

  it('does not auto-confirm the reporter without a deck', () => {
    expect(shouldAutoConfirmParticipant({
      reporterId: 'r', participantUserId: 'r', friendshipStatus: null, deck: null,
    })).toBe(false)
  })
})
```

Add `hasConfirmableDeck` to the file's import from `@/lib/confirmation`. Add
`deck: { deckName: 'Real Deck' }` to every existing
`shouldAutoConfirmParticipant` call in this file, so the earlier tests keep
testing friendship alone.

Run: `npx vitest run --project node src/lib/__tests__/confirmation.test.ts`
Expected: FAIL (`hasConfirmableDeck` isn't exported, and the deck rule is ignored).

- [ ] **Step 2: Implement in `src/lib/confirmation.ts`**

```ts
import type { FriendshipStatus } from '@/types/friendship'
import { PLACEHOLDER_DECK_NAME } from '@/types/deck'

/**
 * A confirmation only counts with a real deck: not missing, not the
 * "Unknown Deck" placeholder. Mirrors the DB trigger from migration 031.
 */
export function hasConfirmableDeck(deck: { deckName: string | null } | null): boolean {
  return deck !== null && deck.deckName !== PLACEHOLDER_DECK_NAME
}

/**
 * A participant is auto-confirmed (and rated) immediately if they have a real
 * deck AND are the match reporter or an accepted friend of the reporter.
 * Everyone else stays pending until they confirm themselves.
 */
export function shouldAutoConfirmParticipant(params: {
  reporterId: string
  participantUserId: string
  friendshipStatus: FriendshipStatus | null
  deck: { deckName: string | null } | null
}): boolean {
  if (!hasConfirmableDeck(params.deck)) return false
  if (params.participantUserId === params.reporterId) return true
  return params.friendshipStatus === 'accepted'
}
```

Run: `npx vitest run --project node src/lib/__tests__/confirmation.test.ts`
Expected: PASS.

- [ ] **Step 3: Pass the deck at the three auto-confirm call sites**

Run `npx tsc --noEmit`. It now flags each `shouldAutoConfirmParticipant` call
in `src/app/actions/match.ts` that lacks `deck`. At each one, load that
participant's deck name and pass
`deck: participantDeck ? { deckName: participantDeck.deck_name } : null`:
- **`logMatch`:** the participants inserted earlier in the function carry
  `deck_id`. Fetch the decks in one query:

  ```ts
  const { data: decks } = await supabase.from('decks').select('id, deck_name').in('id', deckIds)
  ```

  Then build a `Map` from id to deck_name before the loop.
- **`claimSlotWithAutoApproval` and `approveClaimRequest`:** extend the existing
  participant select with
  `deck:decks!match_participants_deck_id_fkey(deck_name)`, and use
  `participant.deck`.

Read each function before editing and keep its style. A claimed slot usually
holds the Unknown Deck placeholder, so claims now stay pending until the
claimant picks a deck. That's intended (spec F4).

- [ ] **Step 4: Reject deckless confirmation in `confirmMatch`**

In `confirmMatch` (`src/app/actions/match.ts`), after the optional
`updateParticipantDeck` block and before the
`if (participant.participant_status === "pending")` block, add:

```ts
  // Spec F4: a confirmation only counts with a real deck. The DB trigger
  // (migration 031) enforces it too; checking here gives a clear message.
  const { data: deckRow } = await supabase
    .from("match_participants")
    .select("deck:decks!match_participants_deck_id_fkey(deck_name)")
    .eq("id", participantId)
    .single();
  const deck = deckRow?.deck ?? null;
  if (!hasConfirmableDeck(deck ? { deckName: deck.deck_name } : null)) {
    return { success: false, error: "Pick your deck before confirming this match." };
  }
```

Import `hasConfirmableDeck` from `@/lib/confirmation`. That file is already
imported for `shouldAutoConfirmParticipant`; extend that import.

- [ ] **Step 5: `hasDeckAssigned` means a real deck**

In `src/lib/services/match.ts`:
- In the pending-confirmations query (~line 417), change
  `.select('id, match_id, deck_id, created_at')` to
  `.select('id, match_id, deck_id, created_at, deck:decks!match_participants_deck_id_fkey(deck_name)')`.
- Extend the row type at ~line 445 with
  `deck: { deck_name: string | null } | null`.
- Set
  `hasDeckAssigned: hasConfirmableDeck(participation.deck ? { deckName: participation.deck.deck_name } : null)`
  (~line 493), importing `hasConfirmableDeck`.

- [ ] **Step 6: UI: no "Confirm Anyway"; no placeholder decks to pick**

`src/components/features/pending-confirmation-card.tsx`, in the
`showNoDeckWarning` block:
- Change the copy to
  `You don't have any decks yet. Add a deck to confirm this match.`
- Delete the `Confirm Anyway` `<Button>` (the one calling `handleConfirm()`
  with no argument).

`src/components/match/update-deck-modal.tsx`:
- Import `PLACEHOLDER_DECK_NAME` from `@/types/deck`.
- Inside the component, before the reset effect, add:

```tsx
  const selectableDecks = React.useMemo(
    () => decks.filter((d) => d.deckName !== PLACEHOLDER_DECK_NAME),
    [decks]
  );
  const initialDeckId = selectableDecks.some((d) => d.id === currentDeckId) ? currentDeckId : null;
```

- In the reset effect, use `setSelectedDeckId(initialDeckId)` instead of
  `setSelectedDeckId(currentDeckId)`, and add `initialDeckId` to its
  dependency array.
- Replace `decks.map((deck) => (` with `selectableDecks.map((deck) => (`.
- In the submit button's `disabled`, replace `decks.length === 0` with
  `selectableDecks.length === 0`.

Create `src/components/match/update-deck-modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpdateDeckModal } from "./update-deck-modal";

vi.mock("@/app/actions/match", () => ({ confirmMatch: vi.fn(), updateMatchParticipantDeck: vi.fn() }));

const deck = (id: string, deckName: string) => ({
  id, deckName, commanderName: `${deckName} commander`, partnerName: null, colorIdentity: [], bracket: 2 as const,
});

describe("UpdateDeckModal", () => {
  it("never offers the Unknown Deck placeholder", () => {
    render(
      <UpdateDeckModal
        isOpen
        onClose={() => {}}
        participantId="p1"
        currentDeckId="placeholder"
        decks={[deck("placeholder", "Unknown Deck"), deck("real", "Superfriends")]}
        isConfirmed={false}
      />
    );
    expect(screen.queryByText(/Unknown Deck/)).not.toBeInTheDocument();
    expect(screen.getByText(/Superfriends/)).toBeInTheDocument();
  });
});
```

Before running, check the modal's props against its `interface` near the top
of the file (`ratingsApplied` may be required). Check the deck row text too:
it may render `commanderName` rather than `deckName`, in which case assert on
the text it renders. Ledger any change.

Run: `npx vitest run --project jsdom src/components/match/update-deck-modal.test.tsx`
Expected: FAIL before the modal edit (the placeholder is listed) and PASS after.
Write the test first, run it RED, then make the edits above.

- [ ] **Step 7: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: everything passes, with 0 lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/confirmation.ts src/lib/__tests__/confirmation.test.ts src/app/actions/match.ts src/lib/services/match.ts src/components/features/pending-confirmation-card.tsx src/components/match/update-deck-modal.tsx src/components/match/update-deck-modal.test.tsx
git commit -m "feat: require a real deck to confirm a match"
```

---

### Task 8: Docs and end-to-end check

**Files:**
- Modify: `CLAUDE.md` (Rating System section; `Commands` block)
- Modify: `docs/superpowers/specs/2026-09-30-playtest-feedback-design.md`
  (append "Findings 2026-10-01" + status)

- [ ] **Step 1: CLAUDE.md**

- In **Commands**, replace the `ratings:recalculate-dirty` line with
  `npm run ratings:recalculate-if-dirty   # Replay only if a match is dirty (what the nightly job runs)`.
- In **Rating System**, replace the **Dirty match recalculation** paragraph with:

  > **Nightly replay** — `src/lib/rating-replay.ts` is the canonical rating computation: it replays every confirmed match chronologically (global + membership-aware collection scopes). The **Nightly Rating Recalc** GitHub Action (`.github/workflows/nightly-rating-recalc.yml`, 04:00 UTC) runs `scripts/recalculate-ratings.ts --if-dirty` and swaps the result in atomically via `apply_rating_replay` (migration 030). Confirm-time rating updates are an approximation the replay corrects. Collection actions (member joins, match added/approved, auto-confirm) only flag matches dirty (migration 031); their collection ratings appear after the next replay. Runbook: `docs/runbooks/rating-recalc.md`.

- [ ] **Step 2: Spec findings**

Append to the spec:
- a `## Findings 2026-10-01` section with the five Background items from this
  plan,
- the decisions list,
- and one line saying B2 and F4 are implemented on `fix/plan-b-rating-correctness`.

- [ ] **Step 3: End-to-end on the local DB**

With local Supabase:
1. Pick a collection and a user who isn't a member but has a confirmed,
   approved match in it. Find them with psql. Insert the membership the way
   the app would, through `mark_collection_matches_dirty`, or by inserting
   the `collection_members` row and calling the function as the owner. Then
   confirm the match is now `is_dirty = true`.
2. Run `npx tsx scripts/recalculate-ratings.ts --if-dirty`. Expected: it
   replays and swaps.
3. psql: the user now has a `ratings` row for that collection, and
   `matches.is_dirty` is false.
4. Clean up the inserted membership afterwards with a `DELETE`, then run the
   script once more (no `--if-dirty`) so local ratings match the data again.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-30-playtest-feedback-design.md
git commit -m "docs: record nightly replay design and 2026-10-01 rating findings"
```

---

## Self-review notes

- **Spec coverage:**
  - B2 (membership rule, late-join backfill, non-member audit): Tasks 1, 2, 3,
    5 and 6. The audit was run: 0 rows in prod, so no cleanup task.
  - F4 (deck required; auto-confirm skips Unknown Deck): Tasks 5 and 7.
  - Auto-confirm full confirm: Task 5. Its ratings arrive with the nightly
    replay.
  - The hard-coded `algorithmVersion: 1`: Task 6 deletes it with
    `applyMatchCollectionRatings`; the replay stamps `ALGORITHM_VERSION`.
- **Deliberately not done:** a parity test between the app confirm path and
  the replay. The confirm path uses the live rating plus the played-at
  snapshot, an accepted approximation per the comment in
  `applyParticipantRating`, so exact parity isn't a goal. The replay is
  canonical.
- **Out of scope, flagged for the user:** `apply_rating_change` (028) still
  trusts the caller-supplied `p_new_rating`, so a signed-in participant could
  set their own rating via REST. Closing that needs the rating math
  server-side or routing all writes through the replay. That's a separate
  decision.
