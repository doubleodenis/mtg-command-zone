import { describe, it, expect, vi } from 'vitest'
import {
  MAX_FEEDBACK_LENGTH,
  FEEDBACK_COOLDOWN_MS,
  FEEDBACK_STORAGE_KEY,
  validateMessage,
  isRateLimited,
  recordSubmission,
  buildFeedbackPayload,
} from '@/lib/feedback'

describe('validateMessage', () => {
  it('rejects an empty message', () => {
    expect(validateMessage('')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a whitespace-only message', () => {
    expect(validateMessage('   \n  ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('accepts a normal message', () => {
    expect(validateMessage('the confirm button did nothing')).toEqual({ ok: true })
  })

  it('rejects a message over the cap', () => {
    expect(validateMessage('x'.repeat(MAX_FEEDBACK_LENGTH + 1))).toEqual({
      ok: false,
      reason: 'too-long',
    })
  })

  it('accepts a message exactly at the cap', () => {
    expect(validateMessage('x'.repeat(MAX_FEEDBACK_LENGTH))).toEqual({ ok: true })
  })
})

describe('isRateLimited', () => {
  it('is not limited when nothing has been submitted', () => {
    const storage = { getItem: () => null }
    expect(isRateLimited(1_000_000, storage)).toBe(false)
  })

  it('is limited immediately after a submission', () => {
    const storage = { getItem: () => '1000000' }
    expect(isRateLimited(1_000_000, storage)).toBe(true)
  })

  it('is limited part-way through the cooldown', () => {
    const storage = { getItem: () => '1000000' }
    expect(isRateLimited(1_000_000 + FEEDBACK_COOLDOWN_MS - 1, storage)).toBe(true)
  })

  it('is not limited once the cooldown has elapsed', () => {
    const storage = { getItem: () => '1000000' }
    expect(isRateLimited(1_000_000 + FEEDBACK_COOLDOWN_MS, storage)).toBe(false)
  })

  it('is not limited when the stored value is garbage', () => {
    const storage = { getItem: () => 'not-a-number' }
    expect(isRateLimited(1_000_000, storage)).toBe(false)
  })

  it('is not limited when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError: site data blocked')
      },
    }
    expect(isRateLimited(1_000_000, storage)).toBe(false)
  })

  it('is not limited when storage is unavailable', () => {
    expect(isRateLimited(1_000_000, null)).toBe(false)
  })
})

describe('recordSubmission', () => {
  it('writes the timestamp under the shared key', () => {
    const setItem = vi.fn()
    recordSubmission(1_234_567, { setItem })
    expect(setItem).toHaveBeenCalledWith(FEEDBACK_STORAGE_KEY, '1234567')
  })

  it('swallows a throwing storage', () => {
    const setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => recordSubmission(1_234_567, { setItem })).not.toThrow()
  })

  it('does nothing when storage is unavailable', () => {
    expect(() => recordSubmission(1_234_567, null)).not.toThrow()
  })
})

describe('buildFeedbackPayload', () => {
  it('tags the intent and the route', () => {
    const { hint } = buildFeedbackPayload({
      message: 'rating went down after a win',
      email: 'player@example.com',
      intent: 'bug',
      route: '/match/abc',
      lastEventId: undefined,
    })
    expect(hint.captureContext.tags).toEqual({ intent: 'bug', route: '/match/abc' })
  })

  it('trims the message and includes the email', () => {
    const { feedback } = buildFeedbackPayload({
      message: '  spacing is off  ',
      email: 'player@example.com',
      intent: 'idea',
      route: '/',
      lastEventId: undefined,
    })
    expect(feedback.message).toBe('spacing is off')
    expect(feedback.email).toBe('player@example.com')
  })

  it('omits the email entirely when blank', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'anonymous report',
      email: '   ',
      intent: 'bug',
      route: '/',
      lastEventId: undefined,
    })
    expect(feedback.email).toBeUndefined()
    expect('email' in feedback).toBe(false)
  })

  it('attaches the last event id for a bug report', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'it crashed',
      email: '',
      intent: 'bug',
      route: '/matches/new',
      lastEventId: 'abc123',
    })
    expect(feedback.associatedEventId).toBe('abc123')
  })

  it('never attaches an event id to an idea', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'add a dark mode toggle',
      email: '',
      intent: 'idea',
      route: '/',
      lastEventId: 'abc123',
    })
    expect(feedback.associatedEventId).toBeUndefined()
  })

  it('omits the event id for a bug when none exists', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'confusing copy',
      email: '',
      intent: 'bug',
      route: '/',
      lastEventId: undefined,
    })
    expect(feedback.associatedEventId).toBeUndefined()
  })

  it('includes the name when the session supplies one', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'looks great',
      email: 'player@example.com',
      name: 'Alex Rivera',
      intent: 'idea',
      route: '/',
      lastEventId: undefined,
    })
    expect(feedback.name).toBe('Alex Rivera')
  })

  it('omits the name entirely when none is supplied', () => {
    const { feedback } = buildFeedbackPayload({
      message: 'looks great',
      email: 'player@example.com',
      intent: 'idea',
      route: '/',
      lastEventId: undefined,
    })
    expect(feedback.name).toBeUndefined()
    expect('name' in feedback).toBe(false)
  })

  it('omits the name entirely when it is null or blank', () => {
    const nullName = buildFeedbackPayload({
      message: 'looks great',
      email: '',
      name: null,
      intent: 'idea',
      route: '/',
      lastEventId: undefined,
    })
    expect('name' in nullName.feedback).toBe(false)

    const blankName = buildFeedbackPayload({
      message: 'looks great',
      email: '',
      name: '   ',
      intent: 'idea',
      route: '/',
      lastEventId: undefined,
    })
    expect('name' in blankName.feedback).toBe(false)
  })
})
