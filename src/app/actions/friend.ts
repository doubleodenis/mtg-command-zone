'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { respondToFriendRequest } from '@/lib/supabase/profiles'
import type { Result, FriendshipStatus } from '@/types'

/**
 * Accept a friend request.
 */
export async function acceptFriendRequest(
  friendshipId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify this friendship is addressed to the current user
  const { data: friendship, error: friendshipError } = await supabase
    .from('friends')
    .select('addressee_id, status')
    .eq('id', friendshipId)
    .single()

  if (friendshipError || !friendship) {
    return { success: false, error: 'Friend request not found' }
  }

  if (friendship.addressee_id !== user.id) {
    return { success: false, error: 'You can only respond to friend requests sent to you' }
  }

  if (friendship.status !== 'pending') {
    return { success: false, error: 'This friend request has already been responded to' }
  }

  // Accept the request
  const result = await respondToFriendRequest(supabase, friendshipId, 'accepted')

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidatePath('/friends')
  revalidatePath('/notifications')

  return { success: true, data: null }
}

/**
 * Reject a friend request.
 */
export async function rejectFriendRequest(
  friendshipId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify this friendship is addressed to the current user
  const { data: friendship, error: friendshipError } = await supabase
    .from('friends')
    .select('addressee_id, status')
    .eq('id', friendshipId)
    .single()

  if (friendshipError || !friendship) {
    return { success: false, error: 'Friend request not found' }
  }

  if (friendship.addressee_id !== user.id) {
    return { success: false, error: 'You can only respond to friend requests sent to you' }
  }

  if (friendship.status !== 'pending') {
    return { success: false, error: 'This friend request has already been responded to' }
  }

  // Reject by deleting the friendship record
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', friendshipId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/friends')
  revalidatePath('/notifications')

  return { success: true, data: null }
}
