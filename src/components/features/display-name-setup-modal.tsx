'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

interface DisplayNameSetupModalProps {
  userId: string
  currentDisplayName: string | null
}

export function DisplayNameSetupModal({
  userId,
  currentDisplayName,
}: DisplayNameSetupModalProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const needsSetup = searchParams.get('setup') === 'displayname'
  
  // Show modal if:
  // 1. URL has ?setup=displayname (OAuth redirect)
  // 2. User doesn't have a display name set
  const shouldShow = needsSetup || (!currentDisplayName && userId)
  
  const [isOpen, setIsOpen] = React.useState(shouldShow)
  const [displayName, setDisplayName] = React.useState(currentDisplayName || '')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Update open state when shouldShow changes
  React.useEffect(() => {
    if (shouldShow) {
      setIsOpen(true)
    }
  }, [shouldShow])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!displayName.trim()) {
      setError('Please enter a display name')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', userId)

      if (updateError) {
        setError(updateError.message)
        setIsSubmitting(false)
        return
      }

      // Remove setup param from URL if present
      if (needsSetup) {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('setup')
        const newUrl = params.toString() 
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname
        router.replace(newUrl)
      }

      setIsOpen(false)
      router.refresh()
    } catch {
      setError('Failed to save display name')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - no close on click since this is required */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card border border-card-border rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-2 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-1">
            Welcome to CommandZone!
          </h2>
          <p className="mt-2 text-sm text-text-2">
            Choose a display name that will be shown to other players.
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-loss/10 border border-loss/30 text-loss text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-1 mb-2">
              Display Name
            </label>
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              disabled={isSubmitting}
              autoFocus
              className="w-full"
            />
            <p className="mt-1.5 text-xs text-text-3">
              This can be your real name, nickname, or anything you'd like to go by.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || !displayName.trim()}
            className="w-full"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
