'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { 
  getMatchWithDetails, 
  updateParticipantDeck,
  claimPlaceholderSlot,
  approveSlotClaim,
  rejectSlotClaim,
  searchClaimableMatches,
  createMatch,
} from '@/lib/supabase/matches'
import { getRating, applyRatingChange, updateCollectionRatings } from '@/lib/supabase/ratings'
import { getMatchCollections, getUserMemberCollections, addMatchToCollection, getCollectionById, isCollectionMember } from '@/lib/supabase/collections'
import { calculateRating } from '@/lib/rating'
import type { Result, Bracket, ClaimableMatchSlot, ClaimStatus, CreateMatchPayload, MatchData, ParticipantInput, ApprovalStatus, ParticipantStatus } from '@/types'

/**
 * Log a new match with participants.
 * 
 * This action:
 * 1. Creates the match and participant records (with locks_at set by DB trigger)
 * 2. Sets creator's participant_status to 'confirmed'
 * 3. Calculates rating PREVIEW (but does NOT apply to ratings table)
 * 4. Returns preview delta for UI display
 * 
 * Ratings are applied when the lock window expires (via applyMatchRatings).
 */
export async function logMatch(payload: {
  formatId: string
  playedAt?: string
  notes?: string | null
  matchData: MatchData
  participants: ParticipantInput[]
  winnerIndices: number[]
  collectionIds?: string[]
}): Promise<Result<{ matchId: string; previewDelta: number; locksAt: string }>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Create match via the supabase helper
  const matchResult = await createMatch(supabase, user.id, payload as CreateMatchPayload)
  if (!matchResult.success) {
    return { success: false, error: matchResult.error }
  }

  const match = matchResult.data

  // Get the match with locks_at field
  const { data: matchWithLock } = await supabase
    .from('matches')
    .select('locks_at')
    .eq('id', match.id)
    .single()
  
  const locksAt = matchWithLock?.locks_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // Update creator's participant status to 'confirmed'
  await supabase
    .from('match_participants')
    .update({ 
      participant_status: 'confirmed' as ParticipantStatus,
      confirmed_at: new Date().toISOString()
    })
    .eq('match_id', match.id)
    .eq('user_id', user.id)

  // Find the creator's participant record for preview calculation
  const { data: creatorParticipant, error: participantError } = await supabase
    .from('match_participants')
    .select(`
      id,
      is_winner,
      deck_id,
      deck:decks!match_participants_deck_id_fkey(bracket)
    `)
    .eq('match_id', match.id)
    .eq('user_id', user.id)
    .single()

  if (participantError || !creatorParticipant) {
    // Match was created but creator not a participant - unusual but valid
    revalidatePath('/matches')
    revalidatePath(`/match/${match.id}`)
    return { success: true, data: { matchId: match.id, previewDelta: 0, locksAt } }
  }

  // Get format info
  const { data: format, error: formatError } = await supabase
    .from('formats')
    .select('id')
    .eq('id', payload.formatId)
    .single()

  if (formatError || !format) {
    revalidatePath('/matches')
    revalidatePath(`/match/${match.id}`)
    return { success: true, data: { matchId: match.id, previewDelta: 0, locksAt } }
  }

  // Get creator's current rating for preview calculation
  const ratingResult = await getRating(supabase, user.id, format.id)
  if (!ratingResult.success) {
    revalidatePath('/matches')
    revalidatePath(`/match/${match.id}`)
    return { success: true, data: { matchId: match.id, previewDelta: 0, locksAt } }
  }

  const currentRating = ratingResult.data

  // Gather opponent data for rating preview calculation
  const { data: allParticipants } = await supabase
    .from('match_participants')
    .select(`
      id,
      user_id,
      deck:decks!match_participants_deck_id_fkey(bracket)
    `)
    .eq('match_id', match.id)
    .neq('user_id', user.id)

  const opponents: Array<{ rating: number; bracket: Bracket }> = []
  
  for (const p of allParticipants ?? []) {
    if (p.user_id) {
      const oppRatingResult = await getRating(supabase, p.user_id, format.id)
      const oppRating = oppRatingResult.success ? oppRatingResult.data.rating : 1000
      const bracket: Bracket = (p.deck?.bracket as Bracket) ?? 2
      opponents.push({ rating: oppRating, bracket })
    }
    // Placeholders excluded from rating calculations
  }

  const playerBracket: Bracket = (creatorParticipant.deck?.bracket as Bracket) ?? 2

  // Calculate rating PREVIEW (not applied yet)
  const ratingCalc = calculateRating({
    playerId: user.id,
    playerRating: currentRating.rating,
    playerBracket,
    playerMatchCount: currentRating.matchesPlayed,
    isWinner: creatorParticipant.is_winner,
    opponents,
    formatId: format.id,
    collectionId: null,
  })

  // NOTE: Ratings are NOT applied here — they're applied when lock window expires
  // via applyMatchRatings() or the scheduled job

  // Add match to selected collections
  if (payload.collectionIds && payload.collectionIds.length > 0) {
    for (const collectionId of payload.collectionIds) {
      // Verify user is a member of the collection
      const memberCheck = await isCollectionMember(supabase, collectionId, user.id)
      if (!memberCheck.success || !memberCheck.data) {
        continue // Skip collections the user is not a member of
      }

      // Get collection details for permission check
      const collectionResult = await getCollectionById(supabase, collectionId)
      if (!collectionResult.success) {
        continue
      }

      const collection = collectionResult.data
      const isOwner = collection.ownerId === user.id
      const permission = collection.matchAddPermission

      // Check permissions
      if (permission === 'owner_only' && !isOwner) {
        continue // User doesn't have permission
      }

      // Determine approval status
      let approvalStatus: ApprovalStatus = 'approved'
      if (!isOwner && permission === 'any_member_approval_required') {
        approvalStatus = 'pending'
      }

      // Add match to collection
      await addMatchToCollection(supabase, collectionId, match.id, user.id, approvalStatus)
      revalidatePath(`/collections/${collectionId}`)
    }
  }

  // Revalidate pages
  revalidatePath('/dashboard')
  revalidatePath('/matches')
  revalidatePath(`/match/${match.id}`)

  return {
    success: true,
    data: {
      matchId: match.id,
      previewDelta: ratingCalc.delta,
      locksAt,
    },
  }
}

