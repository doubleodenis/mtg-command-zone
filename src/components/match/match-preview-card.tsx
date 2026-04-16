import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, ColorIdentity, RatingDelta } from "@/components/ui";
import { cn } from "@/lib/utils";
import { buildCommanderImageUrl } from "@/lib/scryfall/api";
import type { FormatSlug, MatchCardData, ParticipantDataPentagram, ParticipantDisplayInfo } from "@/types";

// Bracket name mapping
const BRACKET_NAMES: Record<number, string> = {
  1: "Beginner",
  2: "Casual",
  3: "Upgraded",
  4: "cEDH",
};

function getBracketName(bracket: number): string {
  return BRACKET_NAMES[bracket] || `B${bracket}`;
}

function getAverageBracket(participants: ParticipantDisplayInfo[]): number {
  const brackets: number[] = [];
  for (const p of participants) {
    if (p.deck?.bracket != null) {
      brackets.push(p.deck.bracket);
    }
  }

  if (brackets.length === 0) return 2; // Default to Casual
  const avg = brackets.reduce((a, b) => a + b, 0) / brackets.length;
  return Math.round(avg);
}

/**
 * Check if a format uses team-based display (VS divider)
 */
function isTeamFormat(formatSlug: FormatSlug): boolean {
  return formatSlug === '1v1' || formatSlug === '2v2' || formatSlug === '3v3';
}

/**
 * Group participants by team for team formats
 */
function groupByTeam(participants: ParticipantDisplayInfo[]): {
  teamA: ParticipantDisplayInfo[];
  teamB: ParticipantDisplayInfo[];
} {
  const teamA = participants.filter((p) => p.team === 'A');
  const teamB = participants.filter((p) => p.team === 'B');
  return { teamA, teamB };
}

/**
 * Sort Pentagram participants by seat position (0-4)
 */
function sortPentagramBySeat(participants: ParticipantDisplayInfo[]): ParticipantDisplayInfo[] {
  return [...participants].sort((a, b) => {
    const seatA = (a.participantData as ParticipantDataPentagram | null)?.seatPosition ?? 0;
    const seatB = (b.participantData as ParticipantDataPentagram | null)?.seatPosition ?? 0;
    return seatA - seatB;
  });
}

/**
 * Check if a participant is an enemy/ally of the user in Pentagram
 */
function getPentagramRelationship(
  participant: ParticipantDisplayInfo,
  userParticipant: ParticipantDisplayInfo | null
): 'self' | 'ally' | 'enemy' | null {
  if (!userParticipant) return null;
  if (participant.id === userParticipant.id) return 'self';
  
  const userData = userParticipant.participantData;
  if (!userData || userData.format !== 'pentagram') return null;
  
  const pentagramData = userData as ParticipantDataPentagram;
  
  if (pentagramData.allyParticipantIds.includes(participant.id)) {
    return 'ally';
  }
  if (pentagramData.targetParticipantIds.includes(participant.id)) {
    return 'enemy';
  }
  return null;
}

interface ParticipantSlotProps {
  participant: ParticipantDisplayInfo;
  userParticipantId?: string | null;
  /** Pentagram relationship indicator */
  relationship?: 'self' | 'ally' | 'enemy' | null;
  /** Whether to show claim badge for guests */
  showClaimBadge?: boolean;
}

/**
 * Single participant slot with commander image background
 */
