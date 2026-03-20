/**
 * Mock Friendship Factories
 */

import type {
  Friend,
  Friendship,
  FriendRequest,
  FriendshipStatus,
} from '@/types'
import { createMockProfileSummary } from './profile'
import { generateMockDate, generateMockId } from './utils'

// ============================================
// Factory Functions
// ============================================

export function createMockFriendship(
  overrides: Partial<Friendship> = {}
): Friendship {
  return {
    id: generateMockId(),
    requesterId: generateMockId(),
    addresseeId: generateMockId(),
    status: 'accepted' as FriendshipStatus,
    createdAt: generateMockDate(30),
    ...overrides,
  }
}

export function createMockFriend(overrides: Partial<Friend> = {}): Friend {
  const profile = createMockProfileSummary(overrides)
  return {
    ...profile,
    friendshipId: generateMockId(),
    friendsSince: generateMockDate(60),
    ...overrides,
  }
}

export function createMockFriendRequest(
  overrides: Partial<FriendRequest> = {}
): FriendRequest {
  return {
    id: generateMockId(),
    from: createMockProfileSummary(),
    createdAt: generateMockDate(1),
    ...overrides,
  }
}
