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
