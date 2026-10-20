/**
 * Pure helpers for scripts/recalculate-ratings.ts: payload mapping for
 * apply_rating_replay (migration 030), the partial-load guard and the
 * write-target guard.
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

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/** Host part of the Supabase URL (never the key), or null if it can't be parsed. */
export function targetHost(url: string): string | null {
  try {
    return new URL(url).hostname || null
  } catch {
    return null
  }
}

/**
 * Guards against a local run writing to production by accident: production
 * writes go through the Nightly Rating Recalc workflow. A write to any
 * non-local host outside GitHub Actions needs `--confirm-host=<exact host>`
 * (break-glass). Dry runs and local databases are always allowed.
 */
export function checkWriteTarget(
  url: string,
  opts: { dryRun: boolean; confirmHost: string | null; inCI: boolean }
): string | null {
  const host = targetHost(url)
  if (host === null) return 'Refusing to run: cannot parse NEXT_PUBLIC_SUPABASE_URL'
  if (opts.dryRun || opts.inCI || LOCAL_HOSTS.has(host)) return null
  if (opts.confirmHost === null) {
    return (
      `Refusing to write to remote host ${host}: production writes go through the ` +
      `Nightly Rating Recalc workflow. Use --dry-run, or pass --confirm-host=${host} as an explicit break-glass.`
    )
  }
  if (opts.confirmHost !== host) {
    return `Refusing to write: --confirm-host=${opts.confirmHost} does not match the target host ${host}`
  }
  return null
}
