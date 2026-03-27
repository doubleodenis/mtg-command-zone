/**
 * Services Layer
 *
 * Business logic and data transformations.
 * Services orchestrate raw database queries and transform data for UI consumption.
 *
 * Usage:
 * ```ts
 * import { createClient } from '@/lib/supabase/server'
 * import { getRecentMatchCards, getPlatformStats } from '@/lib/services'
 *
 * export default async function Page() {
 *   const client = await createClient()
 *   const { data: matches } = await getRecentMatchCards(client, { limit: 5 })
 *   const { data: stats } = await getPlatformStats(client)
 * }
 * ```
 */

// Match service
export { getMatchById, getRecentMatchCards, getUserPendingConfirmations } from './match'
export type { GetRecentMatchCardsOptions } from './match'

// Collection service
export { getUserCollectionActivities } from './collection'

// Deck service
export { getTopCommanders } from './deck'
export type { GetTopCommandersOptions } from './deck'

// Stats service
export { getPlatformStats, getUserStats } from './stats'
export type { PlatformStats, UserStats, GetUserStatsOptions } from './stats'
