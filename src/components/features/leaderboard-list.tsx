'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar, RatingDisplay } from '@/components/ui'
import { MotionList, MotionListItem } from '@/components/ui/motion'
import { cn } from '@/lib/utils'
import type { LeaderboardEntry, FormatSlug } from '@/types'

const FORMAT_OPTIONS: { value: FormatSlug | 'all'; label: string }[] = [
  { value: 'all', label: 'All Formats' },
  { value: 'ffa', label: 'FFA' },
  { value: '1v1', label: '1v1' },
  { value: '2v2', label: '2v2' },
  { value: '3v3', label: '3v3' },
  { value: 'pentagram', label: 'Pentagram' },
]

// ============================================================================
// LeaderboardRow - Shared row component for consistent rendering
// ============================================================================

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  /** Show win rate column (hidden on small screens in filtered view) */
  showWinRate?: boolean
  /** Additional class for responsive win rate visibility */
  winRateClassName?: string
}

function LeaderboardRow({ 
  entry, 
  showWinRate = true,
  winRateClassName = "w-32 text-right" 
}: LeaderboardRowProps) {
  return (
    <Link
      href={`/player/${entry.username}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-bg-raised/50 transition-colors"
    >
      {/* Rank */}
      <span
        className={cn(
          'w-6 text-center font-display font-bold',
          entry.rank === 1 && 'text-gold',
          entry.rank === 2 && 'text-text-2',
          entry.rank === 3 && 'text-[#cd7f32]', // bronze
          entry.rank > 3 && 'text-text-3'
        )}
      >
        {entry.rank}
      </span>

      {/* Avatar */}
      <Avatar src={entry.avatarUrl} fallback={entry.displayName || entry.username} size="sm" />

      {/* Name & Stats */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-1 truncate">{entry.displayName || entry.username}</p>
        <p className="text-mono-xs text-text-2">@{entry.username}</p>
      </div>

      {/* Win Rate */}
      {showWinRate && (
        <span className={cn("text-sm font-medium text-text-2", winRateClassName)}>
          {entry.winRate}% WR
        </span>
      )}

      {/* Rating */}
      <RatingDisplay rating={entry.rating} animated />
    </Link>
  )
}

// ============================================================================
// LeaderboardList - Main component with optional format filter
// ============================================================================

interface LeaderboardListProps {
  entries: LeaderboardEntry[]
  /** Show format filter tabs */
  showFormatFilter?: boolean
  /** Empty state message when no entries */
  emptyMessage?: string
  /** Secondary empty state message */
  emptySubMessage?: string
}

/**
 * Unified leaderboard list component.
 * Can display a simple list or include format filter tabs.
 * 
 * @example
 * // Simple leaderboard preview
 * <LeaderboardList entries={topPlayers} />
 * 
 * // With format filter
 * <LeaderboardList entries={allEntries} showFormatFilter />
 */
export function LeaderboardList({ 
  entries, 
  showFormatFilter = false,
  emptyMessage = 'No players ranked yet',
  emptySubMessage = 'Play some matches to see the leaderboard',
}: LeaderboardListProps) {
  const [selectedFormat, setSelectedFormat] = useState<FormatSlug | 'all'>('all')

  // Filter and rank entries based on format selection
  const displayEntries = showFormatFilter
    ? (() => {
        const filtered = selectedFormat === 'all'
          ? entries.filter(e => !e.formatSlug)
          : entries.filter(e => e.formatSlug === selectedFormat)
        
        return filtered
          .sort((a, b) => b.matchesPlayed - a.matchesPlayed || b.rating - a.rating)
          .slice(0, 10)
          .map((entry, index) => ({ ...entry, rank: index + 1 }))
      })()
    : entries

  const formatLabel = showFormatFilter && selectedFormat !== 'all'
    ? FORMAT_OPTIONS.find(o => o.value === selectedFormat)?.label || selectedFormat
    : null

  const isEmpty = displayEntries.length === 0

  return (
    <div className="overflow-hidden">
      {/* Format filter tabs (optional) */}
      {showFormatFilter && (
        <div className="flex gap-1 px-4 py-3 border-b border-card-border overflow-x-auto">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedFormat(option.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
                selectedFormat === option.value
                  ? 'bg-accent text-white'
                  : 'text-text-2 hover:text-text-1 hover:bg-surface'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Leaderboard entries */}
      {isEmpty ? (
        <div className="px-4 py-8 text-center">
          <p className="text-text-3 text-sm">
            {formatLabel 
              ? `No players ranked in ${formatLabel}` 
              : emptyMessage
            }
          </p>
          {emptySubMessage && (
            <p className="text-text-3 text-xs mt-1">{emptySubMessage}</p>
          )}
        </div>
      ) : (
        <MotionList 
          className="divide-y divide-card-border" 
          key={showFormatFilter ? selectedFormat : 'static'}
          fast
        >
          {displayEntries.map((entry) => (
            <MotionListItem key={`${entry.id}-${entry.formatSlug ?? 'all'}`}>
              <LeaderboardRow 
                entry={entry} 
                winRateClassName={showFormatFilter ? "hidden sm:block w-20 text-right" : "w-32 text-right"}
              />
            </MotionListItem>
          ))}
        </MotionList>
      )}
    </div>
  )
}

// ============================================================================
// Backwards compatibility exports
// ============================================================================

/** @deprecated Use LeaderboardList instead */
export function LeaderboardPreview({ entries }: { entries: LeaderboardEntry[] }) {
  return <LeaderboardList entries={entries} />
}

/** @deprecated Use LeaderboardList with showFormatFilter prop instead */
export function LeaderboardWithFilter({ entries }: { entries: LeaderboardEntry[] }) {
  return <LeaderboardList entries={entries} showFormatFilter />
}
