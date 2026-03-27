import type { DeckSummary, FriendshipStatus } from "@/types";

export type ParticipantSlot = {
  type: "empty" | "registered" | "placeholder";
  userId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  deckId?: string;
  deckName?: string;
  placeholderName?: string;
  commanderName?: string;
  team?: string;
  isWinner: boolean;
};

export type SearchResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  friendshipStatus?: FriendshipStatus | null;
  isFriend?: boolean;
};

export type PlayerSlotProps = {
  slot: ParticipantSlot;
  index: number;
  currentUserId: string;
  onSelectPlayer: (player: SearchResult) => void;
  onSetAsGuest: () => void;
  onRemove: () => void;
  onToggleWinner: () => void;
  onSelectDeck: (deckId: string) => void;
  onChangePlaceholderName: (name: string) => void;
  onChangeCommanderName: (name: string) => void;
  availableDecks: DeckSummary[];
  isTeamFormat: boolean;
  team?: string;
  excludeIds: string[];
  currentUser?: SearchResult;
};

export type PentagonPlayerCardProps = {
  slot: ParticipantSlot;
  index: number;
  currentUserId: string;
  onSelectPlayer: (player: SearchResult) => void;
  onSetAsGuest: () => void;
  onRemove: () => void;
  onToggleWinner: () => void;
  onSelectDeck: (deckId: string) => void;
  onChangePlaceholderName: (name: string) => void;
  onChangeCommanderName: (name: string) => void;
  availableDecks: DeckSummary[];
  excludeIds: string[];
  enemies: [number, number];
  currentUser?: SearchResult;
};

export type PentagramLayoutProps = {
  participants: ParticipantSlot[];
  currentUserId: string;
  onSelectPlayer: (index: number, player: SearchResult) => void;
  onSetAsGuest: (index: number) => void;
  onRemove: (index: number) => void;
  onToggleWinner: (index: number) => void;
  onSelectDeck: (index: number, deckId: string) => void;
  onChangePlaceholderName: (index: number, name: string) => void;
  onChangeCommanderName: (index: number, name: string) => void;
  userDecks: Record<string, DeckSummary[]>;
  excludeIds: string[];
  currentUser?: SearchResult;
};
