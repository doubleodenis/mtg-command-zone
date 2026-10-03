# Plan A — Display Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three display bugs from the 2026-09-30 playtest: Top Commanders
ranks a 0% WR commander #1 (B3), "Compared to You" shows a confusing "0 / 3"
(B4), and new notifications never reach the bell dropdown and get marked seen
without being shown (F6).

**Architecture:**
- **B3:** move the ranking into a pure, unit-tested `rankCommanders()` in
  `src/lib/services/top-commanders.ts`, using the same split as
  `head-to-head-meetings.ts`. `getTopCommanders()` becomes one query over
  confirmed participations that feeds it.
- **B4:** copy plus a "waiting on confirmation" count derived from data the
  card already has.
- **F6:** one migration so `mark_notifications_seen` accepts IDs. The realtime
  hook signals the dropdown through a tiny window event, and the dropdown
  refetches its list. The dropdown and `/notifications` mark seen only what
  they rendered. The invite text names the collection.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Supabase
(PostgREST + Postgres 17 locally), Vitest (`node` project for `src/lib/**`,
`jsdom` project for `src/components/**`) + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-30-playtest-feedback-design.md`
(sections B3, B4, F6)

## Global Constraints

- TypeScript strict: no `any`. `src/types/database.types.ts` is generated, so
  don't hand-edit it. New RPC arguments are called through a typed shim, as
  `src/lib/supabase/ratings.ts` does for `mark_ratings_applied`.
- Top Commanders: rank by **win rate** with a minimum of **3 games**
  (`MIN_GAMES_TO_RANK = 3`), tiebreak by games. Count **confirmed**
  participations only, and in collection scope only `approval_status =
  'approved'`. Group by **commander**, not deck. Commanders below the
  threshold are **shown in an unranked state**, not hidden.
- New SQL functions must end with explicit `REVOKE ALL … FROM PUBLIC, anon,
  authenticated` and `GRANT EXECUTE … TO authenticated, service_role`.
  Migration 027 only ran once, and a new function gets default grants
  (PUBLIC + anon).
- Match the style of the file you edit (the `src/lib/services` files use
  single quotes and no semicolons; the components use double quotes and
  semicolons).

## Review Focus

1. **A commander played only with the "Unknown Deck" sentinel** must not
   appear at all, not even unranked. Test in Task 1.
2. **Win-rate ties** need a deterministic order (more games first, then name),
   so the list doesn't reshuffle between reloads. Test in Task 1.
3. **A collection with zero approved matches** returns an empty list, and the
   stat card shows "Needs a commander with 3+ games" rather than crashing or showing an unqualified
   commander as "Top Commander". Covered by the Task 2 code path and checked
   in the browser.
4. **A refetch that fails** (network blip) must leave the current dropdown
   list in place, not wipe it. Test in Task 5.
5. **More unseen notifications than the dropdown shows (>10)**: the ones not
   displayed stay unseen, and the badge shows the remainder. The
   `/notifications` page marks what it renders as seen, so the badge can
   clear. Both are tested in Task 5.

---

### Task 1: Pure commander ranking

**Files:**
- Create: `src/lib/services/top-commanders.ts`
- Test: `src/lib/services/__tests__/top-commanders.test.ts`

**Interfaces:**
- Produces:
  - `MIN_GAMES_TO_RANK = 3`
  - `type CommanderParticipationRow = { isWinner: boolean; commanderName: string; partnerName: string | null; colorIdentity: ColorIdentity; bracket: Bracket; deckName: string | null }`
  - `type CommanderStats = { id: string; commanderName: string; partnerName: string | null; colorIdentity: ColorIdentity; bracket: Bracket | null; stats: DeckStats; qualified: boolean }`
  - `rankCommanders(rows: CommanderParticipationRow[], options?: { minGames?: number; limit?: number }): CommanderStats[]`

- [ ] **Step 1: Write the failing tests**

`src/lib/services/__tests__/top-commanders.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { rankCommanders, MIN_GAMES_TO_RANK, TOP_COMMANDER_EMPTY_LABEL } from '@/lib/services/top-commanders'
import type { CommanderParticipationRow } from '@/lib/services/top-commanders'

function play(
  commanderName: string,
  isWinner: boolean,
  overrides: Partial<CommanderParticipationRow> = {}
): CommanderParticipationRow {
  return {
    isWinner,
    commanderName,
    partnerName: null,
    colorIdentity: ['B'],
    bracket: 2,
    deckName: `${commanderName} deck`,
    ...overrides,
  }
}

function plays(commanderName: string, wins: number, losses: number, overrides: Partial<CommanderParticipationRow> = {}) {
  return [
    ...Array.from({ length: wins }, () => play(commanderName, true, overrides)),
    ...Array.from({ length: losses }, () => play(commanderName, false, overrides)),
  ]
}

