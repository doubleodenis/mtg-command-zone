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

  // Filter entries based on selected format
  // - 'all': show entries without formatSlug (aggregated entries)
  // - specific format: show entries with matching formatSlug
  const filteredEntries = selectedFormat === 'all'
    ? entries.filter(e => !e.formatSlug)
    : entries.filter(e => e.formatSlug === selectedFormat)

  // Re-rank filtered entries
  const rankedEntries = filteredEntries
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed || b.rating - a.rating)
    .slice(0, 10)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

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
        {rankedEntries.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-text-3 text-sm">
              {selectedFormat === 'all' 
                ? 'No players ranked yet' 
                : `No players ranked in ${FORMAT_OPTIONS.find(o => o.value === selectedFormat)?.label || selectedFormat}`
              }
            </p>
            <p className="text-text-3 text-xs mt-1">Play some matches to see the leaderboard</p>
          </div>
        ) : (
          rankedEntries.map((entry) => (
            <Link
              key={`${entry.id}-${entry.formatSlug ?? 'all'}`}
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
              <span className="text-sm font-medium text-text-2 w-32 text-right">
                {entry.winRate}% WR
              </span>

              {/* Rating */}
              <RatingDisplay rating={entry.rating} />
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
