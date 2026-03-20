/**
 * Mock Collection Factories
 */

import type {
  Collection,
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
