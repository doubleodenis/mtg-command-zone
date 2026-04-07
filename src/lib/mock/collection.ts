/**
 * Mock Collection Factories
 */

import type {
  Collection,
  CollectionActivity,
  CollectionMember,
  CollectionMemberWithProfile,
  CollectionSummary,
  CollectionWithMembers,
} from '@/types'
import { createMockProfileSummary } from './profile'
import { generateMockDate, generateMockId } from './utils'

// ============================================
// Mock Data
// ============================================

const MOCK_COLLECTION_NAMES = [
  'Friday Night Commander',
  'Summer Tournament 2025',
  'Casual Pod',
  'CEDH League',
  'Office Games',
]

// ============================================
// Factory Functions
// ============================================

export function createMockCollection(
  overrides: Partial<Collection> = {}
): Collection {
  const id = overrides.id ?? generateMockId()
  const index = parseInt(id.split('-')[1] || '0') % MOCK_COLLECTION_NAMES.length

  return {
    id,
    ownerId: generateMockId(),
    name: MOCK_COLLECTION_NAMES[index],
    description: 'A collection of epic Commander matches',
    isPublic: true,
    matchAddPermission: 'any_member',
    autoApproveMembers: false,
    createdAt: generateMockDate(90),
    ...overrides,
  }
}

export function createMockCollectionSummary(
  overrides: Partial<CollectionSummary> = {}
): CollectionSummary {
  const collection = createMockCollection(overrides)
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    isPublic: collection.isPublic,
    memberCount: overrides.memberCount ?? 5,
    matchCount: overrides.matchCount ?? 24,
  }
}

export function createMockCollectionMember(
  overrides: Partial<CollectionMember> = {}
): CollectionMember {
  return {
    id: generateMockId(),
    collectionId: generateMockId(),
    userId: generateMockId(),
    role: 'member',
    joinedAt: generateMockDate(30),
    ...overrides,
  }
}

export function createMockCollectionMemberWithProfile(
  overrides: Partial<CollectionMemberWithProfile> = {}
): CollectionMemberWithProfile {
  const member = createMockCollectionMember(overrides)
  return {
    ...member,
    profile: createMockProfileSummary({ id: member.userId }),
    ...overrides,
  }
}

export function createMockCollectionWithMembers(
  memberCount = 5,
  overrides: Partial<CollectionWithMembers> = {}
): CollectionWithMembers {
  const collection = createMockCollection(overrides)
  const owner = createMockProfileSummary({ id: collection.ownerId })

  const members: CollectionMemberWithProfile[] = [
    createMockCollectionMemberWithProfile({
      collectionId: collection.id,
      userId: owner.id,
      role: 'owner',
      profile: owner,
    }),
    ...Array.from({ length: memberCount - 1 }, () =>
      createMockCollectionMemberWithProfile({ collectionId: collection.id })
    ),
  ]

  return {
    ...collection,
    owner,
    members,
    ...overrides,
  }
}

/**
 * Create mock collection activity with user stats
 */
export function createMockCollectionActivity(
  overrides: Partial<CollectionActivity> = {}
): CollectionActivity {
  const gamesPlayed = 12 + Math.floor(Math.random() * 20)
  const wins = Math.floor(gamesPlayed * (0.35 + Math.random() * 0.3))
  const rating = 1000 + Math.floor(Math.random() * 400)
  const ratingDelta = Math.floor(Math.random() * 50) * (Math.random() > 0.5 ? 1 : -1)

  return {
    collection: createMockCollectionSummary(),
    userStats: {
      gamesPlayed,
      wins,
      winRate: Math.round((wins / gamesPlayed) * 100),
      rating,
      ratingDelta,
      unconfirmedMatchCount: Math.floor(Math.random() * 3),
      pendingApprovalCount: Math.floor(Math.random() * 2),
    },
    topPlayer: {
      profile: createMockProfileSummary(),
      winRate: 55 + Math.floor(Math.random() * 20),
      gamesPlayed: 15 + Math.floor(Math.random() * 30),
    },
    ...overrides,
  }
}

/**
 * Create multiple mock collection activities with variety
 */
export function createMockCollectionActivities(count = 3): CollectionActivity[] {
  const collectionNames = [
    'Friday Night Commander',
    'CEDH League',
    'Casual Pod',
    'Office Games',
    'Summer Tournament',
  ]

  return Array.from({ length: count }, (_, i) => {
    const gamesPlayed = 8 + Math.floor(Math.random() * 25)
    const wins = Math.floor(gamesPlayed * (0.3 + Math.random() * 0.4))
    const rating = 950 + Math.floor(Math.random() * 350)
    const ratingDelta = Math.floor(Math.random() * 40) * (Math.random() > 0.4 ? 1 : -1)

    return createMockCollectionActivity({
      collection: createMockCollectionSummary({
        name: collectionNames[i % collectionNames.length],
        memberCount: 4 + Math.floor(Math.random() * 8),
        matchCount: 15 + Math.floor(Math.random() * 50),
      }),
      userStats: {
        gamesPlayed,
        wins,
        winRate: Math.round((wins / gamesPlayed) * 100),
        rating,
        ratingDelta,
        unconfirmedMatchCount: Math.floor(Math.random() * 3),
        pendingApprovalCount: Math.floor(Math.random() * 2),
      },
    })
  })
}
