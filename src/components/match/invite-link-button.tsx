'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { createMatchInviteToken, getExistingInviteToken } from '@/app/actions/match'

interface InviteLinkButtonProps {
  matchId: string
  hasPlaceholderSlots: boolean
}

export function InviteLinkButton({ matchId, hasPlaceholderSlots }: InviteLinkButtonProps) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null)
  const [isCopied, setIsCopied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isGenerating, setIsGenerating] = React.useState(false)

  // Check for existing token on mount
  React.useEffect(() => {
    async function checkExistingToken() {
      const result = await getExistingInviteToken(matchId)
      if (result.success && result.data) {
        setInviteUrl(result.data.inviteUrl)
      }
      setIsLoading(false)
    }
    checkExistingToken()
  }, [matchId])

  const handleGenerateLink = async () => {
    setIsGenerating(true)
    setError(null)

    const result = await createMatchInviteToken(matchId)

    if (!result.success) {
      setError(result.error)
      setIsGenerating(false)
      return
    }

    setInviteUrl(result.data.inviteUrl)
    setIsGenerating(false)
  }

  const handleCopyLink = async () => {
    if (!inviteUrl) return

    try {
      const fullUrl = `${window.location.origin}${inviteUrl}`
      await navigator.clipboard.writeText(fullUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      setError('Failed to copy link')
    }
  }

  // Don't show if no placeholder slots
  if (!hasPlaceholderSlots) {
    return null
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <svg
          className="animate-spin h-4 w-4 mr-2"
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
        Loading...
      </Button>
    )
  }

  if (inviteUrl) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="gap-2"
        >
          {isCopied ? (
            <>
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
                className="text-green-500"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
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
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Copy Invite Link
            </>
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerateLink}
        disabled={isGenerating}
        className="gap-2"
      >
        {isGenerating ? (
          <>
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
            Generating...
          </>
        ) : (
          <>
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
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Generate Invite Link
          </>
        )}
      </Button>
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  )
}
