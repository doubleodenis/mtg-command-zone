# Compared To You — Redesign Spec

**Branch:** `compared-to-you-redesign`
**Status:** Design approved, ready for implementation planning
**Source mockup:** claude.ai/design project "Elo tracker profile comparison" — `Compared To You.dc.html`

## Background

The player profile page (`src/app/player/[username]/page.tsx`) shows a head-to-head
comparison card when viewing another user's profile and you share at least one match
with them. Today this is `PlayerComparisonCard`
(`src/components/features/player-comparison-card.tsx`), fed by
`getHeadToHeadComparison` in `src/lib/services/stats.ts`. It shows enemies/teammates
win-rate tiles, a format breakdown, and a "best commander vs opponent" callout.

A design exploration produced three alternative directions for this section — 1a
"Fight Card", 1b "Tale of the Tape", 1c "Rivalry Arc" — each shown in a "rich" state
(12 shared matches) and a "sparse" state (1 shared match). This spec defines a
composite of 1b and 1c, chosen over shipping any single direction wholesale.

`support.js`, imported by the mockup, is the generic dc-canvas rendering runtime used
to preview the design file — it is not application logic and nothing from it is
ported.

The mockup's hardcoded colors and fonts (`#aa28d8`, `#d4a843`, `#44c070`, `#e05555`,
Chakra Petch / Barlow / JetBrains Mono) are not new — they are the exact values
already defined as `--color-accent`, `--color-gold`, `--color-win`, `--color-loss`,
`--font-display`, `--font-body`, `--font-data` in
`src/app/_design-system/theme.css`. This is a translation of an existing visual
language into a new layout, not a new design system.

## Chosen Direction

Keep 1b's identity header and mirrored stat bars. Replace 1b's "when you meet" tiles
and "format split" bars with 1c's rivalry chart and "where you beat them" chips.

Component to rewrite: `PlayerComparisonCard`. The exported name and props shape
(`{ data, className }`) stay the same so `page.tsx` needs no changes beyond whatever
new fields `HeadToHeadComparison` gains. Internals split into:

- `MirroredStatBars` — the 1b bars section
- `RivalryMeetingsChart` — the 1c line chart, built with Recharts following the
  existing pattern in `src/components/features/rating-history-chart.tsx`
- `FormatBeatChips` — the 1c format chip row
- `SparseRivalryUnlock` — the sub-3-matches replacement for the chart block

### 1. Identity header (from 1b)

Two mirrored panels: avatar + display name + `@username`, left panel tinted
`accent` (you), right panel tinted `gold` (opponent). Uses the existing `Avatar`
component with a colored ring (`ring-accent` / `ring-gold`) via `className`.
Always rendered, at any match count ≥ 1 (no separate sparse treatment needed here —
the mockup's "sparse" header differs only cosmetically).

### 2. Mirrored stat bars (from 1b, trimmed)

Three rows, each a pair of opposing horizontal bars meeting at a center label:

- **Rating** — each player's current rating (same average-across-formats value
  already computed in `getHeadToHeadComparison` as `you.rating` / `opponent.rating`)
- **Win Rate** — each player's overall win rate (`you.stats.winRate` /
  `opponent.stats.winRate`)
- **Matches** — each player's total matches played (`you.stats.totalMatches` /
  `opponent.stats.totalMatches`)

**Best Streak is dropped.** It doesn't account for different formats having
different streak dynamics, and the underlying "longest win streak" stat is a known
gap in the codebase already — hardcoded to `0` in `src/lib/supabase/ratings.ts:166-167`
and never actually computed from match history. Out of scope here; a real fix would
need to decide whether streaks are per-format or cross-format, which is a separate
product question.

Always rendered at any match count, at any width — bars stack vertically (label
above, full-width bar) below `md` instead of mirroring left/right.

### 3. Rivalry chart block (from 1c, replaces 1b's "when you meet" tiles)

Shown only when `matchesTogether >= 3` (see §5 for the sparse case below that
threshold).

- Recharts `LineChart` (not hand-drawn SVG, per existing chart convention) with two
  `Line`s — you (`accent`) and opponent (`gold`) — plotted against `meetings[]`
  (see §6). Each point gets a dot colored `win`/`loss` by your outcome in that
  match. X-axis oldest → newest, capped at the most recent 12 meetings.
- No time-range tabs. 1c's ALL TIME/90D/30D tabs are dropped for v1 — every metric
  in this section is always all-time. If a real time filter is wanted later, it's
  its own follow-up (every metric here would need a date-bounded variant).
- Below the chart, a row of stat tiles:
  - **As Enemies** — win rate % + W-L (`asEnemies`)
  - **As Teammates** — win rate % + W-L (`asTeammates`)
  - **Current Streak** — rivalry-specific: consecutive shared matches with the same
    outcome, counting back from the most recent (e.g. "W2"). This is **not** the
    dropped cross-format "best streak" — it only ever looks at matches between these
    two specific players, so format-mixing isn't a concern the same way.
  - **Gap Closing** — rendered only when a trend is computable (see §6). Otherwise
    this tile is omitted (3-tile row instead of 4), not faked with a placeholder.

