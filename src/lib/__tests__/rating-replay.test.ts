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

  describe('collection scope', () => {
    // Expected delta for a player rated from `rating` against `opponents`.
    const deltaFor = (
      rating: number,
      opponents: Array<{ rating: number; bracket?: 1 | 2 | 3 | 4 }>,
      isWinner: boolean,
      { bracket = 2, matchCount = 0 }: { bracket?: 1 | 2 | 3 | 4; matchCount?: number } = {}
    ) =>
      calculateRating({
        playerId: 'x', playerRating: rating, playerBracket: bracket, playerMatchCount: matchCount, isWinner,
        opponents: opponents.map((o) => ({ rating: o.rating, bracket: o.bracket ?? 2 })), formatId: FFA, collectionId: null,
      }).delta

    // A global-only warm-up: afterwards A is 1016 and B 984 globally, while
    // both still have no collection rating (1000). Any test that starts with
    // it fails if collection ratings were seeded from the global scope.
    const warmup = () => match('m0', '2025-12-31T00:00:00Z', [p('A', { isWinner: true }), p('B')])

    it('carries collection state between matches independently of global state', () => {
      const members = new Map([['col', new Set(['A', 'B'])]])
      const { history } = replayRatings(
        [
          // m1: C is not a member. Global: A beats B and C (3-player, +21 → 1021);
          // collection: A beats B only (2-player, +16 → 1016; B −16 → 984).
          match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B'), p('C')], ['col']),
          // m2: global only, moves A's global rating again.
          match('m2', '2026-01-02T00:00:00Z', [p('A', { isWinner: true }), p('C')]),
          // m3: collection match; must start from m1's COLLECTION results.
          match('m3', '2026-01-03T00:00:00Z', [p('A'), p('B', { isWinner: true })], ['col']),
        ],
        members
      )
      const row = (matchId: string, userId: string, collectionId: string | null) =>
        history.find((h) => h.matchId === matchId && h.userId === userId && h.collectionId === collectionId)!

      expect(row('m1', 'A', 'col').ratingAfter).toBe(1016)
      expect(row('m1', 'B', 'col').ratingAfter).toBe(984)
      expect(row('m1', 'A', null).ratingAfter).toBe(1021)

      const aCol = row('m3', 'A', 'col')
      const bCol = row('m3', 'B', 'col')
      expect(aCol.ratingBefore).toBe(row('m1', 'A', 'col').ratingAfter)
      expect(bCol.ratingBefore).toBe(row('m1', 'B', 'col').ratingAfter)
      expect(aCol.ratingBefore).not.toBe(row('m3', 'A', null).ratingBefore)
      expect(aCol.delta).toBe(deltaFor(1016, [{ rating: 984 }], false, { matchCount: 1 }))
      expect(bCol.delta).toBe(deltaFor(984, [{ rating: 1016 }], true, { matchCount: 1 }))
    })

    it('rates collection members simultaneously, whatever order participants are listed in', () => {
      const members = new Map([['col', new Set(['A', 'B', 'C'])]])
      const people = [p('A', { isWinner: true }), p('B', { bracket: 3 }), p('C', { bracket: 1 })]
      const forward = replayRatings(
        [warmup(), match('m1', '2026-01-01T00:00:00Z', people, ['col'])],
        members
      )
      const backward = replayRatings(
        [warmup(), match('m1', '2026-01-01T00:00:00Z', [...people].reverse(), ['col'])],
        members
      )
      const colRows = (h: typeof forward.history) => sorted(h.filter((r) => r.collectionId === 'col'))
      expect(colRows(backward.history)).toEqual(colRows(forward.history))
      expect(sorted(backward.ratings)).toEqual(sorted(forward.ratings))
      expect(colRows(forward.history).map((h) => h.ratingBefore)).toEqual([1000, 1000, 1000])
    })

    it('rates one match independently in each collection it belongs to', () => {
      const members = new Map([
        ['col1', new Set(['A', 'B'])],
        ['col2', new Set(['A', 'B', 'C'])],
      ])
      const { ratings, history } = replayRatings(
        [warmup(), match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B'), p('C')], ['col1', 'col2'])],
        members
      )
      const collectionRows = history
        .filter((h) => h.collectionId !== null)
        .map((h) => [h.collectionId, h.userId, h.ratingBefore, h.delta])
      expect(sorted(collectionRows)).toEqual(sorted([
        ['col1', 'A', 1000, deltaFor(1000, [{ rating: 1000 }], true)],
        ['col1', 'B', 1000, deltaFor(1000, [{ rating: 1000 }], false)],
        ['col2', 'A', 1000, deltaFor(1000, [{ rating: 1000 }, { rating: 1000 }], true)],
        ['col2', 'B', 1000, deltaFor(1000, [{ rating: 1000 }, { rating: 1000 }], false)],
        ['col2', 'C', 1000, deltaFor(1000, [{ rating: 1000 }, { rating: 1000 }], false)],
      ]))
      expect(sorted(ratings.filter((r) => r.collectionId !== null).map((r) => [r.collectionId, r.userId, r.rating])))
        .toEqual(sorted([
          ['col1', 'A', 1016], ['col1', 'B', 984],
          ['col2', 'A', 1021], ['col2', 'B', 989], ['col2', 'C', 989],
        ]))
    })

    it('counts an unconfirmed member as a collection opponent instead of falling back to global', () => {
      const members = new Map([['col', new Set(['A', 'B'])]])
      const { history } = replayRatings(
        [warmup(), match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B', { confirmed: false }), p('C')], ['col'])],
        members
      )
      const aCol = history.find((h) => h.userId === 'A' && h.collectionId === 'col')!
      expect(aCol.ratingBefore).toBe(1000)
      // B (collection 1000) is the only opponent: a 2-player game, not A's
      // global opponents B (984) and C (1000).
      expect(aCol.delta).toBe(deltaFor(1000, [{ rating: 1000 }], true))
      expect(aCol.opponentAvgRating).toBe(1000)
      expect(history.filter((h) => h.collectionId === 'col').map((h) => h.userId)).toEqual(['A'])
    })
  })

  it('breaks a same-playedAt tie by match id, whatever the input order', () => {
    const ma = match('m-a', '2026-01-01T00:00:00Z', [p('A', { isWinner: true }), p('B')])
    const mb = match('m-b', '2026-01-01T00:00:00Z', [p('A'), p('B', { isWinner: true })])
    const forward = replayRatings([ma, mb], noMembers)
    const backward = replayRatings([mb, ma], noMembers)
    expect(backward).toEqual(forward)
    expect(forward.history.map((h) => h.matchId)).toEqual(['m-a', 'm-a', 'm-b', 'm-b'])
    expect(forward.history.find((h) => h.matchId === 'm-b' && h.userId === 'B')!.ratingBefore).toBe(984)
  })

  it('falls back to bracket 2 when a participant has no bracket', () => {
    const { history } = replayRatings(
      [match('m1', '2026-01-01T00:00:00Z', [p('A', { isWinner: true, bracket: null }), p('B', { bracket: 3 })])],
      noMembers
    )
    const a = history.find((h) => h.userId === 'A')!
    expect(a.playerBracket).toBe(2)
    expect(a.delta).toBe(calculateRating({
      playerId: 'A', playerRating: 1000, playerBracket: 2, playerMatchCount: 0, isWinner: true,
      opponents: [{ rating: 1000, bracket: 3 }], formatId: FFA, collectionId: null,
    }).delta)
    // B sees A as a bracket-2 opponent.
    expect(history.find((h) => h.userId === 'B')!.opponentAvgBracket).toBe(2)
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
