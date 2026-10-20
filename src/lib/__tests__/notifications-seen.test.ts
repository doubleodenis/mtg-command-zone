import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { markNotificationsSeen } from '@/lib/supabase/notifications'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

function clientReturning(result: { data: number | null; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result)
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

describe('markNotificationsSeen', () => {
  beforeEach(() => vi.mocked(Sentry.captureMessage).mockReset())

  it('passes the displayed IDs to the RPC', async () => {
    const { client, rpc } = clientReturning({ data: 2, error: null })
    const result = await markNotificationsSeen(client, 'me', ['n1', 'n2'])
    expect(rpc).toHaveBeenCalledWith('mark_notifications_seen', { p_recipient_id: 'me', p_notification_ids: ['n1', 'n2'] })
    expect(result).toEqual({ success: true, data: 2 })
  })

  it('reports a failure to Sentry instead of failing silently', async () => {
    // e.g. the app shipped before migration 029: PostgREST can't find the
    // two-argument function and every mark-seen fails.
    const { client } = clientReturning({ data: null, error: { message: 'Could not find the function (PGRST202)' } })
    const result = await markNotificationsSeen(client, 'me', ['n1'])
    expect(result.success).toBe(false)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'mark_notifications_seen failed',
      expect.objectContaining({ level: 'warning' })
    )
  })
})
