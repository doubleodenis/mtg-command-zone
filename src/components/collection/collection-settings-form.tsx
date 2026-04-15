"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { updateCollectionSettings, deleteCollection } from "@/app/actions/collection";
import type { Collection, MatchAddPermission } from "@/types";

interface CollectionSettingsFormProps {
  collection: Collection;
  className?: string;
}

const PERMISSION_OPTIONS: {
  value: MatchAddPermission;
  label: string;
  description: string;
}[] = [
  {
    value: "owner_only",
    label: "Owner only",
    description: "Only you can add matches to this collection",
  },
  {
    value: "any_member",
    label: "Any member",
    description: "All members can add matches directly",
  },
  {
    value: "any_member_approval_required",
    label: "Members with approval",
    description: "Members can add matches, but you must approve them",
  },
];

/**
 * Collection settings form.
 * Allows updating collection details, privacy, and permissions.
 * Only visible to collection owners.
 */
export function CollectionSettingsForm({
  collection,
  className,
}: CollectionSettingsFormProps) {
  const router = useRouter();
  
  // Form state
  const [name, setName] = React.useState(collection.name);
  const [description, setDescription] = React.useState(collection.description ?? "");
  const [isPublic, setIsPublic] = React.useState(collection.isPublic);
  const [matchAddPermission, setMatchAddPermission] = React.useState<MatchAddPermission>(
    collection.matchAddPermission
  );
  const [autoApproveMembers, setAutoApproveMembers] = React.useState(
    collection.autoApproveMembers
  );
  
  // UI state
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Track if form has changes
  const hasChanges = 
    name !== collection.name ||
    description !== (collection.description ?? "") ||
    isPublic !== collection.isPublic ||
    matchAddPermission !== collection.matchAddPermission ||
    autoApproveMembers !== collection.autoApproveMembers;

  const canSave = name.trim().length > 0 && hasChanges;

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateCollectionSettings(collection.id, {
        name: name.trim(),
        description: description.trim() || null,
        isPublic,
        matchAddPermission,
        autoApproveMembers,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      setSuccess(true);
      router.refresh();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update collection");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteCollection(collection.id);

      if (!result.success) {
        throw new Error(result.error);
      }

      router.push("/collections");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete collection");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic collection information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="collection-name" className="text-sm font-medium text-text-1">
              Collection Name
            </label>
            <Input
              id="collection-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter collection name"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="collection-description" className="text-sm font-medium text-text-1">
              Description
              <span className="text-text-3 ml-1">(optional)</span>
            </label>
            <textarea
              id="collection-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A description for your playgroup or tournament..."
              rows={3}
              className={cn(
                "flex w-full rounded-md px-4 py-3",
                "bg-card border border-card-border",
                "text-base text-text-1 placeholder:text-text-2",
                "transition-colors duration-150",
                "hover:border-card-border-hi",
                "focus:outline-none focus:border-accent-ring focus:ring-1 focus:ring-accent-ring",
                "resize-none"
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>
          <CardDescription>Control who can see this collection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="collection-public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className={cn(
                "mt-1 h-5 w-5 rounded",
                "border-2 border-card-border bg-card",
                "checked:bg-accent-fill checked:border-accent",
                "focus:outline-none focus:border-accent",
                "cursor-pointer transition-colors"
              )}
            />
            <div>
              <label
                htmlFor="collection-public"
                className="text-text-1 font-medium cursor-pointer"
              >
                Public collection
              </label>
              <p className="text-text-2 text-sm mt-0.5">
                Public collections appear in search results and anyone can view
                the leaderboard. Private collections are only visible to members.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participation */}
      <Card>
        <CardHeader>
          <CardTitle>Participation</CardTitle>
          <CardDescription>Control how members interact with match results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="auto-approve-members"
              checked={autoApproveMembers}
              onChange={(e) => setAutoApproveMembers(e.target.checked)}
              className={cn(
                "mt-1 h-5 w-5 rounded",
                "border-2 border-card-border bg-card",
                "checked:bg-accent-fill checked:border-accent",
                "focus:outline-none focus:border-accent",
                "cursor-pointer transition-colors"
              )}
            />
            <div>
              <label
                htmlFor="auto-approve-members"
                className="text-text-1 font-medium cursor-pointer"
              >
                Auto-confirm members
              </label>
              <p className="text-text-2 text-sm mt-0.5">
                When enabled, collection members are automatically confirmed for matches
                added to this collection — no manual approval needed. Members can still
                update their deck afterward to keep commander stats accurate.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Match Permissions</CardTitle>
          <CardDescription>Control who can add matches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {PERMISSION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMatchAddPermission(option.value)}
                className={cn(
                  "w-full text-left p-4 rounded-lg cursor-pointer transition-colors",
                  "border",
                  "focus:outline-none focus:ring-2 focus:ring-accent-ring",
                  matchAddPermission === option.value
                    ? "border-accent bg-accent-fill/10"
                    : "border-card-border hover:border-card-border-hi"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-text-1 font-medium">{option.label}</span>
                    <p className="text-text-2 text-sm mt-0.5">
                      {option.description}
                    </p>
                  </div>
                  {matchAddPermission === option.value && (
                    <div className="shrink-0 ml-3">
                      <svg
                        className="w-5 h-5 text-accent"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button & Status */}
      {(error || success || hasChanges) && (
        <div className="flex items-center justify-between">
          <div>
            {error && (
              <p className="text-loss text-sm">{error}</p>
            )}
            {success && (
              <p className="text-win text-sm">Settings saved successfully</p>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={!canSave || isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      {/* Danger Zone */}
      <Card className="border-loss/30">
        <CardHeader>
          <CardTitle className="text-loss">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that affect the entire collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between p-4 border border-loss/30 rounded-lg">
              <div>
                <p className="font-medium text-text-1">Delete Collection</p>
                <p className="text-sm text-text-2">
                  Permanently remove this collection and all its data
                </p>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </Button>
            </div>
          ) : (
            <div className="p-4 border border-loss rounded-lg space-y-4">
              <div>
                <p className="font-medium text-loss">Are you sure?</p>
                <p className="text-sm text-text-2 mt-1">
                  This will permanently delete <strong>{collection.name}</strong> and all
                  associated data including match history and ratings within this collection.
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, delete collection"}
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
