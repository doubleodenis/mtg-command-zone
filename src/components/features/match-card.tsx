import Image from "next/image";
import Link from "next/link";
import { cn, formatRelativeTime, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Match, MatchParticipant, GuestParticipant, Profile } from "@/types/database.types";

interface Participant {
  id: string;
  name: string;
  avatar_url?: string | null;
  commander_name?: string | null;
  commander_image_uri?: string | null;
  is_winner: boolean;
  is_guest: boolean;
  username?: string;
}

interface MatchCardProps {
  match: Match;
  participants: Participant[];
  viewerUserId?: string;
  groupName?: string | null;
  className?: string;
}

export function MatchCard({
  match,
  participants,
  viewerUserId,
  groupName,
  className,
}: MatchCardProps) {
  const winner = participants.find((p) => p.is_winner);
  const viewerParticipant = viewerUserId
    ? participants.find((p) => p.id === viewerUserId)
    : null;
  const isViewerWinner = viewerParticipant?.is_winner ?? false;

  const formatLabel =
    match.format === "1v1"
      ? "1v1"
      : match.format === "2v2"
      ? "2v2"
      : `${participants.length}-player`;

  return (
    <Link
      href={`/match/${match.id}`}
      className={cn(
        "block glass-card-hover overflow-hidden",
        className
      )}
    >
      {/* Win/Loss indicator bar */}
      <div
        className={cn(
          "h-1",
          viewerParticipant
            ? isViewerWinner
              ? "bg-win"
              : "bg-loss"
            : "bg-accent"
        )}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {viewerParticipant && (
              <Badge variant={isViewerWinner ? "win" : "loss"}>
                {isViewerWinner ? "WIN" : "LOSS"}
              </Badge>
            )}
            <span className="text-foreground-muted text-sm">
              Commander {formatLabel}
            </span>
          </div>
          <span className="text-foreground-subtle text-sm">
            {formatRelativeTime(match.date_played)}
          </span>
        </div>

        {/* Participants grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {participants.slice(0, 4).map((participant) => (
            <div
              key={participant.id + (participant.is_guest ? "-guest" : "")}
              className={cn(
                "relative flex flex-col items-center p-2 rounded-lg",
                participant.is_winner && "bg-win/10 ring-1 ring-win/30"
              )}
            >
              {/* Avatar */}
              <div className="relative h-10 w-10 rounded-full bg-surface overflow-hidden mb-1">
                {participant.avatar_url ? (
                  <Image
                    src={participant.avatar_url}
                    alt={participant.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-foreground-muted text-sm font-medium">
                    {participant.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="text-sm font-medium text-foreground truncate max-w-full">
                {participant.name}
              </div>

              {/* Commander */}
              {participant.commander_name && (
                <div className="text-xs text-foreground-muted truncate max-w-full">
                  {participant.commander_name}
                </div>
              )}

              {/* Winner crown */}
              {participant.is_winner && (
                <div className="absolute -top-1 -right-1 text-yellow-500">
                  👑
                </div>
              )}

              {/* Guest badge */}
              {participant.is_guest && (
                <Badge variant="outline" className="mt-1 text-[10px]">
                  Guest
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm text-foreground-muted">
          <div className="flex items-center gap-4">
            {winner && (
              <span>
                Winner: <span className="text-foreground">{winner.name}</span>
                {winner.commander_name && (
                  <span className="text-foreground-subtle">
                    {" "}
                    ({winner.commander_name})
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {match.duration_minutes && (
              <span>{formatDuration(match.duration_minutes)}</span>
            )}
            {groupName && (
              <Badge variant="outline">{groupName}</Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
