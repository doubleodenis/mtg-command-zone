import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, Badge, RatingDelta } from '@/components/ui'
import type { CollectionActivity } from '@/types'

type CollectionActivityCardProps = {
  activity: CollectionActivity
}

/**
 * Displays user's activity within a collection including stats and top player.
 * Used on the personal dashboard.
 */
export function CollectionActivityCard({ activity }: CollectionActivityCardProps) {
  const { collection, userStats, topPlayer } = activity
  
  return (
    <Link href={`/collections/${collection.id}`}>
      <Card className="h-full hover:border-card-border-hover transition-colors">
        <CardContent className="p-5 space-y-4">
          {/* Collection header */}
          <div>
            <h3 className="font-display text-lg font-semibold text-text-1 truncate">{collection.name}</h3>
            <p className="text-sm text-text-2">
              {collection.memberCount} members • {collection.matchCount} matches
            </p>
          </div>

          {/* User stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface rounded-lg p-3 text-center">
              <p className="text-sublabel text-text-2 mb-1">Rating</p>
              <div className="flex items-center justify-center gap-1">
                <span className="font-display text-lg font-bold text-text-1">{userStats.rating}</span>
                <RatingDelta delta={userStats.ratingDelta} size="sm" />
              </div>
            </div>
            <div className="bg-surface rounded-lg p-3 text-center">
              <p className="text-sublabel text-text-2 mb-1">Win Rate</p>
              <span className="font-display text-lg font-bold text-text-1">{userStats.winRate}%</span>
            </div>
            <div className="bg-surface rounded-lg p-3 text-center">
              <p className="text-sublabel text-text-2 mb-1">Games</p>
              <span className="font-display text-lg font-bold text-text-1">{userStats.gamesPlayed}</span>
            </div>
          </div>

          {/* Top player */}
          {topPlayer && (
            <div className="flex items-center gap-3 pt-3 border-t border-card-border">
              <Avatar src={topPlayer.profile.avatarUrl} fallback={topPlayer.profile.username} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-base text-text-1 truncate">{topPlayer.profile.username}</p>
                <p className="text-sm text-text-2">Top player • {topPlayer.winRate}% WR</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
