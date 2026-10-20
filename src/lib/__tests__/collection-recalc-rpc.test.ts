import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { markCollectionMatchesDirty, autoConfirmCollectionMembers } from '@/lib/supabase/collections'

function clientReturning(result: { data: number | null; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result)
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

describe('markCollectionMatchesDirty', () => {
  it('flags a joining member\'s matches', async () => {
    const { client, rpc } = clientReturning({ data: 2, error: null })
    expect(await markCollectionMatchesDirty(client, { collectionId: 'c', userId: 'u' })).toEqual({ success: true, data: 2 })
    expect(rpc).toHaveBeenCalledWith('mark_collection_matches_dirty', { p_collection_id: 'c', p_user_id: 'u', p_match_id: null })
  })

  it('surfaces an authorization error instead of swallowing it', async () => {
    const { client } = clientReturning({ data: null, error: { message: 'not authorized: caller is not a member of this collection' } })
    expect(await markCollectionMatchesDirty(client, { collectionId: 'c', matchId: 'm' }))
      .toEqual({ success: false, error: 'not authorized: caller is not a member of this collection' })
  })
})

describe('autoConfirmCollectionMembers', () => {
  it('delegates to the SECURITY DEFINER function', async () => {
    const { client, rpc } = clientReturning({ data: 1, error: null })
    expect(await autoConfirmCollectionMembers(client, 'm', 'c')).toEqual({ success: true, data: 1 })
    expect(rpc).toHaveBeenCalledWith('auto_confirm_collection_members', { p_match_id: 'm', p_collection_id: 'c' })
  })
})
