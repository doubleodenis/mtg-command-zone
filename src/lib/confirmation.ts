import type { FriendshipStatus } from '@/types/friendship'

/**
 * A participant is auto-confirmed (and rated) immediately if they're the
 * match reporter, or already an accepted friend of the reporter. Everyone
 * else stays pending until they confirm themselves or become friends with
 * the reporter later.
 */
export function shouldAutoConfirmParticipant(params: {
  reporterId: string
  participantUserId: string
  friendshipStatus: FriendshipStatus | null
}): boolean {
  if (params.participantUserId === params.reporterId) return true
  return params.friendshipStatus === 'accepted'
}
