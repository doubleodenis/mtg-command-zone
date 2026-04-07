"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorBanner } from "@/components/ui/form-feedback";
import { createClient } from "@/lib/supabase/client";
import { getUserFriendlyError } from "@/lib/errors";
import { createCollection } from "@/lib/supabase/collections";
import type { MatchAddPermission, CreateCollectionPayload } from "@/types";

type CollectionFormData = {
  name: string;
  description: string;
  isPublic: boolean;
  matchAddPermission: MatchAddPermission;
  autoApproveMembers: boolean;
};

interface CollectionFormProps {
  /** Form submission handler (overrides default behavior) */
  onSubmit?: (data: CollectionFormData) => Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
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
 * Collection creation form.
 * Handles collection name, description, visibility, and match permissions.
 */
export function CollectionForm({
  onSubmit,
  onCancel,
  className,
}: CollectionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(false);
  const [matchAddPermission, setMatchAddPermission] =
    React.useState<MatchAddPermission>("any_member");
  const [autoApproveMembers, setAutoApproveMembers] = React.useState(true);

  const canSubmit = name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const formData: CollectionFormData = {
        name: name.trim(),
        description: description.trim(),
        isPublic,
        matchAddPermission,
        autoApproveMembers,
      };

      if (onSubmit) {
        await onSubmit(formData);
      } else {
        // Default behavior: create collection via Supabase
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("You must be logged in to create a collection");
        }

        const payload: CreateCollectionPayload = {
          name: formData.name,
          description: formData.description || null,
          isPublic: formData.isPublic,
          matchAddPermission: formData.matchAddPermission,
          autoApproveMembers: formData.autoApproveMembers,
        };

        const result = await createCollection(supabase, user.id, payload);

        if (!result.success) {
          throw new Error(result.error);
        }

        router.push(`/collections/${result.data.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(getUserFriendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push("/collections");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
      {/* Collection Details */}
      <Card>
        <CardHeader>
          <CardTitle>Collection Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <label
              htmlFor="collection-name"
              className="text-label text-text-2 block"
            >
              Name
            </label>
            <Input
              id="collection-name"
              type="text"
              placeholder="Friday Night Commander"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="collection-description"
              className="text-label text-text-2 block"
            >
              Description
              <span className="text-text-3 ml-1">(optional)</span>
            </label>
            <textarea
              id="collection-description"
              placeholder="A description for your playgroup or tournament..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                the leaderboard. Private collections are only visible to
                members.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participation */}
      <Card>
        <CardHeader>
          <CardTitle>Participation</CardTitle>
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
                Collection members are automatically confirmed for matches added
                to this collection — no manual approval needed. Members can still
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
        </CardHeader>
        <CardContent>
          <p className="text-text-2 text-sm mb-4">
            Control who can add matches to this collection.
          </p>
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

      {/* Error */}
      <FormErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Collection"}
        </Button>
      </div>
    </form>
  );
}
