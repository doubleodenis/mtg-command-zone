'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { InviteMemberModal } from './invite-member-modal'

interface InviteMemberButtonProps {
  collectionId: string
  currentMemberIds: string[]
}

export function InviteMemberButton({
  collectionId,
  currentMemberIds,
}: InviteMemberButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        Invite Member
      </Button>
      <InviteMemberModal
        collectionId={collectionId}
        currentMemberIds={currentMemberIds}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}
