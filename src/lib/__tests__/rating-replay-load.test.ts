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
