'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { inviteCollectionMember } from '@/app/actions/collection'
import { createClient } from '@/lib/supabase/client'

type FriendResult = {
  id: string
  username: string
  avatarUrl: string | null
}

interface InviteMemberModalProps {
  collectionId: string
  currentMemberIds: string[]
  isOpen: boolean
  onClose: () => void
}

export function InviteMemberModal({
  collectionId,
  currentMemberIds,
  isOpen,
  onClose,
}: InviteMemberModalProps) {
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<FriendResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [isInviting, setIsInviting] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const router = useRouter()

  // Search for friends to invite
  React.useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const searchFriends = async () => {
      setIsSearching(true)
      const supabase = createClient()
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsSearching(false)
        return
      }

      // Search profiles matching query
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query}%`)
        .not('id', 'in', `(${currentMemberIds.join(',')})`)
        .limit(10)

      setResults(
        (profiles ?? []).map(p => ({
          id: p.id,
          username: p.username,
          avatarUrl: p.avatar_url,
        }))
      )
      setIsSearching(false)
    }

    const timeoutId = setTimeout(searchFriends, 300)
    return () => clearTimeout(timeoutId)
  }, [query, currentMemberIds])

  const handleInvite = async (userId: string) => {
    setIsInviting(userId)
    setError(null)

    const result = await inviteCollectionMember(collectionId, userId)

    if (result.success) {
      // Remove from results
      setResults(prev => prev.filter(r => r.id !== userId))
      router.refresh()
    } else {
      setError(result.error)
    }

    setIsInviting(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card border border-card-border rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-card-border">
          <h2 className="text-lg font-semibold text-text-1">Invite Member</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-text-3 hover:text-text-1 hover:bg-surface rounded transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-loss/10 border border-loss/30 text-loss text-sm">
              {error}
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for players..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-surface border border-card-border text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {isSearching ? (
              <div className="py-8 text-center text-text-3">
                Searching...
              </div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-text-3">
                {query.length < 2
                  ? 'Type at least 2 characters to search'
                  : 'No players found'}
              </div>
            ) : (
              results.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-surface transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={result.avatarUrl}
                      fallback={result.username}
                      size="sm"
                    />
                    <span className="text-sm text-text-1 truncate">
                      {result.username}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleInvite(result.id)}
                    disabled={isInviting !== null}
                  >
                    {isInviting === result.id ? '...' : 'Invite'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-card-border bg-surface/50">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