/**
 * Confirm a match participation (early confirmation before lock window expires).
 * 
 * Flow:
 * 1. Validate user owns this participation
 * 2. Check match is not yet locked
 * 3. If deckId provided, update participant's deck
 * 4. Set participant_status to 'confirmed' and confirmed_at timestamp
 * 5. Calculate rating PREVIEW for UI display
 * 
 * NOTE: Ratings are NOT applied here — they're applied when lock window expires.
 */
export async function confirmMatch(
  participantId: string,
  deckId?: string
): Promise<Result<{ previewDelta: number }>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get the participant record with match info
  const { data: participant, error: participantError } = await supabase
    .from('match_participants')
    .select(`
      id,
      user_id,
      match_id,
      is_winner,
      confirmed_at,
      participant_status,
      deck_id,
      deck:decks!match_participants_deck_id_fkey(bracket),
      match:matches!inner(locks_at, ratings_applied_at)
    `)
    .eq('id', participantId)
    .single()

  if (participantError || !participant) {
    return { success: false, error: 'Participant not found' }
  }

  // Verify this is the user's participation
  if (participant.user_id !== user.id) {
    return { success: false, error: 'You can only confirm your own matches' }
  }

  // Check if already confirmed
  if (participant.confirmed_at || participant.participant_status !== 'pending') {
    return { success: false, error: 'Match already confirmed' }
  }

  // Check if ratings have already been applied (match is fully locked)
  const matchInfo = participant.match as { locks_at: string; ratings_applied_at: string | null }
  if (matchInfo.ratings_applied_at) {
    return { success: false, error: 'Match ratings have already been applied' }
  }

  // If deck provided, update it
  if (deckId) {
    const updateResult = await updateParticipantDeck(supabase, participantId, deckId)
    if (!updateResult.success) {
      return { success: false, error: updateResult.error }
    }
  }

  // Update participant status to confirmed
  const { error: updateError } = await supabase
    .from('match_participants')
    .update({
      participant_status: 'confirmed' as ParticipantStatus,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', participantId)

  if (updateError) {
    return { success: false, error: `Failed to confirm: ${updateError.message}` }
  }

  // Calculate rating PREVIEW for UI display
  const matchResult = await getMatchWithDetails(supabase, participant.match_id)
  if (!matchResult.success) {
    // Confirmed but can't calculate preview - return 0
    revalidatePath('/dashboard')
    revalidatePath('/matches')
    revalidatePath(`/match/${participant.match_id}`)
    return { success: true, data: { previewDelta: 0 } }
  }
  
  const match = matchResult.data

  const { data: format } = await supabase
    .from('formats')
    .select('id')
    .eq('id', match.formatId)
    .single()

  if (!format) {
    revalidatePath('/dashboard')
    revalidatePath('/matches')
    revalidatePath(`/match/${participant.match_id}`)
    return { success: true, data: { previewDelta: 0 } }
  }

  const ratingResult = await getRating(supabase, user.id, format.id)
  const currentRating = ratingResult.success ? ratingResult.data : { rating: 1000, matchesPlayed: 0 }

  // Build opponent data for preview calculation
  const opponents: Array<{ rating: number; bracket: Bracket }> = []
  
  for (const p of match.participants) {
    if (p.userId && p.userId !== user.id) {
      const oppRatingResult = await getRating(supabase, p.userId, format.id)
      const oppRating = oppRatingResult.success ? oppRatingResult.data.rating : 1000
      const bracket: Bracket = (p as { deck?: { bracket?: Bracket } }).deck?.bracket ?? 2
      opponents.push({ rating: oppRating, bracket })
    }
    // Placeholders excluded from rating calculations
  }

  let playerBracket: Bracket = 2
  if (deckId) {
    const { data: newDeck } = await supabase
      .from('decks')
      .select('bracket')
      .eq('id', deckId)
      .single()
    if (newDeck) {
      playerBracket = newDeck.bracket as Bracket
    }
  } else if (participant.deck) {
    playerBracket = (participant.deck.bracket as Bracket) ?? 2
  }

  // Calculate preview (not applied)
  const ratingCalc = calculateRating({
    playerId: user.id,
    playerRating: currentRating.rating,
    playerBracket,
    playerMatchCount: currentRating.matchesPlayed,
    isWinner: participant.is_winner,
    opponents,
    formatId: format.id,
    collectionId: null,
  })

  // Revalidate relevant pages
  revalidatePath('/dashboard')
  revalidatePath('/matches')
  revalidatePath(`/match/${participant.match_id}`)
  revalidatePath('/notifications')

  return {
    success: true,
    data: {
      previewDelta: ratingCalc.delta,
    },
  }
}

/**
 * Apply ratings for a match when the lock window has expired.
 * 
 * This is called by a cron job / edge function when locks_at has passed.
 * It:
 * 1. Gets all confirmed participants (status = 'confirmed' or 'auto_confirmed')
 * 2. Calculates and applies rating changes for each
 * 3. Updates collection-scoped ratings
 * 4. Marks the match as ratings_applied_at
 * 
 * Placeholders are excluded from rating calculations.
 */
export async function applyMatchRatings(
  matchId: string
): Promise<Result<{ appliedCount: number }>> {
  const supabase = await createClient()

  // Get current user (for admin/cron context verification if needed)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get the match with all details
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select(`
      id,
      format_id,
      locks_at,
      ratings_applied_at,
      is_dirty,
      created_by
    `)
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { success: false, error: 'Match not found' }
  }

  // Only allow if user is match creator (for manual trigger) or in future: admin
  if (match.created_by !== user.id) {
    return { success: false, error: 'Only match creator can trigger rating application' }
  }

  // Check if ratings already applied
  if (match.ratings_applied_at) {
    return { success: false, error: 'Ratings have already been applied' }
  }

  // Check if lock window has actually passed
  const locksAt = new Date(match.locks_at)
  const now = new Date()
  if (now < locksAt) {
    return { success: false, error: 'Lock window has not expired yet' }
  }

  // Get all participants
  const { data: participants, error: participantsError } = await supabase
    .from('match_participants')
    .select(`
      id,
      user_id,
      is_winner,
      participant_status,
      deck:decks!match_participants_deck_id_fkey(id, bracket)
    `)
    .eq('match_id', matchId)

  if (participantsError || !participants) {
    return { success: false, error: 'Failed to fetch participants' }
  }

  // Filter to only real users (not placeholders)
  const realParticipants = participants.filter(p => p.user_id !== null)

  // Auto-confirm any pending participants (they didn't confirm within window)
  for (const p of realParticipants) {
    if (p.participant_status === 'pending') {
      await supabase
        .from('match_participants')
        .update({
          participant_status: 'auto_confirmed' as ParticipantStatus,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', p.id)
    }
  }

  // Build opponent map for rating calculations
  const participantRatings: Map<string, { rating: number; matchesPlayed: number }> = new Map()
  
  for (const p of realParticipants) {
    if (p.user_id) {
      const ratingResult = await getRating(supabase, p.user_id, match.format_id)
      if (ratingResult.success) {
        participantRatings.set(p.user_id, ratingResult.data)
      } else {
        participantRatings.set(p.user_id, { rating: 1000, matchesPlayed: 0 })
      }
    }
  }

  // Calculate and apply ratings for each real participant
  let appliedCount = 0

  for (const participant of realParticipants) {
    if (!participant.user_id) continue

    const currentRating = participantRatings.get(participant.user_id)!
    const playerBracket: Bracket = (participant.deck?.bracket as Bracket) ?? 2

    // Build opponents array (excluding this participant and placeholders)
    const opponents: Array<{ rating: number; bracket: Bracket }> = []
    for (const p of realParticipants) {
      if (p.user_id && p.user_id !== participant.user_id) {
        const oppRating = participantRatings.get(p.user_id)!.rating
        const bracket: Bracket = (p.deck?.bracket as Bracket) ?? 2
        opponents.push({ rating: oppRating, bracket })
      }
    }

    // Calculate rating change
    const ratingCalc = calculateRating({
      playerId: participant.user_id,
      playerRating: currentRating.rating,
      playerBracket,
      playerMatchCount: currentRating.matchesPlayed,
      isWinner: participant.is_winner,
      opponents,
      formatId: match.format_id,
      collectionId: null,
    })

    // Apply global rating change
    const newRating = currentRating.rating + ratingCalc.delta
    const applyResult = await applyRatingChange(supabase, {
      userId: participant.user_id,
      matchId: match.id,
      formatId: match.format_id,
      newRating,
      delta: ratingCalc.delta,
      isWin: participant.is_winner,
      playerBracket,
      opponentAvgRating: ratingCalc.opponentAvgRating,
      opponentAvgBracket: ratingCalc.opponentAvgBracket,
      kFactor: ratingCalc.kFactor,
      algorithmVersion: 1,
    })

    if (applyResult.success) {
      appliedCount++

      // Update collection-scoped ratings
      const matchCollectionsResult = await getMatchCollections(supabase, match.id)
      if (matchCollectionsResult.success && matchCollectionsResult.data.length > 0) {
        const userMemberCollectionsResult = await getUserMemberCollections(
          supabase,
          participant.user_id,
          matchCollectionsResult.data
        )

        if (userMemberCollectionsResult.success && userMemberCollectionsResult.data.length > 0) {
          await updateCollectionRatings(supabase, {
            userId: participant.user_id,
            matchId: match.id,
            formatId: match.format_id,
            playerBracket,
            isWinner: participant.is_winner,
            opponents,
            collectionIds: userMemberCollectionsResult.data,
            algorithmVersion: 1,
          })
        }
      }
    }
  }

  // Mark match as ratings applied
  const { error: updateError } = await supabase
    .from('matches')
    .update({
      ratings_applied_at: new Date().toISOString(),
      is_dirty: false, // Reset dirty flag since we just applied
      last_recalculated_at: new Date().toISOString(),
    })
    .eq('id', matchId)

  if (updateError) {
    return { success: false, error: `Failed to mark match: ${updateError.message}` }
  }

  // Revalidate pages
  revalidatePath('/dashboard')
  revalidatePath('/matches')
  revalidatePath(`/match/${matchId}`)

  return {
    success: true,
    data: { appliedCount },
  }
}

/**
 * Edit match details.
 * 
 * Allowed edits:
 * - notes: Always editable
 * - played_at: Always editable (subject to backdate limit)
 * 
 * Note: Winner, format, and participants cannot be changed after match creation.
 */
export async function editMatch(
  matchId: string,
  updates: {
    notes?: string | null
    playedAt?: string
  }
): Promise<Result<null>> {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get match details
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, created_by, ratings_applied_at')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { success: false, error: 'Match not found' }
  }

  // Only match creator can edit
  if (match.created_by !== user.id) {
    return { success: false, error: 'Only the match creator can edit match details' }
  }

  // Build update object
  const updateData: Record<string, unknown> = {}

  if (updates.notes !== undefined) {
    updateData.notes = updates.notes
  }

  if (updates.playedAt !== undefined) {
    // Validate played_at against backdate limit
    const { data: settings } = await supabase
      .from('app_settings')
      .select('backdate_limit_days')
      .eq('key', 'global')
      .single()

    const backdateLimitDays = settings?.backdate_limit_days ?? 30
    const backdateLimit = new Date()
    backdateLimit.setDate(backdateLimit.getDate() - backdateLimitDays)

    const playedAt = new Date(updates.playedAt)
    if (playedAt < backdateLimit) {
      return { 
        success: false, 
        error: `Match date cannot be more than ${backdateLimitDays} days in the past` 
      }
    }

    if (playedAt > new Date()) {
      return { success: false, error: 'Match date cannot be in the future' }
    }

    updateData.played_at = updates.playedAt

    // If ratings already applied and played_at changed, mark dirty for recalculation
    // (because rating history is date-ordered)
    if (match.ratings_applied_at) {
      updateData.is_dirty = true
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'No valid updates provided' }
  }

  // Apply updates
  const { error: updateError } = await supabase
    .from('matches')
    .update(updateData)
    .eq('id', matchId)

  if (updateError) {
    return { success: false, error: `Failed to update: ${updateError.message}` }
  }

  // Revalidate pages
  revalidatePath(`/match/${matchId}`)
  revalidatePath('/matches')

  return { success: true, data: null }
}

// ============================================
// Claim System Actions
// ============================================

/**
 * Search for matches with claimable placeholder slots
 */
export async function searchForClaimableMatches(
  searchName: string
): Promise<Result<ClaimableMatchSlot[]>> {
  if (!searchName || searchName.trim().length < 2) {
    return { success: false, error: 'Search name must be at least 2 characters' }
  }

  const supabase = await createClient()
  
  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  return searchClaimableMatches(supabase, searchName.trim())
}

/**
 * Submit a claim request for a placeholder slot
 */
export async function submitClaimRequest(
  participantId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify the slot is claimable
  const { data: participant, error: fetchError } = await supabase
    .from('match_participants')
    .select('id, match_id, user_id, claim_status, claimed_by')
    .eq('id', participantId)
    .single()

  if (fetchError || !participant) {
    return { success: false, error: 'Participant slot not found' }
  }

  if (participant.user_id !== null) {
    return { success: false, error: 'This slot is already claimed by a user' }
  }

  if (participant.claim_status === 'pending') {
    return { success: false, error: 'This slot already has a pending claim' }
  }

  // Check if user is already a participant in this match
  const { data: existingParticipation } = await supabase
    .from('match_participants')
    .select('id')
    .eq('match_id', participant.match_id)
    .eq('user_id', user.id)
    .single()

  if (existingParticipation) {
    return { success: false, error: 'You are already a participant in this match' }
  }

  // Submit the claim
  const result = await claimPlaceholderSlot(supabase, participantId, user.id)
  
  if (!result.success) {
    return { success: false, error: result.error }
  }

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`)
  revalidatePath('/matches/claim')

  return { success: true, data: null }
}

/**
 * Approve a claim request (match creator only)
 */
export async function approveClaimRequest(
  participantId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get the participant and verify match creator
  const { data: participant, error: fetchError } = await supabase
    .from('match_participants')
    .select(`
      id,
      match_id,
      claim_status,
      claimed_by,
      match:matches!inner (
        created_by
      )
    `)
    .eq('id', participantId)
    .single()

  if (fetchError || !participant) {
    return { success: false, error: 'Participant slot not found' }
  }

  const match = participant.match as { created_by: string }
  if (match.created_by !== user.id) {
    return { success: false, error: 'Only the match creator can approve claims' }
  }

  if (participant.claim_status !== 'pending' || !participant.claimed_by) {
    return { success: false, error: 'No pending claim to approve' }
  }

  // Approve the claim
  const result = await approveSlotClaim(supabase, participantId)
  
  if (!result.success) {
    return { success: false, error: result.error }
  }

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`)
  revalidatePath('/dashboard')
  revalidatePath('/notifications')

  return { success: true, data: null }
}