### 4. Format chips (from 1c, replaces 1b's format-share bars)

One chip per format with shared match history (existing `byFormat` data, unchanged
semantics — enemies-only win rate per format). Style rule:

- win rate > 50% → highlighted win style (`win` border/background tint)
- win rate < 50% → highlighted loss style (`loss` border/background tint)
- win rate = 50% → neutral/muted style (default card border)

Formats with zero shared matches don't get a chip (matches current `byFormat`
filtering — sidelined formats like 2v2/3v3 still show if historical shared matches
exist there, same as today).

### 5. Sparse state (1–2 shared matches)

Header and bars (§1, §2) render identically — they're meaningful even at one match.
The chart block (§3) is replaced by:

- A "Rivalry chart unlocks at 3 matches" card with a progress bar (`matchesTogether`/3)
- A single-meeting detail card: format, date, W/L badge, commander played, rating
  delta for that match (`rating_before → rating_after`, from `rating_history`)

No CTA button. 1a/1c's "Challenge player1" / "Set up a rematch" buttons are dropped
entirely — there's no challenge/rematch flow in the codebase to link to, and adding
one is out of scope for this redesign.

Format chips (§4) still render for whatever formats exist, even with just one.

### Scope change: Best Commander callout removed

The current `PlayerComparisonCard` has a "Best Commander vs opponent" section. It
isn't part of any of 1a/1b/1c and is dropped in this redesign — confirmed as an
acceptable scope reduction, not an oversight.

## Data Layer Changes

`HeadToHeadComparison` (`src/lib/services/stats.ts`) gains:

```ts
type Meeting = {
  matchId: string
  playedAt: string        // matches.played_at
  formatSlug: string
  formatName: string
  isWin: boolean           // your outcome in this match
  yourRating: number        // your rating_after for this match
  opponentRating: number    // opponent's rating_after for this match
}

type RatingGapTrend = {
  current: number   // yourRating - opponentRating at the most recent meeting
  past: number       // yourRating - opponentRating at the oldest meeting ≥30 days back
  daysSpan: number   // actual days between those two meetings
}

// added to HeadToHeadComparison:
firstMetAt: string | null        // min(matches.played_at) across shared matches
mostRecentMatchAt: string | null // max(matches.played_at) across shared matches
currentStreak: { count: number; result: 'W' | 'L' } | null
meetings: Meeting[]               // up to last 12, oldest → newest, see below
ratingGapTrend: RatingGapTrend | null
```

`meetings[]` construction:

1. Start from the existing shared-match set (`sharedMatchIds`).
2. Join `rating_history` for both `currentUserId` and `targetUserId` on `match_id`.
3. **Only include matches where both players have a `rating_history` row.**
   Unconfirmed or not-yet-rated matches (no row yet) and matches still `is_dirty`
   pending recalculation are excluded — a meeting on the chart should reflect a
   settled rating, not one about to change.
4. Sort by `matches.played_at` ascending, take the last 12.

`currentStreak` uses `matches.played_at` + your `is_winner` per shared match only
(no rating_history needed) — walk backward from the most recent shared match while
the outcome stays constant.

`ratingGapTrend` is derived **only from `meetings[]`**, not a fresh global-history
query:
- `current` = gap at the last (most recent) entry in `meetings`
- `past` = gap at the *most recent* entry in `meetings` that is still ≥30 days
  older than the latest one — i.e. the entry closest to the 30-day mark, not the
  single oldest entry in the array. With meetings at day 0, day 20, and day 40
  (latest), the 30-day cutoff from day 40 is day 10; day 20 is too recent, so
  `past` is day 0 — not because it's the oldest, but because it's the newest entry
  that still clears the cutoff.
- If no entry in `meetings` is old enough (e.g., a fast-moving rivalry with all 12
  meetings inside 30 days), `ratingGapTrend` is `null` and the Gap Closing tile is
  omitted. This is deliberately scoped to the shared-meeting timeline already being
  fetched, rather than reconstructing a global per-user rating snapshot as of 30 days
  ago (which would need to account for each user's own multi-format rating average
  at an arbitrary past timestamp — meaningfully more work for a secondary metric).

## Non-Goals

- No functional time-range filter (ALL TIME/90D/30D) — static, all-time only.
- No streak fix for the existing dashboard "Best Streak" stat card — that gap
  remains, tracked separately.
- No challenge/rematch feature or CTA.
- No changes to `getUserStats`, `DashboardStatCard`, or any other consumer of the
  stats service beyond `HeadToHeadComparison` and `PlayerComparisonCard`.

## Testing

- Unit tests for the new `getHeadToHeadComparison` fields (meetings construction,
  streak calculation, rating-gap-trend edge cases including the <30-days case) —
  this logic lives in `src/lib/services/stats.ts` and should follow the existing
  test conventions for that file.
- Component-level checks that `PlayerComparisonCard` renders the sparse variant
  below 3 matches and the full chart at/above it, and that the Gap Closing tile is
  correctly omitted when `ratingGapTrend` is `null`.
