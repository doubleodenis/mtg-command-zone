'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormatBadge, ConfirmationStatus } from '@/components/ui'
import { formatRelativeTime } from '@/lib/utils'
import { confirmMatch } from '@/app/actions/match'
import type { PendingConfirmation } from '@/types'

type PendingConfirmationCardProps = {
  confirmation: PendingConfirmation
  userDecks?: Array<{ id: string; deckName: string | null; commanderName: string }>
}

/**
 * Displays a pending match confirmation with actions to view/confirm.
 * Used on the personal dashboard.
 */
export function PendingConfirmationCard({ confirmation, userDecks = [] }: PendingConfirmationCardProps) {
  const { match, participantId } = confirmation
  const [isConfirming, setIsConfirming] = React.useState(false)
  const [showDeckSelect, setShowDeckSelect] = React.useState(false)
  const [selectedDeck, setSelectedDeck] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<{ delta: number; newRating: number } | null>(null)

  const confirmationStatus = match.isFullyConfirmed 
    ? 'confirmed' 
    : match.confirmedCount > 0 
      ? 'pending' 
      : 'unconfirmed'

  const handleConfirm = async (deckId?: string) => {
    setIsConfirming(true)
    setError(null)

    const response = await confirmMatch(participantId, deckId)

    if (response.success) {
      setResult(response.data)
    } else {
      setError(response.error)
    }

    setIsConfirming(false)
    setShowDeckSelect(false)
  }

  const onConfirmClick = () => {
    // If user has decks and needs to select one, show selector
    // For now, just confirm directly (deck selection can be added)
    if (userDecks.length > 0 && !selectedDeck) {
      setShowDeckSelect(true)
    } else {
      handleConfirm(selectedDeck || undefined)
    }
  }

  // Show result state
  if (result) {
    return (
      <Card className="border-win/30 bg-win/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-win/20 flex items-center justify-center">
                <span className="text-win text-lg">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-text-1">Match Confirmed!</p>
                <p className="text-sm text-text-2">
                  Rating: {result.delta >= 0 ? '+' : ''}{result.delta} → {result.newRating}
                </p>
              </div>
            </div>
            <Link href={`/match/${match.id}`}>
              <Button size="sm" variant="secondary">View Match</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show deck selection
  if (showDeckSelect) {
    return (
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-text-1">Select your deck for this match:</p>
          <select
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
            className="w-full h-9 rounded-md border border-card-border bg-card px-3 text-sm text-text-1"
          >
            <option value="">Choose a deck...</option>
            {userDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.commanderName} {deck.deckName ? `(${deck.deckName})` : ''}
              </option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="secondary" onClick={() => setShowDeckSelect(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => handleConfirm(selectedDeck)} disabled={!selectedDeck || isConfirming}>
              {isConfirming ? 'Confirming...' : 'Confirm'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="p-4">
        {error && (
          <div className="mb-3 p-2 rounded bg-loss/10 text-loss text-sm">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Match info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FormatBadge format={match.formatSlug} />
                <span className="text-text-2 text-sm">•</span>
                <span className="text-text-2 text-sm">{match.participantCount} players</span>
              </div>
              <p className="text-text-2 text-sm mt-1">
                {formatRelativeTime(match.playedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Confirmation status */}
            <div className="flex items-center gap-1.5 text-sm text-text-2">
              <ConfirmationStatus status={confirmationStatus} />
              <span>{match.confirmedCount}/{match.participantCount}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Link href={`/match/${match.id}`}>
                <Button size="sm" variant="secondary">
                  View
                </Button>
              </Link>
              <Button size="sm" onClick={onConfirmClick} disabled={isConfirming}>
                {isConfirming ? 'Confirming...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
