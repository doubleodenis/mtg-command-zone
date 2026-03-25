/**
 * Central export for all application types
 */

// Common utility types
export type {
  AsyncResult,
  Bracket,
  ColorIdentity,
  ISODateString,
  PaginatedResponse,
  PaginationParams,
  Result,
  SortDirection,
  SortParams,
  UUID,
} from './common'
export { DEFAULT_BRACKET, BRACKET_NAMES, BRACKET_DESCRIPTIONS, BRACKET_OPTIONS } from './common'

// Profile types
export type {
  FormatStats,
  LeaderboardEntry,
  PlayerStats,
  Profile,
  ProfileSummary,
  ProfileUpdatePayload,
  ProfileWithStats,
} from './profile'

// Deck types
export type {
  CardPreview,
  CreateDeckPayload,
  Deck,
  DeckStats,
  DeckSummary,
  DeckWithStats,
  ScryfallCard,
  UpdateDeckPayload,
} from './deck'
export { isPlaceholderDeck, PLACEHOLDER_DECK_NAME } from './deck'

// Friendship types
export type {
  Friend,
  Friendship,
  FriendRequest,
  FriendRequestResponsePayload,
  FriendshipStatus,
  FriendshipWithProfiles,
  OutgoingFriendRequest,
  SendFriendRequestPayload,
} from './friendship'

// Format types
export type {
  Format,
  FormatConfig,
  FormatConfig1v1,
  FormatConfig2v2,
  FormatConfig3v3,
  FormatConfigFFA,
  FormatConfigPentagram,
  FormatSlug,
  FormatSummary,
  MatchData,
  MatchDataPentagram,
  MatchDataSimple,
  MatchDataTeam,
  ParticipantData,
  ParticipantDataPentagram,
  ParticipantDataSimple,
  ParticipantDataTeam,
  WinConditionType,
} from './format'
export { getPentagramEnemies, PENTAGRAM_ADJACENCY_MAP } from './format'

// Collection types
export type {
  AddMatchToCollectionPayload,
  ApprovalStatus,
  Collection,
  CollectionActivity,
  CollectionMatch,
  CollectionMember,
  CollectionMemberWithProfile,
  CollectionRole,
  CollectionSummary,
  CollectionWithMembership,
  CollectionWithMembers,
  CollectionWithOwner,
  CreateCollectionPayload,
  InviteCollectionMemberPayload,
  MatchAddPermission,
  MatchApprovalResponsePayload,
  UpdateCollectionPayload,
} from './collection'

// Match types
export type {
  ClaimParticipantPayload,
  ClaimResponsePayload,
  ClaimStatus,
  ConfirmMatchPayload,
  CreateMatchPayload,
  Match,
  MatchCardData,
  MatchFilters,
  MatchParticipant,
  MatchParticipantWithDetails,
  MatchSortField,
  MatchSummary,
  MatchWithDetails,
  MatchWithParticipants,
  ParticipantDisplayInfo,
  ParticipantInput,
  PendingClaimRequest,
  PendingConfirmation,
  PlaceholderParticipantInput,
  RegisteredParticipantInput,
  UpdateParticipantDeckPayload,
} from './match'

// Rating types
export type {
  Rating,
  RatingCalculationInput,
  RatingCalculationResult,
  RatingDelta,
  RatingHistory,
  RatingHistoryEntry,
  RatingWithFormat,
} from './rating'
export {
  calculateBracketModifier,
  calculateExpectedScore,
  getKFactor,
  RATING_CONFIG,
} from './rating'
