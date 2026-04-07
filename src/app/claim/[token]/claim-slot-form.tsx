'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { submitClaimRequest } from '@/app/actions/match'
import type { ClaimStatus } from '@/types'

type PlaceholderSlot = {
  participantId: string
  placeholderName: string
  claimStatus: ClaimStatus
  hasPendingClaim: boolean
}

interface ClaimSlotFormProps {
  slots: PlaceholderSlot[]
  matchId: string
}

export function ClaimSlotForm({ slots, matchId }: ClaimSlotFormProps) {
  const router = useRouter()
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const availableSlots = slots.filter(s => s.claimStatus === 'none')

  const handleSubmit = async () => {
    if (!selectedSlot) return

    setIsSubmitting(true)
    setError(null)

    const result = await submitClaimRequest(selectedSlot)

    if (!result.success) {
      setError(result.error)
      setIsSubmitting(false)
      return
    }

    // Redirect to the match page
    router.push(`/match/${matchId}`)
    router.refresh()
  }

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-4 text-text-2">
        No slots available to claim.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Slot selection */}
      <div className="space-y-2">
        {slots.map((slot) => {
          const isAvailable = slot.claimStatus === 'none'
          const isPending = slot.claimStatus === 'pending'
          const isSelected = selectedSlot === slot.participantId

          return (
            <button
              key={slot.participantId}
              type="button"
              disabled={!isAvailable || isSubmitting}
              onClick={() => setSelectedSlot(slot.participantId)}
              className={`
                w-full p-4 rounded-lg border text-left transition-all
                ${isAvailable
                  ? isSelected
                    ? 'border-accent bg-accent/10 ring-1 ring-accent'
                    : 'border-border hover:border-accent/50 hover:bg-surface-secondary'
                  : 'border-border/50 bg-surface-secondary/50 opacity-60 cursor-not-allowed'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Radio indicator */}
                  <div className={`
                    w-4 h-4 rounded-full border-2 flex items-center justify-center
                    ${isSelected ? 'border-accent' : 'border-border'}
                  `}>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-accent" />
                    )}
                  </div>

                  {/* Slot info */}
                  <div>
                    <span className={`
                      font-medium
                      ${isAvailable ? 'text-text-1' : 'text-text-3'}
                    `}>
                      "{slot.placeholderName}"
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                {isPending && (
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                    Pending Claim
                  </Badge>
                )}
                {slot.claimStatus === 'approved' && (
                  <Badge variant="outline" className="text-green-500 border-green-500/30">
                    Claimed
                  </Badge>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={!selectedSlot || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Claiming...
          </span>
        ) : (
          'Claim This Slot'
        )}
      </Button>

      {/* Info text */}
      <p className="text-xs text-text-3 text-center">
        After claiming, the match creator will need to approve your claim.
      </p>
    </div>
  )
}
