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
  createMatch,
} from '@/lib/supabase/matches'
import { getRating, applyRatingChange, updateCollectionRatings } from '@/lib/supabase/ratings'
import { getMatchCollections, getUserMemberCollections } from '@/lib/supabase/collections'
import { calculateRating } from '@/lib/rating'
import type { Result, Bracket, ClaimableMatchSlot, ClaimStatus, CreateMatchPayload, MatchData, ParticipantInput } from '@/types'

/**
 * Log a new match with participants.
 * 
 * This action:
 * 1. Creates the match and participant records
 * 2. Auto-confirms the creator's participation
 * 3. Calculates and records rating changes for the creator
 * 
 * Using this action ensures rating history is properly recorded
 * when the creator auto-confirms their participation.
 */
export async function logMatch(payload: {
  formatId: string
  playedAt?: string
  notes?: string | null
  matchData: MatchData
  participants: ParticipantInput[]
  winnerIndices: number[]
}): Promise<Result<{ matchId: string; delta: number; newRating: number }>> {
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

  // Find the creator's participant record
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
    return { success: true, data: { matchId: match.id, delta: 0, newRating: 0 } }
  }

  // Get format info
  const { data: format, error: formatError } = await supabase
    .from('formats')
    .select('id')
    .eq('id', payload.formatId)
    .single()

  if (formatError || !format) {
    // Match created but format not found - return without rating
    revalidatePath('/matches')
    revalidatePath(`/match/${match.id}`)
    return { success: true, data: { matchId: match.id, delta: 0, newRating: 0 } }
  }

  // Get creator's current rating
  const ratingResult = await getRating(supabase, user.id, format.id)
  if (!ratingResult.success) {
    revalidatePath('/matches')
    revalidatePath(`/match/${match.id}`)
    return { success: true, data: { matchId: match.id, delta: 0, newRating: 0 } }
  }

  const currentRating = ratingResult.data

  // Gather opponent data for rating calculation
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
      // Get opponent's rating
      const oppRatingResult = await getRating(supabase, p.user_id, format.id)
      const oppRating = oppRatingResult.success ? oppRatingResult.data.rating : 1000
      const bracket: Bracket = (p.deck?.bracket as Bracket) ?? 2
      opponents.push({ rating: oppRating, bracket })
    } else {
      // Placeholder opponent - use default rating
      opponents.push({ rating: 1000, bracket: 2 })
    }
  }

  // Get creator's deck bracket
  const playerBracket: Bracket = (creatorParticipant.deck?.bracket as Bracket) ?? 2

  // Calculate rating change
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

  // Atomically update global rating + record history via SECURITY DEFINER RPC
  const newRating = currentRating.rating + ratingCalc.delta
  const applyResult = await applyRatingChange(supabase, {
    userId: user.id,
    matchId: match.id,
    formatId: format.id,
    newRating,
    delta: ratingCalc.delta,
    isWin: creatorParticipant.is_winner,
    playerBracket,
    opponentAvgRating: ratingCalc.opponentAvgRating,
    opponentAvgBracket: ratingCalc.opponentAvgBracket,
    kFactor: ratingCalc.kFactor,
    algorithmVersion: 1,
  })

  if (!applyResult.success) {
    return { success: false, error: `Failed to save rating: ${applyResult.error}` }
  }

  // Update collection-scoped ratings (creator is auto-confirmed so this runs now)
  const matchCollectionsResult = await getMatchCollections(supabase, match.id)
  if (matchCollectionsResult.success && matchCollectionsResult.data.length > 0) {
    const userMemberCollectionsResult = await getUserMemberCollections(
      supabase,
      user.id,
      matchCollectionsResult.data
    )
    if (userMemberCollectionsResult.success && userMemberCollectionsResult.data.length > 0) {
      await updateCollectionRatings(supabase, {
        userId: user.id,
        matchId: match.id,
        formatId: format.id,
        playerBracket,
        isWinner: creatorParticipant.is_winner,
        opponents,
        collectionIds: userMemberCollectionsResult.data,
        algorithmVersion: 1,
      })
      for (const collectionId of userMemberCollectionsResult.data) {
        revalidatePath(`/collections/${collectionId}`)
      }
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
      delta: ratingCalc.delta,
      newRating,
    },
  }
}

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

  // Atomically update global rating + record history via SECURITY DEFINER RPC
  const newRating = currentRating.rating + ratingCalc.delta
  const applyResult = await applyRatingChange(supabase, {
    userId: user.id,
    matchId: participant.match_id,
    formatId: format.id,
    newRating,
    delta: ratingCalc.delta,
    isWin: participant.is_winner,
    playerBracket,
    opponentAvgRating: ratingCalc.opponentAvgRating,
    opponentAvgBracket: ratingCalc.opponentAvgBracket,
    kFactor: ratingCalc.kFactor,
    algorithmVersion: 1,
  })

  if (!applyResult.success) {
    return { success: false, error: `Failed to save rating: ${applyResult.error}` }
  }

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

  // Note: deck updates are allowed even after confirmation — updating your deck after
  // a match has been confirmed (e.g. via auto-approve) only affects commander stats,
  // not the historical rating that was already calculated.

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
