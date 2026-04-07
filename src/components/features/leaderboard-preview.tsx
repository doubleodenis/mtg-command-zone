import Link from 'next/link'
import { Avatar, RatingDisplay } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { LeaderboardEntry } from '@/types'

type LeaderboardPreviewProps = {
  entries: LeaderboardEntry[]
}

/**
 * Displays a preview list of leaderboard entries with rank, avatar, stats and rating.
 * Used on the global dashboard.
 */
export function LeaderboardPreview({ entries }: LeaderboardPreviewProps) {
  return (
    <div className="divide-y divide-card-border">
      {entries.map((entry) => (
        <Link
          key={entry.id}
          href={`/player/${entry.username}`}
          className="flex items-center gap-4 px-4 py-3 hover:bg-bg-raised/50 transition-colors"
        >
          {/* Rank */}
          <span className={cn(
            "w-6 text-center font-display font-bold",
            entry.rank === 1 && "text-gold",
            entry.rank === 2 && "text-text-2",
            entry.rank === 3 && "text-[#cd7f32]", // bronze
            entry.rank > 3 && "text-text-3"
          )}>
            {entry.rank}
          </span>

          {/* Avatar */}
          <Avatar src={entry.avatarUrl} fallback={entry.username} size="sm" />

          {/* Name & Stats */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-1 truncate">{entry.username}</p>
            <p className="text-mono-xs text-text-2">
              {entry.matchesPlayed} matches
            </p>
          </div>

          {/* Win Rate */}
          <span className="text-sm font-medium text-text-2 w-32 text-right">
            {entry.winRate}% WR
          </span>

          {/* Rating */}
          <RatingDisplay rating={entry.rating} />
        </Link>
      ))}
    </div>
  )
}
