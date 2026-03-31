'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { 
  updateCollection as updateCollectionDb, 
  deleteCollection as deleteCollectionDb,
  getCollectionById,
  addMatchToCollection as addMatchToCollectionDb,
  removeMatchFromCollection as removeMatchFromCollectionDb,
  isCollectionMember,
  getUserCollections,
  updateMatchApprovalStatus,
} from '@/lib/supabase/collections'
import type { Result, MatchAddPermission, CollectionWithMembership, ApprovalStatus } from '@/types'

/**
 * Invite a user to join a collection (owner only).
 * Creates a collection_members entry which triggers the notification.
 */
export async function inviteCollectionMember(
  collectionId: string,
  userId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify ownership
  const collectionResult = await getCollectionById(supabase, collectionId)
  if (!collectionResult.success) {
    return { success: false, error: 'Collection not found' }
  }

  if (collectionResult.data.ownerId !== user.id) {
    return { success: false, error: 'Only the owner can invite members' }
  }

  // Check if user is already a member
  const memberCheck = await isCollectionMember(supabase, collectionId, userId)
  if (memberCheck.success && memberCheck.data) {
    return { success: false, error: 'User is already a member of this collection' }
  }

  // Add the user as a member
  const { error } = await supabase
    .from('collection_members')
    .insert({
      collection_id: collectionId,
      user_id: userId,
      role: 'member',
    })

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate collection pages
  revalidatePath(`/collections/${collectionId}`)
  revalidatePath(`/collections/${collectionId}/members`)

  return { success: true, data: null }
}

/**
 * Update collection settings (owner only)
 */
export async function updateCollectionSettings(
  collectionId: string,
  data: {
    name?: string
    description?: string | null
    isPublic?: boolean
    matchAddPermission?: MatchAddPermission
  }
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify ownership
  const collectionResult = await getCollectionById(supabase, collectionId)
  if (!collectionResult.success) {
    return { success: false, error: 'Collection not found' }
  }

  if (collectionResult.data.ownerId !== user.id) {
    return { success: false, error: 'Only the owner can update collection settings' }
  }

  // Validate name if provided
  if (data.name !== undefined && data.name.trim().length === 0) {
    return { success: false, error: 'Collection name cannot be empty' }
  }

  // Update collection
  const updateResult = await updateCollectionDb(supabase, collectionId, {
    name: data.name?.trim(),
    description: data.description,
    isPublic: data.isPublic,
    matchAddPermission: data.matchAddPermission,
  })

  if (!updateResult.success) {
    return { success: false, error: updateResult.error }
  }

  // Revalidate collection pages
  revalidatePath(`/collections/${collectionId}`)
  revalidatePath(`/collections/${collectionId}/settings`)
  revalidatePath('/collections')

  return { success: true, data: null }
}

/**
 * Delete a collection (owner only)
 */
export async function deleteCollection(
  collectionId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify ownership
  const collectionResult = await getCollectionById(supabase, collectionId)
  if (!collectionResult.success) {
    return { success: false, error: 'Collection not found' }
  }

  if (collectionResult.data.ownerId !== user.id) {
    return { success: false, error: 'Only the owner can delete a collection' }
  }

  // Delete collection
  const deleteResult = await deleteCollectionDb(supabase, collectionId)

  if (!deleteResult.success) {
    return { success: false, error: deleteResult.error }
  }

  // Revalidate collections list
  revalidatePath('/collections')

  return { success: true, data: null }
}

/**
 * Get collections available for adding a match.
 * Returns collections where the user is a member/owner and can add matches.
 */
export async function getCollectionsForMatch(
  matchId: string
): Promise<Result<Array<CollectionWithMembership & { canAddDirectly: boolean; alreadyAdded: boolean }>>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get user's collections
  const collectionsResult = await getUserCollections(supabase, user.id)
  if (!collectionsResult.success) {
    return { success: false, error: collectionsResult.error }
  }

  // Check which collections already have this match
  const { data: existingMatches, error: existingError } = await supabase
    .from('collection_matches')
    .select('collection_id, approval_status')
    .eq('match_id', matchId)

  if (existingError) {
    return { success: false, error: existingError.message }
  }

  const existingMap = new Map(
    existingMatches?.map((m) => [m.collection_id, m.approval_status]) ?? []
  )

  // Determine if user can add directly for each collection
  const result = collectionsResult.data.map((collection) => {
    const isOwner = collection.userRole === 'owner'
    const permission = collection.matchAddPermission
    
    // User can add directly if:
    // - They're the owner, OR
    // - Permission is 'any_member'
    const canAddDirectly = isOwner || permission === 'any_member'

    // Check if already added
    const alreadyAdded = existingMap.has(collection.id)

    return {
      ...collection,
      canAddDirectly,
      alreadyAdded,
    }
  })

  return { success: true, data: result }
}

