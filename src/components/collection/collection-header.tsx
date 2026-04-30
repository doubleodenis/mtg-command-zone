"use client";

import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { InviteMemberButton } from "./invite-member-button";

interface CollectionHeaderProps {
  collection: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
  };
  isMember: boolean;
  isOwner: boolean;
  currentMemberIds: string[];
}

/**
 * Shared header for all collection pages.
 * Shows collection name, privacy badge, description, and action buttons.
 */
export function CollectionHeader({
  collection,
  isMember,
  isOwner,
  currentMemberIds,
}: CollectionHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold text-text-1">
            {collection.name}
          </h1>
          <Badge variant={collection.isPublic ? "outline" : "default"}>
            {collection.isPublic ? "Public" : "Private"}
          </Badge>
        </div>
        {collection.description && (
          <p className="text-text-2 max-w-2xl">{collection.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isMember ? (
          <>
            {isOwner && (
              <InviteMemberButton
                collectionId={collection.id}
                currentMemberIds={currentMemberIds}
              />
            )}
            <Button size="sm" asChild>
              <Link href="/matches/new">Log Match</Link>
            </Button>
          </>
        ) : (
          <Button size="sm">Request to Join</Button>
        )}
      </div>
    </div>
  );
}