describe('rankCommanders', () => {
  it('ranks qualified commanders by win rate, not games played', () => {
    const result = rankCommanders([...plays('Loser', 0, 5), ...plays('Winner', 2, 1)])
    expect(result.map((c) => c.commanderName)).toEqual(['Winner', 'Loser'])
    expect(result[0].stats).toEqual({ gamesPlayed: 3, wins: 2, losses: 1, winRate: 67 })
  })

  it('puts commanders under the minimum games after every qualified one', () => {
    const result = rankCommanders([...plays('Undefeated', 2, 0), ...plays('Average', 1, 2)])
    expect(result.map((c) => [c.commanderName, c.qualified])).toEqual([
      ['Average', true],
      ['Undefeated', false],
    ])
  })

  it('orders unqualified commanders by games played first', () => {
    const result = rankCommanders([...plays('OneGameWin', 1, 0), ...plays('TwoGamesNoWin', 0, 2)])
    expect(result.map((c) => c.commanderName)).toEqual(['TwoGamesNoWin', 'OneGameWin'])
  })

  it('breaks win-rate ties by games played, then by name', () => {
    const result = rankCommanders([
      ...plays('Zed', 2, 2),
      ...plays('Abe', 2, 2),
      ...plays('Big', 3, 3),
    ])
    expect(result.map((c) => c.commanderName)).toEqual(['Big', 'Abe', 'Zed'])
  })

  it('groups every deck of the same commander, including partners in either order', () => {
    const result = rankCommanders([
      play('Thrasios', true, { partnerName: 'Tymna', deckName: 'Deck A' }),
      play('Tymna', false, { partnerName: 'Thrasios', deckName: 'Deck B' }),
      play('Thrasios', true, { partnerName: 'Tymna', deckName: 'Deck C' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].stats.gamesPlayed).toBe(3)
    expect(result[0].qualified).toBe(true)
  })

  it('ignores participations with the Unknown Deck placeholder', () => {
    const result = rankCommanders([
      ...plays('Ghost', 3, 0, { deckName: 'Unknown Deck' }),
      ...plays('Real', 1, 2),
    ])
    expect(result.map((c) => c.commanderName)).toEqual(['Real'])
  })

  it('reports a bracket only when every play shared it', () => {
    const result = rankCommanders([
      play('Mixed', true, { bracket: 2 }),
      play('Mixed', true, { bracket: 4 }),
      play('Mixed', true, { bracket: 2 }),
      ...plays('Uniform', 1, 2, { bracket: 3 }),
    ])
    expect(result.find((c) => c.commanderName === 'Mixed')?.bracket).toBeNull()
    expect(result.find((c) => c.commanderName === 'Uniform')?.bracket).toBe(3)
  })

  it('applies the limit after ranking', () => {
    const result = rankCommanders(
      [...plays('Third', 1, 2), ...plays('First', 3, 0), ...plays('Second', 2, 1)],
      { limit: 2 }
    )
    expect(result.map((c) => c.commanderName)).toEqual(['First', 'Second'])
  })

  it('returns an empty list for no participations', () => {
    expect(rankCommanders([])).toEqual([])
  })

  it('uses a minimum of 3 games by default', () => {
    expect(MIN_GAMES_TO_RANK).toBe(3)
  })

  it('explains the empty Top Commander card with the threshold', () => {
    expect(TOP_COMMANDER_EMPTY_LABEL).toBe('Needs a commander with 3+ games')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project node src/lib/services/__tests__/top-commanders.test.ts`
Expected: FAIL. The module `@/lib/services/top-commanders` can't be resolved.

- [ ] **Step 3: Implement**

`src/lib/services/top-commanders.ts`:

```ts
/**
 * Top Commanders — Pure Functions
 *
 * Ranks commanders from confirmed match participations. Pure, no Supabase —
 * getTopCommanders in deck.ts fetches the rows and passes them in, mirroring
 * how head-to-head-meetings.ts separates logic from data access.
 */

import type { Bracket, ColorIdentity } from '@/types/common'
import { PLACEHOLDER_DECK_NAME } from '@/types/deck'
import type { DeckStats } from '@/types/deck'

export const MIN_GAMES_TO_RANK = 3

/** Shown on "Top Commander" stat cards when no commander has enough games yet. */
export const TOP_COMMANDER_EMPTY_LABEL = `Needs a commander with ${MIN_GAMES_TO_RANK}+ games`

export type CommanderParticipationRow = {
  isWinner: boolean
  commanderName: string
  partnerName: string | null
  colorIdentity: ColorIdentity
  bracket: Bracket
  deckName: string | null
}

export type CommanderStats = {
  /** Stable, order-independent key for commander + partner */
  id: string
  commanderName: string
  partnerName: string | null
  colorIdentity: ColorIdentity
  /** The shared bracket when every play used the same one; null when mixed */
  bracket: Bracket | null
  stats: DeckStats
  /** gamesPlayed >= minGames. Unqualified entries sort after all qualified ones. */
  qualified: boolean
}

type Group = {
  first: CommanderParticipationRow
  games: number
  wins: number
  brackets: Set<Bracket>
}

function commanderKey(commanderName: string, partnerName: string | null): string {
  return [commanderName, partnerName].filter((n): n is string => !!n).sort().join(' + ')
}

/**
 * Qualified commanders (>= minGames) come first, by win rate then games.
 * Unqualified ones follow, by games then win rate. Name breaks any
 * remaining tie so the order is stable between reloads.
 */
export function rankCommanders(
  rows: CommanderParticipationRow[],
  options: { minGames?: number; limit?: number } = {}
): CommanderStats[] {
  const { minGames = MIN_GAMES_TO_RANK, limit } = options

  const groups = new Map<string, Group>()
  for (const row of rows) {
    if (row.deckName === PLACEHOLDER_DECK_NAME) continue
    const key = commanderKey(row.commanderName, row.partnerName)
    const group = groups.get(key)
    if (group) {
      group.games++
      if (row.isWinner) group.wins++
      group.brackets.add(row.bracket)
    } else {
      groups.set(key, {
        first: row,
        games: 1,
        wins: row.isWinner ? 1 : 0,
        brackets: new Set([row.bracket]),
      })
    }
  }

  const ranked = Array.from(groups, ([key, g]) => {
    const entry: CommanderStats = {
      id: key,
      commanderName: g.first.commanderName,
      partnerName: g.first.partnerName,
      colorIdentity: g.first.colorIdentity,
      bracket: g.brackets.size === 1 ? Array.from(g.brackets)[0] : null,
      stats: {
        gamesPlayed: g.games,
        wins: g.wins,
        losses: g.games - g.wins,
        winRate: Math.round((g.wins / g.games) * 100),
      },
      qualified: g.games >= minGames,
    }
    return { entry, ratio: g.wins / g.games }
  })

  ranked.sort((a, b) => {
    if (a.entry.qualified !== b.entry.qualified) return a.entry.qualified ? -1 : 1
    const byRatio = b.ratio - a.ratio
    const byGames = b.entry.stats.gamesPlayed - a.entry.stats.gamesPlayed
    const primary = a.entry.qualified ? byRatio || byGames : byGames || byRatio
    return primary || a.entry.id.localeCompare(b.entry.id)
  })

  const entries = ranked.map((r) => r.entry)
  return limit === undefined ? entries : entries.slice(0, limit)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project node src/lib/services/__tests__/top-commanders.test.ts`
Expected: PASS, 11/11.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/top-commanders.ts src/lib/services/__tests__/top-commanders.test.ts
git commit -m "feat: add pure commander ranking by win rate with min games"
```

---

### Task 2: Wire Top Commanders to the new ranking

**Files:**
- Modify: `src/lib/services/deck.ts` (replace `getTopCommanders` body and its imports)
- Modify: `src/lib/services/index.ts` (export the new types/const)
- Modify: `src/components/features/top-commanders-list.tsx`
- Modify: `src/app/(main)/page.tsx` (stat card picks the first qualified; section title)
- Modify: `src/app/collections/[id]/page.tsx:90` (stat card picks the first qualified)
- Test: `src/components/features/top-commanders-list.test.tsx`

**Interfaces:**
- Consumes: `rankCommanders`, `CommanderParticipationRow`, `CommanderStats`,
  `MIN_GAMES_TO_RANK` from Task 1.
- Produces: `getTopCommanders(client, { limit?, collectionId? }): Promise<Result<CommanderStats[]>>`.
  `TopCommandersList` accepts `TopCommanderItem[]`, which both
  `CommanderStats` and `DeckWithStats` satisfy, so the player page needs no
  change.

- [ ] **Step 1: Write the failing component tests**

`src/components/features/top-commanders-list.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopCommandersList } from "./top-commanders-list";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const ranked = {
  id: "Atraxa",
  commanderName: "Atraxa",
  partnerName: null,
  colorIdentity: ["W", "U", "B", "G"] as ("W" | "U" | "B" | "R" | "G")[],
  bracket: 3 as const,
  stats: { gamesPlayed: 4, wins: 3, losses: 1, winRate: 75 },
  qualified: true,
};

describe("TopCommandersList", () => {
  it("shows rank and win rate for a qualified commander", () => {
    render(<TopCommandersList commanders={[ranked]} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/4 games • 75% WR/)).toBeInTheDocument();
  });

  it("shows an unqualified commander unranked with the games still needed", () => {
    render(
      <TopCommandersList
        commanders={[
          ranked,
          { ...ranked, id: "Edgar", commanderName: "Edgar", qualified: false, stats: { gamesPlayed: 1, wins: 1, losses: 0, winRate: 100 } },
        ]}
      />
    );
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByText(/1 game • needs 3 to rank/)).toBeInTheDocument();
    expect(screen.queryByText(/100% WR/)).not.toBeInTheDocument();
  });

  it("omits the bracket badge when a commander's bracket is mixed", () => {
    render(<TopCommandersList commanders={[{ ...ranked, bracket: null }]} />);
    expect(screen.queryByText("Upgraded")).not.toBeInTheDocument();
  });

  it("shows both names for a partner pair", () => {
    render(<TopCommandersList commanders={[{ ...ranked, commanderName: "Thrasios", partnerName: "Tymna" }]} />);
    expect(screen.getByText("Thrasios + Tymna")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project jsdom src/components/features/top-commanders-list.test.tsx`
Expected: FAIL. No "–" or "needs 3 to rank" text, the badge still renders for
`null`, and there's no partner text. The first test may pass already.

- [ ] **Step 3: Update `TopCommandersList`**

Replace `src/components/features/top-commanders-list.tsx` with:

```tsx
import Image from 'next/image'
import { ColorIdentity, BracketBadge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { buildCommanderImageUrl } from '@/lib/scryfall/api'
import { MIN_GAMES_TO_RANK } from '@/lib/services/top-commanders'
import type { Bracket, DeckWithStats } from '@/types'

/** Satisfied by both CommanderStats (grouped ranking) and DeckWithStats (player page). */
export type TopCommanderItem = Pick<DeckWithStats, 'id' | 'commanderName' | 'colorIdentity' | 'stats'> & {
  partnerName?: string | null
  bracket: Bracket | null
  /** false = under the minimum games; shown unranked after ranked entries */
  qualified?: boolean
}

type TopCommandersListProps = {
  commanders: TopCommanderItem[]
}

/**
 * Displays a ranked list of top commanders with images, color identity, and stats.
 * Commanders with too few games are listed after the ranked ones without a rank.
 */
export function TopCommandersList({ commanders }: TopCommandersListProps) {
  return (
    <div className="divide-y divide-card-border">
      {commanders.map((deck, i) => {
        const isRanked = deck.qualified !== false
        const games = deck.stats.gamesPlayed
        return (
          <div
            key={deck.id}
            className="flex items-center gap-4 px-4 py-3"
          >
            {/* Rank */}
            <span className={cn(
              "w-6 text-center font-display font-bold",
              !isRanked && "text-text-3",
              isRanked && i === 0 && "text-gold",
              isRanked && i === 1 && "text-text-2",
              isRanked && i === 2 && "text-[#cd7f32]",
              isRanked && i > 2 && "text-text-3"
            )}>
              {isRanked ? i + 1 : "–"}
            </span>

            {/* Commander card image with color identity below */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-surface">
                <Image
                  src={buildCommanderImageUrl(deck.commanderName, "art_crop")}
                  alt={deck.commanderName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <ColorIdentity colors={deck.colorIdentity} size="sm" />
            </div>

            {/* Commander Name */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-1 truncate">
                {deck.partnerName ? `${deck.commanderName} + ${deck.partnerName}` : deck.commanderName}
              </p>
              <p className="text-sm text-text-2">
                {isRanked
                  ? `${games} games • ${deck.stats.winRate}% WR`
                  : `${games} ${games === 1 ? "game" : "games"} • needs ${MIN_GAMES_TO_RANK} to rank`}
              </p>
            </div>

            {/* Bracket */}
            {deck.bracket !== null && <BracketBadge bracket={deck.bracket} />}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the component tests**

Run: `npx vitest run --project jsdom src/components/features/top-commanders-list.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 5: Rewrite `getTopCommanders`**

In `src/lib/services/deck.ts`, replace the imports block and the whole
`getTopCommanders` function (keep `GetTopCommandersOptions`) with:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type { ColorIdentity, Bracket } from '@/types/common'
import { rankCommanders } from './top-commanders'
import type { CommanderParticipationRow, CommanderStats } from './top-commanders'
```

```ts
/**
 * Get top commanders platform-wide or within a collection.
 *
 * Counts confirmed participations only (and, in a collection, only approved
 * matches), groups them by commander, and ranks by win rate with a minimum
 * games threshold — see rankCommanders.
 *
 * Note: PostgREST caps a response at its max-rows setting (1000 by default),
 * so the global scope ranks the most recent ≤1000 confirmed participations.
 * Move the aggregation into SQL if the platform outgrows that.
 */
export async function getTopCommanders(
  client: SupabaseClient<Database>,
  options: GetTopCommandersOptions = {}
): Promise<Result<CommanderStats[]>> {
  const { limit = 5, collectionId } = options

  let matchIds: string[] | null = null
  if (collectionId) {
    const { data: collectionMatches, error: collectionError } = await client
      .from('collection_matches')
      .select('match_id')
      .eq('collection_id', collectionId)
      .eq('approval_status', 'approved')

    if (collectionError) {
      return { success: false, error: collectionError.message }
    }

    matchIds = (collectionMatches ?? []).map((cm) => cm.match_id)
    if (matchIds.length === 0) {
      return { success: true, data: [] }
    }
  }

  let query = client
    .from('match_participants')
    .select(`
      is_winner,
      deck:decks!match_participants_deck_id_fkey (
        commander_name,
        partner_name,
        color_identity,
        bracket,
        deck_name
      )
    `)
    .not('confirmed_at', 'is', null)
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })

  if (matchIds) {
    query = query.in('match_id', matchIds)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const rows: CommanderParticipationRow[] = []
  for (const p of data ?? []) {
    if (!p.deck) continue
    rows.push({
      isWinner: p.is_winner,
      commanderName: p.deck.commander_name,
      partnerName: p.deck.partner_name,
      colorIdentity: (p.deck.color_identity ?? []) as ColorIdentity,
      bracket: p.deck.bracket as Bracket,
      deckName: p.deck.deck_name,
    })
  }

  return { success: true, data: rankCommanders(rows, { limit }) }
}
```

Remove the now-unused `DeckWithStats` import if lint flags it. Update the doc
comment at the top of the old function.

In `src/lib/services/index.ts`, after `export { getTopCommanders } from './deck'`:

```ts
export { rankCommanders, MIN_GAMES_TO_RANK } from './top-commanders'
export type { CommanderStats, CommanderParticipationRow } from './top-commanders'
```

- [ ] **Step 6: Make the stat cards pick a qualified commander**

`src/app/(main)/page.tsx`: find

```tsx
  const topCommander = topCommandersResult.success && topCommandersResult.data.length > 0
    ? topCommandersResult.data[0]
    : null;
```

and replace it with

```tsx
  const topCommander = topCommandersResult.success
    ? (topCommandersResult.data.find((c) => c.qualified) ?? null)
    : null;
```

In the same file, find the "Top Commander" `DashboardStatCard` and change
`sublabel={topCommander?.commanderName ?? "No data"}` to
`sublabel={topCommander?.commanderName ?? TOP_COMMANDER_EMPTY_LABEL}`, importing
`TOP_COMMANDER_EMPTY_LABEL` from `@/lib/services/top-commanders`. Users should
see why the card is empty, not "No data" (decided 2026-10-01).

In the same file, rename the logged-out section title
`<Section title="POPULAR COMMANDERS">` → `<Section title="TOP COMMANDERS">`, and
the comment above it `{/* Most Played Commanders */}` → `{/* Top Commanders */}`.

`src/app/collections/[id]/page.tsx`: replace

```tsx
  // Get top commander by win rate
  const topCommander = topCommanders.length > 0 ? topCommanders[0] : null;
```

with

```tsx
  // Highest win rate among commanders with enough games to rank
  const topCommander = topCommanders.find((c) => c.qualified) ?? null;
```

and change that card's
`sublabel={topCommander ? topCommander.commanderName : "No data"}` to
`sublabel={topCommander ? topCommander.commanderName : TOP_COMMANDER_EMPTY_LABEL}`,
importing `TOP_COMMANDER_EMPTY_LABEL` from `@/lib/services/top-commanders`.

- [ ] **Step 7: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npx eslint src/lib/services src/components/features/top-commanders-list.tsx src/components/features/top-commanders-list.test.tsx "src/app/(main)/page.tsx" "src/app/collections/[id]/page.tsx" && npx vitest run src/lib/services src/components/features/top-commanders-list.test.tsx`
Expected: no type errors and no lint errors (pre-existing warnings in other
files are fine), and the Task 1 + Task 2 tests pass.

If `p.deck` comes back typed as an array, the generated relationship isn't
one-to-one. Compare with the existing
`deck:decks!match_participants_deck_id_fkey` selects in
`src/lib/services/match.ts`, which read `p.deck.bracket` directly, and
match their handling.

- [ ] **Step 8: Verify in the browser**

`npx next build && npx next start -p 3002` (port 3001 may be the user's dev
server, so don't use it). Then:
- `/` logged out: "TOP COMMANDERS" lists ranked commanders (numbers) before
  unranked ones ("–", "needs 3 to rank").
- `/collections/<id>` for a collection with approved matches: the "Top
  Commander" stat card names a qualified commander, or "Needs a commander with 3+ games" if none has 3
  games.

Stop the server afterwards.

- [ ] **Step 9: Commit**

```bash
git add src/lib/services/deck.ts src/lib/services/index.ts src/components/features/top-commanders-list.tsx src/components/features/top-commanders-list.test.tsx "src/app/(main)/page.tsx" "src/app/collections/[id]/page.tsx"
git commit -m "fix: rank top commanders by win rate over confirmed matches"
```

---

### Task 3: "Compared to You" copy + pending hint (B4)

**Files:**
- Modify: `src/components/features/player-comparison-card.tsx`
- Test: `src/components/features/player-comparison-card.test.tsx`

**Interfaces:**
- Consumes: the existing `ComparisonData` (exported from the card file).
  Shared matches = `asEnemies.matchesPlayed + asTeammates.matchesPlayed`,
  which is already raw and unconfirmed-inclusive.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing tests**

`src/components/features/player-comparison-card.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerComparisonCard } from "./player-comparison-card";
import type { ComparisonData } from "./player-comparison-card";

vi.mock("@/components/features/rivalry-meetings-chart", () => ({ RivalryMeetingsChart: () => null }));

const stats = { totalMatches: 1, wins: 0, losses: 1, winRate: 0, currentStreak: 0, longestWinStreak: 0 };

function data(overrides: Partial<ComparisonData> = {}): ComparisonData {
  return {
    you: { id: "u1", username: "you", displayName: null, avatarUrl: null, stats, rating: 1000 },
    opponent: { id: "u2", username: "them", displayName: null, avatarUrl: null, stats, rating: 1000 },
    asEnemies: { wins: 0, losses: 1, matchesPlayed: 1, winRate: 0 },
    asTeammates: { wins: 0, losses: 0, matchesPlayed: 0, winRate: 0 },
    byFormat: [],
    firstMetAt: null,
    mostRecentMatchAt: null,
    currentStreak: null,
    meetings: [],
    ratingGapTrend: null,
    ...overrides,
  };
}

describe("PlayerComparisonCard — sparse rivalry", () => {
  it("says the chart counts confirmed matches", () => {
    render(<PlayerComparisonCard data={data()} />);
    expect(screen.getByText("Rivalry chart unlocks at 3 confirmed matches")).toBeInTheDocument();
  });

  it("explains shared matches that don't count yet", () => {
    render(<PlayerComparisonCard data={data()} />);
    expect(screen.getByText("1 shared match waiting on confirmation")).toBeInTheDocument();
  });

  it("pluralises the pending count across enemy and teammate matches", () => {
    render(
      <PlayerComparisonCard
        data={data({ asTeammates: { wins: 1, losses: 0, matchesPlayed: 1, winRate: 100 } })}
      />
    );
    expect(screen.getByText("2 shared matches waiting on confirmation")).toBeInTheDocument();
  });

  it("shows no pending hint when every shared match is confirmed", () => {
    const meeting = {
      matchId: "m1", playedAt: "2026-09-30T00:00:00Z", formatSlug: "ffa", formatName: "FFA",
      isWin: false, yourRating: 990, yourRatingBefore: 1000, opponentRating: 1010,
    };
    render(<PlayerComparisonCard data={data({ meetings: [meeting] })} />);
    expect(screen.queryByText(/waiting on confirmation/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project jsdom src/components/features/player-comparison-card.test.tsx`
Expected: the first 3 tests FAIL (old copy, no hint). The 4th may pass.

- [ ] **Step 3: Implement**

In `PlayerComparisonCard`, after `const chartUnlocked = meetings.length >= 3;`:

```tsx
  // Shared matches that exist but aren't meetings yet: not confirmed by both
  // players, or still pending recalculation.
  const pendingCount = Math.max(
    0,
    asEnemies.matchesPlayed + asTeammates.matchesPlayed - meetings.length
  );
```

Pass it through:

```tsx
          <SparseRivalryUnlock
            matchesTogether={meetings.length}
            meetings={meetings}
            pendingCount={pendingCount}
          />
```

In `SparseRivalryUnlockProps`, add `pendingCount: number;`, and destructure it in
`function SparseRivalryUnlock({ matchesTogether, meetings, pendingCount }: …)`.

Replace

```tsx
        <p className="font-display text-base font-semibold text-text-2">Rivalry chart unlocks at 3 matches</p>
```

with

```tsx
        <p className="font-display text-base font-semibold text-text-2">Rivalry chart unlocks at 3 confirmed matches</p>
```

After the progress-bar `<div className="flex items-center gap-2">…</div>` block
(the one that contains `{matchesTogether} / 3`), add:

```tsx
        {pendingCount > 0 && (
          <p className="text-xs text-text-3 text-center">
            {pendingCount} shared {pendingCount === 1 ? "match" : "matches"} waiting on confirmation
          </p>
        )}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run --project jsdom src/components/features/player-comparison-card.test.tsx && npx tsc --noEmit && npx eslint src/components/features/player-comparison-card.tsx src/components/features/player-comparison-card.test.tsx`
Expected: 4/4 PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player-comparison-card.tsx src/components/features/player-comparison-card.test.tsx
git commit -m "fix: clarify rivalry unlock counts confirmed matches"
```

---

### Task 4: `mark_notifications_seen` by ID (migration + helper)

**Files:**
- Create: `supabase/migrations/029_mark_notifications_seen_by_id.sql`
- Modify: `src/lib/supabase/notifications.ts` (`markNotificationsSeen`, ~line 140)

**Interfaces:**
- Produces: SQL `mark_notifications_seen(p_recipient_id uuid, p_notification_ids uuid[] DEFAULT NULL) → integer`.
  TS `markNotificationsSeen(client, userId, notificationIds?: string[]): Promise<Result<number>>`.
  With no IDs it keeps the old mark-all behavior.

- [ ] **Step 1: Write the failing SQL check**

Save this as `<workspace>/check-029.sql` (the plan workspace, not the repo):

```sql
\set ON_ERROR_STOP on
BEGIN;
SELECT id AS uid FROM profiles ORDER BY created_at LIMIT 1 \gset
INSERT INTO notifications (id, recipient_id, type, entity_type, entity_id, data) VALUES
  ('00000000-0000-0000-0000-0000000000a1', :'uid', 'friend_accepted', 'player', :'uid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', :'uid', 'friend_accepted', 'player', :'uid', '{}');
SELECT set_config('request.jwt.claims', json_build_object('sub', :'uid', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT 'marked=' || mark_notifications_seen(:'uid', ARRAY['00000000-0000-0000-0000-0000000000a1']::uuid[]);
RESET ROLE;
SELECT id, seen_at IS NOT NULL AS seen FROM notifications
 WHERE id IN ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2') ORDER BY id;
SELECT 'anon=' || has_function_privilege('anon', 'mark_notifications_seen(uuid, uuid[])', 'EXECUTE')
    || ' authenticated=' || has_function_privilege('authenticated', 'mark_notifications_seen(uuid, uuid[])', 'EXECUTE');
ROLLBACK;
```

Run: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f <workspace>/check-029.sql`
Expected: FAIL with `function mark_notifications_seen(uuid, uuid[]) does not exist`.

- [ ] **Step 2: Write the migration**

`supabase/migrations/029_mark_notifications_seen_by_id.sql`:

```sql
-- ============================================
-- mark_notifications_seen: mark only the notifications the client showed
-- ============================================
--
-- The notification dropdown called mark_notifications_seen(p_recipient_id),
-- which stamps seen_at on EVERY unseen row for the recipient -- including
-- rows the client never loaded (one inserted after the dropdown fetched its
-- list). Those rows then never badge again. Playtest 2026-09-30: a
-- collection_invite was marked seen 14s after it was created without ever
-- being displayed.
--
-- Adds p_notification_ids. DEFAULT NULL keeps the old mark-all behaviour,
-- mirroring mark_notifications_read (028). Changing the argument list needs
-- DROP + CREATE: CREATE OR REPLACE would add an overload and make
-- one-argument calls ambiguous.
--
-- Grants: a newly created function gets EXECUTE for PUBLIC (Postgres) and
-- anon (Supabase default privileges). 027's deny-by-default loop ran once,
-- so apply its outcome for this function here. 027 still allowlists the
-- name, so re-running 027 after a restore stays correct.

DROP FUNCTION IF EXISTS mark_notifications_seen(UUID);

CREATE FUNCTION mark_notifications_seen(
  p_recipient_id UUID,
  p_notification_ids UUID[] DEFAULT NULL::UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND p_recipient_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized to modify another user''s notifications';
  END IF;

  UPDATE notifications
  SET seen_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND seen_at IS NULL
    AND dismissed_at IS NULL
    AND (p_notification_ids IS NULL OR id = ANY(p_notification_ids));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION mark_notifications_seen(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_notifications_seen(UUID, UUID[]) TO authenticated, service_role;
```

- [ ] **Step 3: Apply locally and re-run the check**

Run: `npx supabase migration up --local`, then the psql command from Step 1.
Expected:
- `marked=1`
- row `…a1 | t` and row `…a2 | f`
- `anon=f authenticated=t`

(The transaction rolls back, so no test rows remain.)

- [ ] **Step 4: Update the TS helper**

In `src/lib/supabase/notifications.ts`, replace `markNotificationsSeen` with:

```ts
/**
 * Mark notifications as seen. Pass the IDs actually shown to the user;
 * omitting them marks every unseen notification (legacy behaviour).
 */
export async function markNotificationsSeen(
  client: SupabaseClient<Database>,
  userId: string,
  notificationIds?: string[]
): Promise<Result<number>> {
  // p_notification_ids was added in migration 029; database.types.ts is
  // regenerated from production, so it won't know the argument until 029 is
  // deployed. Drop this shim after the next type regeneration.
  type MarkSeenShim = {
    rpc(
      fn: 'mark_notifications_seen',
      args: { p_recipient_id: string; p_notification_ids?: string[] }
    ): Promise<{ data: number | null; error: { message: string } | null }>
  }
  const { data, error } = await (client as unknown as MarkSeenShim).rpc('mark_notifications_seen', {
    p_recipient_id: userId,
    ...(notificationIds ? { p_notification_ids: notificationIds } : {}),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ?? 0 }
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/supabase/notifications.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/029_mark_notifications_seen_by_id.sql src/lib/supabase/notifications.ts
git commit -m "feat: let mark_notifications_seen target specific notifications"
```

---

### Task 5: Live dropdown + seen only what was shown (F6)

**Files:**
- Create: `src/lib/notification-events.ts`
- Modify: `src/components/providers.tsx`
- Modify: `src/components/features/notification-dropdown.tsx`
- Modify: `src/components/features/notification-list.tsx`
- Test: `src/components/features/notification-dropdown.test.tsx`, `src/components/features/notification-list.test.tsx`

**Interfaces:**
- Consumes: `markNotificationsSeen(client, userId, ids)` from Task 4. Also
  `getNotifications(client, userId, { limit })` and
  `getUnseenNotificationCount(client, userId)` from `@/lib/supabase/notifications`,
  both returning `Result<…>`.
- Produces: `emitNewNotification(): void` and
  `subscribeToNewNotifications(listener: () => void): () => void`.

- [ ] **Step 1: Write the failing tests**

`src/components/features/notification-dropdown.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationDropdown } from "./notification-dropdown";
import { emitNewNotification } from "@/lib/notification-events";
import type { NotificationWithActor } from "@/types/notification";

const getNotifications = vi.fn();
const getUnseenNotificationCount = vi.fn();
const markNotificationsSeen = vi.fn();

vi.mock("@/lib/supabase/notifications", () => ({
  getNotifications: (...args: unknown[]) => getNotifications(...args),
  getUnseenNotificationCount: (...args: unknown[]) => getUnseenNotificationCount(...args),
  markNotificationsSeen: (...args: unknown[]) => markNotificationsSeen(...args),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

function notification(id: string, overrides: Partial<NotificationWithActor> = {}): NotificationWithActor {
  return {
    id,
    recipientId: "me",
    actorId: "owner",
    type: "friend_accepted",
    entityType: "player",
    entityId: "owner",
    data: { friendship_id: "f1", addressee_id: "owner", addressee_username: "owner", addressee_avatar_url: null },
    readAt: null,
    seenAt: null,
    dismissedAt: null,
    expiresAt: null,
    createdAt: "2026-09-30T05:08:55Z",
    actor: { id: "owner", username: "owner", displayName: null, avatarUrl: null },
    ...overrides,
  } as NotificationWithActor;
}

describe("NotificationDropdown", () => {
  beforeEach(() => {
    getNotifications.mockReset();
    getUnseenNotificationCount.mockReset();
    markNotificationsSeen.mockReset().mockResolvedValue({ success: true, data: 1 });
  });

  it("shows a notification that arrives over realtime after mount", async () => {
    const invite = notification("n2", {
      type: "collection_invite",
      data: { collection_id: "c1", collection_name: "Test Collection", owner_id: "owner", owner_username: "owner", owner_avatar_url: null, role: "member" },
    });
    getNotifications.mockResolvedValue({ success: true, data: [invite, notification("n1")] });
    getUnseenNotificationCount.mockResolvedValue({ success: true, data: 2 });

    render(<NotificationDropdown initialNotifications={[notification("n1")]} initialUnseenCount={1} userId="me" />);
    act(() => emitNewNotification());

    await waitFor(() => expect(screen.getByLabelText("Notifications (2 new)")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Notifications (2 new)"));
    expect(screen.getByText(/added you to/)).toBeInTheDocument();
  });

  it("marks only the notifications it displayed as seen", async () => {
    render(<NotificationDropdown initialNotifications={[notification("n1")]} initialUnseenCount={3} userId="me" />);
    await userEvent.click(screen.getByLabelText("Notifications (3 new)"));
    expect(markNotificationsSeen).toHaveBeenCalledWith(expect.anything(), "me", ["n1"]);
    // Two unseen notifications weren't in the list, so the badge keeps them.
    expect(screen.getByLabelText("Notifications (2 new)")).toBeInTheDocument();
  });

  it("does not call the RPC when nothing displayed is unseen", async () => {
    render(
      <NotificationDropdown
        initialNotifications={[notification("n1", { seenAt: "2026-09-30T05:10:00Z" })]}
        initialUnseenCount={0}
        userId="me"
      />
    );
    await userEvent.click(screen.getByLabelText("Notifications"));
    expect(markNotificationsSeen).not.toHaveBeenCalled();
  });

  it("keeps the current list when a refetch fails", async () => {
    getNotifications.mockResolvedValue({ success: false, error: "network" });
    getUnseenNotificationCount.mockResolvedValue({ success: false, error: "network" });

    render(<NotificationDropdown initialNotifications={[notification("n1")]} initialUnseenCount={1} userId="me" />);
    act(() => emitNewNotification());
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());

    await userEvent.click(screen.getByLabelText("Notifications (1 new)"));
    expect(screen.getByText(/accepted your friend request/)).toBeInTheDocument();
  });
});
```

The fixture's fields match `Notification` in `src/types/notification.ts:35-48`.
The `as NotificationWithActor` cast only bridges the `data` union for the
override case.

Also create `src/components/features/notification-list.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { NotificationList } from "./notification-list";
import type { NotificationWithActor } from "@/types/notification";

const markNotificationsSeen = vi.fn().mockResolvedValue({ success: true, data: 1 });

vi.mock("@/lib/supabase/notifications", () => ({
  markNotificationsSeen: (...args: unknown[]) => markNotificationsSeen(...args),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/actions/match", () => ({ approveClaimRequest: vi.fn(), rejectClaimRequest: vi.fn() }));
vi.mock("@/app/actions/friend", () => ({ acceptFriendRequest: vi.fn(), rejectFriendRequest: vi.fn() }));

function notification(id: string, seenAt: string | null): NotificationWithActor {
  return {
    id,
    recipientId: "me",
    actorId: "owner",
    type: "friend_accepted",
    entityType: "player",
    entityId: "owner",
    data: { friendship_id: "f1", addressee_id: "owner", addressee_username: "owner", addressee_avatar_url: null },
    readAt: null,
    seenAt,
    dismissedAt: null,
    expiresAt: null,
    createdAt: "2026-09-30T05:08:55Z",
    actor: { id: "owner", username: "owner", displayName: null, avatarUrl: null },
  };
}

describe("NotificationList", () => {
  it("marks the unseen notifications it renders as seen", () => {
    render(
      <NotificationList
        initialNotifications={[notification("n1", null), notification("n2", "2026-09-30T06:00:00Z"), notification("n3", null)]}
        userId="me"
      />
    );
    expect(markNotificationsSeen).toHaveBeenCalledWith(expect.anything(), "me", ["n1", "n3"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project jsdom src/components/features/notification-dropdown.test.tsx src/components/features/notification-list.test.tsx`
Expected: FAIL. The dropdown file fails on the unresolved
`@/lib/notification-events` import. The list test fails because
`markNotificationsSeen` is never called.

- [ ] **Step 3: Add the event module**

`src/lib/notification-events.ts`:

```ts
/**
 * In-page signal from the realtime subscription (providers.tsx) to the
 * notification dropdown (navbar). They live in separate component trees, and
 * the dropdown's list is seeded from server props, so without this it never
 * learns about rows inserted after the page rendered.
 */

export const NEW_NOTIFICATION_EVENT = 'commandzone:new-notification'

export function emitNewNotification(): void {
  window.dispatchEvent(new Event(NEW_NOTIFICATION_EVENT))
}

export function subscribeToNewNotifications(listener: () => void): () => void {
  window.addEventListener(NEW_NOTIFICATION_EVENT, listener)
  return () => window.removeEventListener(NEW_NOTIFICATION_EVENT, listener)
}
```

- [ ] **Step 4: Emit from the realtime hook**

In `src/components/providers.tsx`, add
`import { emitNewNotification } from "@/lib/notification-events";` and change
`useNotificationRealtime({ userId });` to:

```tsx
  // emitNewNotification is module-level, so it's a stable reference and
  // doesn't re-subscribe the realtime channel on every render.
  useNotificationRealtime({ userId, onNewNotification: emitNewNotification });
```

- [ ] **Step 5: Refetch and mark seen by ID in the dropdown**

In `src/components/features/notification-dropdown.tsx`:

Add imports:

```tsx
import { getNotifications, getUnseenNotificationCount, markNotificationsSeen } from "@/lib/supabase/notifications";
import { subscribeToNewNotifications } from "@/lib/notification-events";
```

After the `useState`/`useRef`/`useRouter` declarations, add:

```tsx
  // Same limit as the navbar's server fetch.
  const refresh = React.useCallback(async () => {
    const supabase = createClient();
    const [listResult, countResult] = await Promise.all([
      getNotifications(supabase, userId, { limit: 10 }),
      getUnseenNotificationCount(supabase, userId),
    ]);
    // On failure keep what we have rather than blanking the menu.
    if (listResult.success) setNotifications(listResult.data);
    if (countResult.success) setUnseenCount(countResult.data);
  }, [userId]);

  React.useEffect(
    () => subscribeToNewNotifications(() => void refresh()),
    [refresh]
  );
```

Replace `handleOpen` with:

```tsx
  // Mark only the notifications this menu actually shows as seen. Anything
  // beyond the list stays unseen and keeps the badge up.
  const handleOpen = async () => {
    setIsOpen(true);

    const unseenIds = notifications.filter((n) => !n.seenAt).map((n) => n.id);
    if (unseenIds.length === 0) return;

    const seenAt = new Date().toISOString();
    setUnseenCount((count) => Math.max(0, count - unseenIds.length));
    setNotifications((prev) =>
      prev.map((n) => (unseenIds.includes(n.id) ? { ...n, seenAt } : n))
    );
    await markNotificationsSeen(createClient(), userId, unseenIds);
  };
```

- [ ] **Step 6: Mark seen on the `/notifications` page**

In `src/components/features/notification-list.tsx`, add
`import { markNotificationsSeen } from "@/lib/supabase/notifications";` and,
after the `useRouter()` line, add:

```tsx
  // The full page shows more than the navbar dropdown, so it's the place a
  // backlog of unseen notifications gets cleared. Mark what's rendered.
  React.useEffect(() => {
    const unseenIds = initialNotifications.filter((n) => !n.seenAt).map((n) => n.id);
    if (unseenIds.length > 0) {
      void markNotificationsSeen(createClient(), userId, unseenIds);
    }
  }, [initialNotifications, userId]);
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run --project jsdom src/components/features/notification-dropdown.test.tsx src/components/features/notification-list.test.tsx`
Expected: the list test and dropdown tests 2, 3 and 4 PASS. Dropdown test 1
still FAILS, but only on `/added you to/`. That copy lands in Task 6. If
anything else fails, fix it before moving on.

- [ ] **Step 8: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/lib/notification-events.ts src/components/providers.tsx src/components/features/notification-dropdown.tsx src/components/features/notification-list.tsx src/components/features/notification-dropdown.test.tsx`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/notification-events.ts src/components/providers.tsx src/components/features/notification-dropdown.tsx src/components/features/notification-list.tsx src/components/features/notification-dropdown.test.tsx src/components/features/notification-list.test.tsx
git commit -m "fix: refresh notification dropdown on realtime and mark seen by id"
```

---

### Task 6: "Added you to {collection}" copy (F6)

**Files:**
- Modify: `src/types/notification.ts` (title for `collection_invite`; add `getCollectionName`)
- Modify: `src/components/features/notification-dropdown.tsx` (`collection_invite` case, ~line 289)
- Modify: `src/components/features/notification-list.tsx` (`collection_invite` case, ~line 482)
- Test: `src/components/features/notification-dropdown.test.tsx` (already written in Task 5)

**Interfaces:**
- Produces: `getCollectionName(data: NotificationData): string | null` in
  `src/types/notification.ts`.

- [ ] **Step 1: Add the helper and retitle**

In `src/types/notification.ts`, change the title map entry
`collection_invite: 'Collection Invitation',` →
`collection_invite: 'Added to Collection',`, and add below `getNotificationTitle`:

```ts
/**
 * Collection name carried by collection notifications, if present.
 * The DB trigger (notify_collection_invite) stores it in data.collection_name.
 */
export function getCollectionName(data: NotificationData): string | null {
  return 'collection_name' in data && typeof data.collection_name === 'string'
    ? data.collection_name
    : null
}
```

- [ ] **Step 2: Use it in both message renderers**

In **both** `notification-dropdown.tsx` and `notification-list.tsx`, add
`getCollectionName` to the existing `@/types/notification` value import, and
replace the `collection_invite` case:

```tsx
    case "collection_invite":
      return (
        <>
          <span className="font-medium">{actorName}</span> invited you to join a collection
        </>
      );
```

with

```tsx
    case "collection_invite":
      return (
        <>
          <span className="font-medium">{actorName}</span> added you to{" "}
          <span className="font-medium">{getCollectionName(data) ?? "a collection"}</span>
        </>
      );
```

- [ ] **Step 3: Run the dropdown tests**

Run: `npx vitest run --project jsdom src/components/features/notification-dropdown.test.tsx`
Expected: 4/4 PASS. Task 5's first test now finds "added you to".

- [ ] **Step 4: Full suite, typecheck, lint**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: the whole suite passes, no type errors, 0 lint errors.

- [ ] **Step 5: Verify in the browser**

With a prod build on :3002 and local Supabase, logged in as user A in one
browser context:
- Add user A to a collection as user B (owner) from another context or via SQL
  insert into `collection_members`.
- Without reloading, A's bell badge increments. Opening it shows "B added you
  to **<collection name>**".
- `notifications.seen_at` is set only for the rows that were in the list
  (`select id, seen_at from notifications where recipient_id = '<A>' order by created_at desc limit 12;`).

Stop the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add src/types/notification.ts src/components/features/notification-dropdown.tsx src/components/features/notification-list.tsx
git commit -m "fix: name the collection in member-added notifications"
```

---

## Self-review notes

- **Spec coverage:**
  - B3: grouping, win rate, minimum games, confirmed/approved only, unranked
    state, stat card. Tasks 1–2.
  - B4: copy and pending hint. Task 3.
  - F6: realtime into the dropdown, seen by ID (migration), copy. Tasks 4–6.
  - The spec's "test that a realtime insert appears in the dropdown" is Task 5
    test 1.
- **Deviations from the spec, by design:**
  - Top Commanders is aggregated app-side, not in a SQL RPC, so this plan
    stays light on migrations. The 1000-row PostgREST cap is noted in code.
  - `database.types.ts` isn't regenerated; the `markNotificationsSeen` shim
    covers the new argument until 029 reaches production.
- **Deploy note (corrected after final review):** migration 029 must be
  deployed **before** the app change. 029-first is safe, because old app code
  calls `mark_notifications_seen(p_recipient_id)` with one argument, which
  resolves to the new function through the DEFAULT. App-first is **not** safe:
  the new app passes `p_notification_ids`, PostgREST can't find that signature
  on the old database (PGRST202), and every mark-seen fails. Those failures are
  now reported to Sentry.
