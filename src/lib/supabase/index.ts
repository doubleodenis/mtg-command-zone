/**
 * Supabase Query Helpers
 *
 * Raw database queries only — no business logic or data transformations.
 * Uses mappers to convert DB types (snake_case) to app types (camelCase).
 * JSONB fields are validated and cast at this boundary.
 *
 * For business logic, data aggregation, and transformations,
 * use the services layer: @/lib/services
 *
 * Usage:
 * ```ts
 * import { createClient } from '@/lib/supabase/server'
 * import { getProfileById, getUserDecks } from '@/lib/supabase'
 *
 * export default async function Page() {
 *   const client = await createClient()
 *   const { data: profile } = await getProfileById(client, userId)
 *   const { data: decks } = await getUserDecks(client, userId)
 * }
 * ```
 */

// Client factories
export { createClient as createServerClient } from './server'
export { createClient as createBrowserClient } from './client'

// Profile & Friends
export {
  getProfileById,
  getProfileByUsername,
  searchProfiles,
  updateProfile,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  getFriendshipStatus,
  getLeaderboard,
} from './profiles'

// Decks
export {
  getDeckById,
  getUserDecks,
  getActiveDecks,
  getDeckWithStats,
  getUserDecksWithStats,
  createDeck,
  updateDeck,
  retireDeck,
  reactivateDeck,
  deleteDeck,
  canEditDeck,
} from './decks'

// Collections
export {
  getCollectionById,
  getUserCollections,
  getCollectionWithMembers,
  getCollectionSummary,
  searchPublicCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  addCollectionMember,
  removeCollectionMember,
  getCollectionMembers,
  isCollectionMember,
  addMatchToCollection,
  updateMatchApprovalStatus,
  removeMatchFromCollection,
  getPendingMatchApprovals,
  getPendingMatchApprovalsWithDetails,
} from './collections'

// Matches
export {
  getMatchById,
  getMatchWithDetails,
  getUserMatches,
  getRecentMatches,
  getPendingConfirmations,
  createMatch,
  confirmMatchParticipation,
  disputeMatchParticipation,
  claimPlaceholderSlot,
  approveSlotClaim,
  rejectSlotClaim,
  deleteMatch,
  updateParticipantDeck,
} from './matches'

// Ratings
export {
  getRating,
  getUserRatings,
  getUserStats,
  getFormatStats,
  getRatingHistory,
  getRatingTimeline,
  getRatingHistoryEntry,
  applyRatingChange,
  updateCollectionRatings,
} from './ratings'

// Formats
export {
  getFormats,
  getFormatSummaries,
  getFormatById,
  getFormatBySlug,
  getDefaultFormat,
} from './formats'

// Notifications
export {
  getNotifications,
  getUnreadNotificationCount,
  getUnseenNotificationCount,
  markNotificationsSeen,
  markNotificationsRead,
  dismissNotification,
  dismissAllNotifications,
} from './notifications'
