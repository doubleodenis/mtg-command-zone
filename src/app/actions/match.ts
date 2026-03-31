'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { 
  confirmMatchParticipation, 
  getMatchWithDetails, 
  updateParticipantDeck,
  claimPlaceholderSlot,
  approveSlotClaim,
  rejectSlotClaim,
  searchClaimableMatches,
} from '@/lib/supabase/matches'
import { getRating, updateRating, recordRatingHistory, updateCollectionRatings } from '@/lib/supabase/ratings'
import { getMatchCollections, getUserMemberCollections } from '@/lib/supabase/collections'
import { calculateRating } from '@/lib/rating'
import type { Result, Bracket, ClaimableMatchSlot } from '@/types'

/**
 * Confirm a match participation and trigger rating update.
 * 
 * Flow:
 * 1. Validate user owns this participation
 * 2. If deckId provided, update participant's deck
 * 3. Set confirmed_at timestamp
 * 4. Calculate rating change based on all participants
 * 5. Update rating and record history
 */
export async function confirmMatch(
  participantId: string,
  deckId?: string
): Promise<Result<{ delta: number; newRating: number }>> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get the participant record
  const { data: participant, error: participantError } = await supabase
    .from('match_participants')
    .select(`
      id,
      user_id,
      match_id,
      is_winner,
      confirmed_at,
      deck_id,
      deck:decks!match_participants_deck_id_fkey(bracket)
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
  if (participant.confirmed_at) {
    return { success: false, error: 'Match already confirmed' }
  }

  // If deck provided, update it
  if (deckId) {
    const updateResult = await updateParticipantDeck(supabase, participantId, deckId)
    if (!updateResult.success) {
      return { success: false, error: updateResult.error }
    }
  }

  // Get full match details for rating calculation
  const matchResult = await getMatchWithDetails(supabase, participant.match_id)
  if (!matchResult.success) {
    return { success: false, error: matchResult.error }
  }
  
  const match = matchResult.data

  // Get format info
  const { data: format, error: formatError } = await supabase
    .from('formats')
    .select('id')
    .eq('id', match.formatId)
    .single()

  if (formatError || !format) {
    return { success: false, error: 'Format not found' }
  }

  // Get current player's rating for this format
  const ratingResult = await getRating(supabase, user.id, format.id)
  if (!ratingResult.success) {
    return { success: false, error: ratingResult.error }
  }

  const currentRating = ratingResult.data

  // Build opponent data for rating calculation
  // Get all other participants with their ratings
  const opponents: Array<{ rating: number; bracket: Bracket }> = []
  
  for (const p of match.participants) {
    if (p.userId && p.userId !== user.id) {
      // Get opponent's rating
      const oppRatingResult = await getRating(supabase, p.userId, format.id)
      const oppRating = oppRatingResult.success ? oppRatingResult.data.rating : 1000
      
      // Get opponent's deck bracket
      const bracket: Bracket = (p as { deck?: { bracket?: Bracket } }).deck?.bracket ?? 2
      
      opponents.push({ rating: oppRating, bracket })
    } else if (!p.userId && p.id !== participantId) {
      // Placeholder opponent - use default rating
      opponents.push({ rating: 1000, bracket: 2 })
    }
  }

  // Get player's deck bracket (from updated deck if provided, else existing)
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

  // Calculate rating change
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

  // Confirm the participation
  const confirmResult = await confirmMatchParticipation(supabase, participantId)
  if (!confirmResult.success) {
    return { success: false, error: confirmResult.error }
  }

  // Update rating
  const newRating = currentRating.rating + ratingCalc.delta
  const updateResult = await updateRating(
    supabase,
    user.id,
    format.id,
    newRating,
    true // increment match count
  )

  if (!updateResult.success) {
    return { success: false, error: updateResult.error }
  }

  // Record rating history
  await recordRatingHistory(supabase, {
    userId: user.id,
    matchId: participant.match_id,
    formatId: format.id,
    ratingBefore: currentRating.rating,
    ratingAfter: newRating,
    delta: ratingCalc.delta,
    playerBracket,
    opponentAvgRating: ratingCalc.opponentAvgRating,
    opponentAvgBracket: ratingCalc.opponentAvgBracket,
    kFactor: ratingCalc.kFactor,
    algorithmVersion: 1,
  })

  // Update collection-scoped ratings
  // Get all collections this match belongs to
  const matchCollectionsResult = await getMatchCollections(supabase, participant.match_id)
  if (matchCollectionsResult.success && matchCollectionsResult.data.length > 0) {
    // Filter to collections where this user is a member
    const userMemberCollectionsResult = await getUserMemberCollections(
      supabase,
      user.id,
      matchCollectionsResult.data
    )

    if (userMemberCollectionsResult.success && userMemberCollectionsResult.data.length > 0) {
      // Update rating for each collection the user is a member of
      await updateCollectionRatings(supabase, {
        userId: user.id,
        matchId: participant.match_id,
        formatId: format.id,
        playerBracket,
        isWinner: participant.is_winner,
        opponents,
        collectionIds: userMemberCollectionsResult.data,
        algorithmVersion: 1,
      })

      // Revalidate collection pages
      for (const collectionId of userMemberCollectionsResult.data) {
        revalidatePath(`/collections/${collectionId}`)
      }
    }
  }

  // Revalidate relevant pages
  revalidatePath('/dashboard')
  revalidatePath('/matches')
  revalidatePath(`/match/${participant.match_id}`)
  revalidatePath('/collections')

  return {
    success: true,
    data: {
      delta: ratingCalc.delta,
      newRating,
    },
  }
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
 * Update a participant's deck (before confirmation)
 * Used for retroactive placeholder deck updates
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

  // Get the participant and verify ownership
  const { data: participant, error: fetchError } = await supabase
    .from('match_participants')
    .select('id, match_id, user_id, confirmed_at')
    .eq('id', participantId)
    .single()

  if (fetchError || !participant) {
    return { success: false, error: 'Participant slot not found' }
  }

  if (participant.user_id !== user.id) {
    return { success: false, error: 'You can only update your own deck' }
  }

  if (participant.confirmed_at) {
    return { success: false, error: 'Cannot update deck after confirmation' }
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

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`)
  revalidatePath('/matches')

  return { success: true, data: null }
}
