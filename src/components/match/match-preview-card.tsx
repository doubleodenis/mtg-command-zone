import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, ColorIdentity } from "@/components/ui";
import { cn } from "@/lib/utils";
import { buildCommanderImageUrl } from "@/lib/scryfall/api";
import type { MatchCardData, ParticipantDisplayInfo } from "@/types";

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

interface MatchPreviewCardProps {
  match: MatchCardData;
  showElo?: boolean;
  className?: string;
}

export function MatchPreviewCard({
  match,
  showElo = false,
  className,
}: MatchPreviewCardProps) {
  const userParticipant = match.userParticipant;
  const isUserWinner = userParticipant?.isWinner ?? false;
  const avgBracket = getAverageBracket(match.participants);

  return (
    <Link href={`/match/${match.id}`} className={cn("block", className)}>
      <Card className="hover:border-card-border-hi transition-colors h-44">
        <CardContent className="p-3 h-full">
          <div className="flex items-stretch gap-4 h-full">
            {/* Participants - fill the left side */}
            <div className="flex-1 flex items-stretch justify-center gap-2">
              {match.participants.map((participant) => {
                const commanderName = participant.deck?.commanderName;
                const commanderImageUrl = commanderName
                  ? buildCommanderImageUrl(commanderName, "art_crop")
                  : null;
                const isCurrentUser =
                  userParticipant && participant.id === userParticipant.id;

                return (
                  <div
                    key={participant.id}
                    className={cn(
                      "relative flex-1 min-w-0 rounded-lg overflow-hidden max-w-64",
                      participant.isWinner
                        ? "ring-2 ring-win"
                        : "ring-1 ring-card-border"
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
              })}
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

              {/* Format & player count */}
              <span className="text-sm text-text-2">
                {match.formatSlug.toUpperCase()} • {match.participantCount}P
              </span>

              {/* Average bracket */}
              <span className="text-sm text-text-2 bg-surface ">
                {getBracketName(avgBracket)}
              </span>

              {/* ELO delta - only on personal dashboard */}
              {showElo && userParticipant?.ratingDelta && (
                <span
                  className={cn(
                    "text-lg font-display font-bold",
                    userParticipant.ratingDelta.delta >= 0
                      ? "text-win"
                      : "text-loss"
                  )}
                >
                  {userParticipant.ratingDelta.delta >= 0 ? "+" : ""}
                  {userParticipant.ratingDelta.delta}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
