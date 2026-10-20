import Image from 'next/image'
import { ColorIdentity, BracketBadge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { buildCommanderImageUrl } from '@/lib/scryfall/api'
import { MIN_GAMES_TO_RANK } from '@/lib/services/top-commanders'
import type { Bracket, DeckWithStats } from '@/types'

/** Satisfied by both CommanderStats (grouped ranking) and DeckWithStats (player page). */
export type TopCommanderItem = Pick<DeckWithStats, 'id' | 'commanderName' | 'colorIdentity' | 'stats'> & {
  partnerName?: string | null
  bracket: Bracket | null
  /** false = under the minimum games; shown unranked after ranked entries */
  qualified?: boolean
}

type TopCommandersListProps = {
  commanders: TopCommanderItem[]
}

/**
 * Displays a ranked list of top commanders with images, color identity, and stats.
 * Commanders with too few games are listed after the ranked ones without a rank.
 */
export function TopCommandersList({ commanders }: TopCommandersListProps) {
  return (
    <div className="divide-y divide-card-border">
      {commanders.map((deck, i) => {
        const isRanked = deck.qualified !== false
        const games = deck.stats.gamesPlayed
        return (
          <div
            key={deck.id}
            className="flex items-center gap-4 px-4 py-3"
          >
            {/* Rank */}
            <span className={cn(
              "w-6 text-center font-display font-bold",
              !isRanked && "text-text-3",
              isRanked && i === 0 && "text-gold",
              isRanked && i === 1 && "text-text-2",
              isRanked && i === 2 && "text-[#cd7f32]",
              isRanked && i > 2 && "text-text-3"
            )}>
              {isRanked ? i + 1 : "–"}
            </span>

            {/* Commander card image with color identity below */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-surface">
                <Image
                  src={buildCommanderImageUrl(deck.commanderName, "art_crop")}
                  alt={deck.commanderName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <ColorIdentity colors={deck.colorIdentity} size="sm" />
            </div>

            {/* Commander Name */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-1 truncate">
                {deck.partnerName ? `${deck.commanderName} + ${deck.partnerName}` : deck.commanderName}
              </p>
              <p className="text-sm text-text-2">
                {isRanked
                  ? `${games} games • ${deck.stats.winRate}% WR`
                  : `${games} ${games === 1 ? "game" : "games"} • needs ${MIN_GAMES_TO_RANK} to rank`}
              </p>
            </div>

            {/* Bracket */}
            {deck.bracket !== null && <BracketBadge bracket={deck.bracket} />}
          </div>
        )
      })}
    </div>
  )
}
