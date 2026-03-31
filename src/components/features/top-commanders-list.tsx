import Image from 'next/image'
import { ColorIdentity, BracketBadge } from '@/components/ui'
import { cn } from '@/lib/utils'
import { buildCommanderImageUrl } from '@/lib/scryfall/api'
import type { DeckWithStats } from '@/types'

type TopCommandersListProps = {
  commanders: DeckWithStats[]
}

/**
 * Displays a ranked list of top commanders with images, color identity, and stats.
 * Used on the global dashboard.
 */
export function TopCommandersList({ commanders }: TopCommandersListProps) {
  return (
    <div className="divide-y divide-card-border">
      {commanders.map((deck, i) => (
        <div
          key={deck.id}
          className="flex items-center gap-4 px-4 py-3"
        >
          {/* Rank */}
          <span className={cn(
            "w-6 text-center font-display font-bold",
            i === 0 && "text-gold",
            i === 1 && "text-text-2",
            i === 2 && "text-[#cd7f32]",
            i > 2 && "text-text-3"
          )}>
            {i + 1}
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
            <p className="font-medium text-text-1 truncate">{deck.commanderName}</p>
            <p className="text-sm text-text-2">
              {deck.stats.gamesPlayed} games • {deck.stats.winRate}% WR
            </p>
          </div>

          {/* Bracket */}
          <BracketBadge bracket={deck.bracket} />
        </div>
      ))}
    </div>
  )
}
