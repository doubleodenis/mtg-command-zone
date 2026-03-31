// Primitives
export { Button, type ButtonVariant, type ButtonSize } from "./button";
export { Input } from "./input";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./card";
export { Badge, type BadgeVariant } from "./badge";
export { Avatar, type AvatarSize } from "./avatar";

// Domain-specific primitives
export { FormatBadge } from "./format-badge";
export { BracketIndicator, BracketBadge } from "./bracket-indicator";
export { RatingDelta, RatingDisplay } from "./rating-delta";
export { ConfirmationStatus, ConfirmationCount, type ConfirmationState } from "./confirmation-status";
export { WLBadge } from "./wl-badge";
export { ManaPip, ColorIdentity } from "./mana-pip";
export { CommanderCard } from "./commander-card";

// Loading & State
export {
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
  SkeletonCard,
  SkeletonMatchCard,
  SkeletonStatCard,
  SkeletonProfileHeader,
  SkeletonTable,
  type SkeletonVariant,
} from "./skeleton";

export {
  EmptyState,
  IconMatches,
  IconDecks,
  IconCollections,
  IconFriends,
  IconSearch,
  IconNotifications,
  IconChart,
  type EmptyStateProps,
} from "./empty-state";

export {
  ErrorBoundary,
  ErrorFallback,
  ErrorFallbackCard,
  ErrorFallbackInline,
  PageError,
  IconError,
  type ErrorBoundaryProps,
  type ErrorFallbackProps,
  type PageErrorProps,
} from "./error-boundary";

export {
  FormError,
  FormErrorBanner,
  FormSuccessBanner,
} from "./form-feedback";

// Legacy (to be reviewed)
export { StatCard } from "./stat-card";
export { PlayerSearchInput } from "./player-search-input";
