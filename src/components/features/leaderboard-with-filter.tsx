'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar, RatingDisplay } from '@/components/ui'
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

type LeaderboardWithFilterProps = {
  entries: LeaderboardEntry[]
}

/**
 * Leaderboard preview with format filter tabs.
 * Client component for interactive filtering.
 */
export function LeaderboardWithFilter({ entries }: LeaderboardWithFilterProps) {
  const [selectedFormat, setSelectedFormat] = useState<FormatSlug | 'all'>('all')

  // In real implementation, filtering would happen server-side or entries would have format data
  // For now, we just display all entries regardless of filter (mock data limitation)
  const filteredEntries = entries

  return (
    <div>
      {/* Format filter tabs */}
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

      {/* Leaderboard entries */}
      <div className="divide-y divide-card-border">
        {filteredEntries.map((entry) => (
          <Link
            key={entry.id}
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
            <Avatar src={entry.avatarUrl} fallback={entry.username} size="sm" />

            {/* Name & Stats */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-1 truncate">{entry.username}</p>
              <p className="text-mono-xs text-text-2">{entry.matchesPlayed} matches</p>
            </div>

            {/* Win Rate */}
            <span className="text-sm font-medium text-text-2 w-14 text-right">
              {entry.winRate}% WR
            </span>

            {/* Rating */}
            <RatingDisplay rating={entry.rating} />
          </Link>
        ))}
      </div>
    </div>
  )
}
