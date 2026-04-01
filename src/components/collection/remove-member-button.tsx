'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { removeCollectionMember } from '@/app/actions/collection'

interface RemoveMemberButtonProps {
  collectionId: string
  userId: string
  username: string
}

export function RemoveMemberButton({
  collectionId,
  userId,
  username,
}: RemoveMemberButtonProps) {
  const [isRemoving, setIsRemoving] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const router = useRouter()

  const handleRemove = async () => {
    setIsRemoving(true)
    
    const result = await removeCollectionMember(collectionId, userId)
    
    if (result.success) {
      router.refresh()
    } else {
      console.error('Failed to remove member:', result.error)
    }
    
    setIsRemoving(false)
    setShowConfirm(false)
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-3">Remove {username}?</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowConfirm(false)}
          disabled={isRemoving}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleRemove}
          disabled={isRemoving}
        >
          {isRemoving ? 'Removing...' : 'Confirm'}
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-loss hover:text-loss hover:bg-loss/10"
      onClick={() => setShowConfirm(true)}
    >
      Remove
    </Button>
  )
}
