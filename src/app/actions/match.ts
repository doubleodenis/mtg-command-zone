'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { confirmMatchParticipation, getMatchWithDetails, updateParticipantDeck } from '@/lib/supabase/matches'
import { getRating, updateRating, recordRatingHistory } from '@/lib/supabase/ratings'
import { calculateRating } from '@/lib/rating'
import type { Result, Bracket } from '@/types'

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

  // Revalidate relevant pages
  revalidatePath('/dashboard')
  revalidatePath('/matches')
  revalidatePath(`/match/${participant.match_id}`)

  return {
    success: true,
    data: {
      delta: ratingCalc.delta,
      newRating,
    },
  }
}
