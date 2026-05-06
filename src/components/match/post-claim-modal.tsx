"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { sendFriendRequest } from "@/lib/supabase/profiles";
import { requestCollectionMembership } from "@/app/actions/collection";
import { createClient } from "@/lib/supabase/client";

interface PostClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchCreatorId: string;
  matchCreatorUsername: string;
  isAlreadyFriend: boolean;
  hasPendingFriendRequest: boolean;
  collections: Array<{ id: string; name: string; isMember: boolean; hasPendingRequest: boolean }>;
  currentUserId: string;
}

/**
 * Modal shown after successfully claiming a placeholder slot.
 * Offers optional actions:
 * - Send friend request to match creator
 * - Request to join collections the match belongs to
 */
export function PostClaimModal({
  isOpen,
  onClose,
  matchCreatorId,
  matchCreatorUsername,
  isAlreadyFriend,
  hasPendingFriendRequest,
  collections,
  currentUserId,
}: PostClaimModalProps) {
  const router = useRouter();
  const [sendFriendReq, setSendFriendReq] = React.useState(false);
  const [joinCollections, setJoinCollections] = React.useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Check if friend request option should be disabled
  const friendDisabled = isAlreadyFriend || hasPendingFriendRequest;

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSendFriendReq(false);
      setJoinCollections({});
      setError(null);
    }
  }, [isOpen]);

  const hasSelections = sendFriendReq || Object.values(joinCollections).some(Boolean);

  const handleSubmit = async () => {
    if (!hasSelections) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Send friend request if selected
      if (sendFriendReq) {
        const result = await sendFriendRequest(supabase, currentUserId, matchCreatorId);
        if (!result.success && !result.error?.includes("already")) {
          // Ignore "already friends" type errors
          console.error("Friend request failed:", result.error);
        }
      }

      // Request to join collections if selected
      for (const [collectionId, shouldJoin] of Object.entries(joinCollections)) {
        if (shouldJoin) {
          const result = await requestCollectionMembership(collectionId);
          if (!result.success && !result.error?.includes("already")) {
            console.error("Collection join request failed:", result.error);
          }
        }
      }

      router.refresh();
      onClose();
    } catch {
      setError("An error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg-overlay/80 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-sm mx-4">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-accent-dim flex items-center justify-center">
            <svg
              className="w-5 h-5 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="font-display text-lg font-semibold text-text-1">
            Slot Claimed!
          </h2>
          <p className="text-sm text-text-2">
            You've successfully joined this match
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error message */}
          {error && (
            <div className="rounded-md bg-danger-dim border border-danger-ring p-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Optional actions */}
          <div className="space-y-3">
            {/* Friend request option */}
            <label className={`flex items-start gap-3 ${friendDisabled ? 'cursor-default' : 'cursor-pointer group'}`}>
              <Checkbox
                checked={isAlreadyFriend || hasPendingFriendRequest || sendFriendReq}
                onCheckedChange={(checked: boolean) => setSendFriendReq(checked)}
                disabled={friendDisabled}
                className="mt-0.5"
              />
              <div className="flex-1">
                <p className={`text-sm ${friendDisabled ? 'text-text-3' : 'text-text-1 group-hover:text-accent transition-colors'}`}>
                  {isAlreadyFriend 
                    ? `Already friends with @${matchCreatorUsername}`
                    : hasPendingFriendRequest
                    ? `Friend request pending with @${matchCreatorUsername}`
                    : `Send friend request to @${matchCreatorUsername}`}
                </p>
                {!friendDisabled && (
                  <p className="text-xs text-text-3">
                    Connect with the match creator
                  </p>
                )}
              </div>
            </label>

            {/* Collection join options */}
            {collections.map((collection) => {
              const isDisabled = collection.isMember || collection.hasPendingRequest;
              
              return (
                <label 
                  key={collection.id} 
                  className={`flex items-start gap-3 ${isDisabled ? 'cursor-default' : 'cursor-pointer group'}`}
                >
                  <Checkbox
                    checked={collection.isMember || collection.hasPendingRequest || (joinCollections[collection.id] ?? false)}
                    onCheckedChange={(checked: boolean) =>
                      setJoinCollections((prev) => ({
                        ...prev,
                        [collection.id]: checked,
                      }))
                    }
                    disabled={isDisabled}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${isDisabled ? 'text-text-3' : 'text-text-1 group-hover:text-accent transition-colors'}`}>
                      {collection.isMember
                        ? `Already a member of "${collection.name}"`
                        : collection.hasPendingRequest
                        ? `Join request pending for "${collection.name}"`
                        : `Request to join "${collection.name}"`}
                    </p>
                    {!isDisabled && (
                      <p className="text-xs text-text-3">
                        Join this collection to track stats
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="flex-1"
              disabled={isSubmitting}
            >
              Skip
            </Button>
            {hasSelections && (
              <Button
                onClick={handleSubmit}
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send Requests"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
