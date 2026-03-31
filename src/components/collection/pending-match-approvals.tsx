"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { approveCollectionMatch, rejectCollectionMatch } from "@/app/actions/collection";
import type { PendingMatchApproval } from "@/types";

interface PendingMatchApprovalsProps {
  collectionId: string;
  initialPendingMatches: PendingMatchApproval[];
  className?: string;
}

/**
 * Component for collection owners to review and approve/reject pending match submissions.
 */
export function PendingMatchApprovals({
  collectionId,
  initialPendingMatches,
  className,
}: PendingMatchApprovalsProps) {
  const [pendingMatches, setPendingMatches] = React.useState(initialPendingMatches);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleApprove = async (collectionMatchId: string) => {
    setProcessingId(collectionMatchId);
    setError(null);

    const result = await approveCollectionMatch(collectionMatchId, collectionId);

    if (result.success) {
      // Remove from list
      setPendingMatches((prev) => prev.filter((m) => m.collectionMatchId !== collectionMatchId));
    } else {
      setError(result.error);
    }

    setProcessingId(null);
  };

  const handleReject = async (collectionMatchId: string) => {
    setProcessingId(collectionMatchId);
    setError(null);

    const result = await rejectCollectionMatch(collectionMatchId, collectionId);

    if (result.success) {
      // Remove from list
      setPendingMatches((prev) => prev.filter((m) => m.collectionMatchId !== collectionMatchId));
    } else {
      setError(result.error);
    }

    setProcessingId(null);
  };

  if (pendingMatches.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border-amber-500/30 bg-amber-500/5", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-500"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <CardTitle>Pending Approvals</CardTitle>
          <Badge variant="default" className="ml-auto">
            {pendingMatches.length}
          </Badge>
        </div>
        <CardDescription>
          Review and approve match submissions from members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="p-3 rounded-md bg-loss/10 border border-loss/20 text-loss text-sm">
            {error}
          </div>
        )}

        {pendingMatches.map((pm) => (
          <PendingMatchCard
            key={pm.collectionMatchId}
            pendingMatch={pm}
            isProcessing={processingId === pm.collectionMatchId}
            onApprove={() => handleApprove(pm.collectionMatchId)}
            onReject={() => handleReject(pm.collectionMatchId)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface PendingMatchCardProps {
  pendingMatch: PendingMatchApproval;
  isProcessing: boolean;
  onApprove: () => void;
  onReject: () => void;
}

function PendingMatchCard({
  pendingMatch,
  isProcessing,
  onApprove,
  onReject,
}: PendingMatchCardProps) {
  const { addedBy, matchSummary, addedAt, matchId } = pendingMatch;

  const formattedDate = new Date(matchSummary.playedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const submittedDate = new Date(addedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-card-border bg-card">
      <Avatar
        src={addedBy.avatarUrl}
        fallback={addedBy.username}
        size="md"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-text-1 truncate">
            {addedBy.username}
          </span>
          <span className="text-sm text-text-3">submitted a match</span>
        </div>
        
        <div className="mt-1 text-sm text-text-2">
          <Link
            href={`/match/${matchId}`}
            className="hover:text-accent transition-colors"
          >
            <Badge variant="outline" className="mr-2">
              {matchSummary.formatSlug.toUpperCase()}
            </Badge>
            {matchSummary.participantCount} players • {formattedDate}
          </Link>
        </div>

        {matchSummary.winnerNames.length > 0 && (
          <div className="mt-1 text-sm text-text-3">
            Winner: <span className="text-win">{matchSummary.winnerNames.join(", ")}</span>
          </div>
        )}

        <div className="mt-1 text-xs text-text-3">
          Submitted {submittedDate}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onReject}
          disabled={isProcessing}
          className="text-loss hover:bg-loss/10"
        >
          {isProcessing ? (
            <LoadingSpinner />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={onApprove}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <LoadingSpinner />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
