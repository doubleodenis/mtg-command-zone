# Compared To You Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Compared to you" head-to-head card on player profiles with a composite of design directions 1b ("Tale of the Tape") and 1c ("Rivalry Arc"): a mirrored stat-bar header, a rivalry line chart over shared match history, and format-performance chips.

**Architecture:** Two pure, independently-testable helper functions (`buildMeetings`, `calculateRivalryStreak`, `calculateRatingGapTrend`) compute the new rivalry-timeline data from already-fetched rows; `getHeadToHeadComparison` in the existing stats service wires them into real Supabase queries; `PlayerComparisonCard` is rebuilt to render the new layout, with the Recharts-based line chart split into its own component file following the existing `rating-history-chart.tsx` pattern.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Tailwind CSS 4 (existing design tokens only — no new colors/fonts), Recharts 3.7, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-compared-to-you-redesign-design.md`

## Global Constraints

- No new design tokens — every color/font in the redesign maps to an existing token in `src/app/_design-system/theme.css` (`--color-accent`, `--color-gold`, `--color-win`, `--color-loss`, `--font-display`, `--font-body`, `--font-data`).
- No functional time-range filter (ALL TIME/90D/30D) — chart and stats are always all-time.
- No challenge/rematch CTA of any kind.
- The "Best Streak" mirrored-bar row and the "Best Commander vs opponent" callout are both removed, not preserved behind a flag.
- `PlayerComparisonCard`'s exported name and `{ data, className }` prop shape stay the same — `src/app/player/[username]/page.tsx` requires no changes beyond whatever new fields the `data` object carries.
- The rivalry chart block (and its stat tiles) renders only when `matchesTogether >= 3`; below that, the sparse unlock card renders instead. The identity header and mirrored bars render at any count ≥ 1 (the outer card is already gated on ≥ 1 shared match by `page.tsx`).

---

## File Structure

- **Create** `src/lib/services/head-to-head-meetings.ts` — pure functions and types for the rivalry timeline: `buildMeetings`, `calculateRivalryStreak`, `calculateRatingGapTrend`, plus `Meeting`, `RatingGapTrend`, `RivalryStreak`, `SharedMatchInfo`, `RatingHistoryRow` types. No Supabase imports — these take plain arrays and are unit-tested directly, matching the existing convention in `src/lib/rating.ts` of keeping algorithmic logic pure and separate from data fetching.
- **Create** `src/lib/services/__tests__/head-to-head-meetings.test.ts` — unit tests for the above, mirroring the structure of `src/lib/__tests__/rating.test.ts`.
- **Modify** `src/lib/services/stats.ts` — extend `getHeadToHeadComparison` to fetch `played_at`/`is_dirty` on matches and `rating_history` rows for both players, call the new pure helpers, and populate the new `HeadToHeadComparison` fields. Remove the commander-tracking code path and `bestCommander`/`CommanderVsRecord` (dead weight once the UI no longer renders it — see Task 3).
- **Create** `src/components/features/rivalry-meetings-chart.tsx` — Recharts `LineChart` rendering `meetings[]`, following the `ResponsiveContainer` + themed-token pattern already used in `src/components/features/rating-history-chart.tsx`.
- **Modify** `src/components/features/player-comparison-card.tsx` — new `ComparisonData` shape, new layout (identity header → mirrored bars → chart-or-sparse block → format chips), new private subcomponents (`MirroredStatBars`, `RivalryStatTiles`, `FormatBeatChips`, `SparseRivalryUnlock`), removal of `BestCommanderCard` and `FormatVsRow`.

---

### Task 1: Pure rivalry-timeline helpers

**Files:**
- Create: `src/lib/services/head-to-head-meetings.ts`
- Test: `src/lib/services/__tests__/head-to-head-meetings.test.ts`

**Interfaces:**
- Produces (used by Task 2):
  ```ts
  type SharedMatchInfo = {
    matchId: string
    playedAt: string      // ISO date string
    isDirty: boolean
    formatSlug: string
    formatName: string
    isWin: boolean          // current user's outcome in this match
  }

  type RatingHistoryRow = {
    matchId: string
    userId: string
    ratingAfter: number
  }

  type Meeting = {
    matchId: string
    playedAt: string
    formatSlug: string
    formatName: string
    isWin: boolean
    yourRating: number
    opponentRating: number
  }

  type RivalryStreak = { count: number; result: 'W' | 'L' }

  type RatingGapTrend = { current: number; past: number; daysSpan: number }

  function buildMeetings(
    sharedMatches: SharedMatchInfo[],
    ratingRows: RatingHistoryRow[],
    currentUserId: string,
    targetUserId: string
  ): Meeting[]

  function calculateRivalryStreak(
    sharedMatches: Pick<SharedMatchInfo, 'playedAt' | 'isWin'>[]
  ): RivalryStreak | null

  function calculateRatingGapTrend(meetings: Meeting[]): RatingGapTrend | null
  ```

- [ ] **Step 1: Write failing tests for `buildMeetings`**

```ts
import { describe, it, expect } from 'vitest'
import { buildMeetings, calculateRivalryStreak, calculateRatingGapTrend } from '@/lib/services/head-to-head-meetings'
import type { SharedMatchInfo, RatingHistoryRow, Meeting } from '@/lib/services/head-to-head-meetings'