/**
 * Reject a claim request (match creator only)
 */
export async function rejectClaimRequest(
  participantId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get the participant and verify match creator
  const { data: participant, error: fetchError } = await supabase
    .from('match_participants')
    .select(`
      id,
      match_id,
      claim_status,
      match:matches!inner (
        created_by
      )
    `)
    .eq('id', participantId)
    .single()

  if (fetchError || !participant) {
    return { success: false, error: 'Participant slot not found' }
  }

  const match = participant.match as { created_by: string }
  if (match.created_by !== user.id) {
    return { success: false, error: 'Only the match creator can reject claims' }
  }

  if (participant.claim_status !== 'pending') {
    return { success: false, error: 'No pending claim to reject' }
  }

  // Reject the claim (resets to 'none' for re-claiming)
  const result = await rejectSlotClaim(supabase, participantId)
  
  if (!result.success) {
    return { success: false, error: result.error }
  }

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`)
  revalidatePath('/notifications')

  return { success: true, data: null }
}

/**
 * Update a participant's deck.
 * 
 * Deck updates are always allowed (even post-lock) because:
 * - Users may have forgotten to set their deck initially
 * - It corrects commander stats tracking
 * 
 * If ratings have already been applied, this marks the match as dirty
 * for future recalculation.
 */
export async function updateMatchParticipantDeck(
  participantId: string,
  deckId: string
): Promise<Result<null>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get the participant with match info
  const { data: participant, error: fetchError } = await supabase
    .from('match_participants')
    .select(`
      id, 
      match_id, 
      user_id, 
      confirmed_at,
      match:matches!inner(ratings_applied_at)
    `)
    .eq('id', participantId)
    .single()

  if (fetchError || !participant) {
    return { success: false, error: 'Participant slot not found' }
  }

  if (participant.user_id !== user.id) {
    return { success: false, error: 'You can only update your own deck' }
  }

  // Verify the deck belongs to the user
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('id, owner_id')
    .eq('id', deckId)
    .single()

  if (deckError || !deck) {
    return { success: false, error: 'Deck not found' }
  }

  if (deck.owner_id !== user.id) {
    return { success: false, error: 'You can only use your own decks' }
  }

  // Update the deck
  const result = await updateParticipantDeck(supabase, participantId, deckId)
  
  if (!result.success) {
    return { success: false, error: result.error }
  }

  // If ratings have already been applied, mark match as dirty for recalculation
  const matchInfo = participant.match as { ratings_applied_at: string | null }
  if (matchInfo.ratings_applied_at) {
    await supabase
      .from('matches')
      .update({ is_dirty: true })
      .eq('id', participant.match_id)
  }

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`)
  revalidatePath('/matches')

  return { success: true, data: null }
}

