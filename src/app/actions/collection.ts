'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { 
  updateCollection as updateCollectionDb, 
  deleteCollection as deleteCollectionDb,
  getCollectionById,
} from '@/lib/supabase/collections'
import type { Result, MatchAddPermission } from '@/types'

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