const YOU = 'user-you'
const THEM = 'user-them'

function match(overrides: Partial<SharedMatchInfo>): SharedMatchInfo {
  return {
    matchId: 'm1',
    playedAt: '2026-01-01T00:00:00Z',
    isDirty: false,
    formatSlug: 'ffa',
    formatName: 'FFA',
    isWin: true,
    ...overrides,
  }
}

function ratingRow(matchId: string, userId: string, ratingAfter: number): RatingHistoryRow {
  return { matchId, userId, ratingAfter }
}

describe('buildMeetings', () => {
  it('excludes matches missing a rating_history row for either player', () => {
    const shared = [match({ matchId: 'm1' }), match({ matchId: 'm2' })]
    const ratings = [
      ratingRow('m1', YOU, 1010),
      ratingRow('m1', THEM, 990),
      // m2 has no THEM row
      ratingRow('m2', YOU, 1020),
    ]
    const meetings = buildMeetings(shared, ratings, YOU, THEM)
    expect(meetings).toHaveLength(1)
    expect(meetings[0].matchId).toBe('m1')
  })

  it('excludes dirty matches even if rating rows exist', () => {
    const shared = [match({ matchId: 'm1', isDirty: true })]
    const ratings = [ratingRow('m1', YOU, 1010), ratingRow('m1', THEM, 990)]
    expect(buildMeetings(shared, ratings, YOU, THEM)).toHaveLength(0)
  })

  it('sorts ascending by playedAt regardless of input order', () => {
    const shared = [
      match({ matchId: 'm2', playedAt: '2026-02-01T00:00:00Z' }),
      match({ matchId: 'm1', playedAt: '2026-01-01T00:00:00Z' }),
    ]
    const ratings = [
      ratingRow('m1', YOU, 1000), ratingRow('m1', THEM, 1000),
      ratingRow('m2', YOU, 1010), ratingRow('m2', THEM, 990),
    ]
    const meetings = buildMeetings(shared, ratings, YOU, THEM)
    expect(meetings.map((m) => m.matchId)).toEqual(['m1', 'm2'])
  })

  it('caps at the most recent 12 meetings', () => {
    const shared: SharedMatchInfo[] = []
    const ratings: RatingHistoryRow[] = []
    for (let i = 0; i < 13; i++) {
      const id = `m${i}`
      shared.push(match({ matchId: id, playedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z` }))
      ratings.push(ratingRow(id, YOU, 1000 + i), ratingRow(id, THEM, 1000 - i))
    }
    const meetings = buildMeetings(shared, ratings, YOU, THEM)
    expect(meetings).toHaveLength(12)
    expect(meetings[0].matchId).toBe('m1') // m0 (oldest) dropped
    expect(meetings[11].matchId).toBe('m12')
  })

  it('maps yourRating/opponentRating to the correct user', () => {
    const shared = [match({ matchId: 'm1' })]
    const ratings = [ratingRow('m1', YOU, 1013), ratingRow('m1', THEM, 1088)]
    const meetings = buildMeetings(shared, ratings, YOU, THEM)
    expect(meetings[0].yourRating).toBe(1013)
    expect(meetings[0].opponentRating).toBe(1088)
  })
})

describe('calculateRivalryStreak', () => {
  it('returns null for no shared matches', () => {
    expect(calculateRivalryStreak([])).toBeNull()
  })

  it('counts consecutive wins back from the most recent match', () => {
    const matches = [
      { playedAt: '2026-01-01T00:00:00Z', isWin: false },
      { playedAt: '2026-01-03T00:00:00Z', isWin: true },
      { playedAt: '2026-01-02T00:00:00Z', isWin: true },
    ]
    expect(calculateRivalryStreak(matches)).toEqual({ count: 2, result: 'W' })
  })

  it('counts consecutive losses back from the most recent match', () => {
    const matches = [
      { playedAt: '2026-01-01T00:00:00Z', isWin: true },
      { playedAt: '2026-01-02T00:00:00Z', isWin: false },
      { playedAt: '2026-01-03T00:00:00Z', isWin: false },
    ]
    expect(calculateRivalryStreak(matches)).toEqual({ count: 2, result: 'L' })
  })

  it('returns count 1 for a single match', () => {
    const matches = [{ playedAt: '2026-01-01T00:00:00Z', isWin: true }]
    expect(calculateRivalryStreak(matches)).toEqual({ count: 1, result: 'W' })
  })
})

describe('calculateRatingGapTrend', () => {
  function meeting(playedAt: string, yourRating: number, opponentRating: number): Meeting {
    return { matchId: playedAt, playedAt, formatSlug: 'ffa', formatName: 'FFA', isWin: true, yourRating, opponentRating }
  }

  it('returns null with fewer than 2 meetings', () => {
    expect(calculateRatingGapTrend([meeting('2026-01-01T00:00:00Z', 1000, 1000)])).toBeNull()
  })

  it('returns null when no meeting is at least 30 days before the latest one', () => {
    const meetings = [
      meeting('2026-01-01T00:00:00Z', 1000, 1050),
      meeting('2026-01-10T00:00:00Z', 1010, 1040),
    ]
    expect(calculateRatingGapTrend(meetings)).toBeNull()
  })

  it('picks the meeting closest to the 30-day cutoff, not the oldest one', () => {
    const meetings = [
      meeting('2026-01-01T00:00:00Z', 1000, 1075), // day 0, gap -75
      meeting('2026-01-21T00:00:00Z', 1020, 1060), // day 20, gap -40 (too recent: <30 days from day 40)
      meeting('2026-02-10T00:00:00Z', 1040, 1035), // day 40 (latest), gap +5
    ]
    const trend = calculateRatingGapTrend(meetings)
    expect(trend).toEqual({ current: 5, past: -75, daysSpan: 40 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- head-to-head-meetings`
Expected: FAIL — `src/lib/services/head-to-head-meetings.ts` does not exist yet.

- [ ] **Step 3: Implement the pure helpers**

```ts
/**
 * Rivalry Timeline — Pure Functions
 *
 * Computes the shared-match timeline data behind the "Compared to you" rivalry
 * chart and streak/trend tiles. Pure, no Supabase — the caller (getHeadToHeadComparison
 * in stats.ts) fetches the rows and passes them in, mirroring how src/lib/rating.ts
 * separates algorithm from data access.
 */

export type SharedMatchInfo = {
  matchId: string
  playedAt: string
  isDirty: boolean
  formatSlug: string
  formatName: string
  isWin: boolean
}

export type RatingHistoryRow = {
  matchId: string
  userId: string
  ratingAfter: number
}

export type Meeting = {
  matchId: string
  playedAt: string
  formatSlug: string
  formatName: string
  isWin: boolean
  yourRating: number
  opponentRating: number
}

export type RivalryStreak = { count: number; result: 'W' | 'L' }

export type RatingGapTrend = { current: number; past: number; daysSpan: number }

const MAX_MEETINGS = 12
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Build the last (up to 12) shared meetings with confirmed ratings for both
 * players, oldest first. Matches without a rating_history row for both users
 * (unconfirmed) or still is_dirty (pending recalculation) are excluded.
 */
export function buildMeetings(
  sharedMatches: SharedMatchInfo[],
  ratingRows: RatingHistoryRow[],
  currentUserId: string,
  targetUserId: string
): Meeting[] {
  const ratingsByMatch = new Map<string, { yours?: number; opponent?: number }>()
  for (const row of ratingRows) {
    const entry = ratingsByMatch.get(row.matchId) ?? {}
    if (row.userId === currentUserId) entry.yours = row.ratingAfter
    if (row.userId === targetUserId) entry.opponent = row.ratingAfter
    ratingsByMatch.set(row.matchId, entry)
  }

  const meetings: Meeting[] = []
  for (const m of sharedMatches) {
    if (m.isDirty) continue
    const ratings = ratingsByMatch.get(m.matchId)
    if (!ratings || ratings.yours === undefined || ratings.opponent === undefined) continue
    meetings.push({
      matchId: m.matchId,
      playedAt: m.playedAt,
      formatSlug: m.formatSlug,
      formatName: m.formatName,
      isWin: m.isWin,
      yourRating: ratings.yours,
      opponentRating: ratings.opponent,
    })
  }

  meetings.sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime())
  return meetings.slice(-MAX_MEETINGS)
}

/**
 * Consecutive same-outcome shared matches, counting back from the most recent.
 * Rivalry-specific: only looks at matches between these two players, unlike the
 * (currently unimplemented) cross-format "best streak" stat.
 */
export function calculateRivalryStreak(
  sharedMatches: Pick<SharedMatchInfo, 'playedAt' | 'isWin'>[]
): RivalryStreak | null {
  if (sharedMatches.length === 0) return null

  const sorted = [...sharedMatches].sort(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
  )
  const result: 'W' | 'L' = sorted[0].isWin ? 'W' : 'L'

  let count = 0
  for (const m of sorted) {
    const outcome: 'W' | 'L' = m.isWin ? 'W' : 'L'
    if (outcome !== result) break
    count++
  }

  return { count, result }
}

/**
 * Rating-gap trend derived purely from the meetings already fetched for the
 * chart. `past` is the meeting closest to (but not inside) the 30-day cutoff
 * from the latest meeting — not the single oldest meeting in the array.
 * Returns null if no meeting is old enough to compare against.
 */
export function calculateRatingGapTrend(meetings: Meeting[]): RatingGapTrend | null {
  if (meetings.length < 2) return null

  const latest = meetings[meetings.length - 1]
  const latestTime = new Date(latest.playedAt).getTime()
  const cutoff = latestTime - THIRTY_DAYS_MS

  let past: Meeting | null = null
  for (const meeting of meetings) {
    if (new Date(meeting.playedAt).getTime() <= cutoff) {
      past = meeting
    }
  }
  if (!past) return null

  const current = latest.yourRating - latest.opponentRating
  const pastGap = past.yourRating - past.opponentRating
  const daysSpan = Math.round((latestTime - new Date(past.playedAt).getTime()) / (24 * 60 * 60 * 1000))

  return { current, past: pastGap, daysSpan }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- head-to-head-meetings`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/head-to-head-meetings.ts src/lib/services/__tests__/head-to-head-meetings.test.ts
git commit -m "feat: add pure rivalry-timeline helpers for compared-to-you redesign"
```

---

### Task 2: Wire rivalry-timeline data into `getHeadToHeadComparison`

**Files:**
- Modify: `src/lib/services/stats.ts:246-575` (the entire "Head-to-Head Comparison" section)

**Interfaces:**
- Consumes: `buildMeetings`, `calculateRivalryStreak`, `calculateRatingGapTrend`, `Meeting`, `RivalryStreak`, `RatingGapTrend`, `SharedMatchInfo`, `RatingHistoryRow` from `@/lib/services/head-to-head-meetings` (Task 1)
- Produces (used by Task 3):
  ```ts
  export type HeadToHeadComparison = {
    you: { /* unchanged */ }
    opponent: { /* unchanged */ }
    asEnemies: RelationshipRecord
    asTeammates: RelationshipRecord
    byFormat: FormatVsRecord[]
    firstMetAt: string | null
    mostRecentMatchAt: string | null
    currentStreak: RivalryStreak | null
    meetings: Meeting[]
    ratingGapTrend: RatingGapTrend | null
  }
  ```
  `bestCommander` and `CommanderVsRecord` are removed from this file entirely.

No integration test is added for this task: `getHeadToHeadComparison` is a thin Supabase-query wrapper around already-tested pure logic, and the file has no existing precedent for mocking the Supabase query-builder chain (`rating.ts`'s pure functions are unit-tested; nothing that calls Supabase directly in this codebase is). Correctness of the wiring is verified manually in Task 4's browser check against real profile data.

- [ ] **Step 1: Add `played_at` and `is_dirty` to the match-details query**

In `getHeadToHeadComparison`, find the `matchDetails` query (around line 313) and add the two columns:

```ts
  const { data: matchDetails, error: matchError } = await client
    .from('matches')
    .select(`
      id,
      format_id,
      played_at,
      is_dirty,
      formats (
        slug,
        name
      )
    `)
    .in('id', sharedMatchIds)
```

Update `matchFormatLookup` to a richer per-match lookup that also carries `playedAt`/`isDirty`:

```ts
  const matchInfoLookup = new Map(
    matchDetails?.map((m) => [
      m.id,
      {
        formatSlug: (m.formats as { slug: string } | null)?.slug ?? 'unknown',
        formatName: (m.formats as { name: string } | null)?.name ?? 'Unknown',
        playedAt: m.played_at,
        isDirty: m.is_dirty,
      },
    ])
  )
```

Replace the two existing `matchFormatLookup.get(...)` call sites (in the per-participation loop) with `matchInfoLookup.get(...)` and update destructuring accordingly (`formatInfo.formatSlug`, `formatInfo.formatName` still work the same way).

- [ ] **Step 2: Fetch `rating_history` rows for both players on the shared matches**

Add this query alongside the existing `Promise.all` that fetches `matchDetails` — after it resolves (it needs `sharedMatchIds`, already available):

```ts
  const { data: ratingHistoryRows, error: ratingHistoryError } = await client
    .from('rating_history')
    .select('match_id, user_id, rating_after')
    .in('match_id', sharedMatchIds)
    .in('user_id', [currentUserId, targetUserId])

  if (ratingHistoryError) {
    return { success: false, error: ratingHistoryError.message }
  }
```

- [ ] **Step 3: Build `sharedMatchInfos` and call the pure helpers**

After the existing per-participation loop (where `asEnemies`/`asTeammates`/`formatMap` are populated), build the array the pure helpers need and compute the new fields:

```ts
  const sharedMatchInfos: SharedMatchInfo[] = (currentParticipations ?? [])
    .map((p) => {
      const info = matchInfoLookup.get(p.match_id)
      if (!info) return null
      return {
        matchId: p.match_id,
        playedAt: info.playedAt,
        isDirty: info.isDirty,
        formatSlug: info.formatSlug,
        formatName: info.formatName,
        isWin: p.is_winner,
      }
    })
    .filter((m): m is SharedMatchInfo => m !== null)

  const ratingRows: RatingHistoryRow[] = (ratingHistoryRows ?? []).map((r) => ({
    matchId: r.match_id,
    userId: r.user_id,
    ratingAfter: r.rating_after,
  }))

  const meetings = buildMeetings(sharedMatchInfos, ratingRows, currentUserId, targetUserId)
  const currentStreak = calculateRivalryStreak(sharedMatchInfos)
  const ratingGapTrend = calculateRatingGapTrend(meetings)

  const playedDates = sharedMatchInfos.map((m) => new Date(m.playedAt).getTime())
  const firstMetAt = playedDates.length > 0 ? new Date(Math.min(...playedDates)).toISOString() : null
  const mostRecentMatchAt = playedDates.length > 0 ? new Date(Math.max(...playedDates)).toISOString() : null
```

Add the import at the top of the file:

```ts
import {
  buildMeetings,
  calculateRivalryStreak,
  calculateRatingGapTrend,
} from './head-to-head-meetings'
import type {
  SharedMatchInfo,
  RatingHistoryRow,
  Meeting,
  RivalryStreak,
  RatingGapTrend,
} from './head-to-head-meetings'
```

- [ ] **Step 4: Delete the commander-tracking code and `bestCommander`**

Remove entirely:
- The `commanderMap` declaration and the "Commander tracking" block inside the per-participation loop (the `if (!isSameTeam && p.decks)` block).
- The "Best commander" computation block (the two `for`/`if` blocks building `bestCommander`) after the `byFormat` computation.
- The `decks (commander_name, color_identity)` nested select in the `currentParticipations` query — no longer needed:

```ts
  const { data: currentParticipations, error: currentPartError } = await client
    .from('match_participants')
    .select(`
      match_id,
      is_winner,
      team
    `)
    .eq('user_id', currentUserId)
    .in('match_id', targetMatchIds)
```

- Remove the `CommanderVsRecord` type and `bestCommander: CommanderVsRecord | null` field from `HeadToHeadComparison`.

- [ ] **Step 5: Update the `HeadToHeadComparison` type and the final return statement**

```ts
export type HeadToHeadComparison = {
  you: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    stats: { totalMatches: number; wins: number; losses: number; winRate: number; currentStreak: number; longestWinStreak: number }
    rating: number
  }
  opponent: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    stats: { totalMatches: number; wins: number; losses: number; winRate: number; currentStreak: number; longestWinStreak: number }
    rating: number
  }
  asEnemies: RelationshipRecord
  asTeammates: RelationshipRecord
  byFormat: FormatVsRecord[]
  firstMetAt: string | null
  mostRecentMatchAt: string | null
  currentStreak: RivalryStreak | null
  meetings: Meeting[]
  ratingGapTrend: RatingGapTrend | null
}
```

In the final `return { success: true, data: { ... } }`, replace `bestCommander,` with:

```ts
      firstMetAt,
      mostRecentMatchAt,
      currentStreak,
      meetings,
      ratingGapTrend,
```

- [ ] **Step 6: Update `buildEmptyComparison`**

Add matching defaults (no shared matches means every new field is empty/null):

```ts
      firstMetAt: null,
      mostRecentMatchAt: null,
      currentStreak: null,
      meetings: [],
      ratingGapTrend: null,
```

Remove `bestCommander: null,` from this function's return.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in `src/lib/services/stats.ts`. (Task 3 will still show errors in `player-comparison-card.tsx` until it's updated — that's expected at this point.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/stats.ts
git commit -m "feat: compute rivalry meetings, streak, and rating-gap trend in getHeadToHeadComparison"
```

---

### Task 3: Update `PlayerComparisonCard` types and remove superseded UI

**Files:**
- Modify: `src/components/features/player-comparison-card.tsx`

**Interfaces:**
- Consumes: `HeadToHeadComparison` shape from Task 2 (duplicated locally as `ComparisonData`, matching this file's existing convention of not importing service types directly)
- Produces (used by Tasks 4-6): the `ComparisonData` type below, and the file keeps exporting `RelationshipRecord`, `FormatVsRecord` (unchanged) plus the three new types.

- [ ] **Step 1: Replace the type block at the top of the file**

Replace everything from `type CommanderVsRecord` through the `ComparisonData` type definition with:

```ts
type RivalryStreak = { count: number; result: "W" | "L" };

type RatingGapTrend = { current: number; past: number; daysSpan: number };

type Meeting = {
  matchId: string;
  playedAt: string;
  formatSlug: string;
  formatName: string;
  isWin: boolean;
  yourRating: number;
  opponentRating: number;
};

type ComparisonData = {
  you: ProfileSummary & { stats: PlayerStats; rating: number };
  opponent: ProfileSummary & { stats: PlayerStats; rating: number };
  asEnemies: RelationshipRecord;
  asTeammates: RelationshipRecord;
  byFormat: FormatVsRecord[];
  firstMetAt: string | null;
  mostRecentMatchAt: string | null;
  currentStreak: RivalryStreak | null;
  meetings: Meeting[];
  ratingGapTrend: RatingGapTrend | null;
};
```

- [ ] **Step 2: Delete the now-unused `BestCommanderCard` and `FormatVsRow` components**

Remove the `BestCommanderCard` function and its `BestCommanderCardProps` type entirely (superseded — dropped per spec). Remove the `FormatVsRow` function and `FormatVsRowProps` type entirely (superseded by `FormatBeatChips`, built in Task 5).

- [ ] **Step 3: Update the type export list at the bottom of the file**

```ts
export type {
  ComparisonData,
  RelationshipRecord,
  FormatVsRecord,
  RivalryStreak,
  RatingGapTrend,
  Meeting,
};
```

- [ ] **Step 4: Verify the file still parses (it will show unused-variable/prop errors until Tasks 4-7 finish — that's expected)**

Run: `npx tsc --noEmit`
Expected: errors only about `PlayerComparisonCard`'s body still referencing `bestCommander` and the old layout — confirms the type/export changes themselves are syntactically correct. Do not fix the body yet; that's Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player-comparison-card.tsx
git commit -m "refactor: update ComparisonData shape, drop best-commander and format-bar types"
```

---

### Task 4: Build `RivalryMeetingsChart`

**Files:**
- Create: `src/components/features/rivalry-meetings-chart.tsx`

**Interfaces:**
- Consumes: `Meeting[]` (shape from Task 1/3)
- Produces (used by Task 7): `RivalryMeetingsChart` component

```ts
type RivalryMeetingsChartProps = {
  meetings: Meeting[];
  youLabel: string;
  opponentLabel: string;
  height?: number;
};
```

- [ ] **Step 1: Implement the component**

```tsx
"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Meeting = {
  matchId: string;
  playedAt: string;
  formatSlug: string;
  formatName: string;
  isWin: boolean;
  yourRating: number;
  opponentRating: number;
};

type RivalryMeetingsChartProps = {
  meetings: Meeting[];
  youLabel: string;
  opponentLabel: string;
  height?: number;
};

/**
 * Line chart of both players' ratings across their shared match history.
 * One dot per meeting, colored by the current user's outcome that match.
 */
export function RivalryMeetingsChart({
  meetings,
  youLabel,
  opponentLabel,
  height = 190,
}: RivalryMeetingsChartProps) {
  const chartData = meetings.map((m, index) => ({
    index,
    date: new Date(m.playedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    you: m.yourRating,
    opponent: m.opponentRating,
    isWin: m.isWin,
    formatName: m.formatName,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#17171c" vertical={false} />
        <XAxis
          dataKey="date"
          axisLine={{ stroke: "#222228" }}
          tickLine={{ stroke: "#222228" }}
          tick={{ fill: "#8b909c", fontSize: 10 }}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8b909c", fontSize: 10 }}
          width={40}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as (typeof chartData)[number];
            return (
              <div className="bg-card border border-card-border rounded-lg p-2 shadow-lg">
                <p className="text-xs text-text-2">{point.date} · {point.formatName}</p>
                <p className="text-sm font-display font-bold text-accent">
                  {youLabel}: {point.you}
                </p>
                <p className="text-sm font-display font-bold text-gold">
                  {opponentLabel}: {point.opponent}
                </p>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="you"
          stroke="#aa28d8"
          strokeWidth={2.5}
          dot={(props) => {
            const { cx, cy, payload, index } = props;
            const color = payload.isWin ? "#44c070" : "#e05555";
            return (
              <circle
                key={`you-dot-${index}`}
                cx={cx}
                cy={cy}
                r={4}
                fill={color}
                stroke={color}
              />
            );
          }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="opponent"
          stroke="#d4a843"
          strokeWidth={2.5}
          strokeOpacity={0.85}
          dot={false}
          activeDot={{ r: 5, fill: "#d4a843" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type { RivalryMeetingsChartProps };
```

- [ ] **Step 2: Manual smoke check**

There's no snapshot/unit test for this presentational chart (consistent with `rating-history-chart.tsx`, which also has no dedicated test file). It gets exercised visually in Task 7's browser check. For now just confirm it compiles:

Run: `npx tsc --noEmit`
Expected: no errors in `src/components/features/rivalry-meetings-chart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/rivalry-meetings-chart.tsx
git commit -m "feat: add RivalryMeetingsChart component"
```

---

### Task 5: Assemble the redesigned `PlayerComparisonCard`

**Files:**
- Modify: `src/components/features/player-comparison-card.tsx`

**Interfaces:**
- Consumes: `ComparisonData` (Task 3), `RivalryMeetingsChart` (Task 4), existing `Card`/`CardHeader`/`CardTitle`/`CardContent` (`@/components/ui/card`), `Avatar` and `ColorIdentity` (`@/components/ui`), `cn` (`@/lib/utils`)
- Produces: the finished `PlayerComparisonCard` default layout described in the spec (§1-§5)

- [ ] **Step 1: Replace the main `PlayerComparisonCard` function body**

```tsx
export function PlayerComparisonCard({
  data,
  className,
}: PlayerComparisonCardProps) {
  const { you, opponent, asEnemies, asTeammates, byFormat, currentStreak, meetings, ratingGapTrend } = data;

  const totalMatchesTogether = asEnemies.matchesPlayed + asTeammates.matchesPlayed;
  const chartUnlocked = totalMatchesTogether >= 3;

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Identity header */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="flex items-center gap-3 p-4 sm:p-5 bg-gradient-to-b from-accent-dim to-transparent border-b sm:border-b-0 sm:border-r border-card-border">
          <Avatar src={you.avatarUrl} fallback={you.displayName || you.username} size="md" className="ring-2 ring-accent" />
          <div>
            <p className="font-display text-lg font-bold text-text-1">{you.displayName || "You"}</p>
            <p className="text-xs text-text-2 font-mono">@{you.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 sm:p-5 justify-start sm:justify-end bg-gradient-to-b from-gold-subtle to-transparent">
          <div className="sm:text-right sm:order-1">
            <p className="font-display text-lg font-bold text-text-1">{opponent.displayName || opponent.username}</p>
            <p className="text-xs text-text-2 font-mono">@{opponent.username}</p>
          </div>
          <Avatar src={opponent.avatarUrl} fallback={opponent.displayName || opponent.username} size="md" className="ring-2 ring-gold sm:order-2" />
        </div>
      </div>

      <CardContent className="space-y-6 pt-5">
        <MirroredStatBars you={you} opponent={opponent} />

        {chartUnlocked ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-label text-text-2">Rating Gap · Last {meetings.length} Meetings</h4>
              <span className="text-mono-xs text-text-2">
                <span className="text-accent">■</span> {you.username} &nbsp;
                <span className="text-gold">■</span> {opponent.username}
              </span>
            </div>
            <RivalryMeetingsChart meetings={meetings} youLabel={you.username} opponentLabel={opponent.username} />
            <RivalryStatTiles
              asEnemies={asEnemies}
              asTeammates={asTeammates}
              currentStreak={currentStreak}
              ratingGapTrend={ratingGapTrend}
            />
          </div>
        ) : (
          <SparseRivalryUnlock
            matchesTogether={totalMatchesTogether}
            meetings={meetings}
            opponentUsername={opponent.username}
          />
        )}

        {byFormat.length > 0 && (
          <div>
            <h4 className="text-label text-text-2 mb-3">Where You Beat Them</h4>
            <FormatBeatChips byFormat={byFormat} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add the `MirroredStatBars` subcomponent**

```tsx
type MirroredStatBarsProps = {
  you: { stats: PlayerStats; rating: number };
  opponent: { stats: PlayerStats; rating: number };
};

function MirroredStatBars({ you, opponent }: MirroredStatBarsProps) {
  const rows: { label: string; you: number; opponent: number; format?: (n: number) => string }[] = [
    { label: "Rating", you: you.rating, opponent: opponent.rating },
    { label: "Win Rate", you: you.stats.winRate, opponent: opponent.stats.winRate, format: (n) => `${n}%` },
    { label: "Matches", you: you.stats.totalMatches, opponent: opponent.stats.totalMatches },
  ];

  const maxByRow = rows.map((r) => Math.max(r.you, r.opponent, 1));

  return (
    <div className="space-y-3">
      {rows.map((row, i) => {
        const format = row.format ?? ((n: number) => n.toLocaleString());
        const max = maxByRow[i];
        return (
          <div key={row.label} className="grid grid-cols-[1fr_110px_1fr] items-center gap-3">
            <div className="flex items-center justify-end gap-3">
              <span className="font-display text-xl font-bold text-text-1">{format(row.you)}</span>
              <div className="h-2 w-full max-w-[140px] bg-bg-overlay rounded-sm flex justify-end overflow-hidden">
                <div className="h-2 bg-accent rounded-sm" style={{ width: `${(row.you / max) * 100}%` }} />
              </div>
            </div>
            <span className="text-label text-text-2 text-center">{row.label}</span>
            <div className="flex items-center gap-3">
              <div className="h-2 w-full max-w-[140px] bg-bg-overlay rounded-sm overflow-hidden">
                <div className="h-2 bg-gold rounded-sm" style={{ width: `${(row.opponent / max) * 100}%` }} />
              </div>
              <span className="font-display text-xl font-bold text-text-1">{format(row.opponent)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Add the `RivalryStatTiles` subcomponent** (reusing the existing `RelationshipCard` for the first two tiles, adding streak and gap tiles)

```tsx
type RivalryStatTilesProps = {
  asEnemies: RelationshipRecord;
  asTeammates: RelationshipRecord;
  currentStreak: RivalryStreak | null;
  ratingGapTrend: RatingGapTrend | null;
};

function RivalryStatTiles({ asEnemies, asTeammates, currentStreak, ratingGapTrend }: RivalryStatTilesProps) {
  const tileCount = 2 + (currentStreak ? 1 : 0) + (ratingGapTrend ? 1 : 0);

  return (
    <div className={cn("grid gap-3", tileCount === 4 ? "grid-cols-2 sm:grid-cols-4" : tileCount === 3 ? "grid-cols-3" : "grid-cols-2")}>
      <RelationshipCard title="As Enemies" icon={<Swords className="w-5 h-5" />} record={asEnemies} />
      <RelationshipCard title="As Teammates" icon={<Handshake className="w-5 h-5" />} record={asTeammates} />
      {currentStreak && (
        <div className="bg-surface rounded-lg p-4">
          <span className="text-label text-text-2 block mb-2">Current Streak</span>
          <span className={cn("font-display text-2xl font-bold", currentStreak.result === "W" ? "text-win" : "text-loss")}>
            {currentStreak.result}{currentStreak.count}
          </span>
        </div>
      )}
      {ratingGapTrend && (
        <div className="bg-surface rounded-lg p-4">
          <span className="text-label text-text-2 block mb-2">Gap Closing</span>
          <span className="font-display text-2xl font-bold text-text-1">{ratingGapTrend.current >= 0 ? "+" : ""}{ratingGapTrend.current}</span>
          <p className="text-xs text-win mt-1">
            {Math.abs(ratingGapTrend.current - ratingGapTrend.past)} in {ratingGapTrend.daysSpan} days
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add the `FormatBeatChips` subcomponent**

```tsx
type FormatBeatChipsProps = {
  byFormat: FormatVsRecord[];
};

function FormatBeatChips({ byFormat }: FormatBeatChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {byFormat.map((format) => {
        const style =
          format.winRate > 50
            ? "border-win-ring bg-win-subtle text-win"
            : format.winRate < 50
            ? "border-loss-ring bg-loss-subtle text-loss"
            : "border-card-border bg-card-raised text-text-2";
        return (
          <div key={format.formatSlug} className={cn("flex items-baseline gap-2 rounded-md border px-3.5 py-2", style)}>
            <span className="font-display font-semibold text-sm text-text-1">{format.formatName}</span>
            <span className="text-mono-xs">
              {format.winRate}% · {format.wins}W {format.losses}L
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Add the `SparseRivalryUnlock` subcomponent**

```tsx
type SparseRivalryUnlockProps = {
  matchesTogether: number;
  meetings: Meeting[];
  opponentUsername: string;
};

function SparseRivalryUnlock({ matchesTogether, meetings, opponentUsername }: SparseRivalryUnlockProps) {
  const lastMeeting = meetings[meetings.length - 1];

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 border border-dashed border-card-border rounded-lg bg-bg-raised flex flex-col items-center justify-center gap-3 min-h-[140px] p-6">
        <p className="font-display text-base font-semibold text-text-2">Rivalry chart unlocks at 3 matches</p>
        <div className="flex items-center gap-2">
          <div className="w-28 h-1.5 rounded-full bg-bg-overlay overflow-hidden">
            <div className="h-1.5 bg-accent rounded-full" style={{ width: `${(matchesTogether / 3) * 100}%` }} />
          </div>
          <span className="text-mono-xs text-text-3">{matchesTogether} / 3</span>
        </div>
      </div>
      {lastMeeting && (
        <div className="w-full sm:w-72 space-y-3">
          <h5 className="text-label text-text-2">
            {matchesTogether === 1 ? "Your One Meeting" : "Your Meetings So Far"}
          </h5>
          <div className="border border-card-border rounded-lg bg-card-raised p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-text-1">
                {lastMeeting.formatName} · {new Date(lastMeeting.playedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span className={cn("text-xs font-bold rounded px-2 py-0.5 border", lastMeeting.isWin ? "text-win bg-win-subtle border-win-ring" : "text-loss bg-loss-subtle border-loss-ring")}>
                {lastMeeting.isWin ? "WON" : "LOST"}
              </span>
            </div>
            <p className="text-mono-xs text-text-2">
              vs {opponentUsername} · {lastMeeting.opponentRating}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. If `PlayerStats` or `RelationshipRecord`/`FormatVsRecord` imports are missing, add them (`PlayerStats` from `@/types`, the other two are already declared earlier in this file).

- [ ] **Step 7: Commit**

```bash
git add src/components/features/player-comparison-card.tsx
git commit -m "feat: assemble redesigned PlayerComparisonCard (1b bars + 1c rivalry chart/chips)"
```

---

### Task 6: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: all tests pass, including the new `head-to-head-meetings.test.ts` suite.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: server starts on port 3001 without errors.

- [ ] **Step 3: View a player profile with shared match history**

Navigate to `/player/<username>` for a profile that shares ≥ 3 matches with the logged-in test user (seed data or an existing account — check `supabase/seeds/` if none exists locally). Confirm:
- Identity header shows both avatars with correct accent/gold rings
- Mirrored bars show Rating/Win Rate/Matches (no Best Streak row)
- Rivalry chart renders with dots colored by win/loss, tooltip shows both ratings
- Stat tiles show As Enemies/As Teammates/Current Streak, and Gap Closing only when a ≥30-day-old meeting exists
- Format chips render with correct win/loss/neutral coloring
- No "Best Commander" section appears anywhere

- [ ] **Step 4: View a profile with exactly 1-2 shared matches**

Confirm the sparse unlock card renders instead of the chart, with the correct `X / 3` progress and the single/latest-meeting detail card, and no CTA button is present.

- [ ] **Step 5: Check responsive layout**

Resize the browser to ~400px width. Confirm the identity header and mirrored bars stack vertically without horizontal scrolling, and format chips wrap.

- [ ] **Step 6: Report results**

If everything in Steps 3-5 checks out, the feature is verified end-to-end. If anything looks wrong, fix it in the relevant task's file and re-run Steps 1-5 before considering the plan complete.

---

## Self-Review Notes

- **Spec coverage:** §1 (header) → Task 5 Step 1; §2 (bars, Best Streak dropped) → Task 5 Step 2; §3 (chart + tiles, no time tabs) → Tasks 4 + 5 Step 3; §4 (format chips) → Task 5 Step 4; §5 (sparse state, no CTA) → Task 5 Step 5; data layer (`meetings`, `currentStreak`, `ratingGapTrend`, `firstMetAt`/`mostRecentMatchAt`) → Tasks 1-2; Best Commander removal → Task 2 Step 4 + Task 3 Step 2. All spec sections are covered.
- **Type consistency:** `Meeting`, `RivalryStreak`, `RatingGapTrend` are defined once in Task 1 (`head-to-head-meetings.ts`) and duplicated verbatim (matching this codebase's existing service/component type-duplication convention) in Task 3 for `player-comparison-card.tsx`; field names (`yourRating`, `opponentRating`, `count`, `result`, `current`, `past`, `daysSpan`) are used identically across Tasks 1, 2, 4, and 5.
- **No placeholders:** every step above has literal code, not descriptions of code.