// ============================================
// Invite Token Actions
// ============================================

/**
 * Generate a token string (12 chars, URL-safe, no ambiguous characters)
 */
function generateToken(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Create an invite token for a match.
 * Only the match creator can generate invite tokens.
 */
export async function createMatchInviteToken(
  matchId: string
): Promise<Result<{ token: string; inviteUrl: string }>> {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify user is the match creator
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, created_by')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { success: false, error: 'Match not found' }
  }

  if (match.created_by !== user.id) {
    return { success: false, error: 'Only the match creator can generate invite links' }
  }

  // Check if there are any unclaimed placeholder slots
  const { data: placeholderSlots } = await supabase
    .from('match_participants')
    .select('id')
    .eq('match_id', matchId)
    .is('user_id', null)
    .eq('claim_status', 'none')

  if (!placeholderSlots || placeholderSlots.length === 0) {
    return { success: false, error: 'No unclaimed placeholder slots in this match' }
  }

  // Generate a unique token
  let token = generateToken()
  let attempts = 0
  const maxAttempts = 5

  // Check for collisions (extremely rare but possible)
  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('match_invite_tokens')
      .select('id')
      .eq('token', token)
      .single()

    if (!existing) break
    token = generateToken()
    attempts++
  }

  if (attempts >= maxAttempts) {
    return { success: false, error: 'Failed to generate unique token. Please try again.' }
  }

  // Create the token record
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30) // 30 days expiry

  const { error: insertError } = await supabase
    .from('match_invite_tokens')
    .insert({
      match_id: matchId,
      token,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
    })

  if (insertError) {
    console.error('Failed to create invite token:', insertError)
    return { success: false, error: `Failed to create invite token: ${insertError.message}` }
  }

  return {
    success: true,
    data: {
      token,
      inviteUrl: `/claim/${token}`,
    },
  }
}

