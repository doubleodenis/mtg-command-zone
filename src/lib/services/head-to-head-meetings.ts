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
