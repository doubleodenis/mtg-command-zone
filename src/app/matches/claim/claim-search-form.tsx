"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormatBadge } from "@/components/ui/format-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { searchForClaimableMatches, submitClaimRequest } from "@/app/actions/match";
import type { ClaimableMatchSlot } from "@/types";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ClaimableMatchCard({
  slot,
  onClaim,
  isSubmitting,
}: {
  slot: ClaimableMatchSlot;
  onClaim: (participantId: string) => void;
  isSubmitting: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Match info header */}
          <div className="flex items-center gap-2 mb-2">
            <FormatBadge format={slot.match.formatSlug} />
            <span className="text-sm text-text-secondary">
              {formatDate(slot.match.playedAt)}
            </span>
          </div>

          {/* Placeholder name highlight */}
          <div className="mb-2">
            <span className="text-sm text-text-secondary">Claiming slot for: </span>
            <span className="font-medium text-accent">
              "{slot.placeholderName}"
            </span>
          </div>

          {/* Other participants */}
          {slot.match.otherParticipants.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-text-secondary">
              <UserIcon className="shrink-0" />
              <span className="truncate">
                with {slot.match.otherParticipants.slice(0, 3).join(", ")}
                {slot.match.otherParticipants.length > 3 && (
                  <span> +{slot.match.otherParticipants.length - 3} more</span>
                )}
              </span>
            </div>
          )}

          {/* Creator info */}
          <div className="mt-1 text-xs text-text-tertiary">
            Logged by @{slot.match.creatorUsername}
          </div>
        </div>

        {/* Claim button */}
        <Button
          size="sm"
          onClick={() => onClaim(slot.participantId)}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Claiming..." : "Claim"}
        </Button>
      </div>
    </Card>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ClaimSearchForm() {
  const _router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ClaimableMatchSlot[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submittingId, setSubmittingId] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) {
      setError("Please enter at least 2 characters");
      return;
    }

    setIsSearching(true);
    setError(null);
    setSuccessMessage(null);
    
    const result = await searchForClaimableMatches(query.trim());
    
    setIsSearching(false);
    setHasSearched(true);

    if (result.success) {
      setResults(result.data);
    } else {
      setError(result.error);
      setResults([]);
    }
  };

  const handleClaim = async (participantId: string) => {
    setSubmittingId(participantId);
    setError(null);
    setSuccessMessage(null);

    const result = await submitClaimRequest(participantId);

    setSubmittingId(null);

    if (result.success) {
      // Remove from results and show success
      setResults((prev) => prev.filter((r) => r.participantId !== participantId));
      setSuccessMessage(
        "Claim submitted! The match creator will be notified to approve your request."
      );
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input
            type="text"
            placeholder="Enter your name as it appears in matches..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={isSearching}>
          {isSearching ? "Searching..." : "Search"}
        </Button>
      </form>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-danger-dim border border-danger-ring p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="rounded-md bg-success-dim border border-success-ring p-3 text-sm text-success">
          {successMessage}
        </div>
      )}

      {/* Loading state */}
      {isSearching && <ResultsSkeleton />}

      {/* Results */}
      {!isSearching && hasSearched && (
        <>
          {results.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                Found {results.length} claimable slot{results.length !== 1 ? "s" : ""}
              </p>
              {results.map((slot) => (
                <ClaimableMatchCard
                  key={slot.participantId}
                  slot={slot}
                  onClaim={handleClaim}
                  isSubmitting={submittingId === slot.participantId}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No matches found"
              description={`No claimable slots found matching "${query}". Try searching with a different name.`}
            />
          )}
        </>
      )}

      {/* Initial state */}
      {!isSearching && !hasSearched && (
        <div className="text-center py-8">
          <p className="text-text-secondary">
            Search for matches where you were added as a placeholder participant.
          </p>
          <p className="text-sm text-text-tertiary mt-2">
            Enter the name that was used when the match was logged.
          </p>
        </div>
      )}
    </div>
  );
}