/**
 * Get match details by invite token.
 * Used to display the claim page when a guest clicks an invite link.
 */
export async function getMatchByInviteToken(
  token: string
): Promise<Result<{
  match: {
    id: string
    formatName: string
    formatSlug: string
    playedAt: string
    creatorUsername: string
    participantCount: number
  }
  placeholderSlots: Array<{
    participantId: string
    placeholderName: string
    claimStatus: ClaimStatus
    hasPendingClaim: boolean
  }>
  isExpired: boolean
  isUsed: boolean
}>> {
  const supabase = await createClient()

  // Get the token record
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('match_invite_tokens')
    .select(`
      id,
      match_id,
      expires_at,
      used_at,
      used_by
    `)
    .eq('token', token)
    .single()

  if (tokenError || !tokenRecord) {
    return { success: false, error: 'Invalid invite token' }
  }

  const isExpired = new Date(tokenRecord.expires_at) < new Date()
  const isUsed = tokenRecord.used_at !== null

  // Get match details
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select(`
      id,
      played_at,
      format:formats!inner (
        name,
        slug
      ),
      creator:profiles!inner (
        username
      )
    `)
    .eq('id', tokenRecord.match_id)
    .single()

  if (matchError || !match) {
    return { success: false, error: 'Match not found' }
  }

  // Get placeholder slots
  const { data: participants } = await supabase
    .from('match_participants')
    .select(`
      id,
      placeholder_name,
      user_id,
      claim_status,
      claimed_by
    `)
    .eq('match_id', tokenRecord.match_id)

  // Get count of all participants
  const participantCount = participants?.length ?? 0

  // Filter to just placeholder slots
  const placeholderSlots = (participants ?? [])
    .filter(p => p.user_id === null)
    .map(p => ({
      participantId: p.id,
      placeholderName: p.placeholder_name ?? 'Unknown',
      claimStatus: p.claim_status as ClaimStatus,
      hasPendingClaim: p.claim_status === 'pending' && p.claimed_by !== null,
    }))

  return {
    success: true,
    data: {
      match: {
        id: match.id,
        formatName: (match.format as { name: string }).name,
        formatSlug: (match.format as { slug: string }).slug,
        playedAt: match.played_at,
        creatorUsername: (match.creator as { username: string }).username,
        participantCount,
      },
      placeholderSlots,
      isExpired,
      isUsed,
    },
  }
}

/**
 * Check if a match has any existing invite tokens.
 * Returns the most recent active token if one exists.
 */
export async function getExistingInviteToken(
  matchId: string
): Promise<Result<{ token: string; inviteUrl: string } | null>> {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify user is the match creator
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, created_by')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { success: false, error: 'Match not found' }
  }

  if (match.created_by !== user.id) {
    return { success: false, error: 'Only the match creator can view invite links' }
  }

  // Get the most recent non-expired token
  const { data: tokenRecord } = await supabase
    .from('match_invite_tokens')
    .select('token, expires_at')
    .eq('match_id', matchId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!tokenRecord) {
    return { success: true, data: null }
  }

  return {
    success: true,
    data: {
      token: tokenRecord.token,
      inviteUrl: `/claim/${tokenRecord.token}`,
    },
  }
}
