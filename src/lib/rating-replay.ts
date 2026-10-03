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
