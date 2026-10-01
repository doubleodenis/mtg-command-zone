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
