"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { addMatchToCollection, getCollectionsForMatch } from "@/app/actions/collection";
import type { CollectionWithMembership, ApprovalStatus } from "@/types";

type CollectionOption = CollectionWithMembership & {
  canAddDirectly: boolean;
  alreadyAdded: boolean;
};

interface AddToCollectionModalProps {
  matchId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (collectionId: string, status: ApprovalStatus) => void;
  className?: string;
}

/**
 * Modal for adding a match to a collection.
 * Shows all collections the user is a member of with permission info.
 */
export function AddToCollectionModal({
  matchId,
  isOpen,
  onClose,
  onSuccess,
  className,
}: AddToCollectionModalProps) {
  const [collections, setCollections] = React.useState<CollectionOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const loadCollections = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getCollectionsForMatch(matchId);

    if (result.success) {
      setCollections(result.data);
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  }, [matchId]);

  // Load collections when modal opens
  React.useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen, loadCollections]);

  const handleAddToCollection = async (collectionId: string) => {
    setIsAdding(collectionId);
    setError(null);
    setSuccessMessage(null);

    const result = await addMatchToCollection(matchId, collectionId);

    if (result.success) {
      const message =
        result.data.status === "pending"
          ? "Match submitted for approval"
          : "Match added to collection";
      setSuccessMessage(message);
      
      // Update local state to reflect the change
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId ? { ...c, alreadyAdded: true } : c
        )
      );

      onSuccess?.(collectionId, result.data.status);
      
      // Auto-close after success
      setTimeout(() => {
        setSuccessMessage(null);
      }, 2000);
    } else {
      setError(result.error);
    }

    setIsAdding(null);
  };

  if (!isOpen) return null;

  const availableCollections = collections.filter((c) => !c.alreadyAdded);
  const addedCollections = collections.filter((c) => c.alreadyAdded);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card
        className={cn(
          "relative z-10 w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col",
          className
        )}
      >
        <CardHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Add to Collection</CardTitle>
              <CardDescription>
                Choose a collection to add this match to
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
            >
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
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-md bg-loss/10 border border-loss/20 text-loss text-sm">
              {error}
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-md bg-win/10 border border-win/20 text-win text-sm">
              {successMessage}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg bg-bg-overlay animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && collections.length === 0 && (
            <div className="text-center py-8">
              <p className="text-text-3 mb-2">No collections available</p>
              <p className="text-sm text-text-3">
                Create a collection first to add matches to it.
              </p>
            </div>
          )}

          {/* Available collections */}
          {!isLoading && availableCollections.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-2">
                Available Collections
              </p>
              {availableCollections.map((collection) => (
                <CollectionOptionCard
                  key={collection.id}
                  collection={collection}
                  isAdding={isAdding === collection.id}
                  onAdd={() => handleAddToCollection(collection.id)}
                />
              ))}
            </div>
          )}

          {/* Already added collections */}
          {!isLoading && addedCollections.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium text-text-3">
                Already Added
              </p>
              {addedCollections.map((collection) => (
                <CollectionOptionCard
                  key={collection.id}
                  collection={collection}
                  disabled
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface CollectionOptionCardProps {
  collection: CollectionOption;
  isAdding?: boolean;
  disabled?: boolean;
  onAdd?: () => void;
}

function CollectionOptionCard({
  collection,
  isAdding,
  disabled,
  onAdd,
}: CollectionOptionCardProps) {
  const permissionLabel = {
    owner_only: "Owner only",
    any_member: "Open",
    any_member_approval_required: "Needs approval",
  }[collection.matchAddPermission];

  const isOwner = collection.userRole === "owner";

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-colors",
        disabled
          ? "bg-bg-overlay border-card-border opacity-60"
          : "bg-card border-card-border hover:border-card-border-hi"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-text-1 truncate">
              {collection.name}
            </h4>
            {isOwner && (
              <Badge variant="accent" className="text-xs">
                Owner
              </Badge>
            )}
          </div>
          {collection.description && (
            <p className="text-sm text-text-3 truncate mt-0.5">
              {collection.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-3">
            <span>{collection.memberCount} members</span>
            <span>{collection.matchCount} matches</span>
            {!disabled && (
              <Badge variant="outline" className="text-xs">
                {permissionLabel}
              </Badge>
            )}
          </div>
        </div>

        {!disabled && onAdd && (
          <Button
            size="sm"
            variant={collection.canAddDirectly ? "primary" : "secondary"}
            onClick={onAdd}
            disabled={isAdding}
          >
            {isAdding ? (
              <span className="flex items-center gap-2">
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
                Adding...
              </span>
            ) : collection.canAddDirectly ? (
              "Add"
            ) : (
              "Request"
            )}
          </Button>
        )}

        {disabled && (
          <Badge variant="default" className="text-xs">
            Added
          </Badge>
        )}
      </div>
    </div>
  );
}
