import type { FriendshipStatus } from '@/types/friendship'
import { PLACEHOLDER_DECK_NAME } from '@/types/deck'

/**
 * A confirmation only counts with a real deck: not missing, not the
 * "Unknown Deck" placeholder. Mirrors the DB trigger from migration 031.
 */
export function hasConfirmableDeck(deck: { deckName: string | null } | null): boolean {
  return deck !== null && deck.deckName !== PLACEHOLDER_DECK_NAME
}

/**
 * A participant is auto-confirmed (and rated) immediately if they have a real
 * deck AND are the match reporter or an accepted friend of the reporter.
 * Everyone else stays pending until they confirm themselves.
 */
export function shouldAutoConfirmParticipant(params: {
  reporterId: string
  participantUserId: string
  friendshipStatus: FriendshipStatus | null
  deck: { deckName: string | null } | null
}): boolean {
  if (!hasConfirmableDeck(params.deck)) return false
  if (params.participantUserId === params.reporterId) return true
  return params.friendshipStatus === 'accepted'
}

/** User-facing message when someone tries to confirm without a real deck. */
export const DECK_REQUIRED_MESSAGE = 'Pick your deck before confirming this match.'

/**
 * True when a Postgres/PostgREST error is the migration 031 trigger refusing
 * a deckless confirmation (check_violation, SQLSTATE 23514).
 */
export function isDeckRequiredError(
  error: { code?: string | null; message?: string | null } | null
): boolean {
  if (!error) return false
  return (
    error.code === '23514' &&
    (error.message ?? '').includes('confirmation requires a deck')
  )
}

/**
 * When two users become friends, pick the still-pending participations that
 * should now auto-confirm: the match's reporter is the OTHER user in the
 * pair, and the participant has a real deck (spec F4). Sorted by played_at
 * so ratings apply in match order.
 */
export function selectAutoResolvableParticipations<
  T extends {
    user_id: string | null
    match: { played_at: string; created_by: string } | null
    deck: { deck_name: string | null } | null
  },
>(rows: T[], userId1: string, userId2: string): T[] {
  return rows
    .filter((row) => {
      if (!row.match) return false
      // The match's reporter must be the OTHER user in the pair relative to
      // this row's own participant -- not just "anyone in the pair" -- so a
      // reporter's own slot is never treated as eligible.
      const otherUser = row.user_id === userId1 ? userId2 : userId1
      if (row.match.created_by !== otherUser) return false
      return hasConfirmableDeck(row.deck ? { deckName: row.deck.deck_name } : null)
    })
    .sort(
      (a, b) =>
        new Date(a.match!.played_at).getTime() -
        new Date(b.match!.played_at).getTime()
    )
}
