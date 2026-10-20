import { describe, it, expect } from 'vitest'
import {
  DECK_REQUIRED_MESSAGE,
  hasConfirmableDeck,
  isDeckRequiredError,
  selectAutoResolvableParticipations,
  shouldAutoConfirmParticipant,
} from '@/lib/confirmation'

describe('shouldAutoConfirmParticipant', () => {
  it('always auto-confirms the reporter, regardless of friendship status', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-a',
        friendshipStatus: null,
        deck: { deckName: 'Real Deck' },
      })
    ).toBe(true)
  })

  it('auto-confirms an accepted friend of the reporter', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: 'accepted',
        deck: { deckName: 'Real Deck' },
      })
    ).toBe(true)
  })

  it('does not auto-confirm a non-friend', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: null,
        deck: { deckName: 'Real Deck' },
      })
    ).toBe(false)
  })

  it('does not auto-confirm a pending (not-yet-accepted) friend request', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: 'pending',
        deck: { deckName: 'Real Deck' },
      })
    ).toBe(false)
  })

  it('does not auto-confirm a blocked relationship', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: 'blocked',
        deck: { deckName: 'Real Deck' },
      })
    ).toBe(false)
  })
})

describe('hasConfirmableDeck', () => {
  it('accepts a real deck, including one with no name', () => {
    expect(hasConfirmableDeck({ deckName: 'Superfriends' })).toBe(true)
    expect(hasConfirmableDeck({ deckName: null })).toBe(true)
  })

  it('rejects no deck and the Unknown Deck placeholder', () => {
    expect(hasConfirmableDeck(null)).toBe(false)
    expect(hasConfirmableDeck({ deckName: 'Unknown Deck' })).toBe(false)
  })
})

describe('shouldAutoConfirmParticipant — deck rule', () => {
  it('does not auto-confirm an accepted friend still on Unknown Deck', () => {
    expect(shouldAutoConfirmParticipant({
      reporterId: 'r', participantUserId: 'f', friendshipStatus: 'accepted', deck: { deckName: 'Unknown Deck' },
    })).toBe(false)
  })

  it('does not auto-confirm the reporter without a deck', () => {
    expect(shouldAutoConfirmParticipant({
      reporterId: 'r', participantUserId: 'r', friendshipStatus: null, deck: null,
    })).toBe(false)
  })
})

describe('isDeckRequiredError', () => {
  it('recognises the migration 031 trigger error', () => {
    expect(
      isDeckRequiredError({
        code: '23514',
        message: 'confirmation requires a deck: pick your deck before confirming',
      })
    ).toBe(true)
  })

  it('ignores other errors and no error', () => {
    expect(isDeckRequiredError(null)).toBe(false)
    expect(isDeckRequiredError({ code: '23514', message: 'some other check' })).toBe(false)
    expect(isDeckRequiredError({ code: '42501', message: 'permission denied' })).toBe(false)
  })

  it('exposes the user-facing message', () => {
    expect(DECK_REQUIRED_MESSAGE).toBe('Pick your deck before confirming this match.')
  })
})

describe('selectAutoResolvableParticipations', () => {
  const row = (
    id: string,
    userId: string,
    createdBy: string,
    playedAt: string,
    deckName: string | null | undefined
  ) => ({
    id,
    user_id: userId,
    match: { played_at: playedAt, created_by: createdBy },
    deck: deckName === undefined ? null : { deck_name: deckName },
  })

  it('keeps rows reported by the other friend that have a real deck, oldest first', () => {
    const result = selectAutoResolvableParticipations(
      [
        row('late', 'b', 'a', '2026-02-01T00:00:00Z', 'Superfriends'),
        row('early', 'b', 'a', '2026-01-01T00:00:00Z', null),
      ],
      'a',
      'b'
    )
    expect(result.map((r) => r.id)).toEqual(['early', 'late'])
  })

  it('skips rows without a confirmable deck', () => {
    const result = selectAutoResolvableParticipations(
      [
        row('unknown', 'b', 'a', '2026-01-01T00:00:00Z', 'Unknown Deck'),
        row('none', 'b', 'a', '2026-01-02T00:00:00Z', undefined),
        row('real', 'a', 'b', '2026-01-03T00:00:00Z', 'Atraxa'),
      ],
      'a',
      'b'
    )
    expect(result.map((r) => r.id)).toEqual(['real'])
  })

  it('skips rows not reported by the other friend', () => {
    const result = selectAutoResolvableParticipations(
      [
        row('own', 'a', 'a', '2026-01-01T00:00:00Z', 'Atraxa'),
        row('third', 'b', 'c', '2026-01-01T00:00:00Z', 'Atraxa'),
      ],
      'a',
      'b'
    )
    expect(result).toEqual([])
  })
})