function ParticipantSlot({ participant, userParticipantId, relationship, showClaimBadge = false }: ParticipantSlotProps) {
  const commanderName = participant.deck?.commanderName;
  const commanderImageUrl = commanderName
    ? buildCommanderImageUrl(commanderName, "art_crop")
    : null;
  const isCurrentUser = userParticipantId === participant.id;
  const isGuest = !participant.isRegistered;
  const isClaimable = isGuest && participant.claimStatus === 'none';

  // Determine ring style based on winner status and pentagram relationship
  const getRingStyle = () => {
    if (participant.isWinner) return "ring-2 ring-win";
    if (relationship === 'enemy') return "ring-2 ring-loss/70";
    // Highlight claimable slots with a dashed border
    if (isClaimable && showClaimBadge) return "ring-2 ring-dashed ring-accent/70";
    return "ring-1 ring-card-border";
  };

  return (
    <div
      className={cn(
        "relative flex-1 min-w-0 rounded-lg overflow-hidden max-w-64",
        getRingStyle()
      )}
    >
      {/* Commander image as background */}
      <div className="absolute inset-0">
        {commanderImageUrl ? (
          <img
            src={commanderImageUrl}
            alt={commanderName || "Commander"}
            className="w-full h-full object-cover"
          />
        ) : participant.avatarUrl ? (
          <img
            src={participant.avatarUrl}
            alt={participant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface text-text-3 text-lg">
            {participant.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />

      {/* YOU badge - top left */}
      {isCurrentUser && (
        <span className="absolute top-1 left-1 text-[11px] font-bold text-white bg-accent/90 px-1.5 py-0.5 rounded">
          YOU
        </span>
      )}

      {/* GUEST badge with claim indicator - top left (only if not current user) */}
      {!isCurrentUser && isGuest && showClaimBadge && (
        <span className={cn(
          "absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded",
          isClaimable 
            ? "text-white bg-accent/90" 
            : "text-white/80 bg-black/50"
        )}>
          {isClaimable ? "CLAIM" : "GUEST"}
        </span>
      )}

      {/* Player name - bottom, overlaid */}
      <div className="absolute bottom-0 left-0 right-0 p-1.5">
        <p className="text-xs font-medium text-white truncate text-center drop-shadow-md">
          {participant.name}
        </p>
      </div>

      {/* Color identity - frosted pill */}
      {participant.deck?.colorIdentity && (
        <div className="absolute -top-1 -right-1 bg-white/10 backdrop-blur-sm rounded-md pl-2 pb-1 pr-2 pt-2">
          <ColorIdentity colors={participant.deck.colorIdentity} size="md" />
        </div>
      )}
    </div>
  );
}

/**
 * VS divider for team formats - horizontal on desktop, vertical on mobile
 */
function VsDivider({ vertical = false }: { vertical?: boolean }) {
  if (vertical) {
    // Mobile: horizontal divider line
    return (
      <div className="flex items-center justify-center py-1 shrink-0">
        <div className="flex-1 h-px bg-linear-to-r from-transparent via-text-3/30 to-transparent" />
        <span className="text-xs font-bold text-text-3 px-2">VS</span>
        <div className="flex-1 h-px bg-linear-to-r from-transparent via-text-3/30 to-transparent" />
      </div>
    );
  }
  
  // Desktop: vertical divider line
  return (
    <div className="flex flex-col items-center justify-center px-1 shrink-0">
      <div className="h-full w-px bg-linear-to-b from-transparent via-text-3/30 to-transparent" />
      <span className="text-xs font-bold text-text-3 py-1 -my-3">VS</span>
      <div className="h-full w-px bg-linear-to-b from-transparent via-text-3/30 to-transparent" />
    </div>
  );
}

interface MatchPreviewCardProps {
  match: MatchCardData;
  showElo?: boolean;
  /** Show claim badges on guest participant slots */
  showClaimBadges?: boolean;
  className?: string;
}

export function MatchPreviewCard({
  match,
  showElo = false,
  showClaimBadges = false,
  className,
}: MatchPreviewCardProps) {
  const userParticipant = match.userParticipant;
  const isUserWinner = userParticipant?.isWinner ?? false;
  const avgBracket = getAverageBracket(match.participants);
  const hasTeams = isTeamFormat(match.formatSlug);
  const isPentagram = match.formatSlug === 'pentagram';

  // Count claimable slots
  const claimableSlots = match.participants.filter(
    p => !p.isRegistered && p.claimStatus === 'none'
  ).length;

  // Don't show claim badges if the viewer is already participating in this match
  const effectiveShowClaimBadges = showClaimBadges && !userParticipant;

  // Group participants by team for team formats
  const { teamA, teamB } = hasTeams
    ? groupByTeam(match.participants)
    : { teamA: [], teamB: [] };
    
  // Sort Pentagram participants by seat position
  const pentagramParticipants = isPentagram
    ? sortPentagramBySeat(match.participants)
    : [];

  // For mobile vertical split of pentagram (3 top, 2 bottom)
  const pentagramTop = pentagramParticipants.slice(0, 3);
  const pentagramBottom = pentagramParticipants.slice(3);

  // Formats that need vertical stacking on mobile
  const needsVerticalMobileLayout = hasTeams || isPentagram;

  return (
    <Link href={`/match/${match.id}`} className={cn("block", className)}>
      <Card className={cn(
        "hover:border-card-border-hi transition-colors",
        needsVerticalMobileLayout ? "h-64 sm:h-44" : "h-44"
      )}>
        <CardContent className="p-3 h-full">
          <div className="flex items-stretch gap-4 h-full">
            {/* Participants - fill the left side */}
            <div className="flex-1 flex items-stretch justify-center gap-2">
              {hasTeams ? (
                // Team format - vertical on mobile, horizontal on desktop
                <div className="flex-1 flex flex-col sm:flex-row items-stretch gap-2">
                  {/* Team A */}
                  <div className="flex-1 flex items-stretch justify-center gap-2">
                    {teamA.map((participant) => (
                      <ParticipantSlot
                        key={participant.id}
                        participant={participant}
                        userParticipantId={userParticipant?.id}
                        showClaimBadge={effectiveShowClaimBadges}
                      />
                    ))}
                  </div>
                  
                  {/* VS Divider - horizontal on mobile, vertical on desktop */}
                  <div className="sm:hidden">
                    <VsDivider vertical />
                  </div>
                  <div className="hidden sm:flex">
                    <VsDivider />
                  </div>
                  
                  {/* Team B */}
                  <div className="flex-1 flex items-stretch justify-center gap-2">
                    {teamB.map((participant) => (
                      <ParticipantSlot
                        key={participant.id}
                        participant={participant}
                        userParticipantId={userParticipant?.id}
                        showClaimBadge={effectiveShowClaimBadges}
                      />
                    ))}
                  </div>
                </div>
              ) : isPentagram ? (
                // Pentagram - vertical split on mobile (3 top, 2 bottom), horizontal on desktop
                <>
                  {/* Mobile: 2 rows (3 + 2) */}
                  <div className="flex-1 flex flex-col gap-2 sm:hidden">
                    <div className="flex-1 flex items-stretch justify-center gap-2">
                      {pentagramTop.map((participant) => (
                        <ParticipantSlot
                          key={participant.id}
                          participant={participant}
                          userParticipantId={userParticipant?.id}
                          relationship={getPentagramRelationship(participant, userParticipant)}
                          showClaimBadge={effectiveShowClaimBadges}
                        />
                      ))}
                    </div>
                    <div className="flex-1 flex items-stretch justify-center gap-2">
                      {pentagramBottom.map((participant) => (
                        <ParticipantSlot
                          key={participant.id}
                          participant={participant}
                          userParticipantId={userParticipant?.id}
                          relationship={getPentagramRelationship(participant, userParticipant)}
                          showClaimBadge={effectiveShowClaimBadges}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Desktop: single row */}
                  <div className="hidden sm:flex sm:flex-1 sm:items-stretch sm:justify-center sm:gap-2">
                    {pentagramParticipants.map((participant) => (
                      <ParticipantSlot
                        key={participant.id}
                        participant={participant}
                        userParticipantId={userParticipant?.id}
                        relationship={getPentagramRelationship(participant, userParticipant)}
                        showClaimBadge={effectiveShowClaimBadges}
                      />
                    ))}
                  </div>
                </>
              ) : (
                // FFA - all participants in a row
                match.participants.map((participant) => (
                  <ParticipantSlot
                    key={participant.id}
                    participant={participant}
                    userParticipantId={userParticipant?.id}
                    showClaimBadge={effectiveShowClaimBadges}
                  />
                ))
              )}
            </div>

            {/* Match metadata - right side */}
            <div className="flex flex-col items-end justify-center gap-1 shrink-0 min-w-24">
              {/* Win/Loss badge - only show if user participated */}
              {userParticipant && (
                <Badge
                  variant={isUserWinner ? "win" : "loss"}
                  className="text-xs font-bold"
                >
                  {isUserWinner ? "VICTORY" : "DEFEAT"}
                </Badge>
              )}

              {/* Claimable slots indicator */}
              {effectiveShowClaimBadges && claimableSlots > 0 && (
                <Badge variant="accent" className="text-xs">
                  {claimableSlots} open {claimableSlots === 1 ? 'slot' : 'slots'}
                </Badge>
              )}

              {/* Format & player count */}
              <span className="text-sm text-text-2">
                {match.formatSlug.toUpperCase()} • {match.participantCount}P
              </span>

              {/* Average bracket */}
              <span className="text-sm text-text-2 bg-surface ">
                {getBracketName(avgBracket)}
              </span>

              {/* Match date */}
              <span className="text-xs text-text-2">
                {new Date(match.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>

              {/* ELO delta - only on personal dashboard */}
              {showElo && userParticipant?.ratingDelta && (
                <RatingDelta 
                  delta={userParticipant.ratingDelta.delta} 
                  size="lg" 
                  isPreview={userParticipant.ratingDelta.isPreview}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
