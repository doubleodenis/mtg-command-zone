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

function ratingRow(
  matchId: string,
  userId: string,
  ratingAfter: number,
  ratingBefore: number = ratingAfter - 10
): RatingHistoryRow {
  return { matchId, userId, ratingAfter, ratingBefore }
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

  it('maps yourRatingBefore from the current user rating_before value', () => {
    const shared = [match({ matchId: 'm1' })]
    const ratings = [ratingRow('m1', YOU, 1013, 1000), ratingRow('m1', THEM, 1088, 1100)]
    const meetings = buildMeetings(shared, ratings, YOU, THEM)
    expect(meetings[0].yourRatingBefore).toBe(1000)
  })

  it('is deterministic and does not crash when given duplicate rows for the same match+user (e.g. an unfiltered collection-scoped row alongside the global row) — last row wins, since determinism is enforced upstream by the collection_id IS NULL filter in the SQL query, not here', () => {
    const shared = [match({ matchId: 'm1' })]
    const ratings = [
      ratingRow('m1', YOU, 1010, 1000), // global row
      ratingRow('m1', YOU, 1500, 1490), // hypothetical collection-scoped row for the same user+match
      ratingRow('m1', THEM, 990, 1000),
    ]
    const meetings = buildMeetings(shared, ratings, YOU, THEM)
    expect(meetings).toHaveLength(1)
    // Last row in the array wins (Map overwrite semantics) — deterministic given a fixed input order.
    expect(meetings[0].yourRating).toBe(1500)
    expect(meetings[0].yourRatingBefore).toBe(1490)
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
    return {
      matchId: playedAt,
      playedAt,
      formatSlug: 'ffa',
      formatName: 'FFA',
      isWin: true,
      yourRating,
      yourRatingBefore: yourRating - 10,
      opponentRating,
    }
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
