"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AddToCollectionModal } from "@/components/collection";
import type { ApprovalStatus } from "@/types";

interface AddToCollectionButtonProps {
  matchId: string;
  className?: string;
}

/**
 * Button that opens the Add to Collection modal.
 * For use in match detail pages.
 */
export function AddToCollectionButton({
  matchId,
  className,
}: AddToCollectionButtonProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [lastAdded, setLastAdded] = React.useState<{
    collectionId: string;
    status: ApprovalStatus;
  } | null>(null);

  const handleSuccess = (collectionId: string, status: ApprovalStatus) => {
    setLastAdded({ collectionId, status });
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className={className}
      >
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
          className="mr-1.5"
        >
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          <line x1="12" y1="10" x2="12" y2="16" />
          <line x1="9" y1="13" x2="15" y2="13" />
        </svg>
        Add to Collection
      </Button>

      <AddToCollectionModal
        matchId={matchId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
