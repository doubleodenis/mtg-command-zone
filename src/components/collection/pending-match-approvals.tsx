"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, X, Check, Loader2 } from "lucide-react";
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
          <AlertCircle className="w-5 h-5 text-amber-500" />
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
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={onApprove}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
