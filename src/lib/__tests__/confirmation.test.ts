import { describe, it, expect } from 'vitest'
import { shouldAutoConfirmParticipant } from '@/lib/confirmation'

describe('shouldAutoConfirmParticipant', () => {
  it('always auto-confirms the reporter, regardless of friendship status', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-a',
        friendshipStatus: null,
      })
    ).toBe(true)
  })

  it('auto-confirms an accepted friend of the reporter', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: 'accepted',
      })
    ).toBe(true)
  })

  it('does not auto-confirm a non-friend', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: null,
      })
    ).toBe(false)
  })

  it('does not auto-confirm a pending (not-yet-accepted) friend request', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: 'pending',
      })
    ).toBe(false)
  })

  it('does not auto-confirm a blocked relationship', () => {
    expect(
      shouldAutoConfirmParticipant({
        reporterId: 'user-a',
        participantUserId: 'user-b',
        friendshipStatus: 'blocked',
      })
    ).toBe(false)
  })
})