/**
 * Add a match to a collection.
 * Handles permission checks and approval flow.
 */
export async function addMatchToCollection(
  matchId: string,
  collectionId: string
): Promise<Result<{ status: ApprovalStatus }>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if user is a member of the collection
  const memberCheck = await isCollectionMember(supabase, collectionId, user.id)
  if (!memberCheck.success) {
    return { success: false, error: memberCheck.error }
  }
  if (!memberCheck.data) {
    return { success: false, error: 'You must be a member of the collection to add matches' }
  }

  // Get collection details for permission check
  const collectionResult = await getCollectionById(supabase, collectionId)
  if (!collectionResult.success) {
    return { success: false, error: 'Collection not found' }
  }

  const collection = collectionResult.data
  const isOwner = collection.ownerId === user.id
  const permission = collection.matchAddPermission

  // Check permissions
  if (permission === 'owner_only' && !isOwner) {
    return { success: false, error: 'Only the collection owner can add matches' }
  }

  // Check if match already added
  const { data: existing, error: existingError } = await supabase
    .from('collection_matches')
    .select('id, approval_status')
    .eq('collection_id', collectionId)
    .eq('match_id', matchId)
    .maybeSingle()

  if (existingError) {
    return { success: false, error: existingError.message }
  }

  if (existing) {
    return { success: false, error: 'Match already added to this collection' }
  }

  // Determine approval status
  // - Owner adds: always approved
  // - any_member: approved
  // - any_member_approval_required: pending (unless owner)
  let approvalStatus: ApprovalStatus = 'approved'
  if (!isOwner && permission === 'any_member_approval_required') {
    approvalStatus = 'pending'
  }

  // Add match to collection
  const addResult = await addMatchToCollectionDb(
    supabase,
    collectionId,
    matchId,
    user.id,
    approvalStatus
  )

  if (!addResult.success) {
    return { success: false, error: addResult.error }
  }

  // Revalidate paths
  revalidatePath(`/match/${matchId}`)
  revalidatePath(`/collections/${collectionId}`)

  return { success: true, data: { status: approvalStatus } }
}

/**
 * Remove a match from a collection.
 * Only collection owner can remove matches.
 */
export async function removeMatchFromCollection(
  matchId: string,
  collectionId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify ownership
  const collectionResult = await getCollectionById(supabase, collectionId)
  if (!collectionResult.success) {
    return { success: false, error: 'Collection not found' }
  }

  if (collectionResult.data.ownerId !== user.id) {
    return { success: false, error: 'Only the owner can remove matches from a collection' }
  }

  // Remove match from collection
  const removeResult = await removeMatchFromCollectionDb(supabase, collectionId, matchId)

  if (!removeResult.success) {
    return { success: false, error: removeResult.error }
  }

  // Revalidate paths
  revalidatePath(`/match/${matchId}`)
  revalidatePath(`/collections/${collectionId}`)

  return { success: true, data: null }
}

/**
 * Approve a pending match request in a collection.
 * Only collection owner can approve.
 */
export async function approveCollectionMatch(
  collectionMatchId: string,
  collectionId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify ownership
  const collectionResult = await getCollectionById(supabase, collectionId)
  if (!collectionResult.success) {
    return { success: false, error: 'Collection not found' }
  }

  if (collectionResult.data.ownerId !== user.id) {
    return { success: false, error: 'Only the owner can approve match requests' }
  }

  // Update approval status
  const updateResult = await updateMatchApprovalStatus(supabase, collectionMatchId, 'approved')

  if (!updateResult.success) {
    return { success: false, error: updateResult.error }
  }

  // Revalidate paths
  revalidatePath(`/collections/${collectionId}`)

  return { success: true, data: null }
}

/**
 * Reject a pending match request in a collection.
 * Only collection owner can reject.
 */
export async function rejectCollectionMatch(
  collectionMatchId: string,
  collectionId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify ownership
  const collectionResult = await getCollectionById(supabase, collectionId)
  if (!collectionResult.success) {
    return { success: false, error: 'Collection not found' }
  }

  if (collectionResult.data.ownerId !== user.id) {
    return { success: false, error: 'Only the owner can reject match requests' }
  }

  // Update approval status
  const updateResult = await updateMatchApprovalStatus(supabase, collectionMatchId, 'rejected')

  if (!updateResult.success) {
    return { success: false, error: updateResult.error }
  }

  // Revalidate paths
  revalidatePath(`/collections/${collectionId}`)

  return { success: true, data: null }
}